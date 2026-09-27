#include "Game/HWShellPlayerController.h"
#include "Game/HWQuestRunSubsystem.h"
#include "Content/HWGameContentSubsystem.h"
#include "Progression/HWProfileSubsystem.h"
#include "Character/HWAinCharacter.h"
#include "Boss/HWBossCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Combat/HWCombatTuningAsset.h"
#include "Styling/CoreStyle.h"
#include "Brushes/SlateColorBrush.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Layout/SWidgetSwitcher.h"
#include "Widgets/Layout/SUniformGridPanel.h"
#include "Widgets/Layout/SSpacer.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/SOverlay.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Notifications/SProgressBar.h"

namespace
{
    const FLinearColor Background(.035f, .045f, .055f, 1.f);
    const FLinearColor Panel(.07f, .085f, .10f, 1.f);
    const FLinearColor Highlight(.13f, .17f, .19f, 1.f);
    const FLinearColor Accent(.83f, .39f, .19f, 1.f);
    const FLinearColor Ink(.92f, .90f, .85f, 1.f);
    const FLinearColor Muted(.57f, .65f, .67f, 1.f);
    FText Txt(const TCHAR* Text) { return FText::FromString(Text); }
}

class SHWShellView : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SHWShellView) {} SLATE_END_ARGS()
    void Construct(const FArguments&, AHWShellPlayerController* InController)
    {
        Controller = InController;
        ButtonStyle.SetNormal(FSlateColorBrush(Highlight)).SetHovered(FSlateColorBrush(FLinearColor(.20f,.24f,.26f,1.f)))
            .SetPressed(FSlateColorBrush(Accent)).SetDisabled(FSlateColorBrush(FLinearColor(.05f,.06f,.07f,1.f)))
            .SetNormalPadding(FMargin(0.f)).SetPressedPadding(FMargin(0.f));
        PrimaryButtonStyle = ButtonStyle;
        PrimaryButtonStyle.SetNormal(FSlateColorBrush(Accent)).SetHovered(FSlateColorBrush(FLinearColor(.95f,.50f,.25f,1.f)))
            .SetPressed(FSlateColorBrush(FLinearColor(.65f,.25f,.10f,1.f)));
        HealthBarStyle.SetBackgroundImage(FSlateColorBrush(Panel)).SetFillImage(FSlateColorBrush(FLinearColor::White));
        ChildSlot
        [
            SNew(SOverlay)
            + SOverlay::Slot()
            [
                SNew(SWidgetSwitcher).WidgetIndex_Lambda([this]() { return IsLobby() && (State() == EHWQuestRunState::Idle || State() == EHWQuestRunState::Prepared) ? 0 : (Active() ? 1 : 2); })
                + SWidgetSwitcher::Slot()[Menu()]
                + SWidgetSwitcher::Slot()[CombatHUD()]
                + SWidgetSwitcher::Slot()[Result()]
            ]
            + SOverlay::Slot()
            [SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(FLinearColor(0.f,0.f,0.f,.8f))
                .Visibility_Lambda([this]() { return Controller.IsValid() && Controller->bLeaveConfirmation ? EVisibility::Visible : EVisibility::Collapsed; })
                .OnMouseButtonDown_Lambda([](const FGeometry&, const FPointerEvent&) { return FReply::Handled(); })]
            + SOverlay::Slot().HAlign(HAlign_Center).VAlign(VAlign_Center)
            [
                SNew(SBox).WidthOverride_Lambda([this]() { return Portrait() ? 350.f : 480.f; })
                .Visibility_Lambda([this]() { return Controller.IsValid() && Controller->bLeaveConfirmation ? EVisibility::Visible : EVisibility::Collapsed; })
                [
                    SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(Panel).Padding(24.f)
                    [SNew(SVerticalBox)
                        + SVerticalBox::Slot().AutoHeight().Padding(0,0,0,16)[Label(Txt(TEXT("훈련을 종료할까요?")), 24)]
                        + SVerticalBox::Slot().AutoHeight().Padding(0,0,0,20)[Label(Txt(TEXT("이번 전투는 클리어로 기록되지 않습니다.")), 16, Muted)]
                        + SVerticalBox::Slot().AutoHeight()
                        [SNew(SBox).Visibility_Lambda([this]() { return Controller->GetUIError().IsEmpty() ? EVisibility::Collapsed : EVisibility::Visible; })
                            [Label(TAttribute<FText>::CreateLambda([this]() { return Controller->GetUIError(); }), 15, Accent)]]
                        + SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)[Button(TEXT("HW.ConfirmLeave"), Txt(TEXT("훈련 종료")), [this]() { Controller->ReturnToLobby(true); })]
                        + SVerticalBox::Slot().AutoHeight()[Button(TEXT("HW.CancelLeave"), Txt(TEXT("계속 훈련하기")), [this]() { Controller->SetLeaveConfirmation(false); })]
                    ]
                ]
            ]
        ];
    }

private:
    TWeakObjectPtr<AHWShellPlayerController> Controller;
    FButtonStyle ButtonStyle;
    FButtonStyle PrimaryButtonStyle;
    FProgressBarStyle HealthBarStyle;
    FName Selection;
    bool IsLobby() const { return Controller.IsValid() && Controller->IsLobby(); }
    bool Portrait() const { return Controller.IsValid() && Controller->IsPortrait(); }
    bool Active() const { return Controller.IsValid() && Controller->IsCombatActive(); }
    UHWProfileSubsystem* Profile() const { return Controller.IsValid() ? Controller->Profile() : nullptr; }
    UHWQuestRunSubsystem* Flow() const { return Controller.IsValid() ? Controller->Runs() : nullptr; }
    EHWQuestRunState State() const { return Flow() ? Flow()->GetRunState() : EHWQuestRunState::Idle; }
    bool Pending() const { return State() == EHWQuestRunState::VictoryPendingSave || (Profile() && Profile()->HasPendingSave()); }
    FHWQuestDefinition Quest() const
    {
        FHWQuestDefinition Row;
        if (Controller.IsValid() && Controller->Content()) { Controller->Content()->GetQuest(Selection, Row); }
        return Row;
    }
    bool CanLaunch() const
    {
        FString Reason;
        return Flow() && (Selection.IsNone() ? Flow()->CanPrepareTraining(Reason) : Flow()->CanPrepareQuest(Selection, Reason));
    }
    bool CanClaim() const { return !Selection.IsNone() && Profile() && Profile()->GetQuestState(Selection) == EHWQuestState::Cleared; }
    FText Status(FName Id) const
    {
        if (!Profile() || !Profile()->IsProfileAvailable()) { return Txt(TEXT("기록 확인 필요")); }
        if (Id.IsNone()) { return Txt(Profile()->GetClearCount(TEXT("tutorial")) > 0 ? TEXT("훈련 완료 · 재도전 가능") : TEXT("첫 출격")); }
        switch (Profile()->GetQuestState(Id))
        {
        case EHWQuestState::Locked: return Txt(TEXT("선행 전투 완료 필요"));
        case EHWQuestState::Cleared: return Txt(TEXT("완료 · 보수 수령 가능"));
        case EHWQuestState::Claimed: return Txt(TEXT("보수 수령 완료"));
        case EHWQuestState::Available: return Txt(TEXT("해금됨 · 전투 준비 중"));
        default: return Txt(TEXT("기록 확인 필요"));
        }
    }
    TSharedRef<SWidget> Label(TAttribute<FText> Text, int32 Size=18, FLinearColor Color=Ink)
    {
        return SNew(STextBlock).Text(Text).Font(FCoreStyle::GetDefaultFontStyle("Regular", Size)).ColorAndOpacity(Color).AutoWrapText(true);
    }
    TSharedRef<SWidget> Button(FName ButtonTag, TAttribute<FText> Caption, TFunction<void()> Action, TAttribute<bool> Enabled=true)
    {
        return SNew(SBox).MinDesiredHeight(64.f)
        [SNew(SButton).Tag(ButtonTag).ButtonStyle(ButtonTag == TEXT("HW.Launch") || ButtonTag == TEXT("HW.RetrySave") || ButtonTag == TEXT("HW.RetryEncounter") ? &PrimaryButtonStyle : &ButtonStyle)
            .ContentPadding(FMargin(6.f,8.f)).IsFocusable(false).IsEnabled(Enabled)
            .HAlign(HAlign_Center).VAlign(VAlign_Center)
            .OnClicked_Lambda([Action]() { Action(); return FReply::Handled(); })[Label(Caption, 18)]];
    }
    TSharedRef<SWidget> List()
    {
        TSharedRef<SVerticalBox> Rows = SNew(SVerticalBox);
        auto Add = [this, Rows](FName Id, const FText& Name)
        {
            Rows->AddSlot().AutoHeight().Padding(0,0,0,8)
            [SNew(SBox).MinDesiredHeight(76.f)
                [SNew(SButton).Tag(Id.IsNone() ? FName(TEXT("HW.Training")) : FName(*(TEXT("HW.Quest.") + Id.ToString())))
                    .ButtonStyle(&ButtonStyle).ContentPadding(FMargin(16.f,8.f)).IsFocusable(false)
                    .ButtonColorAndOpacity_Lambda([this, Id]() { return Selection == Id ? FLinearColor(1.9f,1.6f,1.2f,1.f) : FLinearColor::White; })
                    .OnClicked_Lambda([this, Id]() { Selection = Id; return FReply::Handled(); })
                    [SNew(SVerticalBox)
                        + SVerticalBox::Slot().AutoHeight()[Label(Name, 19)]
                        + SVerticalBox::Slot().AutoHeight().Padding(0,5,0,0)[Label(TAttribute<FText>::CreateLambda([this, Id]() { return Status(Id); }), 13, Muted)]
                    ]
                ]
            ];
        };
        Add(NAME_None, Txt(TEXT("지하 훈련장")));
        if (Controller.IsValid() && Controller->Content())
        {
            TArray<FHWQuestDefinition> Quests = Controller->Content()->GetQuests();
            Quests.Sort([](const FHWQuestDefinition& A, const FHWQuestDefinition& B) { return A.ChapterId.LexicalLess(B.ChapterId); });
            for (const auto& Q : Quests) { Add(Q.Id, Q.DisplayName); }
        }
        return SNew(SScrollBox).Tag(TEXT("HW.QuestListScroll")) + SScrollBox::Slot()[Rows];
    }
    FText DetailBody() const
    {
        if (Selection.IsNone())
        {
            return Txt(TEXT("마태오의 인력사무소 지하\n\n회피와 반격의 타이밍을 익히고 훈련체를 제압하세요. 클리어 기록이 저장되면 첫 의뢰가 열립니다.\n\n공격 예고를 보고 대응하세요. 반격 가능한 타격에는 카운터, 지면 파동에는 점프를 사용합니다."));
        }
        const FHWQuestDefinition Q = Quest();
        FString Text = FString::Printf(TEXT("추천 레벨 %d  ·  추천 전투력 %s\n\n"), Q.RecommendedLevel, *FText::AsNumber(Q.RecommendedCombatPower).ToString());
        Text += TEXT("사무소 보수\n");
        for (const auto& Reward : Q.ClaimRewards)
        {
            const FString Name = Reward.Id == TEXT("gold") ? TEXT("골드") : Reward.Id == TEXT("exp") ? TEXT("경험치")
                : Reward.Id == TEXT("m_alloy") ? TEXT("합금") : Reward.Id == TEXT("m_core") ? TEXT("변이 핵")
                : Reward.Id == TEXT("m_shard") ? TEXT("파편") : Reward.Id.ToString();
            Text += FString::Printf(TEXT("%s  %s%s\n"), *Name, *FText::AsNumber(Reward.Min).ToString(),
                Reward.Min == Reward.Max ? TEXT("") : *FString::Printf(TEXT("–%s"), *FText::AsNumber(Reward.Max).ToString()));
        }
        Text += TEXT("\n의뢰 전투는 준비 중입니다. 현재는 지하 훈련장에 출격할 수 있습니다.");
        return FText::FromString(Text);
    }
    TSharedRef<SWidget> Detail()
    {
        return SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(Panel).Padding(16.f)
        [SNew(SVerticalBox)
            + SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)[Label(TAttribute<FText>::CreateLambda([this]() { return Status(Selection); }), 14, Accent)]
            + SVerticalBox::Slot().AutoHeight().Padding(0,0,0,12)[Label(TAttribute<FText>::CreateLambda([this]() { return Selection.IsNone() ? Txt(TEXT("지하 훈련장")) : Quest().DisplayName; }), 24)]
            + SVerticalBox::Slot().FillHeight(1.f)
            [SNew(SScrollBox) + SScrollBox::Slot()[Label(TAttribute<FText>::CreateLambda([this]() { return DetailBody(); }), 17, Muted)]]
            + SVerticalBox::Slot().AutoHeight().Padding(0,12,0,0)
            [Button(TEXT("HW.Launch"), TAttribute<FText>::CreateLambda([this]() { return CanClaim() ? Txt(TEXT("보수 수령")) : CanLaunch() ? Txt(TEXT("출격하기")) : Txt(TEXT("출격 대기")); }),
                [this]() { if (CanClaim()) { Controller->ClaimSelection(Selection); } else { Controller->StartSelection(Selection); } },
                TAttribute<bool>::CreateLambda([this]() { return !Pending() && (CanClaim() || CanLaunch()); }))]
        ];
    }
    TSharedRef<SWidget> ErrorAndSave()
    {
        return SNew(SVerticalBox).Visibility_Lambda([this]()
            {
                return !Profile() || !Profile()->IsProfileAvailable() || Pending() || !Controller->GetUIError().IsEmpty()
                    || (Flow() && !Flow()->GetLastError().IsEmpty()) ? EVisibility::Visible : EVisibility::Collapsed;
            })
            + SVerticalBox::Slot().AutoHeight().Padding(0,8)
            [Label(TAttribute<FText>::CreateLambda([this]()
            {
                if (!Profile() || !Profile()->IsProfileAvailable()) { return Txt(TEXT("기존 기록을 읽지 못했습니다. 파일을 보존한 상태로 확인이 필요합니다.")); }
                if (Pending()) { return Txt(TEXT("저장이 완료되지 않았습니다. 앱을 종료하기 전에 다시 저장해 주세요.")); }
                if (!Controller->GetUIError().IsEmpty()) { return Controller->GetUIError(); }
                return Flow() && !Flow()->GetLastError().IsEmpty() ? Txt(TEXT("이동을 완료하지 못했습니다. 인력사무소로 돌아가 다시 출격해 주세요.")) : FText::GetEmpty();
            }), 15, Accent)]
            + SVerticalBox::Slot().AutoHeight()
            [SNew(SBox).Visibility_Lambda([this]() { return Pending() ? EVisibility::Visible : EVisibility::Collapsed; })
                [Button(TEXT("HW.RetrySave"), Txt(TEXT("저장 재시도")), [this]() { Controller->RetrySave(); })]];
    }
    TSharedRef<SWidget> Menu()
    {
        return SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(Background).Padding(16.f)
        [SNew(SVerticalBox)
            + SVerticalBox::Slot().AutoHeight().Padding(0,0,0,12)
            [SNew(SHorizontalBox)
                + SHorizontalBox::Slot().FillWidth(1.f)[Label(Txt(TEXT("황혼  /  인력사무소")), 22)]
                + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)[Label(Txt(TEXT("아인")), 16, Accent)]
            ]
            + SVerticalBox::Slot().FillHeight(1.f)
            [SNew(SWidgetSwitcher).WidgetIndex_Lambda([this]() { return Portrait() ? 1 : 0; })
                + SWidgetSwitcher::Slot()
                [SNew(SHorizontalBox)
                    + SHorizontalBox::Slot().FillWidth(.42f).Padding(0,0,20,0)[List()]
                    + SHorizontalBox::Slot().FillWidth(.58f)[Detail()]]
                + SWidgetSwitcher::Slot()
                [SNew(SVerticalBox)
                    + SVerticalBox::Slot().FillHeight(.38f).Padding(0,0,0,12)[List()]
                    + SVerticalBox::Slot().FillHeight(.62f)[Detail()]]
            ]
            + SVerticalBox::Slot().AutoHeight()[ErrorAndSave()]
            + SVerticalBox::Slot().AutoHeight().Padding(0,8,0,0)
            [Label(TAttribute<FText>::CreateLambda([this]() { return FText::FromString(FString::Printf(TEXT("훈련 완료 %d회   ·   사무소 보수 %s G"), Profile() ? Profile()->GetClearCount(TEXT("tutorial")) : 0, *FText::AsNumber(Profile() ? Profile()->GetGold() : 0).ToString())); }), 13, Muted)]
        ];
    }
    TSharedRef<SWidget> Movement()
    {
        TSharedRef<SHorizontalBox> Row = SNew(SHorizontalBox);
        const TCHAR* Captions[] = {TEXT("전진"), TEXT("후퇴"), TEXT("왼쪽"), TEXT("오른쪽")};
        for (int32 Direction = 0; Direction < 4; ++Direction)
        {
            Row->AddSlot().AutoWidth().Padding(2.f)
            [SNew(SBox).WidthOverride(64.f).HeightOverride(64.f)
                [SNew(SButton).Tag(FName(*FString::Printf(TEXT("HW.Move%d"), Direction))).ButtonStyle(&ButtonStyle).IsFocusable(false)
                    .TouchMethod(EButtonTouchMethod::DownAndUp).ClickMethod(EButtonClickMethod::DownAndUp)
                    .OnPressed_Lambda([this, Direction]() { Controller->SetMoveHeld(Direction, true); })
                    .OnReleased_Lambda([this, Direction]() { Controller->SetMoveHeld(Direction, false); })
                    .OnUnhovered_Lambda([this, Direction]() { Controller->SetMoveHeld(Direction, false); })
                    .ContentPadding(FMargin(2.f))
                    .HAlign(HAlign_Center).VAlign(VAlign_Center)[Label(Txt(Captions[Direction]), 14)]]];
        }
        return Row;
    }
    TSharedRef<SWidget> Actions()
    {
        TSharedRef<SUniformGridPanel> Grid = SNew(SUniformGridPanel).SlotPadding(3.f);
        const TCHAR* Ids[] = {TEXT("Attack"),TEXT("Smash"),TEXT("Lock"),TEXT("Dodge"),TEXT("Jump"),TEXT("Counter")};
        const TCHAR* Captions[] = {TEXT("공격"),TEXT("강타"),TEXT("고정"),TEXT("회피"),TEXT("점프"),TEXT("반격")};
        for (int32 I = 0; I < 6; ++I)
        {
            const FName Id(Ids[I]);
            Grid->AddSlot(I % 3, I / 3)
            [SNew(SBox).WidthOverride(72.f)[Button(FName(*(TEXT("HW.") + Id.ToString())), Txt(Captions[I]), [this, Id]() { Controller->CombatAction(Id); })]];
        }
        return Grid;
    }
    FText BossTell() const
    {
        const AHWBossCharacter* Boss = Controller.IsValid() ? Controller->Boss() : nullptr;
        if (!Boss) { return Txt(TEXT("훈련체를 확인하는 중")); }
        const FString Name = Boss->GetCurrentPatternId() == TEXT("Charge") ? TEXT("돌진 · 옆으로 회피")
            : Boss->GetCurrentPatternId() == TEXT("GroundWave") ? TEXT("지면 파동 · 점프")
            : Boss->GetCurrentPatternId() == TEXT("Spin") ? TEXT("회전 공격 · 거리 확보")
            : Boss->GetCurrentPatternId() == TEXT("Slam") ? TEXT("내려치기 · 반격 가능") : TEXT("연속 공격 · 마지막 타격 반격");
        return Boss->GetBossState() == EHWBossState::Tell ? FText::FromString(Name) : Txt(TEXT("예고를 보고 대응하세요"));
    }
    TSharedRef<SWidget> CombatHUD()
    {
        return SNew(SOverlay)
            + SOverlay::Slot().VAlign(VAlign_Top).Padding(16.f)
            [SNew(SVerticalBox)
                + SVerticalBox::Slot().AutoHeight()[Label(Txt(TEXT("지하 훈련장")), 22)]
                + SVerticalBox::Slot().AutoHeight().Padding(0,6)
                [Label(TAttribute<FText>::CreateLambda([this]() { const AHWBossCharacter* Boss = Controller->Boss(); return FText::FromString(FString::Printf(TEXT("훈련체  %s HP"), *FText::AsNumber(FMath::CeilToInt(Boss ? Boss->GetHealth() : 0.f)).ToString())); }), 17)]
                + SVerticalBox::Slot().AutoHeight().Padding(0,4)
                [SNew(SBox).HeightOverride(8.f)[SNew(SProgressBar).Style(&HealthBarStyle).FillColorAndOpacity(Accent).Percent_Lambda([this]() -> TOptional<float> { auto* Boss = Controller->Boss(); return Boss ? Boss->GetHealth() / 280000.f : 0.f; })]]
                + SVerticalBox::Slot().AutoHeight().Padding(0,6)[Label(TAttribute<FText>::CreateLambda([this]() { return BossTell(); }), 16, Accent)]
            ]
            + SOverlay::Slot().VAlign(VAlign_Bottom).Padding(12.f)
            [SNew(SVerticalBox)
                + SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
                [Label(TAttribute<FText>::CreateLambda([this]() { const AHWAinCharacter* Player = Cast<AHWAinCharacter>(Controller->GetPawn()); return FText::FromString(FString::Printf(TEXT("아인  %s HP   ·   기력 %d"), *FText::AsNumber(FMath::CeilToInt(Player ? Player->GetCombat()->GetHealth() : 0.f)).ToString(), Player ? FMath::CeilToInt(Player->GetCombat()->GetStamina()) : 0)); }), 16)]
                + SVerticalBox::Slot().AutoHeight()
                [SNew(SWidgetSwitcher).WidgetIndex_Lambda([this]() { return Portrait() ? 1 : 0; })
                    + SWidgetSwitcher::Slot()[SNew(SHorizontalBox)
                        + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Bottom)[Movement()]
                        + SHorizontalBox::Slot().FillWidth(1.f)[SNew(SSpacer)]
                        + SHorizontalBox::Slot().AutoWidth()[Actions()]]
                    + SWidgetSwitcher::Slot()[SNew(SVerticalBox)
                        + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center)[Movement()]
                        + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center)[Actions()]]
                ]
            ]
            + SOverlay::Slot().HAlign(HAlign_Right).VAlign(VAlign_Center).Padding(12.f)
            [SNew(SBox).WidthOverride(80.f)[Button(TEXT("HW.Leave"), Txt(TEXT("나가기")), [this]() { Controller->SetLeaveConfirmation(true); })]];
    }
    TSharedRef<SWidget> Result()
    {
        return SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(Background).Padding(20.f)
        [SNew(SVerticalBox)
            + SVerticalBox::Slot().AutoHeight().Padding(0,0,0,16)[Label(Txt(TEXT("황혼  /  훈련 결과")), 25)]
            + SVerticalBox::Slot().FillHeight(1.f)
            [SNew(SScrollBox) + SScrollBox::Slot()
                [SNew(SVerticalBox)
                    + SVerticalBox::Slot().AutoHeight().Padding(0,12)[Label(TAttribute<FText>::CreateLambda([this]()
                    {
                        if (State() == EHWQuestRunState::VictoryPendingSave) { return Txt(TEXT("훈련 완료 · 저장 대기")); }
                        if (State() == EHWQuestRunState::Victory) { return Txt(TEXT("훈련 완료")); }
                        if (State() == EHWQuestRunState::Defeat) { return Txt(TEXT("다시 일어설 시간")); }
                        if (State() == EHWQuestRunState::Traveling) { return Txt(TEXT("훈련장으로 이동 중")); }
                        return Txt(TEXT("훈련이 종료되었습니다"));
                    }), 34, Accent)]
                    + SVerticalBox::Slot().AutoHeight().Padding(0,0,0,20)[Label(TAttribute<FText>::CreateLambda([this]()
                    {
                        if (State() == EHWQuestRunState::Victory) { return Txt(TEXT("클리어 기록을 저장했습니다.\n인력사무소에서 다음 의뢰를 확인할 수 있습니다.")); }
                        if (State() == EHWQuestRunState::VictoryPendingSave) { return Txt(TEXT("훈련체를 제압했습니다.\n기록을 안전하게 남기도록 저장을 다시 시도해 주세요.")); }
                        if (State() == EHWQuestRunState::Defeat) { return Txt(TEXT("예고를 보고 한 박자 기다려 보세요.\n같은 훈련에 다시 도전할 수 있습니다.")); }
                        return Txt(TEXT("인력사무소로 돌아가 출격을 준비해 주세요."));
                    }), 18, Muted)]
                ]
            ]
            + SVerticalBox::Slot().AutoHeight()[ErrorAndSave()]
            + SVerticalBox::Slot().AutoHeight().Padding(0,8)
            [SNew(SBox).Visibility_Lambda([this]() { return Pending() ? EVisibility::Collapsed : EVisibility::Visible; })
                [Button(TEXT("HW.RetryEncounter"), Txt(TEXT("다시 도전")), [this]() { Controller->RetryEncounter(); },
                    TAttribute<bool>::CreateLambda([this]() { return !Pending() && (State() == EHWQuestRunState::Victory || State() == EHWQuestRunState::Defeat || State() == EHWQuestRunState::Aborted); }))]]
            + SVerticalBox::Slot().AutoHeight()
            [SNew(SBox).Visibility_Lambda([this]() { return Pending() ? EVisibility::Collapsed : EVisibility::Visible; })
                [Button(TEXT("HW.Return"), Txt(TEXT("인력사무소로")), [this]() { Controller->ReturnToLobby(); },
                    TAttribute<bool>::CreateLambda([this]() { return !Pending() && State() != EHWQuestRunState::Traveling && State() != EHWQuestRunState::InCombat; }))]]
        ];
    }
};

TSharedRef<SWidget> HWCreateShellView(AHWShellPlayerController* Controller)
{
    return SNew(SHWShellView, Controller);
}
