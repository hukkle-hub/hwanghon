#include "UI/HWFrontendGameMode.h"

#include "Blueprint/UserWidget.h"
#include "UI/HWFrontendRootWidget.h"

AHWFrontendGameMode::AHWFrontendGameMode()
{
    DefaultPawnClass = nullptr;
    PlayerControllerClass = AHWFrontendPlayerController::StaticClass();
}

void AHWFrontendPlayerController::BeginPlay()
{
    Super::BeginPlay();
    if (!IsLocalController())
    {
        return;
    }
    Root = CreateWidget<UHWFrontendRootWidget>(this, UHWFrontendRootWidget::StaticClass());
    if (!Root)
    {
        return;
    }
    Root->AddToViewport(0);
    SetShowMouseCursor(true);
    FInputModeUIOnly Mode;
    Mode.SetWidgetToFocus(Root->TakeWidget());
    Mode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
    SetInputMode(Mode);
}
