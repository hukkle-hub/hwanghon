#include "Node/HWNodeEnemy.h"

#include "Animation/HWCharacterVisualSettings.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Node/HWNodeDirector.h"
#include "Node/HWNodeFacility.h"
#include "Node/HWNodeNpc.h"

namespace HWNodeEnemyLocal
{
    // Telegraph before each blow: long enough to read and counter (the elite's is the clearest).
    float WindupFor(EHWNodeEnemyRole Role)
    {
        switch (Role)
        {
        case EHWNodeEnemyRole::Runner: return 0.35f;
        case EHWNodeEnemyRole::Breaker: return 0.7f;
        case EHWNodeEnemyRole::ArmoredElite: return 0.8f;
        default: return 0.45f;
        }
    }

    float BodyScale(EHWNodeEnemyRole Role)
    {
        switch (Role)
        {
        case EHWNodeEnemyRole::Runner: return 0.9f;
        case EHWNodeEnemyRole::Breaker: return 1.15f;
        case EHWNodeEnemyRole::Stalker: return 0.95f;
        case EHWNodeEnemyRole::ArmoredElite: return 1.35f;
        default: return 1.f;
        }
    }

    const TCHAR* RoleTag(EHWNodeEnemyRole Role)
    {
        switch (Role)
        {
        case EHWNodeEnemyRole::Runner: return TEXT("RUNNER");
        case EHWNodeEnemyRole::Breaker: return TEXT("BREAKER");
        case EHWNodeEnemyRole::Stalker: return TEXT("STALKER");
        case EHWNodeEnemyRole::ArmoredElite: return TEXT("ARMORED");
        default: return TEXT("INFECTED");
        }
    }

    FColor RoleColor(EHWNodeEnemyRole Role)
    {
        switch (Role)
        {
        case EHWNodeEnemyRole::Runner: return FColor(120, 220, 255);
        case EHWNodeEnemyRole::Breaker: return FColor(255, 150, 60);
        case EHWNodeEnemyRole::Stalker: return FColor(200, 120, 255);
        case EHWNodeEnemyRole::ArmoredElite: return FColor(255, 70, 70);
        default: return FColor(220, 220, 220);
        }
    }
}

AHWNodeEnemy::AHWNodeEnemy()
{
    PrimaryActorTick.bCanEverTick = true;
    GetCapsuleComponent()->InitCapsuleSize(42.f, 88.f);
    GetCharacterMovement()->bOrientRotationToMovement = true;
    GetCharacterMovement()->RotationRate = FRotator(0.f, 540.f, 0.f);
    Tags.Add(TEXT("LockOnTarget"));
    AutoPossessAI = EAutoPossessAI::PlacedInWorldOrSpawned;   // a controller, or AddMovementInput does nothing (HWStoryNpc)

    Tag = CreateDefaultSubobject<UTextRenderComponent>(TEXT("RoleTag"));
    Tag->SetupAttachment(GetCapsuleComponent());
    Tag->SetRelativeLocation(FVector(0.f, 0.f, 125.f));
    Tag->SetHorizontalAlignment(EHTA_Center);
    Tag->SetWorldSize(46.f);
    Tag->SetAbsolute(false, true, false);   // world rotation: stays readable while the body turns
}

void AHWNodeEnemy::BeginPlay()
{
    if (GetMesh() && !GetMesh()->GetSkeletalMeshAsset())
    {
        UHWCharacterVisualSettings::ApplyTo(TEXT("enemy"), GetMesh(), GetCapsuleComponent()->GetUnscaledCapsuleHalfHeight());
    }
    Super::BeginPlay();
    Tag->SetWorldRotation(FRotator(0.f, -90.f, 0.f));
}

void AHWNodeEnemy::Configure(AHWNodeDirector* InDirector, EHWNodeEnemyRole InRole, const TArray<FVector>& InRoute, float Difficulty)
{
    Director = InDirector;
    Role = InRole;
    Stats = HWNodeRules::RoleStats(static_cast<HWNodeRules::EEnemyRole>(InRole));
    Route = InRoute;
    RouteIndex = 0;
    DamageScale = FMath::Max(0.1f, Difficulty);
    MaxHealth = Stats.Health * DamageScale;
    Health = MaxHealth;
    GetCharacterMovement()->MaxWalkSpeed = Stats.Speed;
    SetActorScale3D(FVector(HWNodeEnemyLocal::BodyScale(Role)));
    Tag->SetText(FText::FromString(HWNodeEnemyLocal::RoleTag(Role)));
    Tag->SetTextRenderColor(HWNodeEnemyLocal::RoleColor(Role));
    ThinkLeft = 0.f;
}

void AHWNodeEnemy::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (bDead || !Director) return;

    Armor.Tick(DeltaSeconds);
    Cooldown = FMath::Max(0.f, Cooldown - DeltaSeconds);

    if (Phase != EPhase::Move)
    {
        PhaseLeft -= DeltaSeconds;
        if (PhaseLeft > 0.f) return;
        if (Phase == EPhase::Windup)
        {
            Strike();
            Phase = EPhase::Recover;
            PhaseLeft = 0.35f;
            return;
        }
        Phase = EPhase::Move;
    }

    ThinkLeft -= DeltaSeconds;
    if (ThinkLeft <= 0.f)
    {
        Think();
        ThinkLeft = 0.4f;
    }
    StepMove(DeltaSeconds);
}

void AHWNodeEnemy::Think()
{
    const FVector Here = GetActorLocation();
    if (Role == EHWNodeEnemyRole::Runner && !bFlanked && Here.Y > Director->GateLineY() + 200.f) bFlanked = true;

    const HWNodeRules::FTargetView View = Director->BuildView(Here, bFlanked);
    HWNodeRules::ETargetKind Next = HWNodeRules::ChooseTarget(static_cast<HWNodeRules::EEnemyRole>(Role), View);

    // a target north of the standing gate is reached through the gate (HWNodeRules::BlockedByGate)
    if (Next != HWNodeRules::ETargetKind::None && Next != HWNodeRules::ETargetKind::Gate && Next != HWNodeRules::ETargetKind::Player)
    {
        const FVector Goal = Director->TargetPoint(Next, Here);
        if (HWNodeRules::BlockedByGate(Here.Y, Goal.Y, Director->GateLineY(), Director->IsGateStanding(),
                static_cast<HWNodeRules::EEnemyRole>(Role), bFlanked))
        {
            Next = HWNodeRules::ETargetKind::Gate;
        }
    }
    if (Next != TargetKind)
    {
        TargetKind = Next;
        Extension = Director->ExtensionFor(Next);
        ExtensionIndex = 0;
    }
}

float AHWNodeEnemy::ReachTo(HWNodeRules::ETargetKind Kind) const
{
    switch (Kind)
    {
    case HWNodeRules::ETargetKind::Player: return Role == EHWNodeEnemyRole::ArmoredElite ? 230.f : 170.f;
    case HWNodeRules::ETargetKind::Npc: return 160.f;
    case HWNodeRules::ETargetKind::Gate:
    case HWNodeRules::ETargetKind::Generator:
    case HWNodeRules::ETargetKind::Comms: return 140.f;
    default: return 0.f;
    }
}

FVector AHWNodeEnemy::GoalPoint() const
{
    const FVector Here = GetActorLocation();
    if (TargetKind == HWNodeRules::ETargetKind::Player || TargetKind == HWNodeRules::ETargetKind::Gate) return Director->TargetPoint(TargetKind, Here);
    if (RouteIndex < Route.Num()) return Route[RouteIndex];
    if (ExtensionIndex < Extension.Num()) return Extension[ExtensionIndex];
    return TargetKind == HWNodeRules::ETargetKind::None ? Here : Director->TargetPoint(TargetKind, Here);
}

void AHWNodeEnemy::StepMove(float DeltaSeconds)
{
    const FVector Here = GetActorLocation();

    // in reach of the target: wind up a blow
    if (TargetKind != HWNodeRules::ETargetKind::None)
    {
        float Distance = 0.f;
        if (TargetKind == HWNodeRules::ETargetKind::Gate || TargetKind == HWNodeRules::ETargetKind::Generator || TargetKind == HWNodeRules::ETargetKind::Comms)
        {
            const AHWNodeFacility* F = Director->GetFacility(static_cast<EHWNodeFacilityKind>(static_cast<uint8>(TargetKind) - static_cast<uint8>(HWNodeRules::ETargetKind::Gate)));
            Distance = F ? F->DistanceToSurface2D(Here) : 1e9f;
        }
        else
        {
            Distance = FVector::Dist2D(Here, Director->TargetPoint(TargetKind, Here));
        }
        if (Distance <= ReachTo(TargetKind))
        {
            if (Cooldown <= 0.f)
            {
                Phase = EPhase::Windup;
                PhaseLeft = HWNodeEnemyLocal::WindupFor(Role);
                const FVector Face = (Director->TargetPoint(TargetKind, Here) - Here).GetSafeNormal2D();
                if (!Face.IsNearlyZero()) SetActorRotation(Face.Rotation());
            }
            return;
        }
    }

    // walk the route: the next waypoint, then the extension to the target, then the target itself
    const FVector Goal = GoalPoint();
    const FVector To = Goal - Here;
    if (FVector(To.X, To.Y, 0.f).SizeSquared() < FMath::Square(220.f))
    {
        if (RouteIndex < Route.Num()) ++RouteIndex;
        else if (ExtensionIndex < Extension.Num()) ++ExtensionIndex;
        return;
    }
    AddMovementInput(To.GetSafeNormal2D(), 1.f);
}

void AHWNodeEnemy::Strike()
{
    Cooldown = Stats.AttackCooldown;
    const FVector Here = GetActorLocation();
    if (TargetKind == HWNodeRules::ETargetKind::Player)
    {
        AHWAinCharacter* Player = Director->GetPlayer();
        UHWCombatComponent* Combat = Player ? Player->GetCombat() : nullptr;
        if (!Combat || Combat->IsDead() || FVector::Dist2D(Here, Player->GetActorLocation()) > ReachTo(TargetKind) + 60.f) return;
        if (Combat->IsCounterActive())
        {
            // countered: no damage, a stagger, and the elite's armour cracks (longer on a perfect counter)
            const bool bPerfect = Combat->IsPerfectCounterActive();
            Combat->NotifyCounterLanded();
            Combat->ApplyHitStop(bPerfect ? 0.18f : 0.12f);
            Armor.OnCountered(bPerfect ? HWNodeRules::ECounterGrade::Perfect : HWNodeRules::ECounterGrade::Normal);
            Phase = EPhase::Stagger;
            PhaseLeft = Role == EHWNodeEnemyRole::ArmoredElite ? 1.4f : 1.0f;
            OnEnemyCountered.Broadcast(this, bPerfect);
            Director->ReportCounter(bPerfect);
            return;
        }
        Combat->ApplyIncomingDamage(Stats.Damage * DamageScale,
            Role == EHWNodeEnemyRole::ArmoredElite ? EHWAttackTier::Smash : EHWAttackTier::Light);
        return;
    }
    if (TargetKind == HWNodeRules::ETargetKind::Npc)
    {
        if (AHWNodeNpc* Npc = Director->GetTechnician())
        {
            if (FVector::Dist2D(Here, Npc->GetActorLocation()) <= ReachTo(TargetKind) + 60.f) Npc->ApplyEnemyDamage(Stats.Damage);
        }
        return;
    }
    if (TargetKind == HWNodeRules::ETargetKind::Gate || TargetKind == HWNodeRules::ETargetKind::Generator || TargetKind == HWNodeRules::ETargetKind::Comms)
    {
        AHWNodeFacility* F = Director->GetFacility(static_cast<EHWNodeFacilityKind>(static_cast<uint8>(TargetKind) - static_cast<uint8>(HWNodeRules::ETargetKind::Gate)));
        if (F && F->DistanceToSurface2D(Here) <= ReachTo(TargetKind) + 60.f) F->ApplyEnemyDamage(Stats.FacilityDamage * DamageScale);
    }
}

bool AHWNodeEnemy::ReceiveSystemHit_Implementation(float InDamage, EHWAttackTier Tier, FVector SourceLocation, AActor* InstigatorActor)
{
    if (bDead || InDamage <= 0.f) return false;
    float Multiplier = 1.f;
    if (Tier == EHWAttackTier::Smash) Multiplier = 1.12f;
    if (Tier == EHWAttackTier::Counter) Multiplier = 1.18f;
    Health -= InDamage * Multiplier * Armor.DamageScale(Stats.ArmorScale);

    // a heavy blow interrupts the light ones' wind-up; the elite only flinches when its armour is cracked
    const bool bCracked = Armor.DamageScale(Stats.ArmorScale) >= 1.f;
    if ((Tier == EHWAttackTier::Smash || Tier == EHWAttackTier::Counter) && (Role != EHWNodeEnemyRole::ArmoredElite || bCracked))
    {
        Phase = EPhase::Stagger;
        PhaseLeft = 0.5f;
    }
    if (Health <= 0.f) Die(true);
    return true;
}

void AHWNodeEnemy::Die(bool bByPlayer)
{
    if (bDead) return;
    bDead = true;
    Health = 0.f;
    Tags.Remove(TEXT("LockOnTarget"));
    GetCharacterMovement()->StopMovementImmediately();
    GetCharacterMovement()->DisableMovement();
    SetActorEnableCollision(false);
    bKilled = bByPlayer;
    OnEnemyDied.Broadcast(this);   // a discarded one still leaves the wave
    SetLifeSpan(bByPlayer ? 1.5f : 0.1f);
}

void AHWNodeEnemy::Discard()
{
    Die(false);
}
