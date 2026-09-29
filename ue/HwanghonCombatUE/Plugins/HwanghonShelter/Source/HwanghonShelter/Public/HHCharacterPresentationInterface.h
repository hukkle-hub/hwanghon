#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "HHCharacterPresentationInterface.generated.h"

UINTERFACE(BlueprintType)
class HWANGHONSHELTER_API UHHCharacterPresentationInterface : public UInterface
{
    GENERATED_BODY()
};

class HWANGHONSHELTER_API IHHCharacterPresentationInterface
{
    GENERATED_BODY()

public:
    // Optional Blueprint hooks. If the actual character BP implements these,
    // its own montage/pose can replace the procedural fallback motion.
    UFUNCTION(BlueprintImplementableEvent, BlueprintCallable, Category="Hwanghon|CharacterSelect")
    void HH_PlaySelectionIntro(FName CharacterId);

    UFUNCTION(BlueprintImplementableEvent, BlueprintCallable, Category="Hwanghon|CharacterSelect")
    void HH_PlaySelectionIdle(FName CharacterId);

    UFUNCTION(BlueprintImplementableEvent, BlueprintCallable, Category="Hwanghon|CharacterSelect")
    void HH_PlaySelectionConfirm(FName CharacterId);
};
