#include "Node/HWNodeNpc.h"

#include "Animation/HWCharacterVisualSettings.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Node/HWNodeDirector.h"
#include "Node/HWNodeFacility.h"

namespace HWNodeNpcLocal
{
    const TCHAR* RoleName(EHWNodeNpcRole R)
    {
        switch (R)
        {
        case EHWNodeNpcRole::Technician: return TEXT("TECH");
        case EHWNodeNpcRole::Medic: return TEXT("MEDIC");
        case EHWNodeNpcRole::Scout: return TEXT("SCOUT");
        case EHWNodeNpcRole::Operator: return TEXT("OPERATOR");
        case EHWNodeNpcRole::Guard: return TEXT("GUARD");
        }
        return TEXT("NPC");
    }

    const TCHAR* StateText(HWNodeRules::ENpcState S)
    {
        switch (S)
        {
        case HWNodeRules::ENpcState::Normal: return TEXT("");
        case HWNodeRules::ENpcState::Injured: return TEXT(" (injured)");
        case HWNodeRules::ENpcState::Missing: return TEXT(" CAPTIVE - rescue (G)");
        case HWNodeRules::ENpcState::Rescued: return TEXT(" (recovering)");
        }
        return TEXT("");
    }
}

AHWNodeNpc::AHWNodeNpc()
{
    PrimaryActorTick.bCanEverTick = true;
    GetCapsuleComponent()->InitCapsuleSize(40.f, 88.f);
    GetCharacterMovement()->bOrientRotationToMovement = true;
    GetCharacterMovement()->MaxWalkSpeed = 420.f;
    AutoPossessAI = EAutoPossessAI::PlacedInWorldOrSpawned;   // a controller, or AddMovementInput does nothing

    Tag = CreateDefaultSubobject<UTextRenderComponent>(TEXT("Tag"));
    Tag->SetupAttachment(GetCapsuleComponent());
    Tag->SetRelativeLocation(FVector(0.f, 0.f, 130.f));
    Tag->SetHorizontalAlignment(EHTA_Center);
    Tag->SetWorldSize(52.f);
    Tag->SetAbsolute(false, true, false);
}

void AHWNodeNpc::BeginPlay()
{
    if (GetMesh() && !GetMesh()->GetSkeletalMeshAsset())
    {
        UHWCharacterVisualSettings::ApplyTo(TEXT("enemy"), GetMesh(), GetCapsuleComponent()->GetUnscaledCapsuleHalfHeight());
    }
    Super::BeginPlay();
    Tag->SetWorldRotation(FRotator(0.f, -90.f, 0.f));
    Refresh();
}

void AHWNodeNpc::Configure(AHWNodeDirector* InDirector, const FHWNodeNpcDef& Def, bool bArmed)
{
    Director = InDirector;
    Role = Def.Role;
    NpcId = Def.Id;
    RouteName = Def.Route;
    Home = Def.Location;
    Life = HWNodeRules::FNpcLife();
    Life.MaxHealth = HWNodeRules::NpcMaxHealth(static_cast<HWNodeRules::ENpcRole>(Role), bArmed);
    Life.Health = Life.MaxHealth;
    SetActorScale3D(FVector(Role == EHWNodeNpcRole::Guard ? 1.05f : 0.92f));
    Refresh();
}

bool AHWNodeNpc::ApplyEnemyDamage(float Amount)
{
    const bool bChanged = Life.ApplyDamage(Amount);
    if (bChanged && Life.State == HWNodeRules::ENpcState::Missing)
    {
        // taken: held at the holding spot until a player comes for them
        ClearOrder();
        bEvacuated = false;
        GetCharacterMovement()->StopMovementImmediately();
        if (Director && Director->GetConfig()) SetActorLocation(Director->GetConfig()->HoldingSpot + FVector(0.f, 0.f, 100.f), false, nullptr, ETeleportType::TeleportPhysics);
    }
    if (bChanged) Refresh();
    return bChanged;
}

bool AHWNodeNpc::Rescue()
{
    if (!Life.Rescue()) return false;
    bEvacuated = false;
    SetActorLocation(Home + FVector(0.f, 0.f, 100.f), false, nullptr, ETeleportType::TeleportPhysics);
    Refresh();
    return true;
}

void AHWNodeNpc::OrderTo(const TArray<FVector>& Path, EHWNodeFacilityKind Facility)
{
    if (Role != EHWNodeNpcRole::Technician || !IsTargetable()) return;
    OrderPath = Path;
    OrderIndex = 0;
    OrderFacility = Facility;
    bOrdered = Path.Num() > 0;
    bEvacuated = false;   // an order brings it back on duty
    Refresh();
}

void AHWNodeNpc::EvacuateTo(const TArray<FVector>& Path)
{
    if (!IsTargetable() || Path.Num() == 0) return;
    bOrdered = false;
    OrderPath = Path;
    OrderIndex = 0;
    bEvacuated = true;
    Refresh();
}

void AHWNodeNpc::ReturnHome()
{
    if (!bEvacuated) return;
    bEvacuated = false;
    OrderPath.Reset();
    OrderIndex = 0;
    SetActorLocation(Home + FVector(0.f, 0.f, 100.f), false, nullptr, ETeleportType::TeleportPhysics);
    Refresh();
}

void AHWNodeNpc::ClearOrder()
{
    bOrdered = false;
    OrderPath.Reset();
    OrderIndex = 0;
    Refresh();
}

void AHWNodeNpc::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (Life.Tick(DeltaSeconds)) Refresh();
    if (bEvacuated && !IsCaptive())
    {
        // walk the shelter path, then stand
        if (OrderIndex >= OrderPath.Num()) return;
        const FVector ToShelter = OrderPath[OrderIndex] - GetActorLocation();
        if (FVector(ToShelter.X, ToShelter.Y, 0.f).SizeSquared() < FMath::Square(150.f)) { ++OrderIndex; return; }
        AddMovementInput(ToShelter.GetSafeNormal2D(), 1.f);
        return;
    }
    if (!bOrdered || !Director || IsCaptive()) return;

    const FVector Here = GetActorLocation();
    AHWNodeFacility* Target = Director->GetFacility(OrderFacility);
    // at the facility: repair it (HWNodeRules::TechnicianRepairPerSecond - an injured technician is slower).
    // Only while it stands: a wrecked gate brought back at 1% every frame was a gate that never fell - the enemy hit it
    // forever and the run never ended (tools/ue/node-campaign.cjs, a retake stuck for 900 s). Wrecked = Recovering's job.
    if (Target && Target->DistanceToSurface2D(Here) <= 220.f)
    {
        if (!Target->IsDestroyed() && Target->GetHealthFraction() < 1.f)
        {
            const float Amount = HWNodeRules::TechnicianRepairPerSecond(Life.State) * DeltaSeconds;
            Target->RepairBy(Amount);
            Director->ReportRepair(Amount);
        }
        return;
    }
    if (OrderIndex >= OrderPath.Num()) return;
    const FVector To = OrderPath[OrderIndex] - Here;
    // the last waypoint is the work spot: walk right up to it (180 cm left the technician outside its repair reach)
    const float Arrive = OrderIndex == OrderPath.Num() - 1 ? 60.f : 180.f;
    if (FVector(To.X, To.Y, 0.f).SizeSquared() < FMath::Square(Arrive))
    {
        ++OrderIndex;
        return;
    }
    AddMovementInput(To.GetSafeNormal2D(), 1.f);
}

void AHWNodeNpc::Refresh()
{
    FString Text = FString(HWNodeNpcLocal::RoleName(Role)) + HWNodeNpcLocal::StateText(Life.State);
    if (bEvacuated) Text += TEXT(" (evacuated)");
    if (bOrdered)
    {
        static const TCHAR* OrderTargets[] = { TEXT("gate"), TEXT("generator"), TEXT("comms"), TEXT("turret"), TEXT("barricade") };
        Text += FString::Printf(TEXT(" -> repair %s"), OrderTargets[static_cast<int32>(OrderFacility)]);
    }
    Tag->SetText(FText::FromString(Text));
    Tag->SetTextRenderColor(Life.State == HWNodeRules::ENpcState::Normal ? FColor(120, 230, 150)
        : Life.State == HWNodeRules::ENpcState::Missing ? FColor(255, 90, 90) : FColor(255, 170, 80));
}
