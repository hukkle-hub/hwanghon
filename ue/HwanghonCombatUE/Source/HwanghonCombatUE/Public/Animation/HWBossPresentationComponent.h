#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Combat/HWCombatTypes.h"
#include "Animation/HWAnimationSetAsset.h"
#include "HWBossPresentationComponent.generated.h"

class UAnimInstance;
class UAnimMontage;
class UAnimSequenceBase;
class AHWBossCharacter;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FHWVisualBossBeatSignature,
    FName, PatternId,
    int32, BeatIndex);

UCLASS(ClassGroup=(Hwanghon), meta=(BlueprintSpawnableComponent))
class HWANGHONCOMBATUE_API UHWBossPresentationComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UHWBossPresentationComponent();

    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Animation")
    TObjectPtr<UHWAnimationSetAsset> AnimationSet;

    UPROPERTY(BlueprintAssignable)
    FHWVisualBossBeatSignature OnVisualBossBeat;

    // Single-node body: the clip and time last shown (motion review).
    UAnimSequenceBase* GetShownClip() const { return ShownClip; }
    float GetShownTime() const { return ShownTime; }

    // Boss intro (docs/design/162). Still: the idle's first frame, held. Windup: the pattern's first clip from its start
    // to just before its contact, over Seconds, then held there. Clear: back to the state clips.
    void SetIntroStill();
    void SetIntroWindup(FName PatternId, float Seconds);
    void ClearIntroPose() { IntroClip = nullptr; }
    bool HasIntroPose() const { return IntroClip != nullptr; }

private:
    UFUNCTION()
    void HandleBossStateChanged(EHWBossState NewState, FName PatternId);

    UFUNCTION()
    void HandleBossReaction(EHWAttackTier Tier, FVector WorldDirection);

    void PlayStateBinding(
        EHWBossState State,
        FName PatternId,
        const FHWSequenceBinding& Binding);

    void PlayReactionBinding(const FHWSequenceBinding& Binding);
    void SyncStateToBossClock();

    // Body without an AnimBP (the training boss): scrub its clips on the boss clock.
    void TickSingleNode(float DeltaTime);
    void TickSingleNodePose(float DeltaTime);
    // Keeps the body on the floor: per-clip offset, and a measured drop while dead / broken (the source
    // death and down clips end lying in the air).
    void GroundBody(float DeltaTime);
    void ShowClip(UAnimSequenceBase* Sequence, float Time, bool bLoop);
    UAnimSequenceBase* PatternClipAt(const FHWBossPatternAnimationBinding& Binding, const FHWBossPatternSpec& Spec,
        EHWBossState State, float Phase, float& OutTime) const;
    float MapStrikePhaseToSourcePhase(
        float StatePhase,
        const FHWBossPatternSpec& Pattern,
        const FHWBossPatternAnimationBinding& AnimBinding) const;

    UPROPERTY(Transient)
    TObjectPtr<AHWBossCharacter> Boss;

    UPROPERTY(Transient)
    TObjectPtr<UAnimInstance> AnimInstance;

    UPROPERTY(Transient)
    TObjectPtr<UAnimMontage> ActiveStateMontage;

    UPROPERTY(Transient)
    TObjectPtr<UAnimMontage> ActiveReactionMontage;

    FHWSequenceBinding ActiveStateBinding;
    EHWBossState ActiveState = EHWBossState::Idle;
    FName ActivePatternId = NAME_None;
    float PreviousStatePhase = 0.f;
    int32 NextVisualBeat = 0;

    UPROPERTY(Transient)
    TObjectPtr<class USkeletalMeshComponent> BodyMesh;

    UPROPERTY(Transient)
    TObjectPtr<UAnimSequenceBase> ReactionSequence;

    bool bSingleNode = false;
    float ReactionTime = -1.f;
    float BaseTime = 0.f;
    float DeathTime = 0.f;
    // The down clip the boss was in when it died (held instead of the death clip).
    UPROPERTY(Transient) TObjectPtr<UAnimSequenceBase> DownedClip;
    float DownedTime = 0.f;
    float MeshBaseZ = 0.f;
    float ClipGroundCm = 0.f;
    float LyingDrop = 0.f;
    UPROPERTY(Transient)
    TObjectPtr<UAnimSequenceBase> ShownClip;
    UPROPERTY(Transient)
    TObjectPtr<UAnimSequenceBase> IntroClip;
    float IntroTo = 0.f;         // normalized end of the intro clip
    float IntroSeconds = 1.f;
    float IntroElapsed = 0.f;
    float ShownTime = 0.f;
};
