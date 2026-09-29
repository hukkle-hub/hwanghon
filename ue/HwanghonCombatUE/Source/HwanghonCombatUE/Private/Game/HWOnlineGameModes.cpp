#include "Game/HWOnlineGameModes.h"

#include "Character/HWAinCharacter.h"
#include "System/HWPlayableCharacterVariants.h"
#include "Engine/World.h"
#include "Game/HWShelterCanon.h"
#include "Game/HWShelterTouchInput.h"

void HWOnlineHeroes::Fill(TMap<FName, TSoftClassPtr<APawn>>& Out)
{
    Out.Add(TEXT("ain"), AHWAinCharacter::StaticClass());
    Out.Add(TEXT("kain"), AHWKainCharacter::StaticClass());
    Out.Add(TEXT("ryu"), AHWRyuCharacter::StaticClass());
    Out.Add(TEXT("sera"), AHWSeraCharacter::StaticClass());
}

AHWShelterOnlineGameMode::AHWShelterOnlineGameMode()
{
    DefaultPawnClass = AHWAinCharacter::StaticClass();
    HUDClass = AHWShelterOnlineHUD::StaticClass();
    HWOnlineHeroes::Fill(CharacterPawnClasses);
}

void AHWShelterOnlineGameMode::StartPlay()
{
    Super::StartPlay();
    HWShelterCanon::Apply(GetWorld());
}

AHWDungeonOnlineGameMode::AHWDungeonOnlineGameMode()
{
    DefaultPawnClass = AHWAinCharacter::StaticClass();
    HWOnlineHeroes::Fill(CharacterPawnClasses);
}

void AHWShelterOnlineHUD::BeginPlay()
{
    Super::BeginPlay();
    if (GetNetMode() == NM_Client)
    {
        HWShelterCanon::Apply(GetWorld());
    }
    GetWorld()->SpawnActor<AHWShelterTouchInput>();
}
