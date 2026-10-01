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


struct FHWPendingAbilityHit;

/** A skill hit's moment came (docs/design/171): Landed is the actor it struck, null when it swung at nothing. */
DECLARE_MULTICAST_DELEGATE_ThreeParams(FHWKitHitResolved, const FHWPendingAbilityHit& /*Hit*/, AActor* /*Landed*/, EHWAbilitySlot /*Slot*/);

struct FHWPendingAbilityHit
{
    float AtSeconds = 0.f;
    float DamageMultiplier = 1.f;
    EHWAttackTier Tier = EHWAttackTier::Finisher;
    bool bAoe = false;
    float PartDamageMultiplier = 1.f;
    float ExtraPosture = 0.f;
    EHWAbilitySlot Slot = EHWAbilitySlot::Skill1;
    bool bLast = false;   // the slot's final hit: the effect layer closes the weapon trail on it
    bool bFresh = false;  // queued by the activation being tagged
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

    /** Skill hits as they resolve, landed or not - the effect layer (UHWHeroFxComponent) draws on them. */
    FHWKitHitResolved OnAbilityHitResolved;

    // The web's skill clock (doc 169): seconds of the first contact of a slot for a hero, -1 when it has none.
    struct FAbilityClock { float Hit; float Dur; float ClipHit = 0.5f; };
    static FAbilityClock AbilityClock(FName Char, EHWAbilitySlot Slot);
    static float AbilityTimeOf(float Fraction, const FAbilityClock& Clock);
    static float FirstContactSeconds(FName Char, EHWAbilitySlot Slot);

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

    /** QA (-HWQA=skillfx): every slot ready - cooldowns cleared, ultimate gauge full. */
    void QAReady();

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

private:
    float SkillReachCm(bool bAoe) const;
    bool InReach(AActor* Target, const struct FHWPendingAbilityHit& Hit) const;
    void LandHitStop(AActor* Target, const struct FHWPendingAbilityHit& Hit);
};
