#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Combat/HWCombatTypes.h"
#include "HWBossCharacter.generated.h"

class AHWBossCharacter;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHWBossStateChangedSignature, EHWBossState, NewState, FName, PatternId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHWBossReactionSignature, EHWAttackTier, Tier, FVector, WorldDirection);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWBossDiedSignature, AHWBossCharacter*, Boss);

class UHWCombatTuningAsset;
class AHWAinCharacter;
class UHWBossPresentationComponent;

UCLASS()
class HWANGHONCOMBATUE_API AHWBossCharacter : public ACharacter
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
    FName GetCurrentPatternId() const { return CurrentPattern.Id; }

    UFUNCTION(BlueprintPure)
    float GetBossStateNormalized() const;

    const FHWBossPatternSpec& GetCurrentPattern() const { return CurrentPattern; }

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
    TObjectPtr<UHWCombatTuningAsset> RuntimeTuning;

    UPROPERTY(Transient)
    TObjectPtr<AHWAinCharacter> TargetPlayer;

    EHWBossState State = EHWBossState::Idle;
    FHWBossPatternSpec CurrentPattern;
    float StateElapsed = 0.f;
    float IdleElapsed = 0.f;
    int32 NextBeatIndex = 0;
    float Health = 280000.f;
    float LungeRemaining = 0.f;
    FVector LungeDirection = FVector::ZeroVector;
    EHWAttackTier LastReactionTier = EHWAttackTier::Light;
    float LastReactionWorldTime = -1000.f;
    float HitStopRemaining = 0.f;
};
