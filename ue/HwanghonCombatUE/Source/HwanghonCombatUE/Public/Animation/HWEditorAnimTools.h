#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HWEditorAnimTools.generated.h"

/**
 * Editor tools called from Python (docs/design/170). The Countess AnimBP plays montages on the upper body only, so
 * the heroes' skills never moved the legs; this inserts a full-body slot in front of the AnimGraph's output so a
 * montage on that slot drives the whole body.
 */
UCLASS()
class HWANGHONCOMBATUE_API UHWEditorAnimTools : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    /** Insert a Slot node named SlotName between the AnimGraph's final pose and its output; compile. Editor only. */
    UFUNCTION(BlueprintCallable, Category="Hwanghon|Editor")
    static bool InsertOutputSlot(UObject* AnimBlueprint, FName SlotName, FString& OutMessage);
};
