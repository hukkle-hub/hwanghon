#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "HWCombatGameMode.generated.h"

UCLASS()
class HWANGHONCOMBATUE_API AHWCombatGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AHWCombatGameMode();

    virtual void BeginPlay() override;
};
