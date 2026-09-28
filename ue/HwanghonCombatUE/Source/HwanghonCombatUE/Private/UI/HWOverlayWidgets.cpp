#include "UI/HWFrontendScreens.h"

#include "Blueprint/WidgetTree.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/CanvasPanel.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/ScrollBox.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"
#include "Content/HWGameContentSubsystem.h"
#include "Game/HWQuestRunSubsystem.h"
#include "Kismet/GameplayStatics.h"
#include "Progression/HWProfileSubsystem.h"
#include "Progression/HWSaveGame.h"
#include "UI/HWFrontendRootWidget.h"
#include "UI/HWUICatalog.h"

using namespace HWUI;

namespace
{
    // Same header grammar for drawer and modal: title left, close top-right.
    UWidget* OverlayHeader(UWidgetTree* Tree, const FText& Title, const FText& Sub, UWidget* Close)
    {
        UHorizontalBox* Row = HBox(Tree);
        UVerticalBox* Names = VBox(Tree);
        AddV(Names, Text(Tree, Title, EHWUITextToken::PageTitle, EHWUIColorToken::TextPrimary, EHWUIWeight::Bold));
        if (!Sub.IsEmpty())
        {
            AddV(Names, Text(Tree, Sub, EHWUITextToken::Caption, EHWUIColorToken::TextSecondary), FMargin(0.f, 6.f, 0.f, 0.f));
        }
        AddH(Row, Names, FMargin(0), true);
        AddH(Row, Close)->SetVerticalAlignment(VAlign_Top);
        return Row;
    }

    FText RunStateText(EHWQuestRunState State)
    {
        switch (State)
        {
            case EHWQuestRunState::Idle: return NSLOCTEXT("HWUI", "RunIdle", "대기");
            case EHWQuestRunState::Prepared: return NSLOCTEXT("HWUI", "RunPrepared", "출격 준비");
            case EHWQuestRunState::Traveling: return NSLOCTEXT("HWUI", "RunTravel", "이동 중");
            case EHWQuestRunState::InCombat: return NSLOCTEXT("HWUI", "RunCombat", "전투 중");
            case EHWQuestRunState::VictoryPendingSave: return NSLOCTEXT("HWUI", "RunSaving", "승리 · 저장 대기");
            case EHWQuestRunState::Victory: return NSLOCTEXT("HWUI", "RunVictory", "승리 · 저장됨");
            case EHWQuestRunState::Defeat: return NSLOCTEXT("HWUI", "RunDefeat", "패배");
            default: return NSLOCTEXT("HWUI", "RunAborted", "중단");
        }
    }
}

// ---------------------------------------------------------------- Recruit (right drawer)

void UHWRecruitDrawer::Build(UCanvasPanel* Root)
{
    const FHWUICatalog& Catalog = FHWUICatalog::Get();
    UHWFrontendRootWidget* F = GetFrontend();

    UVerticalBox* Body = VBox(WidgetTree);
    UWidget* Close = TapGhost(Text(WidgetTree, NSLOCTEXT("HWUI", "Close", "닫기"), EHWUITextToken::Body, EHWUIColorToken::TextSecondary),
        [F]() { if (F) { F->CloseOverlay(); } }, FMargin(14.f, 8.f));
    AddV(Body, OverlayHeader(WidgetTree, NSLOCTEXT("HWUI", "RecruitTitle", "파티 모집"),
        NSLOCTEXT("HWUI", "RecruitSub", "로비를 유지한 채 편성을 본다 · Back 으로 닫기"), Close));
    AddV(Body, Rule(WidgetTree), FMargin(0.f, 20.f));

    UScrollBox* Rows = WidgetTree->ConstructWidget<UScrollBox>();
    const FName Active = F ? F->SelectedCharacter : FName(TEXT("ain"));
    for (const FHWUICharacter& Ch : Catalog.Characters)
    {
        UHorizontalBox* Row = HBox(WidgetTree);
        AddH(Row, Sized(WidgetTree, Fit(WidgetTree, Art(TEXT("portrait-") + Ch.Id.ToString()), true), 76.f, 76.f), FMargin(0.f, 0.f, 20.f, 0.f))
            ->SetVerticalAlignment(VAlign_Center);
        UVerticalBox* Names = VBox(WidgetTree);
        AddV(Names, Text(WidgetTree, FText::FromString(Ch.Name), EHWUITextToken::SectionTitle, EHWUIColorToken::TextPrimary, EHWUIWeight::Bold));
        AddV(Names, Text(WidgetTree, FText::FromString(FString::Printf(TEXT("%s · %s"), *Ch.Class, *Ch.Role)), EHWUITextToken::Caption,
            EHWUIColorToken::TextSecondary), FMargin(0.f, 4.f, 0.f, 0.f));
        AddH(Row, Names, FMargin(0), true)->SetVerticalAlignment(VAlign_Center);
        UVerticalBox* Nums = VBox(WidgetTree);
        AddV(Nums, Text(WidgetTree, FText::FromString(FString::Printf(TEXT("Lv %d"), Ch.Level)), EHWUITextToken::Body, EHWUIColorToken::TextPrimary,
            EHWUIWeight::Medium))->SetHorizontalAlignment(HAlign_Right);
        AddV(Nums, Text(WidgetTree, FText::Format(NSLOCTEXT("HWUI", "CpN", "전투력 {0}"), FText::AsNumber(Ch.CombatPower)), EHWUITextToken::Caption,
            EHWUIColorToken::TextSecondary))->SetHorizontalAlignment(HAlign_Right);
        AddH(Row, Nums)->SetVerticalAlignment(VAlign_Center);
        const FName Id = Ch.Id;
        Rows->AddChild(Sized(WidgetTree, SelectableCard(Row, Ch.Id == Active, [this, F, Id]()
        {
            if (F) { F->SelectedCharacter = Id; }
            RequestRefresh();
        }, FMargin(20.f, 14.f)), 0.f, 108.f));
        Rows->AddChild(Gap(WidgetTree, 1.f, M(EHWUIMetricToken::CardGap)));
    }
    AddV(Body, Rows, FMargin(0), true);
    AddV(Body, NoSystemNote(NSLOCTEXT("HWUI", "PartySys", "파티 모집·편성 (전투는 아인 1 인)")), FMargin(0.f, 12.f));
    AddV(Body, PrimaryAction(NSLOCTEXT("HWUI", "Recruit", "모집 시작"), FText::GetEmpty(), false, []() {}, 0.f, 76.f));

    Stretch(Root, Body, FMargin(36.f, M(EHWUIMetricToken::SafeTop) + 28.f, 36.f, M(EHWUIMetricToken::SafeBottom) + 24.f));
}

// ---------------------------------------------------------------- Result (large modal)

void UHWResultModal::Build(UCanvasPanel* Root)
{
    UHWFrontendRootWidget* F = GetFrontend();
    UHWQuestRunSubsystem* Runs = RunSystem();
    UHWProfileSubsystem* Profile = ProfileSystem();
    UHWGameContentSubsystem* Content = ContentSystem();
    const bool bProfile = Profile && Profile->IsProfileAvailable();

    // Which quest: the run ticket after combat, otherwise the lobby selection (preview).
    FName QuestId = F ? F->SelectedQuest : NAME_None;
    if (bFromCombat && Runs && !Runs->GetRunTicket().QuestId.IsNone())
    {
        QuestId = Runs->GetRunTicket().QuestId;
    }
    FHWQuestDefinition Quest;
    const bool bQuest = Content && Content->IsContentLoaded() && !QuestId.IsNone() && Content->GetQuest(QuestId, Quest);

    UHorizontalBox* Split = HBox(WidgetTree);

    // Left sub-tabs.
    UVerticalBox* Tabs = VBox(WidgetTree);
    const FText TabNames[] = { NSLOCTEXT("HWUI", "Summary", "요약"), NSLOCTEXT("HWUI", "Rewards", "보상"), NSLOCTEXT("HWUI", "Record", "기록") };
    for (int32 Index = 0; Index < UE_ARRAY_COUNT(TabNames); ++Index)
    {
        Tabs->AddChildToVerticalBox(SelectableCard(Text(WidgetTree, TabNames[Index], EHWUITextToken::Body, EHWUIColorToken::TextPrimary,
            Index == Tab ? EHWUIWeight::Bold : EHWUIWeight::Regular), Index == Tab, [this, Index]() { Tab = Index; RequestRefresh(); }, FMargin(20.f, 16.f)))
            ->SetPadding(FMargin(0.f, 0.f, 0.f, M(EHWUIMetricToken::CardGap)));
    }
    UBorder* TabPanel = Panel(WidgetTree, Box(FLinearColor::Transparent)   /* nesting: modal frame > card, no third layer */, FMargin(24.f, 32.f));
    TabPanel->SetContent(Tabs);
    AddH(Split, Sized(WidgetTree, TabPanel, 290.f, 0.f));

    // Right content.
    UVerticalBox* Body = VBox(WidgetTree);
    const FText Outcome = !bFromCombat ? NSLOCTEXT("HWUI", "Preview", "결과 미리보기")
        : bVictory ? NSLOCTEXT("HWUI", "Victory", "승리") : NSLOCTEXT("HWUI", "Defeat", "패배");
    UWidget* Close = TapGhost(Text(WidgetTree, NSLOCTEXT("HWUI", "Close", "닫기"), EHWUITextToken::Body, EHWUIColorToken::TextSecondary),
        [F]() { if (F) { F->CloseOverlay(); } }, FMargin(14.f, 8.f));
    UTextBlock* Big = Text(WidgetTree, Outcome, EHWUITextToken::Hero, bFromCombat && !bVictory ? EHWUIColorToken::TextSecondary : EHWUIColorToken::TextPrimary, EHWUIWeight::Bold);
    Big->SetFont(FontSized(56.f, EHWUIWeight::Bold));
    UHorizontalBox* Head = HBox(WidgetTree);
    AddH(Head, Big, FMargin(0), true);
    if (F)
    {
        AddH(Head, Close)->SetVerticalAlignment(VAlign_Top);
    }
    AddV(Body, Head);
    AddV(Body, Text(WidgetTree, bQuest ? Quest.DisplayName : NSLOCTEXT("HWUI", "TrainingRun", "훈련 · 기록 없음"), EHWUITextToken::SectionTitle,
        EHWUIColorToken::TextSecondary, EHWUIWeight::Medium), FMargin(0.f, 6.f, 0.f, 0.f));
    AddV(Body, Rule(WidgetTree), FMargin(0.f, 18.f));

    UVerticalBox* Page = VBox(WidgetTree);
    if (Tab == 0)
    {
        AddV(Page, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "RunState", "진행 상태"), Runs ? RunStateText(Runs->GetRunState()) : FText::FromString(TEXT("—"))), FMargin(0.f, 4.f));
        if (bQuest)
        {
            AddV(Page, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "RecLv", "권장 레벨"), FText::AsNumber(Quest.RecommendedLevel)), FMargin(0.f, 4.f));
            AddV(Page, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "Clears", "클리어"), FText::Format(NSLOCTEXT("HWUI", "ClearN", "{0}회"),
                bProfile ? Profile->GetClearCount(Quest.ArenaId) : 0)), FMargin(0.f, 4.f));
        }
        AddV(Page, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "Save", "저장"),
            !bProfile ? NSLOCTEXT("HWUI", "NoProfile", "프로필 없음")
            : Profile->HasPendingSave() ? NSLOCTEXT("HWUI", "SavePending", "저장 대기 — 다시 시도 필요")
            : NSLOCTEXT("HWUI", "Saved", "저장됨")), FMargin(0.f, 4.f));
        if (Runs && !Runs->GetLastError().IsEmpty())
        {
            AddV(Page, TextWrap(WidgetTree, FText::FromString(Runs->GetLastError()), EHWUITextToken::Caption, EHWUIColorToken::Danger), FMargin(0.f, 8.f));
        }
    }
    else if (Tab == 1)
    {
        if (bQuest)
        {
            for (const FHWQuestClaimReward& Reward : Quest.ClaimRewards)
            {
                FString Name = Reward.Kind == EHWClaimRewardKind::Currency ? TEXT("골드")
                    : Reward.Kind == EHWClaimRewardKind::Experience ? TEXT("경험치") : FHWUICatalog::Get().ItemName(Reward.Id);
                const FString Amount = Reward.Min == Reward.Max ? FText::AsNumber(Reward.Min).ToString()
                    : FString::Printf(TEXT("%s~%s"), *FText::AsNumber(Reward.Min).ToString(), *FText::AsNumber(Reward.Max).ToString());
                AddV(Page, KeyValue(WidgetTree, FText::FromString(Name), FText::FromString(Amount)), FMargin(0.f, 4.f));
            }
            const EHWQuestState State = bProfile ? Profile->GetQuestState(Quest.Id) : EHWQuestState::Unavailable;
            AddV(Page, Text(WidgetTree, State == EHWQuestState::Claimed ? NSLOCTEXT("HWUI", "Claimed", "수령 완료")
                : State == EHWQuestState::Cleared ? NSLOCTEXT("HWUI", "Claimable", "수령 가능 — 로비의 의뢰에서 받는다")
                : NSLOCTEXT("HWUI", "NotClaimable", "클리어 전에는 받을 수 없다"), EHWUITextToken::Caption, EHWUIColorToken::TextSecondary), FMargin(0.f, 14.f, 0.f, 0.f));
        }
        else
        {
            AddV(Page, Text(WidgetTree, NSLOCTEXT("HWUI", "NoReward", "훈련은 보상이 없다"), EHWUITextToken::Body, EHWUIColorToken::TextSecondary));
        }
    }
    else
    {
        if (Content && Content->IsContentLoaded())
        {
            for (const FHWQuestDefinition& Q : Content->GetQuests())
            {
                AddV(Page, KeyValue(WidgetTree, Q.DisplayName, FText::Format(NSLOCTEXT("HWUI", "ClearN", "{0}회"),
                    bProfile ? Profile->GetClearCount(Q.ArenaId) : 0), EHWUIColorToken::TextSecondary), FMargin(0.f, 4.f));
            }
        }
    }
    AddV(Body, Page, FMargin(0), true);

    // Two buttons at most.
    UHWQuestRunSubsystem* RunsPtr = Runs;
    const bool bCombat = bFromCombat;
    UHorizontalBox* Actions = HBox(WidgetTree);
    AddH(Actions, Gap(WidgetTree, 1.f, 1.f), FMargin(0), true);
    AddH(Actions, SecondaryAction(NSLOCTEXT("HWUI", "Again", "다시"), [this, F, QuestId, bQuest, bCombat]()
    {
        if (F) { F->CloseOverlay(); F->Sortie(bQuest ? QuestId : NAME_None); }
        else if (bCombat) { UGameplayStatics::OpenLevel(this, FName(*UGameplayStatics::GetCurrentLevelName(this))); }
    }), FMargin(0.f, 0.f, M(EHWUIMetricToken::CardGap), 0.f))->SetVerticalAlignment(VAlign_Center);
    AddH(Actions, PrimaryAction(NSLOCTEXT("HWUI", "ToLobby", "로비로"), FText::GetEmpty(), true, [this, F, RunsPtr]()
    {
        if (F) { F->CloseOverlay(); F->ShowScreen(EHWFrontendScreen::Lobby); return; }
        if (RunsPtr) { RunsPtr->ResetRun(); }
        UGameplayStatics::OpenLevel(this, TEXT("HW_Frontend"));
    }, 240.f, 76.f));
    AddV(Body, Actions, FMargin(0.f, 16.f, 0.f, 0.f));

    UBorder* BodyPanel = Panel(WidgetTree, Box(FLinearColor::Transparent), FMargin(40.f, 32.f));
    BodyPanel->SetContent(Body);
    AddH(Split, BodyPanel, FMargin(0), true);
    Stretch(Root, Split);
}

// ---------------------------------------------------------------- Story (large modal)

void UHWStoryModal::Build(UCanvasPanel* Root)
{
    const FHWUICatalog& Catalog = FHWUICatalog::Get();
    UHWFrontendRootWidget* F = GetFrontend();
    const int32 Chapter = F ? FMath::Clamp(F->SelectedChapter, 0, FMath::Max(0, Catalog.Chapters.Num() - 1)) : 0;

    UHorizontalBox* Split = HBox(WidgetTree);
    UScrollBox* Chapters = WidgetTree->ConstructWidget<UScrollBox>();
    for (int32 Index = 0; Index < Catalog.Chapters.Num(); ++Index)
    {
        const FHWUIChapter& Ch = Catalog.Chapters[Index];
        UVerticalBox* Names = VBox(WidgetTree);
        AddV(Names, Text(WidgetTree, FText::FromString(Ch.Name), EHWUITextToken::Body, EHWUIColorToken::TextPrimary,
            Index == Chapter ? EHWUIWeight::Bold : EHWUIWeight::Regular));
        AddV(Names, Text(WidgetTree, FText::FromString(Ch.Title), EHWUITextToken::Caption, EHWUIColorToken::TextSecondary), FMargin(0.f, 2.f, 0.f, 0.f));
        Chapters->AddChild(SelectableCard(Names, Index == Chapter, [this, F, Index]() { if (F) { F->SelectedChapter = Index; } RequestRefresh(); }, FMargin(18.f, 12.f)));
        Chapters->AddChild(Gap(WidgetTree, 1.f, 8.f));
    }
    UBorder* ChapterPanel = Panel(WidgetTree, Box(FLinearColor::Transparent)   /* nesting: modal frame > card, no third layer */, FMargin(20.f, 28.f));
    ChapterPanel->SetContent(Chapters);
    AddH(Split, Sized(WidgetTree, ChapterPanel, 300.f, 0.f));

    UVerticalBox* Body = VBox(WidgetTree);
    UWidget* Close = TapGhost(Text(WidgetTree, NSLOCTEXT("HWUI", "Close", "닫기"), EHWUITextToken::Body, EHWUIColorToken::TextSecondary),
        [F]() { if (F) { F->CloseOverlay(); } }, FMargin(14.f, 8.f));
    if (Catalog.Chapters.IsValidIndex(Chapter))
    {
        const FHWUIChapter& Ch = Catalog.Chapters[Chapter];
        AddV(Body, OverlayHeader(WidgetTree, FText::FromString(FString::Printf(TEXT("%s · %s"), *Ch.Name, *Ch.Title)),
            NSLOCTEXT("HWUI", "StorySub", "기록"), Close));
        AddV(Body, Rule(WidgetTree), FMargin(0.f, 16.f));
        UScrollBox* Lines = WidgetTree->ConstructWidget<UScrollBox>();
        for (const FHWUIStoryLine& Line : Ch.Lines)
        {
            const FHWUINpc* Npc = Catalog.Npcs.Find(Line.Speaker);
            UHorizontalBox* Row = HBox(WidgetTree);
            UWidget* Face = Npc && !Npc->Face.IsEmpty() && Npc->Face.StartsWith(TEXT("face-"))
                ? Fit(WidgetTree, Art(Npc->Face), true) : Gap(WidgetTree, 1.f, 1.f);
            AddH(Row, Sized(WidgetTree, Face, 52.f, 52.f), FMargin(0.f, 0.f, 18.f, 0.f))->SetVerticalAlignment(VAlign_Top);
            UVerticalBox* Speech = VBox(WidgetTree);
            if (Npc && !Npc->Name.IsEmpty())
            {
                AddV(Speech, Text(WidgetTree, FText::FromString(Npc->Name), EHWUITextToken::Caption, EHWUIColorToken::TextSecondary, EHWUIWeight::Medium));
            }
            AddV(Speech, TextWrap(WidgetTree, FText::FromString(Line.Text), EHWUITextToken::Body,
                Npc && !Npc->Name.IsEmpty() ? EHWUIColorToken::TextPrimary : EHWUIColorToken::TextSecondary), FMargin(0.f, 2.f, 0.f, 0.f));
            AddH(Row, Speech, FMargin(0), true);
            Lines->AddChild(Row);
            Lines->AddChild(Gap(WidgetTree, 1.f, 16.f));
        }
        AddV(Body, Lines, FMargin(0), true);
    }
    UBorder* BodyPanel = Panel(WidgetTree, Box(FLinearColor::Transparent), FMargin(40.f, 32.f));
    BodyPanel->SetContent(Body);
    AddH(Split, BodyPanel, FMargin(0), true);
    Stretch(Root, Split);
}
