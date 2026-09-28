#pragma once

#include "CoreMinimal.h"

// Read-only display data for the frontend, straight from Content/Data/game_content.json.
// Only quests have a UE system (UHWGameContentSubsystem / UHWProfileSubsystem / UHWQuestRunSubsystem);
// inventory, shop, forge, skills, looks, party and story exist in UE only as this exported content,
// so their screens show it without actions (docs/design/123 §9, 126).

struct FHWUIStat
{
    FString Key;
    FString Value;
};

struct FHWUICharacter
{
    FName Id;
    FString Name, En, Class, Role, Sub, Weapon, Title, Quote, Look;
    int32 Level = 0;
    int32 CombatPower = 0;
    TArray<FHWUIStat> Stats;
    TArray<FHWUIStat> Traits;        // Key = trait name, Value = description
    TArray<FLinearColor> Swatches;
};

struct FHWUIItem
{
    FName Id;
    FString Name, Kind, Type, Rarity, Slot, Effect, Flavor, Origin, Bind;
    int32 CombatPower = 0;
    int32 Price = 0;
    int32 RequiredLevel = 0;
    int32 Enhance = 0;
    int32 EnhanceMax = 0;
    TArray<FHWUIStat> Stats;
};

struct FHWUIShopRow
{
    FName ItemId;
    int32 Buy = -1;                  // -1 = sell only
    int32 Sell = 0;
    FString Tag;
};

struct FHWUIRecipe
{
    FName Id;
    FName Result;
    FString Category, Time;
    int32 Cost = 0;
    int32 CraftLevel = 0;
    TArray<TPair<FName, int32>> Materials;
};

struct FHWUIEnhanceStep
{
    int32 To = 0;
    int32 Cost = 0;
    int32 Rate = 0;
    TArray<TPair<FName, int32>> Materials;
};

struct FHWUISkill
{
    FName Id;
    FString Name, Desc, Key;
    float Cooldown = 0.f;
    float Stamina = 0.f;
};

struct FHWUIStoryLine
{
    FName Speaker;
    FString Text;
};

struct FHWUIChapter
{
    FName Id;
    FString Name, Title, Art;
    TArray<FHWUIStoryLine> Lines;    // lines + brief + after, in play order
};

struct FHWUINpc
{
    FName Id;
    FString Name, Sub, Face;         // Face = art name without folder/extension ("face-ain")
};

struct FHWUIQuestText
{
    FName Id;
    FString Area, Risk, Goal, Desc, Note, BossArt;
    int32 Level = 0;
    TArray<FString> Must;
    TArray<FString> Optional;
};

struct FHWUIRarity
{
    FString Name;
    FLinearColor Color = FLinearColor::White;
};

class HWANGHONCOMBATUE_API FHWUICatalog
{
public:
    static const FHWUICatalog& Get();

    bool IsLoaded() const { return bLoaded; }
    const FString& GetError() const { return Error; }

    TArray<FHWUICharacter> Characters;           // partyOrder
    TArray<FHWUIItem> Items;
    TArray<FHWUIShopRow> Shop;
    TArray<FHWUIRecipe> Recipes;
    TArray<FHWUIEnhanceStep> Enhancement;
    TMap<FName, TArray<FHWUISkill>> Skills;      // by character
    TArray<FHWUIChapter> Chapters;
    TMap<FName, FHWUINpc> Npcs;
    TMap<FName, FHWUIQuestText> QuestText;
    TMap<FString, FHWUIRarity> Rarity;
    TMap<FString, FString> TypeNames;
    TMap<FString, FString> SlotNames;

    const FHWUICharacter* FindCharacter(FName Id) const;
    const FHWUIItem* FindItem(FName Id) const;
    FString ItemName(FName Id) const;
    FLinearColor RarityColor(const FString& RarityId) const;
    FString RarityName(const FString& RarityId) const;

private:
    void Load();
    bool bLoaded = false;
    FString Error;
};
