#include "HHCharacterSelectGameMode.h"
#include "HHCharacterSelectHUD.h"

AHHCharacterSelectGameMode::AHHCharacterSelectGameMode()
{
    HUDClass = AHHCharacterSelectHUD::StaticClass();
    DefaultPawnClass = nullptr;
    bStartPlayersAsSpectators = true;
}
