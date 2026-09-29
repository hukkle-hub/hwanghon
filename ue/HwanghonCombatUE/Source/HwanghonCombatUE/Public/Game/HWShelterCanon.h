#pragma once

#include "CoreMinimal.h"

class UWorld;

// The novel's own NPC lines, names, roles and design-sheet portraits (Content/Data/shelter_npcs.json,
// tools/story/build_shelter_npcs.py) laid over the shelter plugin's written defaults, and the story flags
// deciding who is still there (Han the smith dies in EP18). Runs wherever the NPCs are drawn: the offline hub's
// GameMode, the online shelter server, and every online client (the dialogue UI is local).
namespace HWShelterCanon
{
    // Returns how many NPCs now speak canon lines.
    HWANGHONCOMBATUE_API int32 Apply(UWorld* World);
}
