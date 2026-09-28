#include "UI/HWUIKit.h"

#include "Blueprint/WidgetTree.h"
#include "Components/Border.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/Image.h"
#include "Components/ProgressBar.h"
#include "Components/ScaleBox.h"
#include "Components/SizeBox.h"
#include "Components/Spacer.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"
#include "Engine/FontFace.h"
#include "Engine/Texture2D.h"
#include "Fonts/CompositeFont.h"
#include "Misc/Paths.h"
#include "Styling/CoreStyle.h"

namespace
{
    const TCHAR* WeightName(EHWUIWeight Weight)
    {
        switch (Weight)
        {
            case EHWUIWeight::Bold: return TEXT("Bold");
            case EHWUIWeight::Medium: return TEXT("Medium");
            default: return TEXT("Regular");
        }
    }

    // Built once and intentionally never destroyed: FStandaloneCompositeFont is an FGCObject and
    // must not be torn down by static destruction after the UObject system is gone.
    TSharedPtr<const FCompositeFont> CompositeFont()
    {
        static TSharedPtr<FStandaloneCompositeFont>* Holder = nullptr;
        static bool bTried = false;
        if (Holder)
        {
            return *Holder;
        }
        if (bTried)
        {
            return nullptr;
        }
        bTried = true;

        TSharedPtr<FStandaloneCompositeFont> Font = MakeShared<FStandaloneCompositeFont>();
        for (EHWUIWeight Weight : { EHWUIWeight::Regular, EHWUIWeight::Medium, EHWUIWeight::Bold })
        {
            const FString Name = WeightName(Weight);
            FTypefaceEntry& Entry = Font->DefaultTypeface.Fonts.Emplace_GetRef(FName(*Name));
            const FString Asset = FString::Printf(TEXT("/Game/UI/Fonts/NotoSansKR_%s.NotoSansKR_%s"), *Name, *Name);
            if (UFontFace* Face = LoadObject<UFontFace>(nullptr, *Asset, nullptr, LOAD_NoWarn | LOAD_Quiet))
            {
                Entry.Font = FFontData(Face);
                continue;
            }
            // Development fallback before ue_ui_setup.py has imported the faces.
            const FString File = FPaths::ConvertRelativePathToFull(FPaths::Combine(
                FPaths::ProjectDir(), TEXT("Assets/Fonts"), FString::Printf(TEXT("NotoSansKR-%s.ttf"), *Name)));
            if (!FPaths::FileExists(File))
            {
                return nullptr;
            }
            Entry.Font = FFontData(File, EFontHinting::Default, EFontLoadingPolicy::LazyLoad);
        }
        Holder = new TSharedPtr<FStandaloneCompositeFont>(Font);
        return *Holder;
    }
}

namespace HWUI
{
FLinearColor C(EHWUIColorToken Token)
{
    return UHWUIThemeLibrary::Color(Token);
}

FLinearColor C(EHWUIColorToken Token, float Alpha)
{
    FLinearColor Color = UHWUIThemeLibrary::Color(Token);
    Color.A = Alpha;
    return Color;
}

float M(EHWUIMetricToken Token)
{
    return UHWUIThemeLibrary::Metric(Token);
}

FSlateFontInfo FontSized(float Size, EHWUIWeight Weight)
{
    if (TSharedPtr<const FCompositeFont> Font = CompositeFont())
    {
        return FSlateFontInfo(Font, Size, FName(WeightName(Weight)));
    }
    return FCoreStyle::GetDefaultFontStyle(Weight == EHWUIWeight::Regular ? "Regular" : "Bold", Size);
}

FSlateFontInfo Font(EHWUITextToken Token, EHWUIWeight Weight)
{
    return FontSized(static_cast<float>(UHWUIThemeLibrary::FontSize(Token)), Weight);
}

FSlateBrush Box(const FLinearColor& Fill, float Radius, const FLinearColor& Outline, float OutlineWidth)
{
    FSlateBrush Brush;
    Brush.DrawAs = ESlateBrushDrawType::RoundedBox;
    Brush.TintColor = FSlateColor(Fill);
    Brush.OutlineSettings = FSlateBrushOutlineSettings(FMath::Clamp(Radius, 0.f, 6.f), FSlateColor(Outline), OutlineWidth);
    return Brush;
}

UTexture2D* Art(const FString& Name)
{
    const FString Clean = Name.Replace(TEXT("-"), TEXT("_"));
    const FString Path = FString::Printf(TEXT("/Game/UI/Art/T_%s.T_%s"), *Clean, *Clean);
    return LoadObject<UTexture2D>(nullptr, *Path, nullptr, LOAD_NoWarn | LOAD_Quiet);
}

FString Strip(const FString& Html)
{
    FString In = Html.Replace(TEXT("<br>"), TEXT("\n")).Replace(TEXT("<br/>"), TEXT("\n")).Replace(TEXT("<br />"), TEXT("\n"));
    FString Out;
    Out.Reserve(In.Len());
    bool bInTag = false;
    for (const TCHAR Ch : In)
    {
        if (Ch == TEXT('<')) { bInTag = true; continue; }
        if (Ch == TEXT('>')) { bInTag = false; continue; }
        if (!bInTag) { Out.AppendChar(Ch); }
    }
    return Out.Replace(TEXT("&nbsp;"), TEXT(" ")).Replace(TEXT("&amp;"), TEXT("&"));
}

FText Num(int64 Value)
{
    return FText::AsNumber(Value);
}

UTextBlock* Text(UWidgetTree* Tree, const FText& Value, EHWUITextToken Size, EHWUIColorToken Color, EHWUIWeight Weight)
{
    UTextBlock* Block = Tree->ConstructWidget<UTextBlock>();
    Block->SetText(Value);
    Block->SetFont(Font(Size, Weight));
    Block->SetColorAndOpacity(FSlateColor(C(Color)));
    return Block;
}

UTextBlock* TextWrap(UWidgetTree* Tree, const FText& Value, EHWUITextToken Size, EHWUIColorToken Color)
{
    UTextBlock* Block = Text(Tree, Value, Size, Color);
    Block->SetAutoWrapText(true);
    return Block;
}

UBorder* Panel(UWidgetTree* Tree, const FSlateBrush& Brush, const FMargin& Padding)
{
    UBorder* Border = Tree->ConstructWidget<UBorder>();
    Border->SetBrush(Brush);
    Border->SetPadding(Padding);
    return Border;
}

UImage* Picture(UWidgetTree* Tree, UTexture2D* Texture, const FLinearColor& Tint)
{
    UImage* Image = Tree->ConstructWidget<UImage>();
    if (Texture)
    {
        Image->SetBrushFromTexture(Texture, false);
        Image->SetColorAndOpacity(Tint);
    }
    else
    {
        // Missing art must be visible as missing, not silently black.
        Image->SetBrush(Box(C(EHWUIColorToken::PanelSoft)));
    }
    return Image;
}

UImage* Fill(UWidgetTree* Tree, const FLinearColor& Color)
{
    UImage* Image = Tree->ConstructWidget<UImage>();
    Image->SetBrush(Box(Color));
    return Image;
}

UWidget* Fit(UWidgetTree* Tree, UTexture2D* Texture, bool bCover, UImage** OutImage, const FLinearColor& Tint)
{
    UImage* Image = Tree->ConstructWidget<UImage>();
    if (Texture)
    {
        Image->SetBrushFromTexture(Texture, true);
        Image->SetColorAndOpacity(Tint);
    }
    else
    {
        Image->SetBrush(Box(C(EHWUIColorToken::BackgroundDeep)));
    }
    if (OutImage) { *OutImage = Image; }
    UScaleBox* Scale = Tree->ConstructWidget<UScaleBox>();
    Scale->SetStretch(bCover ? EStretch::ScaleToFill : EStretch::ScaleToFit);
    Scale->SetClipping(EWidgetClipping::ClipToBounds);
    Scale->SetContent(Image);
    return Scale;
}

UWidget* Sized(UWidgetTree* Tree, UWidget* Child, float Width, float Height)
{
    USizeBox* Size = Tree->ConstructWidget<USizeBox>();
    if (Width > 0.f) { Size->SetWidthOverride(Width); }
    if (Height > 0.f) { Size->SetHeightOverride(Height); }
    if (Child) { Size->SetContent(Child); }
    return Size;
}

UWidget* Gap(UWidgetTree* Tree, float Width, float Height)
{
    USpacer* Spacer = Tree->ConstructWidget<USpacer>();
    Spacer->SetSize(FVector2D(Width, Height));
    return Spacer;
}

UVerticalBox* VBox(UWidgetTree* Tree)
{
    return Tree->ConstructWidget<UVerticalBox>();
}

UHorizontalBox* HBox(UWidgetTree* Tree)
{
    return Tree->ConstructWidget<UHorizontalBox>();
}

UWidget* Tag(UWidgetTree* Tree, const FText& Label, const FLinearColor& Color)
{
    UHorizontalBox* Row = HBox(Tree);
    UHorizontalBoxSlot* DotSlot = AddH(Row, Sized(Tree, Fill(Tree, Color), 8.f, 8.f), FMargin(0.f, 0.f, 6.f, 0.f));
    DotSlot->SetVerticalAlignment(VAlign_Center);
    UTextBlock* LabelText = Text(Tree, Label, EHWUITextToken::Caption, EHWUIColorToken::TextSecondary);
    LabelText->SetColorAndOpacity(FSlateColor(Color));
    AddH(Row, LabelText)->SetVerticalAlignment(VAlign_Center);
    return Row;
}

UWidget* Rule(UWidgetTree* Tree)
{
    return Sized(Tree, Fill(Tree, C(EHWUIColorToken::Line)), 0.f, M(EHWUIMetricToken::Border));
}

UWidget* KeyValue(UWidgetTree* Tree, const FText& Key, const FText& Value, EHWUIColorToken ValueColor)
{
    UHorizontalBox* Row = HBox(Tree);
    AddH(Row, Text(Tree, Key, EHWUITextToken::Body, EHWUIColorToken::TextSecondary), FMargin(0), true);
    AddH(Row, Text(Tree, Value, EHWUITextToken::Body, ValueColor, EHWUIWeight::Medium));
    return Row;
}

UWidget* Bar(UWidgetTree* Tree, float Fraction, const FLinearColor& Color, float Width, float Height, UProgressBar** OutBar)
{
    UProgressBar* Progress = Tree->ConstructWidget<UProgressBar>();
    FProgressBarStyle Style;
    Style.SetBackgroundImage(Box(C(EHWUIColorToken::BackgroundDeep, 0.72f)));
    Style.SetFillImage(Box(FLinearColor::White));
    Style.SetMarqueeImage(Box(FLinearColor::White));
    Progress->SetWidgetStyle(Style);
    Progress->SetFillColorAndOpacity(Color);
    Progress->SetPercent(FMath::Clamp(Fraction, 0.f, 1.f));
    if (OutBar) { *OutBar = Progress; }
    return Sized(Tree, Progress, Width, Height);
}

UCanvasPanelSlot* Place(UCanvasPanel* Canvas, UWidget* Child, const FAnchors& Anchors, const FMargin& Offsets,
    const FVector2D& Alignment, bool bAutoSize)
{
    UCanvasPanelSlot* Slot = Canvas->AddChildToCanvas(Child);
    Slot->SetAnchors(Anchors);
    Slot->SetOffsets(Offsets);
    Slot->SetAlignment(Alignment);
    Slot->SetAutoSize(bAutoSize);
    return Slot;
}

UCanvasPanelSlot* Stretch(UCanvasPanel* Canvas, UWidget* Child, const FMargin& Insets)
{
    return Place(Canvas, Child, FAnchors(0.f, 0.f, 1.f, 1.f), Insets);
}

UVerticalBoxSlot* AddV(UVerticalBox* Box, UWidget* Child, const FMargin& Padding, bool bFill)
{
    UVerticalBoxSlot* Slot = Box->AddChildToVerticalBox(Child);
    Slot->SetPadding(Padding);
    if (bFill) { Slot->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); }
    return Slot;
}

UHorizontalBoxSlot* AddH(UHorizontalBox* Box, UWidget* Child, const FMargin& Padding, bool bFill)
{
    UHorizontalBoxSlot* Slot = Box->AddChildToHorizontalBox(Child);
    Slot->SetPadding(Padding);
    if (bFill) { Slot->SetSize(FSlateChildSize(ESlateSizeRule::Fill)); }
    return Slot;
}

FSlateBrush CardBrush(bool bSelected)
{
    return bSelected
        ? Box(C(EHWUIColorToken::PanelSoft), 4.f, C(EHWUIColorToken::Gold), M(EHWUIMetricToken::Border))
        : Box(C(EHWUIColorToken::PanelSoft), 4.f);
}
}
