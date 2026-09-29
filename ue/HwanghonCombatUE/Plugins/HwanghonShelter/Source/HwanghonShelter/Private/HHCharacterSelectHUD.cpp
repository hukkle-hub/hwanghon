#include "HHCharacterSelectHUD.h"
#include "HHOnlineFlowSubsystem.h"

#include "Engine/Canvas.h"
#include "CanvasItem.h"
#include "Engine/GameInstance.h"
#include "GameFramework/PlayerController.h"

void AHHCharacterSelectHUD::BeginPlay()
{
    Super::BeginPlay();

    if (APlayerController* PC = GetOwningPlayerController())
    {
        PC->bShowMouseCursor = true;
        PC->bEnableClickEvents = true;   // HwanghonCombatUE: HUD hit boxes take mouse clicks only with this (touch works without)
        FInputModeGameAndUI Mode;
        Mode.SetHideCursorDuringCapture(false);
        PC->SetInputMode(Mode);
    }
}

static void HHDrawPanel(UCanvas* Canvas, float X, float Y, float W, float H, const FLinearColor& Color)
{
    if (!Canvas) return;
    FCanvasTileItem Tile(FVector2D(X,Y), FVector2D(W,H), Color);
    Tile.BlendMode = SE_BLEND_Translucent;
    Canvas->DrawItem(Tile);
}

void AHHCharacterSelectHUD::DrawCharacterCard(
    const TCHAR* Id,
    const TCHAR* KoreanName,
    const TCHAR* RoleLabel,
    const TCHAR* Summary,
    const FLinearColor& Accent,
    float X, float Y, float W, float H,
    bool bSelected)
{
    HHDrawPanel(Canvas, X, Y, W, H, bSelected ? FLinearColor(0.075f,0.08f,0.09f,0.96f) : FLinearColor(0.02f,0.024f,0.03f,0.90f));
    HHDrawPanel(Canvas, X, Y, 5.f, H, Accent);

    if (bSelected)
    {
        HHDrawPanel(Canvas, X+5.f, Y, W-5.f, 3.f, Accent);
        HHDrawPanel(Canvas, X+5.f, Y+H-3.f, W-5.f, 3.f, Accent);
    }

    DrawText(KoreanName, FLinearColor::White, X+24.f, Y+26.f, nullptr, 1.35f, false);
    DrawText(RoleLabel, Accent, X+24.f, Y+71.f, nullptr, 0.82f, false);
    DrawText(Summary, FLinearColor(0.72f,0.74f,0.76f,1), X+24.f, Y+112.f, nullptr, 0.68f, false);
    DrawText(Id, FLinearColor(0.35f,0.38f,0.42f,1), X+24.f, Y+H-36.f, nullptr, 0.60f, false);

    AddHitBox(FVector2D(X,Y), FVector2D(W,H), FName(*FString::Printf(TEXT("CHAR_%s"), Id)), true, 10);
}

void AHHCharacterSelectHUD::DrawHUD()
{
    Super::DrawHUD();
    if (!Canvas) return;

    UHHOnlineFlowSubsystem* Flow = GetGameInstance() ? GetGameInstance()->GetSubsystem<UHHOnlineFlowSubsystem>() : nullptr;
    const FName Selected = Flow ? Flow->SelectedCharacterId : NAME_None;

    const float SX = Canvas->SizeX / 1920.f;
    const float SY = Canvas->SizeY / 1080.f;
    const float S = FMath::Min(SX, SY);

    HHDrawPanel(Canvas, 0, 0, Canvas->SizeX, Canvas->SizeY, FLinearColor(0.006f,0.008f,0.012f,1));

    DrawText(TEXT("황혼"), FLinearColor(0.88f,0.88f,0.84f,1), 90*S, 58*S, nullptr, 2.0f*S, false);
    DrawText(TEXT("CHARACTER SELECT"), FLinearColor(0.36f,0.39f,0.43f,1), 94*S, 122*S, nullptr, 0.72f*S, false);
    DrawText(TEXT("쉘터에 입장할 캐릭터를 선택하세요."), FLinearColor(0.78f,0.79f,0.78f,1), 94*S, 166*S, nullptr, 0.88f*S, false);

    const float Gap = 24*S;
    const float W = 400*S;
    const float H = 520*S;
    const float StartX = (Canvas->SizeX - (4*W + 3*Gap)) * 0.5f;
    const float Y = 255*S;

    DrawCharacterCard(TEXT("ain"), TEXT("아인"), TEXT("파괴 · 근접 딜러"),
        TEXT("거리와 박자를 재고, 정확한 한 번으로 끊는다."),
        FLinearColor(0.68f,0.15f,0.12f,1),
        StartX, Y, W, H, Selected == FName(TEXT("ain")));

    DrawCharacterCard(TEXT("kain"), TEXT("카인"), TEXT("고정 · 메인 탱커"),
        TEXT("받아내고 고정해, 적의 한 번을 파티의 창으로 바꾼다."),
        FLinearColor(0.85f,0.32f,0.08f,1),
        StartX+(W+Gap), Y, W, H, Selected == FName(TEXT("kain")));

    DrawCharacterCard(TEXT("ryu"), TEXT("류"), TEXT("동시 · 속공 딜러"),
        TEXT("두 지점을 동시에 보고, 가장 빠른 방식으로 조건을 연다."),
        FLinearColor(0.12f,0.48f,0.86f,1),
        StartX+2*(W+Gap), Y, W, H, Selected == FName(TEXT("ryu")));

    DrawCharacterCard(TEXT("sera"), TEXT("세라"), TEXT("봉쇄 · 지원"),
        TEXT("공간과 신호를 막아, 불가능한 구간을 잠깐 가능하게 만든다."),
        FLinearColor(0.40f,0.68f,0.92f,1),
        StartX+3*(W+Gap), Y, W, H, Selected == FName(TEXT("sera")));

    const float BW = 410*S, BH = 76*S;
    const float BX = Canvas->SizeX - BW - 86*S;
    const float BY = Canvas->SizeY - BH - 60*S;
    const bool bCanEnter = Flow && !Flow->SelectedCharacterId.IsNone() && !Flow->bMatchmaking;

    HHDrawPanel(Canvas, BX, BY, BW, BH, bCanEnter ? FLinearColor(0.45f,0.07f,0.045f,0.94f) : FLinearColor(0.07f,0.07f,0.07f,0.80f));
    DrawText(Flow && Flow->bMatchmaking ? TEXT("쉘터 서버 배정 중...") : TEXT("쉘터 입장"),
        bCanEnter ? FLinearColor::White : FLinearColor(0.45f,0.45f,0.45f,1),
        BX+92*S, BY+20*S, nullptr, 1.05f*S, false);

    AddHitBox(FVector2D(BX,BY), FVector2D(BW,BH), FName(TEXT("CONFIRM")), true, 20);
}

void AHHCharacterSelectHUD::NotifyHitBoxClick(FName BoxName)
{
    UHHOnlineFlowSubsystem* Flow = GetGameInstance() ? GetGameInstance()->GetSubsystem<UHHOnlineFlowSubsystem>() : nullptr;
    if (!Flow) return;

    const FString Box = BoxName.ToString();
    if (Box.StartsWith(TEXT("CHAR_")))
    {
        Flow->SelectCharacter(FName(*Box.RightChop(5)));
        return;
    }

    if (BoxName == FName(TEXT("CONFIRM")))
    {
        ConfirmSelection();
    }
}

void AHHCharacterSelectHUD::ConfirmSelection()
{
    UHHOnlineFlowSubsystem* Flow = GetGameInstance() ? GetGameInstance()->GetSubsystem<UHHOnlineFlowSubsystem>() : nullptr;
    APlayerController* PC = GetOwningPlayerController();
    if (!Flow || !PC || Flow->SelectedCharacterId.IsNone()) return;

    Flow->RequestShelterAndTravel(PC);
}
