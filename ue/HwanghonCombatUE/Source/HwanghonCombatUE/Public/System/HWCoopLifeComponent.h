#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HWCoopLifeComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWDownedSignature, float, BleedoutSeconds);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FHWRevivedSignature);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FHWFullyDefeatedSignature);

UCLASS(ClassGroup=(Hwanghon), meta=(BlueprintSpawnableComponent))
class HWANGHONCOMBATUE_API UHWCoopLifeComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UHWCoopLifeComponent();

    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UPROPERTY(BlueprintAssignable)
    FHWDownedSignature OnDowned;

    UPROPERTY(BlueprintAssignable)
    FHWRevivedSignature OnRevived;

    UPROPERTY(BlueprintAssignable)
    FHWFullyDefeatedSignature OnFullyDefeated;

    UFUNCTION(BlueprintPure)
    bool IsDowned() const { return bDowned; }

    UFUNCTION(BlueprintPure)
    bool IsFullyDefeated() const { return bFullyDefeated; }

    UFUNCTION(BlueprintPure)
    float GetBleedoutRemaining() const { return BleedoutRemaining; }

    UFUNCTION(BlueprintCallable)
    bool StartRevive(class AHWAinCharacter* Reviver);

    UFUNCTION(BlueprintCallable)
    void CancelRevive();

    UFUNCTION(BlueprintPure)
    float GetReviveProgress() const;

    /** Checkpoint retry after a wipe: clears downed/defeated state (UHWCombatComponent::Revive restores health). */
    UFUNCTION(BlueprintCallable)
    void ResetForRetry();

private:
    UFUNCTION()
    void HandleDied();

    void CompleteRevive();
    void CommitFullDefeat();

    UPROPERTY(Transient)
    TObjectPtr<class AHWAinCharacter> OwnerCharacter;

    UPROPERTY(Transient)
    TObjectPtr<class UHWCombatComponent> Combat;

    UPROPERTY(Transient)
    TWeakObjectPtr<AHWAinCharacter> ActiveReviver;

    UPROPERTY(EditAnywhere, Category="Hwanghon|Coop")
    float BleedoutDuration = 20.f;

    UPROPERTY(EditAnywhere, Category="Hwanghon|Coop")
    float ReviveDuration = 3.f;

    UPROPERTY(EditAnywhere, Category="Hwanghon|Coop")
    float ReviveRangeCm = 220.f;

    float BleedoutRemaining = 0.f;
    float ReviveElapsed = 0.f;
    bool bDowned = false;
    bool bFullyDefeated = false;
};
