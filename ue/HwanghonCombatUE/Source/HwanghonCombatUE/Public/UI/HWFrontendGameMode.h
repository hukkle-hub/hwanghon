#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/PlayerController.h"
#include "HWFrontendGameMode.generated.h"

class UHWFrontendRootWidget;

// Title / lobby / menus map (/Game/Maps/HW_Frontend, World Settings GameMode = this).
UCLASS()
class HWANGHONCOMBATUE_API AHWFrontendGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AHWFrontendGameMode();
};

UCLASS()
class HWANGHONCOMBATUE_API AHWFrontendPlayerController : public APlayerController
{
    GENERATED_BODY()

protected:
    virtual void BeginPlay() override;

    UPROPERTY(Transient)
    TObjectPtr<UHWFrontendRootWidget> Root;
};
