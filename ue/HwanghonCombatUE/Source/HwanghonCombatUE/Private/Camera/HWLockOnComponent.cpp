#include "Camera/HWLockOnComponent.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/Controller.h"
#include "Kismet/GameplayStatics.h"

UHWLockOnComponent::UHWLockOnComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UHWLockOnComponent::BeginPlay()
{
    Super::BeginPlay();
}

void UHWLockOnComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    AActor* CurrentTarget = GetTarget();
    if (!CurrentTarget)
    {
        ClearTarget();
        return;
    }

    APawn* Pawn = Cast<APawn>(GetOwner());
    if (!Pawn || !Pawn->GetController())
    {
        return;
    }

    const FVector From = Pawn->GetActorLocation();
    const FVector To = CurrentTarget->GetActorLocation();
    FRotator Desired = (To - From).Rotation();
    Desired.Pitch = FMath::Clamp(Desired.Pitch, -25.f, 25.f);
    Desired.Roll = 0.f;

    const FRotator Current = Pawn->GetController()->GetControlRotation();

    // Overlap (boss lunge passing through the player): the direction to the target is unstable, so keep the current yaw.
    if (FVector::Dist2D(From, To) < OverlapHoldDistanceCm)
    {
        Desired.Yaw = Current.Yaw;
    }

    FRotator Next = FMath::RInterpTo(Current, Desired, DeltaTime, RotationSpeed);

    // Cap yaw speed so a target that ends up behind us is followed smoothly instead of snapping 180 deg.
    const float MaxStep = MaxYawRateDegPerSec * DeltaTime;
    const float YawStep = FMath::FindDeltaAngleDegrees(Current.Yaw, Next.Yaw);
    Next.Yaw = Current.Yaw + FMath::Clamp(YawStep, -MaxStep, MaxStep);

    Pawn->GetController()->SetControlRotation(Next);
}

void UHWLockOnComponent::ToggleLockOn()
{
    if (IsLocked())
    {
        ClearTarget();
        return;
    }

    Target = FindBestTarget();
}

void UHWLockOnComponent::ClearTarget()
{
    Target.Reset();
}

AActor* UHWLockOnComponent::GetTarget() const
{
    AActor* Candidate = Target.Get();
    return Candidate && !Candidate->IsActorBeingDestroyed() && Candidate->ActorHasTag(TEXT("LockOnTarget"))
        ? Candidate : nullptr;
}

bool UHWLockOnComponent::IsLocked() const
{
    return GetTarget() != nullptr;
}

AActor* UHWLockOnComponent::FindBestTarget() const
{
    TArray<AActor*> Candidates;
    UGameplayStatics::GetAllActorsWithTag(GetWorld(), TEXT("LockOnTarget"), Candidates);

    AActor* Best = nullptr;
    float BestDistSq = SearchRadius * SearchRadius;
    const FVector Origin = GetOwner()->GetActorLocation();

    for (AActor* Candidate : Candidates)
    {
        if (!IsValid(Candidate) || Candidate->IsActorBeingDestroyed() || Candidate == GetOwner())
        {
            continue;
        }

        const float DistSq = FVector::DistSquared2D(Origin, Candidate->GetActorLocation());
        if (DistSq < BestDistSq)
        {
            Best = Candidate;
            BestDistSq = DistSq;
        }
    }

    return Best;
}
