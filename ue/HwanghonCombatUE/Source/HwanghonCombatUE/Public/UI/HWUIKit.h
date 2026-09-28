#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "Fonts/SlateFontInfo.h"
#include "Styling/SlateBrush.h"
#include "Widgets/Layout/Anchors.h"
#include "UI/HWUIThemeLibrary.h"
#include "Components/Image.h"
#include "Components/SizeBox.h"
#include "HWUIKit.generated.h"

class UWidgetTree;
class UWidget;
class UTextBlock;
class UBorder;
class UImage;
class UCanvasPanel;
class UCanvasPanelSlot;
class UVerticalBox;
class UVerticalBoxSlot;
class UHorizontalBox;
class UHorizontalBoxSlot;
class USizeBox;
class UButton;
class UTexture2D;
class UProgressBar;

// Native construction kit for the Clean UI v1 fallback widgets (docs/design/123).
// Every color, spacing and font size comes from UHWUIThemeLibrary tokens.

enum class EHWUIWeight : uint8
{
    Regular,
    Medium,
    Bold
};

// Bridges UButton::OnClicked (no payload) to a native lambda, so list rows can carry their index.
UCLASS()
class HWANGHONCOMBATUE_API UHWTapProxy : public UObject
{
    GENERATED_BODY()

public:
    TFunction<void()> Callback;

    UFUNCTION()
    void Fire()
    {
        if (Callback)
        {
            Callback();
        }
    }
};

namespace HWUI
{
    HWANGHONCOMBATUE_API FLinearColor C(EHWUIColorToken Token);
    HWANGHONCOMBATUE_API FLinearColor C(EHWUIColorToken Token, float Alpha);
    HWANGHONCOMBATUE_API float M(EHWUIMetricToken Token);

    // Noto Sans KR (Assets/Fonts, imported by Scripts/ue_ui_setup.py). Falls back to the engine font.
    HWANGHONCOMBATUE_API FSlateFontInfo Font(EHWUITextToken Token, EHWUIWeight Weight = EHWUIWeight::Regular);
    HWANGHONCOMBATUE_API FSlateFontInfo FontSized(float Size, EHWUIWeight Weight = EHWUIWeight::Regular);

    // Solid or rounded box. Radius is capped by the spec (0-6).
    HWANGHONCOMBATUE_API FSlateBrush Box(const FLinearColor& Fill, float Radius = 0.f,
        const FLinearColor& Outline = FLinearColor::Transparent, float OutlineWidth = 0.f);

    // /Game/UI/Art/T_<Name> (Scripts/ue_ui_setup.py imports the web art). Null when missing.
    HWANGHONCOMBATUE_API UTexture2D* Art(const FString& Name);

    // Web content carries <br> and <span>; UI text needs plain lines.
    HWANGHONCOMBATUE_API FString Strip(const FString& Html);
    HWANGHONCOMBATUE_API FText Num(int64 Value);

    HWANGHONCOMBATUE_API UTextBlock* Text(UWidgetTree* Tree, const FText& Value, EHWUITextToken Size,
        EHWUIColorToken Color = EHWUIColorToken::TextPrimary, EHWUIWeight Weight = EHWUIWeight::Regular);
    HWANGHONCOMBATUE_API UTextBlock* TextWrap(UWidgetTree* Tree, const FText& Value, EHWUITextToken Size,
        EHWUIColorToken Color = EHWUIColorToken::TextSecondary);
    HWANGHONCOMBATUE_API UBorder* Panel(UWidgetTree* Tree, const FSlateBrush& Brush, const FMargin& Padding);
    HWANGHONCOMBATUE_API UImage* Picture(UWidgetTree* Tree, UTexture2D* Texture, const FLinearColor& Tint = FLinearColor::White);
    HWANGHONCOMBATUE_API UImage* Fill(UWidgetTree* Tree, const FLinearColor& Color);
    // Art kept at its aspect ratio: bCover fills and crops (backgrounds), otherwise fits inside (hero art).
    HWANGHONCOMBATUE_API UWidget* Fit(UWidgetTree* Tree, UTexture2D* Texture, bool bCover, UImage** OutImage = nullptr,
        const FLinearColor& Tint = FLinearColor::White);
    HWANGHONCOMBATUE_API UWidget* Sized(UWidgetTree* Tree, UWidget* Child, float Width, float Height);
    HWANGHONCOMBATUE_API UWidget* Gap(UWidgetTree* Tree, float Width, float Height);
    HWANGHONCOMBATUE_API UVerticalBox* VBox(UWidgetTree* Tree);
    HWANGHONCOMBATUE_API UHorizontalBox* HBox(UWidgetTree* Tree);

    // Small tag: colored dot/text, never a filled rarity card (spec §8).
    HWANGHONCOMBATUE_API UWidget* Tag(UWidgetTree* Tree, const FText& Label, const FLinearColor& Color);
    // Thin horizontal rule (Line token).
    HWANGHONCOMBATUE_API UWidget* Rule(UWidgetTree* Tree);
    // Label / value row for stat lists.
    HWANGHONCOMBATUE_API UWidget* KeyValue(UWidgetTree* Tree, const FText& Key, const FText& Value,
        EHWUIColorToken ValueColor = EHWUIColorToken::TextPrimary);
    // Horizontal fill bar (HP/ST/boss). Returns the sized wrapper; OutBar is the live progress bar.
    HWANGHONCOMBATUE_API UWidget* Bar(UWidgetTree* Tree, float Fraction, const FLinearColor& Color, float Width, float Height,
        UProgressBar** OutBar = nullptr);

    HWANGHONCOMBATUE_API UCanvasPanelSlot* Place(UCanvasPanel* Canvas, UWidget* Child, const FAnchors& Anchors,
        const FMargin& Offsets, const FVector2D& Alignment = FVector2D::ZeroVector, bool bAutoSize = false);
    HWANGHONCOMBATUE_API UCanvasPanelSlot* Stretch(UCanvasPanel* Canvas, UWidget* Child, const FMargin& Insets = FMargin(0));
    HWANGHONCOMBATUE_API UVerticalBoxSlot* AddV(UVerticalBox* Box, UWidget* Child, const FMargin& Padding = FMargin(0), bool bFill = false);
    HWANGHONCOMBATUE_API UHorizontalBoxSlot* AddH(UHorizontalBox* Box, UWidget* Child, const FMargin& Padding = FMargin(0), bool bFill = false);

    // Selected row/card: Gold 1 px outline + 3 px bar on the left (spec §5). Unselected: PanelSoft, no outline.
    HWANGHONCOMBATUE_API FSlateBrush CardBrush(bool bSelected);
}
