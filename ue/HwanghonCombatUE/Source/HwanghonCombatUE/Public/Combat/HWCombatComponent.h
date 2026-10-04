#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Combat/HWCombatTypes.h"
#include "HWCombatComponent.generated.h"

class UHWCombatTuningAsset;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWActionStartedSignature, EHWActionType, Action);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWActionEndedSignature, EHWActionType, Action);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FHWContactSignature, EHWActionType, Action, EHWAttackTier, Tier, float, Damage);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHWDamagedSignature, float, Damage, EHWAttackTier, Tier);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FHWPlayerDiedSignature);

UCLASS(ClassGroup=(Hwanghon), meta=(BlueprintSpawnableComponent))
class HWANGHONCOMBATUE_API UHWCombatComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UHWCombatComponent();

    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Combat")
    TObjectPtr<UHWCombatTuningAsset> Tuning;

    UPROPERTY(BlueprintAssignable)
    FHWActionStartedSignature OnActionStarted;

    UPROPERTY(BlueprintAssignable)
    FHWActionEndedSignature OnActionEnded;

    UPROPERTY(BlueprintAssignable)
    FHWContactSignature OnContact;

    UPROPERTY(BlueprintAssignable)
    FHWDamagedSignature OnDamaged;

    // Health and all pending combat work are already terminal when this fires.
    UPROPERTY(BlueprintAssignable)
    FHWPlayerDiedSignature OnDied;

    UFUNCTION(BlueprintCallable)
    bool RequestAttack();

    UFUNCTION(BlueprintCallable)
    bool RequestSmash();

    UFUNCTION(BlueprintCallable)
    bool RequestDodge();

    UFUNCTION(BlueprintCallable)
    bool RequestJump();

    UFUNCTION(BlueprintCallable)
    bool RequestCounter();

    UFUNCTION(BlueprintCallable)
    bool ApplyIncomingDamage(float Damage, EHWAttackTier Tier);

    UFUNCTION(BlueprintCallable)
    void ApplyHitStop(float Seconds);

    UFUNCTION(BlueprintCallable)
    void Heal(float Amount);

    UFUNCTION(BlueprintCallable)
    bool Revive(float HealthFraction = 0.30f);

    UFUNCTION(BlueprintCallable)
    void ApplyAuthoritativeVitals(float NewHealth, float NewMaxHealth, float NewStamina, bool bIncapacitated);

    UFUNCTION(BlueprintCallable)
    void ApplyDamageReduction(float Fraction, float Duration);

    UFUNCTION(BlueprintCallable)
    bool TrySpendStamina(float Cost);

    UFUNCTION(BlueprintCallable)
    bool RequestSystemDodge(float StaminaCost);

    UFUNCTION(BlueprintCallable)
    void ConfigureCharacterStats(
        float NewMaxHealth,
        float NewBaseAttack,
        float NewDefense,
        float NewCritChancePercent,
        float NewCritDamagePercent,
        float NewAttackSpeedPercent);

    UFUNCTION(BlueprintCallable)
    void ArmGuaranteedCritical() { bGuaranteedCritical = true; }

    // No DEF cut, crit or attack-speed clock; HP and tuning damage stay. Lifecycle tests measure raw
    // tuning numbers (Health + 100 is lethal, contact at HitAt); the sheet has its own identity test.
    void UseNeutralCharacterModifiers()
    {
        Defense = 0.f;
        CritChance = 0.f;
        CritDamageMultiplier = 1.f;
        AttackSpeedMultiplier = 1.f;
        bGuaranteedCritical = false;
    }

    UFUNCTION(BlueprintCallable)
    float ResolveOutgoingDamage(float BaseDamage);

    UFUNCTION(BlueprintPure)
    float GetBaseAttack() const { return BaseAttack; }

    UFUNCTION(BlueprintPure)
    float GetDefense() const { return Defense; }

    UFUNCTION(BlueprintPure)
    float GetAttackSpeedMultiplier() const { return AttackSpeedMultiplier; }

    UFUNCTION(BlueprintPure)
    bool IsInvulnerable() const;

    UFUNCTION(BlueprintPure)
    bool IsJumping() const;

    UFUNCTION(BlueprintPure)
    bool IsCounterActive() const;

    // The boss parried into this counter (AHWBossCharacter::TryCountered): RequestCounter may chain the next one.
    void NotifyCounterLanded() { bCounterLanded = true; }

    UFUNCTION(BlueprintPure)
    EHWActionType GetCurrentAction() const { return CurrentAction; }

    UFUNCTION(BlueprintPure)
    float GetActionElapsed() const { return ActionElapsed; }

    UFUNCTION(BlueprintPure)
    float GetActionNormalized() const;

    UFUNCTION(BlueprintPure)
    float GetHealth() const { return Health; }

    UFUNCTION(BlueprintPure)
    bool IsDead() const { return bDead; }

    UFUNCTION(BlueprintPure)
    float GetStamina() const { return Stamina; }

    UFUNCTION(BlueprintPure)
    float GetMaxHealth() const;

private:
    friend struct FHWPlayerDeathTestAccess;

    void CommitDeath();
    bool StartAction(EHWActionType Action);
    void FinishAction();
    bool RequestDefensiveAction(EHWActionType Action);
    void InterruptInto(EHWActionType Action);
    void TickStamina(float DeltaTime);
    EHWActionType NextComboAction() const;
    bool IsAttackAction(EHWActionType Action) const;

    UPROPERTY(Transient)
    EHWActionType CurrentAction = EHWActionType::None;

    UPROPERTY(Transient)
    EHWActionType QueuedAction = EHWActionType::None;

    float ActionElapsed = 0.f;
    bool bCounterLanded = false;
    bool bContactFired = false;
    float HitStopRemaining = 0.f;
    float DodgeCooldownRemaining = 0.f;
    float JumpCooldownRemaining = 0.f;
    float Health = 1.f;
    float Stamina = 0.f;
    float StaminaRegenBlocked = 0.f;
    float DamageReductionRemaining = 0.f;
    float DamageReductionFraction = 0.f;
    // Neutral until the character kit applies its sheet (ConfigureCharacterStats): tests, bots and
    // unconfigured pawns keep the tuning numbers exactly (no DEF cut, no random crit).
    float BaseAttack = 0.f;
    float Defense = 0.f;
    float CritChance = 0.f;
    float CritDamageMultiplier = 1.f;
    float AttackSpeedMultiplier = 1.f;
    bool bGuaranteedCritical = false;
    bool bDead = false;
};
