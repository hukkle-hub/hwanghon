#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "HWCombatGameMode.generated.h"

class AHWBossCharacter;

UCLASS()
class HWANGHONCOMBATUE_API AHWCombatGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AHWCombatGameMode();

    virtual void BeginPlay() override;

    // This is a vertical-slice encounter receipt, not a quest/reward claim.
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Hwanghon|Progression")
    FName EncounterId = TEXT("Seohan_Combat_VS01");

private:
    UFUNCTION()
    void HandleBossDied(AHWBossCharacter* Boss);

    FGuid RunId;
};
