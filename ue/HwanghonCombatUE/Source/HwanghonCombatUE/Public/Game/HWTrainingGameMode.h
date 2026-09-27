#pragma once

#include "CoreMinimal.h"
#include "Game/HWCombatGameMode.h"
#include "HWTrainingGameMode.generated.h"

// One explicitly labeled prototype encounter. Other quest routes stay unavailable.
UCLASS()
class HWANGHONCOMBATUE_API AHWTrainingGameMode : public AHWCombatGameMode
{
    GENERATED_BODY()

public:
    AHWTrainingGameMode();
};
