#include "UI/HWUICatalog.h"

#include "Dom/JsonObject.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "UI/HWUIKit.h"

namespace
{
    using FObj = TSharedPtr<FJsonObject>;
    using FArr = TArray<TSharedPtr<FJsonValue>>;

    FString Str(const FObj& O, const TCHAR* Key)
    {
        FString V;
        if (O.IsValid() && O->TryGetStringField(Key, V))
        {
            return HWUI::Strip(V);
        }
        return FString();
    }

    double Number(const FObj& O, const TCHAR* Key, double Default = 0.0)
    {
        double V = Default;
        return O.IsValid() && O->TryGetNumberField(Key, V) ? V : Default;
    }

    FString NumberText(double V)
    {
        return FMath::IsNearlyEqual(V, FMath::RoundToDouble(V))
            ? FText::AsNumber(static_cast<int64>(FMath::RoundToDouble(V))).ToString()
            : FString::SanitizeFloat(V, 1);
    }

    FString StatLabel(const FString& Key)
    {
        static const TMap<FString, FString> Labels = {
            { TEXT("hp"), TEXT("체력") }, { TEXT("atk"), TEXT("공격력") }, { TEXT("atkEx"), TEXT("추가 공격력") },
            { TEXT("def"), TEXT("방어력") }, { TEXT("crit"), TEXT("치명타 %") }, { TEXT("critDmg"), TEXT("치명 피해 %") },
            { TEXT("aspd"), TEXT("공격 속도") }, { TEXT("mspd"), TEXT("이동 속도") }, { TEXT("skill"), TEXT("스킬 피해 %") },
            { TEXT("bleed"), TEXT("출혈 %") },
        };
        const FString* Found = Labels.Find(Key);
        return Found ? *Found : Key;
    }

    TArray<FHWUIStat> Stats(const FObj& O, const TCHAR* Key, const TArray<FString>& Order)
    {
        TArray<FHWUIStat> Out;
        const FObj* StatsObj = nullptr;
        if (!O.IsValid() || !O->TryGetObjectField(Key, StatsObj))
        {
            return Out;
        }
        TArray<FString> Keys = Order;
        for (const auto& Pair : (*StatsObj)->Values)
        {
            Keys.AddUnique(FString(*Pair.Key));
        }
        for (const FString& K : Keys)
        {
            double V = 0.0;
            if ((*StatsObj)->TryGetNumberField(K, V))
            {
                Out.Add({ StatLabel(K), NumberText(V) });
            }
        }
        return Out;
    }

    TArray<TPair<FName, int32>> Pairs(const FObj& O, const TCHAR* Key)
    {
        TArray<TPair<FName, int32>> Out;
        const FArr* List = nullptr;
        if (O.IsValid() && O->TryGetArrayField(Key, List))
        {
            for (const TSharedPtr<FJsonValue>& V : *List)
            {
                const FArr* Pair = nullptr;
                if (V->TryGetArray(Pair) && Pair->Num() >= 2)
                {
                    Out.Emplace(FName(*(*Pair)[0]->AsString()), static_cast<int32>((*Pair)[1]->AsNumber()));
                }
            }
        }
        return Out;
    }

    void Lines(const FObj& O, const TCHAR* Key, TArray<FHWUIStoryLine>& Out)
    {
        const FArr* List = nullptr;
        if (O.IsValid() && O->TryGetArrayField(Key, List))
        {
            for (const TSharedPtr<FJsonValue>& V : *List)
            {
                const FArr* Pair = nullptr;
                if (V->TryGetArray(Pair) && Pair->Num() >= 2)
                {
                    Out.Add({ FName(*(*Pair)[0]->AsString()), HWUI::Strip((*Pair)[1]->AsString()) });
                }
            }
        }
    }

    FString ArtName(const FString& Path)
    {
        return FPaths::GetBaseFilename(Path);
    }
}

const FHWUICatalog& FHWUICatalog::Get()
{
    static FHWUICatalog Catalog;
    if (!Catalog.bLoaded && Catalog.Error.IsEmpty())
    {
        Catalog.Load();
    }
    return Catalog;
}

void FHWUICatalog::Load()
{
    FString Json;
    const FString File = FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Data/game_content.json"));
    if (!FFileHelper::LoadFileToString(Json, *File))
    {
        Error = TEXT("Content/Data/game_content.json 을 읽지 못했다.");
        return;
    }
    FObj Root;
    if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Json), Root) || !Root.IsValid())
    {
        Error = TEXT("game_content.json 파싱 실패.");
        return;
    }

    // Characters, in party order.
    const FObj* CharObj = nullptr;
    if (Root->TryGetObjectField(TEXT("characters"), CharObj))
    {
        TArray<FString> Order;
        Root->TryGetStringArrayField(TEXT("partyOrder"), Order);
        for (const auto& Pair : (*CharObj)->Values)
        {
            Order.AddUnique(FString(*Pair.Key));
        }
        for (const FString& Id : Order)
        {
            const FObj* C = nullptr;
            if (!(*CharObj)->TryGetObjectField(Id, C))
            {
                continue;
            }
            FHWUICharacter Ch;
            Ch.Id = FName(*Id);
            Ch.Name = Str(*C, TEXT("nm"));
            Ch.En = Str(*C, TEXT("en"));
            Ch.Class = Str(*C, TEXT("cls"));
            Ch.Role = Str(*C, TEXT("role"));
            Ch.Sub = Str(*C, TEXT("sub"));
            Ch.Weapon = Str(*C, TEXT("wp"));
            Ch.Title = Str(*C, TEXT("tt"));
            Ch.Quote = Str(*C, TEXT("quote"));
            Ch.Look = Str(*C, TEXT("look"));
            Ch.Level = static_cast<int32>(Number(*C, TEXT("lv")));
            Ch.CombatPower = static_cast<int32>(Number(*C, TEXT("cp")));
            Ch.Stats = Stats(*C, TEXT("stats"), { TEXT("hp"), TEXT("atk"), TEXT("def"), TEXT("crit"), TEXT("critDmg"), TEXT("aspd"), TEXT("mspd") });
            const FArr* Traits = nullptr;
            if ((*C)->TryGetArrayField(TEXT("traits"), Traits))
            {
                for (const TSharedPtr<FJsonValue>& T : *Traits)
                {
                    const FArr* Parts = nullptr;
                    if (T->TryGetArray(Parts) && Parts->Num() >= 3)
                    {
                        Ch.Traits.Add({ (*Parts)[1]->AsString(), HWUI::Strip((*Parts)[2]->AsString()) });
                    }
                }
            }
            TArray<FString> Hex;
            if ((*C)->TryGetStringArrayField(TEXT("sw"), Hex))
            {
                for (const FString& H : Hex)
                {
                    Ch.Swatches.Add(FLinearColor(FColor::FromHex(H)));
                }
            }
            Characters.Add(MoveTemp(Ch));
        }
    }

    const FObj* ItemsObj = nullptr;
    if (Root->TryGetObjectField(TEXT("items"), ItemsObj))
    {
        const FArr* Catalog = nullptr;
        if ((*ItemsObj)->TryGetArrayField(TEXT("catalog"), Catalog))
        {
            for (const TSharedPtr<FJsonValue>& V : *Catalog)
            {
                const FObj I = V->AsObject();
                FHWUIItem It;
                It.Id = FName(*Str(I, TEXT("id")));
                It.Name = Str(I, TEXT("name"));
                It.Kind = Str(I, TEXT("kind"));
                It.Type = Str(I, TEXT("type"));
                It.Rarity = Str(I, TEXT("rarity"));
                It.Slot = Str(I, TEXT("slot"));
                It.Effect = Str(I, TEXT("effect"));
                It.Flavor = Str(I, TEXT("flavor"));
                It.Origin = Str(I, TEXT("origin"));
                It.Bind = Str(I, TEXT("bind"));
                It.CombatPower = static_cast<int32>(Number(I, TEXT("cp")));
                It.Price = static_cast<int32>(Number(I, TEXT("price")));
                It.RequiredLevel = static_cast<int32>(Number(I, TEXT("reqLv")));
                It.Enhance = static_cast<int32>(Number(I, TEXT("enh")));
                It.EnhanceMax = static_cast<int32>(Number(I, TEXT("enhMax")));
                It.Stats = Stats(I, TEXT("stats"), { TEXT("atk"), TEXT("atkEx"), TEXT("def"), TEXT("hp"), TEXT("crit"), TEXT("critDmg"), TEXT("skill") });
                Items.Add(MoveTemp(It));
            }
        }
        const FArr* ShopArr = nullptr;
        if ((*ItemsObj)->TryGetArrayField(TEXT("shop"), ShopArr))
        {
            for (const TSharedPtr<FJsonValue>& V : *ShopArr)
            {
                const FObj S = V->AsObject();
                FHWUIShopRow Row;
                Row.ItemId = FName(*Str(S, TEXT("id")));
                Row.Buy = static_cast<int32>(Number(S, TEXT("buy"), -1.0));
                Row.Sell = static_cast<int32>(Number(S, TEXT("sell")));
                Row.Tag = Str(S, TEXT("tag"));
                Shop.Add(Row);
            }
        }
        const FArr* RecipeArr = nullptr;
        if ((*ItemsObj)->TryGetArrayField(TEXT("recipes"), RecipeArr))
        {
            for (const TSharedPtr<FJsonValue>& V : *RecipeArr)
            {
                const FObj R = V->AsObject();
                FHWUIRecipe Rec;
                Rec.Id = FName(*Str(R, TEXT("id")));
                Rec.Result = FName(*Str(R, TEXT("result")));
                Rec.Category = Str(R, TEXT("cat"));
                Rec.Time = Str(R, TEXT("time"));
                Rec.Cost = static_cast<int32>(Number(R, TEXT("cost")));
                Rec.CraftLevel = static_cast<int32>(Number(R, TEXT("craftLv")));
                Rec.Materials = Pairs(R, TEXT("mats"));
                Recipes.Add(MoveTemp(Rec));
            }
        }
        const FArr* EnhArr = nullptr;
        if ((*ItemsObj)->TryGetArrayField(TEXT("enhancement"), EnhArr))
        {
            for (const TSharedPtr<FJsonValue>& V : *EnhArr)
            {
                const FObj E = V->AsObject();
                FHWUIEnhanceStep Step;
                Step.To = static_cast<int32>(Number(E, TEXT("to")));
                Step.Cost = static_cast<int32>(Number(E, TEXT("cost")));
                Step.Rate = static_cast<int32>(Number(E, TEXT("rate")));
                Step.Materials = Pairs(E, TEXT("mats"));
                Enhancement.Add(MoveTemp(Step));
            }
        }
        const FObj* RarityObj = nullptr;
        if ((*ItemsObj)->TryGetObjectField(TEXT("rarity"), RarityObj))
        {
            for (const auto& Pair : (*RarityObj)->Values)
            {
                const FObj R = Pair.Value->AsObject();
                Rarity.Add(FString(*Pair.Key), { Str(R, TEXT("name")), FLinearColor(FColor::FromHex(Str(R, TEXT("color")))) });
            }
        }
        for (const TCHAR* Key : { TEXT("types"), TEXT("slots") })
        {
            const FObj* Names = nullptr;
            if ((*ItemsObj)->TryGetObjectField(Key, Names))
            {
                TMap<FString, FString>& Target = FCString::Strcmp(Key, TEXT("types")) == 0 ? TypeNames : SlotNames;
                for (const auto& Pair : (*Names)->Values)
                {
                    Target.Add(FString(*Pair.Key), Pair.Value->AsString());
                }
            }
        }
    }

    const FObj* SkillObj = nullptr;
    if (Root->TryGetObjectField(TEXT("skills"), SkillObj))
    {
        for (const auto& Pair : (*SkillObj)->Values)
        {
            TArray<FHWUISkill>& List = Skills.FindOrAdd(FName(*Pair.Key));
            const FArr* Arr = nullptr;
            if (Pair.Value->TryGetArray(Arr))
            {
                for (const TSharedPtr<FJsonValue>& V : *Arr)
                {
                    const FObj S = V->AsObject();
                    FHWUISkill Sk;
                    Sk.Id = FName(*Str(S, TEXT("id")));
                    Sk.Name = Str(S, TEXT("name"));
                    Sk.Desc = Str(S, TEXT("desc"));
                    Sk.Key = Str(S, TEXT("key"));
                    Sk.Cooldown = static_cast<float>(Number(S, TEXT("cd")));
                    Sk.Stamina = static_cast<float>(Number(S, TEXT("st")));
                    List.Add(MoveTemp(Sk));
                }
            }
        }
    }

    const FObj* StoryObj = nullptr;
    if (Root->TryGetObjectField(TEXT("story"), StoryObj))
    {
        const FObj* NpcObj = nullptr;
        if ((*StoryObj)->TryGetObjectField(TEXT("npcs"), NpcObj))
        {
            for (const auto& Pair : (*NpcObj)->Values)
            {
                const FObj N = Pair.Value->AsObject();
                Npcs.Add(FName(*Pair.Key), { FName(*Pair.Key), Str(N, TEXT("nm")), Str(N, TEXT("sub")), ArtName(Str(N, TEXT("face"))) });
            }
        }
        const FArr* ChapterArr = nullptr;
        if ((*StoryObj)->TryGetArrayField(TEXT("chapters"), ChapterArr))
        {
            for (const TSharedPtr<FJsonValue>& V : *ChapterArr)
            {
                const FObj Ch = V->AsObject();
                FHWUIChapter Chapter;
                Chapter.Id = FName(*Str(Ch, TEXT("id")));
                Chapter.Name = Str(Ch, TEXT("name"));
                Chapter.Title = Str(Ch, TEXT("title"));
                Chapter.Art = Str(Ch, TEXT("art"));
                Lines(Ch, TEXT("lines"), Chapter.Lines);
                Lines(Ch, TEXT("brief"), Chapter.Lines);
                Lines(Ch, TEXT("after"), Chapter.Lines);
                Chapters.Add(MoveTemp(Chapter));
            }
        }
    }

    const FArr* QuestArr = nullptr;
    if (Root->TryGetArrayField(TEXT("quests"), QuestArr))
    {
        for (const TSharedPtr<FJsonValue>& V : *QuestArr)
        {
            const FObj Q = V->AsObject();
            const FObj* Src = nullptr;
            if (!Q.IsValid() || !Q->TryGetObjectField(TEXT("source"), Src))
            {
                continue;
            }
            FHWUIQuestText T;
            T.Id = FName(*Str(Q, TEXT("id")));
            T.Area = Str(*Src, TEXT("area"));
            T.Risk = Str(*Src, TEXT("risk"));
            T.Goal = Str(*Src, TEXT("goal"));
            T.Desc = Str(*Src, TEXT("desc"));
            T.Note = Str(*Src, TEXT("note"));
            T.BossArt = Str(*Src, TEXT("art"));
            T.Level = static_cast<int32>(Number(*Src, TEXT("lv")));
            const FObj* Obj = nullptr;
            if ((*Src)->TryGetObjectField(TEXT("objectives"), Obj))
            {
                (*Obj)->TryGetStringArrayField(TEXT("must"), T.Must);
                const FArr* Opt = nullptr;
                if ((*Obj)->TryGetArrayField(TEXT("optional"), Opt))
                {
                    for (const TSharedPtr<FJsonValue>& O : *Opt)
                    {
                        const FArr* Parts = nullptr;
                        if (O->TryGetArray(Parts) && Parts->Num() >= 1)
                        {
                            T.Optional.Add((*Parts)[0]->AsString());
                        }
                    }
                }
            }
            QuestText.Add(T.Id, MoveTemp(T));
        }
    }

    bLoaded = true;
}

const FHWUICharacter* FHWUICatalog::FindCharacter(FName Id) const
{
    return Characters.FindByPredicate([Id](const FHWUICharacter& C) { return C.Id == Id; });
}

const FHWUIItem* FHWUICatalog::FindItem(FName Id) const
{
    return Items.FindByPredicate([Id](const FHWUIItem& I) { return I.Id == Id; });
}

FString FHWUICatalog::ItemName(FName Id) const
{
    const FHWUIItem* Item = FindItem(Id);
    return Item ? Item->Name : Id.ToString();
}

FLinearColor FHWUICatalog::RarityColor(const FString& RarityId) const
{
    const FHWUIRarity* R = Rarity.Find(RarityId);
    return R ? R->Color : HWUI::C(EHWUIColorToken::TextMuted);
}

FString FHWUICatalog::RarityName(const FString& RarityId) const
{
    const FHWUIRarity* R = Rarity.Find(RarityId);
    return R ? R->Name : RarityId;
}
