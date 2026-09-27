#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Combat/HWCombatTypes.h"
#include "HWAinCharacter.generated.h"

class USpringArmComponent;
class UCameraComponent;
class UHWCombatComponent;
class UHWLockOnComponent;
class UHWPlayerPresentationComponent;

UCLASS()
class HWANGHONCOMBATUE_API AHWAinCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    AHWAinCharacter();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

    UFUNCTION(BlueprintPure)
    UHWCombatComponent* GetCombat() const { return Combat; }

    UFUNCTION(BlueprintPure)
    UHWLockOnComponent* GetLockOn() const { return LockOn; }

    UFUNCTION(BlueprintPure)
    UHWPlayerPresentationComponent* GetPresentation() const { return Presentation; }

    UFUNCTION(BlueprintImplementableEvent, Category="Animation")
    void BP_OnCombatActionStarted(EHWActionType Action);

    UFUNCTION(BlueprintImplementableEvent, Category="Animation")
    void BP_OnCombatActionEnded(EHWActionType Action);

    UFUNCTION(BlueprintImplementableEvent, Category="Animation")
    void BP_OnPlayerContact(EHWActionType Action, EHWAttackTier Tier);

protected:
    void MoveForward(float Value);
    void MoveRight(float Value);
    void AttackPressed();
    void SmashPressed();
    void DodgePressed();
    void CombatJumpPressed();
    void CounterPressed();
    void LockOnPressed();
    void SaveAuditPressed();
    void GraphicsLowPressed();
    void GraphicsMidPressed();
    void GraphicsHighPressed();
    void PerfCapturePressed();

    UFUNCTION()
    void HandleActionStarted(EHWActionType Action);

    UFUNCTION()
    void HandleActionEnded(EHWActionType Action);

    UFUNCTION()
    void HandleContact(EHWActionType Action, EHWAttackTier Tier, float Damage);

private:
    UPROPERTY(VisibleAnywhere)
    TObjectPtr<USpringArmComponent> CameraBoom;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UCameraComponent> FollowCamera;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UHWCombatComponent> Combat;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UHWLockOnComponent> LockOn;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UHWPlayerPresentationComponent> Presentation;
};
