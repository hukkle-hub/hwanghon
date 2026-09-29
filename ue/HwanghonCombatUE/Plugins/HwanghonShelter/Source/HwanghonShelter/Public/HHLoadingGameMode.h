#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "HHLoadingGameMode.generated.h"

UCLASS()
class HWANGHONSHELTER_API AHHLoadingGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AHHLoadingGameMode();
    virtual void BeginPlay() override;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Flow")
    float MinimumLoadingScreenSeconds = 0.8f;

private:
    FTimerHandle FlowTimer;
    void ContinueToCharacterSelect();
};
