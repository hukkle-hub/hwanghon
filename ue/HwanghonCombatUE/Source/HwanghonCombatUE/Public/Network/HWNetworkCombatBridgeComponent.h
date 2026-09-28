#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HWNetworkCombatBridgeComponent.generated.h"

UCLASS(ClassGroup=(Hwanghon), meta=(BlueprintSpawnableComponent))
class HWANGHONCOMBATUE_API UHWNetworkCombatBridgeComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UHWNetworkCombatBridgeComponent();
    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime,ELevelTick TickType,FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintPure) bool IsAuthoritativeRaid() const;
    UFUNCTION(BlueprintCallable) bool SendAttack();
    UFUNCTION(BlueprintCallable) bool SendSmash();
    UFUNCTION(BlueprintCallable) bool SendDodge();
    UFUNCTION(BlueprintCallable) bool SendJump();
    UFUNCTION(BlueprintCallable) bool SendCounter();
    UFUNCTION(BlueprintCallable) bool SendSkill1();
    UFUNCTION(BlueprintCallable) bool SendSkill2();
    UFUNCTION(BlueprintCallable) bool SendSkill3();
    UFUNCTION(BlueprintCallable) bool SendSkill4();
    UFUNCTION(BlueprintCallable) bool SendUltimate();
    UFUNCTION(BlueprintCallable) bool SendInteract();
    UFUNCTION(BlueprintCallable) bool SetGuard(bool bOn);
    UFUNCTION(BlueprintCallable) bool SendOpening();
    UFUNCTION(BlueprintCallable) bool SendExecute();
    UFUNCTION(BlueprintCallable) bool BeginRevive();
    UFUNCTION(BlueprintCallable) bool EndRevive();
    UFUNCTION(BlueprintCallable) void SetMoveForward(float Value);
    UFUNCTION(BlueprintCallable) void SetMoveRight(float Value);

private:
    void SyncTarget();
    UPROPERTY(Transient) TObjectPtr<class UHWRaidNetworkSubsystem> Network;
    UPROPERTY(Transient) TObjectPtr<class AHWAinCharacter> OwnerCharacter;
    float MoveForward=0.f;
    float MoveRight=0.f;
    float MoveSendAccumulator=0.f;
    UPROPERTY(EditAnywhere,Category="Hwanghon|Network") float MoveSendHz=20.f;
};
