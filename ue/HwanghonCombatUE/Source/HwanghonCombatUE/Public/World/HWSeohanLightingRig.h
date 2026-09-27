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
