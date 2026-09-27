#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "Content/HWGameContentSubsystem.h"
#include "HWSaveGame.generated.h"

UENUM(BlueprintType)
enum class EHWQuestState : uint8
{
    Unavailable,
    Locked,
    Available,
    Cleared,
    Claimed
};

// A completion receipt identifies one run, so retries cannot count a victory twice.
USTRUCT()
struct FHWClearReceipt
{
    GENERATED_BODY()

    UPROPERTY(SaveGame)
    FGuid RunId;

    UPROPERTY(SaveGame)
    FName EncounterId;
};

// Store the actual inclusive-range roll. Retrying a save never rolls it again.
USTRUCT()
struct FHWResolvedClaimReward
{
    GENERATED_BODY()

    UPROPERTY(SaveGame)
    FName Id;

    UPROPERTY(SaveGame)
    EHWClaimRewardKind Kind = EHWClaimRewardKind::Item;

    UPROPERTY(SaveGame)
    int64 Amount = 0;
};

USTRUCT()
struct FHWQuestClaimReceipt
{
    GENERATED_BODY()

    UPROPERTY(SaveGame)
    FName QuestId;

    UPROPERTY(SaveGame)
    FName ArenaId;

    UPROPERTY(SaveGame)
    FName ClaimFlag;

    UPROPERTY(SaveGame)
    TArray<FHWResolvedClaimReward> Rewards;
};

UCLASS()
class HWANGHONCOMBATUE_API UHWSaveGame : public USaveGame
{
    GENERATED_BODY()

public:
    static constexpr int32 CurrentVersion = 2;

    virtual void Serialize(FArchive& Ar) override;

    UPROPERTY(SaveGame)
    int32 Version = CurrentVersion;

    UPROPERTY(SaveGame)
    TArray<FHWClearReceipt> Clears;

    // These are cumulative office-claim awards, initially zero. No starting web
    // wallet, arena loot, spending, XP thresholds or level-ups are inferred here.
    UPROPERTY(SaveGame)
    int64 Gold = 0;

    UPROPERTY(SaveGame)
    int64 Experience = 0;

    UPROPERTY(SaveGame)
    TMap<FName, int64> Inventory;

    UPROPERTY(SaveGame)
    TArray<FHWQuestClaimReceipt> Claims;

    bool IsValidProfile() const;
    bool MigrateToCurrentVersion();
    bool ValidateAgainstCatalog(const TArray<FHWQuestDefinition>& Quests) const;
    bool RecordClear(const FGuid& RunId, FName EncounterId);
    int32 GetClearCount(FName EncounterId) const;
    bool HasClear(const FGuid& RunId, FName EncounterId) const;
    EHWQuestState GetQuestState(const FHWQuestDefinition& Quest) const;
    bool ClaimQuest(const FHWQuestDefinition& Quest, FRandomStream& Random);

private:
    // LoadGameFromMemory can return an object even when its archive was truncated.
    bool bDeserializationFailed = false;
};
