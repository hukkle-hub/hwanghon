#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HWLockOnComponent.generated.h"

UCLASS(ClassGroup=(Hwanghon), meta=(BlueprintSpawnableComponent))
class HWANGHONCOMBATUE_API UHWLockOnComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UHWLockOnComponent();

    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable)
    void ToggleLockOn();

    UFUNCTION(BlueprintCallable)
    void ClearTarget();

    UFUNCTION(BlueprintPure)
    AActor* GetTarget() const;

    UFUNCTION(BlueprintPure)
    bool IsLocked() const;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float SearchRadius = 2500.f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float RotationSpeed = 10.f;

    /** Yaw speed cap (deg/s). A boss lunge passes through the player; without a cap the
        desired yaw flips 180 deg and RInterpTo spins the camera in a few frames. Initial value, needs capture review. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="LockOn|Comfort")
    float MaxYawRateDegPerSec = 220.f;

    /** Inside this 2D distance (cm) the target direction is unstable (bodies overlap), so yaw is held. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="LockOn|Comfort")
    float OverlapHoldDistanceCm = 180.f;

private:
    AActor* FindBestTarget() const;

    UPROPERTY(Transient)
    TWeakObjectPtr<AActor> Target;
};
