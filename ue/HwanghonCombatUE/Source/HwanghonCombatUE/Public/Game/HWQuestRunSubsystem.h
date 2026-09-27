#pragma once

#include "CoreMinimal.h"
#include "Engine/EngineBaseTypes.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "HWQuestRunSubsystem.generated.h"

class UHWGameContentSubsystem;
class UHWProfileSubsystem;

USTRUCT(BlueprintType)
struct HWANGHONCOMBATUE_API FHWEncounterRoute
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Encounter")
    FName ArenaId;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Encounter")
    FName DungeonId;

    // A route is enabled only after an authored/cooked map exists.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Encounter")
    TSoftObjectPtr<UWorld> Map;
};

UCLASS(Config=Game, DefaultConfig)
class HWANGHONCOMBATUE_API UHWEncounterSettings : public UObject
{
    GENERATED_BODY()
public:
    UPROPERTY(Config, EditAnywhere, Category="Hwanghon|Encounters")
    TArray<FHWEncounterRoute> Routes;

    UPROPERTY(Config, EditAnywhere, Category="Hwanghon|Encounters")
    TSoftObjectPtr<UWorld> LobbyMap;
};

UENUM(BlueprintType)
enum class EHWQuestRunState : uint8
{
    Idle,
    Prepared,
    Traveling,
    InCombat,
    VictoryPendingSave,
    Victory,
    Defeat,
    Aborted
};

USTRUCT(BlueprintType)
struct HWANGHONCOMBATUE_API FHWQuestRunTicket
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category="Run")
    FGuid RunId;

    UPROPERTY(BlueprintReadOnly, Category="Run")
    FName QuestId;

    UPROPERTY(BlueprintReadOnly, Category="Run")
    FName ArenaId;

    UPROPERTY(BlueprintReadOnly, Category="Run")
    FName DungeonId;

    UPROPERTY(BlueprintReadOnly, Category="Run")
    FString MapPackageName;
};

// Selection is transient, matching the web game's lack of an accepted-quest flag.
// Only a matching, explicitly launched encounter can produce an arena receipt.
UCLASS()
class HWANGHONCOMBATUE_API UHWQuestRunSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Quest")
    bool PrepareQuest(FName QuestId);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Quest")
    bool PrepareTraining();

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Quest")
    bool OpenPreparedEncounter();

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Quest")
    bool ResetRun();

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Quest")
    bool RetryVictorySave();

    // Live combat requires an explicit abandon request. The result remains until
    // the configured lobby actually loads; a failed travel can be retried safely.
    UFUNCTION(BlueprintCallable, Category="Hwanghon|Quest")
    bool ReturnToLobby(bool bAbandonActiveRun = false);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Quest")
    bool RetryEncounter();

    UFUNCTION(BlueprintPure, Category="Hwanghon|Quest")
    bool IsReturningToLobby() const { return bReturningToLobby; }

    UFUNCTION(BlueprintPure, Category="Hwanghon|Quest")
    bool CanPrepareQuest(FName QuestId, FString& OutReason) const;

    UFUNCTION(BlueprintPure, Category="Hwanghon|Quest")
    bool CanPrepareTraining(FString& OutReason) const;

    UFUNCTION(BlueprintPure, Category="Hwanghon|Quest")
    EHWQuestRunState GetRunState() const { return State; }

    UFUNCTION(BlueprintPure, Category="Hwanghon|Quest")
    FHWQuestRunTicket GetRunTicket() const { return Ticket; }

    UFUNCTION(BlueprintPure, Category="Hwanghon|Quest")
    FString GetLastError() const { return LastError; }

    // Validates identity and uniqueness independently of asset availability.
    static bool ResolveRoute(const TArray<FHWEncounterRoute>& Routes, FName ArenaId,
        FName DungeonId, FString& OutPackage, FString& OutError);

private:
    friend class AHWCombatGameMode;
    friend struct FHWQuestRunTestAccess;
    friend struct FHWShellFlowTestAccess;

    bool Prepare(FName QuestId, FName ArenaId, FName DungeonId);
    bool CanPrepareEncounter(FName ArenaId, FName DungeonId, FString& OutPackage, FString& OutReason) const;
    bool RestoreRetryResult();
    bool AttachEncounter(UWorld* World, FName ArenaId, FName DungeonId,
        const FGuid& RequestedRun, FGuid& OutRun);
    bool CompleteEncounter(UWorld* World, const FGuid& RunId);
    bool FailEncounter(UWorld* World, const FGuid& RunId);
    void LeaveEncounter(UWorld* World, const FGuid& RunId);
    void HandleTravelFailure(UWorld* World, ETravelFailure::Type Failure, const FString& Message);
    void HandleMapLoaded(UWorld* World);
    bool Fail(const FString& Message);
    static FString GetMapPackage(const UWorld* World);

    UPROPERTY(Transient)
    TObjectPtr<UHWGameContentSubsystem> Content;

    UPROPERTY(Transient)
    TObjectPtr<UHWProfileSubsystem> Profile;

    UPROPERTY(Transient)
    FHWQuestRunTicket Ticket;

    TWeakObjectPtr<UWorld> ActiveWorld;
    EHWQuestRunState State = EHWQuestRunState::Idle;
    bool bSavingVictory = false;
    bool bReturningToLobby = false;
    FString LobbyTravelPackage;
    bool bRetryTravel = false;
    FHWQuestRunTicket PreviousTicket;
    EHWQuestRunState PreviousState = EHWQuestRunState::Idle;
    TWeakObjectPtr<UWorld> PreviousWorld;
    FString LastError;
    FDelegateHandle TravelFailureHandle;
    FDelegateHandle MapLoadedHandle;
};
