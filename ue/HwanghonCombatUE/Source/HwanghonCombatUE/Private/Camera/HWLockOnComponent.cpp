#include "Camera/HWLockOnComponent.h"
#include "Character/HWAinCharacter.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/Controller.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "EngineUtils.h"
#include "Boss/HWBossCharacter.h"
#include "System/HWBossPartTarget.h"

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

    // Assist, not a leash (docs/design/165; director: the camera turns up and down too, like Blade & Soul): while
    // the player turns the view the lock-on waits; then it brings the yaw round, and moves the pitch only when the
    // target has left the vertical view.
    const AHWAinCharacter* Ain = Cast<AHWAinCharacter>(Pawn);
    if (Ain && Ain->SecondsSinceManualLook() < ManualLookGraceSeconds)
    {
        return;
    }
    const FVector From = Pawn->GetActorLocation();
    const FVector To = CurrentTarget->GetActorLocation();
    const FRotator Current = Pawn->GetController()->GetControlRotation();
    FRotator Desired = (To - From).Rotation();
    // Pitch: keep the whole body between the top and bottom of the screen (QA: the misses were feet below the frame -
    // the camera looked up at the capsule centre). Project the body's top and bottom and nudge only when one leaves.
    float PitchNow = FRotator::NormalizeAxis(Current.Pitch);
    float Nudge = 0.f;
    if (APlayerController* PC = Cast<APlayerController>(Pawn->GetController()))
    {
        FVector O, E;
        CurrentTarget->GetActorBounds(true, O, E);
        int32 W = 0, H = 0;
        PC->GetViewportSize(W, H);
        FVector2D Top, Bottom;
        const bool bTop = PC->ProjectWorldLocationToScreen(O + FVector(0, 0, E.Z), Top, true);
        const bool bBottom = PC->ProjectWorldLocationToScreen(O - FVector(0, 0, E.Z), Bottom, true);
        if (H > 0 && bBottom && Bottom.Y > H * FrameBottom)
        {
            Nudge = -FMath::Min(20.f, (Bottom.Y / H - FrameBottom) * 60.f);   // look down
        }
        else if (H > 0 && bTop && Top.Y < H * FrameTop)
        {
            Nudge = FMath::Min(20.f, (FrameTop - Top.Y / H) * 60.f);          // look up
        }
    }
    Desired.Pitch = FMath::Clamp(PitchNow + Nudge, -60.f, 45.f);
    Desired.Roll = 0.f;

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

    // A fresh lock prefers a body/enemy; boss parts are reached with CycleTarget and are only
    // chosen here when nothing else is in range.
    AActor* Best = nullptr;
    AActor* BestPart = nullptr;
    float BestDistSq = SearchRadius * SearchRadius;
    float BestPartDistSq = BestDistSq;
    const FVector Origin = GetOwner()->GetActorLocation();

    for (AActor* Candidate : Candidates)
    {
        if (!IsValid(Candidate) || Candidate->IsActorBeingDestroyed() || Candidate == GetOwner())
        {
            continue;
        }

        if (Candidate->IsA<AHWBossPartTarget>())
        {
            const float PartDistSq = FVector::DistSquared2D(Origin, Candidate->GetActorLocation());
            if (PartDistSq < BestPartDistSq)
            {
                BestPart = Candidate;
                BestPartDistSq = PartDistSq;
            }
            continue;
        }

        const float DistSq = FVector::DistSquared2D(Origin, Candidate->GetActorLocation());
        if (DistSq < BestDistSq)
        {
            Best = Candidate;
            BestDistSq = DistSq;
        }
    }

    return Best ? Best : BestPart;
}

void UHWLockOnComponent::CycleTarget()
{
    AActor* Current = GetTarget();
    if (!Current)
    {
        Target = FindBestTarget();
        return;
    }
    AActor* BossActor = Current;
    if (const AHWBossPartTarget* Part = Cast<AHWBossPartTarget>(Current))
    {
        BossActor = Part->GetBoss();
    }
    TArray<AActor*> Ring;
    if (IsValid(BossActor) && BossActor->ActorHasTag(TEXT("LockOnTarget")))
    {
        Ring.Add(BossActor);
    }
    TArray<AHWBossPartTarget*> Parts;
    for (TActorIterator<AHWBossPartTarget> It(GetWorld()); It; ++It)
    {
        if (It->GetBoss() == BossActor && It->ActorHasTag(TEXT("LockOnTarget")) && !It->IsActorBeingDestroyed())
        {
            Parts.Add(*It);
        }
    }
    Parts.Sort([](const AHWBossPartTarget& A, const AHWBossPartTarget& B) { return A.GetPartId().LexicalLess(B.GetPartId()); });
    for (AHWBossPartTarget* Part : Parts)
    {
        Ring.Add(Part);
    }
    if (Ring.Num() == 0)
    {
        return;
    }
    const int32 Index = Ring.IndexOfByKey(Current);
    Target = Ring[(Index + 1) % Ring.Num()];
}
