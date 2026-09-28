#include "Character/HWHeadSteadyMeshComponent.h"

#include "Engine/SkeletalMesh.h"
#include "GameFramework/Actor.h"

void UHWHeadSteadyMeshComponent::FinalizeBoneTransform()
{
    if (bSteadyHead)
    {
        SteadyHead();
    }
    Super::FinalizeBoneTransform();
}

void UHWHeadSteadyMeshComponent::SteadyHead()
{
    LastCorrectionDeg = 0.f;
    const USkeletalMesh* Mesh = GetSkeletalMeshAsset();
    AActor* Owner = GetOwner();
    if (!Mesh || !Owner) return;
    if (CachedFor != Mesh)
    {
        CachedFor = Mesh;
        const FReferenceSkeleton& Ref = Mesh->GetRefSkeleton();
        NeckIndex = Ref.FindBoneIndex(NeckBone);
        HeadIndex = Ref.FindBoneIndex(HeadBone);
        Subtree.Reset();
        if (NeckIndex != INDEX_NONE)
        {
            for (int32 I = 0; I < Ref.GetNum(); ++I)
            {
                for (int32 P = I; P != INDEX_NONE; P = Ref.GetParentIndex(P))
                {
                    if (P == NeckIndex) { Subtree.Add(I); break; }
                }
            }
        }
    }
    TArray<FTransform>& Space = GetEditableComponentSpaceTransforms();
    if (NeckIndex == INDEX_NONE || HeadIndex == INDEX_NONE || !Space.IsValidIndex(HeadIndex)) return;

    // Upright and forward, in component space.
    const FTransform& ToWorld = GetComponentTransform();
    const FVector Up = ToWorld.InverseTransformVectorNoScale(FVector::UpVector).GetSafeNormal();
    const FVector Fwd = ToWorld.InverseTransformVectorNoScale(Owner->GetActorForwardVector()).GetSafeNormal();
    const FVector Pivot = Space[NeckIndex].GetLocation();
    const FVector NeckToHead = (Space[HeadIndex].GetLocation() - Pivot).GetSafeNormal();
    const float Lean = FMath::RadiansToDegrees(FMath::Atan2(FVector::DotProduct(NeckToHead, Fwd), FVector::DotProduct(NeckToHead, Up)));
    if (Lean <= MaxHeadLeanDeg) return;

    // Turn the head back in the plane of up and forward, about the neck: from where it points to MaxHeadLeanDeg.
    const FVector InPlane = (Up * FVector::DotProduct(NeckToHead, Up) + Fwd * FVector::DotProduct(NeckToHead, Fwd)).GetSafeNormal();
    const float Max = FMath::DegreesToRadians(MaxHeadLeanDeg);
    const FVector Target = (Up * FMath::Cos(Max) + Fwd * FMath::Sin(Max)).GetSafeNormal();
    if (InPlane.IsNearlyZero()) return;
    const FQuat R = FQuat::FindBetweenNormals(InPlane, Target);
    const float Back = Lean - MaxHeadLeanDeg;
    for (int32 I : Subtree)
    {
        if (!Space.IsValidIndex(I)) continue;
        FTransform& T = Space[I];
        T.SetLocation(Pivot + R.RotateVector(T.GetLocation() - Pivot));
        T.SetRotation((R * T.GetRotation()).GetNormalized());
    }
    LastCorrectionDeg = Back;
}
