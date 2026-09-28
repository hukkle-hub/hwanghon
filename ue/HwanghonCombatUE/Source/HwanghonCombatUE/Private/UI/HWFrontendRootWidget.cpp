#include "UI/HWFrontendRootWidget.h"

#include "Blueprint/WidgetTree.h"
#include "Components/BackgroundBlur.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/Image.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"
#include "Engine/Texture2D.h"
#include "Game/HWQuestRunSubsystem.h"
#include "Graphics/HWGraphicsQualitySubsystem.h"
#include "InputCoreTypes.h"
#include "Kismet/GameplayStatics.h"
#include "Progression/HWProfileSubsystem.h"
#include "Network/HWRaidNetworkSubsystem.h"
#include "UI/HWFrontendScreens.h"
#include "UI/HWUICatalog.h"

using namespace HWUI;

namespace
{
    TWeakObjectPtr<UHWFrontendRootWidget> GActiveRoot;

    struct FNavItem
    {
        EHWFrontendScreen Screen;
        const TCHAR* Label;
    };

    const FNavItem NavItems[] = {
        { EHWFrontendScreen::Lobby, TEXT("로비") },
        { EHWFrontendScreen::OfficeQuest, TEXT("의뢰") },
        { EHWFrontendScreen::Character, TEXT("캐릭터") },
        { EHWFrontendScreen::Inventory, TEXT("가방") },
        { EHWFrontendScreen::Skills, TEXT("스킬") },
        { EHWFrontendScreen::Forge, TEXT("공방") },
        { EHWFrontendScreen::Shop, TEXT("상점") },
        { EHWFrontendScreen::Looks, TEXT("외형") },
    };

    constexpr float DrawerSeconds = 0.2f;   // spec §7: drawer 180-220 ms
    constexpr float ModalSeconds = 0.16f;   // spec §7: modal 140-180 ms
    const TCHAR* TrainingMap = TEXT("Seohan_Combat_VS01");
}

UHWFrontendRootWidget* UHWFrontendRootWidget::GetActive()
{
    return GActiveRoot.Get();
}

UHWScreenWidget* UHWFrontendRootWidget::MakeWidget(const TCHAR* WbpName, UClass* NativeClass)
{
    const FString Path = FString::Printf(TEXT("/Game/UI/Screens/%s.%s_C"), WbpName, WbpName);
    UClass* Class = LoadClass<UHWScreenWidget>(nullptr, *Path, nullptr, LOAD_NoWarn | LOAD_Quiet);
    if (!Class || !Class->IsChildOf(NativeClass))
    {
        Class = NativeClass;
    }
    UHWScreenWidget* Widget = CreateWidget<UHWScreenWidget>(GetOwningPlayer(), Class);
    if (Widget)
    {
        Widget->SetFrontend(this);
    }
    return Widget;
}

UHWScreenWidget* UHWFrontendRootWidget::GetScreenWidget(EHWFrontendScreen Screen)
{
    if (TObjectPtr<UHWScreenWidget>* Found = Screens.Find(Screen))
    {
        return *Found;
    }
    UHWScreenWidget* Widget = nullptr;
    switch (Screen)
    {
        case EHWFrontendScreen::Title: Widget = MakeWidget(TEXT("WBP_Title"), UHWTitleScreen::StaticClass()); break;
        case EHWFrontendScreen::Lobby: Widget = MakeWidget(TEXT("WBP_Lobby"), UHWLobbyScreen::StaticClass()); break;
        case EHWFrontendScreen::OfficeQuest: Widget = MakeWidget(TEXT("WBP_OfficeQuest"), UHWOfficeQuestScreen::StaticClass()); break;
        case EHWFrontendScreen::Character: Widget = MakeWidget(TEXT("WBP_Character"), UHWCharacterScreen::StaticClass()); break;
        case EHWFrontendScreen::Inventory: Widget = MakeWidget(TEXT("WBP_Inventory"), UHWInventoryScreen::StaticClass()); break;
        case EHWFrontendScreen::Skills: Widget = MakeWidget(TEXT("WBP_Skills"), UHWSkillsScreen::StaticClass()); break;
        case EHWFrontendScreen::Forge: Widget = MakeWidget(TEXT("WBP_Forge"), UHWForgeScreen::StaticClass()); break;
        case EHWFrontendScreen::Shop: Widget = MakeWidget(TEXT("WBP_Shop"), UHWShopScreen::StaticClass()); break;
        case EHWFrontendScreen::Looks: Widget = MakeWidget(TEXT("WBP_Looks"), UHWLooksScreen::StaticClass()); break;
        case EHWFrontendScreen::Profile: Widget = MakeWidget(TEXT("WBP_Profile"), UHWProfileScreen::StaticClass()); break;
    }
    if (Widget)
    {
        Screens.Add(Screen, Widget);
        Stretch(ScreenLayer, Widget);
        Widget->SetVisibility(ESlateVisibility::Collapsed);
    }
    return Widget;
}

void UHWFrontendRootWidget::Build(UCanvasPanel* Root)
{
    UImage* BackgroundImage = nullptr;
    Stretch(Root, Fit(WidgetTree, Art(TEXT("lobby-bg")), true, &BackgroundImage));
    Background = BackgroundImage;
    BackgroundDim = Fill(WidgetTree, C(EHWUIColorToken::OverlayDim, 0.4f));
    Stretch(Root, BackgroundDim);

    ScreenLayer = WidgetTree->ConstructWidget<UCanvasPanel>(UCanvasPanel::StaticClass(), TEXT("ScreenLayer"));
    ScreenLayer->SetVisibility(ESlateVisibility::SelfHitTestInvisible);
    Stretch(Root, ScreenLayer);

    ChromeLayer = WidgetTree->ConstructWidget<UCanvasPanel>(UCanvasPanel::StaticClass(), TEXT("ChromeLayer"));
    ChromeLayer->SetVisibility(ESlateVisibility::SelfHitTestInvisible);
    Stretch(Root, ChromeLayer);

    OverlayLayer = WidgetTree->ConstructWidget<UCanvasPanel>(UCanvasPanel::StaticClass(), TEXT("OverlayLayer"));
    OverlayLayer->SetVisibility(ESlateVisibility::Collapsed);
    Stretch(Root, OverlayLayer);

    ToastText = Text(WidgetTree, FText::GetEmpty(), EHWUITextToken::Body, EHWUIColorToken::TextPrimary, EHWUIWeight::Medium);
    UBorder* ToastPanel = Panel(WidgetTree, Box(C(EHWUIColorToken::PanelStrong), 4.f), FMargin(22.f, 12.f));
    ToastPanel->SetContent(ToastText);
    ToastPanel->SetVisibility(ESlateVisibility::Collapsed);
    Place(Root, ToastPanel, FAnchors(0.5f, 0.f), FMargin(0.f, ContentTop(), 0.f, 0.f), FVector2D(0.5f, 0.f), true);
}

void UHWFrontendRootWidget::NativeConstruct()
{
    Super::NativeConstruct();
    GActiveRoot = this;
    SetIsFocusable(true);
    if (UHWProfileSubsystem* Profile = ProfileSystem())
    {
        if (Profile->IsProfileAvailable()) SelectedCharacter = Profile->GetSelectedCharacter();
    }
    if (!Screens.Contains(Current) || Current == EHWFrontendScreen::Title)
    {
        ShowScreen(EHWFrontendScreen::Title);
    }
}

void UHWFrontendRootWidget::NativeDestruct()
{
    if (GActiveRoot.Get() == this)
    {
        GActiveRoot.Reset();
    }
    Super::NativeDestruct();
}

void UHWFrontendRootWidget::ShowScreen(EHWFrontendScreen Screen)
{
    if (!ScreenLayer)
    {
        return;
    }
    if (TObjectPtr<UHWScreenWidget>* Old = Screens.Find(Current))
    {
        if (*Old)
        {
            (*Old)->SetVisibility(ESlateVisibility::Collapsed);
        }
    }
    UHWScreenWidget* Widget = GetScreenWidget(Screen);
    Current = Screen;
    if (!Widget)
    {
        return;
    }
    Widget->SetVisibility(ESlateVisibility::SelfHitTestInvisible);
    ApplyBackground(Widget);
    RefreshChrome();
    Widget->OnShown();
}

void UHWFrontendRootWidget::ApplyBackground(UHWScreenWidget* Screen)
{
    if (Background)
    {
        if (UTexture2D* Texture = Art(Screen->GetBackgroundArt()))
        {
            Background->SetBrushFromTexture(Texture, true);
        }
    }
    if (BackgroundDim)
    {
        BackgroundDim->SetColorAndOpacity(FLinearColor(1.f, 1.f, 1.f, FMath::Clamp(Screen->GetBackgroundDim(), 0.f, 1.f)));
    }
}

void UHWFrontendRootWidget::RefreshChrome()
{
    if (!ChromeLayer)
    {
        return;
    }
    ChromeLayer->ClearChildren();
    const UHWScreenWidget* Widget = Screens.FindRef(Current);
    if (!Widget || !Widget->ShowsChrome())
    {
        return;
    }
    BuildTopBar();
    BuildBottomNav();
}

void UHWFrontendRootWidget::SetArtOnly(bool bArtOnly)
{
    // Background art and its dim stay; chrome, toast and the screen's panels go.
    if (ChromeLayer)
    {
        ChromeLayer->SetVisibility(bArtOnly ? ESlateVisibility::Hidden : ESlateVisibility::SelfHitTestInvisible);
    }
    if (ToastText && ToastText->GetParent() && bArtOnly)
    {
        ToastText->GetParent()->SetVisibility(ESlateVisibility::Collapsed);
    }
    if (UHWScreenWidget* Widget = Screens.FindRef(Current))
    {
        Widget->SetArtOnly(bArtOnly);
    }
}

void UHWFrontendRootWidget::BuildTopBar()
{
    const FHWUICatalog& Catalog = FHWUICatalog::Get();
    UHorizontalBox* Bar = HBox(WidgetTree);

    // Left: profile on the lobby, back + page title elsewhere.
    if (Current == EHWFrontendScreen::Lobby)
    {
        UHorizontalBox* Who = HBox(WidgetTree);
        AddH(Who, Sized(WidgetTree, Fit(WidgetTree, Art(TEXT("face-ain")), true), 52.f, 52.f), FMargin(0.f, 0.f, 14.f, 0.f))
            ->SetVerticalAlignment(VAlign_Center);
        UVerticalBox* Names = VBox(WidgetTree);
        const FHWUICharacter* Ain = Catalog.FindCharacter(TEXT("ain"));
        AddV(Names, Text(WidgetTree, FText::FromString(Ain ? Ain->Name : TEXT("아인")), EHWUITextToken::SectionTitle,
            EHWUIColorToken::TextPrimary, EHWUIWeight::Bold));
        AddV(Names, Text(WidgetTree, FText::FromString(Ain ? FString::Printf(TEXT("Lv %d · 전투력 %s"), Ain->Level, *FText::AsNumber(Ain->CombatPower).ToString()) : FString()),
            EHWUITextToken::Caption, EHWUIColorToken::TextSecondary));
        AddH(Who, Names)->SetVerticalAlignment(VAlign_Center);
        AddH(Bar, TapGhost(Who, [this]() { ShowScreen(EHWFrontendScreen::Profile); }, FMargin(8.f, 6.f)))
            ->SetVerticalAlignment(VAlign_Center);
    }
    else
    {
        UHorizontalBox* Back = HBox(WidgetTree);
        AddH(Back, Text(WidgetTree, FText::FromString(TEXT("‹")), EHWUITextToken::PageTitle, EHWUIColorToken::TextSecondary),
            FMargin(0.f, 0.f, 16.f, 0.f))->SetVerticalAlignment(VAlign_Center);
        const UHWScreenWidget* Widget = Screens.FindRef(Current);
        AddH(Back, Text(WidgetTree, Widget ? Widget->GetScreenTitle() : FText::GetEmpty(), EHWUITextToken::PageTitle,
            EHWUIColorToken::TextPrimary, EHWUIWeight::Bold))->SetVerticalAlignment(VAlign_Center);
        AddH(Bar, TapGhost(Back, [this]() { GoBack(); }, FMargin(8.f, 6.f)))->SetVerticalAlignment(VAlign_Center);
    }
    AddH(Bar, Gap(WidgetTree, 1.f, 1.f), FMargin(0), true);

    // Right: currencies and state, small and quiet.
    UHWProfileSubsystem* Profile = ProfileSystem();
    UHWGraphicsQualitySubsystem* Graphics = GraphicsSystem();
    auto Chip = [this](const FText& Key, const FText& Value, EHWUIColorToken ValueColor)
    {
        UHorizontalBox* Row = HBox(WidgetTree);
        AddH(Row, Text(WidgetTree, Key, EHWUITextToken::Caption, EHWUIColorToken::TextMuted), FMargin(0.f, 0.f, 10.f, 0.f))
            ->SetVerticalAlignment(VAlign_Center);
        AddH(Row, Text(WidgetTree, Value, EHWUITextToken::Body, ValueColor, EHWUIWeight::Medium))->SetVerticalAlignment(VAlign_Center);
        UBorder* Holder = Panel(WidgetTree, Box(C(EHWUIColorToken::Panel, 0.62f), 4.f), FMargin(18.f, 10.f));
        Holder->SetContent(Row);
        return Holder;
    };
    const bool bProfile = Profile && Profile->IsProfileAvailable();
    AddH(Bar, Chip(NSLOCTEXT("HWUI", "Gold", "골드"), bProfile ? Num(Profile->GetGold()) : FText::FromString(TEXT("—")),
        EHWUIColorToken::TextPrimary), FMargin(M(EHWUIMetricToken::CardGap), 0.f, 0.f, 0.f))->SetVerticalAlignment(VAlign_Center);
    AddH(Bar, Chip(NSLOCTEXT("HWUI", "Exp", "경험치"), bProfile ? Num(Profile->GetExperience()) : FText::FromString(TEXT("—")),
        EHWUIColorToken::TextPrimary), FMargin(M(EHWUIMetricToken::CardGap), 0.f, 0.f, 0.f))->SetVerticalAlignment(VAlign_Center);
    const TCHAR* TierName = TEXT("—");
    if (Graphics)
    {
        switch (Graphics->GetCurrentTier())
        {
            case EHWGraphicsTier::High: TierName = TEXT("High"); break;
            case EHWGraphicsTier::Mid: TierName = TEXT("Mid"); break;
            default: TierName = TEXT("Low"); break;
        }
    }
    AddH(Bar, Chip(NSLOCTEXT("HWUI", "Tier", "그래픽"), FText::FromString(TierName), EHWUIColorToken::TextSecondary),
        FMargin(M(EHWUIMetricToken::CardGap), 0.f, 0.f, 0.f))->SetVerticalAlignment(VAlign_Center);

    Place(ChromeLayer, Bar, FAnchors(0.f, 0.f, 1.f, 0.f),
        FMargin(SafeX(), M(EHWUIMetricToken::SafeTop), SafeX(), M(EHWUIMetricToken::TopBarHeight)));
}

void UHWFrontendRootWidget::BuildBottomNav()
{
    const float NavHeight = M(EHWUIMetricToken::BottomNavHeight);
    const float Bottom = M(EHWUIMetricToken::SafeBottom);

    // Near-transparent strip so the labels read on any art (spec §5 Bottom Navigation).
    UImage* Strip = Fill(WidgetTree, C(EHWUIColorToken::BackgroundDeep, 0.42f));
    Strip->SetVisibility(ESlateVisibility::HitTestInvisible);
    Place(ChromeLayer, Strip, FAnchors(0.f, 1.f, 1.f, 1.f), FMargin(0.f, -(NavHeight + Bottom), 0.f, NavHeight + Bottom));

    UHorizontalBox* Row = HBox(WidgetTree);
    for (const FNavItem& Item : NavItems)
    {
        const bool bSelected = Item.Screen == Current;
        UVerticalBox* Stack = VBox(WidgetTree);
        UTextBlock* Label = Text(WidgetTree, FText::FromString(Item.Label), EHWUITextToken::Body,
            bSelected ? EHWUIColorToken::Gold : EHWUIColorToken::TextMuted,
            bSelected ? EHWUIWeight::Bold : EHWUIWeight::Regular);
        AddV(Stack, Label)->SetHorizontalAlignment(HAlign_Center);
        AddV(Stack, Sized(WidgetTree, Fill(WidgetTree, bSelected ? C(EHWUIColorToken::Gold) : FLinearColor::Transparent),
            40.f, M(EHWUIMetricToken::SelectionBar)), FMargin(0.f, 10.f, 0.f, 0.f))->SetHorizontalAlignment(HAlign_Center);
        const EHWFrontendScreen Target = Item.Screen;
        AddH(Row, Sized(WidgetTree, TapGhost(Stack, [this, Target]() { ShowScreen(Target); }, FMargin(0.f, 22.f, 0.f, 12.f)),
            148.f, NavHeight));
    }
    Place(ChromeLayer, Row, FAnchors(0.5f, 1.f), FMargin(0.f, -Bottom, 0.f, 0.f), FVector2D(0.5f, 1.f), true);
}

void UHWFrontendRootWidget::OpenOverlay(EHWFrontendOverlay InOverlay)
{
    if (!OverlayLayer)
    {
        return;
    }
    OverlayLayer->ClearChildren();
    OverlayWidget = nullptr;
    OverlayPanel = nullptr;
    Overlay = InOverlay;
    if (Overlay == EHWFrontendOverlay::None)
    {
        OverlayLayer->SetVisibility(ESlateVisibility::Collapsed);
        return;
    }

    // Blur policy (spec §5, docs/design/123 §7): High may use one full-screen blur behind the
    // drawer/modal; Mid/Low use OverlayDim + PanelStrong only.
    UHWGraphicsQualitySubsystem* Graphics = GraphicsSystem();
    const bool bHigh = Graphics && Graphics->GetCurrentTier() == EHWGraphicsTier::High;
    UWidget* Backdrop = nullptr;
    if (bHigh)
    {
        UBackgroundBlur* Blur = WidgetTree->ConstructWidget<UBackgroundBlur>();
        Blur->SetBlurStrength(8.f);
        Blur->SetContent(Fill(WidgetTree, C(EHWUIColorToken::OverlayDim, 0.35f)));
        Backdrop = Blur;
    }
    else
    {
        Backdrop = Fill(WidgetTree, C(EHWUIColorToken::OverlayDim));
    }
    Stretch(OverlayLayer, Tap(Backdrop, [this]() { CloseOverlay(); }, Box(FLinearColor::Transparent),
        Box(FLinearColor::Transparent), Box(FLinearColor::Transparent)));

    const bool bDrawer = Overlay == EHWFrontendOverlay::Recruit;
    switch (Overlay)
    {
        case EHWFrontendOverlay::Recruit: OverlayWidget = MakeWidget(TEXT("WBP_Recruit"), UHWRecruitDrawer::StaticClass()); break;
        case EHWFrontendOverlay::Result: OverlayWidget = MakeWidget(TEXT("WBP_Result"), UHWResultModal::StaticClass()); break;
        case EHWFrontendOverlay::Story: OverlayWidget = MakeWidget(TEXT("WBP_StoryDialogue"), UHWStoryModal::StaticClass()); break;
        default: break;
    }
    UBorder* Frame = Panel(WidgetTree, Box(C(EHWUIColorToken::PanelStrong), bDrawer ? 0.f : 6.f,
        C(EHWUIColorToken::Line), M(EHWUIMetricToken::Border)), FMargin(0));
    if (OverlayWidget)
    {
        Frame->SetContent(OverlayWidget);
    }
    if (bDrawer)
    {
        Place(OverlayLayer, Frame, FAnchors(1.f, 0.f, 1.f, 1.f), FMargin(0.f, 0.f, M(EHWUIMetricToken::DrawerWidth), 0.f), FVector2D(1.f, 0.f));
    }
    else
    {
        Place(OverlayLayer, Frame, FAnchors(0.5f, 0.5f),
            FMargin(0.f, 0.f, M(EHWUIMetricToken::ModalWidth), M(EHWUIMetricToken::ModalHeight)), FVector2D(0.5f, 0.5f));
    }
    OverlayPanel = Frame;
    OverlayT = 0.f;
    OverlayLayer->SetVisibility(ESlateVisibility::SelfHitTestInvisible);
    if (OverlayWidget)
    {
        OverlayWidget->OnShown();
    }
}

void UHWFrontendRootWidget::CloseOverlay()
{
    OpenOverlay(EHWFrontendOverlay::None);
}

void UHWFrontendRootWidget::GoBack()
{
    if (Overlay != EHWFrontendOverlay::None)
    {
        CloseOverlay();
    }
    else if (Current != EHWFrontendScreen::Lobby && Current != EHWFrontendScreen::Title)
    {
        ShowScreen(EHWFrontendScreen::Lobby);
    }
}

void UHWFrontendRootWidget::Toast(const FText& Message)
{
    if (ToastText)
    {
        ToastText->SetText(Message);
        if (UWidget* Holder = ToastText->GetParent())
        {
            Holder->SetVisibility(ESlateVisibility::HitTestInvisible);
        }
        ToastRemaining = 3.5f;
    }
}

bool UHWFrontendRootWidget::SelectCharacter(FName CharacterId)
{
    if (UGameInstance* GI = GetGameInstance())
    {
        if (UHWRaidNetworkSubsystem* Network = GI->GetSubsystem<UHWRaidNetworkSubsystem>())
        {
            const FHWNetProfile NetProfile = Network->GetProfile();
            if (Network->IsConnected() && NetProfile.bCharacterCreated
                && NetProfile.Character != CharacterId)
            {
                Toast(NSLOCTEXT("HWUI", "OnlineCharacterLocked",
                    "온라인 캐릭터는 서버 프로필에 고정되어 있습니다."));
                return false;
            }
        }
    }

    UHWProfileSubsystem* Profile = ProfileSystem();
    if (!Profile || !Profile->IsProfileAvailable())
    {
        Toast(NSLOCTEXT("HWUI", "NoProfileForCharacter", "캐릭터 선택을 저장할 프로필이 없습니다."));
        return false;
    }
    if (!Profile->SelectCharacter(CharacterId))
    {
        Toast(FText::FromString(Profile->GetLastError()));
        return false;
    }
    SelectedCharacter = CharacterId;
    return true;
}

void UHWFrontendRootWidget::Sortie(FName QuestId)
{
    if (UHWQuestRunSubsystem* Runs = RunSystem())
    {
        const bool bPrepared = QuestId.IsNone() ? Runs->PrepareTraining() : Runs->PrepareQuest(QuestId);
        if (bPrepared && Runs->OpenPreparedEncounter())
        {
            return;
        }
        const FString Error = Runs->GetLastError();
        Runs->ResetRun();
        Toast(FText::Format(NSLOCTEXT("HWUI", "NoRoute", "출격 불가: {0}\n그레이박스를 기록 없는 훈련으로 연다."), FText::FromString(Error)));
    }
    PendingTravel = 1.6f;
}

void UHWFrontendRootWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
    Super::NativeTick(MyGeometry, InDeltaTime);

    if (OverlayPanel && OverlayT < 1.f)
    {
        const bool bDrawer = Overlay == EHWFrontendOverlay::Recruit;
        OverlayT = FMath::Min(1.f, OverlayT + InDeltaTime / (bDrawer ? DrawerSeconds : ModalSeconds));
        const float Ease = 1.f - FMath::Pow(1.f - OverlayT, 3.f);
        if (bDrawer)
        {
            OverlayPanel->SetRenderTranslation(FVector2D((1.f - Ease) * M(EHWUIMetricToken::DrawerWidth), 0.f));
        }
        else
        {
            OverlayPanel->SetRenderOpacity(Ease);
            OverlayPanel->SetRenderScale(FVector2D(0.98f + 0.02f * Ease));
        }
    }

    if (ToastRemaining > 0.f)
    {
        ToastRemaining -= InDeltaTime;
        if (ToastRemaining <= 0.f && ToastText && ToastText->GetParent())
        {
            ToastText->GetParent()->SetVisibility(ESlateVisibility::Collapsed);
        }
    }

    if (PendingTravel > 0.f)
    {
        PendingTravel -= InDeltaTime;
        if (PendingTravel <= 0.f)
        {
            UGameplayStatics::OpenLevel(this, TrainingMap);
        }
    }
}

FReply UHWFrontendRootWidget::NativeOnKeyDown(const FGeometry& InGeometry, const FKeyEvent& InKeyEvent)
{
    const FKey Key = InKeyEvent.GetKey();
    if (Key == EKeys::Escape || Key == EKeys::Android_Back)
    {
        GoBack();
        return FReply::Handled();
    }
    return Super::NativeOnKeyDown(InGeometry, InKeyEvent);
}
