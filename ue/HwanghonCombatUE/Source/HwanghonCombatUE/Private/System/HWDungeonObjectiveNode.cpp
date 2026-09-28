#include "System/HWDungeonObjectiveNode.h"

#include "System/HWDungeonDirector.h"
#include "Character/HWAinCharacter.h"

#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Kismet/GameplayStatics.h"
#include "UObject/ConstructorHelpers.h"

AHWDungeonObjectiveNode::AHWDungeonObjectiveNode()
{
    Trigger = CreateDefaultSubobject<UBoxComponent>(TEXT("Trigger"));
    RootComponent = Trigger;
    Trigger->InitBoxExtent(FVector(90.f, 90.f, 90.f));
    Trigger->SetCollisionProfileName(TEXT("OverlapAllDynamic"));

    Visual = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Visual"));
    Visual->SetupAttachment(RootComponent);
    Visual->SetCollisionEnabled(ECollisionEnabled::NoCollision);

    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(
        TEXT("/Engine/BasicShapes/Cube.Cube"));
    if (Cube.Succeeded()) Visual->SetStaticMesh(Cube.Object);
    Visual->SetRelativeScale3D(FVector(0.8f));
}

void AHWDungeonObjectiveNode::BeginPlay()
{
    Super::BeginPlay();
    Trigger->OnComponentBeginOverlap.AddDynamic(
        this,
        &AHWDungeonObjectiveNode::HandleOverlap);
}

void AHWDungeonObjectiveNode::HandleOverlap(
    UPrimitiveComponent* OverlappedComponent,
    AActor* OtherActor,
    UPrimitiveComponent* OtherComp,
    int32 OtherBodyIndex,
    bool bFromSweep,
    const FHitResult& SweepResult)
{
    if (bConsumed || !Cast<AHWAinCharacter>(OtherActor)) return;
    bConsumed = true;

    if (AHWDungeonDirector* Director = Cast<AHWDungeonDirector>(
        UGameplayStatics::GetActorOfClass(this, AHWDungeonDirector::StaticClass())))
    {
        Director->ReportObjectiveProgress(1);
    }

    SetActorHiddenInGame(true);
    SetActorEnableCollision(false);
}
