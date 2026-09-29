#include "Game/HWShelterTouchInput.h"

#include "Components/InputComponent.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"

AHWShelterTouchInput::AHWShelterTouchInput()
{
    PrimaryActorTick.bCanEverTick = true;
}

void AHWShelterTouchInput::BeginPlay()
{
    Super::BeginPlay();
    if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
    {
        EnableInput(PC);
        if (InputComponent)
        {
            InputComponent->BindTouch(IE_Pressed, this, &AHWShelterTouchInput::OnPressed);
            InputComponent->BindTouch(IE_Released, this, &AHWShelterTouchInput::OnReleased);
        }
    }
}

void AHWShelterTouchInput::OnPressed(ETouchIndex::Type Finger, FVector Location)
{
    if (bDown) return;   // one finger at a time
    bDown = true;
    bLongSent = false;
    DownTime = 0.f;
    DownAt = FVector2D(Location.X, Location.Y);
    DownFinger = Finger;
}

void AHWShelterTouchInput::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!bDown || bLongSent) return;
    DownTime += DeltaSeconds;
    if (DownTime >= LongPressSeconds)
    {
        bLongSent = true;
        Send(EKeys::E, TEXT("long"));
    }
}

void AHWShelterTouchInput::OnReleased(ETouchIndex::Type Finger, FVector Location)
{
    if (!bDown || Finger != DownFinger) return;
    bDown = false;
    if (bLongSent) return;
    if (FVector2D::Distance(DownAt, FVector2D(Location.X, Location.Y)) > TapSlopPx) return;   // a drag, not a tap
    APlayerController* PC = GetWorld()->GetFirstPlayerController();
    int32 W = 0, H = 0;
    if (PC) PC->GetViewportSize(W, H);
    if (W > 0 && H > 0 && DownAt.X >= W * CloseCorner.X && DownAt.Y <= H * CloseCorner.Y)
    {
        Send(EKeys::Escape, TEXT("close"));
        return;
    }
    Send(EKeys::F, TEXT("tap"));
}

void AHWShelterTouchInput::Send(const FKey& Key, FName Gesture)
{
    LastGesture = Gesture;
    if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
    {
        PC->InputKey(FInputKeyEventArgs::CreateSimulated(Key, IE_Pressed, 1.f));
        PC->InputKey(FInputKeyEventArgs::CreateSimulated(Key, IE_Released, 0.f));
    }
}
