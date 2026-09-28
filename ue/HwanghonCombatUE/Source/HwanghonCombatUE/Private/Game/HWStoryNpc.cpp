#include "Game/HWStoryNpc.h"

#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "GameFramework/CharacterMovementComponent.h"

AHWStoryNpc::AHWStoryNpc()
{
    GetCharacterMovement()->bOrientRotationToMovement = true;
    GetCharacterMovement()->MaxWalkSpeed = 330.f;
    bUseControllerRotationYaw = false;
    GetCapsuleComponent()->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);
    GetMesh()->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);
    static ConstructorHelpers::FObjectFinder<USkeletalMesh> Body(TEXT("/Game/Characters/Mannequins/Meshes/SKM_Manny_Simple.SKM_Manny_Simple"));
    static ConstructorHelpers::FClassFinder<UAnimInstance> Anim(TEXT("/Game/Characters/Mannequins/Anims/Unarmed/ABP_Unarmed"));
    if (Body.Succeeded())
    {
        GetMesh()->SetSkeletalMeshAsset(Body.Object);
        GetMesh()->SetRelativeLocationAndRotation(FVector(0.f, 0.f, -90.f), FRotator(0.f, -90.f, 0.f));
    }
    if (Anim.Succeeded())
    {
        GetMesh()->SetAnimInstanceClass(Anim.Class);
    }
    AutoPossessAI = EAutoPossessAI::PlacedInWorldOrSpawned;
}

void AHWStoryNpc::WalkToward(const FVector& Goal, float AcceptCm)
{
    const FVector Delta = Goal - GetActorLocation();
    if (Delta.Size2D() > AcceptCm)
    {
        AddMovementInput(Delta.GetSafeNormal2D(), FMath::Clamp(Delta.Size2D() / 120.f, 0.35f, 1.f));
    }
}

bool AHWStoryNpc::IsNear(const FVector& Goal, float AcceptCm) const
{
    return FVector::Dist2D(GetActorLocation(), Goal) <= AcceptCm;
}
