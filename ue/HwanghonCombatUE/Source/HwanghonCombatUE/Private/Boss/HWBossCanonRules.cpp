#include "Boss/HWBossCanonRules.h"

#include "Boss/HWBossCharacter.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "GameFramework/CharacterMovementComponent.h"

void UHWBossCanonRules::Beat(FName Name)
{
    UE_LOG(LogTemp, Display, TEXT("[HWCanon] %s %s"), GetOwner() ? *GetOwner()->GetName() : TEXT("-"), *Name.ToString());
    OnCanonBeat.Broadcast(Name);
}

UHWHeosuabiRules::UHWHeosuabiRules()
{
    PrimaryComponentTick.bCanEverTick = true;
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
