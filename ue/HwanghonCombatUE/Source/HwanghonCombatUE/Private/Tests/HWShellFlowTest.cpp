#if WITH_DEV_AUTOMATION_TESTS

#include "Game/HWQuestRunSubsystem.h"
#include "Content/HWGameContentSubsystem.h"
#include "Progression/HWProfileSubsystem.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/AutomationTest.h"
#include "UObject/StrongObjectPtr.h"

struct FHWShellFlowTestAccess
{
    static void Wire(UHWQuestRunSubsystem& Runs, UHWProfileSubsystem* Profile, UHWGameContentSubsystem* Content)
    {
        Runs.Profile = Profile;
        Runs.Content = Content;
    }
    static FGuid SetRun(UHWQuestRunSubsystem& Runs, EHWQuestRunState State, UWorld* World)
    {
        Runs.State = State;
        Runs.Ticket.RunId = FGuid::NewGuid();
        Runs.Ticket.QuestId = TEXT("q_marsh");
        Runs.Ticket.ArenaId = TEXT("marsh");
        Runs.Ticket.DungeonId = TEXT("d02");
        Runs.Ticket.MapPackageName = UHWQuestRunSubsystem::GetMapPackage(World);
        Runs.ActiveWorld = World;
        return Runs.Ticket.RunId;
    }
    static void SetSaving(UHWQuestRunSubsystem& Runs, bool bSaving) { Runs.bSavingVictory = bSaving; }
    static void ReturnRequested(UHWQuestRunSubsystem& Runs, UWorld* Destination)
    {
        Runs.bReturningToLobby = true;
        Runs.LobbyTravelPackage = UHWQuestRunSubsystem::GetMapPackage(Destination);
    }
    static FGuid RetryRequested(UHWQuestRunSubsystem& Runs)
    {
        Runs.PreviousTicket = Runs.Ticket;
        Runs.PreviousState = Runs.State;
        Runs.PreviousWorld = Runs.ActiveWorld;
        Runs.bRetryTravel = true;
        Runs.Ticket.RunId = FGuid::NewGuid();
        Runs.State = EHWQuestRunState::Traveling;
        return Runs.Ticket.RunId;
    }
    static void Loaded(UHWQuestRunSubsystem& Runs, UWorld* World) { Runs.HandleMapLoaded(World); }
    static void TravelFailed(UHWQuestRunSubsystem& Runs, UWorld* World)
    {
        Runs.HandleTravelFailure(World, ETravelFailure::LoadMapFailure, TEXT("Isolated shell failure"));
    }
    static bool Attach(UHWQuestRunSubsystem& Runs, UWorld* World, const FGuid& Run)
    {
        FGuid Result;
        return Runs.AttachEncounter(World, TEXT("marsh"), TEXT("d02"), Run, Result) && Result == Run;
    }
};

namespace
{
    class FHWShellMemoryStorage : public IHWProfileStorage
    {
    public:
        bool bFail = false;
        TArray<uint8> Bytes;
        virtual bool Exists() const override { return !Bytes.IsEmpty(); }
        virtual UHWSaveGame* Load() override { return Cast<UHWSaveGame>(UGameplayStatics::LoadGameFromMemory(Bytes)); }
        virtual bool Save(UHWSaveGame* Candidate) override
        {
            TArray<uint8> Saved;
            if (bFail || !UGameplayStatics::SaveGameToMemory(Candidate, Saved)) { return false; }
            Bytes = MoveTemp(Saved);
            return true;
        }
    };

    struct FHWShellFixture
    {
        TStrongObjectPtr<UGameInstance> Owner{NewObject<UGameInstance>()};
        TStrongObjectPtr<UHWGameContentSubsystem> Content{NewObject<UHWGameContentSubsystem>(Owner.Get())};
        TStrongObjectPtr<UHWProfileSubsystem> Profile{NewObject<UHWProfileSubsystem>(Owner.Get())};
        TStrongObjectPtr<UHWQuestRunSubsystem> Runs{NewObject<UHWQuestRunSubsystem>(Owner.Get())};
        TSharedRef<FHWShellMemoryStorage> Storage = MakeShared<FHWShellMemoryStorage>();
        UWorld* World = nullptr;
        bool bReady = false;

        FHWShellFixture()
        {
            const FName Name(*FString::Printf(TEXT("HWShell_%s"), *FGuid::NewGuid().ToString(EGuidFormats::Digits)));
            UPackage* Package = CreatePackage(*(TEXT("/Game/Automation/") + Name.ToString()));
            const auto Initialization = UWorld::InitializationValues().AllowAudioPlayback(false)
                .RequiresHitProxies(false).CreatePhysicsScene(false).CreateNavigation(false)
                .CreateAISystem(false).ShouldSimulatePhysics(false).SetTransactional(false);
            World = UWorld::CreateWorld(EWorldType::Game, false, Name, Package,
                true, ERHIFeatureLevel::Num, &Initialization, false);
            if (World) { World->SetGameInstance(Owner.Get()); }
            bReady = World && Content->LoadFromProjectContent()
                && Profile->InitializeProfile(Storage, Content->GetQuests());
            FHWShellFlowTestAccess::Wire(*Runs, Profile.Get(), Content.Get());
        }
        ~FHWShellFixture() { if (World) { World->DestroyWorld(false); } }
    };
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWShellAvailabilityTest, "Hwanghon.Progression.ShellAvailabilityReasons",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWShellAvailabilityTest::RunTest(const FString& Parameters)
{
    FHWShellFixture F;
    if (!TestTrue(TEXT("Isolated catalog and profile"), F.bReady)) { return false; }
    TGuardValue<TArray<FHWEncounterRoute>> MissingRoutes(
        GetMutableDefault<UHWEncounterSettings>()->Routes, TArray<FHWEncounterRoute>());
    FString Reason = TEXT("Stale UI message");
    TestFalse(TEXT("Locked quest cannot launch"), F.Runs->CanPrepareQuest(TEXT("q_marsh"), Reason));
    TestTrue(TEXT("Prerequisite reason supplied"), Reason.Contains(TEXT("prerequisite")));
    TestFalse(TEXT("Training requires an authored route"), F.Runs->CanPrepareTraining(Reason));
    TestTrue(TEXT("Missing route reason supplied"), Reason.Contains(TEXT("No authored")));
    TestTrue(TEXT("Training receipt unlocks first quest"), F.Profile->RecordVictory(FGuid::NewGuid(), TEXT("tutorial")));
    TestFalse(TEXT("Unlocked quest still needs a map"), F.Runs->CanPrepareQuest(TEXT("q_marsh"), Reason));
    TestTrue(TEXT("Missing route replaces stale prerequisite reason"), Reason.Contains(TEXT("No authored")));
    FHWEncounterRoute Missing;
    Missing.ArenaId = TEXT("tutorial");
    Missing.DungeonId = TEXT("d01");
    Missing.Map = TSoftObjectPtr<UWorld>(FSoftObjectPath(TEXT("/Game/Automation/HW_NotInstalled.HW_NotInstalled")));
    GetMutableDefault<UHWEncounterSettings>()->Routes.Add(Missing);
    TestFalse(TEXT("Configured but absent map cannot launch"), F.Runs->CanPrepareTraining(Reason));
    TestTrue(TEXT("Missing package reason supplied"), Reason.Contains(TEXT("not installed/cooked")));
    TestTrue(TEXT("Availability queries do not create a run"), F.Runs->GetRunState() == EHWQuestRunState::Idle);
    TestFalse(TEXT("Availability queries do not mint an identity"), F.Runs->GetRunTicket().RunId.IsValid());
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWShellNavigationGuardsTest, "Hwanghon.Progression.ShellNavigationGuards",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWShellNavigationGuardsTest::RunTest(const FString& Parameters)
{
    FHWShellFixture F;
    if (!TestTrue(TEXT("Isolated fixture"), F.bReady)) { return false; }
    const FGuid Run = FHWShellFlowTestAccess::SetRun(*F.Runs, EHWQuestRunState::InCombat, F.World);
    TestFalse(TEXT("Combat return requires explicit abandonment"), F.Runs->ReturnToLobby());
    TestTrue(TEXT("Implicit return leaves combat active"), F.Runs->GetRunState() == EHWQuestRunState::InCombat);
    TGuardValue<TSoftObjectPtr<UWorld>> MissingLobby(GetMutableDefault<UHWEncounterSettings>()->LobbyMap, TSoftObjectPtr<UWorld>());
    TestFalse(TEXT("Missing lobby does not abandon even after confirmation"), F.Runs->ReturnToLobby(true));
    TestTrue(TEXT("Failed preflight preserves live fight"), F.Runs->GetRunState() == EHWQuestRunState::InCombat);
    TestEqual(TEXT("Failed preflight preserves run identity"), F.Runs->GetRunTicket().RunId, Run);
    TestEqual(TEXT("Leaving never grants a clear"), F.Profile->GetClearCount(TEXT("marsh")), 0);

    FHWShellFlowTestAccess::SetRun(*F.Runs, EHWQuestRunState::VictoryPendingSave, F.World);
    TestFalse(TEXT("Pending victory cannot return"), F.Runs->ReturnToLobby());
    TestFalse(TEXT("Pending victory cannot retry combat"), F.Runs->RetryEncounter());
    FHWShellFlowTestAccess::SetRun(*F.Runs, EHWQuestRunState::Victory, F.World);
    FHWShellFlowTestAccess::SetSaving(*F.Runs, true);
    TestFalse(TEXT("Save callback cannot return"), F.Runs->ReturnToLobby());
    TestFalse(TEXT("Save callback cannot retry combat"), F.Runs->RetryEncounter());
    TestFalse(TEXT("Save callback cannot reset"), F.Runs->ResetRun());
    FHWShellFlowTestAccess::SetSaving(*F.Runs, false);
    F.Storage->bFail = true;
    AddExpectedError(TEXT("save failed"), EAutomationExpectedErrorFlags::Contains, 1);
    TestFalse(TEXT("Create isolated unsaved profile receipt"), F.Profile->RecordVictory(FGuid::NewGuid(), TEXT("tutorial")));
    TestTrue(TEXT("Profile has pending data"), F.Profile->HasPendingSave());
    TestFalse(TEXT("Unrelated pending profile blocks return"), F.Runs->ReturnToLobby());
    TestFalse(TEXT("Unrelated pending profile blocks retry"), F.Runs->RetryEncounter());
    TestTrue(TEXT("Navigation did not discard pending profile"), F.Profile->HasPendingSave());
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWShellLobbyAcknowledgmentTest, "Hwanghon.Progression.ShellLobbyAcknowledgment",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWShellLobbyAcknowledgmentTest::RunTest(const FString& Parameters)
{
    FHWShellFixture F;
    if (!TestTrue(TEXT("Isolated fixture"), F.bReady)) { return false; }
    const FGuid Run = FHWShellFlowTestAccess::SetRun(*F.Runs, EHWQuestRunState::Victory, F.World);
    FHWShellFlowTestAccess::ReturnRequested(*F.Runs, F.World);
    TestFalse(TEXT("Result cannot reset while lobby travel is pending"), F.Runs->ResetRun());
    TestFalse(TEXT("Cannot issue a second return"), F.Runs->ReturnToLobby());
    TestFalse(TEXT("Cannot retry while lobby travel is pending"), F.Runs->RetryEncounter());
    FHWShellFlowTestAccess::TravelFailed(*F.Runs, F.World);
    TestFalse(TEXT("Failure releases lobby transition"), F.Runs->IsReturningToLobby());
    TestTrue(TEXT("Failed lobby travel preserves victory"), F.Runs->GetRunState() == EHWQuestRunState::Victory);
    TestEqual(TEXT("Failed lobby travel preserves original result identity"), F.Runs->GetRunTicket().RunId, Run);
    {
        FHWShellFixture Other;
        if (!TestTrue(TEXT("Other world fixture"), Other.bReady)) { return false; }
        FHWShellFlowTestAccess::ReturnRequested(*F.Runs, F.World);
        FHWShellFlowTestAccess::Loaded(*F.Runs, Other.World);
        TestTrue(TEXT("Other game instance cannot acknowledge return"), F.Runs->IsReturningToLobby());
        Other.World->SetGameInstance(F.Owner.Get());
        FHWShellFlowTestAccess::Loaded(*F.Runs, Other.World);
        TestFalse(TEXT("Wrong map ends pending transition"), F.Runs->IsReturningToLobby());
        TestEqual(TEXT("Wrong map retains result identity"), F.Runs->GetRunTicket().RunId, Run);
        TestTrue(TEXT("Wrong map gives a useful error"), F.Runs->GetLastError().Contains(TEXT("different map")));
    }
    FHWShellFlowTestAccess::ReturnRequested(*F.Runs, F.World);
    FHWShellFlowTestAccess::Loaded(*F.Runs, F.World);
    TestTrue(TEXT("Acknowledged lobby resets selection"), F.Runs->GetRunState() == EHWQuestRunState::Idle);
    TestFalse(TEXT("Acknowledged lobby clears prior run identity"), F.Runs->GetRunTicket().RunId.IsValid());
    TestFalse(TEXT("Acknowledged lobby releases transition"), F.Runs->IsReturningToLobby());
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWShellRetryRollbackTest, "Hwanghon.Progression.ShellRetryRollback",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWShellRetryRollbackTest::RunTest(const FString& Parameters)
{
    FHWShellFixture F;
    if (!TestTrue(TEXT("Isolated fixture"), F.bReady)) { return false; }
    for (const EHWQuestRunState Terminal : {EHWQuestRunState::Victory, EHWQuestRunState::Defeat, EHWQuestRunState::Aborted})
    {
        const FGuid Original = FHWShellFlowTestAccess::SetRun(*F.Runs, Terminal, F.World);
        FHWShellFlowTestAccess::RetryRequested(*F.Runs);
        FHWShellFlowTestAccess::TravelFailed(*F.Runs, F.World);
        TestTrue(TEXT("Retry failure restores previous terminal state"), F.Runs->GetRunState() == Terminal);
        TestEqual(TEXT("Retry failure restores previous ticket"), F.Runs->GetRunTicket().RunId, Original);
        FHWShellFlowTestAccess::RetryRequested(*F.Runs);
        FHWShellFlowTestAccess::Loaded(*F.Runs, F.World);
        TestTrue(TEXT("Missing map acknowledgment restores previous result"), F.Runs->GetRunState() == Terminal);
        TestEqual(TEXT("Missing acknowledgment restores previous identity"), F.Runs->GetRunTicket().RunId, Original);
        FHWShellFlowTestAccess::RetryRequested(*F.Runs);
        TestFalse(TEXT("Old run token cannot acknowledge a retry"), FHWShellFlowTestAccess::Attach(*F.Runs, F.World, Original));
        TestEqual(TEXT("Wrong token restores previous result"), F.Runs->GetRunTicket().RunId, Original);
        const FGuid NewRun = FHWShellFlowTestAccess::RetryRequested(*F.Runs);
        TestTrue(TEXT("Retry uses a different token"), NewRun != Original);
        TestTrue(TEXT("New matching token enters combat"), FHWShellFlowTestAccess::Attach(*F.Runs, F.World, NewRun));
        TestTrue(TEXT("Accepted retry is a live encounter"), F.Runs->GetRunState() == EHWQuestRunState::InCombat);
        TestEqual(TEXT("Accepted retry keeps new token"), F.Runs->GetRunTicket().RunId, NewRun);
    }
    TestEqual(TEXT("Retry transitions never award clears"), F.Profile->GetClearCount(TEXT("marsh")), 0);
    return true;
}

#endif
