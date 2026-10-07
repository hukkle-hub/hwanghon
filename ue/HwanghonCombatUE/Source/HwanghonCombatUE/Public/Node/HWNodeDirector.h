#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Node/HWNodeConfig.h"
#include "Node/HWNodeRules.h"
#include "HWNodeDirector.generated.h"

class AHWNodeFacility;
class AHWNodeEnemy;
class AHWNodeNpc;
class AHWAinCharacter;
class AHWBossCharacter;
class UHWBossCoreComponent;
class UStaticMeshComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWNodeStateSignature, EHWNodeState, NewState);

// Runs one outpost (docs/design/200): builds the graybox from a UHWNodeConfig, places the facilities and the
// technician, drives the node state machine and the waves (HWNodeRules), respawns the player, and hands the
// last stand to the node's human boss with an arm core (UHWBossCoreComponent). Opened with ?HWNode=<id> on any
// combat map (AHWCombatGameMode), e.g.  -game ...  ?HWNode=namsan_n01
// Nothing here is Namsan-specific: another node is another Content/Data/node_<id>.json.
UCLASS()
class HWANGHONCOMBATUE_API AHWNodeDirector : public AActor
{
    GENERATED_BODY()

public:
    AHWNodeDirector();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    // Loads Content/Data/node_<id>.json. Call before BeginPlay (the game mode does).
    bool ConfigureNode(FName NodeId);

    // Starts the invasion now (the prototype starts it a few seconds after the player arrives).
    UFUNCTION(BlueprintCallable)
    void StartInvasion();

    // Clears enemies and boss, repairs everything and starts again from Stable.
    UFUNCTION(BlueprintCallable)
    void RestartRun();

    UPROPERTY(BlueprintAssignable)
    FHWNodeStateSignature OnNodeStateChanged;

    UFUNCTION(BlueprintPure)
    EHWNodeState GetNodeState() const { return static_cast<EHWNodeState>(Machine.State); }

    UFUNCTION(BlueprintPure)
    UHWNodeConfig* GetConfig() const { return Config; }

    // ---- what the enemies ask (AHWNodeEnemy)
    HWNodeRules::FTargetView BuildView(const FVector& From, bool bFlanked) const;
    FVector TargetPoint(HWNodeRules::ETargetKind Kind, const FVector& From) const;
    const TArray<FVector>& ExtensionFor(HWNodeRules::ETargetKind Kind) const;
    bool IsGateStanding() const;
    float GateLineY() const;
    AHWNodeFacility* GetFacility(EHWNodeFacilityKind Kind) const;
    AHWNodeNpc* GetTechnician() const { return Technician; }
    AHWAinCharacter* GetPlayer() const;

    void ReportCounter(bool bPerfect);

private:
    void BuildGraybox();
    void SpawnFacilities();
    void SpawnWave(int32 WaveIndex);
    void SpawnEnemy(EHWNodeEnemyRole Role, int32 Serial);
    void SpawnBoss();
    void SetState(HWNodeRules::ENodeState NewState);
    void TickPlayer(float DeltaSeconds);
    void DrawHud() const;
    bool EnemyOnComms() const;

    UFUNCTION()
    void HandleEnemyDied(AHWNodeEnemy* Enemy);

    UFUNCTION()
    void HandleFacilityDestroyed(AHWNodeFacility* Facility);

    UFUNCTION()
    void HandleBossDied(AHWBossCharacter* Boss);

    UFUNCTION()
    void HandleCoreExposed();

    UFUNCTION()
    void HandleCoreExtracted();

    UFUNCTION()
    void HandleInteract();

    UPROPERTY(EditAnywhere, Category="Node")
    TObjectPtr<UHWNodeConfig> Config;

    UPROPERTY()
    TObjectPtr<USceneComponent> SceneRoot;

    UPROPERTY(Transient)
    TArray<TObjectPtr<UStaticMeshComponent>> GrayboxParts;

    UPROPERTY(Transient)
    TArray<TObjectPtr<AHWNodeFacility>> Facilities;

    UPROPERTY(Transient)
    TArray<TObjectPtr<AHWNodeEnemy>> Enemies;

    UPROPERTY(Transient)
    TObjectPtr<AHWNodeNpc> Technician;

    UPROPERTY(Transient)
    TObjectPtr<AHWBossCharacter> Boss;

    UPROPERTY(Transient)
    TObjectPtr<UHWBossCoreComponent> BossCore;

    HWNodeRules::FNodeStateMachine Machine;
    HWNodeRules::FWaveRunner Waves;
    float StartDelay = 6.f;
    float PlayerDeadFor = -1.f;
    float RepairPool = 0.f;
    float LastCounterShownFor = 0.f;
    int32 Kills = 0;
    int32 Counters = 0;
    int32 PerfectCounters = 0;
    int32 SpawnSerial = 0;
    int32 PlayerDeaths = 0;
    bool bLastCounterPerfect = false;
    bool bBossPhase = false;
    bool bInteractBound = false;
    FString Outcome;
};
