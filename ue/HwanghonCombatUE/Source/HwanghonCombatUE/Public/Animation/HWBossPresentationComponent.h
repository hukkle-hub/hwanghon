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
};
