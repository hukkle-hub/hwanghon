#include "World/HWTrainingArena.h"

#include "Components/DirectionalLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"

AHWTrainingArena::AHWTrainingArena()
{
    PrototypeMaterial = TSoftObjectPtr<UMaterialInterface>(
        FSoftObjectPath(TEXT("/Game/Materials/M_HWPrototypeColor.M_HWPrototypeColor")));

    // The inherited graybox walls are at +/-1400 and +/-1000 cm. Match their
    // inner boundaries with a continuous floor and ground every wall.
    if (UStaticMeshComponent* TrainingFloor = Cast<UStaticMeshComponent>(GetDefaultSubobjectByName(TEXT("Floor"))))
    {
        TrainingFloor->SetRelativeScale3D(FVector(28.15f, 20.15f, 0.3f));
        TrainingFloor->SetRelativeLocation(FVector(0.f, 0.f, -15.f));
    }
    for (int32 Index = 0; Index < 4; ++Index)
    {
        const FName Name(*FString::Printf(TEXT("Wall_%d"), Index));
        if (UStaticMeshComponent* Wall = Cast<UStaticMeshComponent>(GetDefaultSubobjectByName(Name)))
        {
            FVector Location = Wall->GetRelativeLocation();
            Location.Z = 75.f;
            Wall->SetRelativeLocation(Location);
            Wall->SetRelativeScale3D(Index < 2
                ? FVector(28.15f, 0.15f, 1.5f) : FVector(0.15f, 20.15f, 1.5f));
        }
    }

    PrototypeLight = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("PrototypeDaylight"));
    PrototypeLight->SetupAttachment(RootComponent);
    PrototypeLight->SetMobility(EComponentMobility::Movable);
    PrototypeLight->SetRelativeRotation(FRotator(-52.f, -35.f, 0.f));
    PrototypeLight->SetIntensity(3.f);
    PrototypeLight->SetLightColor(FLinearColor(0.85f, 0.9f, 1.f));

    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
    for (int32 Index = 0; Index < 4; ++Index)
    {
        UStaticMeshComponent* Line = CreateDefaultSubobject<UStaticMeshComponent>(
            FName(*FString::Printf(TEXT("TrainingBoundary_%d"), Index)));
        Line->SetupAttachment(RootComponent);
        Line->SetStaticMesh(Cube.Object);
        Line->SetRelativeLocation(Index < 2
            ? FVector(0.f, Index == 0 ? -850.f : 850.f, 0.6f)
            : FVector(Index == 2 ? -1250.f : 1250.f, 0.f, 0.6f));
        Line->SetRelativeScale3D(Index < 2
            ? FVector(25.f, 0.045f, 0.012f) : FVector(0.045f, 17.f, 0.012f));
        Line->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        Line->SetCanEverAffectNavigation(false);
        FloorMarkings.Add(Line);
    }
}

void AHWTrainingArena::BeginPlay()
{
    Super::BeginPlay();
    if (UMaterialInterface* Source = PrototypeMaterial.LoadSynchronous())
    {
        UMaterialInstanceDynamic* FloorMaterial = UMaterialInstanceDynamic::Create(Source, this);
        FloorMaterial->SetVectorParameterValue(TEXT("Tint"), FLinearColor(0.12f, 0.17f, 0.22f));
        if (UStaticMeshComponent* TrainingFloor = Cast<UStaticMeshComponent>(GetDefaultSubobjectByName(TEXT("Floor"))))
        {
            TrainingFloor->SetMaterial(0, FloorMaterial);
        }
        UMaterialInstanceDynamic* LineMaterial = UMaterialInstanceDynamic::Create(Source, this);
        LineMaterial->SetVectorParameterValue(TEXT("Tint"), FLinearColor(0.8f, 0.58f, 0.15f));
        for (UStaticMeshComponent* Line : FloorMarkings)
        {
            Line->SetMaterial(0, LineMaterial);
        }
    }
}
