#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HHShelterHubManager.generated.h"

UCLASS()
class HWANGHONSHELTER_API AHHShelterHubManager : public AActor
{
    GENERATED_BODY()

public:
    AHHShelterHubManager();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Shelter")
    float FocusDistance = 900.f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Shelter", meta=(ClampMin="-1.0", ClampMax="1.0"))
    float MinFacingDot = 0.35f;

private:
    UFUNCTION()
    void HandleInteract();

    UFUNCTION()
    void HandleUseStation();

    UFUNCTION()
    void HandleClose();

    void RefreshFocus();
};
