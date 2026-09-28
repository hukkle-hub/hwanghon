#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "System/HWSystemTypes.h"
#include "HWSystemRulesLibrary.generated.h"

UCLASS()
class HWANGHONCOMBATUE_API UHWSystemRulesLibrary : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintPure, Category="Hwanghon|System")
    static FHWCharacterSystemProfile CharacterProfile(FName CharacterId);

    UFUNCTION(BlueprintPure, Category="Hwanghon|System")
    static FHWSystemDungeonDefinition DungeonDefinition(FName DungeonId);

    UFUNCTION(BlueprintPure, Category="Hwanghon|System")
    static float DifficultyHealthScale(EHWSystemDifficulty Difficulty);

    UFUNCTION(BlueprintPure, Category="Hwanghon|System")
    static float DifficultyDamageScale(EHWSystemDifficulty Difficulty);
};
