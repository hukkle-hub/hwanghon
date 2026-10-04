#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimInstanceProxy.h"
#include "AnimNodes/AnimNode_RetargetPoseFromMesh.h"
#include "HWRetargetAnimInstance.generated.h"

class UIKRetargeter;

/** Runs FAnimNode_RetargetPoseFromMesh without an Anim Blueprint: the whole graph is that one node. */
struct FHWRetargetAnimInstanceProxy : public FAnimInstanceProxy
{
    FHWRetargetAnimInstanceProxy() = default;
    explicit FHWRetargetAnimInstanceProxy(UAnimInstance* InAnimInstance) : FAnimInstanceProxy(InAnimInstance) {}

    virtual void PreUpdate(UAnimInstance* InAnimInstance, float DeltaSeconds) override;
    virtual void Update(float DeltaSeconds) override;
    virtual bool Evaluate(FPoseContext& Output) override;
    virtual void CacheBones() override;

    FAnimNode_RetargetPoseFromMesh Node;
    bool bNodeReady = false;
};

/**
 * A MetaHuman body that follows another skeleton's pose (docs/design/184): the hero's combat body (Paragon Countess
 * skeleton, every clip, montage and AnimBP the combat uses) keeps running hidden, and this instance retargets its
 * pose onto the MetaHuman body each frame through an IK Retargeter. No clip had to be redone.
 */
UCLASS(Transient, NotBlueprintable)
class HWANGHONCOMBATUE_API UHWRetargetAnimInstance : public UAnimInstance
{
    GENERATED_BODY()

public:
    void SetSource(USkeletalMeshComponent* InSource, UIKRetargeter* InRetargeter);

    UPROPERTY(Transient)
    TObjectPtr<USkeletalMeshComponent> Source;

    UPROPERTY(Transient)
    TObjectPtr<UIKRetargeter> Retargeter;

protected:
    virtual FAnimInstanceProxy* CreateAnimInstanceProxy() override { return new FHWRetargetAnimInstanceProxy(this); }
};
