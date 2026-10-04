#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "System/HWSystemTypes.h"
#include "HWDungeonDirector.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(
    FHWRoomStartedSignature,
    int32, RoomIndex,
    FName, RoomId,
    EHWRoomType, RoomType);

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FHWRoomClearedSignature,
    int32, RoomIndex,
    FName, RoomId);

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(
    FHWDungeonStateSignature,
    EHWSystemDungeonState, State);

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FHWDungeonCompletedSignature);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWDungeonFailedSignature, FString, Reason);

UCLASS()
class HWANGHONCOMBATUE_API AHWDungeonDirector : public AActor
{
    GENERATED_BODY()

public:
    AHWDungeonDirector();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    UPROPERTY(BlueprintAssignable)
    FHWRoomStartedSignature OnRoomStarted;

    UPROPERTY(BlueprintAssignable)
    FHWRoomClearedSignature OnRoomCleared;

    UPROPERTY(BlueprintAssignable)
    FHWDungeonStateSignature OnDungeonStateChanged;

    UPROPERTY(BlueprintAssignable)
    FHWDungeonCompletedSignature OnDungeonCompleted;

    UPROPERTY(BlueprintAssignable)
    FHWDungeonFailedSignature OnDungeonFailed;

    UFUNCTION(BlueprintCallable)
    void ConfigureDungeon(FName InDungeonId, EHWSystemDifficulty InDifficulty);

    UFUNCTION(BlueprintCallable)
    bool StartDungeon();

    UFUNCTION(BlueprintCallable)
    void ReportEnemyDefeated(int32 Count = 1);

    UFUNCTION(BlueprintCallable)
    void ReportObjectiveProgress(int32 Count = 1);

    UFUNCTION(BlueprintCallable)
    void ReportBossDefeated();

    UFUNCTION(BlueprintCallable)
    void ReportPartyWipe();

    UFUNCTION(BlueprintCallable)
    bool RetryFromCheckpoint();

    UFUNCTION(BlueprintPure)
    EHWSystemDungeonState GetDungeonState() const { return State; }

    UFUNCTION(BlueprintPure)
    int32 GetCurrentRoomIndex() const { return CurrentRoomIndex; }

    UFUNCTION(BlueprintPure)
    int32 GetCheckpointRoomIndex() const { return CheckpointRoomIndex; }

    UFUNCTION(BlueprintPure)
    int32 GetReviveTokens() const { return ReviveTokens; }

    UFUNCTION(BlueprintPure)
    int32 GetRemainingEnemies() const { return RemainingEnemies; }

    UFUNCTION(BlueprintPure)
    int32 GetRemainingObjectives() const { return RemainingObjectives; }

    UFUNCTION(BlueprintPure)
    float GetElapsedSeconds() const { return ElapsedSeconds; }

    UFUNCTION(BlueprintPure)
    float GetDifficultyHealthScale() const;

    UFUNCTION(BlueprintPure)
    float GetDifficultyDamageScale() const;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Dungeon")
    bool bUseFallbackGrayboxSpawns = true;

protected:
    UFUNCTION(BlueprintImplementableEvent, Category="Hwanghon|Dungeon")
    void BP_SpawnRoom(
        FName RoomId,
        EHWRoomType RoomType,
        int32 EnemyCount,
        int32 EliteCount);

    UFUNCTION(BlueprintImplementableEvent, Category="Hwanghon|Dungeon")
    void BP_ClearRoomActors(FName RoomId);

private:
    UFUNCTION()
    void HandleSpawnedBossDied(class AHWBossCharacter* Boss);

    void SpawnFallbackRoom(const FHWSystemDungeonRoom& Room);
    void DestroyFallbackActors();
    void EnterRoom(int32 Index);
    void CompleteCurrentRoom();
    void TransitionToNextRoom();
    void SetState(EHWSystemDungeonState NewState);
    int32 ScaledEnemyCount(int32 BaseCount) const;

    UPROPERTY(EditAnywhere, Category="Hwanghon|Dungeon")
    FName DungeonId = TEXT("d01");

    UPROPERTY(EditAnywhere, Category="Hwanghon|Dungeon")
    EHWSystemDifficulty Difficulty = EHWSystemDifficulty::Normal;

    UPROPERTY(Transient)
    TObjectPtr<class UHWCoopCombatSubsystem> Coop;

    FHWSystemDungeonDefinition Definition;
    EHWSystemDungeonState State = EHWSystemDungeonState::Idle;
    int32 CurrentRoomIndex = INDEX_NONE;
    int32 CheckpointRoomIndex = 0;
    int32 RemainingEnemies = 0;
    int32 RemainingObjectives = 0;
    int32 ReviveTokens = 0;
    float ElapsedSeconds = 0.f;
    float RoomElapsed = 0.f;
    bool bConfigured = false;

    UPROPERTY(Transient)
    TArray<TObjectPtr<AActor>> FallbackActors;
    bool bBossIntroPlayed = false;
};
