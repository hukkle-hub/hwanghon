#include "HHCharacterSelectHUD.h"
#include "HHCharacterSelectStand.h"
#include "HHFrontEndCinematicDirector.h"
#include "HHOnlineFlowSubsystem.h"

#include "CanvasItem.h"
#include "Engine/Canvas.h"
#include "Engine/Texture2D.h"
#include "Engine/Engine.h"
#include "Engine/GameInstance.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"

static void HHDrawPanel(UCanvas* Canvas, float X, float Y, float W, float H, const FLinearColor& Color)
{
    if (!Canvas) return;
    FCanvasTileItem Tile(FVector2D(X,Y), FVector2D(W,H), Color);
    Tile.BlendMode = SE_BLEND_Translucent;
    Canvas->DrawItem(Tile);
}

static int32 HHCharIndex(FName Id)
{
    const FString S = Id.ToString().ToLower();
    if (S == TEXT("ain")) return 0;
    if (S == TEXT("kain")) return 1;
    if (S == TEXT("ryu")) return 2;
    if (S == TEXT("sera")) return 3;
    return 0;
}

static FName HHCharAt(int32 Index)
{
    static const FName Ids[] = { TEXT("ain"), TEXT("kain"), TEXT("ryu"), TEXT("sera") };
    return Ids[(Index % 4 + 4) % 4];
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

        for (TActorIterator<AHHCharacterSelectStand> It(GetWorld()); It; ++It)
        {
            CharacterStand = *It;
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

    switch (Screen)
    {
        case EHHFrontEndScreen::Title:
            DrawTitle(S);
            break;
        case EHHFrontEndScreen::RevealTransition:
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
    // HwanghonCombatUE (docs 158/159): the logo is a texture cut from the director's selected concept
    // (tools/frontend/make_frontend_tex.py), not text; v8 minimal - one 입장 plate, 설정 / 나가기 small in the corners.
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

    const float BW = 320*S, BH = 60*S;
    const float BX = CenterX - BW*0.5f;
    const float BY = Canvas->SizeY * 0.555f;
    const float E = 2.f * FMath::Max(1.f, S);
    const FLinearColor Edge(0.85f,0.55f,0.22f,0.95f);
    HHDrawPanel(Canvas, BX, BY, BW, BH, FLinearColor(0.035f,0.028f,0.02f,0.82f));
    HHDrawPanel(Canvas, BX, BY, BW, E, Edge);
    HHDrawPanel(Canvas, BX, BY + BH - E, BW, E, Edge);
    HHDrawPanel(Canvas, BX, BY, E, BH, Edge);
    HHDrawPanel(Canvas, BX + BW - E, BY, E, BH, Edge);
    float TW = 0.f, TH = 0.f;
    GetTextSize(TEXT("입 장"), TW, TH, nullptr, 1.35f*S);
    DrawText(TEXT("입 장"), FLinearColor(0.96f,0.90f,0.80f,1), CenterX - TW*0.5f, BY + (BH - TH)*0.5f, nullptr, 1.35f*S, false);
    AddHitBox(FVector2D(BX,BY), FVector2D(BW,BH), FName(TEXT("TITLE_ENTER")), true, 30);

    // small corner controls (the ⚙ / × glyphs of v8 are not in the canvas font)
    const FLinearColor Dim(0.46f,0.46f,0.45f,1);
    DrawText(TEXT("설정"), Dim, 46*S, Canvas->SizeY-58*S, nullptr, 0.8f*S, false);
    AddHitBox(FVector2D(28*S,Canvas->SizeY-74*S),FVector2D(96*S,48*S),FName(TEXT("TITLE_SETTINGS")),true,10);
    DrawText(TEXT("나가기"), Dim, Canvas->SizeX-118*S, Canvas->SizeY-58*S, nullptr, 0.8f*S, false);
    AddHitBox(FVector2D(Canvas->SizeX-130*S,Canvas->SizeY-74*S),FVector2D(110*S,48*S),FName(TEXT("TITLE_QUIT")),true,10);
}

void AHHCharacterSelectHUD::DrawCharacterSelect(float S)
{
    UHHOnlineFlowSubsystem* Flow = GetGameInstance()
        ? GetGameInstance()->GetSubsystem<UHHOnlineFlowSubsystem>()
        : nullptr;

    if (!Flow) return;

    const FName Selected = Flow->SelectedCharacterId.IsNone()
        ? FName(TEXT("ain"))
        : Flow->SelectedCharacterId;

    const float CX = Canvas->SizeX*0.5f;
    const float BaseY = Canvas->SizeY - 215*S;

    // Single-character presentation. One short role line + one short gameplay sentence.
    const FString Name = CharacterStand
        ? CharacterStand->GetSelectedDisplayName().ToString()
        : (Selected == TEXT("kain") ? TEXT("카인")
            : Selected == TEXT("ryu") ? TEXT("류")
            : Selected == TEXT("sera") ? TEXT("세라")
            : TEXT("아인"));

    const FString RoleLine = CharacterStand
        ? CharacterStand->GetSelectedRoleText().ToString()
        : (Selected == TEXT("kain") ? TEXT("고정 · 방어")
            : Selected == TEXT("ryu") ? TEXT("동시 · 속공")
            : Selected == TEXT("sera") ? TEXT("봉쇄 · 지원")
            : TEXT("파괴 · 카운터"));

    const FString Description = CharacterStand
        ? CharacterStand->GetSelectedDescriptionText().ToString()
        : TEXT("");

    // HwanghonCombatUE: centred on the screen whatever the name's length (v9 used fixed offsets)
    auto Centred = [&](const FString& Text, const FLinearColor& Color, float Y, float Scale)
    {
        float TW = 0.f, TH = 0.f;
        GetTextSize(Text, TW, TH, nullptr, Scale);
        DrawText(Text, Color, CX - TW * 0.5f, Y, nullptr, Scale, false);
    };
    Centred(Name, FLinearColor(0.95f,0.94f,0.91f,1), BaseY - 8*S, 1.9f*S);
    Centred(RoleLine, FLinearColor(0.78f,0.55f,0.30f,1), BaseY + 44*S, 0.95f*S);
    if (!Description.IsEmpty())
    {
        // Intentionally one sentence only; no card-sized lore copy.
        Centred(Description, FLinearColor(0.72f,0.72f,0.70f,0.95f), BaseY + 76*S, 0.85f*S);
    }

    // Left / right selection areas.
    DrawText(TEXT("‹"),
        FLinearColor(0.62f,0.63f,0.64f,0.92f),
        CX-262*S, BaseY-14*S, nullptr, 2.6f*S, false);

    DrawText(TEXT("›"),
        FLinearColor(0.62f,0.63f,0.64f,0.92f),
        CX+232*S, BaseY-14*S, nullptr, 2.6f*S, false);

    AddHitBox(
        FVector2D(CX-330*S, BaseY-30*S),
        FVector2D(170*S, 110*S),
        FName(TEXT("CHAR_PREV")), true, 15);

    AddHitBox(
        FVector2D(CX+165*S, BaseY-30*S),
        FVector2D(170*S, 110*S),
        FName(TEXT("CHAR_NEXT")), true, 15);

    // Four tiny state marks, no labels.
    const int32 SelectedIndex = HHCharIndex(Selected);
    for (int32 i=0;i<4;i++)
    {
        const float X = CX + (i-1.5f)*20*S;
        const FLinearColor C = i==SelectedIndex
            ? FLinearColor(0.70f,0.43f,0.20f,0.95f)
            : FLinearColor(0.25f,0.26f,0.27f,0.70f);
        HHDrawPanel(Canvas,X,BaseY+108*S,8*S,2*S,C);
    }

    const float BW=250*S, BH=54*S;
    const float BX=CX-BW*0.5f;
    const float BY=Canvas->SizeY-82*S;
    const bool bCanEnter = !Flow->bMatchmaking;

    HHDrawPanel(Canvas,BX,BY,BW,BH,
        bCanEnter
            ? FLinearColor(0.15f,0.095f,0.05f,0.84f)
            : FLinearColor(0.035f,0.035f,0.035f,0.70f));

    DrawText(Flow->bMatchmaking ? TEXT("연결 중") : TEXT("선택"),
        bCanEnter ? FLinearColor(0.94f,0.91f,0.84f,1) : FLinearColor(0.42f,0.42f,0.42f,1),
        BX+91*S,BY+13*S,nullptr,0.78f*S,false);

    AddHitBox(FVector2D(BX,BY),FVector2D(BW,BH),FName(TEXT("CONFIRM")),true,20);
}

void AHHCharacterSelectHUD::DrawConnecting(float S)
{
    const float CX = Canvas->SizeX*0.5f;
    const float Y = Canvas->SizeY-54*S;
    HHDrawPanel(Canvas,CX-35*S,Y,70*S,2*S,FLinearColor(0.50f,0.29f,0.12f,0.82f));
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
            GEngine->AddOnScreenDebugMessage(-1,2.f,FColor(140,140,140),TEXT("설정 UI 연결 지점"));
        }
        return;
    }

    if (!Flow || Screen != EHHFrontEndScreen::CharacterSelect) return;

    if (BoxName == TEXT("CHAR_PREV"))
    {
        SelectRelative(-1);
        return;
    }

    if (BoxName == TEXT("CHAR_NEXT"))
    {
        SelectRelative(+1);
        return;
    }

    if (BoxName == TEXT("CONFIRM"))
    {
        ConfirmSelection();
    }
}

void AHHCharacterSelectHUD::SelectRelative(int32 Delta)
{
    UHHOnlineFlowSubsystem* Flow = GetGameInstance()
        ? GetGameInstance()->GetSubsystem<UHHOnlineFlowSubsystem>()
        : nullptr;
    if (!Flow) return;

    const FName Current = Flow->SelectedCharacterId.IsNone()
        ? FName(TEXT("ain"))
        : Flow->SelectedCharacterId;

    const FName Next = HHCharAt(HHCharIndex(Current)+Delta);
    Flow->SelectCharacter(Next);

    if (CharacterStand)
    {
        CharacterStand->SetSelectedCharacter(Next);
    }
}

void AHHCharacterSelectHUD::SyncStandFromFlow()
{
    UHHOnlineFlowSubsystem* Flow = GetGameInstance()
        ? GetGameInstance()->GetSubsystem<UHHOnlineFlowSubsystem>()
        : nullptr;

    if (!Flow) return;

    if (Flow->SelectedCharacterId.IsNone())
    {
        Flow->SelectCharacter(TEXT("ain"));
    }

    if (CharacterStand)
    {
        CharacterStand->SetSelectedCharacter(Flow->SelectedCharacterId);
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
    SyncStandFromFlow();

    if (CharacterStand)
    {
        CharacterStand->SetSelectionVisible(true);
    }
}

void AHHCharacterSelectHUD::ConfirmSelection()
{
    UHHOnlineFlowSubsystem* Flow = GetGameInstance()
        ? GetGameInstance()->GetSubsystem<UHHOnlineFlowSubsystem>()
        : nullptr;
    APlayerController* PC = GetOwningPlayerController();

    if (!Flow || !PC || Flow->SelectedCharacterId.IsNone() || Flow->bMatchmaking) return;

    Screen = EHHFrontEndScreen::Connecting;

    if (CharacterStand)
    {
        // Character-specific confirm pose/montage plays while the camera starts moving.
        CharacterStand->PlayConfirmPresentation();
    }

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

    if (CharacterStand)
    {
        CharacterStand->SetSelectionVisible(true);
    }

    if (GEngine)
    {
        GEngine->AddOnScreenDebugMessage(-1,3.f,FColor(170,100,70),Reason);
    }
}
