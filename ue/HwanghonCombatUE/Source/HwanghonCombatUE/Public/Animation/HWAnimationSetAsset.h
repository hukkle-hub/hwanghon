#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "Combat/HWCombatTypes.h"
#include "System/HWSystemTypes.h"
#include "HWAnimationSetAsset.generated.h"

class UAnimSequenceBase;

USTRUCT(BlueprintType)
struct FHWSequenceBinding
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TObjectPtr<UAnimSequenceBase> Sequence = nullptr;

    // Where the authored source visually makes contact, 0..1 of the source sequence.
    // Runtime presentation remaps this to the combat clock HitAt.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="0.0", ClampMax="1.0"))
    float SourceContactNormalized = 0.42f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="0.0"))
    float BlendIn = 0.05f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="0.0"))
    float BlendOut = 0.14f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FName SlotName = TEXT("FullBody");

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bLoop = false;
};

USTRUCT(BlueprintType)
struct FHWBossPatternAnimationBinding
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FHWSequenceBinding Tell;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FHWSequenceBinding Strike;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FHWSequenceBinding Recover;

    // One source contact position for each gameplay Beat.
    // Example three-hit combo: [0.22, 0.52, 0.82].
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<float> SourceBeatNormalized;

    // Single-node bodies (no AnimBP, doc 131): each clip holds windup + contact + recovery, like the web game.
    // Beat k plays BeatSequences[k] (empty -> Strike) with its contact SourceBeatNormalized[k] on the beat;
    // Tell scrubs the first clip's windup, Recover the last clip's tail.
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<TObjectPtr<UAnimSequenceBase>> BeatSequences;
};

UCLASS(BlueprintType)
class HWANGHONCOMBATUE_API UHWAnimationSetAsset : public UDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ain")
    FHWSequenceBinding Attack1;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ain")
    FHWSequenceBinding Attack2;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ain")
    FHWSequenceBinding Attack3;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ain")
    FHWSequenceBinding Smash;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ain")
    FHWSequenceBinding Dodge;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ain")
    FHWSequenceBinding Jump;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ain")
    FHWSequenceBinding Counter;

    // The blow on a broken boss from its front (docs/design/183 §3): plays instead of the attack that lands it.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ain")
    FHWSequenceBinding Riposte;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ain")
    FHWSequenceBinding Hit;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ain")
    FHWSequenceBinding Stagger;

    // SYSTEM CORE kit (one-shots, not on the combat clock). Online they follow the server clip
    // (skill1..4 / ult); offline they follow UHWCharacterKitComponent::OnAbilityActivated.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Kit")
    FHWSequenceBinding Skill1;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Kit")
    FHWSequenceBinding Skill2;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Kit")
    FHWSequenceBinding Skill3;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Kit")
    FHWSequenceBinding Skill4;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Kit")
    FHWSequenceBinding Ultimate;

    // Down (co-op bleed-out, online hp 0) and final death.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Life")
    FHWSequenceBinding Downed;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Life")
    FHWSequenceBinding Death;

    // Played from GetUpStartSeconds when a ragdolled (downed) body is revived.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Life")
    FHWSequenceBinding GetUp;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Life")
    float GetUpStartSeconds = 0.4f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss")
    TMap<FName, FHWBossPatternAnimationBinding> BossPatterns;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss|Reaction")
    FHWSequenceBinding BossLightReaction;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss|Reaction")
    FHWSequenceBinding BossFinisherReaction;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss|Reaction")
    FHWSequenceBinding BossSmashReaction;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss|Reaction")
    FHWSequenceBinding BossCounterReaction;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss|Reaction")
    FHWSequenceBinding BossStaggerReaction;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss|Reaction")
    FHWSequenceBinding BossBreakReaction;

    // Bodies driven without an AnimBP (single node): locomotion + death come from these clips.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss|Base")
    FHWSequenceBinding BossIdle;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss|Base")
    FHWSequenceBinding BossWalk;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss|Base")
    FHWSequenceBinding BossDeath;

    // Limb broken (docs/design/166 tab 7, 168): the body limps - these replace idle/walk once the "limb" part breaks.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss|Base")
    FHWSequenceBinding BossInjuredIdle;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss|Base")
    FHWSequenceBinding BossInjuredWalk;

    // Played once when the fight begins (EP01: the awakening, two voices); the body is held while it roars.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss|Base")
    FHWSequenceBinding BossRoar;

    // Mesh-space cm a clip stands above the idle ground (clips moved from other rigs float, doc 132);
    // the single-node body is lowered by this while the clip plays.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss|Base")
    TMap<TObjectPtr<UAnimSequenceBase>, float> ClipGroundOffsetCm;

    const FHWSequenceBinding* GetPlayerBinding(EHWActionType Action) const;
    const FHWSequenceBinding* GetAbilityBinding(EHWAbilitySlot Slot) const;
    /** Server raid clip name (attack/smash/counter/skill1..4/ult/exec/dodge/jump) -> binding. */
    const FHWSequenceBinding* GetServerClipBinding(FName Clip, int32 ComboIndex = 0) const;
    const FHWBossPatternAnimationBinding* GetBossPatternBinding(FName PatternId) const;
    const FHWSequenceBinding* GetBossReactionBinding(EHWAttackTier Tier) const;
};
