#include "Content/HWGameContentSubsystem.h"
#include "Dom/JsonObject.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

namespace
{
    using FObject = TSharedPtr<FJsonObject>;
    using FValue = TSharedPtr<FJsonValue>;

    FValue Field(const FObject& Object, const TCHAR* Name)
    {
        return Object.IsValid() ? Object->TryGetField(Name) : nullptr;
    }

    FObject ObjectValue(const FValue& Value)
    {
        return Value.IsValid() && Value->Type == EJson::Object ? Value->AsObject() : nullptr;
    }

    const TArray<FValue>* ArrayValue(const FValue& Value)
    {
        return Value.IsValid() && Value->Type == EJson::Array ? &Value->AsArray() : nullptr;
    }

    bool StringValue(const FValue& Value, FString& Out)
    {
        if (!Value.IsValid() || Value->Type != EJson::String) return false;
        Out = Value->AsString();
        return !Out.TrimStartAndEnd().IsEmpty();
    }

    bool StringField(const FObject& Object, const TCHAR* Name, FString& Out)
    {
        return StringValue(Field(Object, Name), Out);
    }

    bool IsId(const FString& Value)
    {
        if (Value.IsEmpty() || Value.Len() >= NAME_SIZE || FName(*Value).IsNone()) return false;
        for (TCHAR C : Value)
        {
            if (!((C >= 'a' && C <= 'z') || (C >= 'A' && C <= 'Z') || (C >= '0' && C <= '9') || C == '_')) return false;
        }
        return true;
    }

    bool IdField(const FObject& Object, const TCHAR* Name, FString& Out)
    {
        return StringField(Object, Name, Out) && IsId(Out);
    }

    bool IntegerValue(const FValue& Value, int32& Out)
    {
        if (!Value.IsValid() || Value->Type != EJson::Number) return false;
        const double Number = Value->AsNumber();
        if (!FMath::IsFinite(Number) || Number < 0 || Number > MAX_int32) return false;
        Out = static_cast<int32>(Number);
        return Number == static_cast<double>(Out);
    }

    bool Quantity(const FValue& Value, int32& Min, int32& Max)
    {
        if (IntegerValue(Value, Min)) { Max = Min; return true; }
        FString Text, Left, Right;
        if (!StringValue(Value, Text) || !Text.Split(TEXT("~"), &Left, &Right) || Left.IsEmpty() || Right.IsEmpty()) return false;
        for (const FString* Part : {&Left, &Right})
        {
            for (TCHAR C : *Part) if (C < '0' || C > '9') return false;
        }
        // Bound text before integer parsing; int32 overflow must never wrap rewards.
        if (Left.Len() > 10 || Right.Len() > 10) return false;
        const int64 ParsedMin = FCString::Atoi64(*Left), ParsedMax = FCString::Atoi64(*Right);
        if (ParsedMin > MAX_int32 || ParsedMax > MAX_int32 || ParsedMax < ParsedMin) return false;
        Min = static_cast<int32>(ParsedMin); Max = static_cast<int32>(ParsedMax);
        return true;
    }
}

void UHWGameContentSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    if (!LoadFromProjectContent()) UE_LOG(LogTemp, Warning, TEXT("Hwanghon content: %s"), *LoadError);
}

bool UHWGameContentSubsystem::LoadFromProjectContent()
{
    bLoaded = false;
    Quests.Reset();
    LoadError.Reset();
    FString Json;
    const FString Filename = FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Data/game_content.json"));
    if (!FFileHelper::LoadFileToString(Json, *Filename))
    {
        LoadError = TEXT("Could not read Content/Data/game_content.json.");
        return false;
    }
    bLoaded = ParseQuestCatalog(Json, Quests, LoadError);
    return bLoaded;
}

bool UHWGameContentSubsystem::GetQuest(FName QuestId, FHWQuestDefinition& OutQuest) const
{
    const FHWQuestDefinition* Found = bLoaded ? Quests.FindByPredicate([QuestId](const FHWQuestDefinition& Quest) { return Quest.Id == QuestId; }) : nullptr;
    OutQuest = Found ? *Found : FHWQuestDefinition();
    return Found != nullptr;
}

bool UHWGameContentSubsystem::ParseQuestCatalog(const FString& Json, TArray<FHWQuestDefinition>& OutQuests, FString& OutError)
{
    OutQuests.Reset();
    OutError.Reset();
    const auto Fail = [&OutError](const TCHAR* Message) { OutError = Message; return false; };
    FObject Root;
    const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid()) return Fail(TEXT("Content is not a JSON object."));
    FString Schema;
    if (!StringField(Root, TEXT("schema"), Schema) || Schema != TEXT("hwanghon.game-content/1")) return Fail(TEXT("Unsupported or missing content schema."));

    const FObject Arenas = ObjectValue(Field(Root, TEXT("arenas")));
    const FObject Dungeons = ObjectValue(Field(Root, TEXT("dungeons")));
    const FObject Items = ObjectValue(Field(Root, TEXT("items")));
    const FObject Story = ObjectValue(Field(Root, TEXT("story")));
    const TArray<FValue>* Catalog = ArrayValue(Field(Items, TEXT("catalog")));
    const TArray<FValue>* Chapters = ArrayValue(Field(Story, TEXT("chapters")));
    const TArray<FValue>* Rows = ArrayValue(Field(Root, TEXT("quests")));
    if (!Arenas.IsValid() || !Dungeons.IsValid() || !Catalog || !Chapters || !Rows || Rows->IsEmpty()) return Fail(TEXT("Missing catalog tables."));

    TSet<FName> SeenItems, SeenChapters, SeenArenas, SeenDungeons, SeenQuests;
    TSet<FString> ItemIds;
    TMap<FString, FObject> ChapterById;
    for (const FValue& Value : *Catalog)
    {
        FString Id;
        if (!IdField(ObjectValue(Value), TEXT("id"), Id) || SeenItems.Contains(FName(*Id))) return Fail(TEXT("Invalid or duplicate item ID."));
        SeenItems.Add(FName(*Id)); ItemIds.Add(Id);
    }
    for (const FValue& Value : *Chapters)
    {
        FString Id;
        if (!IdField(ObjectValue(Value), TEXT("id"), Id) || SeenChapters.Contains(FName(*Id))) return Fail(TEXT("Invalid or duplicate chapter ID."));
        SeenChapters.Add(FName(*Id)); ChapterById.Add(Id, ObjectValue(Value));
    }
    for (const auto& Pair : Arenas->Values)
    {
        FString Id;
        if (!IdField(ObjectValue(Pair.Value), TEXT("id"), Id) || !Id.Equals(*Pair.Key, ESearchCase::CaseSensitive) || SeenArenas.Contains(FName(*Id))) return Fail(TEXT("Invalid or duplicate arena ID."));
        SeenArenas.Add(FName(*Id));
    }
    for (const auto& Pair : Dungeons->Values)
    {
        FString Id, Arena;
        const FObject Dungeon = ObjectValue(Pair.Value);
        if (!IdField(Dungeon, TEXT("id"), Id) || !Id.Equals(*Pair.Key, ESearchCase::CaseSensitive) || SeenDungeons.Contains(FName(*Id)) ||
            !IdField(Dungeon, TEXT("arena"), Arena) || !Arenas->HasField(Arena)) return Fail(TEXT("Invalid dungeon ID or arena reference."));
        SeenDungeons.Add(FName(*Id));
    }

    TArray<FHWQuestDefinition> Parsed;
    for (const FValue& Value : *Rows)
    {
        const FObject Row = ObjectValue(Value);
        const FObject Source = ObjectValue(Field(Row, TEXT("source")));
        const FObject Route = ObjectValue(Field(Row, TEXT("route")));
        FString Id, SourceId, Name, ChapterId, ArenaId, DungeonId, ClaimFlag, Mode;
        FHWQuestDefinition Quest;
        if (!IdField(Row, TEXT("id"), Id) || SeenQuests.Contains(FName(*Id)) ||
            !IdField(Source, TEXT("id"), SourceId) || SourceId != Id || !StringField(Source, TEXT("name"), Name) ||
            !IntegerValue(Field(Source, TEXT("recLv")), Quest.RecommendedLevel) || Quest.RecommendedLevel == 0 ||
            !IntegerValue(Field(Source, TEXT("recCp")), Quest.RecommendedCombatPower) ||
            !IdField(Route, TEXT("chapterId"), ChapterId) || !IdField(Route, TEXT("arenaId"), ArenaId) ||
            !IdField(Route, TEXT("dungeonId"), DungeonId) || !IdField(Route, TEXT("claimFlag"), ClaimFlag) ||
            ClaimFlag != TEXT("claim_") + Id || !StringField(Route, TEXT("prerequisiteMode"), Mode) || Mode != TEXT("all"))
            return Fail(TEXT("Invalid quest identity, display fields or route."));
        const FObject* Chapter = ChapterById.Find(ChapterId);
        const FObject Dungeon = ObjectValue(Field(Dungeons, *DungeonId));
        FString ChapterQuest, ChapterArena, DungeonArena;
        if (!Chapter || !StringField(*Chapter, TEXT("quest"), ChapterQuest) || ChapterQuest != Id ||
            !StringField(*Chapter, TEXT("arena"), ChapterArena) || ChapterArena != ArenaId ||
            !Arenas->HasField(ArenaId) || !StringField(Dungeon, TEXT("arena"), DungeonArena) || DungeonArena != ArenaId)
            return Fail(TEXT("Quest chapter/dungeon/arena references disagree."));
        const TArray<FValue>* Prerequisites = ArrayValue(Field(Route, TEXT("prerequisiteArenaIds")));
        const TArray<FValue>* Priority = ArrayValue(Field(Route, TEXT("statePriority")));
        const TArray<FValue>* Rewards = ArrayValue(Field(Row, TEXT("claimRewards")));
        const TArray<FValue>* SourceRewards = ArrayValue(Field(Source, TEXT("rewards")));
        if (!Prerequisites || !Priority || Priority->Num() != 4 || !Rewards || !SourceRewards || Rewards->Num() != SourceRewards->Num() + 1)
            return Fail(TEXT("Missing or invalid prerequisite/reward arrays."));
        const TCHAR* ExpectedPriority[] = {TEXT("claimed"), TEXT("cleared"), TEXT("prerequisites"), TEXT("available")};
        for (int32 Index = 0; Index < 4; ++Index)
        {
            FString State;
            if (!StringValue((*Priority)[Index], State) || State != ExpectedPriority[Index]) return Fail(TEXT("Unsupported quest state priority."));
        }
        for (const FValue& Prerequisite : *Prerequisites)
        {
            FString RequiredId;
            if (!StringValue(Prerequisite, RequiredId) || !IsId(RequiredId) || !Arenas->HasField(RequiredId) || RequiredId == ArenaId ||
                Quest.PrerequisiteArenaIds.Contains(FName(*RequiredId))) return Fail(TEXT("Invalid or duplicate prerequisite arena."));
            Quest.PrerequisiteArenaIds.Add(FName(*RequiredId));
        }
        TSet<FName> SeenRewards;
        for (int32 Index = 0; Index < Rewards->Num(); ++Index)
        {
            const FObject Reward = ObjectValue((*Rewards)[Index]);
            FHWQuestClaimReward Typed;
            FString RewardId, Kind, ExpectedId;
            int32 ExpectedMin = 0, ExpectedMax = 0;
            if (!IdField(Reward, TEXT("id"), RewardId) || SeenRewards.Contains(FName(*RewardId)) ||
                !StringField(Reward, TEXT("kind"), Kind) || !IntegerValue(Field(Reward, TEXT("min")), Typed.Min) ||
                !IntegerValue(Field(Reward, TEXT("max")), Typed.Max) || Typed.Max < Typed.Min) return Fail(TEXT("Invalid quest reward."));
            if (Index == 0)
            {
                ExpectedId = TEXT("gold");
                if (!Quantity(Field(Source, TEXT("reward")), ExpectedMin, ExpectedMax)) return Fail(TEXT("Invalid source gold reward."));
            }
            else
            {
                const TArray<FValue>* Pair = ArrayValue((*SourceRewards)[Index - 1]);
                if (!Pair || Pair->Num() != 2 || !StringValue((*Pair)[0], ExpectedId) || !Quantity((*Pair)[1], ExpectedMin, ExpectedMax))
                    return Fail(TEXT("Invalid source reward pair."));
            }
            if (RewardId != ExpectedId || Typed.Min != ExpectedMin || Typed.Max != ExpectedMax) return Fail(TEXT("Claim rewards differ from source values."));
            if (Kind == TEXT("currency") && RewardId == TEXT("gold")) Typed.Kind = EHWClaimRewardKind::Currency;
            else if (Kind == TEXT("experience") && RewardId == TEXT("exp")) Typed.Kind = EHWClaimRewardKind::Experience;
            else if (Kind == TEXT("item") && ItemIds.Contains(RewardId)) Typed.Kind = EHWClaimRewardKind::Item;
            else return Fail(TEXT("Unknown reward kind or item reference."));
            Typed.Id = FName(*RewardId);
            SeenRewards.Add(Typed.Id);
            Quest.ClaimRewards.Add(Typed);
        }
        Quest.Id = FName(*Id); Quest.DisplayName = FText::FromString(Name);
        Quest.ChapterId = FName(*ChapterId); Quest.ArenaId = FName(*ArenaId);
        Quest.DungeonId = FName(*DungeonId); Quest.ClaimFlag = FName(*ClaimFlag);
        SeenQuests.Add(Quest.Id);
        Parsed.Add(MoveTemp(Quest));
    }
    OutQuests = MoveTemp(Parsed);
    return true;
}
