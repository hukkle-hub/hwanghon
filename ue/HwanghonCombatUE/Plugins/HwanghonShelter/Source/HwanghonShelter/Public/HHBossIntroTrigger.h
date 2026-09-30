#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HHBossIntroTrigger.generated.h"

class UBoxComponent;
class AHHBossIntroDirector;

UCLASS(BlueprintType)
class HWANGHONSHELTER_API AHHBossIntroTrigger : public AActor
{
    GENERATED_BODY()

public:
    AHHBossIntroTrigger();

    virtual void BeginPlay() override;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<UBoxComponent> TriggerVolume;

    UPROPERTY(EditInstanceOnly, BlueprintReadWrite, Category="Hwanghon|BossIntro")
    TObjectPtr<AHHBossIntroDirector> Director;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|BossIntro")
    bool bOneShot = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|BossIntro")
    bool bShortVersion = false;

private:
    bool bTriggered = false;

    UFUNCTION()
    void OnTriggerBegin(
        UPrimitiveComponent* OverlappedComponent,
        AActor* OtherActor,
        UPrimitiveComponent* OtherComp,
        int32 OtherBodyIndex,
        bool bFromSweep,
        const FHitResult& SweepResult);
};
