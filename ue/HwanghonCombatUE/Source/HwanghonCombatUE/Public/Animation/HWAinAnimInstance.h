#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "Combat/HWCombatTypes.h"
#include "HWAinAnimInstance.generated.h"

UCLASS(BlueprintType)
class HWANGHONCOMBATUE_API UHWAinAnimInstance : public UAnimInstance
{
    GENERATED_BODY()

public:
    virtual void NativeInitializeAnimation() override;
    virtual void NativeUpdateAnimation(float DeltaSeconds) override;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Locomotion")
    float GroundSpeed = 0.f;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Locomotion")
    float Direction = 0.f;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Locomotion")
    bool bInAir = false;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Combat")
    bool bLockedOn = false;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Combat")
    EHWActionType Action = EHWActionType::None;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Combat")
    float ActionPhase = 0.f;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Combat")
    bool bAttackAction = false;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Combat")
    int32 ComboIndex = 0;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Combat")
    bool bContactWindow = false;

private:
    UPROPERTY(Transient)
    TObjectPtr<class AHWAinCharacter> AinOwner;
};
