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

// Runs one outpost (docs/design/200, 201): builds the graybox from a UHWNodeConfig, places facilities, turrets and
// the five NPCs, runs preparation (barricades, technician orders, policies, supplies) and the invasion (waves,
// turrets on generator power, armed guard, medic), the node's human boss with an arm core, the fall and the retake
// clock, and keeps the run's contribution ledger for the guild's stewardship (server/node-store.cjs).
// Opened with ?HWNode=<id> on any combat map (AHWCombatGameMode). Other options:
//   ?HWPolicies=gate_reinforce,scouting   the steward's picks (checked against the budget)
//   ?HWSupply=6                           supply points for this defence
//   ?HWGuildRole=leader|vice|combat|supply|craft|member   the local player's guild role (permissions)
//   ?HWRetake=13                          a retake run: the node has been occupied this many hours (tier: difficulty, extra elites)
//   ?HWRegion=0.55,1,1                    Seoul's logistics, recon, manufacturing service (server nodeView region.ueOption):
//                                         supply cap, preparation time, turret repair amount (HWNodeRules::RegionEffects)
// Nothing here is Namsan-specific: another node is another Content/Data/node_<id>.json.
UCLASS()
class HWANGHONCOMBATUE_API AHWNodeDirector : public AActor
{
    GENERATED_BODY()

public:
    AHWNodeDirector();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    // Loads Content/Data/node_<id>.json and reads the HW* options. Call before BeginPlay (the game mode does).
    bool ConfigureNode(FName NodeId, const FString& Options);

    // Ends preparation and starts the invasion now.
    UFUNCTION(BlueprintCallable)
    void StartInvasion();

    // Clears enemies and boss, repairs everything and starts again from preparation.
    UFUNCTION(BlueprintCallable)
    void RestartRun();

    UPROPERTY(BlueprintAssignable)
    FHWNodeStateSignature OnNodeStateChanged;

    UFUNCTION(BlueprintPure)
    EHWNodeState GetNodeState() const { return static_cast<EHWNodeState>(Machine.State); }

    UFUNCTION(BlueprintPure)
    UHWNodeConfig* GetConfig() const { return Config; }

    // ---- what the enemies and NPCs ask
    HWNodeRules::FTargetView BuildView(const FVector& From, bool bFlanked) const;
    FVector TargetPoint(HWNodeRules::ETargetKind Kind, const FVector& From) const;
    TArray<FVector> ExtensionFor(HWNodeRules::ETargetKind Kind, const FVector& From) const;
    bool IsGateStanding() const;
    float GateLineY() const;
    AHWNodeFacility* GetFacility(EHWNodeFacilityKind Kind) const;
    AHWNodeFacility* BarricadeOnPath(const FVector& From, const FVector& To) const;
    AHWNodeFacility* TurretNear(const FVector& At, float Radius) const;
    AHWNodeNpc* NearestTargetableNpc(const FVector& From) const;
    AHWAinCharacter* GetPlayer() const;

    // ---- the contribution ledger (HWNodeRules::EContribution)
    void ReportCounter(bool bPerfect);
    // bWasAttacking: the enemy was going for a facility, a barricade, a turret or an NPC - stopping that is «defence»
    void ReportKill(EHWNodeEnemyRole EnemyRole, const FVector& At, bool bByPlayer, bool bWasAttacking);
    void ReportRepair(float Amount);
    void ReportNpcHurt(AHWNodeNpc* Npc);

    // Damage that actually landed on an enemy, by whom (player / turret / guard) - for the run log
    void ReportEnemyDamage(float Amount, const AActor* Source);

private:
    void BuildGraybox();
    void SpawnFacilities();
    void SpawnNpcs();
    void SpawnWave(int32 WaveIndex);
    void SpawnEnemy(EHWNodeEnemyRole EnemyRole, int32 Serial);
    void SpawnBoss();
    void BeginPreparation();
    void StartRetakeRun();
    void TickRun(float DeltaSeconds);   // an invasion or a retake under way: defences, waves, the boss, the fall
    bool IsRetakeRun() const { return RetakeHours >= 0.f; }
    bool IsPreparing() const;
    void SetState(HWNodeRules::ENodeState NewState);
    void TickPlayer(float DeltaSeconds);
    void TickDefences(float DeltaSeconds);
    void FinishRun(const TCHAR* ReportOutcome);
    void DrawHud() const;

    // The run log (docs/design/201 §8): Saved/HWNode/last_run.json in the simulator's format (hwnode-run/1) -
    // events with the simulator's kinds and ids, a frame a second, damage by source - so tools/ue/node-compare.mjs
    // can put a PIE run next to tools/ue/node-sim.cjs under the same options.
    void BeginRunLog();
    void RunEvent(const TCHAR* Kind, const FString& Id, const TCHAR* To);
    void RecordFrame();
    void WriteRunLog(const TCHAR* RunResult);
    bool EnemyOnComms() const;
    bool Can(HWNodeRules::EGuildPerm Perm) const { return HWNodeRules::HasPermission(GuildRole, Perm); }
    HWNodeRules::FNpcEffects CurrentNpcEffects() const;
    AHWNodeNpc* FindNpc(EHWNodeNpcRole NpcRole) const;
    AHWNodeFacility* NearestStanding(const FVector& At, float& OutDistance) const;
    TArray<FVector> PathFromTechnicianTo(EHWNodeFacilityKind Kind) const;
    FString WavePreview(int32 WaveIndex) const;

    UFUNCTION()
    void HandleEnemyDied(AHWNodeEnemy* Enemy);

    UFUNCTION()
    void HandleFacilityDestroyed(AHWNodeFacility* Facility);

    UFUNCTION()
    void HandleBossDied(AHWBossCharacter* DeadBoss);

    UFUNCTION()
    void HandleCoreExposed();

    UFUNCTION()
    void HandleCoreExtracted();

    // The node server answered the run's report (UHWRaidNetworkSubsystem::OnNodeReply)
    UFUNCTION()
    void HandleNodeReply(FString ServerNodeState, FString ServerSteward);

    UFUNCTION()
    void HandleNetError(FString ServerError);

    // Seoul's services from the node server (UHWRaidNetworkSubsystem::OnNodeRegion) - used when ?HWRegion= is not given
    UFUNCTION()
    void HandleNodeRegion(float Logistics, float Recon, float Manufacturing, float OrderBonus);
    void RequestRegion();
    void ApplyRegion(float Logistics, float Recon, float Manufacturing);

    void HandleInteract();
    void HandleExecute();
    void HandlePing();

    UPROPERTY(EditAnywhere, Category="Node")
    TObjectPtr<UHWNodeConfig> Config;

    UPROPERTY()
    TObjectPtr<USceneComponent> SceneRoot;

    UPROPERTY(Transient)
    TArray<TObjectPtr<UStaticMeshComponent>> GrayboxParts;

    UPROPERTY(Transient)
    TArray<TObjectPtr<AHWNodeFacility>> Facilities;   // gate, generator, comms, turrets, built barricades

    UPROPERTY(Transient)
    TArray<TObjectPtr<AHWNodeEnemy>> Enemies;

    UPROPERTY(Transient)
    TArray<TObjectPtr<AHWNodeNpc>> Npcs;

    UPROPERTY(Transient)
    TObjectPtr<AHWBossCharacter> Boss;

    UPROPERTY(Transient)
    TObjectPtr<UHWBossCoreComponent> BossCore;

    HWNodeRules::FNodeStateMachine Machine;
    HWNodeRules::FWaveRunner Waves;
    HWNodeRules::FPolicyEffects Policy;
    HWNodeRules::FSupplyPool Supply;
    HWNodeRules::FContribution Ledger;
    HWNodeRules::EGuildRole GuildRole = HWNodeRules::EGuildRole::Leader;
    TArray<HWNodeRules::EPolicy> Policies;
    FString PolicyNote;
    int32 SupplyStart = 6;
    float RetakeHours = -1.f;      // ?HWRetake= (hours occupied); -1 = a defence
    float RunDifficulty = 1.f;     // enemy health and damage (HWNodeRules::OccupationDifficulty on a retake)
    int32 RunExtraElites = 0;      // armoured elites added to the last wave (HWNodeRules::OccupationExtraElites)
    int32 FreePotions = 0;         // the medical-stock policy's potions, used before supplies
    float RegionServices[3] = { 1.f, 1.f, 1.f };   // ?HWRegion= logistics, recon, manufacturing (0..1)
    HWNodeRules::FRegionEffects RegionFx;          // what those services do to this run
    bool bRegionFromOption = false;                // ?HWRegion= given: the server's view does not override it
    int32 SupplyRequested = 6;                     // ?HWSupply= (or the default) before the logistics cap
    float NextRegion[3] = { 1.f, 1.f, 1.f };       // a server answer that landed mid-run: used from the next preparation
    bool bNextRegion = false;
    float PendingOrderBonus = 0.f;                 // the report's guild-order bonus, shown with the reply

    struct FPing
    {
        FVector At = FVector::ZeroVector;
        float Born = 0.f;
    };
    TArray<FPing> Pings;
    TMap<TWeakObjectPtr<AActor>, float> ShotAccumulators;
    TWeakObjectPtr<AHWAinCharacter> InputBoundTo;

    float Clock = 0.f;
    float PrepLeft = 0.f;
    float ReserveLeft = 0.f;
    float PlayerDeadFor = -1.f;
    float LastCounterShownFor = 0.f;
    float LastBossHealth = -1.f;
    float NoticeFor = 0.f;
    int32 Kills = 0;
    int32 PlayerKills = 0;
    int32 Counters = 0;
    int32 PerfectCounters = 0;
    int32 SpawnSerial = 0;
    int32 PlayerDeaths = 0;
    bool bLastCounterPerfect = false;
    bool bBossPhase = false;
    bool bPlayerPlaced = false;
    bool bReserveUsed = false;
    bool bReported = false;
    bool bReportPending = false;   // a report is out and its answer (or refusal) not in yet

    TArray<FString> RunEvents;
    TArray<FString> RunFrames;
    FString RunOptions;
    float InvasionClock = -1.f;    // seconds since the invasion began; -1 = no run being logged
    float NextFrameAt = 0.f;
    double DealtByPlayer = 0.0;
    double DealtByTurret = 0.0;
    double DealtByGuard = 0.0;
    FString Outcome;
    FString Notice;
};
