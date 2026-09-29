#include "Game/HWLoadingFlow.h"

#include "CanvasItem.h"
#include "Engine/Canvas.h"
#include "Engine/GameInstance.h"
#include "GameFramework/PlayerController.h"
#include "HHOnlineFlowSubsystem.h"
#include "Kismet/GameplayStatics.h"

AHWLoadingGameMode::AHWLoadingGameMode()
{
    HUDClass = AHWLoadingHUD::StaticClass();
    DefaultPawnClass = nullptr;
    bStartPlayersAsSpectators = true;
}

void AHWLoadingHUD::BeginPlay()
{
    Super::BeginPlay();
    if (APlayerController* PC = GetOwningPlayerController())
    {
        PC->bShowMouseCursor = true;
        PC->bEnableClickEvents = true;   // HUD hit boxes take mouse clicks only with this; touches come through bEnableTouchEvents
        PC->bEnableTouchEvents = true;
        FInputModeGameAndUI Mode;
        Mode.SetHideCursorDuringCapture(false);
        PC->SetInputMode(Mode);
    }
}

static void HWPanel(UCanvas* Canvas, float X, float Y, float W, float H, const FLinearColor& Color)
{
    FCanvasTileItem Tile(FVector2D(X, Y), FVector2D(W, H), Color);
    Tile.BlendMode = SE_BLEND_Translucent;
    Canvas->DrawItem(Tile);
}

void AHWLoadingHUD::DrawHUD()
{
    Super::DrawHUD();
    if (!Canvas) return;
    const float S = Canvas->SizeY / 1080.f;
    HWPanel(Canvas, 0, 0, Canvas->SizeX, Canvas->SizeY, FLinearColor(0.006f, 0.008f, 0.012f, 1));
    DrawText(TEXT("황혼"), FLinearColor(0.88f, 0.88f, 0.84f, 1), 90 * S, 58 * S, nullptr, 2.0f * S, false);

    // two big cards side by side - big enough for a thumb (>= 64 px on a phone)
    const float W = 620 * S, H = 360 * S, Gap = 60 * S;
    const float X0 = (Canvas->SizeX - 2 * W - Gap) / 2, Y = (Canvas->SizeY - H) / 2 + 40 * S;
    struct FCard { FName Box; const TCHAR* Title; const TCHAR* Sub; FLinearColor Accent; };
    const FCard Cards[] = {
        {TEXT("STORY"), TEXT("스토리 모드"), TEXT("제1부 · 혼자"), FLinearColor(0.94f, 0.48f, 0.12f, 1)},
        {TEXT("SHELTER"), TEXT("쉘터"), TEXT("강남 B-1 · 온라인"), FLinearColor(0.45f, 0.07f, 0.045f, 1)},
    };
    for (int32 i = 0; i < 2; ++i)
    {
        const float X = X0 + i * (W + Gap);
        HWPanel(Canvas, X, Y, W, H, FLinearColor(0.03f, 0.034f, 0.04f, 0.94f));
        HWPanel(Canvas, X, Y, 6 * S, H, Cards[i].Accent);
        DrawText(Cards[i].Title, FLinearColor::White, X + 48 * S, Y + 110 * S, nullptr, 1.9f * S, false);
        DrawText(Cards[i].Sub, FLinearColor(0.72f, 0.74f, 0.76f, 1), X + 50 * S, Y + 210 * S, nullptr, 0.95f * S, false);
        AddHitBox(FVector2D(X, Y), FVector2D(W, H), Cards[i].Box, true, 10);
    }
}

void AHWLoadingHUD::NotifyHitBoxClick(FName BoxName)
{
    if (BoxName == TEXT("STORY")) ChooseStory();
    else if (BoxName == TEXT("SHELTER")) ChooseShelter();
}

void AHWLoadingHUD::ChooseStory()
{
    LastChoice = TEXT("story");
    UE_LOG(LogTemp, Display, TEXT("[HWFlow] loading -> story %s"), *StoryMap);
    UGameplayStatics::OpenLevel(this, FName(*StoryMap));
}

void AHWLoadingHUD::ChooseShelter()
{
    LastChoice = TEXT("shelter");
    UE_LOG(LogTemp, Display, TEXT("[HWFlow] loading -> character select"));
    if (UHHOnlineFlowSubsystem* Flow = GetGameInstance() ? GetGameInstance()->GetSubsystem<UHHOnlineFlowSubsystem>() : nullptr)
    {
        Flow->GoToCharacterSelect();
    }
}
