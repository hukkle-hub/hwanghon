#include "Game/HWLoadingFlow.h"
#include "Progression/HWProfileSubsystem.h"

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

    // the hero the boss trials (and the story) play, above the cards (docs/design/184): the saved selection
    {
        struct FHero { FName Id; const TCHAR* Name; };
        const FHero Heroes[] = { {TEXT("ain"), TEXT("아인")}, {TEXT("sera"), TEXT("세라")}, {TEXT("kain"), TEXT("카인")}, {TEXT("ryu"), TEXT("류")} };
        const UHWProfileSubsystem* Profile = GetGameInstance() ? GetGameInstance()->GetSubsystem<UHWProfileSubsystem>() : nullptr;
        const FName Current = Profile ? Profile->GetSelectedCharacter() : FName(TEXT("ain"));
        const float HW = 190 * S, HH = 84 * S, HGap = 18 * S;
        const float HY = Y - HH - 40 * S, HX0 = (Canvas->SizeX - 4 * HW - 3 * HGap) / 2;
        for (int32 i = 0; i < 4; ++i)
        {
            const float X = HX0 + i * (HW + HGap);
            const bool bOn = Heroes[i].Id == Current;
            HWPanel(Canvas, X, HY, HW, HH, bOn ? FLinearColor(0.18f, 0.12f, 0.06f, 0.96f) : FLinearColor(0.03f, 0.034f, 0.04f, 0.94f));
            if (bOn) HWPanel(Canvas, X, HY + HH - 5 * S, HW, 5 * S, FLinearColor(0.94f, 0.62f, 0.2f, 1));
            DrawText(Heroes[i].Name, bOn ? FLinearColor::White : FLinearColor(0.7f, 0.72f, 0.74f, 1), X + 34 * S, HY + 22 * S, nullptr, 1.15f * S, false);
            AddHitBox(FVector2D(X, HY), FVector2D(HW, HH), FName(*(TEXT("HERO_") + Heroes[i].Id.ToString())), true, 10);
        }
    }

    // boss trials under the cards (docs/design/181 §10): the three Part 1 bosses with their designed skills, kept
    // between the two touch sticks, each button 100 px tall (thumb size on the tablet)
    struct FBoss { FName Box; const TCHAR* Name; };
    const FBoss Bosses[] = { {TEXT("BOSS_shadow_fang"), TEXT("섀도우 팽")}, {TEXT("BOSS_subject_09"), TEXT("실험체 09호")}, {TEXT("BOSS_clave"), TEXT("클레이브")} };
    const float BW = 300 * S, BH = 100 * S, BGap = 24 * S;
    const float BY = Y + H + 46 * S, BX0 = (Canvas->SizeX - 3 * BW - 2 * BGap) / 2;
    DrawText(TEXT("보스전 시험 · 보상 없음"), FLinearColor(0.72f, 0.74f, 0.76f, 1), BX0, BY - 34 * S, nullptr, 0.9f * S, false);
    for (int32 i = 0; i < 3; ++i)
    {
        const float X = BX0 + i * (BW + BGap);
        HWPanel(Canvas, X, BY, BW, BH, FLinearColor(0.03f, 0.034f, 0.04f, 0.94f));
        HWPanel(Canvas, X, BY + BH - 4 * S, BW, 4 * S, FLinearColor(0.6f, 0.45f, 0.95f, 1));
        DrawText(Bosses[i].Name, FLinearColor::White, X + 36 * S, BY + 30 * S, nullptr, 1.2f * S, false);
        AddHitBox(FVector2D(X, BY), FVector2D(BW, BH), Bosses[i].Box, true, 10);
    }
}

void AHWLoadingHUD::NotifyHitBoxClick(FName BoxName)
{
    if (BoxName == TEXT("STORY")) ChooseStory();
    else if (BoxName == TEXT("SHELTER")) ChooseShelter();
    else if (BoxName.ToString().StartsWith(TEXT("BOSS_"))) ChooseBossTrial(FName(*(TEXT("boss_") + BoxName.ToString().RightChop(5))));
    else if (BoxName.ToString().StartsWith(TEXT("HERO_")))
    {
        if (UHWProfileSubsystem* Profile = GetGameInstance() ? GetGameInstance()->GetSubsystem<UHWProfileSubsystem>() : nullptr)
        {
            Profile->SelectCharacter(FName(*BoxName.ToString().RightChop(5)));
        }
    }
}

void AHWLoadingHUD::ChooseStory()
{
    LastChoice = TEXT("story");
    UE_LOG(LogTemp, Display, TEXT("[HWFlow] loading -> story %s"), *StoryMap);
    UGameplayStatics::OpenLevel(this, FName(*StoryMap));
}

void AHWLoadingHUD::ChooseBossTrial(FName DungeonId)
{
    LastChoice = DungeonId;
    UE_LOG(LogTemp, Display, TEXT("[HWFlow] loading -> boss trial %s"), *DungeonId.ToString());
    UGameplayStatics::OpenLevel(this, TEXT("Seohan_Combat_VS01"), true, TEXT("HWDungeon=") + DungeonId.ToString());
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
