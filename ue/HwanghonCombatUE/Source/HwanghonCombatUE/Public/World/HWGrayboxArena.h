#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HWGrayboxArena.generated.h"

class UStaticMeshComponent;

UCLASS()
class HWANGHONCOMBATUE_API AHWGrayboxArena : public AActor
{
    GENERATED_BODY()

public:
    AHWGrayboxArena();

private:
    UPROPERTY()
    TObjectPtr<USceneComponent> SceneRoot;

    UPROPERTY()
    TObjectPtr<UStaticMeshComponent> Floor;

    UPROPERTY()
    TArray<TObjectPtr<UStaticMeshComponent>> Walls;

};
