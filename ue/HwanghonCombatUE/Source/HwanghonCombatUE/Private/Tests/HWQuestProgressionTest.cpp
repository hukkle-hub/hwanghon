#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/AutomationTest.h"
#include "Engine/GameInstance.h"
#include "Kismet/GameplayStatics.h"
#include "Progression/HWProfileSubsystem.h"
#include "Serialization/MemoryReader.h"
#include "Tests/HWQuestProfileTestObserver.h"

namespace
{
    class FHWMemoryProfileStorage final : public IHWProfileStorage
    {
    public:
        TArray<uint8> Bytes;
        TArray<uint8> LastAttempt;
        bool bExists = false;
        bool bFailSave = false;
        int32 SaveAttempts = 0;
        virtual bool Exists() const override { return bExists; }
        virtual UHWSaveGame* Load() override { return Cast<UHWSaveGame>(UGameplayStatics::LoadGameFromMemory(Bytes)); }
        virtual bool Save(UHWSaveGame* Candidate) override
        {
            ++SaveAttempts;
            // SaveGameToMemory writes from offset zero but does not shrink a
            // reused buffer. Match SaveGameToSlot's fresh local byte array.
            LastAttempt.Reset();
            if (!UGameplayStatics::SaveGameToMemory(Candidate, LastAttempt) || bFailSave) return false;
            Bytes = LastAttempt;
            bExists = true;
            return true;
        }
    };

    UHWProfileSubsystem* NewProfile()
    {
        return NewObject<UHWProfileSubsystem>(NewObject<UGameInstance>());
    }

    bool LoadCatalog(FAutomationTestBase& Test, TArray<FHWQuestDefinition>& Quests)
    {
        UHWGameContentSubsystem* Content = NewObject<UHWGameContentSubsystem>(NewObject<UGameInstance>());
        if (!Test.TestTrue(TEXT("Production quest catalog loads"), Content->LoadFromProjectContent())) return false;
        Quests = Content->GetQuests();
        return Test.TestEqual(TEXT("Six canonical office quests"), Quests.Num(), 6);
    }

    FHWQuestDefinition SyntheticQuest(FName Id, FName Arena, int32 Gold)
    {
        FHWQuestDefinition Quest;
        Quest.Id = Id;
        Quest.ArenaId = Arena;
        Quest.ClaimFlag = FName(*(TEXT("claim_") + Id.ToString()));
        FHWQuestClaimReward Reward;
        Reward.Id = TEXT("gold");
        Reward.Kind = EHWClaimRewardKind::Currency;
        Reward.Min = Reward.Max = Gold;
        Quest.ClaimRewards.Add(Reward);
        return Quest;
    }
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWQuestStateAndClaimTest, "Hwanghon.Progression.QuestStateAndClaim",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWQuestStateAndClaimTest::RunTest(const FString& Parameters)
{
    TArray<FHWQuestDefinition> Quests;
    if (!LoadCatalog(*this, Quests)) return false;
    const FHWQuestDefinition& Quest = Quests[0];
    UHWSaveGame* Save = NewObject<UHWSaveGame>();
    FRandomStream Random(91527);
    const int32 InitialSeed = Random.GetCurrentSeed();
    TestEqual(TEXT("First office quest waits for tutorial clear"), Save->GetQuestState(Quest), EHWQuestState::Locked);
    TestFalse(TEXT("Locked quest pays nothing"), Save->ClaimQuest(Quest, Random));
    TestEqual(TEXT("Rejected claim consumes no random numbers"), Random.GetCurrentSeed(), InitialSeed);
    TestTrue(TEXT("Tutorial clear recorded"), Save->RecordClear(FGuid::NewGuid(), TEXT("tutorial")));
    TestEqual(TEXT("Tutorial enables first quest without accepting it"), Save->GetQuestState(Quest), EHWQuestState::Available);
    FHWQuestDefinition RecommendedOnly = Quest;
    RecommendedOnly.RecommendedLevel = MAX_int32;
    TestEqual(TEXT("Recommended level is not a gate"), Save->GetQuestState(RecommendedOnly), EHWQuestState::Available);
    TestFalse(TEXT("Available quest is not yet claimable"), Save->ClaimQuest(Quest, Random));
    TestTrue(TEXT("Own arena cleared"), Save->RecordClear(FGuid::NewGuid(), Quest.ArenaId));
    TestEqual(TEXT("Own arena enables office payout"), Save->GetQuestState(Quest), EHWQuestState::Cleared);
    TestTrue(TEXT("First claim succeeds"), Save->ClaimQuest(Quest, Random));
    TestEqual(TEXT("One receipt"), Save->Claims.Num(), 1);
    TestTrue(TEXT("Claim validates against canonical office rewards"), Save->ValidateAgainstCatalog(Quests));
    TestEqual(TEXT("Claimed state"), Save->GetQuestState(Quest), EHWQuestState::Claimed);
    int64 ExpectedGold = 0, ExpectedExperience = 0;
    for (const FHWQuestClaimReward& Reward : Quest.ClaimRewards)
    {
        const FHWResolvedClaimReward* Resolved = Save->Claims[0].Rewards.FindByPredicate(
            [&Reward](const FHWResolvedClaimReward& Row) { return Row.Id == Reward.Id; });
        if (!TestNotNull(TEXT("Every office reward has a receipt"), Resolved)) return false;
        TestTrue(TEXT("Inclusive reward bounds"), Resolved->Amount >= Reward.Min && Resolved->Amount <= Reward.Max);
        if (Reward.Kind == EHWClaimRewardKind::Currency) ExpectedGold += Resolved->Amount;
        else if (Reward.Kind == EHWClaimRewardKind::Experience) ExpectedExperience += Resolved->Amount;
        else TestEqual(TEXT("Inventory matches receipt"), Save->Inventory.FindRef(Reward.Id), Resolved->Amount);
    }
    TestEqual(TEXT("Gold only from office receipt"), Save->Gold, ExpectedGold);
    TestEqual(TEXT("XP only from office receipt, without level conversion"), Save->Experience, ExpectedExperience);
    TestEqual(TEXT("Canonical marsh alloy payout remains 2100, not arena 24"), Save->Inventory.FindRef(TEXT("m_alloy")), static_cast<int64>(2100));
    const int32 ClaimedSeed = Random.GetCurrentSeed();
    TestFalse(TEXT("Second claim rejected"), Save->ClaimQuest(Quest, Random));
    TestEqual(TEXT("Repeated claim cannot reroll"), Random.GetCurrentSeed(), ClaimedSeed);
    TestTrue(TEXT("Claimed arena may be replayed"), Save->RecordClear(FGuid::NewGuid(), Quest.ArenaId));
    TestEqual(TEXT("Replay counted separately"), Save->GetClearCount(Quest.ArenaId), 2);
    TestEqual(TEXT("Replay does not pay again"), Save->Gold, ExpectedGold);
    TestEqual(TEXT("Claim stays one-time"), Save->Claims.Num(), 1);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWQuestStateParityTest, "Hwanghon.Progression.QuestStateAllClearCombinations",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWQuestStateParityTest::RunTest(const FString& Parameters)
{
    TArray<FHWQuestDefinition> Quests;
    if (!LoadCatalog(*this, Quests)) return false;
    const FName Arenas[] = { TEXT("tutorial"), TEXT("marsh"), TEXT("sewage"), TEXT("relay"), TEXT("grove"), TEXT("road"), TEXT("ward") };
    const FName QuestIds[] = { TEXT("q_marsh"), TEXT("q_sewage"), TEXT("q_relay"), TEXT("q_plant"), TEXT("q_road"), TEXT("q_med") };
    for (int32 Mask = 0; Mask < 128; ++Mask)
    {
        UHWSaveGame* Save = NewObject<UHWSaveGame>();
        for (int32 Index = 0; Index < 7; ++Index)
        {
            if (Mask & (1 << Index)) Save->RecordClear(FGuid::NewGuid(), Arenas[Index]);
        }
        for (int32 Index = 0; Index < 6; ++Index)
        {
            const FHWQuestDefinition* Quest = Quests.FindByPredicate([&QuestIds, Index](const FHWQuestDefinition& Row) { return Row.Id == QuestIds[Index]; });
            if (!TestNotNull(TEXT("Canonical quest ID exists"), Quest)) return false;
            const EHWQuestState Expected = (Mask & (1 << (Index + 1))) ? EHWQuestState::Cleared :
                (Mask & (1 << Index)) ? EHWQuestState::Available : EHWQuestState::Locked;
            TestEqual(FString::Printf(TEXT("story.js mask %d quest %d"), Mask, Index), Save->GetQuestState(*Quest), Expected);
        }
    }
    // Own clear takes precedence even when a profile imported from earlier code
    // has no predecessor clear. Claiming it must also preserve that precedence.
    UHWSaveGame* Save = NewObject<UHWSaveGame>();
    Save->RecordClear(FGuid::NewGuid(), Quests.Last().ArenaId);
    FRandomStream Random(18);
    TestTrue(TEXT("Own clear can be claimed without prerequisite record"), Save->ClaimQuest(Quests.Last(), Random));
    TestEqual(TEXT("Claimed wins over missing prerequisite"), Save->GetQuestState(Quests.Last()), EHWQuestState::Claimed);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWQuestReceiptValidationTest, "Hwanghon.Progression.QuestReceiptValidation",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWQuestReceiptValidationTest::RunTest(const FString& Parameters)
{
    TArray<FHWQuestDefinition> Quests;
    if (!LoadCatalog(*this, Quests)) return false;
    UHWSaveGame* Save = NewObject<UHWSaveGame>();
    Save->RecordClear(FGuid::NewGuid(), Quests[0].ArenaId);
    FRandomStream Random(71);
    Save->ClaimQuest(Quests[0], Random);
    const auto Copy = [Save]() { return DuplicateObject<UHWSaveGame>(Save, GetTransientPackage()); };
    UHWSaveGame* Bad = Copy(); Bad->Gold = -1;
    TestFalse(TEXT("Negative wallet rejected"), Bad->IsValidProfile());
    Bad = Copy(); ++Bad->Experience;
    TestFalse(TEXT("Unreceipted XP rejected"), Bad->IsValidProfile());
    Bad = Copy(); Bad->Inventory.Add(TEXT("m_alloy"), -1);
    TestFalse(TEXT("Negative inventory rejected"), Bad->IsValidProfile());
    Bad = Copy(); Bad->Inventory.Add(TEXT("unknown"), 1);
    TestFalse(TEXT("Unreceipted inventory rejected"), Bad->IsValidProfile());
    Bad = Copy(); const FHWQuestClaimReceipt DuplicateClaim = Bad->Claims[0]; Bad->Claims.Add(DuplicateClaim);
    TestFalse(TEXT("Duplicate claim rejected"), Bad->IsValidProfile());
    Bad = Copy(); const FHWResolvedClaimReward DuplicateReward = Bad->Claims[0].Rewards[0]; Bad->Claims[0].Rewards.Add(DuplicateReward);
    TestFalse(TEXT("Duplicate reward identity rejected"), Bad->IsValidProfile());
    Bad = Copy(); Bad->Claims[0].Rewards[0].Kind = static_cast<EHWClaimRewardKind>(255);
    TestFalse(TEXT("Unknown reward kind rejected"), Bad->IsValidProfile());
    Bad = Copy(); Bad->Claims[0].ClaimFlag = TEXT("claim_other");
    TestFalse(TEXT("Mismatched flag rejected"), Bad->IsValidProfile());
    Bad = Copy(); Bad->Clears.Reset();
    TestFalse(TEXT("Claim without arena clear rejected"), Bad->IsValidProfile());
    Bad = Copy(); ++Bad->Claims[0].Rewards[0].Amount; ++Bad->Gold;
    TestTrue(TEXT("Internally consistent forged amount passes structural sum"), Bad->IsValidProfile());
    TestFalse(TEXT("Catalog bounds reject forged payout"), Bad->ValidateAgainstCatalog(Quests));
    Bad = Copy(); Bad->Claims[0].QuestId = TEXT("q_missing"); Bad->Claims[0].ClaimFlag = TEXT("claim_q_missing");
    TestFalse(TEXT("Unknown claimed quest rejected by catalog"), Bad->ValidateAgainstCatalog(Quests));

    UHWSaveGame* Atomic = NewObject<UHWSaveGame>();
    Atomic->RecordClear(FGuid::NewGuid(), Quests[0].ArenaId);
    FHWQuestDefinition Invalid = Quests[0];
    Invalid.ClaimRewards.Last().Min = -1;
    const int32 Seed = Random.GetCurrentSeed();
    TestFalse(TEXT("A negative later reward rejects entire transaction"), Atomic->ClaimQuest(Invalid, Random));
    TestEqual(TEXT("No partial gold"), Atomic->Gold, static_cast<int64>(0));
    TestTrue(TEXT("No partial items"), Atomic->Inventory.IsEmpty());
    TestTrue(TEXT("No partial receipt"), Atomic->Claims.IsEmpty());
    TestEqual(TEXT("Failed validation does not change random stream"), Random.GetCurrentSeed(), Seed);

    // Force an internally consistent extreme ledger to exercise the arithmetic
    // guard independently from the catalog's much smaller current rewards.
    FHWQuestDefinition OldQuest = SyntheticQuest(TEXT("q_old"), TEXT("old"), 1);
    Atomic->RecordClear(FGuid::NewGuid(), OldQuest.ArenaId);
    Atomic->ClaimQuest(OldQuest, Random);
    Atomic->Claims[0].Rewards[0].Amount = MAX_int64;
    Atomic->Gold = MAX_int64;
    TestTrue(TEXT("Extreme ledger sums safely before adding"), Atomic->IsValidProfile());
    const FHWQuestDefinition NextQuest = SyntheticQuest(TEXT("q_next"), TEXT("next"), 1);
    Atomic->RecordClear(FGuid::NewGuid(), NextQuest.ArenaId);
    TestFalse(TEXT("Adding beyond int64 rejects whole claim"), Atomic->ClaimQuest(NextQuest, Random));
    TestEqual(TEXT("Overflow did not wrap gold"), Atomic->Gold, static_cast<int64>(MAX_int64));
    TestEqual(TEXT("Overflow created no extra claim"), Atomic->Claims.Num(), 1);
    FHWQuestClaimReceipt Overflow = Atomic->Claims[0];
    Overflow.QuestId = NextQuest.Id; Overflow.ArenaId = NextQuest.ArenaId; Overflow.ClaimFlag = NextQuest.ClaimFlag;
    Atomic->Claims.Add(Overflow);
    TestFalse(TEXT("Overflow while validating stored receipts rejected"), Atomic->IsValidProfile());
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWQuestInclusiveRollTest, "Hwanghon.Progression.QuestInclusiveRandomRewards",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWQuestInclusiveRollTest::RunTest(const FString& Parameters)
{
    FHWQuestDefinition Quest = SyntheticQuest(TEXT("q_random"), TEXT("random"), 0);
    Quest.ClaimRewards[0].Min = 2;
    Quest.ClaimRewards[0].Max = 3;
    bool bSawMin = false, bSawMax = false;
    for (int32 Seed = 0; Seed < 32; ++Seed)
    {
        UHWSaveGame* Save = NewObject<UHWSaveGame>();
        Save->RecordClear(FGuid::NewGuid(), Quest.ArenaId);
        FRandomStream Random(Seed);
        TestTrue(TEXT("Inclusive two-value roll succeeds"), Save->ClaimQuest(Quest, Random));
        bSawMin |= Save->Gold == 2; bSawMax |= Save->Gold == 3;
        TestTrue(TEXT("Roll remains within both bounds"), Save->Gold >= 2 && Save->Gold <= 3);
    }
    TestTrue(TEXT("Minimum is reachable"), bSawMin);
    TestTrue(TEXT("Maximum is reachable"), bSawMax);
    Quest.ClaimRewards[0].Min = 0; Quest.ClaimRewards[0].Max = MAX_int32;
    UHWSaveGame* Save = NewObject<UHWSaveGame>();
    Save->RecordClear(FGuid::NewGuid(), Quest.ArenaId);
    FRandomStream Random(82);
    TestTrue(TEXT("Full nonnegative int32 range does not overflow width"), Save->ClaimQuest(Quest, Random));
    TestTrue(TEXT("Full range bounded"), Save->Gold >= 0 && Save->Gold <= MAX_int32);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWQuestFailedSaveAndReloadTest, "Hwanghon.Progression.QuestFailedSaveRetryAndReload",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWQuestFailedSaveAndReloadTest::RunTest(const FString& Parameters)
{
    TArray<FHWQuestDefinition> Quests;
    if (!LoadCatalog(*this, Quests)) return false;
    TSharedRef<FHWMemoryProfileStorage> Storage = MakeShared<FHWMemoryProfileStorage>();
    UHWProfileSubsystem* Profile = NewProfile();
    TestTrue(TEXT("Initialize empty isolated storage"), Profile->InitializeProfile(Storage, Quests));
    TestTrue(TEXT("Profile available"), Profile->IsProfileAvailable());
    TestEqual(TEXT("Unknown quest unavailable"), Profile->GetQuestState(TEXT("q_missing")), EHWQuestState::Unavailable);
    TestEqual(TEXT("Initial cumulative wallet is zero"), Profile->GetGold(), static_cast<int64>(0));
    const FGuid FirstRun = FGuid::NewGuid();
    TestTrue(TEXT("Persist own arena clear"), Profile->RecordVictory(FirstRun, Quests[0].ArenaId));
    TestTrue(TEXT("Exact durable run can be queried"), Profile->HasSavedVictory(FirstRun, Quests[0].ArenaId));
    TestFalse(TEXT("Exact query rejects another arena"), Profile->HasSavedVictory(FirstRun, TEXT("wrong")));
    const TArray<uint8> BeforeClaim = Storage->Bytes;
    Storage->bFailSave = true;
    AddExpectedError(TEXT("Profile save failed. Exact receipts retained"), EAutomationExpectedErrorFlags::Contains, 3);
    TestFalse(TEXT("Claim reports failed durable save"), Profile->ClaimQuest(Quests[0].Id));
    TestTrue(TEXT("Candidate retained"), Profile->HasPendingSave());
    TestEqual(TEXT("Failed claim is still visibly cleared"), Profile->GetQuestState(Quests[0].Id), EHWQuestState::Cleared);
    TestEqual(TEXT("Failed claim exposes no gold"), Profile->GetGold(), static_cast<int64>(0));
    TestEqual(TEXT("Failed claim exposes no XP"), Profile->GetExperience(), static_cast<int64>(0));
    TestEqual(TEXT("Failed claim exposes no items"), Profile->GetItemCount(TEXT("m_alloy")), static_cast<int64>(0));
    TestTrue(TEXT("Failed storage preserves previous durable bytes"), Storage->Bytes == BeforeClaim);
    const TArray<uint8> FirstCandidate = Storage->LastAttempt;
    TestFalse(TEXT("Repeated claim retries the pending transaction"), Profile->ClaimQuest(Quests[0].Id));
    TestTrue(TEXT("Repeated claim preserves exact resolved rolls"), Storage->LastAttempt == FirstCandidate);
    const FGuid SecondRun = FGuid::NewGuid();
    TestFalse(TEXT("Later victory joins pending claim if disk still fails"), Profile->RecordVictory(SecondRun, Quests[1].ArenaId));
    TestFalse(TEXT("Unsaved exact run stays invisible"), Profile->HasSavedVictory(SecondRun, Quests[1].ArenaId));
    UHWSaveGame* FirstRoll = Cast<UHWSaveGame>(UGameplayStatics::LoadGameFromMemory(FirstCandidate));
    UHWSaveGame* Combined = Cast<UHWSaveGame>(UGameplayStatics::LoadGameFromMemory(Storage->LastAttempt));
    if (!TestNotNull(TEXT("First pending candidate serialized"), FirstRoll) || !TestNotNull(TEXT("Combined candidate serialized"), Combined)) return false;
    TestEqual(TEXT("Appending victory keeps pending gold"), Combined->Gold, FirstRoll->Gold);
    TestEqual(TEXT("Appending victory keeps pending item roll"), Combined->Inventory.FindRef(TEXT("m_alloy")), FirstRoll->Inventory.FindRef(TEXT("m_alloy")));
    TestEqual(TEXT("Appending victory keeps single claim"), Combined->Claims.Num(), 1);
    Storage->bFailSave = false;
    TestTrue(TEXT("Storage recovery commits exact combined candidate"), Profile->RetryPendingSave());
    TestFalse(TEXT("No remaining pending save"), Profile->HasPendingSave());
    TestTrue(TEXT("Second run now durable"), Profile->HasSavedVictory(SecondRun, Quests[1].ArenaId));
    TestEqual(TEXT("Claim visible only after durability"), Profile->GetQuestState(Quests[0].Id), EHWQuestState::Claimed);
    TestEqual(TEXT("Same gold as first resolved roll"), Profile->GetGold(), FirstRoll->Gold);
    TestEqual(TEXT("Same XP as first resolved roll"), Profile->GetExperience(), FirstRoll->Experience);
    TestTrue(TEXT("Error cleared on commit"), Profile->GetLastError().IsEmpty());
    TestFalse(TEXT("Retry with nothing pending makes no transaction"), Profile->RetryPendingSave());
    UHWProfileSubsystem* Reloaded = NewProfile();
    TestTrue(TEXT("Fresh subsystem reloads durable storage"), Reloaded->InitializeProfile(Storage, Quests));
    TestEqual(TEXT("Reloaded claim still marked"), Reloaded->GetQuestState(Quests[0].Id), EHWQuestState::Claimed);
    TestEqual(TEXT("Reloaded wallet exact"), Reloaded->GetGold(), Profile->GetGold());
    TestEqual(TEXT("Reloaded inventory exact"), Reloaded->GetItemCount(TEXT("m_alloy")), Profile->GetItemCount(TEXT("m_alloy")));
    AddExpectedError(TEXT("Quest reward was already claimed"), EAutomationExpectedErrorFlags::Contains, 1);
    const int32 SavesBeforeRepeat = Storage->SaveAttempts;
    TestFalse(TEXT("Reload cannot claim twice"), Reloaded->ClaimQuest(Quests[0].Id));
    TestEqual(TEXT("Duplicate claim never writes"), Storage->SaveAttempts, SavesBeforeRepeat);
    TestTrue(TEXT("Replaying claimed arena still records another victory"), Reloaded->RecordVictory(FGuid::NewGuid(), Quests[0].ArenaId));
    TestEqual(TEXT("Replay leaves office wallet unchanged"), Reloaded->GetGold(), Profile->GetGold());
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWQuestMigrationAndCorruptLoadTest, "Hwanghon.Progression.QuestMigrationAndCorruptLoad",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWQuestMigrationAndCorruptLoadTest::RunTest(const FString& Parameters)
{
    TArray<FHWQuestDefinition> Quests;
    if (!LoadCatalog(*this, Quests)) return false;
    TSharedRef<FHWMemoryProfileStorage> Storage = MakeShared<FHWMemoryProfileStorage>();
    UHWSaveGame* Legacy = NewObject<UHWSaveGame>();
    const FGuid LegacyRun = FGuid::NewGuid();
    Legacy->RecordClear(LegacyRun, Quests[0].ArenaId);
    Legacy->Version = 1;
    Storage->Save(Legacy);
    const TArray<uint8> LegacyBytes = Storage->Bytes;
    UHWProfileSubsystem* Profile = NewProfile();
    TestTrue(TEXT("Validated v1 ledger migrates"), Profile->InitializeProfile(Storage, Quests));
    TestTrue(TEXT("Migration preserves original run identity"), Profile->HasSavedVictory(LegacyRun, Quests[0].ArenaId));
    TestEqual(TEXT("Migration enables claim from retained clear"), Profile->GetQuestState(Quests[0].Id), EHWQuestState::Cleared);
    TestEqual(TEXT("Migration invents no starting wallet"), Profile->GetGold(), static_cast<int64>(0));
    TestTrue(TEXT("Read-only migration does not overwrite legacy bytes"), Storage->Bytes == LegacyBytes);
    TestTrue(TEXT("Next transaction writes current version"), Profile->ClaimQuest(Quests[0].Id));
    UHWSaveGame* Current = Storage->Load();
    if (!TestNotNull(TEXT("Current save reloads"), Current)) return false;
    TestEqual(TEXT("Saved schema advanced to v2"), Current->Version, 2);
    TestTrue(TEXT("Current save validates"), Current->ValidateAgainstCatalog(Quests));
    const TArray<uint8> GoodBytes = Storage->Bytes;

    AddExpectedError(TEXT("Existing profile or quest catalog is invalid or unsupported"), EAutomationExpectedErrorFlags::Contains, 6);
    AddExpectedError(TEXT("Profile unavailable; existing save has not been replaced"), EAutomationExpectedErrorFlags::Contains, 6);
    for (int32 Variant = 0; Variant < 6; ++Variant)
    {
        UHWSaveGame* Invalid = DuplicateObject<UHWSaveGame>(Current, GetTransientPackage());
        if (Variant == 0) Invalid->Version = UHWSaveGame::CurrentVersion + 1;
        if (Variant == 1) Invalid->Gold = -1;
        if (Variant == 2) Invalid->Version = 1; // v1 with unexpected v2 money/claim data
        if (Variant == 3)
        {
            const FHWClearReceipt Duplicate = Invalid->Clears[0];
            Invalid->Clears.Add(Duplicate);
        }
        Storage->Save(Invalid);
        if (Variant == 4)
        {
            FMemoryReader HeaderReader = UGameplayStatics::StripSaveGameHeader(Storage->Bytes);
            const int32 PayloadStart = static_cast<int32>(HeaderReader.Tell());
            if (!TestTrue(TEXT("Profile has a complete class header and nonempty payload"), PayloadStart > 0 && PayloadStart + 2 < Storage->Bytes.Num())) return false;
            // Keep the class header so UE constructs an object, but cut through
            // its first property. Defaults must never validate this partial load.
            Storage->Bytes.SetNum(PayloadStart + 2);
        }
        if (Variant == 5) Storage->Bytes.SetNum(Storage->Bytes.Num() - 1);
        const TArray<uint8> BrokenBytes = Storage->Bytes;
        const int32 WritesBefore = Storage->SaveAttempts;
        UHWProfileSubsystem* Rejected = NewProfile();
        TestFalse(FString::Printf(TEXT("Invalid profile variant %d load rejected"), Variant), Rejected->InitializeProfile(Storage, Quests));
        TestFalse(TEXT("Invalid profile remains unavailable"), Rejected->IsProfileAvailable());
        TestEqual(TEXT("Invalid profile quest cannot appear available"), Rejected->GetQuestState(Quests[0].Id), EHWQuestState::Unavailable);
        TestFalse(TEXT("Invalid profile cannot write victory"), Rejected->RecordVictory(FGuid::NewGuid(), Quests[0].ArenaId));
        TestFalse(TEXT("Invalid profile has no writable pending candidate"), Rejected->RetryPendingSave());
        TestEqual(TEXT("No writes after rejected load"), Storage->SaveAttempts, WritesBefore);
        TestTrue(TEXT("Rejected bytes preserved exactly"), Storage->Bytes == BrokenBytes);
    }
    Storage->Bytes = GoodBytes;
    UHWProfileSubsystem* Restored = NewProfile();
    TestTrue(TEXT("Original valid bytes still load"), Restored->InitializeProfile(Storage, Quests));
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWQuestErrorReentryTest, "Hwanghon.Progression.QuestErrorCallbackReentry",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWQuestErrorReentryTest::RunTest(const FString& Parameters)
{
    TArray<FHWQuestDefinition> Quests;
    if (!LoadCatalog(*this, Quests)) return false;
    TSharedRef<FHWMemoryProfileStorage> Storage = MakeShared<FHWMemoryProfileStorage>();
    UHWProfileSubsystem* Profile = NewProfile();
    if (!TestTrue(TEXT("Initialize reentry profile"), Profile->InitializeProfile(Storage, Quests))) return false;
    Profile->RecordVictory(FGuid::NewGuid(), Quests[0].ArenaId);
    UHWQuestProfileTestObserver* Observer = NewObject<UHWQuestProfileTestObserver>();
    Observer->Profile = Profile;
    Profile->OnProfileError.AddDynamic(Observer, &UHWQuestProfileTestObserver::RetryOnError);
    Profile->OnQuestClaimed.AddDynamic(Observer, &UHWQuestProfileTestObserver::OnClaim);
    Storage->bFailSave = true;
    const int32 WritesBeforeFailure = Storage->SaveAttempts;
    AddExpectedError(TEXT("Profile save failed. Exact receipts retained"), EAutomationExpectedErrorFlags::Contains, 2);
    TestFalse(TEXT("Claim and error callback retry both encounter failed storage"), Profile->ClaimQuest(Quests[0].Id));
    TestEqual(TEXT("One outer error event, no recursive callback loop"), Observer->ErrorCount, 1);
    TestEqual(TEXT("Exactly one listener retry was attempted"), Storage->SaveAttempts, WritesBeforeFailure + 2);
    TestEqual(TEXT("Failed and reentrant saves emit no claim event"), Observer->ClaimCount, 0);
    TestEqual(TEXT("Reentrant error keeps wallet uncommitted"), Profile->GetGold(), static_cast<int64>(0));
    Storage->bFailSave = false;
    TestTrue(TEXT("Recovery persists pending claim"), Profile->RetryPendingSave());
    TestEqual(TEXT("Successful claim event delivered once"), Observer->ClaimCount, 1);
    TestTrue(TEXT("Claim listeners see committed profile"), Observer->bAllClaimsCommitted);
    TestFalse(TEXT("No-op retry cannot duplicate notification"), Profile->RetryPendingSave());
    TestEqual(TEXT("Still one successful claim event"), Observer->ClaimCount, 1);
    return true;
}

#endif
