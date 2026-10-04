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
    Break,
    Dead
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

    // This beat alone lands as a Smash (a multi-hit move whose last blow is the heavy one: Shadow Fang's dive).
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bBig = false;

    // Inner edge of the beat's reach: a blast that lands out in front misses a target standing closer than this
    // (the Clave's chain of blasts walking out, docs/design/181 §9).
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float MinRangeCm = 0.f;

    // Lands where the target stood TargetLead seconds before (Subject 09's lightning, docs/design/181 §11): the spot is
    // marked then, the beat hits within SpotRadiusCm of it, wherever the boss is.
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bAtTarget = false;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float SpotRadiusCm = 140.f;

    // Arena-wide blast with two opposite safe slices SafeDeg wide, centred SafeAtDeg (and +180) from the boss's facing
    // at the start of the move (the Clave's shutter storm, docs/design/181 §11). 0 = no safe slices.
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float SafeDeg = 0.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float SafeAtDeg = 0.f;
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

    // The novel's name for the move (shown as the tell); Id then only picks the stand-in body clip.
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FString DisplayName;

    // Boss heals this fraction of its max health for every beat that lands (Shadow Fang drinks: docs/design/181 §2).
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float HealPerHitFraction = 0.f;

    // Body height over the floor along the move: X = seconds from the tell's start, Y = cm (linear between keys).
    // Visual only - the capsule stays down, so range checks are still on the ground (docs/design/181 §8).
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<FVector2D> LiftKeys;

    // A parried beat staggers the boss and ends the move (true, the old rule), or only builds posture with a hitstop
    // while the combo goes on (false: long chains such as Shadow Fang's flurry, Elden Ring's Radahn - docs/design/183).
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bCounterStaggers = true;

    // Blink (seconds from the tell's start): the body vanishes at BlinkHideAt and reappears at BlinkAt, BlinkBehindCm
    // behind the target, facing it (the Clave's teleport, docs/design/181 §9). Negative = no blink.
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float BlinkHideAt = -1.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float BlinkAt = -1.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float BlinkBehindCm = 300.f;

    // Show the red-orange "cannot be parried" cue on this move (UHWBossSkillFxComponent). A parriable move shows it
    // on its shut beats anyway; a move with no parriable beat shows it only when it says so (designed skills).
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bDangerCue = false;

    // Seconds before a cued beat the red-orange floor ring appears (the bloom's 8 m circle fills for 1.6 s).
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float DangerLead = 0.5f;

    // Lowest boss phase (UHWBossSystemComponent: 2 below 70 % health, 3 below 40 %) the move is used in.
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    int32 MinPhase = 1;

    // How long before an at-target beat its spot is chosen and marked.
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float TargetLead = 1.2f;

    // The move that opens phase MinPhase: used at once when the phase begins, and not picked at random
    // (Malenia's bloom, Radahn's meteor: docs/design/181 §11).
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bPhaseOpener = false;
};
