#include "UI/HWFrontendScreens.h"

#include "Blueprint/WidgetTree.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/CanvasPanel.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/ScrollBox.h"
#include "Components/TextBlock.h"
#include "Components/UniformGridPanel.h"
#include "Components/UniformGridSlot.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"
#include "Progression/HWProfileSubsystem.h"
#include "UI/HWFrontendRootWidget.h"
#include "UI/HWUICatalog.h"

using namespace HWUI;

// ---------------------------------------------------------------- Shared skeleton

void UHWGridScreen::Build(UCanvasPanel* Root)
{
    const float Rail = M(EHWUIMetricToken::SlimRailWidth);
    const float Gutter = M(EHWUIMetricToken::SectionGap);
    const float DetailWidth = 620.f;

    // Slim category rail.
    UVerticalBox* Cats = VBox(WidgetTree);
    const TArray<FText> Names = Categories();
    Category = Names.IsValidIndex(Category) ? Category : 0;
    for (int32 Index = 0; Index < Names.Num(); ++Index)
    {
        const bool bSel = Index == Category;
        UHorizontalBox* Row = HBox(WidgetTree);
        AddH(Row, Sized(WidgetTree, Fill(WidgetTree, bSel ? C(EHWUIColorToken::Gold) : FLinearColor::Transparent),
            M(EHWUIMetricToken::SelectionBar), 36.f))->SetVerticalAlignment(VAlign_Center);
        UTextBlock* Label = Text(WidgetTree, Names[Index], EHWUITextToken::Caption,
            bSel ? EHWUIColorToken::Gold : EHWUIColorToken::TextSecondary, bSel ? EHWUIWeight::Bold : EHWUIWeight::Regular);
        Label->SetJustification(ETextJustify::Center);
        AddH(Row, Label, FMargin(0), true)->SetVerticalAlignment(VAlign_Center);
        AddV(Cats, Sized(WidgetTree, TapGhost(Row, [this, Index]() { Category = Index; Selected = INDEX_NONE; RequestRefresh(); }), Rail, 64.f));
    }
    UBorder* CatPanel = Panel(WidgetTree, Box(C(EHWUIColorToken::Panel, 0.72f), 4.f), FMargin(0.f, 8.f));
    CatPanel->SetContent(Cats);
    Place(Root, CatPanel, FAnchors(0.f, 0.f), FMargin(SafeX(), ContentTop(), Rail, 0.f), FVector2D::ZeroVector, true);

    // Entries in the current category.
    TArray<int32> Visible;
    for (int32 Entry = 0; Entry < CountEntries(); ++Entry)
    {
        if (EntryInCategory(Entry))
        {
            Visible.Add(Entry);
        }
    }
    if (!Visible.Contains(Selected))
    {
        Selected = Visible.Num() > 0 ? Visible[0] : INDEX_NONE;
    }

    // Grid.
    UVerticalBox* GridColumn = VBox(WidgetTree);
    AddV(GridColumn, SectionTitle(GetScreenTitle(), GridCaption(Visible.Num())), FMargin(0.f, 0.f, 0.f, 14.f));
    UUniformGridPanel* Grid = WidgetTree->ConstructWidget<UUniformGridPanel>();
    Grid->SetSlotPadding(FMargin(M(EHWUIMetricToken::CardGap) * 0.5f));
    const int32 Columns = FMath::Max(1, GridColumns());
    const FVector2D Card = CardSize();
    for (int32 Index = 0; Index < Visible.Num(); ++Index)
    {
        const int32 Entry = Visible[Index];
        UWidget* Body = BuildCard(Entry, Entry == Selected);
        UWidget* Cell = SelectableCard(Body, Entry == Selected, [this, Entry]() { Selected = Entry; RequestRefresh(); }, FMargin(16.f, 12.f));
        // Cards fill their column; only the height is fixed, so gaps stay CardGap at any width.
        // (The default Left alignment would shrink wrap-text cards to their desired width.)
        UUniformGridSlot* CellSlot = Grid->AddChildToUniformGrid(Sized(WidgetTree, Cell, 0.f, Card.Y), Index / Columns, Index % Columns);
        CellSlot->SetHorizontalAlignment(HAlign_Fill);
        CellSlot->SetVerticalAlignment(VAlign_Fill);
    }
    UScrollBox* Scroll = WidgetTree->ConstructWidget<UScrollBox>();
    Scroll->AddChild(Grid);
    AddV(GridColumn, Scroll, FMargin(0), true);
    if (UWidget* Footer = BuildFooter())
    {
        AddV(GridColumn, Footer, FMargin(0.f, 12.f, 0.f, 0.f));
    }
    const float GridLeft = SafeX() + Rail + Gutter;
    // One quiet panel behind the grid keeps busy key art out of the cards (nesting: panel > card).
    UBorder* GridPanel = Panel(WidgetTree, Box(C(EHWUIColorToken::Panel, 0.72f), 4.f), FMargin(24.f, 20.f));
    GridPanel->SetContent(GridColumn);
    Place(Root, GridPanel, FAnchors(0.f, 0.f, 1.f, 1.f), FMargin(GridLeft, ContentTop(), SafeX() + DetailWidth + Gutter, ContentBottom()));

    // Right detail, ~30 %.
    UWidget* Detail = Selected != INDEX_NONE ? BuildDetail(Selected) : nullptr;
    UBorder* DetailPanel = Panel(WidgetTree, Box(C(EHWUIColorToken::Panel), 4.f), FMargin(28.f, 24.f));
    UScrollBox* DetailScroll = WidgetTree->ConstructWidget<UScrollBox>();
    if (Detail)
    {
        DetailScroll->AddChild(Detail);
    }
    DetailPanel->SetContent(DetailScroll);
    Place(Root, DetailPanel, FAnchors(1.f, 0.f, 1.f, 1.f), FMargin(-SafeX(), ContentTop(), DetailWidth, ContentBottom()), FVector2D(1.f, 0.f));
}

namespace
{
    UWidget* ItemHeader(UWidgetTree* Tree, const FHWUIItem& Item)
    {
        const FHWUICatalog& Catalog = FHWUICatalog::Get();
        UVerticalBox* Head = VBox(Tree);
        AddV(Head, TextWrap(Tree, FText::FromString(Item.Name), EHWUITextToken::PageTitle, EHWUIColorToken::TextPrimary));
        UHorizontalBox* Line = HBox(Tree);
        AddH(Line, Tag(Tree, FText::FromString(Catalog.RarityName(Item.Rarity)), Catalog.RarityColor(Item.Rarity)), FMargin(0.f, 0.f, 16.f, 0.f));
        const FString* TypeName = Catalog.TypeNames.Find(Item.Type);
        const FString* SlotName = Catalog.SlotNames.Find(Item.Slot);
        FString Kind = TypeName ? *TypeName : Item.Type;
        if (SlotName) { Kind += TEXT(" · ") + *SlotName; }
        if (!Item.Kind.IsEmpty()) { Kind += TEXT(" · ") + Item.Kind; }
        AddH(Line, Text(Tree, FText::FromString(Kind), EHWUITextToken::Caption, EHWUIColorToken::TextSecondary))->SetVerticalAlignment(VAlign_Center);
        AddV(Head, Line, FMargin(0.f, 8.f, 0.f, 0.f));
        return Head;
    }

    void ItemBody(UWidgetTree* Tree, UVerticalBox* Out, const FHWUIItem& Item)
    {
        for (const FHWUIStat& Stat : Item.Stats)
        {
            AddV(Out, KeyValue(Tree, FText::FromString(Stat.Key), FText::FromString(Stat.Value)), FMargin(0.f, 3.f));
        }
        if (Item.EnhanceMax > 0)
        {
            AddV(Out, KeyValue(Tree, NSLOCTEXT("HWUI", "Enh", "강화"), FText::FromString(FString::Printf(TEXT("+%d / %d"), Item.Enhance, Item.EnhanceMax))), FMargin(0.f, 3.f));
        }
        if (Item.RequiredLevel > 0)
        {
            AddV(Out, KeyValue(Tree, NSLOCTEXT("HWUI", "ReqLv", "요구 레벨"), FText::AsNumber(Item.RequiredLevel)), FMargin(0.f, 3.f));
        }
        if (!Item.Effect.IsEmpty())
        {
            AddV(Out, TextWrap(Tree, FText::FromString(Item.Effect), EHWUITextToken::Body, EHWUIColorToken::TextPrimary), FMargin(0.f, 14.f, 0.f, 0.f));
        }
        if (!Item.Origin.IsEmpty())
        {
            AddV(Out, Text(Tree, FText::FromString(TEXT("획득처  ") + Item.Origin), EHWUITextToken::Caption, EHWUIColorToken::TextSecondary), FMargin(0.f, 10.f, 0.f, 0.f));
        }
        if (!Item.Flavor.IsEmpty())
        {
            AddV(Out, TextWrap(Tree, FText::FromString(Item.Flavor), EHWUITextToken::Caption, EHWUIColorToken::TextMuted), FMargin(0.f, 12.f, 0.f, 0.f));
        }
    }

    UWidget* ItemCard(UWidgetTree* Tree, const FHWUIItem* Item, FName Fallback, const FText& Corner, bool bDim)
    {
        const FHWUICatalog& Catalog = FHWUICatalog::Get();
        UVerticalBox* Body = VBox(Tree);
        UHorizontalBox* Top = HBox(Tree);
        AddH(Top, Sized(Tree, Fill(Tree, Item ? Catalog.RarityColor(Item->Rarity) : C(EHWUIColorToken::TextMuted)), 8.f, 8.f))->SetVerticalAlignment(VAlign_Center);
        AddH(Top, Gap(Tree, 1.f, 1.f), FMargin(0), true);
        AddH(Top, Text(Tree, Corner, EHWUITextToken::Caption, EHWUIColorToken::TextSecondary));
        AddV(Body, Top);
        UTextBlock* Name = TextWrap(Tree, FText::FromString(Item ? Item->Name : Fallback.ToString()), EHWUITextToken::Body,
            bDim ? EHWUIColorToken::TextMuted : EHWUIColorToken::TextPrimary);
        AddV(Body, Name, FMargin(0.f, 8.f, 0.f, 0.f), true);
        AddV(Body, Text(Tree, FText::FromString(Item ? Item->Kind : FString()), EHWUITextToken::Caption, EHWUIColorToken::TextMuted));
        return Body;
    }

    bool TypeMatches(const FHWUIItem* Item, int32 Category)
    {
        static const TCHAR* Types[] = { nullptr, TEXT("weapon"), TEXT("armor"), TEXT("acc"), TEXT("consumable"), TEXT("material") };
        if (Category <= 0 || Category >= UE_ARRAY_COUNT(Types))
        {
            return true;
        }
        return Item && Item->Type == Types[Category];
    }
}

// ---------------------------------------------------------------- Inventory

FText UHWInventoryScreen::GetScreenTitle() const
{
    return NSLOCTEXT("HWUI", "InvTitle", "가방");
}

TArray<FText> UHWInventoryScreen::Categories() const
{
    return { NSLOCTEXT("HWUI", "All", "전체"), NSLOCTEXT("HWUI", "Weapon", "무기"), NSLOCTEXT("HWUI", "Armor", "방어구"),
        NSLOCTEXT("HWUI", "Acc", "장신구"), NSLOCTEXT("HWUI", "Consumable", "소모품"), NSLOCTEXT("HWUI", "Material", "재료") };
}

int32 UHWInventoryScreen::CountEntries() const
{
    return FHWUICatalog::Get().Items.Num();
}

bool UHWInventoryScreen::EntryInCategory(int32 Entry) const
{
    const TArray<FHWUIItem>& Items = FHWUICatalog::Get().Items;
    return Items.IsValidIndex(Entry) && TypeMatches(&Items[Entry], Category);
}

int64 UHWInventoryScreen::Owned(int32 Entry) const
{
    const UHWProfileSubsystem* Profile = ProfileSystem();
    const TArray<FHWUIItem>& Items = FHWUICatalog::Get().Items;
    return Profile && Profile->IsProfileAvailable() && Items.IsValidIndex(Entry) ? Profile->GetItemCount(Items[Entry].Id) : 0;
}

UWidget* UHWInventoryScreen::BuildCard(int32 Entry, bool bSelected)
{
    const FHWUIItem& Item = FHWUICatalog::Get().Items[Entry];
    const int64 Count = Owned(Entry);
    return ItemCard(WidgetTree, &Item, Item.Id, FText::FromString(FString::Printf(TEXT("×%lld"), Count)), Count <= 0);
}

UWidget* UHWInventoryScreen::BuildDetail(int32 Entry)
{
    const FHWUIItem& Item = FHWUICatalog::Get().Items[Entry];
    UVerticalBox* Detail = VBox(WidgetTree);
    AddV(Detail, ItemHeader(WidgetTree, Item));
    AddV(Detail, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "Owned", "보유"), FText::AsNumber(Owned(Entry))), FMargin(0.f, 14.f, 0.f, 0.f));
    AddV(Detail, Rule(WidgetTree), FMargin(0.f, 14.f));
    ItemBody(WidgetTree, Detail, Item);
    AddV(Detail, NoSystemNote(NSLOCTEXT("HWUI", "Equip", "장착·강화")), FMargin(0.f, M(EHWUIMetricToken::SectionGap), 0.f, 0.f));
    return Detail;
}

FText UHWInventoryScreen::GridCaption(int32 Visible) const
{
    int32 OwnedKinds = 0;
    for (int32 Entry = 0; Entry < CountEntries(); ++Entry)
    {
        OwnedKinds += Owned(Entry) > 0 ? 1 : 0;
    }
    return OwnedKinds > 0
        ? FText::Format(NSLOCTEXT("HWUI", "InvCaption", "보유 {0}종 · 표시 {1}"), OwnedKinds, Visible)
        : FText::Format(NSLOCTEXT("HWUI", "InvEmpty", "보유 0 — 도감으로 표시 {0}"), Visible);
}

// ---------------------------------------------------------------- Forge

FText UHWForgeScreen::GetScreenTitle() const
{
    return NSLOCTEXT("HWUI", "ForgeTitle", "공방 · 제작");
}

TArray<FText> UHWForgeScreen::Categories() const
{
    return { NSLOCTEXT("HWUI", "All", "전체"), NSLOCTEXT("HWUI", "Weapon", "무기"), NSLOCTEXT("HWUI", "Armor", "방어구"),
        NSLOCTEXT("HWUI", "Acc", "장신구") };
}

int32 UHWForgeScreen::CountEntries() const
{
    return FHWUICatalog::Get().Recipes.Num();
}

bool UHWForgeScreen::EntryInCategory(int32 Entry) const
{
    const FHWUICatalog& Catalog = FHWUICatalog::Get();
    if (!Catalog.Recipes.IsValidIndex(Entry))
    {
        return false;
    }
    return TypeMatches(Catalog.FindItem(Catalog.Recipes[Entry].Result), Category);
}

UWidget* UHWForgeScreen::BuildCard(int32 Entry, bool bSelected)
{
    const FHWUICatalog& Catalog = FHWUICatalog::Get();
    const FHWUIRecipe& Recipe = Catalog.Recipes[Entry];
    const FHWUIItem* Item = Catalog.FindItem(Recipe.Result);
    UHorizontalBox* Row = HBox(WidgetTree);
    AddH(Row, Sized(WidgetTree, Fill(WidgetTree, Item ? Catalog.RarityColor(Item->Rarity) : C(EHWUIColorToken::TextMuted)), 8.f, 8.f), FMargin(0.f, 0.f, 14.f, 0.f))
        ->SetVerticalAlignment(VAlign_Center);
    UVerticalBox* Names = VBox(WidgetTree);
    AddV(Names, Text(WidgetTree, FText::FromString(Item ? Item->Name : Recipe.Result.ToString()), EHWUITextToken::Body, EHWUIColorToken::TextPrimary,
        bSelected ? EHWUIWeight::Bold : EHWUIWeight::Medium));
    AddV(Names, Text(WidgetTree, FText::FromString(FString::Printf(TEXT("제작 Lv %d · %s"), Recipe.CraftLevel, *Recipe.Time)),
        EHWUITextToken::Caption, EHWUIColorToken::TextSecondary), FMargin(0.f, 4.f, 0.f, 0.f));
    AddH(Row, Names, FMargin(0), true)->SetVerticalAlignment(VAlign_Center);
    AddH(Row, Text(WidgetTree, FText::Format(NSLOCTEXT("HWUI", "GoldN", "{0} 골드"), FText::AsNumber(Recipe.Cost)), EHWUITextToken::Caption,
        EHWUIColorToken::TextSecondary))->SetVerticalAlignment(VAlign_Center);
    return Row;
}

UWidget* UHWForgeScreen::BuildDetail(int32 Entry)
{
    const FHWUICatalog& Catalog = FHWUICatalog::Get();
    const FHWUIRecipe& Recipe = Catalog.Recipes[Entry];
    const FHWUIItem* Item = Catalog.FindItem(Recipe.Result);
    const UHWProfileSubsystem* Profile = ProfileSystem();
    const bool bProfile = Profile && Profile->IsProfileAvailable();

    UVerticalBox* Detail = VBox(WidgetTree);
    if (Item)
    {
        AddV(Detail, ItemHeader(WidgetTree, *Item));
    }
    AddV(Detail, Rule(WidgetTree), FMargin(0.f, 14.f));
    AddV(Detail, SectionTitle(NSLOCTEXT("HWUI", "Mats", "재료"), NSLOCTEXT("HWUI", "OwnNeed", "보유 / 필요")), FMargin(0.f, 0.f, 0.f, 8.f));
    for (const TPair<FName, int32>& Mat : Recipe.Materials)
    {
        const int64 Have = bProfile ? Profile->GetItemCount(Mat.Key) : 0;
        AddV(Detail, KeyValue(WidgetTree, FText::FromString(Catalog.ItemName(Mat.Key)),
            FText::FromString(FString::Printf(TEXT("%lld / %d"), Have, Mat.Value)),
            Have >= Mat.Value ? EHWUIColorToken::TextPrimary : EHWUIColorToken::TextMuted), FMargin(0.f, 3.f));
    }
    AddV(Detail, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "Cost", "비용"), FText::Format(NSLOCTEXT("HWUI", "GoldN", "{0} 골드"), FText::AsNumber(Recipe.Cost))),
        FMargin(0.f, 14.f, 0.f, 3.f));
    AddV(Detail, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "Time", "제작 시간"), FText::FromString(Recipe.Time)), FMargin(0.f, 3.f));
    AddV(Detail, SectionTitle(NSLOCTEXT("HWUI", "EnhRate", "강화 확률")), FMargin(0.f, M(EHWUIMetricToken::SectionGap), 0.f, 8.f));
    FString Rates;
    for (const FHWUIEnhanceStep& Step : Catalog.Enhancement)
    {
        Rates += FString::Printf(TEXT("+%d  %d%%    "), Step.To, Step.Rate);
    }
    AddV(Detail, TextWrap(WidgetTree, FText::FromString(Rates), EHWUITextToken::Caption, EHWUIColorToken::TextSecondary));
    AddV(Detail, PrimaryAction(NSLOCTEXT("HWUI", "Craft", "제작"), NSLOCTEXT("HWUI", "NoForge", "UE 공방 시스템 없음"), false, []() {}, 0.f, 108.f),
        FMargin(0.f, M(EHWUIMetricToken::SectionGap), 0.f, 0.f));
    AddV(Detail, NoSystemNote(NSLOCTEXT("HWUI", "CraftEnh", "제작·강화")), FMargin(0.f, 12.f, 0.f, 0.f));
    return Detail;
}

FText UHWForgeScreen::GridCaption(int32 Visible) const
{
    return FText::Format(NSLOCTEXT("HWUI", "RecipeN", "제작법 {0}"), Visible);
}

// ---------------------------------------------------------------- Shop

FText UHWShopScreen::GetScreenTitle() const
{
    return NSLOCTEXT("HWUI", "ShopTitle", "상점");
}

TArray<FText> UHWShopScreen::Categories() const
{
    return { NSLOCTEXT("HWUI", "All", "전체"), NSLOCTEXT("HWUI", "Consumable", "소모품"), NSLOCTEXT("HWUI", "Material", "재료") };
}

int32 UHWShopScreen::CountEntries() const
{
    return FHWUICatalog::Get().Shop.Num();
}

bool UHWShopScreen::EntryInCategory(int32 Entry) const
{
    const FHWUICatalog& Catalog = FHWUICatalog::Get();
    if (!Catalog.Shop.IsValidIndex(Entry))
    {
        return false;
    }
    const FHWUIShopRow& Row = Catalog.Shop[Entry];
    const FHWUIItem* Item = Catalog.FindItem(Row.ItemId);
    const bool bCat = Category == 0 || (Item && Item->Type == (Category == 1 ? TEXT("consumable") : TEXT("material")));
    static const TCHAR* Tags[] = { nullptr, TEXT("출격 필수"), TEXT("강화"), TEXT("체크리스트") };
    const bool bTag = Tag <= 0 || Tag >= UE_ARRAY_COUNT(Tags) || Row.Tag == Tags[Tag];
    return bCat && bTag;
}

UWidget* UHWShopScreen::BuildCard(int32 Entry, bool bSelected)
{
    const FHWUICatalog& Catalog = FHWUICatalog::Get();
    const FHWUIShopRow& Row = Catalog.Shop[Entry];
    const FText Corner = Row.Buy >= 0 ? FText::AsNumber(Row.Buy) : NSLOCTEXT("HWUI", "SellOnly", "판매 전용");
    return ItemCard(WidgetTree, Catalog.FindItem(Row.ItemId), Row.ItemId, Corner, Row.Buy < 0);
}

UWidget* UHWShopScreen::BuildDetail(int32 Entry)
{
    const FHWUICatalog& Catalog = FHWUICatalog::Get();
    const FHWUIShopRow& Row = Catalog.Shop[Entry];
    const FHWUIItem* Item = Catalog.FindItem(Row.ItemId);
    const UHWProfileSubsystem* Profile = ProfileSystem();
    const bool bProfile = Profile && Profile->IsProfileAvailable();

    UVerticalBox* Detail = VBox(WidgetTree);
    if (Item)
    {
        AddV(Detail, ItemHeader(WidgetTree, *Item));
        if (!Item->Effect.IsEmpty())
        {
            AddV(Detail, TextWrap(WidgetTree, FText::FromString(Item->Effect), EHWUITextToken::Body, EHWUIColorToken::TextSecondary), FMargin(0.f, 12.f, 0.f, 0.f));
        }
    }
    AddV(Detail, Rule(WidgetTree), FMargin(0.f, 14.f));
    AddV(Detail, SectionTitle(NSLOCTEXT("HWUI", "Purchase", "구매 요약")), FMargin(0.f, 0.f, 0.f, 8.f));
    AddV(Detail, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "BuyPrice", "구매가"), Row.Buy >= 0 ? FText::AsNumber(Row.Buy) : NSLOCTEXT("HWUI", "SellOnly", "판매 전용")), FMargin(0.f, 3.f));
    AddV(Detail, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "SellPrice", "판매가"), FText::AsNumber(Row.Sell)), FMargin(0.f, 3.f));
    AddV(Detail, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "Qty", "수량"), FText::AsNumber(1)), FMargin(0.f, 3.f));
    AddV(Detail, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "HaveGold", "보유 골드"), bProfile ? Num(Profile->GetGold()) : FText::FromString(TEXT("—"))), FMargin(0.f, 3.f));
    AddV(Detail, KeyValue(WidgetTree, NSLOCTEXT("HWUI", "HaveItem", "보유 수량"), bProfile ? Num(Profile->GetItemCount(Row.ItemId)) : FText::FromString(TEXT("—"))), FMargin(0.f, 3.f));
    AddV(Detail, PrimaryAction(NSLOCTEXT("HWUI", "Buy", "구매"), NSLOCTEXT("HWUI", "NoShop", "UE 상점 시스템 없음"), false, []() {}, 0.f, 108.f),
        FMargin(0.f, M(EHWUIMetricToken::SectionGap), 0.f, 0.f));
    AddV(Detail, NoSystemNote(NSLOCTEXT("HWUI", "BuySell", "구매·판매")), FMargin(0.f, 12.f, 0.f, 0.f));
    return Detail;
}

FText UHWShopScreen::GridCaption(int32 Visible) const
{
    return FText::Format(NSLOCTEXT("HWUI", "ShopN", "상품 {0}"), Visible);
}

UWidget* UHWShopScreen::BuildFooter()
{
    // Bottom sub-category tabs (spec §6 Shop).
    UHorizontalBox* Row = HBox(WidgetTree);
    const TCHAR* Labels[] = { TEXT("전체"), TEXT("출격 필수"), TEXT("강화"), TEXT("체크리스트") };
    for (int32 Index = 0; Index < UE_ARRAY_COUNT(Labels); ++Index)
    {
        const bool bSel = Index == Tag;
        UVerticalBox* Stack = VBox(WidgetTree);
        AddV(Stack, Text(WidgetTree, FText::FromString(Labels[Index]), EHWUITextToken::Caption,
            bSel ? EHWUIColorToken::Gold : EHWUIColorToken::TextSecondary, bSel ? EHWUIWeight::Bold : EHWUIWeight::Regular))->SetHorizontalAlignment(HAlign_Center);
        AddV(Stack, Sized(WidgetTree, Fill(WidgetTree, bSel ? C(EHWUIColorToken::Gold) : FLinearColor::Transparent), 28.f, M(EHWUIMetricToken::SelectionBar)),
            FMargin(0.f, 6.f, 0.f, 0.f))->SetHorizontalAlignment(HAlign_Center);
        AddH(Row, Sized(WidgetTree, TapGhost(Stack, [this, Index]() { Tag = Index; Selected = INDEX_NONE; RequestRefresh(); }, FMargin(0.f, 8.f)), 132.f, 0.f));
    }
    return Row;
}
