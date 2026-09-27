#include "Game/HWShellGameMode.h"
#include "Game/HWShellPlayerController.h"

AHWShellGameMode::AHWShellGameMode()
{
    PlayerControllerClass = AHWShellPlayerController::StaticClass();
    DefaultPawnClass = nullptr;
    bStartPlayersAsSpectators = true;
}
