#pragma once

#include "CoreMinimal.h"
#include "Character/HWAinCharacter.h"
#include "Boss/HWBossCharacter.h"
#include "HWTrainingCharacters.generated.h"

class UMaterialInterface;
class UMaterialInstanceDynamic;
class UStaticMeshComponent;

// Visible native stand-ins while the authored skeletal models are not integrated.
// Their shapes have no collision; all movement, damage and timing remain in the base classes.
UCLASS()
class HWANGHONCOMBATUE_API AHWTrainingAinCharacter : public AHWAinCharacter
{
    GENERATED_BODY()

public:
    AHWTrainingAinCharacter();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

private:
    UPROPERTY()
    TObjectPtr<USceneComponent> VisualRoot;

    UPROPERTY()
    TObjectPtr<USceneComponent> WeaponPivot;

    UPROPERTY()
    TArray<TObjectPtr<UStaticMeshComponent>> BodyParts;

    UPROPERTY()
    TObjectPtr<UStaticMeshComponent> Blade;

    UPROPERTY()
    TObjectPtr<UMaterialInstanceDynamic> BodyMaterial;

    UPROPERTY(EditDefaultsOnly, Category="Training Prototype")
    TSoftObjectPtr<UMaterialInterface> PrototypeMaterial;
};

UCLASS()
class HWANGHONCOMBATUE_API AHWTrainingBossCharacter : public AHWBossCharacter
{
    GENERATED_BODY()

public:
    AHWTrainingBossCharacter();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

private:
    UPROPERTY()
    TObjectPtr<USceneComponent> VisualRoot;

    UPROPERTY()
    TObjectPtr<USceneComponent> WeaponPivot;

    UPROPERTY()
    TArray<TObjectPtr<UStaticMeshComponent>> BodyParts;

    UPROPERTY()
    TObjectPtr<UStaticMeshComponent> Blade;

    UPROPERTY()
    TObjectPtr<UMaterialInstanceDynamic> BodyMaterial;

    UPROPERTY(EditDefaultsOnly, Category="Training Prototype")
    TSoftObjectPtr<UMaterialInterface> PrototypeMaterial;
};
