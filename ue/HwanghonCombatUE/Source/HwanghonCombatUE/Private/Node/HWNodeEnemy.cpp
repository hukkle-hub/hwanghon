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
    // Within this the gate or a player is walked at straight; farther, the route and the graph path lead (docs/design/201 §8)
    constexpr float DirectApproachCm = 1500.f;

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
        case EHWNodeEnemyRole::Resonator: return 1.05f;   // tall and upright: the aristocrat of the reference sheet
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
        case EHWNodeEnemyRole::Resonator: return TEXT("RESONATOR");
        default: return TEXT("WALKER");
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
        case EHWNodeEnemyRole::Resonator: return FColor(255, 110, 190);
        default: return FColor(220, 220, 220);
        }
    }

    const TCHAR* TargetName(HWNodeRules::ETargetKind K)
    {
        switch (K)
        {
        case HWNodeRules::ETargetKind::Player: return TEXT("PLAYER");
        case HWNodeRules::ETargetKind::Gate: return TEXT("GATE");
        case HWNodeRules::ETargetKind::Generator: return TEXT("GENERATOR");
        case HWNodeRules::ETargetKind::Comms: return TEXT("COMMS");
        case HWNodeRules::ETargetKind::Npc: return TEXT("NPC");
        case HWNodeRules::ETargetKind::Ally: return TEXT("PACK (rear)");
        default: return TEXT("NONE");
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
#if UE_BUILD_SHIPPING
    Tag->SetHiddenInGame(true);   // a development label (v06): never in a shipped build
#endif
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
    Resonance = 0;
    Blow = 0;
    GetCharacterMovement()->MaxWalkSpeed = GetMoveSpeedNow();
    SetActorScale3D(FVector(HWNodeEnemyLocal::BodyScale(Role)));
    Tag->SetTextRenderColor(HWNodeEnemyLocal::RoleColor(Role));
    RefreshLabel();
    ThinkLeft = 0.f;
}

float AHWNodeEnemy::GetMoveSpeedNow() const
{
    return Stats.Speed * HWNodeRules::ResonanceMove(Resonance);
}

void AHWNodeEnemy::SetResonance(int32 Stacks)
{
    const int32 Clamped = HWNodeRules::ResonanceStacks(Stacks);
    if (Clamped == Resonance) return;
    Resonance = Clamped;
    GetCharacterMovement()->MaxWalkSpeed = GetMoveSpeedNow();
    RefreshLabel();
}

void AHWNodeEnemy::SetLabelVisible(bool bVisible)
{
#if !UE_BUILD_SHIPPING
    Tag->SetHiddenInGame(!bVisible);
#endif
}

// "T5 / BREAKER" over "TARGET: GENERATOR" (v06); a resonated one carries a mark
void AHWNodeEnemy::RefreshLabel()
{
    Tag->SetText(FText::FromString(FString::Printf(TEXT("T%d / %s%s\nTARGET: %s"), HWNodeRules::NodeThreatGrade,
        HWNodeEnemyLocal::RoleTag(Role), Resonance > 0 ? TEXT("  ~RES~") : TEXT(""), HWNodeEnemyLocal::TargetName(TargetKind))));
}

float AHWNodeEnemy::WindupNow()
{
    if (!IsArmored()) return HWNodeEnemyLocal::WindupFor(Role);
    Attack = HWNodeRules::ArmoredAttackAt(Blow);
    return HWNodeRules::ArmoredWindupSeconds(Attack);
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
            // a countered blow left it staggered (1.0 s, the elite 1.4 s): keep that, do not overwrite it with recovery
            if (Phase == EPhase::Windup)
            {
                Phase = EPhase::Recover;
                PhaseLeft = 0.35f;
            }
            return;
        }
        Phase = EPhase::Move;
    }

    ThinkLeft -= DeltaSeconds;
    if (ThinkLeft <= 0.f)
    {
        Think();
        ThinkLeft = HWNodeRules::ThinkSeconds(RuleRole());   // per role (v05 target_reevaluate_sec)
    }
    StepMove(DeltaSeconds);
}

void AHWNodeEnemy::Think()
{
    const FVector Here = GetActorLocation();
    if (Role == EHWNodeEnemyRole::Runner && !bFlanked && Here.Y > Director->GateLineY() + 200.f) bFlanked = true;

    const HWNodeRules::FTargetView View = Director->BuildView(Here, bFlanked, this);
    HWNodeRules::ETargetKind Next = HWNodeRules::ChooseTarget(RuleRole(), View);

    // a target north of the standing gate is reached through the gate (HWNodeRules::BlockedByGate) - a player too:
    // a player standing just inside the gate used to pin the infected against it, neither hitting him nor the gate
    if (Next != HWNodeRules::ETargetKind::None && Next != HWNodeRules::ETargetKind::Gate)
    {
        const FVector Goal = Director->TargetPoint(Next, Here, this);
        if (HWNodeRules::BlockedByGate(Here.Y, Goal.Y, Director->GateLineY(), Director->IsGateStanding(),
                static_cast<HWNodeRules::EEnemyRole>(Role), bFlanked))
        {
            Next = HWNodeRules::ETargetKind::Gate;
        }
    }
    // a new target: the graph path from where this enemy's own route ends (or from here, once it is walked)
    if (Next != TargetKind)
    {
        TargetKind = Next;
        Extension = Director->ExtensionFor(Next, RouteIndex < Route.Num() ? Route.Last() : Here, this);
        ExtensionIndex = 0;
        RefreshLabel();
        Director->ReportTargetChosen(this, Next);   // the PIE evidence (v06): breaker on the generator, stalker on an NPC...
    }
    // path walked but the target is still far (the NPC it was after was taken, another one is wanted): path again
    else if (TargetKind != HWNodeRules::ETargetKind::None && RouteIndex >= Route.Num() && ExtensionIndex >= Extension.Num()
        && FVector::Dist2D(Here, Director->TargetPoint(TargetKind, Here, this)) > HWNodeEnemyLocal::DirectApproachCm)
    {
        Extension = Director->ExtensionFor(TargetKind, Here, this);
        ExtensionIndex = 0;
    }

    // a built barricade across the next leg is broken first (the flank trails); a turret close by draws the
    // infected that are not busy with a player (docs/design/201 §2)
    Override = nullptr;
    if (TargetKind != HWNodeRules::ETargetKind::Player)
    {
        Override = Director->BarricadeOnPath(Here, GoalPoint());
    }
    if (!Override.IsValid() && (Role == EHWNodeEnemyRole::Normal || Role == EHWNodeEnemyRole::ArmoredElite)
        && (View.Player < 0.f || View.Player > 600.f))
    {
        Override = Director->TurretNear(Here, 380.f);
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
    case HWNodeRules::ETargetKind::Ally: return 80.f;   // the resonator's place behind the pack: arrived, it holds
    default: return 0.f;
    }
}

// Straight at the gate or a player only from close by: from the spawn it walked off the ramp's edge (node-sim.cjs)
bool AHWNodeEnemy::IsDirectApproach(const FVector& Here) const
{
    return (TargetKind == HWNodeRules::ETargetKind::Player || TargetKind == HWNodeRules::ETargetKind::Gate || TargetKind == HWNodeRules::ETargetKind::Ally)
        && FVector::Dist2D(Here, Director->TargetPoint(TargetKind, Here, this)) <= HWNodeEnemyLocal::DirectApproachCm;
}

bool AHWNodeEnemy::HasWaypoint(const FVector& Here) const
{
    return !IsDirectApproach(Here) && (RouteIndex < Route.Num() || ExtensionIndex < Extension.Num());
}

FVector AHWNodeEnemy::GoalPoint() const
{
    const FVector Here = GetActorLocation();
    if (IsDirectApproach(Here)) return Director->TargetPoint(TargetKind, Here, this);
    if (RouteIndex < Route.Num()) return Route[RouteIndex];
    if (ExtensionIndex < Extension.Num()) return Extension[ExtensionIndex];
    return TargetKind == HWNodeRules::ETargetKind::None ? Here : Director->TargetPoint(TargetKind, Here, this);
}

void AHWNodeEnemy::StepMove(float DeltaSeconds)
{
    const FVector Here = GetActorLocation();

    if (AHWNodeFacility* Blocker = Override.Get())
    {
        if (Blocker->IsDestroyed())
        {
            Override = nullptr;
        }
        else
        {
            if (Blocker->DistanceToSurface2D(Here) <= 140.f)
            {
                if (Cooldown <= 0.f)
                {
                    Phase = EPhase::Windup;
                    PhaseLeft = WindupNow();
                }
                return;
            }
            const FVector C = Blocker->GetActorLocation(), H = Blocker->GetHalfExtent();
            const FVector Face(FMath::Clamp(Here.X, C.X - H.X, C.X + H.X), FMath::Clamp(Here.Y, C.Y - H.Y, C.Y + H.Y), Here.Z);
            AddMovementInput((Face - Here).GetSafeNormal2D(), 1.f);
            return;
        }
    }

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
            Distance = FVector::Dist2D(Here, Director->TargetPoint(TargetKind, Here, this));
        }
        if (Distance <= ReachTo(TargetKind))
        {
            // the resonator at its place behind the pack: it holds there, it does not strike its own
            if (TargetKind == HWNodeRules::ETargetKind::Ally) return;
            if (Cooldown <= 0.f)
            {
                Phase = EPhase::Windup;
                PhaseLeft = WindupNow();
                const FVector Face = (Director->TargetPoint(TargetKind, Here, this) - Here).GetSafeNormal2D();
                if (!Face.IsNearlyZero()) SetActorRotation(Face.Rotation());
            }
            return;
        }
    }

    // walk the route: the next waypoint, then the extension to the target, then the target itself.
    // The 220 cm "arrived" radius is for waypoints only: applied to the gate (reach 140) or a player (170) it parked
    // the enemy just out of reach for good (found by tools/ue/node-sim.cjs, docs/design/201 §8).
    const FVector Goal = GoalPoint();
    const FVector To = Goal - Here;
    if (HasWaypoint(Here) && FVector(To.X, To.Y, 0.f).SizeSquared() < FMath::Square(220.f))
    {
        if (RouteIndex < Route.Num()) ++RouteIndex;
        else ++ExtensionIndex;
        return;
    }
    AddMovementInput(To.GetSafeNormal2D(), 1.f);
}

void AHWNodeEnemy::Strike()
{
    Cooldown = Stats.AttackCooldown;
    const FVector Here = GetActorLocation();
    const float Hit = DamageScale * GetAttackScaleNow();   // difficulty x the resonator's aura
    const HWNodeRules::EArmoredAttack ThisBlow = Attack;
    if (IsArmored()) ++Blow;
    if (AHWNodeFacility* Blocker = Override.Get())
    {
        if (!Blocker->IsDestroyed() && Blocker->DistanceToSurface2D(Here) <= 200.f) Blocker->ApplyEnemyDamage(Stats.FacilityDamage * Hit);
        return;
    }
    if (TargetKind == HWNodeRules::ETargetKind::Player)
    {
        AHWAinCharacter* Player = Director->GetPlayer();
        UHWCombatComponent* Combat = Player ? Player->GetCombat() : nullptr;
        if (!Combat || Combat->IsDead() || FVector::Dist2D(Here, Player->GetActorLocation()) > ReachTo(TargetKind) + 60.f) return;
        // the overhead crush cannot be countered (v05): a raised counter does not stop it - only a dodge (the combat
        // component's invulnerability) does. The counter judgement itself is the combat component's, untouched.
        const bool bCounterable = !IsArmored() || HWNodeRules::CounterAllowed(ThisBlow);
        if (bCounterable && Combat->IsCounterActive())
        {
            // countered: no damage, a stagger, and the elite's armour cracks (the perfect time only off the heavy charge)
            const bool bPerfect = Combat->IsPerfectCounterActive();
            const HWNodeRules::ECounterGrade Grade = bPerfect ? HWNodeRules::ECounterGrade::Perfect : HWNodeRules::ECounterGrade::Normal;
            Combat->NotifyCounterLanded();
            Combat->ApplyHitStop(bPerfect ? 0.18f : 0.12f);
            Armor.OnCountered(IsArmored() ? HWNodeRules::ArmoredCrackGrade(ThisBlow, Grade) : Grade);
            Phase = EPhase::Stagger;
            PhaseLeft = IsArmored() ? HWNodeRules::ArmoredStaggerSeconds(ThisBlow, Grade) : 1.0f;
            OnEnemyCountered.Broadcast(this, bPerfect);
            Director->ReportCounter(bPerfect);
            return;
        }
        Combat->ApplyIncomingDamage(Stats.Damage * Hit, IsArmored() ? EHWAttackTier::Smash : EHWAttackTier::Light);
        return;
    }
    if (TargetKind == HWNodeRules::ETargetKind::Npc)
    {
        if (AHWNodeNpc* Npc = Director->PreferredNpc(Here, Role))
        {
            if (FVector::Dist2D(Here, Npc->GetActorLocation()) <= ReachTo(TargetKind) + 60.f && Npc->ApplyEnemyDamage(Stats.Damage * GetAttackScaleNow())) Director->ReportNpcHurt(Npc);
        }
        return;
    }
    if (TargetKind == HWNodeRules::ETargetKind::Gate || TargetKind == HWNodeRules::ETargetKind::Generator || TargetKind == HWNodeRules::ETargetKind::Comms)
    {
        AHWNodeFacility* F = Director->GetFacility(static_cast<EHWNodeFacilityKind>(static_cast<uint8>(TargetKind) - static_cast<uint8>(HWNodeRules::ETargetKind::Gate)));
        if (F && F->DistanceToSurface2D(Here) <= ReachTo(TargetKind) + 60.f) F->ApplyEnemyDamage(Stats.FacilityDamage * Hit);
    }
}

bool AHWNodeEnemy::ReceiveSystemHit_Implementation(float InDamage, EHWAttackTier Tier, FVector SourceLocation, AActor* InstigatorActor)
{
    if (bDead || InDamage <= 0.f) return false;
    bLastHitByPlayer = Cast<APawn>(InstigatorActor) != nullptr && Cast<APawn>(InstigatorActor)->IsPlayerControlled();
    float Multiplier = 1.f;
    if (Tier == EHWAttackTier::Smash) Multiplier = 1.12f;
    if (Tier == EHWAttackTier::Counter) Multiplier = 1.18f;
    const float Applied = FMath::Min(Health, InDamage * Multiplier * Armor.DamageScale(Stats.ArmorScale));
    Health -= Applied;
    if (Director) Director->ReportEnemyDamage(Applied, InstigatorActor);   // the run log's damage by source (node-compare.mjs)

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
    if (bByPlayer && Director)
    {
        const bool bWasAttacking = Override.IsValid() || TargetKind == HWNodeRules::ETargetKind::Gate || TargetKind == HWNodeRules::ETargetKind::Generator
            || TargetKind == HWNodeRules::ETargetKind::Comms || TargetKind == HWNodeRules::ETargetKind::Npc;
        Director->ReportKill(Role, GetActorLocation(), bLastHitByPlayer, bWasAttacking);
    }
    OnEnemyDied.Broadcast(this);   // a discarded one still leaves the wave
    SetLifeSpan(bByPlayer ? 1.5f : 0.1f);
}

void AHWNodeEnemy::Discard()
{
    Die(false);
}
