#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "HWGraphicsQualitySubsystem.generated.h"

UENUM(BlueprintType)
enum class EHWGraphicsTier : uint8
{
    Low,
    Mid,
    High
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(
    FHWGraphicsTierChangedSignature,
    EHWGraphicsTier, NewTier);

UCLASS()
class HWANGHONCOMBATUE_API UHWGraphicsQualitySubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;

    UPROPERTY(BlueprintAssignable)
    FHWGraphicsTierChangedSignature OnTierChanged;

    UFUNCTION(BlueprintCallable)
    void ApplyTier(EHWGraphicsTier Tier, bool bSaveSettings = false);

    UFUNCTION(BlueprintPure)
    EHWGraphicsTier GetCurrentTier() const { return CurrentTier; }

    UFUNCTION(BlueprintPure)
    float GetContactLightScale() const;

private:
    void ApplyCVars(EHWGraphicsTier Tier);

    UPROPERTY(Transient)
    EHWGraphicsTier CurrentTier = EHWGraphicsTier::High;
};
