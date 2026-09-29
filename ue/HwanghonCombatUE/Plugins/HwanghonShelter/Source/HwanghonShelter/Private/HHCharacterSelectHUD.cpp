#include "HHCharacterSelectHUD.h"
#include "HHFrontEndCinematicDirector.h"
#include "HHOnlineFlowSubsystem.h"

#include "CanvasItem.h"
#include "Engine/Canvas.h"
#include "Engine/GameInstance.h"
#include "Engine/Engine.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "Components/LightComponent.h"
#include "Engine/Texture2D.h"

static void HHDrawPanel(UCanvas* Canvas, float X, float Y, float W, float H, const FLinearColor& Color)
{
    if (!Canvas) return;
    FCanvasTileItem Tile(FVector2D(X,Y), FVector2D(W,H), Color);
    Tile.BlendMode = SE_BLEND_Translucent;
    Canvas->DrawItem(Tile);
}

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

    if (GetWorld())
    {
        for (TActorIterator<AHHFrontEndCinematicDirector> It(GetWorld()); It; ++It)
        {
            Director = *It;
            break;
        }
    }

    if (UHHOnlineFlowSubsystem* Flow = GetGameInstance()
        ? GetGameInstance()->GetSubsystem<UHHOnlineFlowSubsystem>()
        : nullptr)
    {
        Flow->OnMatchmakingFailed.AddDynamic(this, &AHHCharacterSelectHUD::HandleMatchmakingFailed);
    }

    if (Director)
    {
        Director->OnRevealFinished.AddDynamic(this, &AHHCharacterSelectHUD::HandleRevealFinished);
        Director->OnConnectFinished.AddDynamic(this, &AHHCharacterSelectHUD::HandleConnectFinished);
        Director->ResetToTitle();
    }
}

void AHHCharacterSelectHUD::DrawHUD()
{
    Super::DrawHUD();
    if (!Canvas) return;

    const float SX = Canvas->SizeX / 1920.f;
    const float SY = Canvas->SizeY / 1080.f;
    const float S = FMath::Min(SX, SY);

    // Do not cover the real-time bunker set with an opaque background.
    // Only local contrast plates are drawn.

    switch (Screen)
    {
        case EHHFrontEndScreen::Title:
            DrawTitle(S);
            break;
        case EHHFrontEndScreen::RevealTransition:
            // Camera is doing the work. UI intentionally disappears.
            break;
        case EHHFrontEndScreen::CharacterSelect:
            DrawCharacterSelect(S);
            break;
        case EHHFrontEndScreen::Connecting:
            DrawConnecting(S);
            break;
    }
}

void AHHCharacterSelectHUD::DrawTitle(float S)
{
    // HwanghonCombatUE (doc 158): the director's selected concept - the logo over the ops room, three stacked plates
    // (입장 lit in amber, 설정, 나가기). The logo is a texture cut from that concept (tools/frontend/make_frontend_tex.py),
    // not text baked into the set; no other words on screen.
    const float CenterX = Canvas->SizeX * 0.5f;
    if (!Logo)
    {
        Logo = LoadObject<UTexture2D>(nullptr, TEXT("/Game/Hwanghon/Frontend/T_HW_FE_Logo.T_HW_FE_Logo"), nullptr, LOAD_NoWarn | LOAD_Quiet);
    }
    if (Logo)
    {
        const float LH = Canvas->SizeY * 0.44f;
        const float LW = LH * Logo->GetSizeX() / FMath::Max(1, Logo->GetSizeY());
        FCanvasTileItem Tile(FVector2D(CenterX - LW * 0.5f, Canvas->SizeY * 0.055f), Logo->GetResource(), FVector2D(LW, LH), FLinearColor::White);
        Tile.BlendMode = SE_BLEND_Translucent;
        Canvas->DrawItem(Tile);
    }
    else
    {
        DrawText(TEXT("황혼의 서울"), FLinearColor(0.86f,0.80f,0.69f,1), CenterX - 205*S, 225*S, nullptr, 1.85f*S, false);
    }

    struct FPlate { const TCHAR* Label; const TCHAR* Box; bool bMain; };
    const FPlate Plates[] = { {TEXT("입 장"), TEXT("TITLE_ENTER"), true}, {TEXT("설 정"), TEXT("TITLE_SETTINGS"), false},
                              {TEXT("나 가 기"), TEXT("TITLE_QUIT"), false} };
    const float BW = 320*S, BH = 60*S, Gap = 16*S;
    float BY = Canvas->SizeY * 0.555f;
    for (const FPlate& P : Plates)
    {
        const float BX = CenterX - BW*0.5f;
        HHDrawPanel(Canvas, BX, BY, BW, BH, P.bMain ? FLinearColor(0.035f,0.028f,0.02f,0.82f) : FLinearColor(0.02f,0.02f,0.02f,0.62f));
        const FLinearColor Edge = P.bMain ? FLinearColor(0.85f,0.55f,0.22f,0.95f) : FLinearColor(0.32f,0.30f,0.27f,0.75f);
        const float E = (P.bMain ? 2.f : 1.f) * FMath::Max(1.f, S);
        HHDrawPanel(Canvas, BX, BY, BW, E, Edge);
        HHDrawPanel(Canvas, BX, BY + BH - E, BW, E, Edge);
        HHDrawPanel(Canvas, BX, BY, E, BH, Edge);
        HHDrawPanel(Canvas, BX + BW - E, BY, E, BH, Edge);
        float TW = 0.f, TH = 0.f;
        const float Scale = (P.bMain ? 1.35f : 1.15f) * S;
        GetTextSize(P.Label, TW, TH, nullptr, Scale);
        DrawText(P.Label, P.bMain ? FLinearColor(0.96f,0.90f,0.80f,1) : FLinearColor(0.70f,0.68f,0.64f,1),
            CenterX - TW*0.5f, BY + (BH - TH)*0.5f, nullptr, Scale, false);
        AddHitBox(FVector2D(BX,BY), FVector2D(BW,BH), FName(P.Box), true, P.bMain ? 30 : 10);
        BY += BH + Gap;
    }
}

void AHHCharacterSelectHUD::DrawCharacterCard(
    const TCHAR* Id,
    const TCHAR* KoreanName,
    const TCHAR* RoleLabel,
    const FLinearColor& Accent,
    float X, float Y, float W, float H,
    bool bSelected)
{
    HHDrawPanel(Canvas, X, Y, W, H,
        bSelected
            ? FLinearColor(0.035f,0.038f,0.043f,0.90f)
            : FLinearColor(0.012f,0.014f,0.018f,0.72f));

    HHDrawPanel(Canvas, X, Y, 4.f, H, bSelected ? Accent : FLinearColor(0.19f,0.20f,0.22f,0.8f));

    DrawText(KoreanName,
        FLinearColor::White,
        X+20.f, Y+24.f, nullptr, 1.18f, false);

    DrawText(RoleLabel,
        bSelected ? Accent : FLinearColor(0.52f,0.54f,0.56f,1),
        X+20.f, Y+68.f, nullptr, 0.70f, false);

    AddHitBox(
        FVector2D(X,Y),
        FVector2D(W,H),
        FName(*FString::Printf(TEXT("CHAR_%s"), Id)),
        true,
        10);
}

void AHHCharacterSelectHUD::DrawCharacterSelect(float S)
{
    UHHOnlineFlowSubsystem* Flow = GetGameInstance()
        ? GetGameInstance()->GetSubsystem<UHHOnlineFlowSubsystem>()
        : nullptr;

    const FName Selected = Flow ? Flow->SelectedCharacterId : NAME_None;
    UpdateHeroLights(Selected);

    const float W = 330*S;
    const float H = 154*S;
    const float Gap = 22*S;
    const float Total = 4*W + 3*Gap;
    const float X0 = (Canvas->SizeX - Total)*0.5f;
    const float Y = Canvas->SizeY - 320*S;

    DrawCharacterCard(TEXT("ain"), TEXT("아인"), TEXT("파괴 / 카운터"),
        FLinearColor(0.72f,0.18f,0.13f,1),
        X0, Y, W, H, Selected == TEXT("ain"));

    DrawCharacterCard(TEXT("kain"), TEXT("카인"), TEXT("고정 / 방어"),
        FLinearColor(0.82f,0.38f,0.12f,1),
        X0+(W+Gap), Y, W, H, Selected == TEXT("kain"));

    DrawCharacterCard(TEXT("ryu"), TEXT("류"), TEXT("동시 / 속공"),
        FLinearColor(0.14f,0.48f,0.86f,1),
        X0+2*(W+Gap), Y, W, H, Selected == TEXT("ryu"));

    DrawCharacterCard(TEXT("sera"), TEXT("세라"), TEXT("봉쇄 / 지원"),
        FLinearColor(0.36f,0.66f,0.90f,1),
        X0+3*(W+Gap), Y, W, H, Selected == TEXT("sera"));

    const float BW=330*S, BH=62*S;
    const float BX=(Canvas->SizeX-BW)*0.5f;
    const float BY=Canvas->SizeY-112*S;
    const bool bCanEnter = Flow && !Flow->SelectedCharacterId.IsNone() && !Flow->bMatchmaking;

    HHDrawPanel(Canvas,BX,BY,BW,BH,
        bCanEnter
            ? FLinearColor(0.18f,0.11f,0.055f,0.88f)
            : FLinearColor(0.04f,0.04f,0.04f,0.72f));

    DrawText(Flow && Flow->bMatchmaking ? TEXT("연결 중") : TEXT("선택"),
        bCanEnter ? FLinearColor(0.94f,0.91f,0.84f,1) : FLinearColor(0.43f,0.43f,0.43f,1),
        BX+122*S,BY+16*S,nullptr,0.88f*S,false);

    AddHitBox(FVector2D(BX,BY),FVector2D(BW,BH),FName(TEXT("CONFIRM")),true,20);
}

void AHHCharacterSelectHUD::DrawConnecting(float S)
{
    // Deliberately minimal. The camera glides toward the B-1 route.
    const float CX = Canvas->SizeX*0.5f;
    const float Y = Canvas->SizeY-64*S;

    HHDrawPanel(Canvas,CX-42*S,Y,84*S,2*S,FLinearColor(0.50f,0.29f,0.12f,0.85f));
}

void AHHCharacterSelectHUD::NotifyHitBoxClick(FName BoxName)
{
    UHHOnlineFlowSubsystem* Flow = GetGameInstance()
        ? GetGameInstance()->GetSubsystem<UHHOnlineFlowSubsystem>()
        : nullptr;

    const FString Box = BoxName.ToString();

    if (BoxName == TEXT("TITLE_ENTER"))
    {
        StartEntryReveal();
        return;
    }

    if (BoxName == TEXT("TITLE_QUIT"))
    {
        if (APlayerController* PC = GetOwningPlayerController())
        {
            PC->ConsoleCommand(TEXT("quit"));
        }
        return;
    }

    if (BoxName == TEXT("TITLE_SETTINGS"))
    {
        if (GEngine)
        {
            GEngine->AddOnScreenDebugMessage(-1,2.f,FColor(160,160,160),TEXT("설정 UI 연결 지점"));
        }
        return;
    }

    if (!Flow || Screen != EHHFrontEndScreen::CharacterSelect) return;

    if (Box.StartsWith(TEXT("CHAR_")))
    {
        Flow->SelectCharacter(FName(*Box.RightChop(5)));
        return;
    }

    if (BoxName == TEXT("CONFIRM"))
    {
        ConfirmSelection();
    }
}

void AHHCharacterSelectHUD::StartEntryReveal()
{
    if (Screen != EHHFrontEndScreen::Title) return;

    Screen = EHHFrontEndScreen::RevealTransition;

    if (Director)
    {
        Director->PlayReveal();
    }
    else
    {
        HandleRevealFinished();
    }
}

void AHHCharacterSelectHUD::HandleRevealFinished()
{
    Screen = EHHFrontEndScreen::CharacterSelect;
}

void AHHCharacterSelectHUD::ConfirmSelection()
{
    UHHOnlineFlowSubsystem* Flow = GetGameInstance()
        ? GetGameInstance()->GetSubsystem<UHHOnlineFlowSubsystem>()
        : nullptr;
    APlayerController* PC = GetOwningPlayerController();

    if (!Flow || !PC || Flow->SelectedCharacterId.IsNone() || Flow->bMatchmaking) return;

    Screen = EHHFrontEndScreen::Connecting;

    Flow->SetTravelDeferred(true);
    Flow->RequestShelterAndTravel(PC);

    if (Director)
    {
        Director->PlayConnect();
    }
    else
    {
        Flow->ReleaseDeferredTravel();
    }
}

void AHHCharacterSelectHUD::HandleConnectFinished()
{
    if (UHHOnlineFlowSubsystem* Flow = GetGameInstance()
        ? GetGameInstance()->GetSubsystem<UHHOnlineFlowSubsystem>()
        : nullptr)
    {
        Flow->ReleaseDeferredTravel();
    }
}


void AHHCharacterSelectHUD::HandleMatchmakingFailed(const FString& Reason)
{
    Screen = EHHFrontEndScreen::CharacterSelect;

    if (Director)
    {
        Director->ResetToSelection();
    }

    if (GEngine)
    {
        GEngine->AddOnScreenDebugMessage(-1,3.f,FColor(190,110,75),Reason);
    }
}

void AHHCharacterSelectHUD::UpdateHeroLights(FName Selected)
{
    // HwanghonCombatUE (doc 158): the set's heroes (Scripts/ue_frontend_set.py) each have a key light tagged
    // HH_HeroLight_<id>; the chosen one stands lit, the others dim.
    if (Selected == LitHero || !GetWorld()) return;
    LitHero = Selected;
    for (TActorIterator<AActor> It(GetWorld()); It; ++It)
    {
        for (const FName& Tag : It->Tags)
        {
            const FString T = Tag.ToString();
            if (!T.StartsWith(TEXT("HH_HeroLight_"))) continue;
            const bool bOn = !Selected.IsNone() && T.RightChop(13) == Selected.ToString();
            TArray<ULightComponent*> Lights;
            It->GetComponents(Lights);
            for (ULightComponent* L : Lights) L->SetIntensity(bOn ? HeroLightOn : HeroLightOff);
        }
    }
}
