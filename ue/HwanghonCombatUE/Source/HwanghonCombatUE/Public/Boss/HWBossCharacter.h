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

    // Novel rules (UHWBossCanonRules on this boss) start their own pattern, e.g. the elbow that answers a deflect.
    void StartCanonPattern(const FHWBossPatternSpec& Pattern) { BeginPattern(Pattern); }

    // Story fights wear the novel's body (docs/design/151). Bodies are authored at their true height, so the
    // actor's fight scale (capsule, reach) is undone on the body. Rigged: a HWCharacterVisualSettings id sharing the
    // training boss skeleton and clips. Rigid: a static mesh for bodies no human skeleton fits (spider, serpent, tower).
    void WearBody(FName VisualId);
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
};
