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

    // Boss -> its unbroken parts -> boss. Starts a lock when none (part lock-on, SYSTEM CORE).
    UFUNCTION(BlueprintCallable)
    void CycleTarget();

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
    UPROPERTY(EditAnywhere, Category="Hwanghon|Camera") float ManualLookGraceSeconds = 1.2f;
    UPROPERTY(EditAnywhere, Category="Hwanghon|Camera") float FrameBottom = 0.90f;   // screen fraction the feet stay above
    UPROPERTY(EditAnywhere, Category="Hwanghon|Camera") float FrameTop = 0.06f;      // and the head below

private:
    // Parts of a boss are reached with CycleTarget; a fresh lock prefers the body/enemy.
    AActor* FindBestTarget() const;

    UPROPERTY(Transient)
    TWeakObjectPtr<AActor> Target;
};
