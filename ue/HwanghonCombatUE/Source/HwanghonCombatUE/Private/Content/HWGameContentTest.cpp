#if WITH_DEV_AUTOMATION_TESTS

#include "Content/HWGameContentSubsystem.h"
#include "Engine/GameInstance.h"
#include "Misc/AutomationTest.h"

namespace
{
    const FString Fixture = TEXT(R"JSON({
      "schema":"hwanghon.game-content/1",
      "arenas":{"tutorial":{"id":"tutorial"},"marsh":{"id":"marsh"}},
      "dungeons":{"d02":{"id":"d02","arena":"marsh"}},
      "items":{"catalog":[{"id":"m_core"}]},
      "story":{"chapters":[{"id":"ch2","quest":"q_marsh","arena":"marsh"}]},
      "quests":[{
        "id":"q_marsh",
        "source":{"id":"q_marsh","name":"Marsh quest","recLv":26,"recCp":22000,"reward":18000,"rewards":[["exp",4200],["m_core","1~3"]]},
        "route":{"chapterId":"ch2","arenaId":"marsh","dungeonId":"d02","claimFlag":"claim_q_marsh",
          "prerequisiteMode":"all","prerequisiteArenaIds":["tutorial"],"statePriority":["claimed","cleared","prerequisites","available"]},
        "claimRewards":[{"id":"gold","kind":"currency","min":18000,"max":18000},
          {"id":"exp","kind":"experience","min":4200,"max":4200},{"id":"m_core","kind":"item","min":1,"max":3}]
      }]
    })JSON");
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWQuestCatalogParseTest, "Hwanghon.Content.QuestCatalogParse",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWQuestCatalogParseTest::RunTest(const FString& Parameters)
{
    TArray<FHWQuestDefinition> Quests;
    FString Error;
    if (TestTrue(TEXT("Valid static fixture parses"), UHWGameContentSubsystem::ParseQuestCatalog(Fixture, Quests, Error)))
    {
        TestTrue(TEXT("Successful parse clears errors"), Error.IsEmpty());
        TestEqual(TEXT("One typed quest"), Quests.Num(), 1);
        TestEqual(TEXT("Stable ID retained"), Quests[0].Id, FName(TEXT("q_marsh")));
        TestEqual(TEXT("Display name retained"), Quests[0].DisplayName.ToString(), FString(TEXT("Marsh quest")));
        TestEqual(TEXT("Prerequisite retained"), Quests[0].PrerequisiteArenaIds[0], FName(TEXT("tutorial")));
        TestEqual(TEXT("Three separate typed rewards"), Quests[0].ClaimRewards.Num(), 3);
        TestTrue(TEXT("Gold is currency"), Quests[0].ClaimRewards[0].Kind == EHWClaimRewardKind::Currency);
        TestTrue(TEXT("XP is experience"), Quests[0].ClaimRewards[1].Kind == EHWClaimRewardKind::Experience);
        TestEqual(TEXT("Inclusive item minimum"), Quests[0].ClaimRewards[2].Min, 1);
        TestEqual(TEXT("Inclusive item maximum"), Quests[0].ClaimRewards[2].Max, 3);
    }
    const auto Reject = [this, &Quests, &Error](const TCHAR* Label, const FString& Json)
    {
        Quests.AddDefaulted(); // A failing parse must discard previous/partial DTOs.
        TestFalse(Label, UHWGameContentSubsystem::ParseQuestCatalog(Json, Quests, Error));
        TestTrue(TEXT("No partial catalog after failure"), Quests.IsEmpty());
        TestFalse(TEXT("Failure explains why"), Error.IsEmpty());
    };
    Reject(TEXT("Malformed JSON"), TEXT("{"));
    Reject(TEXT("Missing schema"), Fixture.Replace(TEXT("\"schema\""), TEXT("\"absentSchema\"")));
    Reject(TEXT("Future schema"), Fixture.Replace(TEXT("game-content/1"), TEXT("game-content/2")));
    Reject(TEXT("Missing quest name"), Fixture.Replace(TEXT("\"name\""), TEXT("\"absentName\"")));
    Reject(TEXT("Non-string quest name"), Fixture.Replace(TEXT("\"Marsh quest\""), TEXT("123")));
    Reject(TEXT("Negative level"), Fixture.Replace(TEXT("\"recLv\":26"), TEXT("\"recLv\":-1")));
    Reject(TEXT("Fractional level"), Fixture.Replace(TEXT("\"recLv\":26"), TEXT("\"recLv\":26.5")));
    Reject(TEXT("Unknown chapter"), Fixture.Replace(TEXT("\"chapterId\":\"ch2\""), TEXT("\"chapterId\":\"ch99\"")));
    Reject(TEXT("Unknown dungeon"), Fixture.Replace(TEXT("\"dungeonId\":\"d02\""), TEXT("\"dungeonId\":\"d99\"")));
    Reject(TEXT("Chapter arena mismatch"), Fixture.Replace(TEXT("\"quest\":\"q_marsh\",\"arena\":\"marsh\""), TEXT("\"quest\":\"q_marsh\",\"arena\":\"tutorial\"")));
    Reject(TEXT("Unknown prerequisite"), Fixture.Replace(TEXT("\"prerequisiteArenaIds\":[\"tutorial\"]"), TEXT("\"prerequisiteArenaIds\":[\"missing\"]")));
    Reject(TEXT("Self prerequisite"), Fixture.Replace(TEXT("\"prerequisiteArenaIds\":[\"tutorial\"]"), TEXT("\"prerequisiteArenaIds\":[\"marsh\"]")));
    Reject(TEXT("Duplicate prerequisite"), Fixture.Replace(TEXT("\"prerequisiteArenaIds\":[\"tutorial\"]"), TEXT("\"prerequisiteArenaIds\":[\"tutorial\",\"tutorial\"]")));
    Reject(TEXT("Unsupported prerequisite operator"), Fixture.Replace(TEXT("\"all\""), TEXT("\"any\"")));
    Reject(TEXT("Unexpected claim flag"), Fixture.Replace(TEXT("claim_q_marsh"), TEXT("claim_wrong")));
    Reject(TEXT("Wrong reward kind"), Fixture.Replace(TEXT("\"kind\":\"item\""), TEXT("\"kind\":\"currency\"")));
    Reject(TEXT("Missing item definition"), Fixture.Replace(TEXT("\"catalog\":[{\"id\":\"m_core\"}]"), TEXT("\"catalog\":[]")));
    Reject(TEXT("Reversed reward range"), Fixture.Replace(TEXT("\"min\":1,\"max\":3"), TEXT("\"min\":4,\"max\":3")));
    Reject(TEXT("Changed payout despite valid range"), Fixture.Replace(TEXT("\"min\":1,\"max\":3"), TEXT("\"min\":1,\"max\":4")));
    Reject(TEXT("Reward overflow"), Fixture.Replace(TEXT("\"min\":1,\"max\":3"), TEXT("\"min\":1,\"max\":2147483648")));
    Reject(TEXT("Source range overflow"), Fixture.Replace(TEXT("1~3"), TEXT("1~999999999999999999999")));
    Reject(TEXT("Duplicate item ID"), Fixture.Replace(TEXT("\"catalog\":[{\"id\":\"m_core\"}]"), TEXT("\"catalog\":[{\"id\":\"m_core\"},{\"id\":\"m_core\"}]")));
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWLoadGameContentTest, "Hwanghon.Content.LoadGameContent",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWLoadGameContentTest::RunTest(const FString& Parameters)
{
    UGameInstance* Owner = NewObject<UGameInstance>();
    UHWGameContentSubsystem* Content = NewObject<UHWGameContentSubsystem>(Owner);
    TestFalse(TEXT("New subsystem has no loaded catalog"), Content->IsContentLoaded());
    if (!TestTrue(TEXT("Loads exported Content/Data/game_content.json"), Content->LoadFromProjectContent()))
    {
        AddError(Content->GetLoadError());
        return false;
    }
    TestTrue(TEXT("Content available after validation"), Content->IsContentLoaded());
    TestEqual(TEXT("All six office quests available"), Content->GetQuests().Num(), 6);
    FHWQuestDefinition Marsh;
    if (TestTrue(TEXT("Typed lookup by original quest ID"), Content->GetQuest(TEXT("q_marsh"), Marsh)))
    {
        TestEqual(TEXT("Original recommended level"), Marsh.RecommendedLevel, 26);
        TestEqual(TEXT("Original dungeon route"), Marsh.DungeonId, FName(TEXT("d02")));
        const FHWQuestClaimReward* Alloy = Marsh.ClaimRewards.FindByPredicate([](const FHWQuestClaimReward& Reward) { return Reward.Id == TEXT("m_alloy"); });
        if (TestNotNull(TEXT("Office reward present"), Alloy)) TestEqual(TEXT("Office payout remains 2100; arena payout is separate"), Alloy->Min, 2100);
    }
    FHWQuestDefinition Missing = Marsh;
    TestFalse(TEXT("Unknown quest does not resolve"), Content->GetQuest(TEXT("missing"), Missing));
    TestTrue(TEXT("Unknown lookup clears stale output"), Missing.Id.IsNone());
    TArray<FHWQuestDefinition> Copy = Content->GetQuests();
    Copy.Reset();
    TestEqual(TEXT("Caller cannot mutate catalog through a returned array"), Content->GetQuests().Num(), 6);
    return true;
}

#endif
