#include "UI/HWCombatHUD.h"

#include "Blueprint/WidgetLayoutLibrary.h"
#include "Blueprint/WidgetTree.h"
#include "Boss/HWBossCharacter.h"
#include "Camera/HWLockOnComponent.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Combat/HWCombatTuningAsset.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/ButtonSlot.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/ProgressBar.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "UI/HWFrontendScreens.h"

using namespace HWUI;

namespace
{
    FSlateBrush Circle(const FLinearColor& Fill, const FLinearColor& Outline, float Width)
    {
        FSlateBrush Brush;
        Brush.DrawAs = ESlateBrushDrawType::RoundedBox;
        Brush.TintColor = FSlateColor(Fill);
        Brush.OutlineSettings = FSlateBrushOutlineSettings(FSlateColor(Outline), Width);   // half-height radius = circle
        return Brush;
    }

    FString PatternName(FName Pattern)
    {
        static const TMap<FName, FString> Names = {
            { TEXT("HookCombo"), TEXT("훅 연타") }, { TEXT("Charge"), TEXT("돌진") }, { TEXT("Slam"), TEXT("내려찍기") },
            { TEXT("Spin"), TEXT("회전 후려치기") }, { TEXT("Elbow"), TEXT("팔꿈치") }, { TEXT("GroundWave"), TEXT("지면 충격파 · 점프") },
        };
        const FString* Found = Names.Find(Pattern);
        return Found ? *Found : Pattern.ToString();
    }
}

void UHWCombatHUDWidget::NativeConstruct()
{
    Super::NativeConstruct();
    BindActors();
}

void UHWCombatHUDWidget::BindActors()
{
    if (!Player.IsValid())
    {
        Player = Cast<AHWAinCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0));
    }
    if (!Boss.IsValid())
    {
        Boss = Cast<AHWBossCharacter>(UGameplayStatics::GetActorOfClass(this, AHWBossCharacter::StaticClass()));
        if (Boss.IsValid())
        {
            BossMaxHealth = FMath::Max(1.f, Boss->GetMaxHealth());
            Boss->OnBossReaction.AddUniqueDynamic(this, &UHWCombatHUDWidget::HandleBossReaction);
            Boss->OnBossStateChanged.AddUniqueDynamic(this, &UHWCombatHUDWidget::HandleBossState);
        }
    }
}

UWidget* UHWCombatHUDWidget::RoundButton(const FText& Label, float Size, TFunction<void()> OnTap, bool bMain)
{
    UTextBlock* Text_ = Text(WidgetTree, Label, bMain ? EHWUITextToken::SectionTitle : EHWUITextToken::Caption,
        EHWUIColorToken::TextPrimary, bMain ? EHWUIWeight::Bold : EHWUIWeight::Medium);
    Text_->SetJustification(ETextJustify::Center);
    UButton* Button = Tap(Text_, MoveTemp(OnTap),
        Circle(C(EHWUIColorToken::BackgroundDeep, 0.55f), C(EHWUIColorToken::Line, 0.9f), 1.5f),
        Circle(C(EHWUIColorToken::PanelStrong, 0.7f), C(EHWUIColorToken::TextSecondary), 1.5f),
        Circle(C(EHWUIColorToken::Panel, 0.9f), C(EHWUIColorToken::TextPrimary), 2.f));
    if (UButtonSlot* ContentSlot = Cast<UButtonSlot>(Button->GetContentSlot()))
    {
        ContentSlot->SetHorizontalAlignment(HAlign_Center);
        ContentSlot->SetVerticalAlignment(VAlign_Center);
    }
    return Sized(WidgetTree, Button, Size, Size);
}

void UHWCombatHUDWidget::Build(UCanvasPanel* Root)
{
    const float X = SafeX();
    const float Top = M(EHWUIMetricToken::SafeTop);
    const float Bottom = M(EHWUIMetricToken::SafeBottom);

    // Boss bar: top centre, thin.
    UVerticalBox* BossBox = VBox(WidgetTree);
    UHorizontalBox* BossHead = HBox(WidgetTree);
    BossNameText = Text(WidgetTree, BossNameValue.IsEmpty() ? NSLOCTEXT("HWUI", "BossName", "훈련 보스") : BossNameValue, EHWUITextToken::Body, EHWUIColorToken::TextPrimary, EHWUIWeight::Medium);
    AddH(BossHead, BossNameText, FMargin(0), true);
    BossTell = Text(WidgetTree, FText::GetEmpty(), EHWUITextToken::Caption, EHWUIColorToken::TextSecondary);
    AddH(BossHead, BossTell);
    AddV(BossBox, BossHead, FMargin(0.f, 0.f, 0.f, 6.f));
    UProgressBar* BossProgress = nullptr;
    AddV(BossBox, Bar(WidgetTree, 1.f, C(EHWUIColorToken::Danger), 880.f, 8.f, &BossProgress));
    BossBar = BossProgress;
    BossBox->SetVisibility(ESlateVisibility::HitTestInvisible);
    Place(Root, Sized(WidgetTree, BossBox, 880.f, 0.f), FAnchors(0.5f, 0.f), FMargin(0.f, Top + 14.f, 880.f, 0.f), FVector2D(0.5f, 0.f), true);

    // Party: far left, compact.
    UHorizontalBox* Party = HBox(WidgetTree);
    AddH(Party, Sized(WidgetTree, Fit(WidgetTree, Art(TEXT("face-ain")), true), 48.f, 48.f), FMargin(0.f, 0.f, 12.f, 0.f));
    UVerticalBox* PartyNames = VBox(WidgetTree);
    AddV(PartyNames, Text(WidgetTree, NSLOCTEXT("HWUI", "Ain", "아인"), EHWUITextToken::Caption, EHWUIColorToken::TextPrimary, EHWUIWeight::Medium));
    UProgressBar* PartyProgress = nullptr;
    AddV(PartyNames, Bar(WidgetTree, 1.f, C(EHWUIColorToken::TextPrimary), 132.f, 4.f, &PartyProgress), FMargin(0.f, 6.f, 0.f, 0.f));
    PartyHp = PartyProgress;
    AddH(Party, PartyNames)->SetVerticalAlignment(VAlign_Center);
    Party->SetVisibility(ESlateVisibility::HitTestInvisible);
    Place(Root, Party, FAnchors(0.f, 0.3f), FMargin(X, 0.f, 0.f, 0.f), FVector2D(0.f, 0.5f), true);

    // Player HP / ST on the bottom edge, left of centre.
    UVerticalBox* Vitals = VBox(WidgetTree);
    UHorizontalBox* HpRow = HBox(WidgetTree);
    AddH(HpRow, Text(WidgetTree, NSLOCTEXT("HWUI", "HP", "HP"), EHWUITextToken::Micro, EHWUIColorToken::TextMuted), FMargin(0.f, 0.f, 10.f, 0.f))
        ->SetVerticalAlignment(VAlign_Center);
    UProgressBar* HpProgress = nullptr;
    AddH(HpRow, Bar(WidgetTree, 1.f, C(EHWUIColorToken::TextPrimary), 440.f, 8.f, &HpProgress))->SetVerticalAlignment(VAlign_Center);
    HpBar = HpProgress;
    HpText = Text(WidgetTree, FText::GetEmpty(), EHWUITextToken::Micro, EHWUIColorToken::TextSecondary);
    AddH(HpRow, HpText, FMargin(10.f, 0.f, 0.f, 0.f))->SetVerticalAlignment(VAlign_Center);
    AddV(Vitals, HpRow);
    UHorizontalBox* StRow = HBox(WidgetTree);
    AddH(StRow, Text(WidgetTree, NSLOCTEXT("HWUI", "ST", "ST"), EHWUITextToken::Micro, EHWUIColorToken::TextMuted), FMargin(0.f, 0.f, 10.f, 0.f))
        ->SetVerticalAlignment(VAlign_Center);
    UProgressBar* StProgress = nullptr;
    AddH(StRow, Bar(WidgetTree, 1.f, C(EHWUIColorToken::TextSecondary), 440.f, 4.f, &StProgress))->SetVerticalAlignment(VAlign_Center);
    StBar = StProgress;
    AddV(Vitals, StRow, FMargin(0.f, 8.f, 0.f, 0.f));
    Vitals->SetVisibility(ESlateVisibility::HitTestInvisible);
    Place(Root, Vitals, FAnchors(0.5f, 1.f), FMargin(-60.f, -(Bottom + 18.f), 0.f, 0.f), FVector2D(1.f, 1.f), true);

    // Joystick: bottom-left ring (touch input is the engine's; this is the resting mark).
    UBorder* Ring = Panel(WidgetTree, Circle(C(EHWUIColorToken::BackgroundDeep, 0.22f), C(EHWUIColorToken::Line), 1.5f), FMargin(0));
    UBorder* Knob = Panel(WidgetTree, Circle(C(EHWUIColorToken::PanelSoft, 0.8f), C(EHWUIColorToken::Line), 1.f), FMargin(0));
    Ring->SetContent(Sized(WidgetTree, Knob, 84.f, 84.f));
    Ring->SetHorizontalAlignment(HAlign_Center);
    Ring->SetVerticalAlignment(VAlign_Center);
    Ring->SetVisibility(ESlateVisibility::HitTestInvisible);
    Place(Root, Sized(WidgetTree, Ring, 210.f, 210.f), FAnchors(0.f, 1.f), FMargin(X + 40.f, -(Bottom + 40.f), 210.f, 210.f), FVector2D(0.f, 1.f));

    // Actions: bottom-right cluster. Same calls the keyboard bindings make.
    auto Combat = [this]() -> UHWCombatComponent* { return Player.IsValid() ? Player->GetCombat() : nullptr; };
    UCanvasPanel* Actions = WidgetTree->ConstructWidget<UCanvasPanel>();
    Actions->SetVisibility(ESlateVisibility::SelfHitTestInvisible);
    auto Put = [Actions](UWidget* W, float Right, float BottomOffset, float Size)
    {
        Place(Actions, W, FAnchors(1.f, 1.f), FMargin(-Right, -BottomOffset, Size, Size), FVector2D(1.f, 1.f));
    };
    Put(RoundButton(NSLOCTEXT("HWUI", "Attack", "공격"), 136.f, [Combat]() { if (UHWCombatComponent* Cb = Combat()) { Cb->RequestAttack(); } }, true), 0.f, 0.f, 136.f);
    Put(RoundButton(NSLOCTEXT("HWUI", "Smash", "스매시"), 88.f, [Combat]() { if (UHWCombatComponent* Cb = Combat()) { Cb->RequestSmash(); } }), 160.f, 8.f, 88.f);
    Put(RoundButton(NSLOCTEXT("HWUI", "Counter", "카운터"), 88.f, [Combat]() { if (UHWCombatComponent* Cb = Combat()) { Cb->RequestCounter(); } }), 138.f, 118.f, 88.f);
    Put(RoundButton(NSLOCTEXT("HWUI", "Dodge", "회피"), 88.f, [Combat]() { if (UHWCombatComponent* Cb = Combat()) { Cb->RequestDodge(); } }), 36.f, 160.f, 88.f);
    Put(RoundButton(NSLOCTEXT("HWUI", "Jump", "점프"), 72.f, [Combat]() { if (UHWCombatComponent* Cb = Combat()) { Cb->RequestJump(); } }), 262.f, 0.f, 72.f);
    Put(RoundButton(NSLOCTEXT("HWUI", "Lock", "락온"), 64.f, [this]() { if (Player.IsValid() && Player->GetLockOn()) { Player->GetLockOn()->ToggleLockOn(); } }), 0.f, 268.f, 64.f);
    Place(Root, Actions, FAnchors(1.f, 1.f), FMargin(-X, -(Bottom + 24.f), 420.f, 360.f), FVector2D(1.f, 1.f));

    // Lock-on / tell mark: a small ring beside the target, nothing else.
    UBorder* Mark = Panel(WidgetTree, Circle(FLinearColor::Transparent, C(EHWUIColorToken::TextPrimary, 0.85f), 2.f), FMargin(0));
    Mark->SetVisibility(ESlateVisibility::Collapsed);
    LockMark = Mark;
    LockSlot = Place(Root, Mark, FAnchors(0.f, 0.f), FMargin(0.f, 0.f, 30.f, 30.f), FVector2D(0.5f, 0.5f));

    // Centre word: only decisive moments, briefly.
    CenterWord = Text(WidgetTree, FText::GetEmpty(), EHWUITextToken::Hero, EHWUIColorToken::TextPrimary, EHWUIWeight::Bold);
    CenterWord->SetFont(FontSized(44.f, EHWUIWeight::Bold));
    CenterWord->SetVisibility(ESlateVisibility::Collapsed);
    Place(Root, CenterWord, FAnchors(0.5f, 0.36f), FMargin(0), FVector2D(0.5f, 0.5f), true);

    ResultLayer = WidgetTree->ConstructWidget<UCanvasPanel>();
    ResultLayer->SetVisibility(ESlateVisibility::Collapsed);
    Stretch(Root, ResultLayer);
}

void UHWCombatHUDWidget::Flash(const FString& Word)
{
    LastFlash = Word;
    FlashAge = 0.f;
    if (CenterWord)
    {
        CenterWord->SetText(FText::FromString(Word));
        CenterWord->SetColorAndOpacity(FSlateColor(Word == TEXT("BREAK") ? C(EHWUIColorToken::Danger) : C(EHWUIColorToken::Gold)));
        CenterWord->SetVisibility(ESlateVisibility::HitTestInvisible);
    }
}

void UHWCombatHUDWidget::HandleBossReaction(EHWAttackTier Tier, FVector WorldDirection)
{
    if (Tier == EHWAttackTier::Counter)
    {
        Flash(TEXT("COUNTER"));
    }
}

void UHWCombatHUDWidget::HandleBossState(EHWBossState NewState, FName PatternId)
{
    TellElapsed = 0.f;
    if (NewState == EHWBossState::Break)
    {
        Flash(TEXT("BREAK"));
    }
}

void UHWCombatHUDWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
    Super::NativeTick(MyGeometry, InDeltaTime);
    BindActors();

    if (Boss.IsValid() && BossBar)
    {
        BossMaxHealth = FMath::Max(1.f, Boss->GetMaxHealth());
        BossBar->SetPercent(Boss->GetHealth() / BossMaxHealth);
        const EHWBossState State = Boss->GetBossState();
        TellElapsed += InDeltaTime;
        if (BossTell)
        {
            if (State == EHWBossState::Tell)
            {
                BossTell->SetText(FText::FromString(TEXT("예고 · ") + PatternName(Boss->GetCurrentPatternId())));
                BossTell->SetColorAndOpacity(FSlateColor(C(EHWUIColorToken::TextPrimary)));
            }
            else if (State == EHWBossState::Stagger || State == EHWBossState::Break)
            {
                BossTell->SetText(State == EHWBossState::Break ? NSLOCTEXT("HWUI", "Down", "다운") : NSLOCTEXT("HWUI", "Stagger", "경직"));
                BossTell->SetColorAndOpacity(FSlateColor(C(EHWUIColorToken::TextSecondary)));
            }
            else
            {
                BossTell->SetText(FText::GetEmpty());
            }
        }
    }

    if (Player.IsValid())
    {
        if (UHWCombatComponent* Combat = Player->GetCombat())
        {
            const float MaxHp = FMath::Max(1.f, Combat->GetMaxHealth());
            const float MaxSt = Combat->Tuning ? FMath::Max(1.f, Combat->Tuning->MaxStamina) : 120.f;
            const float Hp = Combat->GetHealth() / MaxHp;
            if (HpBar) { HpBar->SetPercent(Hp); }
            if (PartyHp) { PartyHp->SetPercent(Hp); }
            if (StBar) { StBar->SetPercent(Combat->GetStamina() / MaxSt); }
            if (HpText) { HpText->SetText(FText::AsNumber(FMath::RoundToInt(Combat->GetHealth()))); }
            if (!bResultShown && !bStoryOwnsOutcome && EndDelay < 0.f && Combat->IsDead())
            {
                EndDelay = 1.4f;
                bEndVictory = false;
            }
        }

        // Mark sits beside the target, only while locked.
        UHWLockOnComponent* LockOn = Player->GetLockOn();
        APlayerController* PC = GetOwningPlayer();
        FVector2D Screen;
        if (LockMark && LockSlot && LockOn && LockOn->IsLocked() && LockOn->GetTarget() && PC
            && UWidgetLayoutLibrary::ProjectWorldLocationToWidgetPosition(PC, LockOn->GetTarget()->GetActorLocation() + FVector(0.f, 0.f, 40.f), Screen, false))
        {
            LockSlot->SetPosition(Screen + FVector2D(110.f, -40.f));
            const bool bTell = Boss.IsValid() && Boss->GetBossState() == EHWBossState::Tell;
            Cast<UBorder>(LockMark)->SetBrush(Circle(FLinearColor::Transparent,
                bTell ? C(EHWUIColorToken::Danger) : C(EHWUIColorToken::TextPrimary, 0.85f), 2.f));
            LockMark->SetVisibility(ESlateVisibility::HitTestInvisible);
        }
        else if (LockMark)
        {
            LockMark->SetVisibility(ESlateVisibility::Collapsed);
        }
    }

    if (Boss.IsValid() && !bResultShown && !bStoryOwnsOutcome && EndDelay < 0.f && Boss->IsDead())
    {
        EndDelay = 1.4f;
        bEndVictory = true;
    }
    if (EndDelay >= 0.f)
    {
        EndDelay -= InDeltaTime;
        if (EndDelay < 0.f)
        {
            ShowResult(bEndVictory);
        }
    }

    FlashAge += InDeltaTime;
    if (CenterWord && CenterWord->GetVisibility() != ESlateVisibility::Collapsed)
    {
        constexpr float Hold = 0.45f;
        constexpr float Fade = 0.3f;
        const float Alpha = FlashAge < Hold ? 1.f : 1.f - (FlashAge - Hold) / Fade;
        if (Alpha <= 0.f)
        {
            CenterWord->SetVisibility(ESlateVisibility::Collapsed);
        }
        else
        {
            CenterWord->SetRenderOpacity(Alpha);
            CenterWord->SetRenderScale(FVector2D(1.f + 0.06f * FMath::Max(0.f, 1.f - FlashAge / 0.12f)));
        }
    }
}

void UHWCombatHUDWidget::SetBossName(const FText& Name)
{
    BossNameValue = Name;
    if (BossNameText)
    {
        BossNameText->SetText(Name);
    }
}

void UHWCombatHUDWidget::ShowResult(bool bVictory)
{
    if (bResultShown || !ResultLayer)
    {
        return;
    }
    bResultShown = true;
    ResultLayer->ClearChildren();
    Stretch(ResultLayer, Fill(WidgetTree, C(EHWUIColorToken::OverlayDim)));

    UClass* Class = LoadClass<UHWResultModal>(nullptr, TEXT("/Game/UI/Screens/WBP_Result.WBP_Result_C"), nullptr, LOAD_NoWarn | LOAD_Quiet);
    if (!Class || !Class->IsChildOf(UHWResultModal::StaticClass()))
    {
        Class = UHWResultModal::StaticClass();
    }
    UHWResultModal* Modal = CreateWidget<UHWResultModal>(GetOwningPlayer(), Class);
    Modal->bFromCombat = true;
    Modal->bVictory = bVictory;
    UBorder* Frame = Panel(WidgetTree, Box(C(EHWUIColorToken::PanelStrong), 6.f, C(EHWUIColorToken::Line), 1.f), FMargin(0));
    Frame->SetContent(Modal);
    Place(ResultLayer, Frame, FAnchors(0.5f, 0.5f), FMargin(0.f, 0.f, M(EHWUIMetricToken::ModalWidth), M(EHWUIMetricToken::ModalHeight)), FVector2D(0.5f, 0.5f));
    ResultLayer->SetVisibility(ESlateVisibility::SelfHitTestInvisible);

    if (APlayerController* PC = GetOwningPlayer())
    {
        PC->SetShowMouseCursor(true);
        FInputModeGameAndUI Mode;
        Mode.SetHideCursorDuringCapture(false);
        PC->SetInputMode(Mode);
    }
}

void AHWCombatHUD::BeginPlay()
{
    Super::BeginPlay();
    APlayerController* PC = GetOwningPlayerController();
    if (!PC || !PC->IsLocalController())
    {
        return;
    }
    UClass* Class = LoadClass<UHWCombatHUDWidget>(nullptr, TEXT("/Game/UI/Screens/WBP_CombatHUD.WBP_CombatHUD_C"), nullptr, LOAD_NoWarn | LOAD_Quiet);
    if (!Class || !Class->IsChildOf(UHWCombatHUDWidget::StaticClass()))
    {
        Class = UHWCombatHUDWidget::StaticClass();
    }
    Widget = CreateWidget<UHWCombatHUDWidget>(PC, Class);
    if (Widget)
    {
        Widget->AddToViewport(0);
    }
}
