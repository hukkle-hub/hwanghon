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

    APawn* Pawn = Cast<APawn>(GetOwner());
    if (!Pawn || !Pawn->GetController() || !Target.IsValid())
    {
        return;
    }

    const FVector From = Pawn->GetActorLocation();
    const FVector To = Target->GetActorLocation();
    FRotator Desired = (To - From).Rotation();
    Desired.Pitch = FMath::Clamp(Desired.Pitch, -25.f, 25.f);
    Desired.Roll = 0.f;

    const FRotator Current = Pawn->GetController()->GetControlRotation();
    Pawn->GetController()->SetControlRotation(FMath::RInterpTo(Current, Desired, DeltaTime, RotationSpeed));
}

void UHWLockOnComponent::ToggleLockOn()
{
    if (Target.IsValid())
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

AActor* UHWLockOnComponent::FindBestTarget() const
{
    TArray<AActor*> Candidates;
    UGameplayStatics::GetAllActorsWithTag(GetWorld(), TEXT("LockOnTarget"), Candidates);

    AActor* Best = nullptr;
    float BestDistSq = SearchRadius * SearchRadius;
    const FVector Origin = GetOwner()->GetActorLocation();

    for (AActor* Candidate : Candidates)
    {
        if (!IsValid(Candidate) || Candidate == GetOwner())
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
