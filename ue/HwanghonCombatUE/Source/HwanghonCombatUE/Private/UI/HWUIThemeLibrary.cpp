#include "UI/HWUIThemeLibrary.h"

// Token values mirror Content/Data/ui_theme.json (tests/ue-clean-ui-v1.test.mjs keeps them equal).
// Colors are authored as sRGB hex. FLinearColor(FColor) converts sRGB -> linear, which is what
// Slate/UMG expects; putting hex/255 straight into FLinearColor would render every token lighter.
FLinearColor UHWUIThemeLibrary::Color(EHWUIColorToken Token)
{
    switch (Token)
    {
        case EHWUIColorToken::BackgroundDeep: return FLinearColor(FColor(0x07, 0x0D, 0x14, 0xFF));
        case EHWUIColorToken::Panel:          return FLinearColor(FColor(0x0D, 0x17, 0x24, 0xDE));
        case EHWUIColorToken::PanelStrong:    return FLinearColor(FColor(0x0A, 0x12, 0x1D, 0xF2));
        case EHWUIColorToken::PanelSoft:      return FLinearColor(FColor(0x18, 0x23, 0x33, 0xB8));
        case EHWUIColorToken::OverlayDim:     return FLinearColor(FColor(0x02, 0x06, 0x0A, 0x99));
        case EHWUIColorToken::TextPrimary:    return FLinearColor(FColor(0xF2, 0xEF, 0xE7, 0xFF));
        case EHWUIColorToken::TextSecondary:  return FLinearColor(FColor(0xA8, 0xB0, 0xBC, 0xFF));
        case EHWUIColorToken::TextMuted:      return FLinearColor(FColor(0x72, 0x7D, 0x8C, 0xFF));
        case EHWUIColorToken::Line:           return FLinearColor(FColor(0x7C, 0x87, 0x96, 0x4D));
        case EHWUIColorToken::Gold:           return FLinearColor(FColor(0xD0, 0xAE, 0x5A, 0xFF));
        case EHWUIColorToken::GoldSoft:       return FLinearColor(FColor(0x9A, 0x81, 0x48, 0xFF));
        case EHWUIColorToken::Cyan:           return FLinearColor(FColor(0x62, 0xB7, 0xCF, 0xFF));
        case EHWUIColorToken::Blue:           return FLinearColor(FColor(0x52, 0x7E, 0xC6, 0xFF));
        case EHWUIColorToken::Danger:         return FLinearColor(FColor(0xB7, 0x46, 0x43, 0xFF));
        case EHWUIColorToken::Success:        return FLinearColor(FColor(0x62, 0xA9, 0x84, 0xFF));
        default:                              return FLinearColor::White;
    }
}

float UHWUIThemeLibrary::Metric(EHWUIMetricToken Token)
{
    switch (Token)
    {
        case EHWUIMetricToken::SafeHorizontal: return 92.f;
        case EHWUIMetricToken::SafeTop: return 24.f;
        case EHWUIMetricToken::SafeBottom: return 22.f;
        case EHWUIMetricToken::TopBarHeight: return 72.f;
        case EHWUIMetricToken::BottomNavHeight: return 88.f;
        case EHWUIMetricToken::BottomNavIcon: return 30.f;
        case EHWUIMetricToken::LeftRailWidth: return 340.f;
        case EHWUIMetricToken::SlimRailWidth: return 76.f;
        case EHWUIMetricToken::DrawerWidth: return 820.f;
        case EHWUIMetricToken::ModalWidth: return 1680.f;
        case EHWUIMetricToken::ModalHeight: return 720.f;
        case EHWUIMetricToken::PrimaryCTA: return 150.f;
        case EHWUIMetricToken::PanelPadding: return 24.f;
        case EHWUIMetricToken::CardGap: return 12.f;
        case EHWUIMetricToken::SectionGap: return 22.f;
        case EHWUIMetricToken::Border: return 1.f;
        case EHWUIMetricToken::SelectionBar: return 3.f;
        default: return 0.f;
    }
}

int32 UHWUIThemeLibrary::FontSize(EHWUITextToken Token)
{
    switch (Token)
    {
        case EHWUITextToken::Hero: return 34;
        case EHWUITextToken::PageTitle: return 28;
        case EHWUITextToken::SectionTitle: return 19;
        case EHWUITextToken::Body: return 15;
        case EHWUITextToken::Caption: return 12;
        case EHWUITextToken::Micro: return 10;
        case EHWUITextToken::NumberLarge: return 24;
        default: return 15;
    }
}

FVector2D UHWUIThemeLibrary::ReferenceResolution()
{
    return FVector2D(2340.f, 1080.f);
}

float UHWUIThemeLibrary::ScaleForViewport(FVector2D ViewportSize)
{
    const FVector2D Ref = ReferenceResolution();
    if (ViewportSize.X <= 0.f || ViewportSize.Y <= 0.f) return 1.f;
    return FMath::Min(ViewportSize.X / Ref.X, ViewportSize.Y / Ref.Y);
}

FMargin UHWUIThemeLibrary::SafeMargin(FVector2D ViewportSize)
{
    const float Scale = ScaleForViewport(ViewportSize);
    return FMargin(
        Metric(EHWUIMetricToken::SafeHorizontal) * Scale,
        Metric(EHWUIMetricToken::SafeTop) * Scale,
        Metric(EHWUIMetricToken::SafeHorizontal) * Scale,
        Metric(EHWUIMetricToken::SafeBottom) * Scale);
}
