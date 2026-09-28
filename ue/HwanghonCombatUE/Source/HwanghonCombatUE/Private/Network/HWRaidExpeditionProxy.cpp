#include "Network/HWRaidExpeditionProxy.h"
#include "Components/StaticMeshComponent.h"
#include "UObject/ConstructorHelpers.h"

AHWRaidExpeditionNodeProxy::AHWRaidExpeditionNodeProxy()
{
    PrimaryActorTick.bCanEverTick=false;SetActorEnableCollision(false);Visual=CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Visual"));RootComponent=Visual;Visual->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    static ConstructorHelpers::FObjectFinder<UStaticMesh>M(TEXT("/Engine/BasicShapes/Sphere.Sphere"));if(M.Succeeded())Visual->SetStaticMesh(M.Object);
}
void AHWRaidExpeditionNodeProxy::ApplyNode(FName Id,FName K,const FString&,FVector L,float Range,bool,bool Done,bool Discovered)
{
    NodeId=Id;Kind=K;SetActorLocation(L,false);const float R=FMath::Clamp(Range/200.f,.25f,1.5f);const float H=K==TEXT("checkpoint")?1.25f:K==TEXT("valve")?.8f:K==TEXT("purifier")?1.1f:.65f;Visual->SetRelativeScale3D(FVector(R,R,H));SetActorHiddenInGame(!Discovered||Done);
}
AHWRaidGateProxy::AHWRaidGateProxy()
{
    PrimaryActorTick.bCanEverTick=false;SetActorEnableCollision(false);Visual=CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Visual"));RootComponent=Visual;Visual->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    static ConstructorHelpers::FObjectFinder<UStaticMesh>M(TEXT("/Engine/BasicShapes/Cube.Cube"));if(M.Succeeded())Visual->SetStaticMesh(M.Object);
}
void AHWRaidGateProxy::ApplyGate(FVector L,bool Open){SetActorLocation(L,false);Visual->SetRelativeScale3D(FVector(.18f,2.8f,2.4f));SetActorHiddenInGame(Open);}
