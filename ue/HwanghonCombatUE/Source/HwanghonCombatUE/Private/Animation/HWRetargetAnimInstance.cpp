#include "Animation/HWRetargetAnimInstance.h"

#include "Animation/AnimNodeBase.h"
#include "Components/SkeletalMeshComponent.h"
#include "Retargeter/IKRetargeter.h"

void UHWRetargetAnimInstance::SetSource(USkeletalMeshComponent* InSource, UIKRetargeter* InRetargeter)
{
    Source = InSource;
    Retargeter = InRetargeter;
}

void FHWRetargetAnimInstanceProxy::PreUpdate(UAnimInstance* InAnimInstance, float DeltaSeconds)
{
    FAnimInstanceProxy::PreUpdate(InAnimInstance, DeltaSeconds);
    const UHWRetargetAnimInstance* Owner = Cast<UHWRetargetAnimInstance>(InAnimInstance);
    if (!Owner) return;
    Node.RetargetFrom = ERetargetSourceMode::CustomSkeletalMeshComponent;
    Node.SourceMeshComponent = Owner->Source;
    Node.IKRetargeterAsset = Owner->Retargeter;
    // the source pose is copied on the game thread here (the node's own PreUpdate)
    Node.PreUpdate(InAnimInstance);
}

void FHWRetargetAnimInstanceProxy::Update(float DeltaSeconds)
{
    FAnimInstanceProxy::Update(DeltaSeconds);
    if (!bNodeReady)
    {
        FAnimationInitializeContext Init(this);
        Node.Initialize_AnyThread(Init);
        FAnimationCacheBonesContext Cache(this);
        Node.CacheBones_AnyThread(Cache);
        bNodeReady = true;
    }
    FAnimationUpdateContext Ctx(this, DeltaSeconds);
    Node.Update_AnyThread(Ctx);
}

void FHWRetargetAnimInstanceProxy::CacheBones()
{
    FAnimInstanceProxy::CacheBones();
    if (bNodeReady)
    {
        FAnimationCacheBonesContext Cache(this);
        Node.CacheBones_AnyThread(Cache);
    }
}

bool FHWRetargetAnimInstanceProxy::Evaluate(FPoseContext& Output)
{
    if (!bNodeReady)
    {
        Output.ResetToRefPose();
        return true;
    }
    Node.Evaluate_AnyThread(Output);
    return true;
}
