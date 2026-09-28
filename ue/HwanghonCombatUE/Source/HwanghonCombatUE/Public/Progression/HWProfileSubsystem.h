#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Progression/HWSaveGame.h"
#include "HWProfileSubsystem.generated.h"

// Storage adapter keeps the transaction code independent from platform slots and
// lets automation exercise real serialization without touching a user's save.
class HWANGHONCOMBATUE_API IHWProfileStorage
{
public:
    virtual ~IHWProfileStorage() = default;
    virtual bool Exists() const = 0;
    virtual UHWSaveGame* Load() = 0;
    virtual bool Save(UHWSaveGame* Candidate) = 0;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHWClearSavedSignature, FName, EncounterId, int32, ClearCount);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWProfileErrorSignature, FString, Message);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWQuestClaimedSignature, FName, QuestId);

UCLASS()
class HWANGHONCOMBATUE_API UHWProfileSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;

    // The game mode owns run identity; UI can inspect results and retry a failed save.
    bool RecordVictory(const FGuid& RunId, FName EncounterId);
    bool HasSavedVictory(const FGuid& RunId, FName EncounterId) const;

    // Called once by Initialize with platform storage; also used by isolated tests.
    // The catalog is copied and validated. Reinitializing a live profile is rejected.
    bool InitializeProfile(TSharedRef<IHWProfileStorage> InStorage, const TArray<FHWQuestDefinition>& InQuests);

    UFUNCTION(BlueprintPure, Category="Hwanghon|Progression")
    bool IsProfileAvailable() const { return Profile != nullptr; }

    UFUNCTION(BlueprintPure, Category="Hwanghon|Progression")
    EHWQuestState GetQuestState(FName QuestId) const;

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Progression")
    bool ClaimQuest(FName QuestId);

    // Cumulative office awards from zero, not the web game's displayed wallet.
    UFUNCTION(BlueprintPure, Category="Hwanghon|Progression")
    int64 GetGold() const;

    UFUNCTION(BlueprintPure, Category="Hwanghon|Progression")
    int64 GetExperience() const;

    UFUNCTION(BlueprintPure, Category="Hwanghon|Progression")
    FName GetSelectedCharacter() const;

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Progression")
    bool SelectCharacter(FName CharacterId);

    // Story progress flags (SF_*). Applied together and saved once; an invalid key/value rejects the whole set.
    bool SetStoryFlags(const TMap<FName, FString>& Flags);

    UFUNCTION(BlueprintPure, Category="Hwanghon|Progression")
    FString GetStoryFlag(FName Flag) const;

    UFUNCTION(BlueprintPure, Category="Hwanghon|Progression")
    int64 GetItemCount(FName ItemId) const;

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Progression")
    bool RetryPendingSave();

    UFUNCTION(BlueprintPure, Category="Hwanghon|Progression")
    int32 GetClearCount(FName EncounterId) const;

    UFUNCTION(BlueprintPure, Category="Hwanghon|Progression")
    bool HasPendingSave() const { return PendingProfile != nullptr; }

    UFUNCTION(BlueprintPure, Category="Hwanghon|Progression")
    FString GetLastError() const { return LastError; }

    UPROPERTY(BlueprintAssignable)
    FHWClearSavedSignature OnClearSaved;

    UPROPERTY(BlueprintAssignable)
    FHWProfileErrorSignature OnProfileError;

    UPROPERTY(BlueprintAssignable)
    FHWQuestClaimedSignature OnQuestClaimed;

private:
    bool Fail(const FString& Message);

    UPROPERTY(Transient)
    TObjectPtr<UHWSaveGame> Profile;

    UPROPERTY(Transient)
    TObjectPtr<UHWSaveGame> PendingProfile;

    UPROPERTY(Transient)
    TArray<FHWQuestDefinition> Quests;

    struct FNotification
    {
        FName Id;
        int32 ClearCount = 0;
        bool bClaim = false;
    };
    TArray<FNotification> PendingNotifications;
    TSharedPtr<IHWProfileStorage> Storage;
    FRandomStream RewardRandom;
    bool bInitialized = false;
    bool bDispatchingNotifications = false;
    bool bDispatchingError = false;
    FString LastError;
};
