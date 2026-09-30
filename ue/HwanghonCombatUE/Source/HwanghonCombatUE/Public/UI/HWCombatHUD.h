#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "Combat/HWCombatTypes.h"
#include "UI/HWScreenWidget.h"
#include "HWCombatHUD.generated.h"

class AHWAinCharacter;
class AHWBossCharacter;
class UProgressBar;
class UTextBlock;
class UCanvasPanelSlot;
class UHWResultModal;

// Clean UI v1 combat HUD (docs/design/123 §6, CLAUDE_APPLY §4): the centre stays empty.
// Boss bar top-centre, party far left, joystick bottom-left, actions bottom-right,
// player HP/ST on the bottom edge, lock-on/tell marks next to the target only,
// and COUNTER / BREAK flash in the centre for a moment.
UCLASS()
class HWANGHONCOMBATUE_API UHWCombatHUDWidget : public UHWScreenWidget
{
    GENERATED_BODY()

public:
    virtual bool ShowsChrome() const override { return false; }

    // Test/tour hook: the last centre word shown and how long ago.
    FString GetLastFlash() const { return LastFlash; }
    float GetFlashAge() const { return FlashAge; }

    // Story mode (docs/design/137): the story director decides what follows the fight — no result modal.
    void SetStoryOwnsOutcome(bool bOwns) { bStoryOwnsOutcome = bOwns; }
    void SetBossName(const FText& Name);
    // A novel beat said on screen for a moment (the story director: "틱—", "되돌림", "스위트 스폿").
    void ShowCallout(const FString& Word) { Flash(Word); }

protected:
    virtual void Build(UCanvasPanel* Root) override;
    virtual void NativeConstruct() override;
    virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;

private:
    UFUNCTION()
    void HandleBossReaction(EHWAttackTier Tier, FVector WorldDirection);

    UFUNCTION()
    void HandleBossState(EHWBossState NewState, FName PatternId);

    void Flash(const FString& Word);
    void BindActors();
    void ShowResult(bool bVictory);
    UWidget* RoundButton(const FText& Label, float Size, TFunction<void()> OnTap, bool bMain = false, class UTextBlock** OutText = nullptr);

    TWeakObjectPtr<AHWAinCharacter> Player;
    TWeakObjectPtr<AHWBossCharacter> Boss;

    UPROPERTY(Transient) TObjectPtr<UTextBlock> BossNameText;
    UPROPERTY(Transient) TObjectPtr<UProgressBar> BossBar;
    UPROPERTY(Transient) TObjectPtr<UTextBlock> BossTell;
    UPROPERTY(Transient) TObjectPtr<UProgressBar> HpBar;
    UPROPERTY(Transient) TObjectPtr<UProgressBar> StBar;
    UPROPERTY(Transient) TObjectPtr<UProgressBar> PartyHp;
    UPROPERTY(Transient) TObjectPtr<UTextBlock> HpText;
    UPROPERTY(Transient) TObjectPtr<UTextBlock> CenterWord;
    // skill 1-4 + ultimate labels (name, and the seconds left while cooling down)
    UPROPERTY(Transient) TArray<TObjectPtr<UTextBlock>> SkillTexts;
    FName SkillLabelsFor = NAME_None;
    void UpdateSkillButtons();
    UPROPERTY(Transient) TObjectPtr<UWidget> LockMark;
    UPROPERTY(Transient) TObjectPtr<UCanvasPanelSlot> LockSlot;
    UPROPERTY(Transient) TObjectPtr<UCanvasPanel> ResultLayer;

    float BossMaxHealth = 0.f;
    float TellElapsed = 0.f;
    float EndDelay = -1.f;
    bool bEndVictory = false;
    bool bResultShown = false;
    bool bStoryOwnsOutcome = false;
    FText BossNameValue;
    FString LastFlash;
    float FlashAge = 99.f;
};

UCLASS()
class HWANGHONCOMBATUE_API AHWCombatHUD : public AHUD
{
    GENERATED_BODY()

protected:
    virtual void BeginPlay() override;

    UPROPERTY(Transient)
    TObjectPtr<UHWCombatHUDWidget> Widget;
};
