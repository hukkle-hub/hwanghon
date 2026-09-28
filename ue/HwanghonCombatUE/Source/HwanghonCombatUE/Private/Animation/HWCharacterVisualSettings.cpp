#include "Animation/HWCharacterVisualSettings.h"

#include "Animation/AnimInstance.h"
#include "Animation/HWAnimationSetAsset.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "Misc/App.h"

bool UHWCharacterVisualSettings::SetRagdoll(USkeletalMeshComponent* Mesh, bool bOn, FTransform& SavedRelative)
{
    if (!Mesh || !Mesh->GetPhysicsAsset() || !FApp::CanEverRender())
    {
        return false;
    }
    if (bOn)
    {
        if (Mesh->IsSimulatingPhysics()) return true;
        SavedRelative = Mesh->GetRelativeTransform();
        // The capsule must not push the limp body (the local pawn's capsule flipped it over).
        if (UPrimitiveComponent* Capsule = Mesh->GetOwner() ? Cast<UPrimitiveComponent>(Mesh->GetOwner()->GetRootComponent()) : nullptr)
        {
            if (Capsule != Mesh) Capsule->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
        }
        Mesh->SetCollisionProfileName(TEXT("Ragdoll"));
        Mesh->SetCollisionResponseToChannel(ECC_Pawn, ECR_Ignore);          // the capsule stays; do not shove it
        Mesh->SetCollisionResponseToChannel(ECC_PhysicsBody, ECR_Ignore);   // downed players never pile up on each other
        Mesh->SetAllBodiesSimulatePhysics(true);
        // Settle on the floor instead of tumbling (measured: an undamped body flipped onto its head).
        for (FBodyInstance* Body : Mesh->Bodies)
        {
            if (!Body) continue;
            Body->LinearDamping = 0.8f;
            Body->AngularDamping = 2.5f;
            Body->UpdateDampingProperties();
        }
        Mesh->SetSimulatePhysics(true);
        // Start at rest: kinematic bodies carry the last animated frame delta as velocity (a pose snap threw
        // bodies 7-13 m up, doc 130 §2).
        Mesh->SetAllPhysicsLinearVelocity(FVector::ZeroVector);
        Mesh->SetAllPhysicsAngularVelocityInDegrees(FVector::ZeroVector);
        Mesh->WakeAllRigidBodies();
        return true;
    }
    if (!Mesh->IsSimulatingPhysics()) return true;
    Mesh->SetSimulatePhysics(false);
    Mesh->SetAllBodiesSimulatePhysics(false);
    Mesh->SetCollisionProfileName(TEXT("CharacterMesh"));
    if (AActor* Owner = Mesh->GetOwner())
    {
        USceneComponent* Root = Owner->GetRootComponent();
        if (Root && Root != Mesh)
        {
            Mesh->AttachToComponent(Root, FAttachmentTransformRules::KeepWorldTransform);
        }
    }
    Mesh->SetRelativeTransform(SavedRelative);
    if (UPrimitiveComponent* Capsule = Mesh->GetOwner() ? Cast<UPrimitiveComponent>(Mesh->GetOwner()->GetRootComponent()) : nullptr)
    {
        if (Capsule != Mesh) Capsule->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    }
    return true;
}

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
