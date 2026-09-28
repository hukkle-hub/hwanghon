#include "Animation/HWCharacterVisualSettings.h"

#include "Animation/AnimInstance.h"
#include "Animation/HWAnimationSetAsset.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "Misc/App.h"

const FHWCharacterVisual* UHWCharacterVisualSettings::Find(FName CharacterId) const
{
    return Characters.FindByPredicate([CharacterId](const FHWCharacterVisual& V) { return V.Id == CharacterId; });
}

UHWAnimationSetAsset* UHWCharacterVisualSettings::ApplyTo(
    FName CharacterId,
    USkeletalMeshComponent* Mesh,
    float CapsuleHalfHeight)
{
    // Nothing is drawn (-nullrhi automation, headless QA, servers): skip the pack AnimBP entirely.
    if (!FApp::CanEverRender())
    {
        return nullptr;
    }
    const FHWCharacterVisual* Visual = GetDefault<UHWCharacterVisualSettings>()->Find(CharacterId);
    if (!Visual || !Mesh)
    {
        return nullptr;
    }
    USkeletalMesh* Body = Visual->Mesh.LoadSynchronous();
    UClass* AnimClass = Visual->AnimClass.LoadSynchronous();
    if (!Body)
    {
        UE_LOG(LogTemp, Warning, TEXT("Hwanghon visual: body for %s not found (%s); run Scripts/ue_graybox_anim_setup.py"),
            *CharacterId.ToString(), *Visual->Mesh.ToString());
        return nullptr;
    }
    Mesh->SetSkeletalMeshAsset(Body);
    Mesh->SetRelativeLocationAndRotation(
        FVector(Visual->MeshOffset.X, Visual->MeshOffset.Y, CapsuleHalfHeight > 0.f ? -CapsuleHalfHeight : Visual->MeshOffset.Z),
        FRotator(0.f, Visual->MeshYaw, 0.f));
    Mesh->SetRelativeScale3D(FVector(FMath::Max(0.01f, Visual->MeshScale)));
    if (AnimClass)
    {
        Mesh->SetAnimationMode(EAnimationMode::AnimationBlueprint);
        Mesh->SetAnimInstanceClass(AnimClass);
    }
    Mesh->SetVisibility(true, true);
    return Visual->AnimationSet.LoadSynchronous();
}
