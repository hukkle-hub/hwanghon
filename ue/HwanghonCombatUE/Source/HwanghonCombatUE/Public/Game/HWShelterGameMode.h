#pragma once

#include "CoreMinimal.h"
#include "HHShelterDemoGameMode.h"
#include "HWShelterGameMode.generated.h"

// Gangnam bunker hub (Plugins/HwanghonShelter v2, director uploads 2026-09-29, docs/design/152): the plugin's
// stations, NPCs and prototype HUD, walked by Ain. The NPCs speak the novel's own lines
// (Content/Data/shelter_npcs.json, tools/story/build_shelter_npcs.py) over the plugin's written defaults, wear the
// design-sheet portraits, and the story flags decide who is still there (Han the smith dies in EP18).
UCLASS()
class HWANGHONCOMBATUE_API AHWShelterGameMode : public AHHShelterDemoGameMode
{
    GENERATED_BODY()

public:
    AHWShelterGameMode();
    virtual void StartPlay() override;

    int32 GetCanonNPCCount() const { return CanonNPCs; }

private:
    int32 CanonNPCs = 0;
};
