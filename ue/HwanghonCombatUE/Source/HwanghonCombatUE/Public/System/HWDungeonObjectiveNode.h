#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HWDungeonObjectiveNode.generated.h"

class UBoxComponent;
class UStaticMeshComponent;

UCLASS()
class HWANGHONCOMBATUE_API AHWDungeonObjectiveNode : public AActor
{
    GENERATED_BODY()

public:
    AHWDungeonObjectiveNode();

protected:
    virtual void BeginPlay() override;

private:
    UFUNCTION()
    void HandleOverlap(
        UPrimitiveComponent* OverlappedComponent,
        AActor* OtherActor,
        UPrimitiveComponent* OtherComp,
        int32 OtherBodyIndex,
        bool bFromSweep,
        const FHitResult& SweepResult);

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UBoxComponent> Trigger;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UStaticMeshComponent> Visual;

    bool bConsumed = false;
};
