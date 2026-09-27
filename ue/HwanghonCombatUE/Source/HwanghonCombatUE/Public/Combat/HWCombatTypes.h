#pragma once

#include "CoreMinimal.h"
#include "HWCombatTypes.generated.h"

UENUM(BlueprintType)
enum class EHWActionType : uint8
{
    None,
    Attack1,
    Attack2,
    Attack3,
    Smash,
    Dodge,
    Jump,
    Counter,
    Hit,
    Stagger
};

UENUM(BlueprintType)
enum class EHWAttackTier : uint8
{
    Light,
    Finisher,
    Smash,
    Counter,
    Stagger,
    Break
};

UENUM(BlueprintType)
enum class EHWBossState : uint8
{
    Idle,
    Tell,
    Strike,
    Recover,
    Stagger,
    Break
};

USTRUCT(BlueprintType)
struct FHWActionSpec
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Duration = 0.66f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float HitAt = 0.24f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float CancelAt = 0.48f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float StaminaCost = 0.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Damage = 100.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    EHWAttackTier Tier = EHWAttackTier::Light;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FName MontageSection = NAME_None;

    // Defensive cancel can open before combo cancel. Mirrors the existing Hwanghon rule.
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float DefenseCancelAt = 0.f;
};

USTRUCT(BlueprintType)
struct FHWBossBeatSpec
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float At = 0.1f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Damage = 4000.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float RangeCm = 220.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bCounterable = false;
};

USTRUCT(BlueprintType)
struct FHWBossPatternSpec
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FName Id = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float TellDuration = 0.75f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float StrikeDuration = 0.2f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float RecoveryDuration = 0.7f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<FHWBossBeatSpec> Beats;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bCounterable = true;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bUnblockable = false;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bJumpOnly = false;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bBig = false;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float LungeDistanceCm = 0.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float LungeDuration = 0.f;
};
