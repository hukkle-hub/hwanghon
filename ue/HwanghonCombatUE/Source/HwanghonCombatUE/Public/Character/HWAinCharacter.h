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
class UHWCharacterKitComponent;
class UHWCoopLifeComponent;
class UHWNetworkCombatBridgeComponent;

DECLARE_MULTICAST_DELEGATE(FHWLocalInteract);

UCLASS()
class HWANGHONCOMBATUE_API AHWAinCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    AHWAinCharacter();

    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

    UFUNCTION(BlueprintPure)
    UHWCombatComponent* GetCombat() const { return Combat; }

    // Interact pressed on this machine (story pickups such as the EP01 crystal). Online raids use the bridge.
    FHWLocalInteract OnLocalInteract;

    UFUNCTION(BlueprintPure)
    UHWLockOnComponent* GetLockOn() const { return LockOn; }

    UFUNCTION(BlueprintPure)
    UHWPlayerPresentationComponent* GetPresentation() const { return Presentation; }

    UFUNCTION(BlueprintPure)
    UHWCharacterKitComponent* GetCharacterKit() const { return CharacterKit; }

    UFUNCTION(BlueprintPure)
    UHWCoopLifeComponent* GetCoopLife() const { return CoopLife; }

    UFUNCTION(BlueprintPure)
    UHWNetworkCombatBridgeComponent* GetNetworkBridge() const { return NetworkBridge; }

    UFUNCTION(BlueprintPure)
    FName GetSystemCharacterId() const { return SystemCharacterId; }

    UFUNCTION(BlueprintCallable)
    void SetSystemCharacterId(FName CharacterId);

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
    void CycleTargetPressed();
    void SaveAuditPressed();
    void GraphicsLowPressed();
    void GraphicsMidPressed();
    void GraphicsHighPressed();
    void PerfCapturePressed();
    void Skill1Pressed();
    void Skill2Pressed();
    void Skill3Pressed();
    void Skill4Pressed();
    void UltimatePressed();
    void RevivePressed();
    void ReviveReleased();
    void InteractPressed();
    void GuardPressed();
    void GuardReleased();
    void OpeningPressed();
    void ExecutePressed();

    UFUNCTION()
    void HandleActionStarted(EHWActionType Action);

    UFUNCTION()
    void HandleActionEnded(EHWActionType Action);

    UFUNCTION()
    void HandleContact(EHWActionType Action, EHWAttackTier Tier, float Damage);

    // Camera framing (director reference 2026-09-28, docs/design/137). Locked on: Ain large at the lower left,
    // seen 3/4 from behind the right shoulder, the target on the right third. Free: a plain over-the-shoulder view,
    // because the locked framing turns the camera away from where "forward" moves her.
    UPROPERTY(EditAnywhere, Category="Hwanghon|Camera") float LockedArmLength = 200.f;
    UPROPERTY(EditAnywhere, Category="Hwanghon|Camera") FVector LockedSocketOffset = FVector(0.f, 128.f, 25.f);
    UPROPERTY(EditAnywhere, Category="Hwanghon|Camera") float LockedCameraYaw = -27.f;   // turned toward Ain: she sits left of centre, the target right
    UPROPERTY(EditAnywhere, Category="Hwanghon|Camera") float FreeArmLength = 240.f;
    UPROPERTY(EditAnywhere, Category="Hwanghon|Camera") FVector FreeSocketOffset = FVector(0.f, 55.f, 30.f);
    UPROPERTY(EditAnywhere, Category="Hwanghon|Camera") float FramingBlendSpeed = 4.f;
    float LockFraming = 0.f;

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

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UHWCharacterKitComponent> CharacterKit;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UHWCoopLifeComponent> CoopLife;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UHWNetworkCombatBridgeComponent> NetworkBridge;

    UPROPERTY(EditAnywhere, Category="Hwanghon|Character")
    FName SystemCharacterId = TEXT("ain");
};
