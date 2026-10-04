#pragma once

#include "CoreMinimal.h"
#include "UI/HWScreenWidget.h"
#include "HWFrontendRootWidget.generated.h"

class UImage;
class UTextBlock;

UENUM(BlueprintType)
enum class EHWFrontendScreen : uint8
{
    Title,
    Lobby,
    OfficeQuest,
    Character,
    Inventory,
    Skills,
    Forge,
    Shop,
    Looks,
    Profile
};

UENUM(BlueprintType)
enum class EHWFrontendOverlay : uint8
{
    None,
    Recruit,   // right drawer
    Result,    // single large modal
    Story      // single large modal
};

// Native fallback shell for Clean UI v1 (docs/design/123 §2):
// transparent background, TopBar 72, BottomNav 88, centre left open,
// Recruit as a right drawer, Result/Story as one large modal, Gold only for selection.
UCLASS()
class HWANGHONCOMBATUE_API UHWFrontendRootWidget : public UHWScreenWidget
{
    GENERATED_BODY()

public:
    static UHWFrontendRootWidget* GetActive();

    UFUNCTION(BlueprintCallable, Category="Hwanghon|UI")
    void ShowScreen(EHWFrontendScreen Screen);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|UI")
    void OpenOverlay(EHWFrontendOverlay Overlay);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|UI")
    void CloseOverlay();

    UFUNCTION(BlueprintCallable, Category="Hwanghon|UI")
    void GoBack();

    UFUNCTION(BlueprintCallable, Category="Hwanghon|UI")
    void Toast(const FText& Message);

    // Quest run through UHWQuestRunSubsystem; with no configured route it says so and opens the
    // graybox as an unrecorded training (a manual map open never credits a quest).
    UFUNCTION(BlueprintCallable, Category="Hwanghon|UI")
    void Sortie(FName QuestId);

    // A boss dungeon without reward (docs/design/181 §10): the training map opened with ?HWDungeon=<id>.
    void SortieBossTrial(FName DungeonId);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|UI")
    bool SelectCharacter(FName CharacterId);

    EHWFrontendScreen GetScreen() const { return Current; }
    EHWFrontendOverlay GetOverlay() const { return Overlay; }
    UHWScreenWidget* GetScreenWidget(EHWFrontendScreen Screen);

    // Shared selection across screens.
    FName SelectedQuest;
    FName SelectedCharacter = TEXT("ain");
    int32 SelectedChapter = 0;

    void RefreshChrome();

    virtual void SetArtOnly(bool bArtOnly) override;

protected:
    virtual void Build(UCanvasPanel* Root) override;
    virtual void NativeConstruct() override;
    virtual void NativeDestruct() override;
    virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;
    virtual FReply NativeOnKeyDown(const FGeometry& InGeometry, const FKeyEvent& InKeyEvent) override;

private:
    UHWScreenWidget* MakeWidget(const TCHAR* WbpName, UClass* NativeClass);
    void ApplyBackground(UHWScreenWidget* Screen);
    void BuildTopBar();
    void BuildBottomNav();

    UPROPERTY(Transient) TObjectPtr<UImage> Background;
    UPROPERTY(Transient) TObjectPtr<UImage> BackgroundDim;
    UPROPERTY(Transient) TObjectPtr<UCanvasPanel> ScreenLayer;
    UPROPERTY(Transient) TObjectPtr<UCanvasPanel> ChromeLayer;
    UPROPERTY(Transient) TObjectPtr<UCanvasPanel> OverlayLayer;
    UPROPERTY(Transient) TObjectPtr<UTextBlock> ToastText;
    UPROPERTY(Transient) TObjectPtr<UWidget> OverlayPanel;
    UPROPERTY(Transient) TObjectPtr<UHWScreenWidget> OverlayWidget;
    UPROPERTY(Transient) TMap<EHWFrontendScreen, TObjectPtr<UHWScreenWidget>> Screens;

    EHWFrontendScreen Current = EHWFrontendScreen::Title;
    EHWFrontendOverlay Overlay = EHWFrontendOverlay::None;
    float OverlayT = 1.f;
    float ToastRemaining = 0.f;
    float PendingTravel = -1.f;
    FName PendingDungeon = NAME_None;
};
