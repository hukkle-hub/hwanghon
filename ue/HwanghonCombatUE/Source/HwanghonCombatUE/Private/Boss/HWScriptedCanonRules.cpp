#include "Boss/HWScriptedCanonRules.h"

#include "Boss/HWBossCharacter.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Dom/JsonObject.h"
#include "Game/HWStoryNpc.h"
#include "EngineUtils.h"
#include "GameFramework/Character.h"

namespace
{
    float Num(const TSharedPtr<FJsonObject>& O, const TCHAR* F, float Default)
    {
        double V = Default;
        return O && O->TryGetNumberField(F, V) ? static_cast<float>(V) : Default;
    }
    FString Str(const TSharedPtr<FJsonObject>& O, const TCHAR* F, const FString& Default = FString())
    {
        FString V;
        return O && O->TryGetStringField(F, V) ? V : Default;
    }
}

UHWScriptedCanonRules::UHWScriptedCanonRules()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UHWScriptedCanonRules::Configure(const TSharedPtr<FJsonObject>& Script)
{
    if (!Script) return;
    const TArray<TSharedPtr<FJsonValue>>* Band = nullptr;
    if (Script->TryGetArrayField(TEXT("band"), Band) && Band->Num() == 2)
    {
        BandMin = (*Band)[0]->AsNumber();
        BandMax = (*Band)[1]->AsNumber();
    }
    WalkInCm = Num(Script, TEXT("walk_in_cm"), WalkInCm);
    Guard = Str(Script, TEXT("guard"), Guard);
    EndAfter = Num(Script, TEXT("end_after_s"), -1.f);

    const TArray<TSharedPtr<FJsonValue>>* List = nullptr;
    if (Script->TryGetArrayField(TEXT("patterns"), List))
    {
        for (const TSharedPtr<FJsonValue>& V : *List)
        {
            const TSharedPtr<FJsonObject> P = V->AsObject();
            FHWCanonMove& M = Moves.AddDefaulted_GetRef();
            M.Spec.Id = FName(*Str(P, TEXT("clip"), TEXT("HookCombo")));
            M.Spec.DisplayName = Str(P, TEXT("ko"));
            M.Spec.TellDuration = Num(P, TEXT("tell"), 0.9f);
            M.Spec.StrikeDuration = Num(P, TEXT("strike"), 0.4f);
            M.Spec.RecoveryDuration = Num(P, TEXT("recovery"), 0.9f);
            M.Spec.bCounterable = false;
            M.Spec.bBig = P->HasTypedField<EJson::Boolean>(TEXT("big")) && P->GetBoolField(TEXT("big"));
            M.Spec.LungeDistanceCm = Num(P, TEXT("lunge_cm"), 0.f);
            M.Spec.LungeDuration = M.Spec.LungeDistanceCm > 0.f ? Num(P, TEXT("lunge_s"), 0.3f) : 0.f;
            FHWBossBeatSpec B;
            B.At = Num(P, TEXT("hit_at"), 0.12f);
            B.Damage = Num(P, TEXT("damage"), 2500.f);
            B.RangeCm = Num(P, TEXT("range"), 260.f);
            M.Spec.Beats.Add(B);
            M.MinCm = Num(P, TEXT("min"), 0.f);
            M.MaxCm = Num(P, TEXT("max"), 99999.f);
        }
    }
    if (Script->TryGetArrayField(TEXT("steps"), List))
    {
        for (const TSharedPtr<FJsonValue>& V : *List)
        {
            const TSharedPtr<FJsonObject> S = V->AsObject();
            FHWCanonStep& St = Steps.AddDefaulted_GetRef();
            St.Id = Str(S, TEXT("id"));
            St.Callout = Str(S, TEXT("callout"));
            const TArray<TSharedPtr<FJsonValue>>* MovesJson = nullptr;
            if (S->TryGetArrayField(TEXT("moves"), MovesJson))
            {
                for (const TSharedPtr<FJsonValue>& MV : *MovesJson)
                {
                    const TSharedPtr<FJsonObject> MO = MV->AsObject();
                    const FName Who(*Str(MO, TEXT("who")));
                    St.Moves.Add({ Who, Str(MO, TEXT("to"), TEXT("behind")) });
                    St.MoveDist.Add(Who, Num(MO, TEXT("dist"), 175.f));
                }
            }
            St.OpenWhen = Str(S, TEXT("open"));
            St.OpenOn = FMath::Max(1, static_cast<int32>(Num(S, TEXT("open_on"), 1.f)));
            St.Opener = FName(*Str(S, TEXT("opener")));
            St.OpenSeconds = Num(S, TEXT("open_s"), 2.f);
            St.OpenBeat = FName(*Str(S, TEXT("open_beat")));
            St.Needs = static_cast<int32>(Num(S, TEXT("needs"), St.OpenWhen.IsEmpty() ? 0.f : 1.f));
            St.DecisiveBeat = FName(*Str(S, TEXT("decisive_beat"), TEXT("decisive")));
            St.Then = Str(S, TEXT("then"), TEXT("kill"));
            St.AdvanceAfter = Num(S, TEXT("advance_after_s"), -1.f);
            St.AdvanceBeat = FName(*Str(S, TEXT("advance_beat")));
            St.AdvanceThen = Str(S, TEXT("advance_then"), TEXT("next"));
        }
    }
    EnterStep(0);
}

void UHWScriptedCanonRules::EnterStep(int32 Index)
{
    StepIndex = Index;
    StepTime = 0.f;
    Hits = 0;
    PatternSeen = 0;
    OpenRemaining = 0.f;
    bAfterFired = false;
    if (const FHWCanonStep* S = Step())
    {
        Beat(FName(*(TEXT("step_") + S->Id)));
    }
}

FVector UHWScriptedCanonRules::GoalFor(const FString& Move, AActor* Who, const AHWBossCharacter& Boss, float Dist) const
{
    const FVector B = Boss.GetActorLocation();
    const FVector A = CastAin.IsValid() ? CastAin->GetActorLocation() : B - FVector(400.f, 0.f, 0.f);
    const FVector ToAin = (A - B).GetSafeNormal2D();
    const FVector Side = FVector::CrossProduct(FVector::UpVector, ToAin);
    if (Move == TEXT("front")) return B + ToAin * Dist;
    if (Move == TEXT("grab")) return B + ToAin * FMath::Min(Dist, 110.f) + Side * 40.f;
    if (Move == TEXT("back")) return B - ToAin * Dist;
    if (Move == TEXT("side")) return B + Side * Dist;
    if (Move == TEXT("side_r")) return B - Side * Dist;
    if (Move.StartsWith(TEXT("marker:")))
    {
        const FName Tag(*Move.Mid(7));
        for (TActorIterator<AActor> It(Boss.GetWorld()); It; ++It)
        {
            if (It->Tags.Contains(Tag)) return It->GetActorLocation();
        }
    }
    // behind: half a step behind Ain, to her left (the camera sits over her right shoulder)
    return A + ToAin * 60.f + Side * 90.f;
}

bool UHWScriptedCanonRules::OpenerInPlace(const AHWBossCharacter& Boss) const
{
    const FHWCanonStep* S = Step();
    if (!S) return false;
    if (S->Opener.IsNone()) return true;   // the place itself / the text's timing opens it
    AActor* Who = Member(S->Opener);
    if (!Who) return false;
    for (const auto& M : S->Moves)
    {
        if (M.Key == S->Opener)
        {
            const FVector Goal = GoalFor(M.Value, Who, Boss, S->MoveDist.FindRef(M.Key));
            return FVector::Dist2D(Who->GetActorLocation(), Goal) <= 90.f;
        }
    }
    return FVector::Dist2D(Who->GetActorLocation(), Boss.GetActorLocation()) <= 300.f;
}

void UHWScriptedCanonRules::Open(AHWBossCharacter& Boss, AActor* By)
{
    const FHWCanonStep* S = Step();
    if (!S) return;
    OpenRemaining = S->OpenSeconds;
    Boss.EnterSystemBreak(S->OpenSeconds, By ? By->GetActorLocation() : Boss.GetActorLocation());
    if (!S->OpenBeat.IsNone()) Beat(S->OpenBeat);
    Beat(TEXT("opened"));
}

void UHWScriptedCanonRules::Conclude(const FString& Then, AHWBossCharacter* Boss)
{
    if (Then == TEXT("next"))
    {
        EnterStep(StepIndex + 1);
        if (!Step()) Conclude(TEXT("end"), Boss);
        return;
    }
    if (bConcluded) return;
    bConcluded = true;
    if (Then == TEXT("kill") && Boss && !Boss->IsDead())
    {
        TGuardValue<bool> Forcing(bForcingKill, true);
        Boss->ReceivePlayerHit(Boss->GetHealth() + 1.f, EHWAttackTier::Break, Boss->GetActorLocation());
        return;
    }
    Beat(TEXT("battle_end"));   // a retreat, a containment, a phase the novel moves on from
}

void UHWScriptedCanonRules::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    AHWBossCharacter* Boss = Cast<AHWBossCharacter>(GetOwner());
    if (!Boss || Boss->IsDead() || bConcluded || !bLive) return;
    Elapsed += DeltaTime;
    StepTime += DeltaTime;

    // A loss battle ends where the text ends it.
    if (EndAfter > 0.f && Elapsed >= EndAfter)
    {
        Beat(TEXT("end_by_text"));
        Conclude(TEXT("end"), Boss);
        return;
    }

    // Far away the body walks in.
    if (CastAin.IsValid() && Boss->GetBossState() == EHWBossState::Idle
        && FVector::Dist2D(CastAin->GetActorLocation(), Boss->GetActorLocation()) > WalkInCm)
    {
        Boss->AddMovementInput((CastAin->GetActorLocation() - Boss->GetActorLocation()).GetSafeNormal2D(), 1.f);
    }

    const FHWCanonStep* S = Step();
    if (!S) return;

    // Companions and NPCs go where the step puts them.
    for (const auto& M : S->Moves)
    {
        if (AActor* Who = Member(M.Key))
        {
            const FVector Goal = GoalFor(M.Value, Who, *Boss, S->MoveDist.FindRef(M.Key));
            Steer(Who, Goal, 25.f);
            if (FVector::Dist2D(Who->GetActorLocation(), Goal) <= 40.f && M.Value != TEXT("behind")) Face(Who, Boss->GetActorLocation());
        }
    }

    if (OpenRemaining > 0.f)
    {
        OpenRemaining -= DeltaTime;
        if (OpenRemaining <= 0.f)
        {
            Beat(TEXT("closed"));
            // A missed moment comes round again: a timed opening re-arms from now.
            if (S->OpenWhen.StartsWith(TEXT("after:")) && S->AdvanceAfter < 0.f)
            {
                bAfterFired = false;
                StepTime = 0.f;
            }
        }
    }
    else if (S->OpenWhen == TEXT("ready") && OpenerInPlace(*Boss) && StepTime > 1.f)
    {
        Open(*Boss, Member(S->Opener));
    }
    else if (S->OpenWhen.StartsWith(TEXT("after:")) && !bAfterFired && StepTime >= FCString::Atof(*S->OpenWhen.Mid(6)))
    {
        bAfterFired = true;   // once per step visit
        Open(*Boss, Member(S->Opener));
    }

    if (S->AdvanceAfter >= 0.f && StepTime >= S->AdvanceAfter)
    {
        if (!S->AdvanceBeat.IsNone()) Beat(S->AdvanceBeat);
        Conclude(S->AdvanceThen, Boss);
    }
}

bool UHWScriptedCanonRules::ChoosePattern(AHWBossCharacter& Boss, FHWBossPatternSpec& Out)
{
    if (!CastAin.IsValid() || Moves.IsEmpty() || !bLive) return false;
    const float D = FVector::Dist2D(Boss.GetActorLocation(), CastAin->GetActorLocation());
    TArray<const FHWCanonMove*> Fit;
    for (const FHWCanonMove& M : Moves)
    {
        if (D >= M.MinCm && D <= M.MaxCm) Fit.Add(&M);
    }
    if (Fit.IsEmpty()) return false;
    Out = Fit[FMath::RandRange(0, Fit.Num() - 1)]->Spec;
    return true;
}

bool UHWScriptedCanonRules::InterceptBeat(AHWBossCharacter& Boss, const FHWBossBeatSpec& InBeat)
{
    const FHWCanonStep* S = Step();
    if (!S || !S->OpenWhen.StartsWith(TEXT("pattern:")) || OpenRemaining > 0.f) return false;
    const FString Want = S->OpenWhen.Mid(8);
    const FHWBossPatternSpec& Cur = Boss.GetCurrentPattern();
    if (Cur.DisplayName != Want && Cur.Id.ToString() != Want) return false;
    if (!OpenerInPlace(Boss)) return false;
    // Counted per move (one beat per move in a script): the earlier ones land as written.
    if (++PatternSeen < S->OpenOn)
    {
        Beat(TEXT("observed"));
        return false;
    }
    // The opener takes the blow (Kain's rebound, an anvil, a seal) — the move does not land; the boss is held.
    if (AHWAinCharacter* Hero = Cast<AHWAinCharacter>(Member(S->Opener)))
    {
        if (Hero->GetCombat()) Hero->GetCombat()->RequestCounter();
    }
    Open(Boss, Member(S->Opener));
    return true;
}

EHWCanonHit UHWScriptedCanonRules::FilterPlayerHit(AHWBossCharacter& Boss, float& Damage, EHWAttackTier& Tier, const FVector& Source)
{
    if (bForcingKill) return EHWCanonHit::Normal;
    const float D = FVector::Dist2D(Boss.GetActorLocation(), Source);
    if (D < BandMin)
    {
        Damage = 0.f;
        Beat(TEXT("too_close"));   // the scythe cannot turn (EP01 L477-L493)
        return EHWCanonHit::Swallow;
    }
    if (D > BandMax)
    {
        Damage = 0.f;
        Beat(TEXT("too_far"));
        return EHWCanonHit::Swallow;
    }
    const FHWCanonStep* S = Step();
    if (S && OpenRemaining > 0.f && S->Needs > 0)
    {
        ++Hits;
        Beat(TEXT("opening_hit"));
        if (Hits >= S->Needs)
        {
            Beat(S->DecisiveBeat);
            const FString Then = S->Then;
            if (Then == TEXT("kill"))
            {
                bConcluded = true;
                Damage = Boss.GetHealth() + 1.f;
                Tier = EHWAttackTier::Break;
                return EHWCanonHit::DamageOnly;
            }
            Damage = 0.f;
            Conclude(Then, &Boss);
            return EHWCanonHit::Swallow;
        }
        Damage = 0.f;
        return EHWCanonHit::Swallow;
    }
    if (Guard == TEXT("cut"))
    {
        // It cuts, it does not end anything.
        Damage = FMath::Min(Damage, FMath::Max(0.f, Boss.GetHealth() - 1.f));
        Tier = EHWAttackTier::Light;
        return EHWCanonHit::DamageOnly;
    }
    Damage = 0.f;
    Beat(TEXT("guarded"));
    return EHWCanonHit::Swallow;
}

void UHWScriptedCanonRules::QAStep(AHWBossCharacter& Boss, AHWAinCharacter& Player, float Dt, TArray<FString>& Notes, TArray<FString>& Shots)
{
    // Plays the fight the way the novel does: wait for each opening, then one scythe length and the cut.
    QATime += Dt;
    auto PlaceAin = [&](float DistanceCm)
    {
        const FVector Dir = (Player.GetActorLocation() - Boss.GetActorLocation()).GetSafeNormal2D();
        FVector At = Boss.GetActorLocation() + (Dir.IsNearlyZero() ? FVector(-1.f, 0.f, 0.f) : Dir) * DistanceCm;
        At.Z = Player.GetActorLocation().Z;
        Player.SetActorLocationAndRotation(At, FRotator(0.f, (Boss.GetActorLocation() - At).Rotation().Yaw, 0.f));
    };
    if (StepIndex != QAStepSeen)
    {
        QAStepSeen = StepIndex;
        QATime = 0.f;
        QALastAttack = -1.f;
        if (const FHWCanonStep* S = Step())
        {
            Notes.Add(FString::Printf(TEXT("canon step %d/%d: %s"), StepIndex + 1, Steps.Num(), *S->Id));
            Shots.Add(FString::Printf(TEXT("step_%02d_%s"), StepIndex + 1, *S->Id));
        }
    }
    const FHWCanonStep* S = Step();
    if (!S) return;
    // Once: a cut outside any opening must not end the fight.
    if (QAPhase == 0 && QATime > 2.f && OpenRemaining <= 0.f)
    {
        QAPhase = 1;
        PlaceAin(195.f);
        Player.GetCombat()->RequestAttack();
        Notes.Add(TEXT("canon: a cut outside the opening (must not end it)"));
    }
    if (OpenRemaining > 0.f && S->Needs > 0 && QATime - QALastAttack > 0.7f)
    {
        QALastAttack = QATime;
        PlaceAin((BandMin + BandMax) * 0.5f);
        Player.GetCombat()->RequestAttack();
        Notes.Add(FString::Printf(TEXT("canon: opening — cut from %.0f cm (%d/%d)"), (BandMin + BandMax) * 0.5f, Hits + 1, S->Needs));
        Shots.Add(FString::Printf(TEXT("open_%02d_%s_%d"), StepIndex + 1, *S->Id, Hits));
    }
    // Where the opener is, every 10 s of a step that waits for one (a companion that cannot reach its spot stalls it).
    if (!S->Opener.IsNone() && FMath::FloorToInt(QATime / 10.f) != FMath::FloorToInt((QATime - Dt) / 10.f))
    {
        AActor* Who = Member(S->Opener);
        FString Where = TEXT("missing");
        if (Who)
        {
            for (const auto& M : S->Moves)
            {
                if (M.Key != S->Opener) continue;
                const FVector Goal = GoalFor(M.Value, Who, Boss, S->MoveDist.FindRef(M.Key));
                Where = FString::Printf(TEXT("%.0f cm from its spot (%s), boss %.0f cm, Ain %.0f cm from boss"),
                    FVector::Dist2D(Who->GetActorLocation(), Goal), *M.Value,
                    FVector::Dist2D(Who->GetActorLocation(), Boss.GetActorLocation()),
                    FVector::Dist2D(Player.GetActorLocation(), Boss.GetActorLocation()));
            }
        }
        Notes.Add(FString::Printf(TEXT("canon: opener %s %s"), *S->Opener.ToString(), *Where));
    }
    const float Limit = S->AdvanceAfter >= 0.f ? S->AdvanceAfter + 10.f : 40.f;
    if (QATime > Limit && !bConcluded)
    {
        Notes.Add(FString::Printf(TEXT("FAIL: step %s did not move on in %.0f s"), *S->Id, Limit));
    }
}
