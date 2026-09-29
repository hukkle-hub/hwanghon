#include "HHLoadingGameMode.h"
#include "HHOnlineFlowSubsystem.h"

#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "TimerManager.h"

AHHLoadingGameMode::AHHLoadingGameMode()
{
    bStartPlayersAsSpectators = true;
}

void AHHLoadingGameMode::BeginPlay()
{
    Super::BeginPlay();

    GetWorldTimerManager().SetTimer(
        FlowTimer,
        this,
        &AHHLoadingGameMode::ContinueToCharacterSelect,
        FMath::Max(0.05f, MinimumLoadingScreenSeconds),
        false
    );
}

void AHHLoadingGameMode::ContinueToCharacterSelect()
{
    if (UGameInstance* GI = GetGameInstance())
    {
        if (UHHOnlineFlowSubsystem* Flow = GI->GetSubsystem<UHHOnlineFlowSubsystem>())
        {
            Flow->GoToCharacterSelect();
        }
    }
}
