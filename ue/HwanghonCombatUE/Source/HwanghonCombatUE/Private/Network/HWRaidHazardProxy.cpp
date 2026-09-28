#include "Network/HWRaidHazardProxy.h"
#include "Components/StaticMeshComponent.h"
#include "UObject/ConstructorHelpers.h"
AHWRaidHazardProxy::AHWRaidHazardProxy()
{
    PrimaryActorTick.bCanEverTick=false;SetActorEnableCollision(false);Visual=CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Visual"));RootComponent=Visual;Visual->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    static ConstructorHelpers::FObjectFinder<UStaticMesh>M(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));if(M.Succeeded())Visual->SetStaticMesh(M.Object);
}
void AHWRaidHazardProxy::ApplyHazard(FName Id,FName P,FVector L,float R,bool Arena)
{
    HazardId=Id;Phase=P;bArena=Arena;SetActorLocation(L,false);const float RS=FMath::Max(.05f,R/50.f);const float HS=P==TEXT("active")?.045f:P==TEXT("warning")?.02f:.01f;Visual->SetRelativeScale3D(FVector(RS,RS,HS));SetActorHiddenInGame(P==TEXT("off"));
}
