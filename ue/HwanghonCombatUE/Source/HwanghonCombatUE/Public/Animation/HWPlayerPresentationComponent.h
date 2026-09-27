#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Combat/HWCombatTypes.h"
#include "Animation/HWAnimationSetAsset.h"
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

private:
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

    FHWSequenceBinding ActiveBinding;
    EHWActionType ActiveAction = EHWActionType::None;
    float ActiveSourceTime = 0.f;
    float PreviousCombatElapsed = 0.f;
    bool bVisualContactFired = false;
    bool bPendingStop = false;
};
