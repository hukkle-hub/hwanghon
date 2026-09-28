#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "HWCombatGameMode.generated.h"

class AHWBossCharacter;
class AHWAinCharacter;
class UHWQuestRunSubsystem;
class AHWDungeonDirector;

UCLASS()
class HWANGHONCOMBATUE_API AHWCombatGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AHWCombatGameMode();

    virtual void BeginPlay() override;
    virtual UClass* GetDefaultPawnClassForController_Implementation(AController* InController) override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

    // Authored quest maps must override both IDs to match their registered route.
    // The legacy graybox keeps its separate encounter ID and unlocks no quests.
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Hwanghon|Progression")
    FName EncounterId = TEXT("Seohan_Combat_VS01");

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Hwanghon|Progression")
    FName DungeonId;

    /** Local dungeon party wipe -> spend a revive token and restart at the checkpoint room.
        Quest runs keep their failure terminal (already reported to UHWQuestRunSubsystem). */
    UFUNCTION(BlueprintCallable, Category="Hwanghon|Dungeon")
    bool RetryDungeonFromCheckpoint();

    UFUNCTION(BlueprintPure, Category="Hwanghon|Dungeon")
    AHWDungeonDirector* GetEncounterDungeon() const { return EncounterDungeon; }

private:
    friend struct FHWQuestRunTestAccess;
    UFUNCTION()
    void HandleBossDied(AHWBossCharacter* Boss);

    UFUNCTION()
    void HandlePlayerDied();

    UFUNCTION()
    void HandleDungeonCompleted();

    UFUNCTION()
    void HandleDungeonFailed(FString Reason);

    UFUNCTION()
    void HandleParticipantDestroyed(AActor* Participant);

    UPROPERTY(Transient)
    TObjectPtr<AHWBossCharacter> EncounterBoss;

    UPROPERTY(Transient)
    TObjectPtr<AHWAinCharacter> EncounterPlayer;

    UPROPERTY(Transient)
    TObjectPtr<UHWQuestRunSubsystem> QuestRuns;

    UPROPERTY(Transient)
    TObjectPtr<AHWDungeonDirector> EncounterDungeon;

    FGuid RunId;
    bool bQuestRun = false;
    bool bCanRecordVictory = true;
    bool bOutcomeResolved = false;
};
