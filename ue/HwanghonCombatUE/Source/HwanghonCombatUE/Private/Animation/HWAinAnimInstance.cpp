#include "Animation/HWAinAnimInstance.h"

#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Camera/HWLockOnComponent.h"
#include "GameFramework/CharacterMovementComponent.h"

void UHWAinAnimInstance::NativeInitializeAnimation()
{
    Super::NativeInitializeAnimation();
    AinOwner = Cast<AHWAinCharacter>(TryGetPawnOwner());
}

void UHWAinAnimInstance::NativeUpdateAnimation(float DeltaSeconds)
{
    Super::NativeUpdateAnimation(DeltaSeconds);

    if (!AinOwner)
    {
        AinOwner = Cast<AHWAinCharacter>(TryGetPawnOwner());
    }

    if (!AinOwner)
    {
        return;
    }

    const FVector Velocity = AinOwner->GetVelocity();
    GroundSpeed = FVector(Velocity.X, Velocity.Y, 0.f).Size();
    bInAir = AinOwner->GetCharacterMovement()->IsFalling();
    bLockedOn = AinOwner->GetLockOn() && AinOwner->GetLockOn()->IsLocked();

    const FVector LocalVelocity = AinOwner->GetActorTransform().InverseTransformVectorNoScale(Velocity);
    Direction = FMath::RadiansToDegrees(FMath::Atan2(LocalVelocity.Y, LocalVelocity.X));

    if (UHWCombatComponent* Combat = AinOwner->GetCombat())
    {
        Action = Combat->GetCurrentAction();
        ActionPhase = Combat->GetActionNormalized();

        bAttackAction = Action == EHWActionType::Attack1
            || Action == EHWActionType::Attack2
            || Action == EHWActionType::Attack3
            || Action == EHWActionType::Smash;

        ComboIndex =
            Action == EHWActionType::Attack1 ? 1 :
            Action == EHWActionType::Attack2 ? 2 :
            Action == EHWActionType::Attack3 ? 3 : 0;

        // Presentation-only flag for AnimBP additive compression / hit pose.
        // Combat timing stays in UHWCombatComponent.
        bContactWindow = bAttackAction && ActionPhase >= 0.30f && ActionPhase <= 0.48f;
    }
    else
    {
        Action = EHWActionType::None;
        ActionPhase = 0.f;
        bAttackAction = false;
        ComboIndex = 0;
        bContactWindow = false;
    }
}
