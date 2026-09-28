#include "System/HWCoopLifeComponent.h"

#include "System/HWCoopCombatSubsystem.h"
#include "System/HWDungeonDirector.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Kismet/GameplayStatics.h"

UHWCoopLifeComponent::UHWCoopLifeComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UHWCoopLifeComponent::BeginPlay()
{
    Super::BeginPlay();

    OwnerCharacter = Cast<AHWAinCharacter>(GetOwner());
    Combat = OwnerCharacter ? OwnerCharacter->GetCombat() : nullptr;

    if (Combat)
    {
        Combat->OnDied.AddDynamic(this, &UHWCoopLifeComponent::HandleDied);
    }
}

void UHWCoopLifeComponent::TickComponent(
    float DeltaTime,
    ELevelTick TickType,
    FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    if (!bDowned || bFullyDefeated) return;

    BleedoutRemaining = FMath::Max(0.f, BleedoutRemaining - DeltaTime);
    if (BleedoutRemaining <= 0.f)
    {
        CommitFullDefeat();
        return;
    }

    AHWAinCharacter* Reviver = ActiveReviver.Get();
    if (!Reviver || !OwnerCharacter)
    {
        ReviveElapsed = 0.f;
        return;
    }

    UHWCombatComponent* ReviverCombat = Reviver->GetCombat();
    if (!ReviverCombat || ReviverCombat->IsDead()
        || FVector::DistSquared2D(Reviver->GetActorLocation(), OwnerCharacter->GetActorLocation())
            > FMath::Square(ReviveRangeCm))
    {
        CancelRevive();
        return;
    }

    ReviveElapsed += DeltaTime;
    if (ReviveElapsed >= ReviveDuration)
    {
        CompleteRevive();
    }
}

void UHWCoopLifeComponent::HandleDied()
{
    if (bFullyDefeated || !OwnerCharacter) return;

    UHWCoopCombatSubsystem* Coop =
        GetWorld() ? GetWorld()->GetSubsystem<UHWCoopCombatSubsystem>() : nullptr;

    if (!Coop || Coop->GetPartySize() <= 1)
    {
        CommitFullDefeat();
        return;
    }

    bDowned = true;
    BleedoutRemaining = BleedoutDuration;
    ReviveElapsed = 0.f;
    ActiveReviver.Reset();
    OnDowned.Broadcast(BleedoutRemaining);

    if (Coop->GetAliveCount() <= 0)
    {
        if (AHWDungeonDirector* Director = Cast<AHWDungeonDirector>(
            UGameplayStatics::GetActorOfClass(this, AHWDungeonDirector::StaticClass())))
        {
            Director->ReportPartyWipe();
        }
    }
}

bool UHWCoopLifeComponent::StartRevive(AHWAinCharacter* Reviver)
{
    if (!bDowned || bFullyDefeated || !IsValid(Reviver) || Reviver == OwnerCharacter)
        return false;

    UHWCombatComponent* ReviverCombat = Reviver->GetCombat();
    if (!ReviverCombat || ReviverCombat->IsDead()) return false;

    if (FVector::DistSquared2D(Reviver->GetActorLocation(), OwnerCharacter->GetActorLocation())
        > FMath::Square(ReviveRangeCm))
        return false;

    ActiveReviver = Reviver;
    ReviveElapsed = 0.f;
    return true;
}

void UHWCoopLifeComponent::CancelRevive()
{
    ActiveReviver.Reset();
    ReviveElapsed = 0.f;
}

float UHWCoopLifeComponent::GetReviveProgress() const
{
    return ReviveDuration > 0.f
        ? FMath::Clamp(ReviveElapsed / ReviveDuration, 0.f, 1.f)
        : 0.f;
}

void UHWCoopLifeComponent::ResetForRetry()
{
    bDowned = false;
    bFullyDefeated = false;
    BleedoutRemaining = 0.f;
    ActiveReviver.Reset();
    ReviveElapsed = 0.f;
}

void UHWCoopLifeComponent::CompleteRevive()
{
    if (!Combat) return;

    bDowned = false;
    bFullyDefeated = false;
    BleedoutRemaining = 0.f;
    ActiveReviver.Reset();
    ReviveElapsed = 0.f;

    Combat->Revive(0.30f);
    OnRevived.Broadcast();
}

void UHWCoopLifeComponent::CommitFullDefeat()
{
    if (bFullyDefeated) return;

    bDowned = false;
    bFullyDefeated = true;
    BleedoutRemaining = 0.f;
    ActiveReviver.Reset();
    ReviveElapsed = 0.f;
    OnFullyDefeated.Broadcast();
}
