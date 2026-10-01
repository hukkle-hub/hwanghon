#include "Animation/HWCharacterVisualSettings.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"

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
    else
    {
        // No AnimBP for this body: its presentation drives single-node clips directly.
        Mesh->SetAnimationMode(EAnimationMode::AnimationSingleNode);
    }
    Mesh->SetVisibility(true, true);
    ApplyWeapons(*Visual, Mesh);
    return Visual->AnimationSet.LoadSynchronous();
}

void UHWCharacterVisualSettings::ApplyWeapons(const FHWCharacterVisual& Visual, USkeletalMeshComponent* Mesh)
{
    if (!Mesh || (Visual.WeaponR.IsNull() && Visual.WeaponL.IsNull())) return;
    AActor* Owner = Mesh->GetOwner();
    // the Countess body carries its twin blades on weapon_r / weapon_l: hidden, our weapon takes the hand
    const FName Bones[2] = { TEXT("weapon_r"), TEXT("weapon_l") };
    const TSoftObjectPtr<UStaticMesh>* Weapons[2] = { &Visual.WeaponR, &Visual.WeaponL };
    const float Grips[2] = { Visual.GripR, Visual.GripL };
    for (int32 Side = 0; Side < 2; ++Side)
    {
        if (Mesh->GetBoneIndex(Bones[Side]) == INDEX_NONE) continue;
        Mesh->HideBoneByName(Bones[Side], PBO_None);
        UStaticMesh* W = Weapons[Side]->LoadSynchronous();
        const FName Name(Side == 0 ? TEXT("HWWeaponR") : TEXT("HWWeaponL"));
        UStaticMeshComponent* C = nullptr;
        for (USceneComponent* Child : Mesh->GetAttachChildren())
        {
            if (Child && Child->GetFName() == Name) C = Cast<UStaticMeshComponent>(Child);
        }
        if (!W)
        {
            if (C) C->SetStaticMesh(nullptr);
            continue;
        }
        if (!C)
        {
            C = NewObject<UStaticMeshComponent>(Owner ? static_cast<UObject*>(Owner) : static_cast<UObject*>(Mesh), Name);
            C->SetupAttachment(Mesh, Bones[Side]);
            C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
            C->SetGenerateOverlapEvents(false);
            C->RegisterComponent();
        }
        C->SetStaticMesh(W);
        // a hidden bone has zero scale and so would its children: hang the weapon on the parent (the hand) with
        // weapon_r's reference offset instead
        // always the hand: on some skins weapon_r hangs off an IK bone that the motion never moves (Kain's sword
        // floated a metre off). The offset is weapon_r relative to the hand in the reference pose.
        const FReferenceSkeleton& Ref = Mesh->GetSkeletalMeshAsset()->GetRefSkeleton();
        auto ComponentSpace = [&Ref](int32 Idx)
        {
            FTransform T = FTransform::Identity;
            for (; Idx != INDEX_NONE; Idx = Ref.GetParentIndex(Idx)) T = T * Ref.GetRefBonePose()[Idx];
            return T;
        };
        const FName Hand(Side == 0 ? TEXT("hand_r") : TEXT("hand_l"));
        const int32 BoneIdx = Ref.FindBoneIndex(Bones[Side]);
        const int32 HandIdx = Ref.FindBoneIndex(Hand);
        const FName Parent = HandIdx != INDEX_NONE ? Hand : Bones[Side];
        const FTransform BoneLocal = (BoneIdx != INDEX_NONE && HandIdx != INDEX_NONE)
            ? ComponentSpace(BoneIdx).GetRelativeTransform(ComponentSpace(HandIdx)) : FTransform::Identity;
        C->AttachToComponent(Mesh, FAttachmentTransformRules::SnapToTargetNotIncludingScale, Parent);
        // the blades run along -Y of weapon_r and +Y of weapon_l (FX_WeaponTip_R/L): the mesh's +Z goes there,
        // turned about that axis by Twist, and slid so the grip sits in the hand
        // (the rotation is found, not assumed: a roll of +90 sent the grip the wrong way and Kain's sword hung
        // 1.4 m off the hand, the hand closing past the blade's tip)
        const FVector Axis = Side == 0 ? FVector(0.f, -1.f, 0.f) : FVector(0.f, 1.f, 0.f);
        const FQuat Q = FQuat(Axis, FMath::DegreesToRadians(Visual.WeaponTwist)) * FQuat::FindBetweenNormals(FVector::UpVector, Axis);
        const float S = FMath::Max(0.01f, Visual.WeaponScale);
        const FTransform InBone(Q, -Q.RotateVector(FVector(0.f, 0.f, Grips[Side] * S)), FVector(S));
        C->SetRelativeTransform(InBone * FTransform(BoneLocal.GetRotation(), BoneLocal.GetLocation()));
    }
}
