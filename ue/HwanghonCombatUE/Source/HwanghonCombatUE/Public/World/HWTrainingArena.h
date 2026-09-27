#pragma once

#include "CoreMinimal.h"
#include "World/HWGrayboxArena.h"
#include "HWTrainingArena.generated.h"

class UDirectionalLightComponent;
class UMaterialInterface;
class UStaticMeshComponent;

UCLASS()
class HWANGHONCOMBATUE_API AHWTrainingArena : public AHWGrayboxArena
{
    GENERATED_BODY()

public:
    AHWTrainingArena();
    virtual void BeginPlay() override;

private:
    UPROPERTY()
    TObjectPtr<UDirectionalLightComponent> PrototypeLight;

    UPROPERTY()
    TArray<TObjectPtr<UStaticMeshComponent>> FloorMarkings;

    UPROPERTY(EditDefaultsOnly, Category="Training Prototype")
    TSoftObjectPtr<UMaterialInterface> PrototypeMaterial;
};
