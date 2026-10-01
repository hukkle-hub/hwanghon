#pragma once

#include "CoreMinimal.h"
#include "UObject/SoftObjectPtr.h"
#include "HWCharacterVisualSettings.generated.h"

class UAnimInstance;
class USkeletalMesh;
class USkeletalMeshComponent;
class UStaticMesh;
class UHWAnimationSetAsset;

/** Body + motion set of one playable character (ain/kain/ryu/sera), or the "boss"/"enemy" stand-ins. Presentation only. */
USTRUCT(BlueprintType)
struct FHWCharacterVisual
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FName Id = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TSoftObjectPtr<USkeletalMesh> Mesh;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TSoftClassPtr<UAnimInstance> AnimClass;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TSoftObjectPtr<UHWAnimationSetAsset> AnimationSet;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FVector MeshOffset = FVector(0.f, 0.f, -92.f);

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float MeshYaw = -90.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float MeshScale = 1.f;

    // The hero's own weapon (docs/design/175) on the hand bones; the body's built-in blades are hidden.
    // A weapon mesh stands along +Z with its tip up; Grip is how far up its Z axis the hand closes (cm).
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TSoftObjectPtr<UStaticMesh> WeaponR;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TSoftObjectPtr<UStaticMesh> WeaponL;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float GripR = 0.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float GripL = 0.f;

    /** Turn about the blade axis (deg): which way the edge faces. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float WeaponTwist = 0.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float WeaponScale = 1.f;
};

/**
 * Which body and motion set each character class wears when spawned from code (GameMode sortie,
 * online raid, remote avatars). Assets are generated/copied by Scripts/ue_graybox_anim_setup.py and
 * are not committed; a missing asset leaves the pawn as it is (gameplay never depends on it).
 */
UCLASS(Config=Game, DefaultConfig)
class HWANGHONCOMBATUE_API UHWCharacterVisualSettings : public UObject
{
    GENERATED_BODY()

public:
    UPROPERTY(Config, EditAnywhere, Category="Hwanghon|Characters")
    TArray<FHWCharacterVisual> Characters;

    const FHWCharacterVisual* Find(FName CharacterId) const;

    /** Puts the configured body/anim class on Mesh. Returns the motion set (may be null). */
    static UHWAnimationSetAsset* ApplyTo(FName CharacterId, USkeletalMeshComponent* Mesh, float CapsuleHalfHeight);

    /** Puts the configured weapons in the hands (hiding the body's own blades). Called by ApplyTo. */
    static void ApplyWeapons(const FHWCharacterVisual& Visual, USkeletalMeshComponent* Mesh);

    /**
     * Downed/dead body lies down by ragdoll (no pack has a lying clip, doc 130). Off re-attaches the mesh to
     * the capsule at SavedRelative. Returns false (caller keeps a pose clip) when the body has no physics asset.
     */
    static bool SetRagdoll(USkeletalMeshComponent* Mesh, bool bOn, FTransform& SavedRelative);
};
