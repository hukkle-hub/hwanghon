#include "UI/HWScreenWidget.h"

#include "Blueprint/WidgetTree.h"
#include "Components/Button.h"
#include "Components/ButtonSlot.h"
#include "Components/CanvasPanel.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/SizeBox.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"
#include "Content/HWGameContentSubsystem.h"
#include "Engine/GameInstance.h"
#include "Game/HWQuestRunSubsystem.h"
#include "Graphics/HWGraphicsQualitySubsystem.h"
#include "Progression/HWProfileSubsystem.h"
#include "UI/HWFrontendRootWidget.h"

using namespace HWUI;

void UHWScreenWidget::SetFrontend(UHWFrontendRootWidget* InFrontend)
{
    Frontend = InFrontend;
}

UHWFrontendRootWidget* UHWScreenWidget::GetFrontend() const
{
    return Frontend.Get();
}

TSharedRef<SWidget> UHWScreenWidget::RebuildWidget()
{
    // No tree, or the empty root canvas a freshly created WBP gets: use the native layout.
    // A WBP whose designer added anything keeps its own tree.
    UCanvasPanel* EmptyCanvas = WidgetTree ? Cast<UCanvasPanel>(WidgetTree->RootWidget) : nullptr;
    if (EmptyCanvas && EmptyCanvas->GetChildrenCount() > 0)
    {
        EmptyCanvas = nullptr;
    }
    if (WidgetTree && (!WidgetTree->RootWidget || EmptyCanvas) && !NativeRoot)
    {
        NativeRoot = EmptyCanvas ? EmptyCanvas : WidgetTree->ConstructWidget<UCanvasPanel>(UCanvasPanel::StaticClass(), TEXT("NativeRoot"));
        WidgetTree->RootWidget = NativeRoot;
        Build(NativeRoot);
    }
    return Super::RebuildWidget();
}

void UHWScreenWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
    Super::NativeTick(MyGeometry, InDeltaTime);
    if (bRefreshPending)
    {
        bRefreshPending = false;
        Refresh();
    }
}

void UHWScreenWidget::Refresh()
{
    if (!NativeRoot)
    {
        return;
    }
    NativeRoot->ClearChildren();
    TapProxies.Reset();
    ArtWidgets.Reset();
    ArtOnlySaved.Reset();
    Build(NativeRoot);
}

void UHWScreenWidget::SetArtOnly(bool bArtOnly)
{
    if (!NativeRoot)
    {
        return;
    }
    for (UWidget* Child : NativeRoot->GetAllChildren())
    {
        if (!Child || ArtWidgets.Contains(Child))
        {
            continue;
        }
        if (bArtOnly)
        {
            ArtOnlySaved.Add(Child, Child->GetVisibility());
            Child->SetVisibility(ESlateVisibility::Hidden);
        }
        else if (const ESlateVisibility* Saved = ArtOnlySaved.Find(Child))
        {
            Child->SetVisibility(*Saved);
        }
    }
    if (!bArtOnly)
    {
        ArtOnlySaved.Reset();
    }
}

UButton* UHWScreenWidget::Tap(UWidget* Content, TFunction<void()> OnTap, const FSlateBrush& Normal,
    const FSlateBrush& Hovered, const FSlateBrush& Pressed, const FMargin& ContentPadding)
{
    UButton* Button = WidgetTree->ConstructWidget<UButton>();
    FButtonStyle Style;
    Style.SetNormal(Normal);
    Style.SetHovered(Hovered);
    Style.SetPressed(Pressed);
    Style.SetDisabled(Normal);
    Style.SetNormalPadding(FMargin(0));
    Style.SetPressedPadding(FMargin(0));
    Button->SetStyle(Style);
    if (Content)
    {
        if (UButtonSlot* ContentSlot = Cast<UButtonSlot>(Button->SetContent(Content)))
        {
            ContentSlot->SetPadding(ContentPadding);
            ContentSlot->SetHorizontalAlignment(HAlign_Fill);
            ContentSlot->SetVerticalAlignment(VAlign_Fill);
        }
    }
    UHWTapProxy* Proxy = NewObject<UHWTapProxy>(this);
    Proxy->Callback = MoveTemp(OnTap);
    TapProxies.Add(Proxy);
    Button->OnClicked.AddDynamic(Proxy, &UHWTapProxy::Fire);
    return Button;
}

UButton* UHWScreenWidget::TapGhost(UWidget* Content, TFunction<void()> OnTap, const FMargin& ContentPadding)
{
    const FSlateBrush Clear = Box(FLinearColor::Transparent);
    return Tap(Content, MoveTemp(OnTap), Clear, Box(C(EHWUIColorToken::PanelSoft, 0.35f), 4.f), Box(C(EHWUIColorToken::PanelSoft, 0.55f), 4.f), ContentPadding);
}

UWidget* UHWScreenWidget::SelectableCard(UWidget* Content, bool bSelected, TFunction<void()> OnTap, const FMargin& ContentPadding)
{
    UHorizontalBox* Row = HBox(WidgetTree);
    AddH(Row, Sized(WidgetTree, Fill(WidgetTree, bSelected ? C(EHWUIColorToken::Gold) : FLinearColor::Transparent),
        M(EHWUIMetricToken::SelectionBar), 0.f));
    const FSlateBrush Normal = CardBrush(bSelected);
    const FSlateBrush Hover = bSelected ? Normal
        : Box(C(EHWUIColorToken::PanelSoft), 4.f, C(EHWUIColorToken::Line), M(EHWUIMetricToken::Border));
    AddH(Row, Tap(Content, MoveTemp(OnTap), Normal, Hover, Hover, ContentPadding), FMargin(0), true);
    return Row;
}

UWidget* UHWScreenWidget::PrimaryAction(const FText& Label, const FText& Caption, bool bEnabled, TFunction<void()> OnTap,
    float Width, float Height)
{
    const float Side = M(EHWUIMetricToken::PrimaryCTA);
    UVerticalBox* Stack = VBox(WidgetTree);
    UTextBlock* LabelText = Text(WidgetTree, Label, EHWUITextToken::PageTitle,
        bEnabled ? EHWUIColorToken::TextPrimary : EHWUIColorToken::TextMuted, EHWUIWeight::Bold);
    AddV(Stack, LabelText)->SetHorizontalAlignment(HAlign_Center);
    if (!Caption.IsEmpty())
    {
        UTextBlock* CaptionText = Text(WidgetTree, Caption, EHWUITextToken::Caption, EHWUIColorToken::TextSecondary);
        CaptionText->SetJustification(ETextJustify::Center);
        AddV(Stack, CaptionText, FMargin(0.f, 4.f, 0.f, 0.f))->SetHorizontalAlignment(HAlign_Center);
    }
    const FLinearColor Ring = bEnabled ? C(EHWUIColorToken::Gold) : C(EHWUIColorToken::TextMuted);
    UButton* Button = Tap(Stack, MoveTemp(OnTap),
        Box(C(EHWUIColorToken::BackgroundDeep, 0.92f), 6.f, Ring, 1.5f),
        Box(C(EHWUIColorToken::PanelStrong), 6.f, Ring, 2.f),
        Box(C(EHWUIColorToken::Panel), 6.f, Ring, 2.f),
        FMargin(8.f));
    if (UButtonSlot* ContentSlot = Cast<UButtonSlot>(Button->GetContentSlot()))
    {
        ContentSlot->SetHorizontalAlignment(HAlign_Center);
        ContentSlot->SetVerticalAlignment(VAlign_Center);
    }
    Button->SetIsEnabled(bEnabled);
    return Sized(WidgetTree, Button, Width > 0.f ? Width : Side, Height > 0.f ? Height : Side);
}

UWidget* UHWScreenWidget::SecondaryAction(const FText& Label, TFunction<void()> OnTap, bool bEnabled)
{
    UTextBlock* LabelText = Text(WidgetTree, Label, EHWUITextToken::Body,
        bEnabled ? EHWUIColorToken::TextPrimary : EHWUIColorToken::TextMuted, EHWUIWeight::Medium);
    LabelText->SetJustification(ETextJustify::Center);
    UButton* Button = Tap(LabelText, MoveTemp(OnTap),
        Box(C(EHWUIColorToken::PanelSoft, 0.5f), 4.f, C(EHWUIColorToken::Line), 1.f),
        Box(C(EHWUIColorToken::PanelSoft), 4.f, C(EHWUIColorToken::Line), 1.f),
        Box(C(EHWUIColorToken::Panel), 4.f, C(EHWUIColorToken::Line), 1.f),
        FMargin(22.f, 12.f));
    Button->SetIsEnabled(bEnabled);
    return Button;
}

UWidget* UHWScreenWidget::NoSystemNote(const FText& What)
{
    return Tag(WidgetTree, FText::Format(NSLOCTEXT("HWUI", "NoSystem", "{0} — UE 에 아직 시스템이 없어 표시만 한다"), What),
        C(EHWUIColorToken::TextMuted));
}

UWidget* UHWScreenWidget::SectionTitle(const FText& Title, const FText& Right)
{
    UHorizontalBox* Row = HBox(WidgetTree);
    AddH(Row, Text(WidgetTree, Title, EHWUITextToken::SectionTitle, EHWUIColorToken::TextPrimary, EHWUIWeight::Medium), FMargin(0), true)
        ->SetVerticalAlignment(VAlign_Bottom);
    if (!Right.IsEmpty())
    {
        AddH(Row, Text(WidgetTree, Right, EHWUITextToken::Caption, EHWUIColorToken::TextMuted))->SetVerticalAlignment(VAlign_Bottom);
    }
    return Row;
}

float UHWScreenWidget::ContentTop() const
{
    return M(EHWUIMetricToken::SafeTop) + M(EHWUIMetricToken::TopBarHeight) + M(EHWUIMetricToken::SectionGap);
}

float UHWScreenWidget::ContentBottom() const
{
    return M(EHWUIMetricToken::SafeBottom) + M(EHWUIMetricToken::BottomNavHeight) + M(EHWUIMetricToken::SectionGap);
}

float UHWScreenWidget::SafeX() const
{
    return M(EHWUIMetricToken::SafeHorizontal);
}

UHWGameContentSubsystem* UHWScreenWidget::ContentSystem() const
{
    return GetGameInstance() ? GetGameInstance()->GetSubsystem<UHWGameContentSubsystem>() : nullptr;
}

UHWProfileSubsystem* UHWScreenWidget::ProfileSystem() const
{
    return GetGameInstance() ? GetGameInstance()->GetSubsystem<UHWProfileSubsystem>() : nullptr;
}

UHWQuestRunSubsystem* UHWScreenWidget::RunSystem() const
{
    return GetGameInstance() ? GetGameInstance()->GetSubsystem<UHWQuestRunSubsystem>() : nullptr;
}

UHWGraphicsQualitySubsystem* UHWScreenWidget::GraphicsSystem() const
{
    return GetGameInstance() ? GetGameInstance()->GetSubsystem<UHWGraphicsQualitySubsystem>() : nullptr;
}
