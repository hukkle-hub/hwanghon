#include "System/HWBossSystemComponent.h"

#include "Boss/HWBossCharacter.h"
#include "System/HWCoopCombatSubsystem.h"
#include "System/HWBossPartTarget.h"
#include "System/HWDungeonDirector.h"
#include "Kismet/GameplayStatics.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Engine/World.h"

UHWBossSystemComponent::UHWBossSystemComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UHWBossSystemComponent::BeginPlay()
{
    Super::BeginPlay();
    Boss = Cast<AHWBossCharacter>(GetOwner());
    if (Boss)
    {
        Boss->OnBossDied.AddDynamic(
            this,
            &UHWBossSystemComponent::HandleBossDied);
    }
}

void UHWBossSystemComponent::InitializeBoss(float BaseMaxHealth)
{
    if (!Boss || bInitialized) return;

    float HealthScale = 1.f;
    float PostureScale = 1.f;

    if (UWorld* World = GetWorld())
    {
        if (UHWCoopCombatSubsystem* Coop = World->GetSubsystem<UHWCoopCombatSubsystem>())
        {
            HealthScale = Coop->BossHealthScale();
            PostureScale = Coop->BossPostureScale();
        }

        if (AHWDungeonDirector* Dungeon = Cast<AHWDungeonDirector>(
            UGameplayStatics::GetActorOfClass(this, AHWDungeonDirector::StaticClass())))
        {
            HealthScale *= Dungeon->GetDifficultyHealthScale();
            PostureScale *= FMath::Sqrt(Dungeon->GetDifficultyHealthScale());
            DifficultyDamageScale = Dungeon->GetDifficultyDamageScale();
        }
    }

    InitialMaxHealth = FMath::Max(1.f, BaseMaxHealth * HealthScale);
    MaxPosture = 100.f * PostureScale;
    Posture = 0.f;
    Phase = 1;
    BreakCount = 0;
    CombatElapsed = 0.f;
    bEnraged = false;

    Parts.Reset();

    auto AddPart = [this, PostureScale](const TCHAR* Id, float Health)
    {
        FHWBossPartRuntime Part;
        Part.Id = Id;
        Part.MaxHealth = Health * PostureScale;
        Part.Health = Part.MaxHealth;
        Parts.Add(Part);
    };

    AddPart(TEXT("head"), 90.f);
    AddPart(TEXT("armor"), 135.f);
    AddPart(TEXT("limb"), 115.f);

    if (GetWorld())
    {
        struct FSpawnPart { const TCHAR* Id; FVector Offset; };
        const FSpawnPart SpawnParts[] =
        {
            { TEXT("head"), FVector(0.f, 0.f, 155.f) },
            { TEXT("armor"), FVector(0.f, 0.f, 85.f) },
            { TEXT("limb"), FVector(20.f, 55.f, 25.f) }
        };

        for (const FSpawnPart& Spawn : SpawnParts)
        {
            if (AHWBossPartTarget* Target = GetWorld()->SpawnActor<AHWBossPartTarget>(
                AHWBossPartTarget::StaticClass(),
                Boss->GetActorLocation(),
                Boss->GetActorRotation()))
            {
                Target->ConfigurePart(Boss, Spawn.Id, Spawn.Offset);
                PartTargets.Add(Target);
            }
        }
    }

    Boss->ConfigureSystemHealth(InitialMaxHealth);
    bInitialized = true;
}

void UHWBossSystemComponent::TickComponent(
    float DeltaTime,
    ELevelTick TickType,
    FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    if (!bInitialized || !Boss || Boss->IsDead()) return;

    CombatElapsed += DeltaTime;
    UpdatePhase();

    if (!bEnraged && CombatElapsed >= EnrageSeconds)
    {
        bEnraged = true;
        OnEnraged.Broadcast();
    }
}

void UHWBossSystemComponent::NotifyHit(
    float Damage,
    EHWAttackTier Tier,
    FVector SourceLocation)
{
    if (!bInitialized || !Boss || Boss->IsDead()) return;

    UpdatePhase();
    AddPosture(TierPosture(Tier), SourceLocation);
}

void UHWBossSystemComponent::AddExternalPosture(
    float Amount,
    FVector SourceLocation)
{
    AddPosture(FMath::Max(0.f, Amount), SourceLocation);
}

float UHWBossSystemComponent::TierPosture(EHWAttackTier Tier) const
{
    switch (Tier)
    {
        case EHWAttackTier::Light: return 6.f;
        case EHWAttackTier::Finisher: return 12.f;
        case EHWAttackTier::Smash: return 18.f;
        case EHWAttackTier::Counter: return 28.f;
        case EHWAttackTier::Stagger: return 22.f;
        case EHWAttackTier::Break: return 0.f;
        default: return 6.f;
    }
}

void UHWBossSystemComponent::AddPosture(float Amount, FVector SourceLocation)
{
    if (Amount <= 0.f || Boss->GetBossState() == EHWBossState::Break) return;

    Posture = FMath::Clamp(Posture + Amount, 0.f, MaxPosture);
    if (Posture >= MaxPosture)
    {
        TriggerBreak(SourceLocation);
    }
}

void UHWBossSystemComponent::TriggerBreak(FVector SourceLocation)
{
    Posture = 0.f;
    ++BreakCount;

    const float Duration = BreakDuration + FMath::Min(2.f, BreakCount * 0.25f);
    Boss->EnterSystemBreak(Duration, SourceLocation);
    OnBreakTriggered.Broadcast(Duration, BreakCount);
}

void UHWBossSystemComponent::UpdatePhase()
{
    if (!Boss || InitialMaxHealth <= 0.f) return;

    const float Ratio = FMath::Clamp(Boss->GetHealth() / InitialMaxHealth, 0.f, 1.f);
    const int32 NewPhase = Ratio > 0.70f ? 1 : Ratio > 0.40f ? 2 : 3;

    if (NewPhase != Phase)
    {
        Phase = NewPhase;
        OnPhaseChanged.Broadcast(Phase);
    }
}

FHWBossPartRuntime* UHWBossSystemComponent::FindPart(FName PartId)
{
    return Parts.FindByPredicate([PartId](const FHWBossPartRuntime& Part){ return Part.Id == PartId; });
}

bool UHWBossSystemComponent::DamagePart(FName PartId, float Damage)
{
    if (Damage <= 0.f) return false;

    FHWBossPartRuntime* Part = FindPart(PartId);
    if (!Part || Part->bBroken) return false;

    Part->Health = FMath::Max(0.f, Part->Health - Damage);
    if (Part->Health <= 0.f)
    {
        Part->bBroken = true;
        OnPartBroken.Broadcast(PartId);

        if (PartId == TEXT("armor"))
        {
            Posture = FMath::Min(MaxPosture, Posture + MaxPosture * 0.30f);
        }
        if (PartId == TEXT("limb") && Boss && Boss->GetCharacterMovement())
        {
            Boss->GetCharacterMovement()->MaxWalkSpeed *= 0.6f;   // the limp (docs/design/166 tab 7)
        }
        return true;
    }
    return false;
}

float UHWBossSystemComponent::GetOutgoingDamageScale() const
{
    float Scale = (bEnraged ? 1.30f : 1.f) * DifficultyDamageScale;
    Scale *= Phase == 3 ? 1.18f : Phase == 2 ? 1.08f : 1.f;
    return Scale;
}

float UHWBossSystemComponent::GetPatternSpeedScale() const
{
    float Scale = bEnraged ? 1.18f : 1.f;
    Scale *= Phase == 3 ? 1.12f : Phase == 2 ? 1.06f : 1.f;
    return Scale;
}

TArray<FHWBossPartRuntime> UHWBossSystemComponent::GetParts() const
{
    return Parts;
}


void UHWBossSystemComponent::HandleBossDied(AHWBossCharacter* DeadBoss)
{
    // A world being torn down (or a transient test world without a context) destroys its own actors.
    const UWorld* World = GetWorld();
    const bool bWorldAlive = World && !World->bIsTearingDown && World->GetGameInstance();
    for (AHWBossPartTarget* Target : PartTargets)
    {
        if (!IsValid(Target) || Target->IsActorBeingDestroyed())
        {
            continue;
        }
        if (bWorldAlive)
        {
            Target->Destroy();
        }
        else
        {
            // Still never lockable or hittable once the boss is dead.
            Target->Tags.Remove(TEXT("LockOnTarget"));
            Target->SetActorEnableCollision(false);
            Target->SetActorHiddenInGame(true);
        }
    }
    PartTargets.Reset();
}
