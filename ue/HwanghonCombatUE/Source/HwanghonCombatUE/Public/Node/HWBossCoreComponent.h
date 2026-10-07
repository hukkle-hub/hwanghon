#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Combat/HWCombatTypes.h"
#include "Node/HWNodeRules.h"
#include "HWBossCoreComponent.generated.h"

class AHWBossCharacter;
class AHWAinCharacter;
class UStaticMeshComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FHWBossCoreSignature);

// The infected human's arm core (docs/design/200 §6) on an AHWBossCharacter - no neck or chest core: the arm.
// Phase 1 is a human fight. From phase 2 the core is live and every landed counter strips CoreArmor
// (normal 8, perfect 22 of 100). At 0 the forearm armour breaks through the boss's own part system
// (UHWBossSystemComponent "limb"), the core shows and the boss goes groggy (EnterSystemBreak).
// At 10 % health with the core out the player decides: keep hitting (kill) or press Execute and hold an
// extraction that any hit interrupts - skill, never a roll (HWNodeRules::FCoreExtraction).
UCLASS(ClassGroup=(Hwanghon), meta=(BlueprintSpawnableComponent))
class HWANGHONCOMBATUE_API UHWBossCoreComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UHWBossCoreComponent();

    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    // Bone the core sits on: the first human boss's LEFT forearm. Falls back to an offset when the body has no such bone.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Core")
    FName CoreBone = TEXT("lowerarm_l");

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Core")
    int32 CoreActiveFromPhase = 2;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Core")
    float ExposedBreakSeconds = 4.f;

    UPROPERTY(BlueprintAssignable)
    FHWBossCoreSignature OnCoreExposed;

    UPROPERTY(BlueprintAssignable)
    FHWBossCoreSignature OnCoreExtracted;

    UPROPERTY(BlueprintAssignable)
    FHWBossCoreSignature OnExtractionInterrupted;

    // Execute pressed near the boss. True if the extraction started.
    UFUNCTION(BlueprintCallable)
    bool TryBeginExtraction(AHWAinCharacter* Player);

    UFUNCTION(BlueprintPure)
    float GetCoreArmorFraction() const { return Core.Fraction(); }

    UFUNCTION(BlueprintPure)
    bool IsCoreExposed() const { return Core.bExposed; }

    UFUNCTION(BlueprintPure)
    bool IsCoreLive() const;

    UFUNCTION(BlueprintPure)
    bool CanFinish() const;

    UFUNCTION(BlueprintPure)
    float GetExtractionProgress() const { return Extraction.State == HWNodeRules::EExtraction::Channeling ? Extraction.Progress() : 0.f; }

    bool WasExtracted() const { return Extraction.State == HWNodeRules::EExtraction::Extracted; }

private:
    UFUNCTION()
    void HandleCounterGraded(bool bPerfect);

    UFUNCTION()
    void HandleExtractorDamaged(float Damage, EHWAttackTier Tier);

    UFUNCTION()
    void HandlePhaseChanged(int32 NewPhase);

    void RefreshMarker();

    UPROPERTY(Transient)
    TObjectPtr<AHWBossCharacter> Boss;

    UPROPERTY(Transient)
    TObjectPtr<AHWAinCharacter> Extractor;

    UPROPERTY(Transient)
    TObjectPtr<UStaticMeshComponent> Marker;

    HWNodeRules::FCoreArmor Core;
    HWNodeRules::FCoreExtraction Extraction;
};
