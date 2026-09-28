#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/AutomationTest.h"
#include "Progression/HWSaveGame.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWSelectedCharacterSaveTest,
    "Hwanghon.System.CharacterSelection.SaveContract",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWSelectedCharacterSaveTest::RunTest(const FString& Parameters)
{
    UHWSaveGame* Save = NewObject<UHWSaveGame>();
    TestEqual(TEXT("New profile defaults to Ain"), Save->SelectedCharacter, FName(TEXT("ain")));
    TestTrue(TEXT("Default selected character validates"), Save->IsValidProfile());

    Save->SelectedCharacter = TEXT("kain");
    TestTrue(TEXT("Kain is a valid single selected character"), Save->IsValidProfile());
    Save->SelectedCharacter = TEXT("ryu");
    TestTrue(TEXT("Ryu is valid"), Save->IsValidProfile());
    Save->SelectedCharacter = TEXT("sera");
    TestTrue(TEXT("Sera is valid"), Save->IsValidProfile());

    Save->SelectedCharacter = TEXT("party_slot_2");
    TestFalse(TEXT("Party-slot/switching IDs are rejected"), Save->IsValidProfile());
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWSelectedCharacterMigrationTest,
    "Hwanghon.System.CharacterSelection.MigrateV2",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWSelectedCharacterMigrationTest::RunTest(const FString& Parameters)
{
    UHWSaveGame* Save = NewObject<UHWSaveGame>();
    Save->Version = 2;
    // A v2 archive had no persisted selected-character field. Even if the current
    // constructor has a different in-memory value, migration must choose Ain safely.
    Save->SelectedCharacter = TEXT("sera");
    TestTrue(TEXT("v2 migrates to current schema"), Save->MigrateToCurrentVersion());
    TestEqual(TEXT("v2 migration uses safe Ain default"), Save->SelectedCharacter, FName(TEXT("ain")));
    TestEqual(TEXT("Migration reaches current version"), Save->Version, UHWSaveGame::CurrentVersion);
    TestTrue(TEXT("Migrated profile validates"), Save->IsValidProfile());
    return true;
}

#endif
