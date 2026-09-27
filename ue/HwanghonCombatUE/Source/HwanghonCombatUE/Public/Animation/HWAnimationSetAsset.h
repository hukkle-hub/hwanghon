#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "Combat/HWCombatTypes.h"
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

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ain")
    FHWSequenceBinding Hit;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ain")
    FHWSequenceBinding Stagger;

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

    const FHWSequenceBinding* GetPlayerBinding(EHWActionType Action) const;
    const FHWBossPatternAnimationBinding* GetBossPatternBinding(FName PatternId) const;
    const FHWSequenceBinding* GetBossReactionBinding(EHWAttackTier Tier) const;
};
