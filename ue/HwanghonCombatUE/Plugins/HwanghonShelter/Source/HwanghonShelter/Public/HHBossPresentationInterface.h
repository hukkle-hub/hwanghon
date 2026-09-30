#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "HHBossIntroTypes.h"
#include "HHBossPresentationInterface.generated.h"

UINTERFACE(BlueprintType)
class HWANGHONSHELTER_API UHHBossPresentationInterface : public UInterface
{
    GENERATED_BODY()
};

class HWANGHONSHELTER_API IHHBossPresentationInterface
{
    GENERATED_BODY()

public:
    // Server-side gameplay pause and local visual setup can both use these hooks.
    // Hwanghon (docs/design/162): NativeEvent, not ImplementableEvent, so the C++ boss (AHWBossCharacter) can
    // answer them; Blueprints still override them the same way.
    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Hwanghon|BossIntro")
    void HH_BossIntroBegin(FName BossId);

    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Hwanghon|BossIntro")
    void HH_BossIntroBeat(FName BossId, EHHBossIntroBeat Beat);

    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Hwanghon|BossIntro")
    void HH_BossIntroEnd(FName BossId);
};
