#include "UI/HWFrontendScreens.h"

#include "Blueprint/WidgetTree.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/Image.h"
#include "Components/ScrollBox.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"
#include "Content/HWGameContentSubsystem.h"
#include "Graphics/HWGraphicsQualitySubsystem.h"
#include "Progression/HWProfileSubsystem.h"
#include "Progression/HWSaveGame.h"
#include "UI/HWFrontendRootWidget.h"
#include "UI/HWUICatalog.h"

using namespace HWUI;

namespace HWScreens
{
    FText QuestStateText(EHWQuestState State)
    {
        switch (State)
        {
            case EHWQuestState::Available: return NSLOCTEXT("HWUI", "QAvail", "진행 가능");
            case EHWQuestState::Cleared: return NSLOCTEXT("HWUI", "QClear", "완료 · 보상 대기");
            case EHWQuestState::Claimed: return NSLOCTEXT("HWUI", "QClaimed", "보상 수령");
            case EHWQuestState::Locked: return NSLOCTEXT("HWUI", "QLocked", "잠김");
            default: return NSLOCTEXT("HWUI", "QNone", "정보 없음");
        }
    }

    FText RewardText(const FHWQuestClaimReward& Reward)
    {
        FString Name;
        switch (Reward.Kind)
        {
            case EHWClaimRewardKind::Currency: Name = TEXT("골드"); break;
            case EHWClaimRewardKind::Experience: Name = TEXT("경험치"); break;
            default: Name = FHWUICatalog::Get().ItemName(Reward.Id); break;
        }
        const FString Amount = Reward.Min == Reward.Max
            ? FText::AsNumber(Reward.Min).ToString()
            : FString::Printf(TEXT("%s~%s"), *FText::AsNumber(Reward.Min).ToString(), *FText::AsNumber(Reward.Max).ToString());
        return FText::FromString(FString::Printf(TEXT("%s  %s"), *Name, *Amount));
    }

    // Character switcher used by Character / Skills / Looks.
    UWidget* CharacterTabs(UHWScreenWidget* Owner, UWidgetTree* Tree, FName Selected, TFunction<void(FName)> OnPick,
        TFunction<UButton*(UWidget*, TFunction<void()>)> Ghost)
    {
        UHorizontalBox* Row = HBox(Tree);
        for (const FHWUICharacter& Ch : FHWUICatalog::Get().Characters)
        {
            const bool bSel = Ch.Id == Selected;
            UVerticalBox* Stack = VBox(Tree);
            AddV(Stack, Text(Tree, FText::FromString(Ch.Name), EHWUITextToken::Body,
                bSel ? EHWUIColorToken::Gold : EHWUIColorToken::TextSecondary, bSel ? EHWUIWeight::Bold : EHWUIWeight::Regular))
                ->SetHorizontalAlignment(HAlign_Center);
            AddV(Stack, Sized(Tree, Fill(Tree, bSel ? C(EHWUIColorToken::Gold) : FLinearColor::Transparent), 28.f,
                M(EHWUIMetricToken::SelectionBar)), FMargin(0.f, 8.f, 0.f, 0.f))->SetHorizontalAlignment(HAlign_Center);
            const FName Id = Ch.Id;
            AddH(Row, Sized(Tree, Ghost(Stack, [OnPick, Id]() { OnPick(Id); }), 108.f, 0.f), FMargin(0.f, 0.f, 4.f, 0.f));
        }
        return Row;
    }
}

using namespace HWScreens;

// ---------------------------------------------------------------- Title

void UHWTitleScreen::Build(UCanvasPanel* Root)
{
    Stretch(Root, TapGhost(Gap(WidgetTree, 1.f, 1.f), [this]()
    {
        if (UHWFrontendRootWidget* F = GetFrontend()) { F->ShowScreen(EHWFrontendScreen::Lobby); }
    }));

    UImage* Low = Fill(WidgetTree, C(EHWUIColorToken::BackgroundDeep, 0.6f));
    Low->SetVisibility(ESlateVisibility::HitTestInvisible);
    Place(Root, Low, FAnchors(0.f, 0.66f, 1.f, 1.f), FMargin(0));

    UVerticalBox* Logo = VBox(WidgetTree);
    Logo->SetVisibility(ESlateVisibility::HitTestInvisible);
    UTextBlock* Name = Text(WidgetTree, NSLOCTEXT("HWUI", "Logo", "황혼"), EHWUITextToken::Hero, EHWUIColorToken::TextPrimary, EHWUIWeight::Bold);
    Name->SetFont(FontSized(96.f, EHWUIWeight::Bold));
    AddV(Logo, Name);
    AddV(Logo, Text(WidgetTree, FText::FromString(TEXT("T W I L I G H T")), EHWUITextToken::Body, EHWUIColorToken::TextSecondary),
        FMargin(6.f, 0.f, 0.f, 0.f));
    Place(Root, Logo, FAnchors(0.f, 1.f), FMargin(SafeX() * 1.5f, -150.f, 0.f, 0.f), FVector2D(0.f, 1.f), true);

    UTextBlock* Prompt = Text(WidgetTree, NSLOCTEXT("HWUI", "TapStart", "화면을 눌러 시작"), EHWUITextToken::Body, EHWUIColorToken::TextSecondary);
    Prompt->SetVisibility(ESlateVisibility::HitTestInvisible);
    Place(Root, Prompt, FAnchors(0.5f, 1.f), FMargin(0.f, -64.f, 0.f, 0.f), FVector2D(0.5f, 1.f), true);

    UTextBlock* BuildTag = Text(WidgetTree, NSLOCTEXT("HWUI", "VS", "Vertical Slice · Clean UI v1"), EHWUITextToken::Micro, EHWUIColorToken::TextMuted);
    BuildTag->SetVisibility(ESlateVisibility::HitTestInvisible);
    Place(Root, BuildTag, FAnchors(1.f, 1.f), FMargin(-SafeX(), -M(EHWUIMetricToken::SafeBottom), 0.f, 0.f), FVector2D(1.f, 1.f), true);
}

// ---------------------------------------------------------------- Lobby

void UHWLobbyScreen::Build(UCanvasPanel* Root)
{
    const FHWUICatalog& Catalog = FHWUICatalog::Get();
    UHWFrontendRootWidget* F = GetFrontend();
    UHWGameContentSubsystem* Content = ContentSystem();
    UHWProfileSubsystem* Profile = ProfileSystem();

    // Hero first: the character owns the centre-right (spec §6 Lobby).
    UWidget* Hero = Sized(WidgetTree, Fit(WidgetTree, Art(TEXT("full-ain")), false), 400.f, 900.f);
    Hero->SetVisibility(ESlateVisibility::HitTestInvisible);
    MarkArt(Hero);
    Place(Root, Hero, FAnchors(0.6f, 1.f), FMargin(0.f, -(M(EHWUIMetricToken::SafeBottom) + M(EHWUIMetricToken::BottomNavHeight)), 400.f, 900.f),
        FVector2D(0.5f, 1.f));

    // Recommended quest = first one the profile can run.
    FHWQuestDefinition Next;
    bool bHasNext = false;
    bool bNextRunnable = false;
    if (Content && Content->IsContentLoaded())
    {
        for (const FHWQuestDefinition& Q : Content->GetQuests())
        {
            if (!bHasNext) { Next = Q; bHasNext = true; }
            if (Profile && Profile->IsProfileAvailable() && Profile->GetQuestState(Q.Id) == EHWQuestState::Available)
            {
                Next = Q;
                bNextRunnable = true;
                break;
            }
        }
    }

    // Left feature rail: 3 cards, generous gaps, no centre cards.
    UVerticalBox* Rail = VBox(WidgetTree);
    auto Card = [this](UWidget* Body, TFunction<void()> OnTap)
    {
        return Tap(Body, MoveTemp(OnTap), Box(C(EHWUIColorToken::Panel), 4.f),
            Box(C(EHWUIColorToken::Panel), 4.f, C(EHWUIColorToken::Line), 1.f),
            Box(C(EHWUIColorToken::PanelStrong), 4.f, C(EHWUIColorToken::Line), 1.f),
            FMargin(M(EHWUIMetricToken::PanelPadding)));
    };

    {
        UVerticalBox* Body = VBox(WidgetTree);
        AddV(Body, Text(WidgetTree, NSLOCTEXT("HWUI", "RecQuest", "추천 의뢰"), EHWUITextToken::Caption, EHWUIColorToken::TextMuted));
        AddV(Body, Text(WidgetTree, bHasNext ? Next.DisplayName : NSLOCTEXT("HWUI", "NoQuest", "의뢰 없음"), EHWUITextToken::SectionTitle,
            EHWUIColorToken::TextPrimary, EHWUIWeight::Bold), FMargin(0.f, 6.f, 0.f, 0.f));
        if (bHasNext)
        {
            const FHWUIQuestText* QText = Catalog.QuestText.Find(Next.Id);
            AddV(Body, Text(WidgetTree, FText::FromString(FString::Printf(TEXT("%s · 권장 Lv %d · 전투력 %s"),
                QText ? *QText->Area : TEXT(""), Next.RecommendedLevel, *FText::AsNumber(Next.RecommendedCombatPower).ToString())),
                EHWUITextToken::Caption, EHWUIColorToken::TextSecondary), FMargin(0.f, 4.f, 0.f, 0.f));
            if (Profile && Profile->IsProfileAvailable())
            {
                AddV(Body, Tag(WidgetTree, QuestStateText(Profile->GetQuestState(Next.Id)),
                    bNextRunnable ? C(EHWUIColorToken::Cyan) : C(EHWUIColorToken::TextMuted)), FMargin(0.f, 12.f, 0.f, 0.f));
            }
        }
        const FName QuestId = bHasNext ? Next.Id : NAME_None;
        AddV(Rail, Card(Body, [F, QuestId]()
        {
            if (F) { F->SelectedQuest = QuestId; F->ShowScreen(EHWFrontendScreen::OfficeQuest); }
        }));
    }
    {
        UVerticalBox* Body = VBox(WidgetTree);
        const int32 ChapterIndex = F ? FMath::Clamp(F->SelectedChapter, 0, FMath::Max(0, Catalog.Chapters.Num() - 1)) : 0;
        AddV(Body, Text(WidgetTree, NSLOCTEXT("HWUI", "Story", "이야기"), EHWUITextToken::Caption, EHWUIColorToken::TextMuted));
        if (Catalog.Chapters.IsValidIndex(ChapterIndex))
        {
            const FHWUIChapter& Ch = Catalog.Chapters[ChapterIndex];
            AddV(Body, Text(WidgetTree, FText::FromString(FString::Printf(TEXT("%s · %s"), *Ch.Name, *Ch.Title)), EHWUITextToken::SectionTitle,
                EHWUIColorToken::TextPrimary, EHWUIWeight::Bold), FMargin(0.f, 6.f, 0.f, 0.f));
            if (Ch.Lines.Num() > 0)
            {
                UTextBlock* Line = TextWrap(WidgetTree, FText::FromString(Ch.Lines[0].Text), EHWUITextToken::Caption, EHWUIColorToken::TextSecondary);
                AddV(Body, Line, FMargin(0.f, 6.f, 0.f, 0.f));
            }
        }
        AddV(Rail, Card(Body, [F]() { if (F) { F->OpenOverlay(EHWFrontendOverlay::Story); } }), FMargin(0.f, M(EHWUIMetricToken::SectionGap), 0.f, 0.f));
    }
    {
        UVerticalBox* Body = VBox(WidgetTree);
        AddV(Body, Text(WidgetTree, NSLOCTEXT("HWUI", "Party", "파티"), EHWUITextToken::Caption, EHWUIColorToken::TextMuted));
        UHorizontalBox* Faces = HBox(WidgetTree);
        for (const FHWUICharacter& Ch : Catalog.Characters)
        {
            AddH(Faces, Sized(WidgetTree, Fit(WidgetTree, Art(TEXT("face-") + Ch.Id.ToString()), true), 56.f, 56.f), FMargin(0.f, 0.f, 10.f, 0.f));
        }
        AddV(Body, Faces, FMargin(0.f, 10.f, 0.f, 0.f));
        AddV(Body, Text(WidgetTree, NSLOCTEXT("HWUI", "PartyView", "파티 모집 · 편성 보기"), EHWUITextToken::Caption, EHWUIColorToken::TextSecondary),
            FMargin(0.f, 10.f, 0.f, 0.f));
        AddV(Rail, Card(Body, [F]() { if (F) { F->OpenOverlay(EHWFrontendOverlay::Recruit); } }), FMargin(0.f, M(EHWUIMetricToken::SectionGap), 0.f, 0.f));
    }
    Place(Root, Sized(WidgetTree, Rail, M(EHWUIMetricToken::LeftRailWidth), 0.f), FAnchors(0.f, 0.f),
        FMargin(SafeX(), ContentTop(), M(EHWUIMetricToken::LeftRailWidth), 0.f), FVector2D::ZeroVector, true);

    // Right slim rail: neutral marks, colour only for a notification dot.
    UVerticalBox* Slim = VBox(WidgetTree);
    struct FRailItem { const TCHAR* Label; TFunction<void()> Fn; bool bDot; };
    const TArray<FRailItem> Items = {
        { TEXT("모집"), [F]() { if (F) { F->OpenOverlay(EHWFrontendOverlay::Recruit); } }, false },
        { TEXT("기록"), [F]() { if (F) { F->OpenOverlay(EHWFrontendOverlay::Story); } }, Profile && Profile->HasPendingSave() },
        { TEXT("설정"), [F]() { if (F) { F->ShowScreen(EHWFrontendScreen::Profile); } }, false },
    };
    for (const FRailItem& Item : Items)
    {
        UVerticalBox* Stack = VBox(WidgetTree);
        // Neutral label; colour only for the notification dot (spec §5 Right Slim Rail).
        AddV(Stack, Sized(WidgetTree, Fill(WidgetTree, Item.bDot ? C(EHWUIColorToken::Danger) : FLinearColor::Transparent), 6.f, 6.f))
            ->SetHorizontalAlignment(HAlign_Center);
        AddV(Stack, Text(WidgetTree, FText::FromString(Item.Label), EHWUITextToken::Body, EHWUIColorToken::TextSecondary), FMargin(0.f, 6.f, 0.f, 0.f))
            ->SetHorizontalAlignment(HAlign_Center);
        AddV(Slim, Sized(WidgetTree, TapGhost(Stack, Item.Fn, FMargin(0.f, 14.f)), M(EHWUIMetricToken::SlimRailWidth), 0.f));
    }
    UBorder* SlimPanel = Panel(WidgetTree, Box(C(EHWUIColorToken::Panel, 0.55f), 4.f), FMargin(0.f, 6.f));
    SlimPanel->SetContent(Slim);
    Place(Root, SlimPanel, FAnchors(1.f, 0.5f), FMargin(-SafeX(), -60.f, 0.f, 0.f), FVector2D(1.f, 0.5f), true);

    // The one CTA.
    // With nothing runnable the sortie is the unrecorded training, and the caption says so.
    const FName QuestId = bNextRunnable ? Next.Id : NAME_None;
    UWidget* Cta = PrimaryAction(NSLOCTEXT("HWUI", "Sortie", "출격"),
        bNextRunnable ? Next.DisplayName : NSLOCTEXT("HWUI", "TrainingNoReward", "훈련장 · 보상 없음"), true,
        [F, QuestId]() { if (F) { F->Sortie(QuestId); } });
    Place(Root, Cta, FAnchors(1.f, 1.f), FMargin(-SafeX(), -ContentBottom(), 0.f, 0.f), FVector2D(1.f, 1.f), true);
}

// ---------------------------------------------------------------- Office / Quest

FText UHWOfficeQuestScreen::GetScreenTitle() const
{
    return NSLOCTEXT("HWUI", "OfficeTitle", "인력사무소 · 의뢰");
}

void UHWOfficeQuestScreen::Build(UCanvasPanel* Root)
{
    const FHWUICatalog& Catalog = FHWUICatalog::Get();
    UHWFrontendRootWidget* F = GetFrontend();
    UHWGameContentSubsystem* Content = ContentSystem();
    UHWProfileSubsystem* Profile = ProfileSystem();
    const bool bProfile = Profile && Profile->IsProfileAvailable();

    TArray<FHWQuestDefinition> Quests;
    if (Content && Content->IsContentLoaded())
    {
        Quests = Content->GetQuests();
    }
    if (F && (F->SelectedQuest.IsNone() || !Quests.ContainsByPredicate([F](const FHWQuestDefinition& Q) { return Q.Id == F->SelectedQuest; })))
    {
        F->SelectedQuest = Quests.Num() > 0 ? Quests[0].Id : NAME_None;
    }
    const FName SelectedId = F ? F->SelectedQuest : NAME_None;

    // Left: quest list, one third of the width.
    const float ListWidth = 760.f;
    UVerticalBox* List = VBox(WidgetTree);
    AddV(List, SectionTitle(NSLOCTEXT("HWUI", "QuestList", "의뢰 목록"), FText::Format(NSLOCTEXT("HWUI", "QuestCount", "{0}건"), Quests.Num())),
        FMargin(0.f, 0.f, 0.f, 14.f));
    if (!Content || !Content->IsContentLoaded())
    {
        AddV(List, TextWrap(WidgetTree, FText::FromString(Content ? Content->GetLoadError() : TEXT("콘텐츠 서브시스템 없음")), EHWUITextToken::Body));
    }
    UScrollBox* Scroll = WidgetTree->ConstructWidget<UScrollBox>();
    for (const FHWQuestDefinition& Q : Quests)
    {
        const bool bSel = Q.Id == SelectedId;
        const EHWQuestState State = bProfile ? Profile->GetQuestState(Q.Id) : EHWQuestState::Unavailable;
        const FHWUIQuestText* QText = Catalog.QuestText.Find(Q.Id);
        UVerticalBox* Body = VBox(WidgetTree);
        UHorizontalBox* Head = HBox(WidgetTree);
        AddH(Head, Text(WidgetTree, Q.DisplayName, EHWUITextToken::SectionTitle,
            State == EHWQuestState::Locked ? EHWUIColorToken::TextMuted : EHWUIColorToken::TextPrimary,
            bSel ? EHWUIWeight::Bold : EHWUIWeight::Medium), FMargin(0), true);
        AddH(Head, State == EHWQuestState::Available
            ? Tag(WidgetTree, QuestStateText(State), C(EHWUIColorToken::Cyan))
            : static_cast<UWidget*>(Text(WidgetTree, QuestStateText(State), EHWUITextToken::Caption, EHWUIColorToken::TextMuted)))
            ->SetVerticalAlignment(VAlign_Center);
        AddV(Body, Head);
        AddV(Body, Text(WidgetTree, FText::FromString(FString::Printf(TEXT("%s · 권장 Lv %d · 전투력 %s · 위험도 %s"),
            QText ? *QText->Area : TEXT("-"), Q.RecommendedLevel, *FText::AsNumber(Q.RecommendedCombatPower).ToString(),
            QText ? *QText->Risk : TEXT("-"))), EHWUITextToken::Caption, EHWUIColorToken::TextSecondary), FMargin(0.f, 6.f, 0.f, 0.f));
        const FName Id = Q.Id;
        Scroll->AddChild(Sized(WidgetTree, SelectableCard(Body, bSel, [this, F, Id]()
        {
            if (F) { F->SelectedQuest = Id; }
            RequestRefresh();
        }, FMargin(22.f, 18.f)), 0.f, 0.f));
        Scroll->AddChild(Gap(WidgetTree, 1.f, M(EHWUIMetricToken::CardGap)));
    }
    AddV(List, Scroll, FMargin(0), true);
    Place(Root, List, FAnchors(0.f, 0.f, 0.f, 1.f), FMargin(SafeX(), ContentTop(), ListWidth, ContentBottom()));

    // Right: selected quest detail in one panel.
    const FHWQuestDefinition* Sel = Quests.FindByPredicate([SelectedId](const FHWQuestDefinition& Q) { return Q.Id == SelectedId; });
    UVerticalBox* Detail = VBox(WidgetTree);
    if (Sel)
    {
        const FHWUIQuestText* QText = Catalog.QuestText.Find(Sel->Id);
        const EHWQuestState State = bProfile ? Profile->GetQuestState(Sel->Id) : EHWQuestState::Unavailable;
        UHorizontalBox* Head = HBox(WidgetTree);
        AddH(Head, Text(WidgetTree, Sel->DisplayName, EHWUITextToken::PageTitle, EHWUIColorToken::TextPrimary, EHWUIWeight::Bold), FMargin(0), true);
        AddH(Head, Text(WidgetTree, FText::FromString(QText ? FString::Printf(TEXT("위험도 %s"), *QText->Risk) : FString()),
            EHWUITextToken::Body, EHWUIColorToken::TextSecondary, EHWUIWeight::Medium))->SetVerticalAlignment(VAlign_Center);
        AddV(Detail, Head);
        if (QText)
        {
            AddV(Detail, Text(WidgetTree, FText::FromString(FString::Printf(TEXT("%s · %s"), *QText->Area, *QText->Goal)),
                EHWUITextToken::Caption, EHWUIColorToken::TextSecondary), FMargin(0.f, 6.f, 0.f, 0.f));
        }
        AddV(Detail, Rule(WidgetTree), FMargin(0.f, 18.f));

        // One column, right 30 %: the office art keeps the centre (spec §6 Quest).
        UScrollBox* Body = WidgetTree->ConstructWidget<UScrollBox>();
        UVerticalBox* Story = VBox(WidgetTree);
        if (QText)
        {
            AddV(Story, TextWrap(WidgetTree, FText::FromString(QText->Desc), EHWUITextToken::Body, EHWUIColorToken::TextSecondary));
            AddV(Story, SectionTitle(NSLOCTEXT("HWUI", "Objectives", "목표")), FMargin(0.f, M(EHWUIMetricToken::SectionGap), 0.f, 8.f));
            for (const FString& Must : QText->Must)
            {
                AddV(Story, Text(WidgetTree, FText::FromString(TEXT("•  ") + Must), EHWUITextToken::Body, EHWUIColorToken::TextPrimary), FMargin(0.f, 3.f));
            }
            for (const FString& Opt : QText->Optional)
            {
                AddV(Story, Text(WidgetTree, FText::FromString(TEXT("◦  ") + Opt + TEXT("  (선택)")), EHWUITextToken::Body, EHWUIColorToken::TextSecondary), FMargin(0.f, 3.f));
            }
        }
        Body->AddChild(Story);

        UVerticalBox* Facts = VBox(WidgetTree);
        AddV(Facts, SectionTitle(NSLOCTEXT("HWUI", "Rewards", "보상")), FMargin(0.f, M(EHWUIMetricToken::SectionGap), 0.f, 8.f));
        for (const FHWQuestClaimReward& Reward : Sel->ClaimRewards)
        {
            AddV(Facts, Text(WidgetTree, RewardText(Reward), EHWUITextToken::Body, EHWUIColorToken::TextPrimary), FMargin(0.f, 3.f));
        }
        AddV(Facts, SectionTitle(NSLOCTEXT("HWUI", "Recommend", "조건")), FMargin(0.f, M(EHWUIMetricToken::SectionGap), 0.f, 8.f));
        AddV(Facts, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "RecLv", "권장 레벨"), FText::AsNumber(Sel->RecommendedLevel)), FMargin(0.f, 3.f));
        AddV(Facts, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "RecCp", "권장 전투력"), FText::AsNumber(Sel->RecommendedCombatPower)), FMargin(0.f, 3.f));
        AddV(Facts, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "State", "상태"), QuestStateText(State)), FMargin(0.f, 3.f));
        AddV(Facts, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "Clears", "클리어"),
            FText::Format(NSLOCTEXT("HWUI", "ClearN", "{0}회"), bProfile ? Profile->GetClearCount(Sel->ArenaId) : 0)), FMargin(0.f, 3.f));
        Body->AddChild(Facts);
        AddV(Detail, Body, FMargin(0), true);

        UHorizontalBox* Actions = HBox(WidgetTree);
        AddH(Actions, SecondaryAction(NSLOCTEXT("HWUI", "TrainingNoReward", "훈련장 · 보상 없음"), [F]() { if (F) { F->Sortie(NAME_None); } }))
            ->SetVerticalAlignment(VAlign_Bottom);
        AddH(Actions, Gap(WidgetTree, 1.f, 1.f), FMargin(0), true);
        const bool bRunnable = State != EHWQuestState::Locked && State != EHWQuestState::Unavailable;
        const FName Id = Sel->Id;
        AddH(Actions, PrimaryAction(NSLOCTEXT("HWUI", "Sortie", "출격"), QuestStateText(State), bRunnable,
            [F, Id]() { if (F) { F->Sortie(Id); } }, 260.f, 96.f));
        AddV(Detail, Actions, FMargin(0.f, 18.f, 0.f, 0.f));
    }
    UBorder* DetailPanel = Panel(WidgetTree, Box(C(EHWUIColorToken::Panel), 4.f), FMargin(32.f, 28.f));
    DetailPanel->SetContent(Detail);
    Place(Root, DetailPanel, FAnchors(1.f, 0.f, 1.f, 1.f), FMargin(-SafeX(), ContentTop(), 720.f, ContentBottom()), FVector2D(1.f, 0.f));
}

// ---------------------------------------------------------------- Character

FText UHWCharacterScreen::GetScreenTitle() const
{
    return NSLOCTEXT("HWUI", "CharTitle", "캐릭터");
}

void UHWCharacterScreen::Build(UCanvasPanel* Root)
{
    const FHWUICatalog& Catalog = FHWUICatalog::Get();
    UHWFrontendRootWidget* F = GetFrontend();
    const FHWUICharacter* Ch = Catalog.FindCharacter(F ? F->SelectedCharacter : FName(TEXT("ain")));
    if (!Ch && Catalog.Characters.Num() > 0)
    {
        Ch = &Catalog.Characters[0];
    }
    if (!Ch)
    {
        Place(Root, Text(WidgetTree, FText::FromString(Catalog.GetError()), EHWUITextToken::Body), FAnchors(0.5f, 0.5f), FMargin(0), FVector2D(0.5f), true);
        return;
    }

    // Full body gets 55-65 % of the screen height and the centre.
    const float CarouselHeight = 96.f;
    UWidget* Hero = Sized(WidgetTree, Fit(WidgetTree, Art(TEXT("full-") + Ch->Id.ToString()), false), 420.f, 820.f);
    Hero->SetVisibility(ESlateVisibility::HitTestInvisible);
    MarkArt(Hero);
    Place(Root, Hero, FAnchors(0.5f, 1.f), FMargin(0.f, -(ContentBottom() + CarouselHeight), 420.f, 820.f), FVector2D(0.5f, 1.f));

    // Left edge: identity.
    UVerticalBox* Left = VBox(WidgetTree);
    AddV(Left, Text(WidgetTree, FText::FromString(Ch->Name), EHWUITextToken::Hero, EHWUIColorToken::TextPrimary, EHWUIWeight::Bold));
    AddV(Left, Text(WidgetTree, FText::FromString(Ch->Title), EHWUITextToken::Caption, EHWUIColorToken::TextMuted), FMargin(0.f, 4.f, 0.f, 0.f));
    AddV(Left, Text(WidgetTree, FText::FromString(FString::Printf(TEXT("%s · %s · %s"), *Ch->Class, *Ch->Role, *Ch->Weapon)),
        EHWUITextToken::Body, EHWUIColorToken::TextSecondary), FMargin(0.f, 14.f, 0.f, 0.f));
    UHorizontalBox* Numbers = HBox(WidgetTree);
    auto Number = [this](const FText& Label, const FText& Value)
    {
        UVerticalBox* Stack = VBox(WidgetTree);
        AddV(Stack, Text(WidgetTree, Label, EHWUITextToken::Caption, EHWUIColorToken::TextMuted));
        AddV(Stack, Text(WidgetTree, Value, EHWUITextToken::NumberLarge, EHWUIColorToken::TextPrimary, EHWUIWeight::Bold));
        return Stack;
    };
    AddH(Numbers, Number(NSLOCTEXT("HWUI", "Level", "레벨"), FText::AsNumber(Ch->Level)), FMargin(0.f, 0.f, 36.f, 0.f));
    AddH(Numbers, Number(NSLOCTEXT("HWUI", "Cp", "전투력"), FText::AsNumber(Ch->CombatPower)));
    AddV(Left, Numbers, FMargin(0.f, M(EHWUIMetricToken::SectionGap), 0.f, 0.f));
    AddV(Left, TextWrap(WidgetTree, FText::FromString(Ch->Quote), EHWUITextToken::Body, EHWUIColorToken::TextSecondary),
        FMargin(0.f, M(EHWUIMetricToken::SectionGap), 0.f, 0.f));
    Place(Root, Sized(WidgetTree, Left, 420.f, 0.f), FAnchors(0.f, 0.f), FMargin(SafeX(), ContentTop(), 420.f, 0.f), FVector2D::ZeroVector, true);

    // Right edge: stats and traits.
    UVerticalBox* Right = VBox(WidgetTree);
    AddV(Right, SectionTitle(NSLOCTEXT("HWUI", "Stats", "능력치")), FMargin(0.f, 0.f, 0.f, 8.f));
    for (const FHWUIStat& Stat : Ch->Stats)
    {
        AddV(Right, KeyValue(WidgetTree, FText::FromString(Stat.Key), FText::FromString(Stat.Value)), FMargin(0.f, 4.f));
    }
    AddV(Right, SectionTitle(NSLOCTEXT("HWUI", "Traits", "특성")), FMargin(0.f, M(EHWUIMetricToken::SectionGap), 0.f, 8.f));
    for (const FHWUIStat& Trait : Ch->Traits)
    {
        AddV(Right, Text(WidgetTree, FText::FromString(Trait.Key), EHWUITextToken::Body, EHWUIColorToken::TextPrimary, EHWUIWeight::Medium), FMargin(0.f, 6.f, 0.f, 0.f));
        AddV(Right, TextWrap(WidgetTree, FText::FromString(Trait.Value), EHWUITextToken::Caption, EHWUIColorToken::TextSecondary), FMargin(0.f, 2.f, 0.f, 0.f));
    }
    UBorder* RightPanel = Panel(WidgetTree, Box(C(EHWUIColorToken::Panel, 0.8f), 4.f), FMargin(M(EHWUIMetricToken::PanelPadding)));
    RightPanel->SetContent(Right);
    Place(Root, Sized(WidgetTree, RightPanel, 440.f, 0.f), FAnchors(1.f, 0.f), FMargin(-SafeX(), ContentTop(), 440.f, 0.f), FVector2D(1.f, 0.f), true);

    // Bottom carousel.
    UHorizontalBox* Carousel = HBox(WidgetTree);
    for (const FHWUICharacter& Other : Catalog.Characters)
    {
        UHorizontalBox* Body = HBox(WidgetTree);
        AddH(Body, Sized(WidgetTree, Fit(WidgetTree, Art(TEXT("face-") + Other.Id.ToString()), true), 56.f, 56.f), FMargin(0.f, 0.f, 12.f, 0.f));
        UVerticalBox* Names = VBox(WidgetTree);
        AddV(Names, Text(WidgetTree, FText::FromString(Other.Name), EHWUITextToken::Body, EHWUIColorToken::TextPrimary, EHWUIWeight::Medium));
        AddV(Names, Text(WidgetTree, FText::FromString(Other.Class), EHWUITextToken::Caption, EHWUIColorToken::TextSecondary));
        AddH(Body, Names)->SetVerticalAlignment(VAlign_Center);
        const FName Id = Other.Id;
        AddH(Carousel, Sized(WidgetTree, SelectableCard(Body, Other.Id == Ch->Id, [this, F, Id]()
        {
            if (F) { F->SelectCharacter(Id); }
            RequestRefresh();
        }, FMargin(14.f, 10.f)), 240.f, 0.f), FMargin(0.f, 0.f, M(EHWUIMetricToken::CardGap), 0.f));
    }
    Place(Root, Carousel, FAnchors(0.5f, 1.f), FMargin(0.f, -ContentBottom(), 0.f, 0.f), FVector2D(0.5f, 1.f), true);
}

// ---------------------------------------------------------------- Skills

FText UHWSkillsScreen::GetScreenTitle() const
{
    return NSLOCTEXT("HWUI", "SkillsTitle", "스킬");
}

void UHWSkillsScreen::Build(UCanvasPanel* Root)
{
    const FHWUICatalog& Catalog = FHWUICatalog::Get();
    UHWFrontendRootWidget* F = GetFrontend();
    const FName CharId = F ? F->SelectedCharacter : FName(TEXT("ain"));

    TArray<FHWUISkill> Skills;
    if (const TArray<FHWUISkill>* Base = Catalog.Skills.Find(CharId)) { Skills.Append(*Base); }
    if (const TArray<FHWUISkill>* Ult = Catalog.Skills.Find(FName(*(CharId.ToString() + TEXT("Ult"))))) { Skills.Append(*Ult); }
    Selected = Skills.IsValidIndex(Selected) ? Selected : 0;

    UWidget* Hero = Sized(WidgetTree, Fit(WidgetTree, Art(TEXT("full-") + CharId.ToString()), false, nullptr, FLinearColor(1.f, 1.f, 1.f, 0.42f)), 380.f, 820.f);
    Hero->SetVisibility(ESlateVisibility::HitTestInvisible);
    MarkArt(Hero);
    Place(Root, Hero, FAnchors(0.62f, 1.f), FMargin(0.f, -ContentBottom(), 380.f, 820.f), FVector2D(0.5f, 1.f));

    const float ListWidth = 1180.f;
    UVerticalBox* List = VBox(WidgetTree);
    AddV(List, CharacterTabs(this, WidgetTree, CharId, [this, F](FName Id) { if (F) { F->SelectCharacter(Id); } Selected = 0; RequestRefresh(); },
        [this](UWidget* W, TFunction<void()> Fn) { return TapGhost(W, MoveTemp(Fn), FMargin(0.f, 8.f)); }), FMargin(0.f, 0.f, 0.f, 16.f));
    UScrollBox* Scroll = WidgetTree->ConstructWidget<UScrollBox>();
    for (int32 Index = 0; Index < Skills.Num(); ++Index)
    {
        const FHWUISkill& Sk = Skills[Index];
        UHorizontalBox* Row = HBox(WidgetTree);
        UBorder* Key = Panel(WidgetTree, Box(FLinearColor::Transparent, 4.f, C(EHWUIColorToken::Line), 1.f), FMargin(0));
        UTextBlock* KeyText = Text(WidgetTree, FText::FromString(Sk.Key.IsEmpty() ? TEXT("궁") : Sk.Key), EHWUITextToken::Body, EHWUIColorToken::TextSecondary, EHWUIWeight::Bold);
        KeyText->SetJustification(ETextJustify::Center);
        Key->SetContent(KeyText);
        Key->SetHorizontalAlignment(HAlign_Center);
        Key->SetVerticalAlignment(VAlign_Center);
        AddH(Row, Sized(WidgetTree, Key, 44.f, 44.f), FMargin(0.f, 0.f, 18.f, 0.f))->SetVerticalAlignment(VAlign_Center);
        UVerticalBox* Names = VBox(WidgetTree);
        AddV(Names, Text(WidgetTree, FText::FromString(Sk.Name), EHWUITextToken::SectionTitle, EHWUIColorToken::TextPrimary,
            Index == Selected ? EHWUIWeight::Bold : EHWUIWeight::Medium));
        AddV(Names, Text(WidgetTree, FText::FromString(Sk.Desc), EHWUITextToken::Caption, EHWUIColorToken::TextSecondary), FMargin(0.f, 4.f, 0.f, 0.f));
        AddH(Row, Names, FMargin(0), true)->SetVerticalAlignment(VAlign_Center);
        AddH(Row, Text(WidgetTree, FText::FromString(FString::Printf(TEXT("쿨타임 %g초 · 기력 %g"), Sk.Cooldown, Sk.Stamina)),
            EHWUITextToken::Caption, EHWUIColorToken::TextMuted))->SetVerticalAlignment(VAlign_Center);
        Scroll->AddChild(SelectableCard(Row, Index == Selected, [this, Index]() { Selected = Index; RequestRefresh(); }, FMargin(20.f, 14.f)));
        Scroll->AddChild(Gap(WidgetTree, 1.f, M(EHWUIMetricToken::CardGap)));
    }
    AddV(List, Scroll, FMargin(0), true);
    Place(Root, List, FAnchors(0.f, 0.f, 0.f, 1.f), FMargin(SafeX(), ContentTop(), ListWidth, ContentBottom()));

    // Right: points (top-right) + selected skill detail.
    UVerticalBox* Detail = VBox(WidgetTree);
    AddV(Detail, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "Points", "스킬 포인트"), FText::FromString(TEXT("—")), EHWUIColorToken::TextSecondary));
    AddV(Detail, Rule(WidgetTree), FMargin(0.f, 16.f));
    if (Skills.IsValidIndex(Selected))
    {
        const FHWUISkill& Sk = Skills[Selected];
        AddV(Detail, Text(WidgetTree, FText::FromString(Sk.Name), EHWUITextToken::PageTitle, EHWUIColorToken::TextPrimary, EHWUIWeight::Bold));
        AddV(Detail, TextWrap(WidgetTree, FText::FromString(Sk.Desc), EHWUITextToken::Body, EHWUIColorToken::TextSecondary), FMargin(0.f, 12.f, 0.f, 0.f));
        AddV(Detail, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "Cooldown", "쿨타임"), FText::FromString(FString::Printf(TEXT("%g초"), Sk.Cooldown))), FMargin(0.f, 18.f, 0.f, 4.f));
        AddV(Detail, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "StCost", "기력"), FText::FromString(FString::Printf(TEXT("%g"), Sk.Stamina))), FMargin(0.f, 4.f));
    }
    AddV(Detail, Gap(WidgetTree, 1.f, 1.f), FMargin(0), true);
    AddV(Detail, NoSystemNote(NSLOCTEXT("HWUI", "SkillUpgrade", "스킬 강화·장착")));
    UBorder* DetailPanel = Panel(WidgetTree, Box(C(EHWUIColorToken::Panel), 4.f), FMargin(M(EHWUIMetricToken::PanelPadding)));
    DetailPanel->SetContent(Detail);
    Place(Root, DetailPanel, FAnchors(1.f, 0.f, 1.f, 1.f), FMargin(-SafeX(), ContentTop(), 560.f, ContentBottom()), FVector2D(1.f, 0.f));
}

// ---------------------------------------------------------------- Looks

FText UHWLooksScreen::GetScreenTitle() const
{
    return NSLOCTEXT("HWUI", "LooksTitle", "외형");
}

void UHWLooksScreen::Build(UCanvasPanel* Root)
{
    const FHWUICatalog& Catalog = FHWUICatalog::Get();
    UHWFrontendRootWidget* F = GetFrontend();
    const FHWUICharacter* Ch = Catalog.FindCharacter(F ? F->SelectedCharacter : FName(TEXT("ain")));
    if (!Ch)
    {
        return;
    }

    UWidget* Hero = Sized(WidgetTree, Fit(WidgetTree, Art(TEXT("full-") + Ch->Id.ToString()), false), 440.f, 860.f);
    Hero->SetVisibility(ESlateVisibility::HitTestInvisible);
    MarkArt(Hero);
    Place(Root, Hero, FAnchors(0.5f, 1.f), FMargin(0.f, -ContentBottom(), 440.f, 860.f), FVector2D(0.5f, 1.f));

    UVerticalBox* Left = VBox(WidgetTree);
    AddV(Left, CharacterTabs(this, WidgetTree, Ch->Id, [this, F](FName Id) { if (F) { F->SelectCharacter(Id); } RequestRefresh(); },
        [this](UWidget* W, TFunction<void()> Fn) { return TapGhost(W, MoveTemp(Fn), FMargin(0.f, 8.f)); }), FMargin(0.f, 0.f, 0.f, 18.f));
    AddV(Left, SectionTitle(NSLOCTEXT("HWUI", "Look", "외형 설명")), FMargin(0.f, 0.f, 0.f, 8.f));
    AddV(Left, TextWrap(WidgetTree, FText::FromString(Ch->Look), EHWUITextToken::Body, EHWUIColorToken::TextSecondary));
    AddV(Left, SectionTitle(NSLOCTEXT("HWUI", "Palette", "색 구성")), FMargin(0.f, M(EHWUIMetricToken::SectionGap), 0.f, 10.f));
    UHorizontalBox* Swatches = HBox(WidgetTree);
    for (const FLinearColor& Swatch : Ch->Swatches)
    {
        UBorder* Chip = Panel(WidgetTree, Box(Swatch, 2.f, C(EHWUIColorToken::Line), 1.f), FMargin(0));
        AddH(Swatches, Sized(WidgetTree, Chip, 44.f, 44.f), FMargin(0.f, 0.f, 10.f, 0.f));
    }
    AddV(Left, Swatches);
    UBorder* LeftPanel = Panel(WidgetTree, Box(C(EHWUIColorToken::Panel, 0.8f), 4.f), FMargin(M(EHWUIMetricToken::PanelPadding)));
    LeftPanel->SetContent(Left);
    Place(Root, Sized(WidgetTree, LeftPanel, 520.f, 0.f), FAnchors(0.f, 0.f), FMargin(SafeX(), ContentTop(), 520.f, 0.f), FVector2D::ZeroVector, true);

    UVerticalBox* Right = VBox(WidgetTree);
    AddV(Right, SectionTitle(NSLOCTEXT("HWUI", "Presets", "외형 프리셋")), FMargin(0.f, 0.f, 0.f, 10.f));
    UVerticalBox* Preset = VBox(WidgetTree);
    AddV(Preset, Text(WidgetTree, NSLOCTEXT("HWUI", "Default", "기본"), EHWUITextToken::Body, EHWUIColorToken::TextPrimary, EHWUIWeight::Bold));
    AddV(Preset, Text(WidgetTree, FText::FromString(Ch->Weapon), EHWUITextToken::Caption, EHWUIColorToken::TextSecondary));
    AddV(Right, SelectableCard(Preset, true, []() {}, FMargin(18.f, 14.f)));
    AddV(Right, NoSystemNote(NSLOCTEXT("HWUI", "LookChange", "외형 변경")), FMargin(0.f, M(EHWUIMetricToken::SectionGap), 0.f, 0.f));
    Place(Root, Sized(WidgetTree, Right, 420.f, 0.f), FAnchors(1.f, 0.f), FMargin(-SafeX(), ContentTop(), 420.f, 0.f), FVector2D(1.f, 0.f), true);
}

// ---------------------------------------------------------------- Profile / settings

FText UHWProfileScreen::GetScreenTitle() const
{
    return NSLOCTEXT("HWUI", "ProfileTitle", "프로필 · 설정");
}

void UHWProfileScreen::Build(UCanvasPanel* Root)
{
    const FHWUICatalog& Catalog = FHWUICatalog::Get();
    UHWFrontendRootWidget* F = GetFrontend();
    UHWProfileSubsystem* Profile = ProfileSystem();
    UHWGameContentSubsystem* Content = ContentSystem();
    UHWGraphicsQualitySubsystem* Graphics = GraphicsSystem();
    const bool bProfile = Profile && Profile->IsProfileAvailable();
    const FHWUICharacter* Ain = Catalog.FindCharacter(TEXT("ain"));

    UVerticalBox* Left = VBox(WidgetTree);
    UHorizontalBox* Who = HBox(WidgetTree);
    AddH(Who, Sized(WidgetTree, Fit(WidgetTree, Art(TEXT("face-ain")), true), 96.f, 96.f), FMargin(0.f, 0.f, 20.f, 0.f));
    UVerticalBox* Names = VBox(WidgetTree);
    AddV(Names, Text(WidgetTree, FText::FromString(Ain ? Ain->Name : TEXT("아인")), EHWUITextToken::PageTitle, EHWUIColorToken::TextPrimary, EHWUIWeight::Bold));
    AddV(Names, Text(WidgetTree, FText::FromString(Ain ? Ain->Title : FString()), EHWUITextToken::Caption, EHWUIColorToken::TextSecondary), FMargin(0.f, 4.f, 0.f, 0.f));
    AddH(Who, Names)->SetVerticalAlignment(VAlign_Center);
    AddV(Left, Who);
    AddV(Left, Rule(WidgetTree), FMargin(0.f, 20.f));
    AddV(Left, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "Gold", "골드"), bProfile ? Num(Profile->GetGold()) : FText::FromString(TEXT("—"))), FMargin(0.f, 4.f));
    AddV(Left, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "Exp", "경험치"), bProfile ? Num(Profile->GetExperience()) : FText::FromString(TEXT("—"))), FMargin(0.f, 4.f));
    AddV(Left, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "Save", "저장"),
        !bProfile ? NSLOCTEXT("HWUI", "NoProfile", "프로필 없음")
        : Profile->HasPendingSave() ? NSLOCTEXT("HWUI", "SavePending", "저장 대기 — 다시 시도 필요")
        : NSLOCTEXT("HWUI", "Saved", "저장됨")), FMargin(0.f, 4.f));
    if (bProfile && !Profile->GetLastError().IsEmpty())
    {
        AddV(Left, TextWrap(WidgetTree, FText::FromString(Profile->GetLastError()), EHWUITextToken::Caption, EHWUIColorToken::Danger), FMargin(0.f, 6.f));
    }
    if (bProfile && Profile->HasPendingSave())
    {
        AddV(Left, SecondaryAction(NSLOCTEXT("HWUI", "Retry", "저장 다시 시도"), [this, Profile]() { Profile->RetryPendingSave(); RequestRefresh(); }),
            FMargin(0.f, 10.f))->SetHorizontalAlignment(HAlign_Left);
    }
    AddV(Left, SectionTitle(NSLOCTEXT("HWUI", "ClearLog", "클리어 기록")), FMargin(0.f, M(EHWUIMetricToken::SectionGap), 0.f, 8.f));
    if (Content && Content->IsContentLoaded())
    {
        for (const FHWQuestDefinition& Q : Content->GetQuests())
        {
            AddV(Left, KeyValue(WidgetTree, Q.DisplayName, FText::Format(NSLOCTEXT("HWUI", "ClearState", "{0}회 · {1}"),
                bProfile ? Profile->GetClearCount(Q.ArenaId) : 0, bProfile ? QuestStateText(Profile->GetQuestState(Q.Id)) : FText::GetEmpty()),
                EHWUIColorToken::TextSecondary), FMargin(0.f, 4.f));
        }
    }
    UBorder* LeftPanel = Panel(WidgetTree, Box(C(EHWUIColorToken::Panel), 4.f), FMargin(28.f, 24.f));
    LeftPanel->SetContent(Left);
    Place(Root, LeftPanel, FAnchors(0.f, 0.f, 0.f, 1.f), FMargin(SafeX(), ContentTop(), 800.f, ContentBottom()));

    UVerticalBox* Right = VBox(WidgetTree);
    AddV(Right, SectionTitle(NSLOCTEXT("HWUI", "GraphicsTier", "그래픽 등급"), NSLOCTEXT("HWUI", "TierNote", "High 만 드로어·모달 뒤 블러 1 장")),
        FMargin(0.f, 0.f, 0.f, 12.f));
    UHorizontalBox* Tiers = HBox(WidgetTree);
    const EHWGraphicsTier CurrentTier = Graphics ? Graphics->GetCurrentTier() : EHWGraphicsTier::High;
    for (const EHWGraphicsTier Tier : { EHWGraphicsTier::Low, EHWGraphicsTier::Mid, EHWGraphicsTier::High })
    {
        const TCHAR* Name = Tier == EHWGraphicsTier::High ? TEXT("High") : Tier == EHWGraphicsTier::Mid ? TEXT("Mid") : TEXT("Low");
        UTextBlock* Label = Text(WidgetTree, FText::FromString(Name), EHWUITextToken::Body, EHWUIColorToken::TextPrimary,
            Tier == CurrentTier ? EHWUIWeight::Bold : EHWUIWeight::Regular);
        Label->SetJustification(ETextJustify::Center);
        AddH(Tiers, SelectableCard(Label, Tier == CurrentTier, [this, F, Graphics, Tier]()
        {
            if (Graphics) { Graphics->ApplyTier(Tier, true); }
            if (F) { F->RefreshChrome(); }
            RequestRefresh();
        }, FMargin(24.f, 16.f)), FMargin(0.f, 0.f, M(EHWUIMetricToken::CardGap), 0.f), true);
    }
    AddV(Right, Tiers);
    UBorder* RightPanel = Panel(WidgetTree, Box(C(EHWUIColorToken::Panel), 4.f), FMargin(28.f, 24.f));
    RightPanel->SetContent(Right);
    Place(Root, Sized(WidgetTree, RightPanel, 700.f, 0.f), FAnchors(1.f, 0.f), FMargin(-SafeX(), ContentTop(), 700.f, 0.f), FVector2D(1.f, 0.f), true);
}
