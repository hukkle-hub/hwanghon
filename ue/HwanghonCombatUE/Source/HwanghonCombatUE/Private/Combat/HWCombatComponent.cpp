#include "Combat/HWCombatComponent.h"
#include "Combat/HWCombatTuningAsset.h"

UHWCombatComponent::UHWCombatComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UHWCombatComponent::BeginPlay()
{
    Super::BeginPlay();

    if (!Tuning)
    {
        Tuning = NewObject<UHWCombatTuningAsset>(this, TEXT("RuntimeCombatTuning"));
    }

    Health = Tuning->MaxHealth;
    Stamina = Tuning->MaxStamina;
}

void UHWCombatComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    TickStamina(DeltaTime);
    DodgeCooldownRemaining = FMath::Max(0.f, DodgeCooldownRemaining - DeltaTime);
    JumpCooldownRemaining = FMath::Max(0.f, JumpCooldownRemaining - DeltaTime);

    if (HitStopRemaining > 0.f)
    {
        HitStopRemaining = FMath::Max(0.f, HitStopRemaining - DeltaTime);
        return;
    }

    if (CurrentAction == EHWActionType::None)
    {
        return;
    }

    const FHWActionSpec& Spec = Tuning->GetActionSpec(CurrentAction);
    const EHWActionType ActionAtFrameStart = CurrentAction;

    ActionElapsed += DeltaTime;

    // Defensive actions can interrupt earlier than combo chaining.
    if (IsAttackAction(CurrentAction)
        && (QueuedAction == EHWActionType::Dodge || QueuedAction == EHWActionType::Jump)
        && ActionElapsed >= Spec.DefenseCancelAt)
    {
        const EHWActionType Defensive = QueuedAction;
        QueuedAction = EHWActionType::None;
        InterruptInto(Defensive);
        return;
    }

    if (!bContactFired && Spec.HitAt >= 0.f && ActionElapsed >= Spec.HitAt)
    {
        bContactFired = true;
        OnContact.Broadcast(CurrentAction, Spec.Tier, Spec.Damage);
    }

    if (CurrentAction == ActionAtFrameStart && ActionElapsed >= Spec.Duration)
    {
        FinishAction();
    }
}

bool UHWCombatComponent::RequestAttack()
{
    if (CurrentAction == EHWActionType::None)
    {
        return StartAction(EHWActionType::Attack1);
    }

    if (IsAttackAction(CurrentAction))
    {
        QueuedAction = NextComboAction();
        return QueuedAction != EHWActionType::None;
    }

    return false;
}

bool UHWCombatComponent::RequestSmash()
{
    if (CurrentAction != EHWActionType::None)
    {
        return false;
    }

    return StartAction(EHWActionType::Smash);
}

bool UHWCombatComponent::RequestDodge()
{
    if (DodgeCooldownRemaining > 0.f)
    {
        return false;
    }

    return RequestDefensiveAction(EHWActionType::Dodge);
}

bool UHWCombatComponent::RequestJump()
{
    if (JumpCooldownRemaining > 0.f || IsJumping())
    {
        return false;
    }

    return RequestDefensiveAction(EHWActionType::Jump);
}

bool UHWCombatComponent::RequestCounter()
{
    if (CurrentAction != EHWActionType::None)
    {
        return false;
    }

    return StartAction(EHWActionType::Counter);
}

bool UHWCombatComponent::ApplyIncomingDamage(float Damage, EHWAttackTier Tier)
{
    if (IsInvulnerable())
    {
        return false;
    }

    Health = FMath::Max(0.f, Health - FMath::Max(0.f, Damage));
    OnDamaged.Broadcast(Damage, Tier);

    // Graybox reaction. Later animation work can keep light reactions additive.
    if (Tier == EHWAttackTier::Break || Tier == EHWAttackTier::Stagger)
    {
        CurrentAction = EHWActionType::Stagger;
        ActionElapsed = 0.f;
        bContactFired = true;
        OnActionStarted.Broadcast(CurrentAction);
    }
    else if (CurrentAction == EHWActionType::None)
    {
        CurrentAction = EHWActionType::Hit;
        ActionElapsed = 0.f;
        bContactFired = true;
        OnActionStarted.Broadcast(CurrentAction);
    }

    return true;
}

void UHWCombatComponent::ApplyHitStop(float Seconds)
{
    HitStopRemaining = FMath::Max(HitStopRemaining, Seconds);
}

bool UHWCombatComponent::IsInvulnerable() const
{
    return CurrentAction == EHWActionType::Dodge && ActionElapsed <= Tuning->DodgeIFrames;
}

bool UHWCombatComponent::IsJumping() const
{
    return CurrentAction == EHWActionType::Jump && ActionElapsed <= Tuning->JumpDuration;
}

bool UHWCombatComponent::IsCounterActive() const
{
    return CurrentAction == EHWActionType::Counter && ActionElapsed <= Tuning->CounterWindow;
}

float UHWCombatComponent::GetActionNormalized() const
{
    if (CurrentAction == EHWActionType::None || !Tuning)
    {
        return 0.f;
    }

    const float Duration = FMath::Max(0.001f, Tuning->GetActionSpec(CurrentAction).Duration);
    return FMath::Clamp(ActionElapsed / Duration, 0.f, 1.f);
}

float UHWCombatComponent::GetMaxHealth() const
{
    return Tuning ? Tuning->MaxHealth : 0.f;
}

bool UHWCombatComponent::StartAction(EHWActionType Action)
{
    if (!Tuning)
    {
        return false;
    }

    const FHWActionSpec& Spec = Tuning->GetActionSpec(Action);
    if (Spec.StaminaCost > Stamina)
    {
        return false;
    }

    Stamina -= Spec.StaminaCost;

    if (Action == EHWActionType::Dodge)
    {
        DodgeCooldownRemaining = Tuning->DodgeCooldown;
    }
    else if (Action == EHWActionType::Jump)
    {
        JumpCooldownRemaining = Tuning->JumpCooldown;
    }

    if (Spec.StaminaCost > 0.f)
    {
        StaminaRegenBlocked = Tuning->StaminaRegenDelay;
    }

    CurrentAction = Action;
    ActionElapsed = 0.f;
    bContactFired = false;
    OnActionStarted.Broadcast(Action);
    return true;
}


bool UHWCombatComponent::RequestDefensiveAction(EHWActionType Action)
{
    if (CurrentAction == EHWActionType::None)
    {
        return StartAction(Action);
    }

    if (!IsAttackAction(CurrentAction))
    {
        return false;
    }

    const FHWActionSpec& CurrentSpec = Tuning->GetActionSpec(CurrentAction);
    if (ActionElapsed >= CurrentSpec.DefenseCancelAt)
    {
        InterruptInto(Action);
        return true;
    }

    // Same buffering idea as the existing Hwanghon combat.js:
    // keep the defensive input if it was pressed shortly before defCancelAt.
    constexpr float BufferWindow = 0.16f;
    if (CurrentSpec.DefenseCancelAt - ActionElapsed <= BufferWindow)
    {
        QueuedAction = Action;
        return true;
    }

    return false;
}

void UHWCombatComponent::InterruptInto(EHWActionType Action)
{
    if (CurrentAction != EHWActionType::None)
    {
        const EHWActionType Interrupted = CurrentAction;
        CurrentAction = EHWActionType::None;
        ActionElapsed = 0.f;
        bContactFired = false;
        OnActionEnded.Broadcast(Interrupted);
    }

    QueuedAction = EHWActionType::None;
    StartAction(Action);
}

void UHWCombatComponent::FinishAction()
{
    const EHWActionType Finished = CurrentAction;
    CurrentAction = EHWActionType::None;
    ActionElapsed = 0.f;
    bContactFired = false;
    OnActionEnded.Broadcast(Finished);

    // Core quality contract: direct combo handoff, no intermediate idle action.
    const EHWActionType Next = QueuedAction;
    QueuedAction = EHWActionType::None;
    if (Next != EHWActionType::None)
    {
        StartAction(Next);
    }
}

void UHWCombatComponent::TickStamina(float DeltaTime)
{
    if (!Tuning)
    {
        return;
    }

    if (StaminaRegenBlocked > 0.f)
    {
        StaminaRegenBlocked = FMath::Max(0.f, StaminaRegenBlocked - DeltaTime);
        return;
    }

    Stamina = FMath::Min(Tuning->MaxStamina, Stamina + Tuning->StaminaRegenPerSecond * DeltaTime);
}

EHWActionType UHWCombatComponent::NextComboAction() const
{
    switch (CurrentAction)
    {
        case EHWActionType::Attack1: return EHWActionType::Attack2;
        case EHWActionType::Attack2: return EHWActionType::Attack3;
        case EHWActionType::Attack3: return EHWActionType::Attack1;
        default: return EHWActionType::None;
    }
}

bool UHWCombatComponent::IsAttackAction(EHWActionType Action) const
{
    return Action == EHWActionType::Attack1
        || Action == EHWActionType::Attack2
        || Action == EHWActionType::Attack3;
}
