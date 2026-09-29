#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/HUD.h"
#include "HWLoadingFlow.generated.h"

// The app's first screen (director 2026-09-29, doc 153 §8): the loading screen asks where to go -
// story mode (Part 1 from EP01, offline) or the shelter (character select -> the online B-1 starting town).
UCLASS()
class HWANGHONCOMBATUE_API AHWLoadingGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AHWLoadingGameMode();
};

UCLASS(Config=Game)
class HWANGHONCOMBATUE_API AHWLoadingHUD : public AHUD
{
    GENERATED_BODY()

public:
    virtual void BeginPlay() override;
    virtual void DrawHUD() override;
    virtual void NotifyHitBoxClick(FName BoxName) override;

    UPROPERTY(Config, EditAnywhere, Category="Hwanghon|Flow")
    FString StoryMap = TEXT("/Game/Hwanghon/Story/EP01/EP01_TrainingRoom_World");

    void ChooseStory();
    void ChooseShelter();

    // what was chosen last ("story" / "shelter"), for QA
    FName LastChoice;
};
