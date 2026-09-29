#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HHDeploymentGate.generated.h"

class UBoxComponent;
class UStaticMeshComponent;
class UTextRenderComponent;
class AHHShelterOnlinePlayerState;

UENUM(BlueprintType)
enum class EHHDeploymentGateState : uint8
{
    Closed,
    Ready,
    Allocating,
    Opening,
    Open
};

UCLASS()
class HWANGHONSHELTER_API AHHDeploymentGate : public AActor
{
    GENERATED_BODY()

public:
    AHHDeploymentGate();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    UPROPERTY(ReplicatedUsing=OnRep_GateState, BlueprintReadOnly, Category="Hwanghon|Gate")
    EHHDeploymentGateState GateState = EHHDeploymentGateState::Closed;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Gate")
    float OpenHeight = 320.f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Gate")
    float OpenSpeed = 260.f;

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Gate")
    bool CanDeployParty(const TArray<AHHShelterOnlinePlayerState*>& Members) const;

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Gate")
    void SetReady();

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Gate")
    void SetAllocating();

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Gate")
    void OpenGate();

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Gate")
    void CloseGate();

protected:
    UPROPERTY(VisibleAnywhere)
    TObjectPtr<USceneComponent> Root;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UBoxComponent> PartyVolume;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UStaticMeshComponent> Shutter;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UTextRenderComponent> StatusText;

    UFUNCTION()
    void OnRep_GateState();

private:
    TSet<TWeakObjectPtr<APawn>> OverlappingPawns;
    float ClosedZ = 0.f;

    UFUNCTION()
    void OnPartyVolumeBegin(
        UPrimitiveComponent* OverlappedComponent,
        AActor* OtherActor,
        UPrimitiveComponent* OtherComp,
        int32 OtherBodyIndex,
        bool bFromSweep,
        const FHitResult& SweepResult);

    UFUNCTION()
    void OnPartyVolumeEnd(
        UPrimitiveComponent* OverlappedComponent,
        AActor* OtherActor,
        UPrimitiveComponent* OtherComp,
        int32 OtherBodyIndex);

    void RefreshStatusText();
};
