#include "Game/HWStoryGameMode.h"

#include "Character/HWAinCharacter.h"
#include "Game/HWStoryDirector.h"
#include "Kismet/GameplayStatics.h"
#include "UI/HWStoryHUD.h"

AHWStoryGameMode::AHWStoryGameMode()
{
    DefaultPawnClass = AHWAinCharacter::StaticClass();
    HUDClass = AHWStoryHUD::StaticClass();
}

void AHWStoryGameMode::BeginPlay()
{
    Super::BeginPlay();
    Director = Cast<AHWStoryDirector>(UGameplayStatics::GetActorOfClass(this, AHWStoryDirector::StaticClass()));
    if (!Director)
    {
        Director = GetWorld()->SpawnActor<AHWStoryDirector>(AHWStoryDirector::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator);
    }
}
