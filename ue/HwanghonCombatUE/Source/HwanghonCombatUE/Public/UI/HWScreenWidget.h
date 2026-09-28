#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "UI/HWUIKit.h"
#include "HWScreenWidget.generated.h"

class UButton;
class UCanvasPanel;
class UHWFrontendRootWidget;
class UHWGameContentSubsystem;
class UHWProfileSubsystem;
class UHWQuestRunSubsystem;
class UHWGraphicsQualitySubsystem;

// Base for every Clean UI v1 screen, drawer and modal (WBP_* derive from these classes).
// A WBP that authors its own tree keeps it; an empty WBP (as created by Scripts/ue_ui_setup.py)
// gets the native token-based layout from Build().
UCLASS(Abstract)
class HWANGHONCOMBATUE_API UHWScreenWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    void SetFrontend(UHWFrontendRootWidget* InFrontend);

    // Called whenever the shell shows this widget.
    virtual void OnShown() { RequestRefresh(); }

    // Rebuilds the native layout next tick (safe to call from a click handler).
    void RequestRefresh() { bRefreshPending = true; }

    // Measurement hook (capture tour): hide everything except key art, so UI coverage can be
    // measured as the difference between the normal frame and this one (docs/design/126 §4).
    virtual void SetArtOnly(bool bArtOnly);

    virtual FText GetScreenTitle() const { return FText::GetEmpty(); }
    virtual bool ShowsChrome() const { return true; }
    virtual FString GetBackgroundArt() const { return TEXT("lobby-bg"); }
    // 0 = art at full strength, 1 = fully pressed down (OverlayDim).
    virtual float GetBackgroundDim() const { return 0.6f; }

protected:
    virtual TSharedRef<SWidget> RebuildWidget() override;
    virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;

    virtual void Build(UCanvasPanel* Root) {}

    UButton* Tap(UWidget* Content, TFunction<void()> OnTap, const FSlateBrush& Normal,
        const FSlateBrush& Hovered, const FSlateBrush& Pressed, const FMargin& ContentPadding = FMargin(0));
    UButton* TapGhost(UWidget* Content, TFunction<void()> OnTap, const FMargin& ContentPadding = FMargin(0));
    // Card/row with the selection grammar: Gold 1 px outline + 3 px bar only when selected.
    UWidget* SelectableCard(UWidget* Content, bool bSelected, TFunction<void()> OnTap, const FMargin& ContentPadding);
    // The one strong action on a screen: dark inside, thin Gold ring, no glow.
    UWidget* PrimaryAction(const FText& Label, const FText& Caption, bool bEnabled, TFunction<void()> OnTap,
        float Width = 0.f, float Height = 0.f);
    UWidget* SecondaryAction(const FText& Label, TFunction<void()> OnTap, bool bEnabled = true);
    // "UE 에 이 시스템이 아직 없다" — shown instead of a working action, never faked.
    UWidget* NoSystemNote(const FText& What);
    UWidget* SectionTitle(const FText& Title, const FText& Right = FText::GetEmpty());

    float ContentTop() const;
    float ContentBottom() const;
    float SafeX() const;

    UHWFrontendRootWidget* GetFrontend() const;
    UHWGameContentSubsystem* ContentSystem() const;
    UHWProfileSubsystem* ProfileSystem() const;
    UHWQuestRunSubsystem* RunSystem() const;
    UHWGraphicsQualitySubsystem* GraphicsSystem() const;

    UPROPERTY(Transient)
    TObjectPtr<UCanvasPanel> NativeRoot;

    UPROPERTY(Transient)
    TArray<TObjectPtr<UHWTapProxy>> TapProxies;

    // Key art (hero illustrations) that stays visible in SetArtOnly.
    void MarkArt(UWidget* Widget) { ArtWidgets.Add(Widget); }

    UPROPERTY(Transient)
    TArray<TObjectPtr<UWidget>> ArtWidgets;

    TMap<TWeakObjectPtr<UWidget>, ESlateVisibility> ArtOnlySaved;

    TWeakObjectPtr<UHWFrontendRootWidget> Frontend;
    bool bRefreshPending = false;

private:
    void Refresh();
};
