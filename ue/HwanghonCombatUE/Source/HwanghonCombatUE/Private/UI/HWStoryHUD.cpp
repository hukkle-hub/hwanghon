#include "UI/HWStoryHUD.h"

#include "Blueprint/WidgetTree.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/Image.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "GameFramework/PlayerController.h"

using namespace HWUI;

void UHWStoryOverlayWidget::Build(UCanvasPanel* Root)
{
    const float X = SafeX();

    // Letterbox: the cinema is 2.39:1 inside the 16:9 screen (12% bars).
    TopBar = Fill(WidgetTree, FLinearColor::Black);
    Place(Root, TopBar, FAnchors(0.f, 0.f, 1.f, 0.12f), FMargin(0));
    BottomBar = Fill(WidgetTree, FLinearColor::Black);
    Place(Root, BottomBar, FAnchors(0.f, 0.88f, 1.f, 1.f), FMargin(0));

    // Novel card: the scene's text until its animation exists. Dimmed over the arena, black elsewhere.
    CardBack = Fill(WidgetTree, FLinearColor::Black);
    Stretch(Root, CardBack);
    UVerticalBox* Card = VBox(WidgetTree);
    Kicker = Text(WidgetTree, FText::GetEmpty(), EHWUITextToken::Caption, EHWUIColorToken::Gold, EHWUIWeight::Medium);
    AddV(Card, Kicker, FMargin(0.f, 0.f, 0.f, 14.f));
    Body = TextWrap(WidgetTree, FText::GetEmpty(), EHWUITextToken::SectionTitle, EHWUIColorToken::TextPrimary);
    Body->SetLineHeightPercentage(1.25f);
    AddV(Card, Body);
    Source = Text(WidgetTree, FText::GetEmpty(), EHWUITextToken::Micro, EHWUIColorToken::TextMuted);
    AddV(Card, Source, FMargin(0.f, 18.f, 0.f, 0.f));
    AddV(Card, Text(WidgetTree, NSLOCTEXT("HWStory", "CardNote", "애니메이션 제작 전 — 원문 장면 카드"),
        EHWUITextToken::Micro, EHWUIColorToken::TextMuted), FMargin(0.f, 4.f, 0.f, 0.f));
    CardBox = Sized(WidgetTree, Card, 1040.f, 0.f);
    Place(Root, CardBox, FAnchors(0.5f, 0.5f), FMargin(0.f, 0.f, 1040.f, 0.f), FVector2D(0.5f, 0.5f), true);

    // Scene caption on the lower bar while a sequence plays.
    Caption = Text(WidgetTree, FText::GetEmpty(), EHWUITextToken::Caption, EHWUIColorToken::TextSecondary);
    Place(Root, Caption, FAnchors(0.f, 0.94f), FMargin(X, 0.f, 0.f, 0.f), FVector2D(0.f, 0.5f), true);
    Progress = Text(WidgetTree, FText::GetEmpty(), EHWUITextToken::Micro, EHWUIColorToken::TextMuted);
    Place(Root, Progress, FAnchors(0.f, 0.06f), FMargin(X, 0.f, 0.f, 0.f), FVector2D(0.f, 0.5f), true);

    SkipButton = SecondaryAction(NSLOCTEXT("HWStory", "Skip", "건너뛰기  ▶▶"), [this]() { if (OnSkip) OnSkip(); });
    Place(Root, SkipButton, FAnchors(1.f, 0.94f), FMargin(-X, 0.f, 0.f, 0.f), FVector2D(1.f, 0.5f), true);

    PromptText = Text(WidgetTree, FText::GetEmpty(), EHWUITextToken::Body, EHWUIColorToken::TextPrimary, EHWUIWeight::Medium);
    PromptButton = TapGhost(PromptText, [this]() { if (PromptTap) PromptTap(); }, FMargin(22.f, 12.f));
    Place(Root, PromptButton, FAnchors(0.5f, 0.72f), FMargin(0), FVector2D(0.5f, 0.5f), true);

    EndTitle = Text(WidgetTree, FText::GetEmpty(), EHWUITextToken::PageTitle, EHWUIColorToken::TextPrimary, EHWUIWeight::Bold);
    Place(Root, EndTitle, FAnchors(0.5f, 0.5f), FMargin(0), FVector2D(0.5f, 0.5f), true);

    Apply();
}

void UHWStoryOverlayWidget::Apply()
{
    if (!TopBar) return;
    auto Show = [](UWidget* W, bool bOn) { if (W) W->SetVisibility(bOn ? ESlateVisibility::HitTestInvisible : ESlateVisibility::Collapsed); };
    const bool bBars = Mode == EMode::Cinema || Mode == EMode::Card || Mode == EMode::End;
    Show(TopBar, bBars);
    Show(BottomBar, bBars);
    Show(CardBack, Mode == EMode::Card || Mode == EMode::End);
    CardBack->SetColorAndOpacity(FLinearColor(0.f, 0.f, 0.f, Mode == EMode::End || bCardOpaque ? 1.f : 0.62f));
    Show(CardBox, Mode == EMode::Card);
    Show(Caption, Mode == EMode::Cinema);
    Show(Progress, Mode == EMode::Cinema || Mode == EMode::Card);
    Show(EndTitle, Mode == EMode::End);
    SkipButton->SetVisibility(Mode == EMode::Cinema || Mode == EMode::Card ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
    Kicker->SetText(KickerValue);
    Body->SetText(BodyValue);
    Source->SetText(SourceValue);
    Caption->SetText(CaptionValue);
    Progress->SetText(ProgressValue);
    EndTitle->SetText(CaptionValue);
    PromptText->SetText(PromptValue);
    PromptButton->SetVisibility(PromptValue.IsEmpty() ? ESlateVisibility::Collapsed : ESlateVisibility::Visible);
    SetVisibility(Mode == EMode::Hidden && PromptValue.IsEmpty() ? ESlateVisibility::Collapsed : ESlateVisibility::SelfHitTestInvisible);
}

void UHWStoryOverlayWidget::ShowCinema(const FText& InCaption)
{
    Mode = EMode::Cinema;
    CaptionValue = InCaption;
    Apply();
}

void UHWStoryOverlayWidget::ShowCard(const FText& InKicker, const FText& InBody, const FText& InSource, bool bOpaque)
{
    Mode = EMode::Card;
    KickerValue = InKicker;
    BodyValue = InBody;
    SourceValue = InSource;
    bCardOpaque = bOpaque;
    Apply();
}

void UHWStoryOverlayWidget::ShowHandoff()
{
    Mode = EMode::Handoff;   // bars drop the moment the camera starts moving to Ain
    Apply();
}

void UHWStoryOverlayWidget::ShowEnd(const FText& Title)
{
    Mode = EMode::End;
    CaptionValue = Title;
    Apply();
}

void UHWStoryOverlayWidget::HideAll()
{
    Mode = EMode::Hidden;
    Apply();
}

void UHWStoryOverlayWidget::SetPrompt(const FText& Value, TFunction<void()> OnTap)
{
    PromptValue = Value;
    PromptTap = MoveTemp(OnTap);
    Apply();
}

void UHWStoryOverlayWidget::SetProgress(const FText& Value)
{
    ProgressValue = Value;
    Apply();
}

void AHWStoryHUD::BeginPlay()
{
    Super::BeginPlay();
    APlayerController* PC = GetOwningPlayerController();
    if (!PC || !PC->IsLocalController())
    {
        return;
    }
    Overlay = CreateWidget<UHWStoryOverlayWidget>(PC, UHWStoryOverlayWidget::StaticClass());
    if (Overlay)
    {
        Overlay->AddToViewport(20);
    }
    SetCombatVisible(false);
}

void AHWStoryHUD::SetCombatVisible(bool bVisible)
{
    if (Widget)
    {
        Widget->SetVisibility(bVisible ? ESlateVisibility::SelfHitTestInvisible : ESlateVisibility::Collapsed);
    }
}
