#include "Game/HWCombatGameMode.h"
#include "Boss/HWBossCharacter.h"
#include "Character/HWAinCharacter.h"
#include "World/HWGrayboxArena.h"
#include "World/HWSeohanLightingRig.h"
#include "Audit/HWCombatAuditActor.h"

#include "Kismet/GameplayStatics.h"

AHWCombatGameMode::AHWCombatGameMode()
{
    DefaultPawnClass = AHWAinCharacter::StaticClass();
}

void AHWCombatGameMode::BeginPlay()
{
    Super::BeginPlay();

    if (!UGameplayStatics::GetActorOfClass(this, AHWGrayboxArena::StaticClass()))
    {
        GetWorld()->SpawnActor<AHWGrayboxArena>(AHWGrayboxArena::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator);
    }

    ACharacter* Player = UGameplayStatics::GetPlayerCharacter(this, 0);
    if (Player)
    {
        Player->SetActorLocation(FVector(-450.f, 0.f, 96.f));
        Player->SetActorRotation(FRotator(0.f, 0.f, 0.f));
    }

    AHWBossCharacter* Boss = Cast<AHWBossCharacter>(UGameplayStatics::GetActorOfClass(this, AHWBossCharacter::StaticClass()));
    if (!Boss)
    {
        Boss = GetWorld()->SpawnActor<AHWBossCharacter>(
            AHWBossCharacter::StaticClass(),
            FVector(450.f, 0.f, 115.f),
            FRotator(0.f, 180.f, 0.f));
    }


    if (!UGameplayStatics::GetActorOfClass(this, AHWSeohanLightingRig::StaticClass()))
    {
        GetWorld()->SpawnActor<AHWSeohanLightingRig>(
            AHWSeohanLightingRig::StaticClass(),
            FVector::ZeroVector,
            FRotator::ZeroRotator);
    }

    if (!UGameplayStatics::GetActorOfClass(this, AHWCombatAuditActor::StaticClass()))
    {
        GetWorld()->SpawnActor<AHWCombatAuditActor>(
            AHWCombatAuditActor::StaticClass(),
            FVector::ZeroVector,
            FRotator::ZeroRotator);
    }
}
