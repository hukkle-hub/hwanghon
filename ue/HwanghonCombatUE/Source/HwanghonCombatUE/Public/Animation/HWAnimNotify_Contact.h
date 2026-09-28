#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimNotifies/AnimNotify.h"
#include "HWAnimNotify_Contact.generated.h"

// Authored contact frame marker. It carries no gameplay: the combat clock owns
// hit timing. Tooling reads its trigger time to fill
// FHWSequenceBinding::SourceContactNormalized (Scripts/ue_graybox_anim_setup.py).
UCLASS(meta=(DisplayName="HW Contact"))
class HWANGHONCOMBATUE_API UHWAnimNotify_Contact : public UAnimNotify
{
    GENERATED_BODY()

public:
    virtual FString GetNotifyName_Implementation() const override
    {
        return TEXT("HWContact");
    }
};
