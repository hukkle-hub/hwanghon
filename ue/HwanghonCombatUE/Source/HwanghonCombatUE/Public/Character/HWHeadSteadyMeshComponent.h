#pragma once

#include "CoreMinimal.h"
#include "Components/SkeletalMeshComponent.h"
#include "HWHeadSteadyMeshComponent.generated.h"

// Director review 2026-09-29: "the character's neck is bent down". Measured (neckprobe): idle keeps the head within
// 3-10 deg of upright, but the Paragon attack clips lunge the upper body so the head drops 42-45 deg toward the
// ground at the start of the swing. The torso's lunge stays; the head (neck_01 and everything under it) is turned
// back so it never leans more than MaxHeadLeanDeg from upright - the eyes stay on the fight.
// Applied on the finished pose, before it is handed to the renderer; the pack's AnimBP is untouched.
UCLASS(ClassGroup=(Rendering), meta=(BlueprintSpawnableComponent))
class HWANGHONCOMBATUE_API UHWHeadSteadyMeshComponent : public USkeletalMeshComponent
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, Category="Hwanghon|Pose") bool bSteadyHead = true;
    UPROPERTY(EditAnywhere, Category="Hwanghon|Pose") float MaxHeadLeanDeg = 15.f;
    UPROPERTY(EditAnywhere, Category="Hwanghon|Pose") FName NeckBone = TEXT("neck_01");
    UPROPERTY(EditAnywhere, Category="Hwanghon|Pose") FName HeadBone = TEXT("head");

    // Last correction applied (deg), for QA.
    float GetLastCorrectionDeg() const { return LastCorrectionDeg; }

    virtual void FinalizeBoneTransform() override;

private:
    void SteadyHead();
    const USkeletalMesh* CachedFor = nullptr;
    int32 NeckIndex = INDEX_NONE;
    int32 HeadIndex = INDEX_NONE;
    TArray<int32> Subtree;
    float LastCorrectionDeg = 0.f;
};
