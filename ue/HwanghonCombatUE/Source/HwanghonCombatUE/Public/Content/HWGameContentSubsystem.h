#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "HWGameContentSubsystem.generated.h"

UENUM(BlueprintType)
enum class EHWClaimRewardKind : uint8
{
    Currency,
    Experience,
    Item
};

USTRUCT(BlueprintType)
struct HWANGHONCOMBATUE_API FHWQuestClaimReward
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Content")
    FName Id;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Content")
    EHWClaimRewardKind Kind = EHWClaimRewardKind::Item;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Content")
    int32 Min = 0;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Content")
    int32 Max = 0;
};

// Read-only catalog DTO. Quantities are inclusive ranges, not granted rewards.
USTRUCT(BlueprintType)
struct HWANGHONCOMBATUE_API FHWQuestDefinition
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Content")
    FName Id;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Content")
    FText DisplayName;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Content")
    int32 RecommendedLevel = 0;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Content")
    int32 RecommendedCombatPower = 0;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Content")
    FName ChapterId;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Content")
    FName ArenaId;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Content")
    FName DungeonId;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Content")
    TArray<FName> PrerequisiteArenaIds;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Content")
    FName ClaimFlag;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Content")
    TArray<FHWQuestClaimReward> ClaimRewards;
};

UCLASS()
class HWANGHONCOMBATUE_API UHWGameContentSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;

    UFUNCTION(BlueprintPure, Category="Hwanghon|Content")
    bool IsContentLoaded() const { return bLoaded; }

    UFUNCTION(BlueprintPure, Category="Hwanghon|Content")
    TArray<FHWQuestDefinition> GetQuests() const { return Quests; }

    UFUNCTION(BlueprintPure, Category="Hwanghon|Content")
    bool GetQuest(FName QuestId, FHWQuestDefinition& OutQuest) const;

    UFUNCTION(BlueprintPure, Category="Hwanghon|Content")
    FString GetLoadError() const { return LoadError; }

    // C++ loader/parser also serve automation. Failure exposes no partial catalog.
    bool LoadFromProjectContent();
    static bool ParseQuestCatalog(const FString& Json, TArray<FHWQuestDefinition>& OutQuests, FString& OutError);

private:
    UPROPERTY(Transient)
    TArray<FHWQuestDefinition> Quests;

    bool bLoaded = false;
    FString LoadError;
};
