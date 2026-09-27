#include "World/HWTrainingCharacters.h"

#include "Camera/CameraComponent.h"
#include "Combat/HWCombatComponent.h"
#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
UStaticMeshComponent* AddPart(AActor* Owner, USceneComponent* Parent, FName Name,
    UStaticMesh* Mesh, const FVector& Location, const FVector& Scale)
{
    UStaticMeshComponent* Part = Owner->CreateDefaultSubobject<UStaticMeshComponent>(Name);
    Part->SetupAttachment(Parent);
    Part->SetStaticMesh(Mesh);
    Part->SetRelativeLocation(Location);
    Part->SetRelativeScale3D(Scale);
    Part->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Part->SetCanEverAffectNavigation(false);
    return Part;
}

UMaterialInstanceDynamic* ColorParts(AActor* Owner, UMaterialInterface* Source,
    const TArray<TObjectPtr<UStaticMeshComponent>>& Parts, const FLinearColor& Color)
{
    if (!Source)
    {
        return nullptr;
    }
    UMaterialInstanceDynamic* Material = UMaterialInstanceDynamic::Create(Source, Owner);
    Material->SetVectorParameterValue(TEXT("Tint"), Color);
    for (UStaticMeshComponent* Part : Parts)
    {
        Part->SetMaterial(0, Material);
    }
    return Material;
}
}

AHWTrainingAinCharacter::AHWTrainingAinCharacter()
{
    PrototypeMaterial = TSoftObjectPtr<UMaterialInterface>(
        FSoftObjectPath(TEXT("/Game/Materials/M_HWPrototypeColor.M_HWPrototypeColor")));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Sphere(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cone(TEXT("/Engine/BasicShapes/Cone.Cone"));

    VisualRoot = CreateDefaultSubobject<USceneComponent>(TEXT("PrototypeVisual"));
    VisualRoot->SetupAttachment(RootComponent);
    VisualRoot->SetRelativeLocation(FVector(0.f, 0.f, -92.f));
    BodyParts.Add(AddPart(this, VisualRoot, TEXT("Torso"), Cube.Object,
        FVector(0.f, 0.f, 103.f), FVector(0.42f, 0.46f, 0.65f)));
    BodyParts.Add(AddPart(this, VisualRoot, TEXT("Head"), Sphere.Object,
        FVector(0.f, 0.f, 155.f), FVector(0.35f)));
    BodyParts.Add(AddPart(this, VisualRoot, TEXT("LeftLeg"), Cube.Object,
        FVector(0.f, -14.f, 36.f), FVector(0.22f, 0.19f, 0.72f)));
    BodyParts.Add(AddPart(this, VisualRoot, TEXT("RightLeg"), Cube.Object,
        FVector(0.f, 14.f, 36.f), FVector(0.22f, 0.19f, 0.72f)));
    BodyParts.Add(AddPart(this, VisualRoot, TEXT("LeftArm"), Cube.Object,
        FVector(0.f, -32.f, 98.f), FVector(0.18f, 0.16f, 0.65f)));
    BodyParts.Add(AddPart(this, VisualRoot, TEXT("RightArm"), Cube.Object,
        FVector(0.f, 32.f, 98.f), FVector(0.18f, 0.16f, 0.65f)));
    UStaticMeshComponent* Face = AddPart(this, VisualRoot, TEXT("FacingMarker"), Cone.Object,
        FVector(23.f, 0.f, 155.f), FVector(0.14f, 0.14f, 0.25f));
    Face->SetRelativeRotation(FRotator(90.f, 0.f, 0.f));

    WeaponPivot = CreateDefaultSubobject<USceneComponent>(TEXT("PrototypeWeaponPivot"));
    WeaponPivot->SetupAttachment(VisualRoot);
    WeaponPivot->SetRelativeLocation(FVector(12.f, 42.f, 94.f));
    WeaponPivot->SetRelativeRotation(FRotator(25.f, 0.f, 0.f));
    Blade = AddPart(this, WeaponPivot, TEXT("TrainingBlade"), Cube.Object,
        FVector(0.f, 0.f, 53.f), FVector(0.09f, 0.055f, 1.1f));
}

void AHWTrainingAinCharacter::BeginPlay()
{
    Super::BeginPlay();
    if (USpringArmComponent* TrainingBoom = FindComponentByClass<USpringArmComponent>())
    {
        // Frame the whole stand-in above the portrait HUD. The inherited 65 cm
        // shoulder offset cropped the player at 390 px; a centered 780 cm boom
        // also leaves the feet visible at desktop sizes.
        TrainingBoom->TargetArmLength = 780.f;
        TrainingBoom->SocketOffset = FVector(0.f, 0.f, 20.f);
        // Lock-on still owns controller yaw and its rate cap. Ignore only its
        // target-height pitch so the training composition stays stable up close.
        TrainingBoom->bInheritPitch = false;
        TrainingBoom->bInheritRoll = false;
        TrainingBoom->SetRelativeRotation(FRotator(-22.f, 0.f, 0.f));
    }
    if (UCameraComponent* TrainingCamera = FindComponentByClass<UCameraComponent>())
    {
        // FOV is horizontal at this reference aspect: 90 degrees gives 58.7
        // degrees vertically. Maintain that vertical frame after rotation.
        TrainingCamera->SetAspectRatio(16.f / 9.f);
        TrainingCamera->SetFieldOfView(90.f);
        TrainingCamera->bConstrainAspectRatio = false;
        TrainingCamera->bOverrideAspectRatioAxisConstraint = true;
        TrainingCamera->AspectRatioAxisConstraint = AspectRatio_MaintainYFOV;
    }
    UMaterialInterface* Source = PrototypeMaterial.LoadSynchronous();
    BodyMaterial = ColorParts(this, Source, BodyParts, FLinearColor(0.035f, 0.36f, 0.63f));
    ColorParts(this, Source, {Blade}, FLinearColor(0.65f, 0.88f, 1.f));
}

void AHWTrainingAinCharacter::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    const UHWCombatComponent* PlayerCombat = GetCombat();
    if (PlayerCombat->IsDead())
    {
        VisualRoot->SetRelativeRotation(FRotator(90.f, 0.f, 0.f));
        VisualRoot->SetRelativeLocation(FVector(0.f, 0.f, -68.f));
        if (BodyMaterial)
        {
            BodyMaterial->SetVectorParameterValue(TEXT("Tint"), FLinearColor(0.13f, 0.16f, 0.19f));
        }
        return;
    }

    const EHWActionType Action = PlayerCombat->GetCurrentAction();
    const bool bAttack = Action == EHWActionType::Attack1 || Action == EHWActionType::Attack2
        || Action == EHWActionType::Attack3 || Action == EHWActionType::Smash;
    const float Phase = PlayerCombat->GetActionNormalized();
    WeaponPivot->SetRelativeRotation(bAttack
        ? FRotator(-75.f + 150.f * Phase, -45.f + 90.f * Phase, 0.f)
        : Action == EHWActionType::Counter ? FRotator(75.f, -30.f, 0.f)
        : FRotator(25.f, 0.f, 0.f));
    VisualRoot->SetRelativeRotation(Action == EHWActionType::Dodge
        ? FRotator(24.f, 0.f, 0.f) : FRotator::ZeroRotator);
    if (BodyMaterial)
    {
        BodyMaterial->SetVectorParameterValue(TEXT("Tint"), PlayerCombat->IsInvulnerable()
            ? FLinearColor(0.3f, 0.85f, 1.f) : FLinearColor(0.035f, 0.36f, 0.63f));
    }
}

AHWTrainingBossCharacter::AHWTrainingBossCharacter()
{
    PrototypeMaterial = TSoftObjectPtr<UMaterialInterface>(
        FSoftObjectPath(TEXT("/Game/Materials/M_HWPrototypeColor.M_HWPrototypeColor")));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Sphere(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cone(TEXT("/Engine/BasicShapes/Cone.Cone"));

    VisualRoot = CreateDefaultSubobject<USceneComponent>(TEXT("PrototypeVisual"));
    VisualRoot->SetupAttachment(RootComponent);
    VisualRoot->SetRelativeLocation(FVector(0.f, 0.f, -115.f));
    BodyParts.Add(AddPart(this, VisualRoot, TEXT("Torso"), Cube.Object,
        FVector(0.f, 0.f, 130.f), FVector(0.66f, 0.80f, 0.95f)));
    BodyParts.Add(AddPart(this, VisualRoot, TEXT("Head"), Sphere.Object,
        FVector(0.f, 0.f, 204.f), FVector(0.45f)));
    BodyParts.Add(AddPart(this, VisualRoot, TEXT("LeftLeg"), Cube.Object,
        FVector(0.f, -24.f, 44.f), FVector(0.36f, 0.28f, 0.88f)));
    BodyParts.Add(AddPart(this, VisualRoot, TEXT("RightLeg"), Cube.Object,
        FVector(0.f, 24.f, 44.f), FVector(0.36f, 0.28f, 0.88f)));
    BodyParts.Add(AddPart(this, VisualRoot, TEXT("LeftArm"), Cube.Object,
        FVector(0.f, -55.f, 126.f), FVector(0.30f, 0.27f, 0.94f)));
    BodyParts.Add(AddPart(this, VisualRoot, TEXT("RightArm"), Cube.Object,
        FVector(0.f, 55.f, 126.f), FVector(0.30f, 0.27f, 0.94f)));
    UStaticMeshComponent* Face = AddPart(this, VisualRoot, TEXT("FacingMarker"), Cone.Object,
        FVector(29.f, 0.f, 204.f), FVector(0.19f, 0.19f, 0.33f));
    Face->SetRelativeRotation(FRotator(90.f, 0.f, 0.f));

    WeaponPivot = CreateDefaultSubobject<USceneComponent>(TEXT("PrototypeWeaponPivot"));
    WeaponPivot->SetupAttachment(VisualRoot);
    WeaponPivot->SetRelativeLocation(FVector(10.f, 70.f, 126.f));
    WeaponPivot->SetRelativeRotation(FRotator(25.f, 0.f, 0.f));
    Blade = AddPart(this, WeaponPivot, TEXT("TrainingBlade"), Cube.Object,
        FVector(0.f, 0.f, 68.f), FVector(0.19f, 0.10f, 1.5f));
}

void AHWTrainingBossCharacter::BeginPlay()
{
    Super::BeginPlay();
    UMaterialInterface* Source = PrototypeMaterial.LoadSynchronous();
    BodyMaterial = ColorParts(this, Source, BodyParts, FLinearColor(0.6f, 0.16f, 0.045f));
    ColorParts(this, Source, {Blade}, FLinearColor(1.f, 0.7f, 0.3f));
}

void AHWTrainingBossCharacter::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    const EHWBossState VisualState = GetBossState();
    const float Phase = GetBossStateNormalized();
    FLinearColor Color(0.6f, 0.16f, 0.045f);
    FRotator WeaponPose(25.f, 0.f, 0.f);
    FRotator BodyPose = FRotator::ZeroRotator;
    if (VisualState == EHWBossState::Tell)
    {
        Color = FLinearColor(1.f, 0.52f, 0.035f);
        WeaponPose = FRotator(-65.f * Phase, -30.f, 0.f);
    }
    else if (VisualState == EHWBossState::Strike)
    {
        Color = FLinearColor(1.f, 0.055f, 0.018f);
        WeaponPose = FRotator(-65.f + 155.f * Phase, -30.f + 65.f * Phase, 0.f);
    }
    else if (VisualState == EHWBossState::Recover)
    {
        WeaponPose = FRotator(90.f - 65.f * Phase, 35.f * (1.f - Phase), 0.f);
    }
    else if (VisualState == EHWBossState::Stagger || VisualState == EHWBossState::Break)
    {
        Color = FLinearColor(0.55f, 0.36f, 0.8f);
        BodyPose.Pitch = -18.f;
    }
    else if (VisualState == EHWBossState::Dead)
    {
        Color = FLinearColor(0.17f, 0.12f, 0.09f);
        BodyPose.Pitch = 90.f;
        VisualRoot->SetRelativeLocation(FVector(0.f, 0.f, -74.f));
    }
    VisualRoot->SetRelativeRotation(BodyPose);
    WeaponPivot->SetRelativeRotation(WeaponPose);
    if (BodyMaterial)
    {
        BodyMaterial->SetVectorParameterValue(TEXT("Tint"), Color);
    }
}
