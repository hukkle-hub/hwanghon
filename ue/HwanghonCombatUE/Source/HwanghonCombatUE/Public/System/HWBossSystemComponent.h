#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Combat/HWCombatTypes.h"
#include "System/HWSystemTypes.h"
#include "HWBossSystemComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWBossPhaseSignature, int32, Phase);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHWBossBreakSignature, float, BreakDuration, int32, BreakCount);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWBossPartBrokenSignature, FName, PartId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FHWBossEnragedSignature);

UCLASS(ClassGroup=(Hwanghon), meta=(BlueprintSpawnableComponent))
class HWANGHONCOMBATUE_API UHWBossSystemComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UHWBossSystemComponent();

    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UPROPERTY(BlueprintAssignable)
    FHWBossPhaseSignature OnPhaseChanged;

    UPROPERTY(BlueprintAssignable)
    FHWBossBreakSignature OnBreakTriggered;

    UPROPERTY(BlueprintAssignable)
    FHWBossPartBrokenSignature OnPartBroken;

    UPROPERTY(BlueprintAssignable)
    FHWBossEnragedSignature OnEnraged;

    UFUNCTION(BlueprintCallable)
    void InitializeBoss(float BaseMaxHealth);

    UFUNCTION(BlueprintCallable)
    void NotifyHit(float Damage, EHWAttackTier Tier, FVector SourceLocation);

    UFUNCTION(BlueprintCallable)
    bool DamagePart(FName PartId, float Damage);

    UFUNCTION(BlueprintPure)
    int32 GetPhase() const { return Phase; }

    UFUNCTION(BlueprintPure)
    float GetPosture() const { return Posture; }

    UFUNCTION(BlueprintPure)
    float GetMaxPosture() const { return MaxPosture; }

    UFUNCTION(BlueprintPure)
    bool IsEnraged() const { return bEnraged; }

    UFUNCTION(BlueprintPure)
    float GetOutgoingDamageScale() const;

    UFUNCTION(BlueprintPure)
    float GetPatternSpeedScale() const;

    UFUNCTION(BlueprintPure)
    TArray<FHWBossPartRuntime> GetParts() const;

    UFUNCTION(BlueprintPure)
    int32 GetBreakCount() const { return BreakCount; }

private:
    UFUNCTION()
    void HandleBossDied(class AHWBossCharacter* DeadBoss);

    void UpdatePhase();
    void AddPosture(float Amount, FVector SourceLocation);
    void TriggerBreak(FVector SourceLocation);
    FHWBossPartRuntime* FindPart(FName PartId);
    float TierPosture(EHWAttackTier Tier) const;

    UPROPERTY(Transient)
    TObjectPtr<class AHWBossCharacter> Boss;

    int32 Phase = 1;
    int32 BreakCount = 0;
    float InitialMaxHealth = 1.f;
    float MaxPosture = 100.f;
    float Posture = 0.f;
    float CombatElapsed = 0.f;
    float EnrageSeconds = 180.f;
    float BreakDuration = 4.f;
    float DifficultyDamageScale = 1.f;
    bool bEnraged = false;
    bool bInitialized = false;
    TArray<FHWBossPartRuntime> Parts;

    UPROPERTY(Transient)
    TArray<TObjectPtr<class AHWBossPartTarget>> PartTargets;
};
