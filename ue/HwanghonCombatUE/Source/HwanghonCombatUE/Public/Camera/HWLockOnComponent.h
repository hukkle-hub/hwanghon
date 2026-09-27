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
    AActor* GetTarget() const { return Target.Get(); }

    UFUNCTION(BlueprintPure)
    bool IsLocked() const { return Target.IsValid(); }

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float SearchRadius = 2500.f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float RotationSpeed = 10.f;

private:
    AActor* FindBestTarget() const;

    UPROPERTY(Transient)
    TWeakObjectPtr<AActor> Target;
};
