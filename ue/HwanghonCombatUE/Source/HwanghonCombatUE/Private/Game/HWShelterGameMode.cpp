#include "Game/HWShelterGameMode.h"

#include "Character/HWAinCharacter.h"
#include "Game/HWShelterCanon.h"
#include "Game/HWShelterTouchInput.h"

AHWShelterGameMode::AHWShelterGameMode()
{
    DefaultPawnClass = AHWAinCharacter::StaticClass();
}

void AHWShelterGameMode::StartPlay()
{
    Super::StartPlay();   // actors have begun play: the plugin has filled its defaults, ours go over them
    CanonNPCs = HWShelterCanon::Apply(GetWorld());
    GetWorld()->SpawnActor<AHWShelterTouchInput>();   // the phone: taps become the hub's keys
}
