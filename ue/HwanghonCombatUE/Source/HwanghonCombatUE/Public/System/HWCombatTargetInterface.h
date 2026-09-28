#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "Combat/HWCombatTypes.h"
#include "HWCombatTargetInterface.generated.h"

UINTERFACE(MinimalAPI, BlueprintType)
class UHWCombatTargetInterface : public UInterface
{
    GENERATED_BODY()
};

class HWANGHONCOMBATUE_API IHWCombatTargetInterface
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Hwanghon|CombatTarget")
    bool ReceiveSystemHit(
        float Damage,
        EHWAttackTier Tier,
        FVector SourceLocation,
        AActor* InstigatorActor);

    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Hwanghon|CombatTarget")
    bool IsSystemTargetDead() const;
};
