#include "Boss/HWBossCharacter.h"
#include "Character/HWAinCharacter.h"
#include "Animation/HWBossPresentationComponent.h"
#include "Combat/HWCombatComponent.h"
#include "Combat/HWCombatTuningAsset.h"

#include "Animation/AnimInstance.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/GameplayStatics.h"

AHWBossCharacter::AHWBossCharacter()
{
    PrimaryActorTick.bCanEverTick = true;

    GetCapsuleComponent()->InitCapsuleSize(60.f, 115.f);
    GetCharacterMovement()->MaxWalkSpeed = 260.f;
    GetCharacterMovement()->bOrientRotationToMovement = false;

    Tags.Add(TEXT("LockOnTarget"));
    Presentation = CreateDefaultSubobject<UHWBossPresentationComponent>(TEXT("Presentation"));
}

void AHWBossCharacter::BeginPlay()
{
    Super::BeginPlay();

    RuntimeTuning = NewObject<UHWCombatTuningAsset>(this, TEXT("BossRuntimeTuning"));
    TargetPlayer = Cast<AHWAinCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0));

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

    if (!TargetPlayer)
    {
        TargetPlayer = Cast<AHWAinCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0));
        return;
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

    StateElapsed += DeltaSeconds;

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
            if (StateElapsed >= 1.45f)
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
    if (IsDead())
    {
        return;
    }

    Health = FMath::Max(0.f, Health - FMath::Max(0.f, Damage));
    if (Health <= 0.f)
    {
        Die();
        return;
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

    PlayerCombat->ApplyIncomingDamage(Beat.Damage, CurrentPattern.bBig ? EHWAttackTier::Smash : EHWAttackTier::Light);
}

void AHWBossCharacter::ChooseNextPattern()
{
    if (IsDead() || !TargetPlayer || !RuntimeTuning || RuntimeTuning->BossPatterns.IsEmpty())
    {
        return;
    }

    const float Distance = FVector::Dist2D(GetActorLocation(), TargetPlayer->GetActorLocation());

    TArray<int32> Candidates;
    for (int32 Index = 0; Index < RuntimeTuning->BossPatterns.Num(); ++Index)
    {
        const FHWBossPatternSpec& Pattern = RuntimeTuning->BossPatterns[Index];

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


float AHWBossCharacter::GetBossStateNormalized() const
{
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
