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

    UFUNCTION(BlueprintPure)
    bool IsInvulnerable() const;

    UFUNCTION(BlueprintPure)
    bool IsJumping() const;

    UFUNCTION(BlueprintPure)
    bool IsCounterActive() const;

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
    bool bContactFired = false;
    float HitStopRemaining = 0.f;
    float DodgeCooldownRemaining = 0.f;
    float JumpCooldownRemaining = 0.f;
    float Health = 1.f;
    float Stamina = 0.f;
    float StaminaRegenBlocked = 0.f;
    bool bDead = false;
};
