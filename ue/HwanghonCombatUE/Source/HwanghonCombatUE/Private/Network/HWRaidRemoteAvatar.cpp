#include "Network/HWRaidRemoteAvatar.h"
#include "Components/CapsuleComponent.h"
#include "Components/StaticMeshComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "UObject/ConstructorHelpers.h"

AHWRaidRemoteAvatar::AHWRaidRemoteAvatar()
{
    PrimaryActorTick.bCanEverTick=false;GetCapsuleComponent()->InitCapsuleSize(42.f,92.f);GetCharacterMovement()->DisableMovement();
    Visual=CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Visual"));Visual->SetupAttachment(RootComponent);Visual->SetCollisionEnabled(ECollisionEnabled::NoCollision);Visual->SetRelativeScale3D(FVector(.45f,.32f,1.75f));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> M(TEXT("/Engine/BasicShapes/Capsule.Capsule"));if(M.Succeeded())Visual->SetStaticMesh(M.Object);
}
void AHWRaidRemoteAvatar::ApplySnapshot(FString Id,FName Char,FVector Target,float Aim,float Hp,float MaxHp,bool Dead,float Dt)
{
    PlayerId=MoveTemp(Id);CharacterId=Char;Health=Hp;MaxHealth=MaxHp;bDead=Dead;
    const FVector Cur=GetActorLocation();SetActorLocation(FVector::Dist2D(Cur,Target)>350.f?Target:FMath::VInterpTo(Cur,Target,Dt,12.f),false);
    SetActorRotation(FMath::RInterpTo(GetActorRotation(),FRotator(0.f,FMath::RadiansToDegrees(Aim),0.f),Dt,14.f));
    SetActorHiddenInGame(bDead);SetActorEnableCollision(!bDead);
}
