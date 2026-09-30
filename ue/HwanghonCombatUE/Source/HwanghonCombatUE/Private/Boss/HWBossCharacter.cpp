#include "Boss/HWBossCharacter.h"
#include "Animation/HWCharacterVisualSettings.h"
#include "Animation/HWAnimationSetAsset.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Character/HWAinCharacter.h"
#include "Animation/HWBossPresentationComponent.h"
#include "Combat/HWCombatComponent.h"
#include "Combat/HWCombatTuningAsset.h"
#include "System/HWCoopCombatSubsystem.h"
#include "System/HWBossSystemComponent.h"
#include "Boss/HWBossCanonRules.h"

#include "Animation/AnimInstance.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/GameplayStatics.h"

AHWBossCharacter::AHWBossCharacter()
{
    PrimaryActorTick.bCanEverTick = true;

    GetCapsuleComponent()->InitCapsuleSize(60.f, 115.f);
    GetCapsuleComponent()->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);
    GetMesh()->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);
    GetCharacterMovement()->MaxWalkSpeed = 260.f;
    GetCharacterMovement()->bOrientRotationToMovement = false;

    Tags.Add(TEXT("LockOnTarget"));
    Presentation = CreateDefaultSubobject<UHWBossPresentationComponent>(TEXT("Presentation"));
    BossSystem = CreateDefaultSubobject<UHWBossSystemComponent>(TEXT("BossSystem"));
}

void AHWBossCharacter::BeginPlay()
{
    // Spawned from code (dungeon director, online raid): wear the configured stand-in body.
    if (GetMesh() && !GetMesh()->GetSkeletalMeshAsset())
    {
        UHWAnimationSetAsset* Set = UHWCharacterVisualSettings::ApplyTo(TEXT("boss"), GetMesh(), GetCapsuleComponent()->GetUnscaledCapsuleHalfHeight());
        if (Set && Presentation && !Presentation->AnimationSet)
        {
            Presentation->AnimationSet = Set;
        }
    }
    Super::BeginPlay();

    RuntimeTuning = NewObject<UHWCombatTuningAsset>(this, TEXT("BossRuntimeTuning"));
    TargetPlayer = Cast<AHWAinCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0));
    if (BossSystem) BossSystem->InitializeBoss(Health);

    if (IsDead())
    {
        return;
    }

    State = EHWBossState::Idle;
    OnBossStateChanged.Broadcast(State, NAME_None);
    BP_OnBossStateChanged(State, NAME_None);
}

void AHWBossCharacter::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (IsDead())
    {
        return;
    }

    if (bNetworkAuthoritative)
    {
        StateElapsed += DeltaSeconds;   // presentation clock only; the server owns the state
        return;
    }

    if (bIntroHold)
    {
        // «어둠 속에서 실루엣이 나왔다» (EP02): the approach beats walk it in; nothing else runs while held
        if (IntroChoreo.bApproach && IntroBeat < EHHBossIntroBeat::SignatureMotion)
        {
            const APawn* P = UGameplayStatics::GetPlayerPawn(this, 0);
            if (P && FVector::Dist2D(P->GetActorLocation(), GetActorLocation()) > 450.f)   // never walks into her face
            {
                AddMovementInput((P->GetActorLocation() - GetActorLocation()).GetSafeNormal2D(), IntroChoreo.ApproachInput);
            }
        }
        return;
    }

    if (UHWCoopCombatSubsystem* Coop =
        GetWorld() ? GetWorld()->GetSubsystem<UHWCoopCombatSubsystem>() : nullptr)
    {
        AHWAinCharacter* ThreatTarget = Coop->SelectHighestThreatTarget();
        if (!ThreatTarget)
        {
            ThreatTarget = Coop->SelectClosestLivingTarget(GetActorLocation());
        }
        if (ThreatTarget)
        {
            TargetPlayer = ThreatTarget;
        }
    }

    if (!TargetPlayer || !TargetPlayer->GetCombat() || TargetPlayer->GetCombat()->IsDead())
    {
        TargetPlayer = Cast<AHWAinCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0));
        if (!TargetPlayer || !TargetPlayer->GetCombat() || TargetPlayer->GetCombat()->IsDead())
        {
            return;
        }
    }

    if (HitStopRemaining > 0.f)
    {
        HitStopRemaining = FMath::Max(0.f, HitStopRemaining - DeltaSeconds);
        return;
    }

    const FVector FlatToPlayer = FVector(
        TargetPlayer->GetActorLocation().X - GetActorLocation().X,
        TargetPlayer->GetActorLocation().Y - GetActorLocation().Y,
        0.f);

    if (!FlatToPlayer.IsNearlyZero())
    {
        const FRotator Desired = FlatToPlayer.Rotation();
        SetActorRotation(FMath::RInterpTo(GetActorRotation(), Desired, DeltaSeconds, State == EHWBossState::Strike ? 4.f : 8.f));
    }

    TickLunge(DeltaSeconds);

    const float SystemSpeed =
        BossSystem && (State == EHWBossState::Tell
            || State == EHWBossState::Strike
            || State == EHWBossState::Recover)
        ? BossSystem->GetPatternSpeedScale()
        : 1.f;
    StateElapsed += DeltaSeconds * SystemSpeed;

    switch (State)
    {
        case EHWBossState::Idle:
            IdleElapsed += DeltaSeconds;
            if (IdleElapsed >= 0.65f)
            {
                ChooseNextPattern();
            }
            break;

        case EHWBossState::Tell:
            if (StateElapsed >= CurrentPattern.TellDuration)
            {
                BeginStrike();
            }
            break;

        case EHWBossState::Strike:
            while (State == EHWBossState::Strike
                && NextBeatIndex < CurrentPattern.Beats.Num()
                && StateElapsed >= CurrentPattern.Beats[NextBeatIndex].At)
            {
                // Consume before dispatch: a beat can synchronously counter or kill us.
                const int32 BeatIndex = NextBeatIndex++;
                ResolveBeat(BeatIndex);
            }

            if (State == EHWBossState::Strike && StateElapsed >= CurrentPattern.StrikeDuration)
            {
                BeginRecover();
            }
            break;

        case EHWBossState::Recover:
            if (StateElapsed >= CurrentPattern.RecoveryDuration)
            {
                FinishRecover();
            }
            break;

        case EHWBossState::Stagger:
            if (StateElapsed >= 0.85f)
            {
                FinishRecover();
            }
            break;

        case EHWBossState::Break:
            if (StateElapsed >= SystemBreakDuration)
            {
                FinishRecover();
            }
            break;

        default:
            break;
    }
}

void AHWBossCharacter::ReceivePlayerHit(float Damage, EHWAttackTier Tier, FVector SourceLocation)
{
    if (IsDead() || bNetworkAuthoritative || bIntroHold)
    {
        return;
    }

    // A boss that follows its novel judges the hit first (docs/design/138): distance, openings, what ends it.
    EHWCanonHit Canon = EHWCanonHit::Normal;
    if (UHWBossCanonRules* Rules = FindComponentByClass<UHWBossCanonRules>())
    {
        Canon = Rules->FilterPlayerHit(*this, Damage, Tier, SourceLocation);
        if (Canon == EHWCanonHit::Swallow || IsDead())
        {
            return;
        }
    }

    Health = FMath::Max(0.f, Health - FMath::Max(0.f, Damage));
    if (Health <= 0.f)
    {
        Die();
        return;
    }

    if (BossSystem && Canon == EHWCanonHit::Normal)
    {
        BossSystem->NotifyHit(Damage, Tier, SourceLocation);
        if (State == EHWBossState::Break && Tier != EHWAttackTier::Break)
        {
            return;
        }
    }

    FVector ReactionDirection = GetActorLocation() - SourceLocation;
    ReactionDirection.Z = 0.f;
    ReactionDirection.Normalize();

    LastReactionTier = Tier;
    LastReactionWorldTime = GetWorld()->GetTimeSeconds();
    OnBossReaction.Broadcast(Tier, ReactionDirection);
    if (IsDead())
    {
        return;
    }

    BP_OnBossReaction(Tier, ReactionDirection);
    if (IsDead())
    {
        return;
    }

    if (Tier == EHWAttackTier::Break)
    {
        CancelPendingAttack();
        State = EHWBossState::Break;
        StateElapsed = 0.f;
        OnBossStateChanged.Broadcast(State, CurrentPattern.Id);
        BP_OnBossStateChanged(State, CurrentPattern.Id);
    }
    else if (Tier == EHWAttackTier::Stagger || Tier == EHWAttackTier::Counter)
    {
        CancelPendingAttack();
        State = EHWBossState::Stagger;
        StateElapsed = 0.f;
        OnBossStateChanged.Broadcast(State, CurrentPattern.Id);
        BP_OnBossStateChanged(State, CurrentPattern.Id);
    }
}

void AHWBossCharacter::CancelPendingAttack()
{
    NextBeatIndex = CurrentPattern.Beats.Num();
    LungeRemaining = 0.f;
    LungeDirection = FVector::ZeroVector;
}

void AHWBossCharacter::Die()
{
    if (IsDead())
    {
        return;
    }

    // Commit the terminal state before invoking any external callbacks.
    State = EHWBossState::Dead;
    Health = 0.f;
    StateElapsed = 0.f;
    IdleElapsed = 0.f;
    HitStopRemaining = 0.f;
    CancelPendingAttack();
    TargetPlayer = nullptr;
    Tags.Remove(TEXT("LockOnTarget"));

    GetCharacterMovement()->StopMovementImmediately();
    GetCharacterMovement()->ClearAccumulatedForces();
    GetCharacterMovement()->DisableMovement();
    SetActorEnableCollision(false);

    if (UAnimInstance* AnimInstance = GetMesh()->GetAnimInstance())
    {
        AnimInstance->StopAllMontages(0.f);
    }

    OnBossStateChanged.Broadcast(State, CurrentPattern.Id);
    BP_OnBossStateChanged(State, CurrentPattern.Id);
    OnBossDied.Broadcast(this);
}

void AHWBossCharacter::BeginPattern(const FHWBossPatternSpec& Pattern)
{
    if (IsDead())
    {
        return;
    }

    CurrentPattern = Pattern;
    State = EHWBossState::Tell;
    StateElapsed = 0.f;
    NextBeatIndex = 0;
    IdleElapsed = 0.f;
    LungeRemaining = 0.f;

    OnBossStateChanged.Broadcast(State, CurrentPattern.Id);
        BP_OnBossStateChanged(State, CurrentPattern.Id);
}

void AHWBossCharacter::BeginStrike()
{
    if (IsDead())
    {
        return;
    }

    State = EHWBossState::Strike;
    StateElapsed = 0.f;
    NextBeatIndex = 0;

    if (TargetPlayer && CurrentPattern.LungeDistanceCm > 0.f && CurrentPattern.LungeDuration > 0.f)
    {
        LungeRemaining = CurrentPattern.LungeDuration;
        LungeDirection = (TargetPlayer->GetActorLocation() - GetActorLocation()).GetSafeNormal2D();
    }

    OnBossStateChanged.Broadcast(State, CurrentPattern.Id);
        BP_OnBossStateChanged(State, CurrentPattern.Id);
}

void AHWBossCharacter::BeginRecover()
{
    if (IsDead())
    {
        return;
    }

    State = EHWBossState::Recover;
    StateElapsed = 0.f;
    LungeRemaining = 0.f;
    OnBossStateChanged.Broadcast(State, CurrentPattern.Id);
        BP_OnBossStateChanged(State, CurrentPattern.Id);
}

void AHWBossCharacter::FinishRecover()
{
    if (IsDead())
    {
        return;
    }

    State = EHWBossState::Idle;
    StateElapsed = 0.f;
    IdleElapsed = 0.f;
    CurrentPattern = FHWBossPatternSpec();
    OnBossStateChanged.Broadcast(State, NAME_None);
    BP_OnBossStateChanged(State, NAME_None);
}

void AHWBossCharacter::ResolveBeat(int32 BeatIndex)
{
    if (State != EHWBossState::Strike || !TargetPlayer || !CurrentPattern.Beats.IsValidIndex(BeatIndex))
    {
        return;
    }

    // A Blueprint beat callback may interrupt this attack and invalidate its storage.
    const FHWBossBeatSpec Beat = CurrentPattern.Beats[BeatIndex];
    BP_OnBossBeat(CurrentPattern.Id, BeatIndex);

    if (State != EHWBossState::Strike || !TargetPlayer || TryCountered(Beat))
    {
        return;
    }
    if (UHWBossCanonRules* Rules = FindComponentByClass<UHWBossCanonRules>())
    {
        if (Rules->InterceptBeat(*this, Beat) || State != EHWBossState::Strike)
        {
            return;
        }
    }

    UHWCombatComponent* PlayerCombat = TargetPlayer->GetCombat();
    if (!PlayerCombat)
    {
        return;
    }

    if (CurrentPattern.bJumpOnly && PlayerCombat->IsJumping())
    {
        return;
    }

    const float Distance = FVector::Dist2D(GetActorLocation(), TargetPlayer->GetActorLocation());
    if (Distance > Beat.RangeCm)
    {
        return;
    }

    PlayerCombat->ApplyIncomingDamage(Beat.Damage * (BossSystem ? BossSystem->GetOutgoingDamageScale() : 1.f), CurrentPattern.bBig ? EHWAttackTier::Smash : EHWAttackTier::Light);
}

void AHWBossCharacter::ChooseNextPattern()
{
    if (UHWBossCanonRules* Rules = IsDead() ? nullptr : FindComponentByClass<UHWBossCanonRules>())
    {
        FHWBossPatternSpec Pattern;
        if (Rules->ChoosePattern(*this, Pattern))
        {
            BeginPattern(Pattern);
        }
        return;
    }
    if (IsDead() || !TargetPlayer || !RuntimeTuning || RuntimeTuning->BossPatterns.IsEmpty())
    {
        return;
    }

    const float Distance = FVector::Dist2D(GetActorLocation(), TargetPlayer->GetActorLocation());

    TArray<int32> Candidates;
    for (int32 Index = 0; Index < RuntimeTuning->BossPatterns.Num(); ++Index)
    {
        const FHWBossPatternSpec& Pattern = RuntimeTuning->BossPatterns[Index];
        const int32 SystemPhase = BossSystem ? BossSystem->GetPhase() : 1;

        if (SystemPhase == 1 && Pattern.Id == "GroundWave")
        {
            continue;
        }

        if (Pattern.Id == "Charge" && Distance < 500.f)
        {
            continue;
        }

        if ((Pattern.Id == "HookCombo" || Pattern.Id == "Spin") && Distance > 500.f)
        {
            continue;
        }

        Candidates.Add(Index);
    }

    if (Candidates.IsEmpty())
    {
        Candidates.Add(0);
    }

    const int32 Choice = Candidates[FMath::RandRange(0, Candidates.Num() - 1)];
    BeginPattern(RuntimeTuning->BossPatterns[Choice]);
}

void AHWBossCharacter::TickLunge(float DeltaSeconds)
{
    if (State != EHWBossState::Strike || LungeRemaining <= 0.f || CurrentPattern.LungeDuration <= 0.f)
    {
        return;
    }

    const float Step = CurrentPattern.LungeDistanceCm / CurrentPattern.LungeDuration * FMath::Min(DeltaSeconds, LungeRemaining);
    AddActorWorldOffset(LungeDirection * Step, true);
    LungeRemaining = FMath::Max(0.f, LungeRemaining - DeltaSeconds);
}

bool AHWBossCharacter::TryCountered(const FHWBossBeatSpec& Beat)
{
    if (State != EHWBossState::Strike || !Beat.bCounterable || !CurrentPattern.bCounterable || !TargetPlayer)
    {
        return false;
    }

    UHWCombatComponent* PlayerCombat = TargetPlayer->GetCombat();
    if (!PlayerCombat || !PlayerCombat->IsCounterActive())
    {
        return false;
    }

    ReceivePlayerHit(0.f, EHWAttackTier::Counter, TargetPlayer->GetActorLocation());
    constexpr float CounterHitStop = 0.21f;
    ApplyHitStop(CounterHitStop);
    PlayerCombat->ApplyHitStop(CounterHitStop);
    return true;
}


float AHWBossCharacter::GetPresentationStatePhase() const
{
    // Online the server 'attack' has no progress (0); the body still has to swing through its contact.
    if (bNetworkAuthoritative && State == EHWBossState::Strike)
    {
        return FMath::Clamp(StateElapsed / FMath::Max(0.001f, GetPresentedPattern().StrikeDuration), 0.f, 1.f);
    }
    return GetBossStateNormalized();
}

float AHWBossCharacter::GetBossStateNormalized() const
{
    if (bNetworkAuthoritative)
    {
        return FMath::Clamp(AuthoritativeStateProgress, 0.f, 1.f);
    }

    float Duration = 1.f;

    switch (State)
    {
        case EHWBossState::Tell:
            Duration = CurrentPattern.TellDuration;
            break;
        case EHWBossState::Strike:
            Duration = CurrentPattern.StrikeDuration;
            break;
        case EHWBossState::Recover:
            Duration = CurrentPattern.RecoveryDuration;
            break;
        case EHWBossState::Stagger:
            Duration = 0.85f;
            break;
        case EHWBossState::Break:
            Duration = 1.45f;
            break;
        default:
            return 0.f;
    }

    return FMath::Clamp(StateElapsed / FMath::Max(0.001f, Duration), 0.f, 1.f);
}


float AHWBossCharacter::GetLastReactionAgeSeconds() const
{
    return FMath::Max(0.f, GetWorld() ? GetWorld()->GetTimeSeconds() - LastReactionWorldTime : 0.f);
}


void AHWBossCharacter::ApplyHitStop(float Seconds)
{
    if (IsDead())
    {
        return;
    }

    HitStopRemaining = FMath::Max(HitStopRemaining, Seconds);
}


bool AHWBossCharacter::ReceiveSystemHit_Implementation(
    float Damage,
    EHWAttackTier Tier,
    FVector SourceLocation,
    AActor* InstigatorActor)
{
    if (IsDead() || bIntroHold) return false;
    ReceivePlayerHit(Damage, Tier, SourceLocation);
    return true;
}

void AHWBossCharacter::ConfigureSystemHealth(float NewMaxHealth)
{
    if (IsDead()) return;
    Health = FMath::Max(1.f, NewMaxHealth);
    AuthoritativeMaxHealth = Health;   // local encounters scale the boss too; the HUD reads GetMaxHealth

}

void AHWBossCharacter::EnterSystemBreak(float Duration, FVector SourceLocation)
{
    if (IsDead()) return;

    CancelPendingAttack();
    State = EHWBossState::Break;
    StateElapsed = 0.f;
    SystemBreakDuration = FMath::Max(0.5f, Duration);

    FVector ReactionDirection = GetActorLocation() - SourceLocation;
    ReactionDirection.Z = 0.f;
    ReactionDirection.Normalize();

    LastReactionTier = EHWAttackTier::Break;
    LastReactionWorldTime = GetWorld()->GetTimeSeconds();

    OnBossReaction.Broadcast(EHWAttackTier::Break, ReactionDirection);
    BP_OnBossReaction(EHWAttackTier::Break, ReactionDirection);
    OnBossStateChanged.Broadcast(State, CurrentPattern.Id);
    BP_OnBossStateChanged(State, CurrentPattern.Id);
}


void AHWBossCharacter::SetNetworkAuthoritative(bool bEnabled)
{
    bNetworkAuthoritative=bEnabled;
    if (BossSystem) BossSystem->SetComponentTickEnabled(!bEnabled);
}

void AHWBossCharacter::ApplyAuthoritativeMotion(FName PatternIcon, float TellSeconds, float RecoverySeconds)
{
    if (PatternIcon.IsNone()) return;
    if (NetworkMotion.Id != PatternIcon || (State == EHWBossState::Tell && TellSeconds > 0.f))
    {
        NetworkMotion.Id = PatternIcon;
        NetworkMotion.TellDuration = TellSeconds > 0.f ? TellSeconds : NetworkMotion.TellDuration;
        NetworkMotion.StrikeDuration = 0.25f;   // server 'attack' is the contact itself
        NetworkMotion.RecoveryDuration = RecoverySeconds > 0.f ? RecoverySeconds : 0.7f;
        NetworkMotion.Beats.SetNum(1);
        NetworkMotion.Beats[0].At = 0.f;
    }
    else if (State == EHWBossState::Recover && RecoverySeconds > 0.f)
    {
        NetworkMotion.RecoveryDuration = RecoverySeconds;
    }
}

void AHWBossCharacter::ApplyAuthoritativeSnapshot(
    float NewHealth,
    float NewMaxHealth,
    float NewPosture,
    FName StateName,
    FName PatternId,
    bool bPatternCounterable,
    float StateProgress,
    bool bRaidClear)
{
    bNetworkAuthoritative = true;
    Health = FMath::Max(0.f, NewHealth);
    AuthoritativeMaxHealth = FMath::Max(1.f, NewMaxHealth);
    AuthoritativePosture = FMath::Max(0.f, NewPosture);
    AuthoritativeStateProgress = FMath::Clamp(StateProgress, 0.f, 1.f);
    bAuthoritativePatternCounterable = bPatternCounterable;
    const FName PreviousPattern = CurrentPattern.Id;
    CurrentPattern.Id = PatternId;
    CurrentPattern.bCounterable = bPatternCounterable;
    EHWBossState NewState=State;
    if (bRaidClear || Health<=0.f) NewState=EHWBossState::Dead;
    else if (StateName==TEXT("idle")) NewState=EHWBossState::Idle;
    else if (StateName==TEXT("telegraph")) NewState=EHWBossState::Tell;
    else if (StateName==TEXT("attack") || StateName==TEXT("link")) NewState=EHWBossState::Strike;
    else if (StateName==TEXT("recover")) NewState=EHWBossState::Recover;
    else if (StateName==TEXT("stagger")) NewState=EHWBossState::Stagger;
    else if (StateName==TEXT("downed")) NewState=EHWBossState::Break;
    if (NewState != State || PreviousPattern != PatternId)
    {
        State=NewState;StateElapsed=0.f;
        OnBossStateChanged.Broadcast(State,CurrentPattern.Id);
        BP_OnBossStateChanged(State,CurrentPattern.Id);
    }
    if (State==EHWBossState::Dead)
    {
        Tags.Remove(TEXT("LockOnTarget"));
        SetActorEnableCollision(false);
    }
}

void AHWBossCharacter::WearBody(FName VisualId)
{
    UHWAnimationSetAsset* Set = UHWCharacterVisualSettings::ApplyTo(VisualId, GetMesh(), GetCapsuleComponent()->GetUnscaledCapsuleHalfHeight());
    if (Set && Presentation)
    {
        Presentation->AnimationSet = Set;
    }
    const float Scale = GetActorScale3D().Z;
    if (GetMesh() && Scale > KINDA_SMALL_NUMBER)
    {
        GetMesh()->SetRelativeScale3D(GetMesh()->GetRelativeScale3D() / Scale);
    }
}

void AHWBossCharacter::WearStaticBody(UStaticMesh* Body)
{
    if (!Body) return;
    UStaticMeshComponent* Rigid = NewObject<UStaticMeshComponent>(this, TEXT("StaticBody"));
    Rigid->SetStaticMesh(Body);
    Rigid->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Rigid->SetupAttachment(GetCapsuleComponent());
    Rigid->RegisterComponent();
    const float Scale = FMath::Max(KINDA_SMALL_NUMBER, GetActorScale3D().Z);
    Rigid->SetRelativeLocationAndRotation(FVector(0.f, 0.f, -GetCapsuleComponent()->GetUnscaledCapsuleHalfHeight()), FRotator(0.f, -90.f, 0.f));
    Rigid->SetRelativeScale3D(FVector(1.f / Scale));
    if (GetMesh()) GetMesh()->SetVisibility(false, true);   // the stand-in skeleton keeps the clock, not the look
}

// ------------------------------------------------------------------ boss intro (docs/design/162)

AHWBossCharacter::FIntroChoreo AHWBossCharacter::IntroChoreoFor(FName BossId)
{
    FIntroChoreo C;
    const FString Id = BossId.ToString();
    if (Id == TEXT("TUTORIAL_SCARECROW"))
    {
        // EP01 L9-L15 «이 년 동안 그 자리에 묶여 있던 것» - a target that does not move, then «허수아비가 몸을 세웠다»:
        // the stance its spin comes from (the fight's own first answer)
        C.bStillUntilSignature = true;
        C.SignaturePattern = TEXT("Spin");
    }
    else if (Id == TEXT("CLAVE_GANGNAM"))
    {
        // EP02 «어둠 속에서 실루엣이 나왔다 ... 걸을 때마다 셔터 아래쪽이 바닥을 긁었다 ... 그리고 놈이 멈췄다»:
        // walks in, stops, and sets the shutter as it does before «셔터 밀어내기» (the Charge pattern)
        C.bApproach = true;
        C.SignaturePattern = TEXT("Charge");
    }
    // Bosses 02-12 (docs/design/163): the wind-up of each fight's first pattern in story_episodes.json. The static bodies
    // (Celestial, Aegis-07, Leviathan, Arsenal, the tower) hide the stand-in skeleton, so for them the shots carry it.
    else if (Id == TEXT("CELESTIAL_NAMSAN"))
    {
        C.SignaturePattern = TEXT("Charge");       // 난간 급강하 (EP04 L4406)
    }
    else if (Id == TEXT("AEGIS07_SDC"))
    {
        C.bStillUntilSignature = true;             // «놈이 정지했다. 그리고 아무것도 안 했다» (EP06 L6241)
        C.SignaturePattern = TEXT("Slam");         // 포문 개방 (L6309)
    }
    else if (Id == TEXT("LEVIATHAN_HANRIVER"))
    {
        C.SignaturePattern = TEXT("Charge");       // 측면 돌진 (EP08 L7458)
    }
    else if (Id == TEXT("EXPERIMENT09_PANGYO"))
    {
        C.bStillUntilSignature = true;             // a grey mass until «그것이 몸을 세웠다» (EP14 L9820)
        C.SignaturePattern = TEXT("HookCombo");    // 휘감기: «가슴에서부터 양옆으로 몸통이 갈라졌고» (L9985)
    }
    else if (Id == TEXT("SHADOWFANG_GWANAK"))
    {
        C.bStillUntilSignature = true;             // in the bush shade; «예비 동작이 그늘에 녹아» (EP16 L10707)
        C.SignaturePattern = TEXT("Charge");       // 무음 돌진
    }
    else if (Id == TEXT("ARSENAL_GYERYONG"))
    {
        C.SignaturePattern = TEXT("GroundWave");   // 사출 (EP21 L12669) - a turret, it does not walk
    }
    else if (Id == TEXT("PARK_GYERYONG"))
    {
        C.bStillUntilSignature = true;             // «문을 등진 채 부동자세로» (EP22 L13247)
        C.SignaturePattern = TEXT("HookCombo");    // 카운터: «팔을 세워 기다리고 있었다» (EP23 L13326)
    }
    else if (Id == TEXT("MINISTERJEONG_GOHEUNG"))
    {
        C.bApproach = true;                        // «열린 길의 저편에서, 무언가가 걸어오고 있었다» (EP25 L14222)
        C.ApproachInput = 0.22f;                   // «서두르지 않는, 지휘하는 자 특유의 속도» (L14226): at 0.5 he came 3.4 m
        C.SignaturePattern = TEXT("Spin");         // 군도 원 (EP26 L14285-L14342)
    }
    else if (Id == TEXT("NANONOVA_GOHEUNG"))
    {
        C.bStillUntilSignature = true;             // a mountain until «산이, 눈을 떴다» (EP27 L14544)
        C.SignaturePattern = TEXT("Charge");       // 셔터 팔: «첫 번째 팔이 셔터를 방패처럼 세웠다» (L14730)
    }
    // AMPLIFIER_TOWER_GOHEUNG: no attack in the novel (EP28 L15010 «벨 곳이 없었다») - no choreography.
    return C;
}

void AHWBossCharacter::SetIntroHold(bool bHold)
{
    bIntroHold = bHold;
    if (bHold)
    {
        CancelPendingAttack();
        State = EHWBossState::Idle;
        StateElapsed = 0.f;
        IdleElapsed = 0.f;
        if (BossSystem) BossSystem->SetComponentTickEnabled(false);   // the enrage clock starts with the fight
    }
    else
    {
        if (BossSystem) BossSystem->SetComponentTickEnabled(true);
        if (Presentation) Presentation->ClearIntroPose();
        GetCharacterMovement()->StopMovementImmediately();
    }
}

void AHWBossCharacter::HH_BossIntroBegin_Implementation(FName BossId)
{
    IntroChoreo = IntroChoreoFor(BossId);
    IntroBeat = EHHBossIntroBeat::PlayerEntry;
    if (HasAuthority()) SetIntroHold(true);
    if (Presentation && IntroChoreo.bStillUntilSignature) Presentation->SetIntroStill();
}

void AHWBossCharacter::HH_BossIntroBeat_Implementation(FName BossId, EHHBossIntroBeat Beat)
{
    IntroBeat = Beat;
    if (!Presentation) return;
    if (Beat == EHHBossIntroBeat::SignatureMotion)
    {
        GetCharacterMovement()->StopMovementImmediately();
        if (!IntroChoreo.SignaturePattern.IsNone())
        {
            Presentation->SetIntroWindup(IntroChoreo.SignaturePattern, HHBossIntroProfiles::Resolve(BossId).SignatureHold);
        }
    }
    else if (Beat == EHHBossIntroBeat::Handback)
    {
        Presentation->ClearIntroPose();   // back to its idle: the first ready stance under the player camera
    }
}

void AHWBossCharacter::HH_BossIntroEnd_Implementation(FName BossId)
{
    if (Presentation) Presentation->ClearIntroPose();
    GetCharacterMovement()->StopMovementImmediately();
    // the hold itself is let go by whoever starts the fight (AHWStoryDirector), on the server
}
