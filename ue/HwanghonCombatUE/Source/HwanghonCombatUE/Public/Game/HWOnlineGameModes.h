#pragma once

#include "CoreMinimal.h"
#include "HHDungeonOnlineGameMode.h"
#include "HHShelterHUD.h"
#include "HHShelterOnlineGameMode.h"
#include "HWOnlineGameModes.generated.h"

// Online v6 (director's HwanghonShelter plugin, docs/design/153-154): the plugin's dedicated-server shelter and
// dungeon, with this game's four C++ heroes as the pawns and the novel's NPC lines on server and clients.
// Servers pick these with ?game=: the maps keep their offline GameModes (the offline hub QA, the story worlds).

UCLASS()
class HWANGHONCOMBATUE_API AHWShelterOnlineGameMode : public AHHShelterOnlineGameMode
{
    GENERATED_BODY()

public:
    AHWShelterOnlineGameMode();
    virtual void StartPlay() override;
};

UCLASS()
class HWANGHONCOMBATUE_API AHWDungeonOnlineGameMode : public AHHDungeonOnlineGameMode
{
    GENERATED_BODY()

public:
    AHWDungeonOnlineGameMode();
};

// The plugin's HUD, plus what only a client can do: canon NPC lines for the local dialogue UI, and the phone's
// touch gestures (tap = F, hold = E, top-right = Esc, AHWShelterTouchInput).
UCLASS()
class HWANGHONCOMBATUE_API AHWShelterOnlineHUD : public AHHShelterHUD
{
    GENERATED_BODY()

protected:
    virtual void BeginPlay() override;
};

namespace HWOnlineHeroes
{
    // ain/kain/ryu/sera -> this game's hero classes
    void Fill(TMap<FName, TSoftClassPtr<APawn>>& Out);
}
