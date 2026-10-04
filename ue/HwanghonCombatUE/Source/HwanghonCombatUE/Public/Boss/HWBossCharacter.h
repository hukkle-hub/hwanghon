#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Combat/HWCombatTypes.h"
#include "System/HWCombatTargetInterface.h"
#include "HHBossPresentationInterface.h"
#include "HWBossCharacter.generated.h"

class AHWBossCharacter;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHWBossStateChangedSignature, EHWBossState, NewState, FName, PatternId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHWBossReactionSignature, EHWAttackTier, Tier, FVector, WorldDirection);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWBossDiedSignature, AHWBossCharacter*, Boss);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHWBossParriedSignature, FName, PatternId, int32, BeatIndex);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWBossRiposteSignature, float, Damage);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHWBossBeatSignature, FName, PatternId, int32, BeatIndex);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWBossPhaseIntroSignature, int32, Phase);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_FourParams(FHWBossSpotSignature, int32, BeatIndex, FVector, Spot, float, RadiusCm, float, Seconds);

class UHWCombatTuningAsset;
class AHWAinCharacter;
class UHWBossPresentationComponent;
class UHWBossSystemComponent;

UCLASS()
class HWANGHONCOMBATUE_API AHWBossCharacter : public ACharacter, public IHWCombatTargetInterface, public IHHBossPresentationInterface
{
    GENERATED_BODY()

public:
    AHWBossCharacter();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    UPROPERTY(BlueprintAssignable, Category="Boss")
    FHWBossStateChangedSignature OnBossStateChanged;

    UPROPERTY(BlueprintAssignable, Category="Boss")
    FHWBossReactionSignature OnBossReaction;

    // Broadcast exactly once, after damage, pending attacks and movement are disabled.
    UPROPERTY(BlueprintAssignable, Category="Boss")
    FHWBossDiedSignature OnBossDied;

    // A beat was parried (docs/design/183): the combo may go on (bCounterStaggers false) - spark/flinch FX hook.
    UPROPERTY(BlueprintAssignable, Category="Boss")
    FHWBossParriedSignature OnBossParried;

    // The one heavy blow on a broken (posture) boss from its front: Elden Ring's riposte (docs/design/183).
    UPROPERTY(BlueprintAssignable, Category="Boss")
    FHWBossRiposteSignature OnBossRiposte;

    // Every beat as it lands (before parry/range is judged): the move's own FX (the Clave's walking blasts).
    UPROPERTY(BlueprintAssignable, Category="Boss")
    FHWBossBeatSignature OnBossBeat;

    // A phase that opens with a designed move begins (docs/design/181 §12): the boss holds and roars, the arena
    // darkens, the camera closes in; the opener follows.
    UPROPERTY(BlueprintAssignable, Category="Boss")
    FHWBossPhaseIntroSignature OnBossPhaseIntro;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Boss|Phase")
    float PhaseIntroSeconds = 1.4f;

    // An at-target beat chose its spot (Seconds until it lands): the warning circle.
    UPROPERTY(BlueprintAssignable, Category="Boss")
    FHWBossSpotSignature OnBossSpotMarked;

    // The boss's facing when the current move began: safe slices are measured from it.
    FVector GetPatternForward() const { return PatternForward; }

    // Is Where inside one of the beat's two safe slices (or the beat has none)?
    bool IsInSafeSlice(const FHWBossBeatSpec& Beat, const FVector& Where) const
    {
        if (Beat.SafeDeg <= 0.f) return false;
        FVector To = Where - GetActorLocation();
        To.Z = 0.f;
        if (To.IsNearlyZero()) return false;
        const float A = FMath::RadiansToDegrees(FMath::Atan2(To.Y, To.X) - FMath::Atan2(PatternForward.Y, PatternForward.X));
        for (const float C : { Beat.SafeAtDeg, Beat.SafeAtDeg + 180.f })
        {
            if (FMath::Abs(FMath::FindDeltaAngleDegrees(A, C)) <= Beat.SafeDeg * 0.5f) return true;
        }
        return false;
    }

    bool GetBeatSpot(int32 BeatIndex, FVector& OutSpot) const
    {
        const FVector* S = BeatSpots.Find(BeatIndex);
        if (S) OutSpot = *S;
        return S != nullptr;
    }

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Boss|Riposte")
    float RiposteDamageScale = 5.f;

    // Posture per parried beat of a chain that goes on (of 100): 12 -> about nine parries break the boss, a single
    // parry that ends the move still gives the Counter tier's 28 (docs/design/183 §3).
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Boss|Riposte")
    float ChainParryPosture = 12.f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Boss|Riposte")
    float RiposteReachCm = 380.f;

    // After the riposte the boss gets up this many seconds later (the break is cut short).
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Boss|Riposte")
    float RiposteRecoverSeconds = 1.2f;

    UFUNCTION(BlueprintPure)
    int32 GetParryCount() const { return ParryCount; }

    // A blow from Source now would be the riposte: broken, not yet taken, Source in front within reach.
    UFUNCTION(BlueprintPure)
    bool CanRiposteFrom(FVector Source) const;

    UFUNCTION(BlueprintPure)
    int32 GetRiposteCount() const { return RiposteCount; }

    UFUNCTION(BlueprintCallable)
    void ReceivePlayerHit(float Damage, EHWAttackTier Tier, FVector SourceLocation);

    UFUNCTION(BlueprintCallable)
    void ApplyHitStop(float Seconds);

    UFUNCTION(BlueprintImplementableEvent, Category="BossAnimation")
    void BP_OnBossStateChanged(EHWBossState NewState, FName PatternId);

    UFUNCTION(BlueprintImplementableEvent, Category="BossAnimation")
    void BP_OnBossReaction(EHWAttackTier Tier, FVector WorldDirection);

    UFUNCTION(BlueprintImplementableEvent, Category="BossAnimation")
    void BP_OnBossBeat(FName PatternId, int32 BeatIndex);

    UFUNCTION(BlueprintPure)
    EHWBossState GetBossState() const { return State; }

    UFUNCTION(BlueprintPure)
    bool IsDead() const { return State == EHWBossState::Dead; }

    UFUNCTION(BlueprintPure)
    float GetHealth() const { return Health; }

    UFUNCTION(BlueprintPure)
    UHWBossSystemComponent* GetBossSystem() const { return BossSystem; }

    UFUNCTION(BlueprintCallable)
    void ConfigureSystemHealth(float NewMaxHealth);

    UFUNCTION(BlueprintCallable)
    void EnterSystemBreak(float Duration, FVector SourceLocation);

    UFUNCTION(BlueprintCallable)
    void SetNetworkAuthoritative(bool bEnabled);

    UFUNCTION(BlueprintCallable)
    void ApplyAuthoritativeSnapshot(
        float NewHealth,
        float NewMaxHealth,
        float NewPosture,
        FName StateName,
        FName PatternId,
        bool bPatternCounterable,
        float StateProgress,
        bool bRaidClear);

    UFUNCTION(BlueprintPure)
    float GetMaxHealth() const
    {
        return AuthoritativeMaxHealth;   // server value online, ConfigureSystemHealth locally
    }

    UFUNCTION(BlueprintPure)
    float GetPosture() const { return AuthoritativePosture; }

    UFUNCTION(BlueprintPure)
    bool IsCurrentPatternCounterable() const
    {
        return bNetworkAuthoritative
            ? bAuthoritativePatternCounterable
            : CurrentPattern.bCounterable;
    }

    // Online motion only: the server beat (web icon hookL/slam/...) and its telegraph/recovery lengths.
    void ApplyAuthoritativeMotion(FName PatternIcon, float TellSeconds, float RecoverySeconds);

    // Clock the body animates on: GetBossStateNormalized, plus a local swing through an online strike.
    float GetPresentationStatePhase() const;

    // Pattern the body is animating: the local pattern, or online the server beat from ApplyAuthoritativeMotion.
    const FHWBossPatternSpec& GetPresentedPattern() const
    {
        return bNetworkAuthoritative && NetworkMotion.Id != NAME_None ? NetworkMotion : CurrentPattern;
    }

    virtual bool ReceiveSystemHit_Implementation(
        float Damage,
        EHWAttackTier Tier,
        FVector SourceLocation,
        AActor* InstigatorActor) override;

    virtual bool IsSystemTargetDead_Implementation() const override
    {
        return IsDead();
    }

    UFUNCTION(BlueprintPure)
    FName GetCurrentPatternId() const { return CurrentPattern.Id; }

    UFUNCTION(BlueprintPure)
    float GetBossStateNormalized() const;

    const FHWBossPatternSpec& GetCurrentPattern() const { return CurrentPattern; }

    // Height of the body over the floor for the current move (FHWBossPatternSpec::LiftKeys), world cm.
    UFUNCTION(BlueprintPure)
    float GetPatternLiftCm() const;

    // Seconds since the current move's tell began (-1 outside a move).
    UFUNCTION(BlueprintPure)
    float GetPatternTime() const;

    // Between a blink's vanish and reappear: the body is not drawn (FHWBossPatternSpec::BlinkHideAt).
    UFUNCTION(BlueprintPure)
    bool IsBlinkHidden() const;

    // Novel rules (UHWBossCanonRules on this boss) start their own pattern, e.g. the elbow that answers a deflect.
    void StartCanonPattern(const FHWBossPatternSpec& Pattern) { BeginPattern(Pattern); }

    // Story fights wear the novel's body (docs/design/151). Bodies are authored at their true height, so the
    // actor's fight scale (capsule, reach) is undone on the body. Rigged: a HWCharacterVisualSettings id sharing the
    // training boss skeleton and clips. Rigid: a static mesh for bodies no human skeleton fits (spider, serpent, tower).
    void WearBody(FName VisualId);

    // Designed skills of a body (Content/Data/boss_skills.json, key = the body id without "boss_") join the
    // generic pattern pool; story fights pick from their own script and are unaffected. Returns how many joined.
    int32 LoadDesignedSkills(FName VisualId);

    // QA: start the phase that opens with a designed move now (as if the health threshold was crossed).
    UFUNCTION(BlueprintCallable)
    void HandlePhaseChanged(int32 NewPhase);

    // How often the designed skills were chosen in this fight (QA, docs/design/181 §10).
    int32 GetDesignedSkillUses() const { return DesignedSkillUses; }
    int32 GetDesignedSkillCount() const { return DesignedRangeCm.Num(); }

    // The novel's name of the worn body (boss_skills.json "_names"), empty for the stand-in boss.
    const FText& GetBodyDisplayName() const { return BodyDisplayName; }
    void WearStaticBody(class UStaticMesh* Body);

    // Boss intro (v10 AHHBossIntroDirector, docs/design/162): held = no AI, no damage taken, no enrage clock -
    // the body only does what the intro beats ask of it. The story director holds it before the intro and lets go after.
    void SetIntroHold(bool bHold);

    /** The awakening roar at the start of the fight (docs/design/168): held, effects on the body, then let go. */
    void PlayRoar();
    bool IsIntroHeld() const { return bIntroHold; }

    virtual void HH_BossIntroBegin_Implementation(FName BossId) override;
    virtual void HH_BossIntroBeat_Implementation(FName BossId, EHHBossIntroBeat Beat) override;
    virtual void HH_BossIntroEnd_Implementation(FName BossId) override;

    // What each boss does in its intro beats - the novel's entrance, told with the fight's own clips.
    struct FIntroChoreo
    {
        bool bStillUntilSignature = false;   // a body that does not move until it wakes (EP01 scarecrow)
        bool bApproach = false;              // walks in toward the player through the first beats (Clave)
        float ApproachInput = 0.5f;          // walk strength (Jeong «서두르지 않는» walks slower); stops 4.5 m from the player
        FName SignaturePattern;              // SignatureMotion: this fight pattern's wind-up, stopped before contact
    };
    static FIntroChoreo IntroChoreoFor(FName BossId);

    UFUNCTION(BlueprintPure)
    EHWAttackTier GetLastReactionTier() const { return LastReactionTier; }

    UFUNCTION(BlueprintPure)
    float GetLastReactionAgeSeconds() const;

protected:
    void BeginPattern(const FHWBossPatternSpec& Pattern);
    void BeginStrike();
    void BeginRecover();
    void FinishRecover();
    void ResolveBeat(int32 BeatIndex);
    void ChooseNextPattern();
    void TickLunge(float DeltaSeconds);
    bool TryCountered(const FHWBossBeatSpec& Beat);

private:
    friend struct FHWBossLifecycleTestAccess;

    void Die();
    void CancelPendingAttack();

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UHWBossPresentationComponent> Presentation;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UHWBossSystemComponent> BossSystem;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<class UHWBossSkillFxComponent> SkillFx;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UHWCombatTuningAsset> RuntimeTuning;

    UPROPERTY(Transient)
    TObjectPtr<AHWAinCharacter> TargetPlayer;

    EHWBossState State = EHWBossState::Idle;
    FHWBossPatternSpec CurrentPattern;

    UPROPERTY(Transient)
    FHWBossPatternSpec NetworkMotion;
    float StateElapsed = 0.f;
    float IdleElapsed = 0.f;
    int32 NextBeatIndex = 0;
    float Health = 280000.f;
    float LungeRemaining = 0.f;
    FVector LungeDirection = FVector::ZeroVector;
    EHWAttackTier LastReactionTier = EHWAttackTier::Light;
    float LastReactionWorldTime = -1000.f;
    float HitStopRemaining = 0.f;
    float SystemBreakDuration = 1.45f;
    bool bNetworkAuthoritative = false;
    bool bIntroHold = false;
    float RoarRemaining = 0.f;
    FIntroChoreo IntroChoreo;
    EHHBossIntroBeat IntroBeat = EHHBossIntroBeat::PlayerEntry;
    float AuthoritativeMaxHealth = 280000.f;
    float AuthoritativePosture = 0.f;
    float AuthoritativeStateProgress = 0.f;
    bool bAuthoritativePatternCounterable = false;
    int32 ParryCount = 0;
    TMap<FName, FVector2D> DesignedRangeCm;   // designed skill id -> (min, max) distance to the target
    FName LastPatternId = NAME_None;
    int32 DesignedSkillUses = 0;
    int32 PendingOpener = INDEX_NONE;   // RuntimeTuning->BossPatterns index of a phase opener waiting for idle
    FText BodyDisplayName;
    bool bBlinkDone = false;
    void TickBlink();
    TMap<int32, FVector> BeatSpots;
    FVector PatternForward = FVector::ForwardVector;
    void TickBeatSpots();
    int32 RiposteCount = 0;
    bool bRiposteTaken = false;
};
