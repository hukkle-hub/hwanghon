#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/AutomationTest.h"
#include "Kismet/GameplayStatics.h"
#include "Progression/HWSaveGame.h"
#include "Serialization/MemoryReader.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWClearLedgerTest, "Hwanghon.Progression.ClearLedger",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWClearLedgerTest::RunTest(const FString& Parameters)
{
    UHWSaveGame* Save = NewObject<UHWSaveGame>();
    const FGuid Run = FGuid::NewGuid();
    const FName Encounter(TEXT("Seohan_Combat_VS01"));
    TestTrue(TEXT("New profile valid"), Save->IsValidProfile());
    TestFalse(TEXT("Empty run rejected"), Save->RecordClear(FGuid(), Encounter));
    TestFalse(TEXT("Empty encounter rejected"), Save->RecordClear(Run, NAME_None));
    TestTrue(TEXT("First victory accepted"), Save->RecordClear(Run, Encounter));
    TestTrue(TEXT("Same receipt is idempotent"), Save->RecordClear(Run, Encounter));
    TestEqual(TEXT("One run counts once"), Save->GetClearCount(Encounter), 1);
    TestFalse(TEXT("Run ID cannot move to another encounter"), Save->RecordClear(Run, TEXT("Other")));
    TestTrue(TEXT("Replay counts separately"), Save->RecordClear(FGuid::NewGuid(), Encounter));
    TestEqual(TEXT("Two distinct runs"), Save->GetClearCount(Encounter), 2);
    TestEqual(TEXT("Unplayed encounter stays empty"), Save->GetClearCount(TEXT("Other")), 0);

    UHWSaveGame* Candidate = DuplicateObject<UHWSaveGame>(Save, GetTransientPackage());
    Candidate->RecordClear(FGuid::NewGuid(), Encounter);
    TestEqual(TEXT("Unsaved candidate cannot change committed state"), Save->GetClearCount(Encounter), 2);
    TestEqual(TEXT("Pending candidate retains victory"), Candidate->GetClearCount(Encounter), 3);
    const FHWClearReceipt DuplicateReceipt = Candidate->Clears[0];
    Candidate->Clears.Add(DuplicateReceipt);
    TestFalse(TEXT("Duplicate saved receipts rejected"), Candidate->IsValidProfile());
    Save->Version = UHWSaveGame::CurrentVersion + 1;
    TestFalse(TEXT("Future schema cannot be overwritten"), Save->RecordClear(FGuid::NewGuid(), Encounter));
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWProfileSaveRoundTripTest, "Hwanghon.Progression.SaveRoundTrip",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWProfileSaveRoundTripTest::RunTest(const FString& Parameters)
{
    const FString Slot = TEXT("Hwanghon_Automation_") + FGuid::NewGuid().ToString(EGuidFormats::Digits);
    UHWSaveGame* Save = NewObject<UHWSaveGame>();
    const FGuid Run = FGuid::NewGuid();
    const FName Encounter(TEXT("Seohan_Combat_VS01"));
    Save->RecordClear(Run, Encounter);
    const bool bSaved = UGameplayStatics::SaveGameToSlot(Save, Slot, 0);
    TestTrue(TEXT("Save to isolated test slot succeeds"), bSaved);
    if (bSaved)
    {
        UHWSaveGame* Loaded = Cast<UHWSaveGame>(UGameplayStatics::LoadGameFromSlot(Slot, 0));
        if (TestNotNull(TEXT("Reload has expected save type"), Loaded))
        {
            TestTrue(TEXT("Reload validates"), Loaded->IsValidProfile());
            TestEqual(TEXT("Clear persists after reload"), Loaded->GetClearCount(Encounter), 1);
            TestTrue(TEXT("Same run retry after reload accepted"), Loaded->RecordClear(Run, Encounter));
            TestEqual(TEXT("Reload does not lose deduplication"), Loaded->GetClearCount(Encounter), 1);
        }
        TestTrue(TEXT("Only temporary test slot deleted"), UGameplayStatics::DeleteGameInSlot(Slot, 0));
    }
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWTruncatedProfileTest, "Hwanghon.Progression.TruncatedProfileRejected",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWTruncatedProfileTest::RunTest(const FString& Parameters)
{
    UHWSaveGame* Save = NewObject<UHWSaveGame>();
    const FName Encounter(TEXT("Seohan_Combat_VS01"));
    Save->RecordClear(FGuid::NewGuid(), Encounter);
    TArray<uint8> Bytes;
    if (!TestTrue(TEXT("Serialize valid profile"), UGameplayStatics::SaveGameToMemory(Save, Bytes)))
    {
        return false;
    }

    FMemoryReader HeaderReader = UGameplayStatics::StripSaveGameHeader(Bytes);
    const int32 PayloadStart = static_cast<int32>(HeaderReader.Tell());
    if (!TestTrue(TEXT("Serialized profile contains a payload"), PayloadStart > 0 && PayloadStart + 2 < Bytes.Num()))
    {
        return false;
    }

    // Preserve the class header, so the engine can still construct UHWSaveGame.
    // Without the archive-error guard, constructor defaults can look like a valid empty save.
    const int32 TruncatedSizes[] = { PayloadStart, PayloadStart + 2, Bytes.Num() - 1 };
    for (const int32 TruncatedSize : TruncatedSizes)
    {
        TArray<uint8> Truncated = Bytes;
        Truncated.SetNum(TruncatedSize);
        UHWSaveGame* Loaded = Cast<UHWSaveGame>(UGameplayStatics::LoadGameFromMemory(Truncated));
        TestTrue(FString::Printf(TEXT("Truncated payload (%d bytes) cannot validate"), TruncatedSize),
            !Loaded || !Loaded->IsValidProfile());
        if (Loaded)
        {
            TestFalse(TEXT("Cannot append victory to a partial load"), Loaded->RecordClear(FGuid::NewGuid(), Encounter));
        }
    }

    UHWSaveGame* Loaded = Cast<UHWSaveGame>(UGameplayStatics::LoadGameFromMemory(Bytes));
    if (TestNotNull(TEXT("Complete payload loads"), Loaded))
    {
        TestTrue(TEXT("Complete payload remains valid"), Loaded->IsValidProfile());
        UHWSaveGame* Candidate = DuplicateObject<UHWSaveGame>(Loaded, GetTransientPackage());
        TestTrue(TEXT("Valid profile duplication stays valid"), Candidate->IsValidProfile());
        TestTrue(TEXT("Duplicate can accept next run"), Candidate->RecordClear(FGuid::NewGuid(), Encounter));
        TestEqual(TEXT("Original remains unchanged"), Loaded->GetClearCount(Encounter), 1);
    }
    return true;
}

#endif
