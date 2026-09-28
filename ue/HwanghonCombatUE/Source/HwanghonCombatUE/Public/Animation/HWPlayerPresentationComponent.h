#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Combat/HWCombatTypes.h"
#include "Animation/HWAnimationSetAsset.h"
#include "System/HWSystemTypes.h"
#include "HWPlayerPresentationComponent.generated.h"

class UAnimInstance;
class UAnimMontage;
class UAnimSequenceBase;
class UHWCombatComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FHWVisualPlayerContactSignature,
    EHWActionType, Action,
    float, SourceTimeSeconds);

UCLASS(ClassGroup=(Hwanghon), meta=(BlueprintSpawnableComponent))
class HWANGHONCOMBATUE_API UHWPlayerPresentationComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UHWPlayerPresentationComponent();

    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Animation")
    TObjectPtr<UHWAnimationSetAsset> AnimationSet;

    UPROPERTY(BlueprintAssignable)
    FHWVisualPlayerContactSignature OnVisualContact;

    UFUNCTION(BlueprintPure)
    UAnimSequenceBase* GetActiveSequence() const { return ActiveBinding.Sequence; }

    UFUNCTION(BlueprintPure)
    float GetActiveSourceTime() const { return ActiveSourceTime; }

    UFUNCTION(BlueprintPure)
    float GetActiveSourceNormalized() const;

    /** Kit ability one-shot (skill 1-4 / ultimate). Presentation only. */
    UFUNCTION(BlueprintCallable)
    bool PlayAbility(EHWAbilitySlot Slot);

    /** Online: the raid server started this clip for us (skill1..4, ult, exec). */
    UFUNCTION(BlueprintCallable)
    bool PlayServerClip(FName Clip);

    UFUNCTION(BlueprintPure)
    UAnimMontage* GetOneShotMontage() const { return OneShotMontage; }

    UFUNCTION(BlueprintPure)
    UAnimMontage* GetStateMontage() const { return StateMontage; }

private:
    UFUNCTION()
    void HandleAbilityActivated(FName CharacterId, EHWAbilitySlot Slot, float Multiplier);

    bool PlayOneShot(const FHWSequenceBinding* Binding);
    void UpdateLifePose();

    UFUNCTION()
    void HandleActionStarted(EHWActionType Action);

    UFUNCTION()
    void HandleActionEnded(EHWActionType Action);

    void PlayBinding(EHWActionType Action, const FHWSequenceBinding& Binding);
    void StopActive(float BlendOut);
    void SyncToCombatClock();
    float MapCombatTimeToSourceTime(
        float CombatElapsed,
        float CombatDuration,
        float HitAt,
        float SourceLength,
        float SourceContactNormalized) const;

    UPROPERTY(Transient)
    TObjectPtr<UHWCombatComponent> Combat;

    UPROPERTY(Transient)
    TObjectPtr<UAnimInstance> AnimInstance;

    UPROPERTY(Transient)
    TObjectPtr<UAnimMontage> ActiveMontage;

    UPROPERTY(Transient)
    TObjectPtr<UAnimMontage> OneShotMontage;

    // Downed / death loop; not touched by the combat-action path (which stops ActiveMontage on death).
    UPROPERTY(Transient)
    TObjectPtr<UAnimMontage> StateMontage;

    bool bWasDead = false;

    FHWSequenceBinding ActiveBinding;
    EHWActionType ActiveAction = EHWActionType::None;
    float ActiveSourceTime = 0.f;
    float PreviousCombatElapsed = 0.f;
    bool bVisualContactFired = false;
    bool bPendingStop = false;
};
