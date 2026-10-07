#include "Node/HWNodeFacility.h"

#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"

AHWNodeFacility::AHWNodeFacility()
{
    PrimaryActorTick.bCanEverTick = false;

    static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));

    Body = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Body"));
    RootComponent = Body;
    Body->SetStaticMesh(CubeMesh.Object);
    Body->SetCollisionProfileName(TEXT("BlockAll"));

    Label = CreateDefaultSubobject<UTextRenderComponent>(TEXT("Label"));
    Label->SetupAttachment(Body);
    Label->SetHorizontalAlignment(EHTA_Center);
    Label->SetWorldSize(110.f);
    Label->SetTextRenderColor(FColor::White);
    Label->SetAbsolute(false, false, true);   // keep the text unscaled by the cube
}

void AHWNodeFacility::Configure(const FHWNodeFacilityDef& Def)
{
    Kind = Def.Kind;
    FacilityId = Def.Id;
    HalfExtent = Def.HalfExtent;
    Rules.Kind = static_cast<HWNodeRules::EFacility>(Def.Kind);
    Rules.MaxHealth = FMath::Max(1.f, Def.MaxHealth);
    Rules.Health = Rules.MaxHealth;

    // the engine cube is 100 cm; Location is on the floor, so the box stands on it
    SetActorLocation(Def.Location + FVector(0.f, 0.f, HalfExtent.Z));
    Body->SetWorldScale3D(HalfExtent / 50.f);
    Label->SetRelativeLocation(FVector(0.f, 0.f, 50.f + 140.f / FMath::Max(1.f, HalfExtent.Z / 50.f)));
    Label->SetWorldRotation(FRotator(0.f, -90.f, 0.f));   // faces south, the way the enemies come

    if (UMaterialInterface* Base = Body->GetMaterial(0))
    {
        Material = UMaterialInstanceDynamic::Create(Base, this);
        Body->SetMaterial(0, Material);
    }
    Refresh();
}

bool AHWNodeFacility::ApplyEnemyDamage(float Amount)
{
    if (Rules.IsDestroyed()) return false;
    const bool bDestroyedNow = Rules.ApplyDamage(Amount);
    Refresh();
    OnFacilityDamaged.Broadcast(this);
    if (bDestroyedNow)
    {
        if (Kind == EHWNodeFacilityKind::Gate)
        {
            // the broken gate no longer holds the road: it sinks to a low rubble line
            SetActorEnableCollision(false);
            Body->SetWorldScale3D(FVector(HalfExtent.X / 50.f, HalfExtent.Y / 50.f, 0.15f));
            SetActorLocation(GetActorLocation() - FVector(0.f, 0.f, HalfExtent.Z - 8.f));
        }
        OnFacilityDestroyed.Broadcast(this);
    }
    return bDestroyedNow;
}

void AHWNodeFacility::RepairBy(float Amount)
{
    const bool bWasDestroyed = Rules.IsDestroyed();
    Rules.Repair(Amount);
    if (bWasDestroyed && !Rules.IsDestroyed() && Kind == EHWNodeFacilityKind::Gate)
    {
        Body->SetWorldScale3D(HalfExtent / 50.f);
        SetActorLocation(GetActorLocation() + FVector(0.f, 0.f, HalfExtent.Z - 8.f));
        SetActorEnableCollision(true);
    }
    Refresh();
}

float AHWNodeFacility::DistanceToSurface2D(const FVector& Point) const
{
    const FVector C = GetActorLocation();
    const float DX = FMath::Max(0.f, FMath::Abs(Point.X - C.X) - HalfExtent.X);
    const float DY = FMath::Max(0.f, FMath::Abs(Point.Y - C.Y) - HalfExtent.Y);
    return FMath::Sqrt(DX * DX + DY * DY);
}

void AHWNodeFacility::Refresh()
{
    static const TCHAR* Names[] = { TEXT("GATE"), TEXT("GENERATOR"), TEXT("COMMS") };
    const float F = Rules.Fraction();
    FString Text = FString::Printf(TEXT("%s %d%%"), Names[static_cast<int32>(Kind)], FMath::RoundToInt(F * 100.f));
    if (Kind == EHWNodeFacilityKind::Generator) Text += FString::Printf(TEXT("  PWR %d"), GetPower());
    if (Rules.IsDestroyed()) Text = FString::Printf(TEXT("%s DESTROYED"), Names[static_cast<int32>(Kind)]);
    Label->SetText(FText::FromString(Text));

    // gate amber, generator blue, comms red; darker as it breaks
    const FLinearColor Base =
        Kind == EHWNodeFacilityKind::Gate ? FLinearColor(0.88f, 0.62f, 0.25f) :
        Kind == EHWNodeFacilityKind::Generator ? FLinearColor(0.25f, 0.62f, 0.88f) : FLinearColor(0.82f, 0.28f, 0.28f);
    if (Material) Material->SetVectorParameterValue(TEXT("Color"), Base * (0.25f + 0.75f * F));
}
