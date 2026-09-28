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
    Recover      // after the fight: walk to the crystal and take it (L565) — story mode only
};

// One scene of the episode, in novel order (docs/story/_scenes/EPxx.json -> Content/Data/novel_game_master.json).
USTRUCT(BlueprintType)
struct FHWStorySegment
{
    GENERATED_BODY()

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FName SceneId;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) EHWStorySegmentKind Kind = EHWStorySegmentKind::Cinematic;
    // First GameMode of the scene in the novel master (STORY_CINEMATIC, BOSS_ENTRY, BOSS_RESULT ...).
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FString GameMode;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FString LocationId;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FText LocationName;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FText Summary;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FString NovelSource;
    // LS_<SceneId>_* in the episode's sequence folder. None yet -> the scene is shown as its novel card.
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) FSoftObjectPath Sequence;
    // A battle segment covers every consecutive BOSS_BATTLE scene of the novel (EP01: SC016-SC018).
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TArray<FName> CoveredScenes;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHWStoryEvent, FName, Event, FName, SceneId);

// Story mode (docs/design/137): the episode plays as animation — skippable scene by scene — until the boss,
// then the camera leaves the cinema and settles behind Ain, and the fight is played. After the boss the story
// continues as animation. Boss mode (?HWStory=0) plays the same arena with no animation at all.
UCLASS()
class HWANGHONCOMBATUE_API AHWStoryDirector : public AActor
{
    GENERATED_BODY()

public:
    AHWStoryDirector();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    UPROPERTY(EditAnywhere, Category="Hwanghon|Story") FName EpisodeId = TEXT("EP01");
    UPROPERTY(EditAnywhere, Category="Hwanghon|Story") FString SequenceFolder = TEXT("/Game/Hwanghon/Story/EP01/Sequences");
    UPROPERTY(EditAnywhere, Category="Hwanghon|Story") FName ArenaLocationId = TEXT("loc_heosuabi_training_ground");
    UPROPERTY(EditAnywhere, Category="Hwanghon|Story") float CardSeconds = 7.f;
    UPROPERTY(EditAnywhere, Category="Hwanghon|Story") float HandoffBlendSeconds = 1.4f;
    UPROPERTY(EditAnywhere, Category="Hwanghon|Story") FText BossName;
    UPROPERTY(EditAnywhere, Category="Hwanghon|Story") FString ExitMap = TEXT("/Game/Maps/HW_Frontend");

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Story")
    void SkipCurrent();

    // L565: "아인이 낫 끝으로 툭 건드려 손바닥에 받았다" — within one scythe length of the crystal.
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
    const FHWStorySegment* GetCurrentSegment() const { return Segments.IsValidIndex(SegmentIndex) ? &Segments[SegmentIndex] : nullptr; }
    float GetPhaseElapsed() const { return PhaseElapsed; }
    bool IsPlayingSequence() const { return SequencePlayer != nullptr; }
    AHWBossCharacter* GetBoss() const { return Boss; }
    AHWAinCharacter* GetKain() const { return Kain; }
    AStaticMeshActor* GetCrystal() const { return Crystal; }
    bool IsSeverSlowing() const { return SeverRealStart >= 0.0; }

    // QA: shorter novel cards and no travel at the end.
    void SetQAMode(float InCardSeconds) { CardSeconds = InCardSeconds; bQA = true; }

    UPROPERTY(BlueprintAssignable, Category="Hwanghon|Story")
    FHWStoryEvent OnStoryEvent;

private:
    bool LoadEpisode();
    void StartSegment(int32 Index);
    void EndSegment();
    void BeginBattle(bool bFromCinema);
    void EnterBattleControl();
    void FinishEpisode();
    void WriteEpisodeFlags();
    void BeginRecover();

    enum class EArenaState : uint8 { PreBattle, Fight, After };
    void SetArenaState(EArenaState State);
    EArenaState StateAtStart(int32 Index) const;
    EArenaState StateAtEnd(int32 Index) const;

    void SetStandInsHidden(bool bHide);
    void PlacePlayer(bool bVisible);
    void SetPlayerControl(bool bEnabled);
    ACameraActor* FindCamera(FName Tag) const;
    AActor* FindTagged(FName Tag) const;
    AHWStoryHUD* GetStoryHUD() const;
    void Emit(FName Event);

    void SpawnKain();
    // L545-L567: "세상이 늘어졌다" — the world slows, colour floods, and the joint's crystal falls out of the cut.
    void BeginSever();
    void TickSever();
    UFUNCTION() void HandleCanonBeat(FName Beat);
    UFUNCTION() void HandleBossDied(AHWBossCharacter* DeadBoss);
    UFUNCTION() void HandlePlayerDied();

    UPROPERTY(Transient) TArray<FHWStorySegment> Segments;
    UPROPERTY(Transient) TObjectPtr<ULevelSequencePlayer> SequencePlayer;
    UPROPERTY(Transient) TObjectPtr<ALevelSequenceActor> SequenceActor;
    UPROPERTY(Transient) TObjectPtr<ACameraActor> HandoffCamera;
    UPROPERTY(Transient) TObjectPtr<AHWBossCharacter> Boss;
    UPROPERTY(Transient) TObjectPtr<AHWAinCharacter> Ain;
    // EP01: Kain is in the room, half a step behind — and the fight's rebound is his (AI in 1P, doc 138).
    UPROPERTY(Transient) TObjectPtr<AHWAinCharacter> Kain;
    UPROPERTY(Transient) TObjectPtr<class APostProcessVolume> SeverPost;
    UPROPERTY(Transient) TObjectPtr<class AStaticMeshActor> Crystal;
    double SeverRealStart = -1.0;
    bool bCrystalRecovered = false;
    FDelegateHandle InteractHandle;

    FText EpisodeTitle;
    int32 SegmentIndex = -1;
    int32 BattleIndex = INDEX_NONE;
    int32 EntryIndex = INDEX_NONE;
    int32 ResultIndex = INDEX_NONE;
    int32 StartIndex = 0;
    EHWStoryPhase Phase = EHWStoryPhase::Idle;
    float PhaseElapsed = 0.f;
    float PendingTimer = -1.f;   // Handoff blend, BattleOver pause, Finished exit
    bool bStoryMode = true;
    bool bStarted = false;
    bool bQA = false;
    bool bDisabled = false;
};
