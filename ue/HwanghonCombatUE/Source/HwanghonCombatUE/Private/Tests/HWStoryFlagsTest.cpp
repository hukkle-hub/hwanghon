#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/AutomationTest.h"
#include "Progression/HWSaveGame.h"

// Story progress flags from the Part 1 production master (save v4, docs/design/143).
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWStoryFlagsMigrationTest,
    "Hwanghon.Progression.StoryFlags.MigrateV3",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWStoryFlagsMigrationTest::RunTest(const FString& Parameters)
{
    UHWSaveGame* Save = NewObject<UHWSaveGame>();
    Save->Version = 3;
    Save->SelectedCharacter = TEXT("kain");
    TestTrue(TEXT("v3 migrates to v4"), Save->MigrateToCurrentVersion());
    TestEqual(TEXT("reaches current version"), Save->Version, UHWSaveGame::CurrentVersion);
    TestEqual(TEXT("v3 keeps the chosen character"), Save->SelectedCharacter, FName(TEXT("kain")));
    TestTrue(TEXT("no story flags yet"), Save->StoryFlags.IsEmpty());

    UHWSaveGame* Odd = NewObject<UHWSaveGame>();
    Odd->Version = 3;
    Odd->StoryFlags.Add(TEXT("SF_EP01_COMPLETE"), TEXT("true"));
    TestFalse(TEXT("a v3 archive cannot already carry v4 flags"), Odd->MigrateToCurrentVersion());
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWStoryFlagsValidationTest,
    "Hwanghon.Progression.StoryFlags.Validation",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWStoryFlagsValidationTest::RunTest(const FString& Parameters)
{
    UHWSaveGame* Save = NewObject<UHWSaveGame>();
    Save->StoryFlags.Add(TEXT("SF_EP01_COMPLETE"), TEXT("true"));
    Save->StoryFlags.Add(TEXT("SF_Rank_Ain"), TEXT("C"));
    Save->StoryFlags.Add(TEXT("SF_CurrentEpisode"), TEXT("2"));
    TestTrue(TEXT("EP01 end flags are a valid profile"), Save->IsValidProfile());

    Save->StoryFlags.Add(TEXT("EP01_COMPLETE"), TEXT("true"));
    TestFalse(TEXT("a flag without the SF_ prefix is rejected"), Save->IsValidProfile());
    Save->StoryFlags.Remove(TEXT("EP01_COMPLETE"));

    Save->StoryFlags.Add(TEXT("SF_Rank_Kain"), TEXT(""));
    TestFalse(TEXT("an empty value is rejected"), Save->IsValidProfile());
    return true;
}

#endif
