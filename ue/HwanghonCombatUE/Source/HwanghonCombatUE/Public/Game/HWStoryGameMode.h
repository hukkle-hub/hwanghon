#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "HWStoryGameMode.generated.h"

class AHWStoryDirector;

// Game mode of a story episode world (EP01_TrainingRoom_World). Ain only — the novel is her story.
// ?HWStory=0 opens the same world as boss mode (no animation), ?HWStoryStart=<SceneId|Battle> starts mid-episode.
UCLASS()
class HWANGHONCOMBATUE_API AHWStoryGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AHWStoryGameMode();

    virtual void BeginPlay() override;

    UFUNCTION(BlueprintPure, Category="Hwanghon|Story")
    AHWStoryDirector* GetDirector() const { return Director; }

private:
    UPROPERTY(Transient)
    TObjectPtr<AHWStoryDirector> Director;
};
