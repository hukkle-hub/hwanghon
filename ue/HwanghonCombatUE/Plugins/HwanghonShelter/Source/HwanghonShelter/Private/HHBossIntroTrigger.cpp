#include "HHBossIntroTrigger.h"
#include "HHBossIntroDirector.h"

#include "Components/BoxComponent.h"
#include "GameFramework/Pawn.h"

AHHBossIntroTrigger::AHHBossIntroTrigger()
{
    PrimaryActorTick.bCanEverTick = false;
    bReplicates = false;

    TriggerVolume = CreateDefaultSubobject<UBoxComponent>(TEXT("TriggerVolume"));
    SetRootComponent(TriggerVolume);

    TriggerVolume->SetBoxExtent(FVector(180.f, 320.f, 150.f));
    TriggerVolume->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
    TriggerVolume->SetCollisionResponseToAllChannels(ECR_Ignore);
    TriggerVolume->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);
}

void AHHBossIntroTrigger::BeginPlay()
{
    Super::BeginPlay();

    TriggerVolume->OnComponentBeginOverlap.AddDynamic(
        this,
        &AHHBossIntroTrigger::OnTriggerBegin);
}

void AHHBossIntroTrigger::OnTriggerBegin(
    UPrimitiveComponent* OverlappedComponent,
    AActor* OtherActor,
    UPrimitiveComponent* OtherComp,
    int32 OtherBodyIndex,
    bool bFromSweep,
    const FHitResult& SweepResult)
{
    if (!HasAuthority() || (bOneShot && bTriggered) || !Director)
    {
        return;
    }

    APawn* Pawn = Cast<APawn>(OtherActor);
    if (!Pawn || !Pawn->IsPlayerControlled())
    {
        return;
    }

    bTriggered = true;

    if (bOneShot)
    {
        TriggerVolume->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    }

    Director->StartBossIntro(bShortVersion);
}
