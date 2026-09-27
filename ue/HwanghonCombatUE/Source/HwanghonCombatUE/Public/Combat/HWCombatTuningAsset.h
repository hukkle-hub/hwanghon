#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "Combat/HWCombatTypes.h"
#include "HWCombatTuningAsset.generated.h"

UCLASS(BlueprintType)
class HWANGHONCOMBATUE_API UHWCombatTuningAsset : public UDataAsset
{
    GENERATED_BODY()

public:
    UHWCombatTuningAsset();

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Player")
    float MaxHealth = 24450.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Player")
    float MaxStamina = 120.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Player")
    float StaminaRegenPerSecond = 18.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Player")
    float StaminaRegenDelay = 0.6f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Player")
    float DodgeIFrames = 0.30f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Player")
    float DodgeCooldown = 0.45f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Player")
    float JumpDuration = 0.45f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Player")
    float JumpCooldown = 0.8f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Counter")
    float CounterWindow = 0.25f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Counter")
    float PerfectCounterWindow = 0.10f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Counter")
    float MidCounterWindow = 0.17f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Actions")
    FHWActionSpec Attack1;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Actions")
    FHWActionSpec Attack2;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Actions")
    FHWActionSpec Attack3;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Actions")
    FHWActionSpec Smash;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Actions")
    FHWActionSpec Dodge;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Actions")
    FHWActionSpec Jump;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Actions")
    FHWActionSpec Counter;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss")
    TArray<FHWBossPatternSpec> BossPatterns;

    const FHWActionSpec& GetActionSpec(EHWActionType Action) const;
};
