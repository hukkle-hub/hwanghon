#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HWStoryDirector.generated.h"

class ALevelSequenceActor;
class ULevelSequencePlayer;
class AHWBossCharacter;
class AHWAinCharacter;
class ACameraActor;
class AHWStoryHUD;
class UHWBossCanonRules;

UENUM(BlueprintType)
enum class EHWStorySegmentKind : uint8
{
    Cinematic,
    BossBattle
};

UENUM(BlueprintType)
enum class EHWStoryPhase : uint8
{
    Idle,
    Cinematic,   // a scene of the episode's animation (Level Sequence, or the novel card until it exists)
    Handoff,     // the last cinema frame blends into the gameplay camera
    Battle,
    BattleOver,
    Finished,
    Recover,     // after the fight: walk to the crystal and take it (EP01 L565) — story mode only
    BossIntro    // v10 boss intro (docs/design/162): five camera beats in the arena, boss held, then the fight
};

// One scene of the episode, in novel order (docs/story/_scenes/EPxx.json -> Content/Data/novel_game_master.json).
USTRUCT(BlueprintType)
struct FHWStorySegment
{
    GENERATED_BODY()

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FName SceneId;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) EHWStorySegmentKind Kind = EHWStorySegmentKind::Cinematic;
    // GameModes of the scene in the novel master (STORY_CINEMATIC, BOSS_ENTRY, BOSS_RESULT ...).
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TArray<FString> GameModes;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FString LocationId;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FText LocationName;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FText Summary;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FString NovelSource;
    // LS_<SceneId>_* in the episode's sequence folder. None yet -> the scene is shown as its novel card.
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FSoftObjectPath Sequence;
    // A battle segment covers every consecutive BOSS_BATTLE scene of the novel (EP01: SC016-SC018).
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TArray<FName> CoveredScenes;
    // Battle segments: index into the episode's battles (Content/Data/story_episodes.json).
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) int32 Battle = INDEX_NONE;
};

// One fight of the episode as the novel stages it (Content/Data/story_episodes.json, docs/design/150).
USTRUCT(BlueprintType)
struct FHWStoryBattle
{
    GENERATED_BODY()

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FName FirstScene;
    // UHWBossCanonRules subclass (reflection name without the U, e.g. "HWHeosuabiRules").
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FString RulesClass;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FText BossName;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) float BossScale = 1.f;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) bool bSpawnBoss = true;
    // The novel's body (docs/design/151): a rigged visual id, or a static mesh path. None: the stand-in.
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FName Body;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FSoftObjectPath StaticBody;
    // Who is in the fight besides Ain: kain / ryu / sera (AI companions) and story NPCs (ojeonggil ...).
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TArray<FName> Party;
    // Marker tags: <Prefix>BossSpawn, <Prefix>AinStart, <Prefix><Member>Start (EP01 has no prefix).
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FString Prefix;
    // "crystal": the joint's crystal is taken after the fight.
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FName Recover;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) float CrystalScale = 0.035f;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FText RecoverLine;
    // Canon beat -> the novel's line shown on screen (with its line number in the data).
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TMap<FName, FString> Callouts;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TArray<FName> LayersPre;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TArray<FName> LayersFight;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TArray<FName> LayersAfter;

    int32 SegmentIndex = INDEX_NONE;
    int32 EntryIndex = INDEX_NONE;
    int32 ResultIndex = INDEX_NONE;
    TSharedPtr<class FJsonObject> Script;   // the fight's steps for UHWScriptedCanonRules
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHWStoryEvent, FName, Event, FName, SceneId);

// Story mode (docs/design/137, 150): each episode plays as animation — skippable scene by scene — until a fight,
// then the camera leaves the cinema and settles behind Ain, and the fight is played by the novel's rules.
// After it the story goes on; at the end the episode's SaveFlags are written and the next episode opens.
// Boss mode (?HWStory=0) plays the same arena with no animation at all.
class AStaticMeshActor;

UCLASS()
class HWANGHONCOMBATUE_API AHWStoryDirector : public AActor
{
    GENERATED_BODY()

public:
    AHWStoryDirector();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    // Taken from the world name (EP02_World -> EP02) when it starts with EPnn.
    UPROPERTY(EditAnywhere, Category="Hwanghon|Story") FName EpisodeId = TEXT("EP01");
    UPROPERTY(EditAnywhere, Category="Hwanghon|Story") float CardSeconds = 7.f;
    UPROPERTY(EditAnywhere, Category="Hwanghon|Story") float HandoffBlendSeconds = 1.4f;
    UPROPERTY(EditAnywhere, Category="Hwanghon|Story") FString ExitMap = TEXT("/Game/Maps/HW_Frontend");

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Story")
    void SkipCurrent();

    // EP01 L565: "아인이 낫 끝으로 툭 건드려 손바닥에 받았다" — within one scythe length of the crystal.
    UFUNCTION(BlueprintCallable, Category="Hwanghon|Story")
    bool TryRecoverCrystal();

    static constexpr float CrystalReachCm = 200.f;

    UFUNCTION(BlueprintPure, Category="Hwanghon|Story")
    bool IsStoryMode() const { return bStoryMode; }

    UFUNCTION(BlueprintPure, Category="Hwanghon|Story")
    EHWStoryPhase GetPhase() const { return Phase; }

    UFUNCTION(BlueprintPure, Category="Hwanghon|Story")
    int32 GetSegmentIndex() const { return SegmentIndex; }

    const TArray<FHWStorySegment>& GetSegments() const { return Segments; }
    const TArray<FHWStoryBattle>& GetBattles() const { return Battles; }
    const FHWStorySegment* GetCurrentSegment() const { return Segments.IsValidIndex(SegmentIndex) ? &Segments[SegmentIndex] : nullptr; }
    float GetPhaseElapsed() const { return PhaseElapsed; }
    bool IsPlayingSequence() const { return SequencePlayer != nullptr; }
    AHWBossCharacter* GetBoss() const { return Boss; }
    UHWBossCanonRules* GetRules() const { return Rules; }
    AActor* GetMember(FName Id) const { return PartyActors.FindRef(Id); }
    AHWAinCharacter* GetKain() const;
    AStaticMeshActor* GetCrystal() const { return Crystal; }
    bool IsSeverSlowing() const { return SeverRealStart >= 0.0; }
    class AHHBossIntroDirector* GetIntroDirector() const { return IntroDirector; }
    // Longest an intro may hold the fight before it is cut (a broken anchor set must never lock the player).
    static constexpr float BossIntroTimeoutSeconds = 12.f;
    int32 GetCurrentBattle() const { return CurrentBattle; }

    // QA: shorter novel cards and no travel at the end.
    void SetQAMode(float InCardSeconds) { CardSeconds = InCardSeconds; bQA = true; }

    UPROPERTY(BlueprintAssignable, Category="Hwanghon|Story")
    FHWStoryEvent OnStoryEvent;

private:
    bool LoadEpisode();
    bool LoadEpisodeConfig(TMap<FName, int32>& OutBattleByScene);
    void StartSegment(int32 Index);
    void EndSegment();
    void BeginBattle(bool bFromCinema);
    void EnterBattleControl();
    void EndBattle(float Pause);
    void FinishEpisode();
    void WriteEpisodeFlags();
    void BeginRecover();

    enum class EArenaState : uint8 { PreBattle, Fight, After };
    EArenaState BattleStateAt(const FHWStoryBattle& B, int32 Index, bool bAtEnd) const;
    void ApplyLayers(int32 Index, bool bAtEnd);
    int32 BattleForSegment(int32 Index) const;

    void SetStandInsHidden(bool bHide);
    void PlaceCast(bool bVisible);
    void SpawnParty(const FHWStoryBattle& B);
    void SetPlayerControl(bool bEnabled);
    ACameraActor* FindCamera(FName Tag) const;
    AActor* FindTagged(FName Tag) const;
    AActor* FindMarker(const FString& Name) const;
    AHWStoryHUD* GetStoryHUD() const;
    void Emit(FName Event);
    void Callout(const FString& Text);

    // "세상이 늘어졌다" (EP01 L545-L567): the world slows, colour floods, and the joint's crystal falls out of the cut.
    void BeginSever();
    void TickSever();
    void DropCrystal();
    UFUNCTION() void HandleCanonBeat(FName Beat);
    UFUNCTION() void HandleBossDied(AHWBossCharacter* DeadBoss);
    UFUNCTION() void HandlePlayerDied();
    // The arena's v10 intro (an AHHBossIntroDirector tagged <Prefix>BossIntro): true when it started.
    bool StartBossIntro(const FHWStoryBattle& B, bool bFromCinema);
    UFUNCTION() void HandleBossIntroFinished(FName IntroBossId);

    UPROPERTY(Transient) TArray<FHWStorySegment> Segments;
    UPROPERTY(Transient) TArray<FHWStoryBattle> Battles;
    UPROPERTY(Transient) TObjectPtr<ULevelSequencePlayer> SequencePlayer;
    UPROPERTY(Transient) TObjectPtr<ALevelSequenceActor> SequenceActor;
    UPROPERTY(Transient) TObjectPtr<ACameraActor> HandoffCamera;
    UPROPERTY(Transient) TObjectPtr<AHWBossCharacter> Boss;
    UPROPERTY(Transient) TObjectPtr<UHWBossCanonRules> Rules;
    UPROPERTY(Transient) TObjectPtr<AHWAinCharacter> Ain;
    // Companions (kain / ryu / sera) and story NPCs of the fights, spawned once and kept for the episode.
    UPROPERTY(Transient) TMap<FName, TObjectPtr<AActor>> PartyActors;
    UPROPERTY(Transient) TObjectPtr<class APostProcessVolume> SeverPost;
    UPROPERTY(Transient) TObjectPtr<class AStaticMeshActor> Crystal;
    UPROPERTY(Transient) TObjectPtr<class AHHBossIntroDirector> IntroDirector;
    TSet<int32> IntroSeen;   // battles whose intro already played: a retry gets the short version (docs/design/163)
    double SeverRealStart = -1.0;
    bool bCrystalRecovered = false;
    FDelegateHandle InteractHandle;

    FText EpisodeTitle;
    FString SequenceFolder;
    TArray<FString> ArenaLocations;
    FName CardCamera = TEXT("CAM_Entry_Wide");
    FString NextWorld;
    int32 SegmentIndex = -1;
    int32 CurrentBattle = INDEX_NONE;
    int32 StartIndex = 0;
    EHWStoryPhase Phase = EHWStoryPhase::Idle;
    float PhaseElapsed = 0.f;
    float PendingTimer = -1.f;   // BattleOver pause, Finished exit
    bool bStoryMode = true;
    bool bStarted = false;
    bool bQA = false;
    bool bDisabled = false;
};
