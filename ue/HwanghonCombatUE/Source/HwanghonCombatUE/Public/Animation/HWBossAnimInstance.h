#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "Combat/HWCombatTypes.h"
#include "HWBossAnimInstance.generated.h"

UCLASS(BlueprintType)
class HWANGHONCOMBATUE_API UHWBossAnimInstance : public UAnimInstance
{
    GENERATED_BODY()

public:
    virtual void NativeInitializeAnimation() override;
    virtual void NativeUpdateAnimation(float DeltaSeconds) override;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Boss")
    EHWBossState BossState = EHWBossState::Idle;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Boss")
    FName PatternId = NAME_None;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Boss")
    float StatePhase = 0.f;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Boss")
    bool bTell = false;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Boss")
    bool bStrike = false;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Boss")
    bool bRecover = false;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Boss")
    bool bBigPattern = false;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Boss")
    float GroundSpeed = 0.f;

private:
    UPROPERTY(Transient)
    TObjectPtr<class AHWBossCharacter> BossOwner;
};
