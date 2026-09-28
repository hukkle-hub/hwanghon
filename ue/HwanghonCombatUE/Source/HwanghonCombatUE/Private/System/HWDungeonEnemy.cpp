#include "System/HWDungeonEnemy.h"
#include "Animation/HWCharacterVisualSettings.h"
#include "Components/SkeletalMeshComponent.h"

#include "System/HWCoopCombatSubsystem.h"
#include "System/HWDungeonDirector.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"

#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/GameplayStatics.h"

AHWDungeonEnemy::AHWDungeonEnemy()
{
    PrimaryActorTick.bCanEverTick = true;

    GetCapsuleComponent()->InitCapsuleSize(42.f, 88.f);
    GetCharacterMovement()->MaxWalkSpeed = 285.f;
    GetCharacterMovement()->bOrientRotationToMovement = true;

    Tags.Add(TEXT("LockOnTarget"));
}

void AHWDungeonEnemy::BeginPlay()
{
    if (GetMesh() && !GetMesh()->GetSkeletalMeshAsset())
    {
        UHWCharacterVisualSettings::ApplyTo(TEXT("enemy"), GetMesh(), GetCapsuleComponent()->GetUnscaledCapsuleHalfHeight());
    }
    Super::BeginPlay();
    UpdateTarget();
}

void AHWDungeonEnemy::ConfigureEnemy(
    bool bInElite,
    float HealthScale,
    float DamageScale)
{
    bElite = bInElite;

    const float EliteHealth = bElite ? 2.5f : 1.f;
    const float EliteDamage = bElite ? 1.6f : 1.f;

    MaxHealth = 5500.f * EliteHealth * FMath::Max(0.1f, HealthScale);
    Health = MaxHealth;
    Damage = 850.f * EliteDamage * FMath::Max(0.1f, DamageScale);

    if (bElite)
    {
        GetCharacterMovement()->MaxWalkSpeed = 320.f;
        GetCapsuleComponent()->SetCapsuleSize(52.f, 100.f);
    }
}

void AHWDungeonEnemy::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (bDead) return;

    if (!Target.IsValid()
        || !Target->GetCombat()
        || Target->GetCombat()->IsDead())
    {
        UpdateTarget();
    }

    AHWAinCharacter* Player = Target.Get();
    if (!Player) return;

    const float Distance = FVector::Dist2D(
        GetActorLocation(),
        Player->GetActorLocation());

    if (Distance > AttackRangeCm)
    {
        const FVector Direction =
            (Player->GetActorLocation() - GetActorLocation()).GetSafeNormal2D();
        AddMovementInput(Direction, 1.f);
    }

    TryAttack(DeltaSeconds);
}

void AHWDungeonEnemy::UpdateTarget()
{
    if (UWorld* World = GetWorld())
    {
        if (UHWCoopCombatSubsystem* Coop =
            World->GetSubsystem<UHWCoopCombatSubsystem>())
        {
            Target = Coop->SelectClosestLivingTarget(GetActorLocation());
            if (Target.IsValid()) return;
        }
    }

    Target = Cast<AHWAinCharacter>(
        UGameplayStatics::GetPlayerCharacter(this, 0));
}

void AHWDungeonEnemy::TryAttack(float DeltaSeconds)
{
    AttackCooldownRemaining =
        FMath::Max(0.f, AttackCooldownRemaining - DeltaSeconds);

    AHWAinCharacter* Player = Target.Get();
    if (!Player || AttackCooldownRemaining > 0.f) return;

    if (FVector::DistSquared2D(GetActorLocation(), Player->GetActorLocation())
        > FMath::Square(AttackRangeCm))
    {
        return;
    }

    if (UHWCombatComponent* PlayerCombat = Player->GetCombat())
    {
        PlayerCombat->ApplyIncomingDamage(
            Damage,
            bElite ? EHWAttackTier::Finisher : EHWAttackTier::Light);
    }

    AttackCooldownRemaining = AttackCooldown;
}

bool AHWDungeonEnemy::ReceiveSystemHit_Implementation(
    float InDamage,
    EHWAttackTier Tier,
    FVector SourceLocation,
    AActor* InstigatorActor)
{
    if (bDead || InDamage <= 0.f) return false;

    float Multiplier = 1.f;
    if (Tier == EHWAttackTier::Smash) Multiplier = 1.12f;
    if (Tier == EHWAttackTier::Counter) Multiplier = 1.18f;

    Health = FMath::Max(0.f, Health - InDamage * Multiplier);
    if (Health <= 0.f)
    {
        Die();
    }
    return true;
}

void AHWDungeonEnemy::Die()
{
    if (bDead) return;
    bDead = true;
    Health = 0.f;
    Tags.Remove(TEXT("LockOnTarget"));

    GetCharacterMovement()->StopMovementImmediately();
    GetCharacterMovement()->DisableMovement();
    SetActorEnableCollision(false);

    OnEnemyDied.Broadcast(this);

    if (AHWDungeonDirector* Director = Cast<AHWDungeonDirector>(
        UGameplayStatics::GetActorOfClass(this, AHWDungeonDirector::StaticClass())))
    {
        Director->ReportEnemyDefeated(1);
    }

    SetLifeSpan(1.5f);
}
