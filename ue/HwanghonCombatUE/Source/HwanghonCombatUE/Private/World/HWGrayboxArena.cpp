#include "World/HWGrayboxArena.h"

#include "Components/StaticMeshComponent.h"
#include "UObject/ConstructorHelpers.h"

AHWGrayboxArena::AHWGrayboxArena()
{
    PrimaryActorTick.bCanEverTick = false;

    SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    RootComponent = SceneRoot;

    static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));

    Floor = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Floor"));
    Floor->SetupAttachment(SceneRoot);
    Floor->SetStaticMesh(CubeMesh.Object);
    Floor->SetRelativeScale3D(FVector(14.f, 10.f, 0.15f));
    Floor->SetRelativeLocation(FVector(0.f, 0.f, -15.f));

    const FVector WallLocations[4] =
    {
        FVector(0.f, 1000.f, 250.f),
        FVector(0.f, -1000.f, 250.f),
        FVector(1400.f, 0.f, 250.f),
        FVector(-1400.f, 0.f, 250.f)
    };

    const FVector WallScales[4] =
    {
        FVector(14.f, 0.15f, 2.5f),
        FVector(14.f, 0.15f, 2.5f),
        FVector(0.15f, 10.f, 2.5f),
        FVector(0.15f, 10.f, 2.5f)
    };

    for (int32 Index = 0; Index < 4; ++Index)
    {
        const FName Name(*FString::Printf(TEXT("Wall_%d"), Index));
        UStaticMeshComponent* Wall = CreateDefaultSubobject<UStaticMeshComponent>(Name);
        Wall->SetupAttachment(SceneRoot);
        Wall->SetStaticMesh(CubeMesh.Object);
        Wall->SetRelativeLocation(WallLocations[Index]);
        Wall->SetRelativeScale3D(WallScales[Index]);
        Walls.Add(Wall);
    }

}
