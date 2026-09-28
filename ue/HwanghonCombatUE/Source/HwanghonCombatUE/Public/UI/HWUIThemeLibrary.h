#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HWUIThemeLibrary.generated.h"

UENUM(BlueprintType)
enum class EHWUIColorToken : uint8
{
    BackgroundDeep,
    Panel,
    PanelStrong,
    PanelSoft,
    OverlayDim,
    TextPrimary,
    TextSecondary,
    TextMuted,
    Line,
    Gold,
    GoldSoft,
    Cyan,
    Blue,
    Danger,
    Success
};

UENUM(BlueprintType)
enum class EHWUIMetricToken : uint8
{
    SafeHorizontal,
    SafeTop,
    SafeBottom,
    TopBarHeight,
    BottomNavHeight,
    BottomNavIcon,
    LeftRailWidth,
    SlimRailWidth,
    DrawerWidth,
    ModalWidth,
    ModalHeight,
    PrimaryCTA,
    PanelPadding,
    CardGap,
    SectionGap,
    Border,
    SelectionBar
};

UENUM(BlueprintType)
enum class EHWUITextToken : uint8
{
    Hero,
    PageTitle,
    SectionTitle,
    Body,
    Caption,
    Micro,
    NumberLarge
};

UCLASS()
class HWANGHONCOMBATUE_API UHWUIThemeLibrary : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintPure, Category="Hwanghon|UI")
    static FLinearColor Color(EHWUIColorToken Token);

    UFUNCTION(BlueprintPure, Category="Hwanghon|UI")
    static float Metric(EHWUIMetricToken Token);

    UFUNCTION(BlueprintPure, Category="Hwanghon|UI")
    static int32 FontSize(EHWUITextToken Token);

    UFUNCTION(BlueprintPure, Category="Hwanghon|UI")
    static FVector2D ReferenceResolution();

    UFUNCTION(BlueprintPure, Category="Hwanghon|UI")
    static float ScaleForViewport(FVector2D ViewportSize);

    UFUNCTION(BlueprintPure, Category="Hwanghon|UI")
    static FMargin SafeMargin(FVector2D ViewportSize);
};
