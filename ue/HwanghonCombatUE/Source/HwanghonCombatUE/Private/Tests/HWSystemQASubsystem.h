#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Tickable.h"
#include "Combat/HWCombatTypes.h"
#include "HWSystemQASubsystem.generated.h"

class FJsonObject;
class FJsonValue;
class AActor;
class AHWAinCharacter;
class APlayerController;
class UHWRaidNetworkSubsystem;
class UHWProfileSubsystem;
struct FHWRaidNetPlayer;
struct FHWRaidNetSnapshot;

/**
 * Command-line QA driver for the SYSTEM CORE gates (driven by tools/ue/system-core-qa.cjs).
 * Exists only with -HWQA=<select|writev2|local|net> and never in Shipping.
 * It plays through the real input mappings (APlayerController::InputKey), so the pawn, kit,
 * lock-on and network bridge paths are the ones a player uses. It never writes combat results;
 * online damage/phase/parts/rewards stay with server/raid.cjs.
 */
UCLASS()
class UHWSystemQASubsystem : public UGameInstanceSubsystem, public FTickableGameObject
{
    GENERATED_BODY()

public:
    virtual bool ShouldCreateSubsystem(UObject* Outer) const override;
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

    virtual void Tick(float DeltaTime) override;
    virtual TStatId GetStatId() const override;
    virtual ETickableTickType GetTickableTickType() const override;
    virtual bool IsTickable() const override;
    virtual bool IsTickableWhenPaused() const override { return true; }

private:
    // Report
    void Gate(const FString& Name, bool bPass, const FString& Detail);
    void Note(const FString& Line);
    void Finish(bool bOk, const FString& Why);
    void Flush();
    void WriteShare(const FString& Name, const FString& Body) const;
    bool ReadShare(const FString& Name, FString& Out) const;
    bool HasShare(const FString& Name) const;

    // Input (real mappings)
    APlayerController* GetPC() const;
    AHWAinCharacter* GetPawn() const;
    FKey KeyForAction(FName Action) const;
    void Tap(FName Action);
    void Hold(FName Action, bool bDown);
    void Steer(float YawDegrees, bool bMove);
    void Backpedal(bool bBack);
    void ReleaseAll();

    // Identity: selected/online character -> exactly one pawn of that class
    void RecordIdentity(AHWAinCharacter* Pawn, FName Expected, bool bOnline);

    // Modes
    void TickSelect();
    void TickWriteV2();
    void TickLocal(float Dt);
    void LocalSummary(const struct FHWSystemDungeonDefinition& Def);
    void TickNet(float Dt);
    void TickShowcase(float Dt);
    void TickBossShow(float Dt);
    void TickClipReview(float Dt);
    void TickArenaShow(float Dt);
    TArray<TWeakObjectPtr<class ACameraActor>> ArenaCameras;
    int32 ArenaState = -1;
    int32 ArenaShot = -1;
    float ArenaShotDelay = 0.f;
    FString ArenaPendingTag;
    void TickStoryShow(float Dt);
    void TickStyleShow(float Dt);
    TArray<TWeakObjectPtr<class APostProcessVolume>> StyleVolumes;
    int32 StyleShot = -1;
    float StyleDelay = 0.f;
    FString StylePending;
    TArray<TWeakObjectPtr<class ACameraActor>> StyleCameras;
    TWeakObjectPtr<class AHWStoryDirector> StoryDirector;
    FString StoryKey;
    float StoryKeyTime = 0.f;
    int32 StoryShots = 0;
    bool bStoryKilled = false;
    bool bStoryAinDied = false;   // -HWQAStoryDie: Ain falls once first; the director must reopen at the fight
    int32 CanonStage = 0;          // doc 138: 0 deflect, 1 wait rebound, 2 sever, 3 done
    float CanonStageTime = 0.f;
    bool bCanonSpinShot = false;
    int32 SeverShots = 0;
    int32 RecoverStage = 0;
    int32 StoryBattleSeen = -1;
    // v10 boss intro (docs/design/162): beats seen, their shots, the held checks, and the length of the intro
    void TickStoryIntro(class AHWStoryDirector& D, float Dt);
    void IntroShot(class AHWStoryDirector& D, int32 Beat);
    int32 IntroBeatSeen = -1;
    int32 IntroBeats = 0;
    float IntroTime = 0.f;
    bool bIntroChecked = false;
    bool bIntroBeatShot = false;
    bool bIntroAfterChecked = true;
    // neckprobe: head lean at forced camera pitches
    void TickNeckProbe(float Dt);
    // sheltershow: the 7 stations of the Gangnam shelter hub (docs/design/152)
    void TickShelterShow(float Dt);
    // sheltertour: every HW_View camera spot of the shelter map (Scripts/ue_shelter_b1.py), one shot each, no HUD
    void TickShelterTour(float Dt);
    TArray<TWeakObjectPtr<AActor>> TourSpots;
    int32 TourStep = -1;
    float TourTime = 0.f;
    // lamp flicker (UHWLampFlickerSubsystem): lamp-samples seen dimmed over the tour, then a held steady/dip pair of shots
    int64 FlickerSamples = 0;
    int64 FlickerDimmed = 0;
    int32 FlickerStep = 0;
    // -HWQA=frontend (docs/design/158): title -> 입장 reveal -> character select -> connect camera, shots on the timeline
    void TickFrontEnd(float Dt);
    int32 FrontStep = 0;
    int32 OnlineSteps = 0;   // onlineloop: › presses done on the character stand
    float FrontTime = 0.f;
    int32 ShelterStep = -1;
    float ShelterTime = 0.f;
    int32 ShelterPhase = 0;
    int32 ShelterFails = 0;
    // onlineloop: loading -> character select -> shelter server -> party -> gate -> dungeon server -> back to the
    // manpower office, two real clients (docs/design/154). Implemented in HWOnlineLoopQA.cpp.
    void TickOnlineLoop(float Dt);
    void OnlineTouch(int32 Type, const FVector2D& At);
    FString OnlineWorld;
    int32 OnlinePhase = 0;
    float OnlineTime = 0.f;
    float OnlineMark = 0.f;
    int32 OnlineFails = 0;
    int32 OnlineShelterVisits = 0;
    FString OnlinePartyId;
    bool bOnlineWasLeader = false;
    bool bOnlineSent = false;
    int32 NeckStep = -1;
    float NeckTime = 0.f;

    TArray<TWeakObjectPtr<AActor>> ReviewActors;
    UPROPERTY()
    TArray<TObjectPtr<class UAnimSequenceBase>> ReviewClips;
    TArray<float> ReviewTimes;
    TArray<float> ReviewContacts;
    int32 ReviewShotStep = 0;
    TSet<FString> BossShotsTaken;
    EHWBossState BossShowState = EHWBossState::Idle;
    FName BossShowPattern = NAME_None;
    float BossShowPrevPhase = 0.f;
    float BossEndAt = -1.f;
    bool BossShowPhasePush = false;
    float BossShowMovedAt = -100.f;
    TWeakObjectPtr<AActor> BossShowLight;
    void Shot(const FString& Name, bool bShowUI = false);
    void MeasureBody(const FString& Label, AActor* Actor);
    void TickRaid(float Dt);
    void RaidExplore(const FHWRaidNetSnapshot& R, const FHWRaidNetPlayer& Me);
    void RaidFight(const FHWRaidNetSnapshot& R, const FHWRaidNetPlayer& Me, float Dt);
    void SampleRaid(const FHWRaidNetSnapshot& R);
    void ConsumeRaidEvents(const FHWRaidNetSnapshot& R);
    bool SteerToServerPoint(const FHWRaidNetPlayer& Me, float X, float Y, float Arrive);
    bool ReviveDuty(const FHWRaidNetSnapshot& R, const FHWRaidNetPlayer& Me);
    int32 SkillAttemptsNet[4] = {0,0,0,0};
    bool LoadGrid();

    FString Mode;
    FString OutPath;
    FString ShareDir;
    float Elapsed = 0.f;
    float FlushTimer = 0.f;
    float ExitTimer = -1.f;
    bool bFinished = false;

    TSharedPtr<FJsonObject> Report;
    TSharedPtr<FJsonObject> Gates;
    TArray<TSharedPtr<FJsonValue>> Timeline;
    TArray<TSharedPtr<FJsonValue>> Lines;
    TMap<FString, int32> Counters;

    TSet<FName> HeldActions;
    bool bHoldingForward = false;
    bool bHoldingBack = false;

    // select / local
    FName ExpectCharacter = NAME_None;
    FName NextCharacter = NAME_None;
    bool bCheckOnly = false;
    bool bIdentityDone = false;
    FName LocalDungeonId = NAME_None;
    int32 LastRoom = -2;
    uint8 LastDungeonState = 255;
    TArray<FString> RoomOrder;
    bool bWipeTest = false;
    bool bWipeDone = false;
    bool bForcedWipe = false;
    float WipeTimer = 0.f;
    float FailedTimer = 0.f;
    int32 Retries = 0;
    float BossRoomTime = 0.f;
    int32 MaxPhase = 0;
    int32 BreakCount = 0;
    TSet<FName> BrokenParts;
    bool bPartLocked = false;
    int32 SkillAttempts[5] = {0,0,0,0,0};
    int32 SkillActivations[5] = {0,0,0,0,0};
    float SkillDamage[5] = {0.f,0.f,0.f,0.f,0.f};
    int32 PendingSlot = -1;
    float PendingTimer = 0.f;
    float PendingHpBefore = 0.f;
    TWeakObjectPtr<AActor> PendingTarget;
    float AttackTimer = 0.f;
    float LockTimer = 0.f;
    float CounterTimer = 0.f;
    float SkillTimer = 0.f;
    int32 ElitesSeen = 0;
    int32 ObjectivesTouched = 0;
    int32 LastObjectivesRemaining = -1;
    float LastLocalHealth = -1.f;
    float StartTimer = 0.f;
    float TargetTimer = 0.f;

    // net
    enum class ENetStage : uint8 { Connect, Go, Room, Ready, WaitRaid, Raid, Done };
    ENetStage NetStage = ENetStage::Connect;
    FString Role;
    int32 Index = 0;
    int32 Players = 1;
    FString LevelId;
    int32 VictimIndex = -1;
    bool bResume = false;
    float StageTimer = 0.f;
    float ActionTimer = 0.f;
    float SampleTimer = 0.f;
    float DecisionTimer = 0.f;
    FString ServerUrl;
    FString KnownToken;
    FString KnownId;
    FName LastRaidState = NAME_None;
    int32 LastRaidPhase = -1;
    int64 LastEventId = 0;
    float TeleEnd = -1.f;
    FString TeleTarget;
    bool bTeleCounterable = false;
    bool bVictimDowned = false;
    bool bVictimRevived = false;
    float VictimDownAt = -1.f;
    FString ReviveHelping;
    float LastReviveProgress = 0.f;
    float ReviveStall = 0.f;
    bool bWipeMode = false;
    bool bRetrySent = false;
    float RetryTimer = 0.f;
    bool bReconnectPlanned = false;
    int32 ReconnectStage = 0;
    float ReconnectTimer = 0.f;
    float PostReconnectTimer = -1.f;
    float FightTime = 0.f;
    float PhaseOneTime = 0.f;
    float ClearTimer = 0.f;
    int32 TargetSwitches = 0;
    FString LastTelegraphTarget;
    TArray<TSharedPtr<FJsonValue>> TelegraphLog;
    TSet<FString> HazardPhasesSeen;
    TSet<FString> PartsBrokenNet;
    TMap<FString, float> HpAtDown;

    // Showcase (-HWQA=showcase): body/motion review shots with RHI
    TArray<TPair<float, TFunction<void()>>> ShowSteps;
    TArray<TWeakObjectPtr<AActor>> ShowAvatars;
    TWeakObjectPtr<AActor> ShowCamera;
    float ShowTime = -1.f;
    double ShowStart = 0.0;
    float WalkFrom = -1.f;
    TArray<FVector> WalkStart;
    FString PendingShot;
    float PendingShotTimer = 0.f;
    float ShotEveryTimer = 0.f;
    int32 SkillShots = 0;
    int32 ShowStep = 0;
    FString ShotDir;
    TArray<TSharedPtr<FJsonValue>> BodySamples;

    // Grid (server level rows) for explore pathing
    int32 GridW = 0;
    int32 GridH = 0;
    float Cell = 64.f;
    TArray<uint8> Solid;
    TArray<FVector2D> Path;
    FVector2D PathGoal = FVector2D(-1.f, -1.f);
    float PathAge = 0.f;
};
