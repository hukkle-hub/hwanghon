#include "Boss/HWBossCanonRules.h"

#include "Boss/HWBossCharacter.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "GameFramework/CharacterMovementComponent.h"

void UHWBossCanonRules::SetupCast(AHWAinCharacter* InAin, const TMap<FName, AActor*>& InCast)
{
    CastAin = InAin;
    CastMembers.Reset();
    for (const auto& Pair : InCast) CastMembers.Add(Pair.Key, Pair.Value);
}

void UHWBossCanonRules::Steer(AActor* Who, const FVector& Goal, float AcceptCm)
{
    APawn* Pawn = Cast<APawn>(Who);
    if (!Pawn) return;
    const FVector Delta = Goal - Pawn->GetActorLocation();
    if (Delta.Size2D() > AcceptCm)
    {
        Pawn->AddMovementInput(Delta.GetSafeNormal2D(), FMath::Clamp(Delta.Size2D() / 120.f, 0.35f, 1.f));
    }
}

void UHWBossCanonRules::Face(AActor* Who, const FVector& Target)
{
    if (!Who) return;
    Who->SetActorRotation(FRotator(0.f, (Target - Who->GetActorLocation()).Rotation().Yaw, 0.f));
}

void UHWBossCanonRules::Beat(FName Name)
{
    UE_LOG(LogTemp, Display, TEXT("[HWCanon] %s %s"), GetOwner() ? *GetOwner()->GetName() : TEXT("-"), *Name.ToString());
    OnCanonBeat.Broadcast(Name);
}

UHWHeosuabiRules::UHWHeosuabiRules()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UHWHeosuabiRules::SetupCast(AHWAinCharacter* InAin, const TMap<FName, AActor*>& InCast)
{
    Super::SetupCast(InAin, InCast);
    Ain = InAin;
    Kain = Cast<AHWAinCharacter>(InCast.FindRef(TEXT("kain")));
}

UHWHeosuabiRules::EBand UHWHeosuabiRules::Classify(float DistanceCm)
{
    if (DistanceCm < TooCloseCm) return EBand::TooClose;
    if (DistanceCm > BandOuterCm) return EBand::TooFar;
    return EBand::Band;
}

FName UHWHeosuabiRules::PatternFor(float DistanceCm)
{
    if (DistanceCm < TooCloseCm) return TEXT("Elbow");
    if (DistanceCm <= EngageCm) return TEXT("Spin");
    return NAME_None;
}

FHWBossPatternSpec UHWHeosuabiRules::Spin()
{
    // L463-L469: arms open, shoulders wind back, waist twists, feet set — then the breath. The breath is the
    // half beat at the end of the tell: posture fixed, force not out yet. L505 "부우웅": the spin unwinds.
    FHWBossPatternSpec P;
    P.Id = TEXT("Spin");   // the training clip binding keeps its body (DA_Boss_Training "Spin")
    P.TellDuration = 1.3f;
    P.StrikeDuration = 0.55f;
    P.RecoveryDuration = 0.9f;
    P.bCounterable = false;   // not a generic counter: the rebound is Kain's (InterceptBeat)
    P.bBig = true;
    for (const float At : { 0.12f, 0.29f, 0.46f })
    {
        FHWBossBeatSpec B;
        B.At = At;
        B.Damage = 2200.f;
        B.RangeCm = SpinReachCm;
        P.Beats.Add(B);
    }
    return P;
}

FHWBossPatternSpec UHWHeosuabiRules::Elbow()
{
    // L485-L489: the blade glances off inside its guard; what comes back is the elbow — two rolls on the mat.
    FHWBossPatternSpec P;
    P.Id = TEXT("Elbow");
    P.TellDuration = 0.28f;
    P.StrikeDuration = 0.3f;
    P.RecoveryDuration = 0.8f;
    P.bCounterable = false;
    P.bBig = true;   // Smash tier: knocked down
    FHWBossBeatSpec B;
    B.At = 0.1f;
    B.Damage = 3200.f;
    B.RangeCm = 200.f;
    P.Beats.Add(B);
    return P;
}

bool UHWHeosuabiRules::ChoosePattern(AHWBossCharacter& Boss, FHWBossPatternSpec& Out)
{
    if (!Ain.IsValid()) return false;
    if (bElbowAnswer)
    {
        bElbowAnswer = false;
        Out = Elbow();
        return true;
    }
    const FName Next = PatternFor(FVector::Dist2D(Boss.GetActorLocation(), Ain->GetActorLocation()));
    if (Next == TEXT("Elbow")) { Out = Elbow(); return true; }
    if (Next == TEXT("Spin")) { Out = Spin(); return true; }
    return false;
}

EHWCanonHit UHWHeosuabiRules::FilterPlayerHit(AHWBossCharacter& Boss, float& Damage, EHWAttackTier& Tier, const FVector& Source)
{
    const float Distance = FVector::Dist2D(Boss.GetActorLocation(), Source);
    switch (Classify(Distance))
    {
    case EBand::TooClose:
    {
        // "틱—" The scythe cannot turn: nothing lands, and the elbow comes back (during the breath too — L477-L489).
        Damage = 0.f;
        Beat(TEXT("deflect"));
        const EHWBossState S = Boss.GetBossState();
        if (S == EHWBossState::Idle || S == EHWBossState::Tell || S == EHWBossState::Recover)
        {
            Boss.StartCanonPattern(Elbow());
            Beat(TEXT("elbow"));
        }
        else
        {
            bElbowAnswer = true;
        }
        return EHWCanonHit::Swallow;
    }
    case EBand::TooFar:
        Damage = 0.f;
        Beat(TEXT("too_far"));
        return EHWCanonHit::Swallow;
    default:
        break;
    }

    if (Boss.GetBossState() == EHWBossState::Break)
    {
        // L551-L563: at exactly one scythe length, the outer edge takes the joint. "죽이는 게 아니다. 끊는 것이다."
        Damage = Boss.GetHealth() + 1.f;
        Tier = EHWAttackTier::Break;
        Beat(TEXT("sever"));
        return EHWCanonHit::DamageOnly;
    }
    // In the band but no opening: it cuts, it does not end it. Only the sever does.
    Damage = FMath::Min(Damage, FMath::Max(0.f, Boss.GetHealth() - 1.f));
    Tier = EHWAttackTier::Light;
    return EHWCanonHit::DamageOnly;
}

bool UHWHeosuabiRules::IsKainInPosition(const AHWBossCharacter& Boss) const
{
    if (!Kain.IsValid() || !Ain.IsValid()) return false;
    const FVector B = Boss.GetActorLocation();
    const FVector ToKain = (Kain->GetActorLocation() - B).GetSafeNormal2D();
    const FVector ToAin = (Ain->GetActorLocation() - B).GetSafeNormal2D();
    const float KainDistance = FVector::Dist2D(Kain->GetActorLocation(), B);
    // Two feet and the blade on the ground inside the spin, on Ain's side of it (L511-L513).
    return KainDistance <= SpinReachCm && FVector::DotProduct(ToKain, ToAin) > 0.5f;
}

bool UHWHeosuabiRules::InterceptBeat(AHWBossCharacter& Boss, const FHWBossBeatSpec& InBeat)
{
    if (Boss.GetCurrentPatternId() != TEXT("Spin") || !IsKainInPosition(Boss))
    {
        return false;
    }
    // L515-L529: not a wall — a trampoline. The force goes back; the posture breaks for one breath.
    if (Kain->GetCombat()) Kain->GetCombat()->RequestCounter();
    Boss.EnterSystemBreak(BreathWindowSeconds, Kain->GetActorLocation());
    Beat(TEXT("rebound"));
    return true;
}

void UHWHeosuabiRules::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    AHWBossCharacter* Boss = Cast<AHWBossCharacter>(GetOwner());
    if (!Boss || Boss->IsDead() || !Ain.IsValid()) return;

    // Far away the body walks in; the spin and the elbow are its only answers.
    if (Boss->GetBossState() == EHWBossState::Idle)
    {
        const FVector To = Ain->GetActorLocation() - Boss->GetActorLocation();
        if (To.Size2D() > EngageCm)
        {
            Boss->AddMovementInput(To.GetSafeNormal2D(), 1.f);
        }
    }
    TickKain(*Boss, DeltaTime);
}

void UHWHeosuabiRules::TickKain(AHWBossCharacter& Boss, float DeltaTime)
{
    if (!Kain.IsValid() || !Kain->GetController()) return;
    const FVector B = Boss.GetActorLocation();
    const FVector A = Ain->GetActorLocation();
    const FVector BossToAin = (A - B).GetSafeNormal2D();
    const bool bSpinComing = Boss.GetCurrentPatternId() == TEXT("Spin")
        && (Boss.GetBossState() == EHWBossState::Tell || Boss.GetBossState() == EHWBossState::Strike);

    // Side = Ain's left as she faces the boss; the camera sits over her right shoulder, so Kain keeps to her left.
    const FVector Side = FVector::CrossProduct(FVector::UpVector, BossToAin);
    if (bSpinComing && !bInterceptCalled)
    {
        Beat(TEXT("intercept"));   // L507-L509: the mountain moves in — "비켜!"
    }
    bInterceptCalled = bSpinComing;
    FVector Goal;
    if (bSpinComing)
    {
        // "비켜!" — in front of the spin, on Ain's side (L507-L513).
        Goal = B + BossToAin * 175.f;
    }
    else if (Boss.GetBossState() == EHWBossState::Break)
    {
        // The breath is Ain's: he has taken the force back; he does not stand in her line.
        Goal = B + BossToAin * 160.f + Side * 130.f;
    }
    else
    {
        // Always half a step behind her (L107), to her left.
        Goal = A + BossToAin * 60.f + Side * 90.f;
    }
    Goal.Z = Kain->GetActorLocation().Z;
    const FVector Delta = Goal - Kain->GetActorLocation();
    const float Gap = Delta.Size2D();
    if (Gap > 20.f)
    {
        Kain->AddMovementInput(Delta.GetSafeNormal2D(), FMath::Clamp(Gap / 120.f, 0.35f, 1.f));
    }
    else if (bSpinComing)
    {
        const FRotator Face = (B - Kain->GetActorLocation()).Rotation();
        Kain->SetActorRotation(FRotator(0.f, Face.Yaw, 0.f));
    }
}

void UHWHeosuabiRules::QAStep(AHWBossCharacter& Boss, AHWAinCharacter& Player, float Dt, TArray<FString>& Notes, TArray<FString>& Shots)
{
    // The fight as the novel plays it, through the real inputs (doc 138): inside the guard -> glance + elbow;
    // Kain takes the spin back; one attack from the band inside that breath severs.
    QATime += Dt;
    auto PlaceAin = [&](float DistanceCm)
    {
        const FVector Dir = (Player.GetActorLocation() - Boss.GetActorLocation()).GetSafeNormal2D();
        FVector At = Boss.GetActorLocation() + (Dir.IsNearlyZero() ? FVector(-1.f, 0.f, 0.f) : Dir) * DistanceCm;
        At.Z = Player.GetActorLocation().Z;
        Player.SetActorLocationAndRotation(At, FRotator(0.f, (Boss.GetActorLocation() - At).Rotation().Yaw, 0.f));
    };
    const EHWBossState S = Boss.GetBossState();
    switch (QAStage)
    {
    case 0:
        if (QATime >= 3.f && (S == EHWBossState::Idle || S == EHWBossState::Tell || S == EHWBossState::Recover))
        {
            PlaceAin(110.f);
            Player.GetCombat()->RequestAttack();
            Notes.Add(TEXT("canon: attack from 110 cm"));
            QAStage = 10; QATime = 0.f;
        }
        break;
    case 10:
        if (QATime >= 0.45f)
        {
            Shots.Add(TEXT("canon_1_deflect"));
            if (Boss.GetCurrentPatternId() != TEXT("Elbow")) { Notes.Add(TEXT("FAIL: attack from inside the guard did not bring the elbow")); return; }
            Notes.Add(TEXT("canon: elbow answered; stand where only the spin reaches"));
            QAStage = 1; QATime = 0.f;
        }
        break;
    case 1:
        if (QATime >= 1.2f && QATime < 1.2f + Dt + 0.001f) PlaceAin(330.f);
        if (Boss.GetCurrentPatternId() == TEXT("Spin") && S == EHWBossState::Tell && !bQASpinShot && Boss.GetBossStateNormalized() > 0.8f)
        {
            bQASpinShot = true;
            Shots.Add(TEXT("canon_2_spin_breath"));
        }
        if (S == EHWBossState::Break)
        {
            Shots.Add(TEXT("canon_3_rebound"));
            Notes.Add(TEXT("canon: rebound — one breath"));
            QAStage = 2; QATime = 0.f;
        }
        else if (QATime > 15.f) Notes.Add(TEXT("FAIL: no rebound in 15 s"));
        break;
    case 2:
        if (QATime >= 0.3f)
        {
            PlaceAin(200.f);
            Player.GetCombat()->RequestAttack();
            Notes.Add(TEXT("canon: attack from 200 cm inside the breath"));
            QAStage = 20; QATime = 0.f;
        }
        break;
    case 20:
        if (QATime > 3.f) Notes.Add(TEXT("FAIL: no sever"));
        break;
    default:
        break;
    }
}
