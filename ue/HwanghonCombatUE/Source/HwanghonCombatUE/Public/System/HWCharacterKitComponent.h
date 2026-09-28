#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Combat/HWCombatTypes.h"
#include "System/HWSystemTypes.h"
#include "HWCharacterKitComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(
    FHWKitGaugeChangedSignature,
    FName, CharacterId,
    float, UniqueGauge,
    float, UltimateGauge);

DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(
    FHWKitAbilitySignature,
    FName, CharacterId,
    EHWAbilitySlot, Slot,
    float, Multiplier);


struct FHWPendingAbilityHit
{
    float AtSeconds = 0.f;
    float DamageMultiplier = 1.f;
    EHWAttackTier Tier = EHWAttackTier::Finisher;
    bool bAoe = false;
    float PartDamageMultiplier = 1.f;
    float ExtraPosture = 0.f;
};

UCLASS(ClassGroup=(Hwanghon), meta=(BlueprintSpawnableComponent))
class HWANGHONCOMBATUE_API UHWCharacterKitComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UHWCharacterKitComponent();

    // Activate(EHWAbilitySlot) below is an ability, not component activation; keep the base overload visible.
    using UActorComponent::Activate;

    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UPROPERTY(BlueprintAssignable)
    FHWKitGaugeChangedSignature OnGaugeChanged;

    UPROPERTY(BlueprintAssignable)
    FHWKitAbilitySignature OnAbilityActivated;

    UFUNCTION(BlueprintCallable)
    void ConfigureCharacter(FName InCharacterId);

    UFUNCTION(BlueprintPure)
    FName GetCharacterId() const { return CharacterId; }

    UFUNCTION(BlueprintPure)
    float GetUniqueGauge() const { return UniqueGauge; }

    UFUNCTION(BlueprintPure)
    float GetUltimateGauge() const { return UltimateGauge; }

    UFUNCTION(BlueprintPure)
    float GetSkill1Cooldown() const { return Skill1CooldownRemaining; }

    UFUNCTION(BlueprintPure)
    float GetSkill2Cooldown() const { return Skill2CooldownRemaining; }

    UFUNCTION(BlueprintPure)
    float GetSkill3Cooldown() const { return Skill3CooldownRemaining; }

    UFUNCTION(BlueprintPure)
    float GetSkill4Cooldown() const { return Skill4CooldownRemaining; }

    UFUNCTION(BlueprintPure)
    float GetUltimateCooldown() const { return UltimateCooldownRemaining; }

    UFUNCTION(BlueprintCallable)
    bool RequestSkill1();

    UFUNCTION(BlueprintCallable)
    bool RequestSkill2();

    UFUNCTION(BlueprintCallable)
    bool RequestSkill3();

    UFUNCTION(BlueprintCallable)
    bool RequestSkill4();

    UFUNCTION(BlueprintCallable)
    bool RequestUltimate();

private:
    UFUNCTION()
    void HandleContact(EHWActionType Action, EHWAttackTier Tier, float Damage);

    bool Activate(EHWAbilitySlot Slot);
    void QueueAbilityHits(
        EHWAbilitySlot Slot,
        const FHWCharacterSystemProfile& Profile,
        float AbilityMultiplier,
        EHWAttackTier DefaultTier);
    void QueueHit(
        float SourceAtSeconds,
        float DamageMultiplier,
        EHWAttackTier Tier,
        bool bAoe = false,
        float PartDamageMultiplier = 1.f,
        float ExtraPosture = 0.f);
    void TickPendingHits(float DeltaTime);
    void ResolvePendingHit(const FHWPendingAbilityHit& Hit);
    bool ApplyHitToTarget(AActor* Target, const FHWPendingAbilityHit& Hit);
    void GrantCombatGauge(EHWAttackTier Tier);
    float ResolveBaseDamage() const;
    void BroadcastGauge();

    UPROPERTY(EditAnywhere, Category="Hwanghon|Kit")
    FName CharacterId = TEXT("ain");

    UPROPERTY(Transient)
    TObjectPtr<class AHWAinCharacter> OwnerCharacter;

    UPROPERTY(Transient)
    TObjectPtr<class UHWCombatComponent> Combat;

    float UniqueGauge = 0.f;
    float UltimateGauge = 0.f;
    float Skill1CooldownRemaining = 0.f;
    float Skill2CooldownRemaining = 0.f;
    float Skill3CooldownRemaining = 0.f;
    float Skill4CooldownRemaining = 0.f;
    float UltimateCooldownRemaining = 0.f;
    float PendingAbilityElapsed = 0.f;
    TArray<FHWPendingAbilityHit> PendingHits;
};
