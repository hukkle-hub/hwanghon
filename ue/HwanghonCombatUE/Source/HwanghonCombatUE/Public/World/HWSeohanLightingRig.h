#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Combat/HWCombatTypes.h"
#include "HWSeohanLightingRig.generated.h"

class USceneComponent;
class USkyLightComponent;
class USpotLightComponent;
class UPointLightComponent;
class AHWAinCharacter;
class AHWBossCharacter;

UCLASS()
class HWANGHONCOMBATUE_API AHWSeohanLightingRig : public AActor
{
    GENERATED_BODY()

public:
    AHWSeohanLightingRig();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

private:
    void ResolveCombatActors();

    UFUNCTION()
    void HandlePlayerContact(EHWActionType Action, EHWAttackTier Tier, float Damage);

    void TriggerContactLight(EHWAttackTier Tier);

    // a boss phase that opens with a designed move darkens the arena for good (docs/design/181 §12)
    UFUNCTION()
    void HandleBossPhaseIntro(int32 Phase);
    float DimTarget = 0.f;
    float Dim = 0.f;
    bool bBoundPhase = false;

    UPROPERTY()
    TObjectPtr<USceneComponent> SceneRoot;

    UPROPERTY()
    TObjectPtr<USkyLightComponent> FillSky;

    UPROPERTY()
    TObjectPtr<USpotLightComponent> WarmKey;

    UPROPERTY()
    TObjectPtr<USpotLightComponent> CoolRim;

    UPROPERTY()
    TObjectPtr<UPointLightComponent> RedAccent;

    UPROPERTY()
    TObjectPtr<UPointLightComponent> ContactLight;

    UPROPERTY(Transient)
    TObjectPtr<AHWAinCharacter> Player;

    UPROPERTY(Transient)
    TObjectPtr<AHWBossCharacter> Boss;

    float ContactLightRemaining = 0.f;
    float ContactLightDuration = 0.08f;
    float ContactLightPeak = 0.f;
    bool bBoundContact = false;
};
