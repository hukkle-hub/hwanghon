#pragma once

#include "CoreMinimal.h"
#include "UI/HWCombatHUD.h"
#include "UI/HWScreenWidget.h"
#include "HWStoryHUD.generated.h"

class UTextBlock;
class UImage;

// Story mode layer above the combat HUD (docs/design/137): letterbox while the episode plays as animation,
// the novel card for scenes whose animation is not made yet, and the skip control (tap / Space / Enter / Back).
UCLASS()
class HWANGHONCOMBATUE_API UHWStoryOverlayWidget : public UHWScreenWidget
{
    GENERATED_BODY()

public:
    virtual bool ShowsChrome() const override { return false; }

    TFunction<void()> OnSkip;

    void ShowCinema(const FText& Caption);
    void ShowCard(const FText& Kicker, const FText& Body, const FText& Source, bool bOpaque);
    void ShowHandoff();
    void ShowEnd(const FText& Title);
    void HideAll();
    void SetProgress(const FText& Value);
    // A one-line action prompt above the bottom edge; tapping it runs OnTap. Empty text hides it.
    void SetPrompt(const FText& Text, TFunction<void()> OnTap);

protected:
    virtual void Build(UCanvasPanel* Root) override;

private:
    void Apply();

    enum class EMode : uint8 { Hidden, Cinema, Card, Handoff, End };
    EMode Mode = EMode::Hidden;
    FText CaptionValue, KickerValue, BodyValue, SourceValue, ProgressValue;
    bool bCardOpaque = false;

    UPROPERTY(Transient) TObjectPtr<UWidget> TopBar;
    UPROPERTY(Transient) TObjectPtr<UWidget> BottomBar;
    UPROPERTY(Transient) TObjectPtr<UImage> CardBack;
    UPROPERTY(Transient) TObjectPtr<UWidget> CardBox;
    UPROPERTY(Transient) TObjectPtr<UTextBlock> Kicker;
    UPROPERTY(Transient) TObjectPtr<UTextBlock> Body;
    UPROPERTY(Transient) TObjectPtr<UTextBlock> Source;
    UPROPERTY(Transient) TObjectPtr<UTextBlock> Caption;
    UPROPERTY(Transient) TObjectPtr<UTextBlock> Progress;
    UPROPERTY(Transient) TObjectPtr<UWidget> SkipButton;
    UPROPERTY(Transient) TObjectPtr<UTextBlock> EndTitle;
    UPROPERTY(Transient) TObjectPtr<UWidget> PromptButton;
    UPROPERTY(Transient) TObjectPtr<UTextBlock> PromptText;
    FText PromptValue;
    TFunction<void()> PromptTap;
};

UCLASS()
class HWANGHONCOMBATUE_API AHWStoryHUD : public AHWCombatHUD
{
    GENERATED_BODY()

public:
    UHWStoryOverlayWidget* GetOverlay() const { return Overlay; }
    UHWCombatHUDWidget* GetCombatWidget() const { return Widget; }
    void SetCombatVisible(bool bVisible);

protected:
    virtual void BeginPlay() override;

    UPROPERTY(Transient)
    TObjectPtr<UHWStoryOverlayWidget> Overlay;
};
