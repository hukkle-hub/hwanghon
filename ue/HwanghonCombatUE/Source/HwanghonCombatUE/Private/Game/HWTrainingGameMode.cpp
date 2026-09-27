#include "Game/HWTrainingGameMode.h"

#include "Game/HWShellPlayerController.h"
#include "World/HWTrainingArena.h"
#include "World/HWTrainingCharacters.h"

AHWTrainingGameMode::AHWTrainingGameMode()
{
    EncounterId = TEXT("tutorial");
    DungeonId = TEXT("d01");
    DefaultPawnClass = AHWTrainingAinCharacter::StaticClass();
    PlayerControllerClass = AHWShellPlayerController::StaticClass();
    EncounterBossClass = AHWTrainingBossCharacter::StaticClass();
    ArenaClass = AHWTrainingArena::StaticClass();
}
