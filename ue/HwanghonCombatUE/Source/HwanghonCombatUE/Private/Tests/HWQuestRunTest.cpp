#if WITH_DEV_AUTOMATION_TESTS

#include "Game/HWQuestRunSubsystem.h"
#include "Game/HWCombatGameMode.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Content/HWGameContentSubsystem.h"
#include "Progression/HWProfileSubsystem.h"
#include "Tests/HWQuestRunTestObserver.h"
#include "Engine/GameInstance.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/AutomationTest.h"
#include "UObject/StrongObjectPtr.h"

struct FHWQuestRunTestAccess
{
    static void Wire(UHWQuestRunSubsystem& Runs, UHWProfileSubsystem* Profile, UHWGameContentSubsystem* Content)
    {
        Runs.Profile = Profile;
        Runs.Content = Content;
    }
    static FGuid Request(UHWQuestRunSubsystem& Runs, UWorld* World, FName Arena = TEXT("marsh"))
    {
        Runs.Ticket.RunId = FGuid::NewGuid();
        Runs.Ticket.ArenaId = Arena;
        Runs.Ticket.DungeonId = TEXT("d02");
        Runs.Ticket.MapPackageName = UHWQuestRunSubsystem::GetMapPackage(World);
        Runs.State = EHWQuestRunState::Traveling;
        return Runs.Ticket.RunId;
    }
    static bool Attach(UHWQuestRunSubsystem& Runs, UWorld* World, const FGuid& Run,
        FName Arena = TEXT("marsh"), FName Dungeon = TEXT("d02"))
    {
        FGuid Attached;
        return Runs.AttachEncounter(World, Arena, Dungeon, Run, Attached) && Attached == Run;
    }
    static bool Complete(UHWQuestRunSubsystem& Runs, UWorld* World, const FGuid& Run) { return Runs.CompleteEncounter(World, Run); }
    static bool Defeat(UHWQuestRunSubsystem& Runs, UWorld* World, const FGuid& Run) { return Runs.FailEncounter(World, Run); }
    static void Leave(UHWQuestRunSubsystem& Runs, UWorld* World, const FGuid& Run) { Runs.LeaveEncounter(World, Run); }
    static void Loaded(UHWQuestRunSubsystem& Runs, UWorld* World) { Runs.HandleMapLoaded(World); }
    static void TravelFailed(UHWQuestRunSubsystem& Runs, UWorld* World)
    {
        Runs.HandleTravelFailure(World, ETravelFailure::LoadMapFailure, TEXT("Test map failure"));
    }
    static void BindMode(AHWCombatGameMode& Mode, UHWQuestRunSubsystem& Runs, AHWAinCharacter* Player, AHWBossCharacter* Boss)
    {
        Mode.QuestRuns = &Runs;
        Mode.RunId = Runs.Ticket.RunId;
        Mode.bQuestRun = true;
        Mode.EncounterPlayer = Player;
        Mode.EncounterBoss = Boss;
        Boss->OnBossDied.AddDynamic(&Mode, &AHWCombatGameMode::HandleBossDied);
        Player->GetCombat()->OnDied.AddDynamic(&Mode, &AHWCombatGameMode::HandlePlayerDied);
        Player->OnDestroyed.AddDynamic(&Mode, &AHWCombatGameMode::HandleParticipantDestroyed);
        Boss->OnDestroyed.AddDynamic(&Mode, &AHWCombatGameMode::HandleParticipantDestroyed);
    }
};

namespace
{
    class FHWRunMemoryStorage : public IHWProfileStorage
    {
    public:
        TArray<uint8> Bytes;
        bool bFail = false;
        virtual bool Exists() const override { return !Bytes.IsEmpty(); }
        virtual UHWSaveGame* Load() override { return Cast<UHWSaveGame>(UGameplayStatics::LoadGameFromMemory(Bytes)); }
        virtual bool Save(UHWSaveGame* Candidate) override
        {
            TArray<uint8> CandidateBytes;
            if (bFail || !UGameplayStatics::SaveGameToMemory(Candidate, CandidateBytes)) { return false; }
            Bytes = MoveTemp(CandidateBytes);
            return true;
        }
    };

    struct FHWRunFixture
    {
        TStrongObjectPtr<UGameInstance> Owner{NewObject<UGameInstance>()};
        TStrongObjectPtr<UHWGameContentSubsystem> Content{NewObject<UHWGameContentSubsystem>(Owner.Get())};
        TStrongObjectPtr<UHWProfileSubsystem> Profile{NewObject<UHWProfileSubsystem>(Owner.Get())};
        TStrongObjectPtr<UHWQuestRunSubsystem> Runs{NewObject<UHWQuestRunSubsystem>(Owner.Get())};
        TSharedRef<FHWRunMemoryStorage> Storage = MakeShared<FHWRunMemoryStorage>();
        UWorld* World = nullptr;
        bool bReady = false;

        FHWRunFixture()
        {
            const FName Name(*FString::Printf(TEXT("HWQuestRun_%s"), *FGuid::NewGuid().ToString(EGuidFormats::Digits)));
            UPackage* Package = CreatePackage(*(TEXT("/Game/Automation/") + Name.ToString()));
            const auto Initialization = UWorld::InitializationValues().AllowAudioPlayback(false)
                .RequiresHitProxies(false).CreatePhysicsScene(true).CreateNavigation(false)
                .CreateAISystem(false).ShouldSimulatePhysics(false).SetTransactional(false);
            World = UWorld::CreateWorld(EWorldType::Game, false, Name, Package,
                true, ERHIFeatureLevel::Num, &Initialization, false);
            if (World)
            {
                FWorldContext& Context = GEngine->CreateNewWorldContext(EWorldType::Game);
                Context.SetCurrentWorld(World);
                Context.OwningGameInstance = Owner.Get();
                World->SetGameInstance(Owner.Get());
                World->InitializeActorsForPlay(FURL());
            }
            bReady = World && Content->LoadFromProjectContent()
                && Profile->InitializeProfile(Storage, Content->GetQuests());
            FHWQuestRunTestAccess::Wire(*Runs, Profile.Get(), Content.Get());
        }
        ~FHWRunFixture()
        {
            if (World)
            {
                World->DestroyWorld(false);
                GEngine->DestroyWorldContext(World);
            }
        }
    };

    FHWEncounterRoute Route(const TCHAR* Arena, const TCHAR* Dungeon, const TCHAR* Path)
    {
        FHWEncounterRoute Result;
        Result.ArenaId = Arena;
        Result.DungeonId = Dungeon;
        Result.Map = TSoftObjectPtr<UWorld>(FSoftObjectPath(Path));
        return Result;
    }
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWEncounterRoutesTest, "Hwanghon.Progression.EncounterRoutes",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWEncounterRoutesTest::RunTest(const FString& Parameters)
{
    const FHWEncounterRoute Marsh = Route(TEXT("marsh"), TEXT("d02"), TEXT("/Game/Maps/Marsh.Marsh"));
    FString Package, Error;
    TestTrue(TEXT("Explicit matching route accepted"), UHWQuestRunSubsystem::ResolveRoute({Marsh}, TEXT("marsh"), TEXT("d02"), Package, Error));
    TestEqual(TEXT("Only package sent to travel"), Package, FString(TEXT("/Game/Maps/Marsh")));
    TestFalse(TEXT("No fallback from missing route"), UHWQuestRunSubsystem::ResolveRoute({}, TEXT("marsh"), TEXT("d02"), Package, Error));
    TestTrue(TEXT("Failure clears stale output"), Package.IsEmpty());
    TestFalse(TEXT("Failure explains unavailable map"), Error.IsEmpty());
    TestFalse(TEXT("Wrong dungeon"), UHWQuestRunSubsystem::ResolveRoute({Marsh}, TEXT("marsh"), TEXT("d03"), Package, Error));
    TestFalse(TEXT("Duplicate route"), UHWQuestRunSubsystem::ResolveRoute({Marsh, Marsh}, TEXT("marsh"), TEXT("d02"), Package, Error));
    const auto Alias = Route(TEXT("sewage"), TEXT("d03"), TEXT("/Game/Maps/Marsh.Marsh"));
    TestFalse(TEXT("Distinct arenas cannot reuse graybox implicitly"), UHWQuestRunSubsystem::ResolveRoute({Marsh, Alias}, TEXT("marsh"), TEXT("d02"), Package, Error));
    for (const TCHAR* Path : {TEXT("/Engine/Maps/Entry.Entry"), TEXT("/Game/Maps/Marsh.Other"), TEXT("/Game/Maps/Marsh.Marsh:Subobject"), TEXT("None")})
    {
        TestFalse(TEXT("Invalid world asset path"), UHWQuestRunSubsystem::ResolveRoute(
            {Route(TEXT("marsh"), TEXT("d02"), Path)}, TEXT("marsh"), TEXT("d02"), Package, Error));
    }

    FHWRunFixture Fixture;
    if (!TestTrue(TEXT("Fixture catalog and isolated profile ready"), Fixture.bReady)) { return false; }
    TestFalse(TEXT("Prerequisite blocks quest before route lookup"), Fixture.Runs->PrepareQuest(TEXT("q_marsh")));
    TestFalse(TEXT("Training cannot invent a missing map route"), Fixture.Runs->PrepareTraining());
    TestTrue(TEXT("Failed preparation leaves idle"), Fixture.Runs->GetRunState() == EHWQuestRunState::Idle);
    TestFalse(TEXT("Cannot open an unprepared map"), Fixture.Runs->OpenPreparedEncounter());
    TestTrue(TEXT("Preparation never manufactures prerequisite clears"), Fixture.Profile->GetClearCount(TEXT("tutorial")) == 0);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWEncounterLifecycleTest, "Hwanghon.Progression.EncounterLifecycle",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWEncounterLifecycleTest::RunTest(const FString& Parameters)
{
    FHWRunFixture F;
    if (!TestTrue(TEXT("Isolated fixture ready"), F.bReady)) { return false; }
    FGuid Run = FHWQuestRunTestAccess::Request(*F.Runs, F.World);
    TestFalse(TEXT("Cannot credit while traveling"), FHWQuestRunTestAccess::Complete(*F.Runs, F.World, Run));
    TestFalse(TEXT("Cannot discard travel"), F.Runs->ResetRun());
    TestFalse(TEXT("Stale run cannot attach"), FHWQuestRunTestAccess::Attach(*F.Runs, F.World, FGuid::NewGuid()));
    TestTrue(TEXT("Wrong arrival aborts rather than hanging"), F.Runs->GetRunState() == EHWQuestRunState::Aborted);
    F.Runs->ResetRun();
    Run = FHWQuestRunTestAccess::Request(*F.Runs, F.World);
    TestFalse(TEXT("Wrong arena cannot attach"), FHWQuestRunTestAccess::Attach(*F.Runs, F.World, Run, TEXT("sewage")));
    F.Runs->ResetRun();
    Run = FHWQuestRunTestAccess::Request(*F.Runs, F.World);
    TestFalse(TEXT("Wrong dungeon cannot attach"), FHWQuestRunTestAccess::Attach(*F.Runs, F.World, Run, TEXT("marsh"), TEXT("d03")));
    F.Runs->ResetRun();
    Run = FHWQuestRunTestAccess::Request(*F.Runs, F.World);
    {
        FHWRunFixture Other;
        if (!TestTrue(TEXT("Other map fixture ready"), Other.bReady)) { return false; }
        TestFalse(TEXT("Correct token in wrong map cannot attach"), FHWQuestRunTestAccess::Attach(*F.Runs, Other.World, Run));
    }
    F.Runs->ResetRun();
    Run = FHWQuestRunTestAccess::Request(*F.Runs, F.World);
    FHWQuestRunTestAccess::Loaded(*F.Runs, F.World);
    TestTrue(TEXT("Map with no combat acknowledgment aborts"), F.Runs->GetRunState() == EHWQuestRunState::Aborted);
    F.Runs->ResetRun();
    Run = FHWQuestRunTestAccess::Request(*F.Runs, F.World);
    FHWQuestRunTestAccess::TravelFailed(*F.Runs, F.World);
    TestTrue(TEXT("Travel engine failure aborts"), F.Runs->GetRunState() == EHWQuestRunState::Aborted);
    F.Runs->ResetRun();
    Run = FHWQuestRunTestAccess::Request(*F.Runs, F.World);
    TestTrue(TEXT("Matching map attaches"), FHWQuestRunTestAccess::Attach(*F.Runs, F.World, Run));
    TestFalse(TEXT("Cannot reset live combat"), F.Runs->ResetRun());
    TestFalse(TEXT("Stale victory ignored during live combat"), FHWQuestRunTestAccess::Complete(*F.Runs, F.World, FGuid::NewGuid()));
    TestFalse(TEXT("Stale defeat ignored"), FHWQuestRunTestAccess::Defeat(*F.Runs, F.World, FGuid::NewGuid()));
    TestTrue(TEXT("Player death ends run"), FHWQuestRunTestAccess::Defeat(*F.Runs, F.World, Run));
    TestFalse(TEXT("Late boss death after player death grants nothing"), FHWQuestRunTestAccess::Complete(*F.Runs, F.World, Run));
    TestEqual(TEXT("No receipts from failures"), F.Profile->GetClearCount(TEXT("marsh")), 0);
    F.Runs->ResetRun();
    Run = FHWQuestRunTestAccess::Request(*F.Runs, F.World);
    FHWQuestRunTestAccess::Attach(*F.Runs, F.World, Run);
    FHWQuestRunTestAccess::Leave(*F.Runs, F.World, Run);
    TestTrue(TEXT("Leaving live fight aborts"), F.Runs->GetRunState() == EHWQuestRunState::Aborted);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWEncounterVictoryTest, "Hwanghon.Progression.EncounterVictoryPersistence",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWEncounterVictoryTest::RunTest(const FString& Parameters)
{
    FHWRunFixture F;
    if (!TestTrue(TEXT("Isolated fixture ready"), F.bReady)) { return false; }
    const FGuid Run = FHWQuestRunTestAccess::Request(*F.Runs, F.World);
    FHWQuestRunTestAccess::Attach(*F.Runs, F.World, Run);
    F.Storage->bFail = true;
    AddExpectedError(TEXT("save failed"), EAutomationExpectedErrorFlags::Contains, 1);
    TestFalse(TEXT("Disk failure remains pending"), FHWQuestRunTestAccess::Complete(*F.Runs, F.World, Run));
    TestTrue(TEXT("Victory retains its unsaved result"), F.Runs->GetRunState() == EHWQuestRunState::VictoryPendingSave);
    TestFalse(TEXT("Unsaved result cannot be discarded"), F.Runs->ResetRun());
    TestEqual(TEXT("Failed receipt not exposed as committed"), F.Profile->GetClearCount(TEXT("marsh")), 0);
    TestFalse(TEXT("Duplicate completion rejected"), FHWQuestRunTestAccess::Complete(*F.Runs, F.World, Run));

    TStrongObjectPtr<UHWQuestRunTestObserver> Observer(NewObject<UHWQuestRunTestObserver>());
    Observer->Runs = F.Runs.Get();
    F.Profile->OnClearSaved.AddDynamic(Observer.Get(), &UHWQuestRunTestObserver::OnSaved);
    F.Storage->bFail = false;
    TestTrue(TEXT("Retry persists original run"), F.Runs->RetryVictorySave());
    TestEqual(TEXT("Exactly one commit notification"), Observer->Calls, 1);
    TestFalse(TEXT("Save callback cannot reenter victory retry"), Observer->bNestedRetry);
    TestFalse(TEXT("Save callback cannot discard run under outer save"), Observer->bNestedReset);
    TestTrue(TEXT("Successful retry shows victory"), F.Runs->GetRunState() == EHWQuestRunState::Victory);
    TestTrue(TEXT("Original receipt committed"), F.Profile->HasSavedVictory(Run, TEXT("marsh")));
    TestTrue(TEXT("Only cleared quest becomes claimable"), F.Profile->GetQuestState(TEXT("q_marsh")) == EHWQuestState::Cleared);
    TestTrue(TEXT("Next quest unlocks before office claim"), F.Profile->GetQuestState(TEXT("q_sewage")) == EHWQuestState::Available);
    TestEqual(TEXT("No implicit office payout on boss death"), F.Profile->GetGold(), int64(0));
    TestTrue(TEXT("Office reward claims separately"), F.Profile->ClaimQuest(TEXT("q_marsh")));
    TestEqual(TEXT("Source office gold preserved"), F.Profile->GetGold(), int64(18000));
    TestEqual(TEXT("Office material payout is 2100, not arena 24"), F.Profile->GetItemCount(TEXT("m_alloy")), int64(2100));

    TStrongObjectPtr<UHWProfileSubsystem> Reloaded(NewObject<UHWProfileSubsystem>(F.Owner.Get()));
    TestTrue(TEXT("Fresh profile reloads serialized bytes"), Reloaded->InitializeProfile(F.Storage, F.Content->GetQuests()));
    TestTrue(TEXT("Claim survives restart"), Reloaded->GetQuestState(TEXT("q_marsh")) == EHWQuestState::Claimed);
    TestEqual(TEXT("Wallet survives restart"), Reloaded->GetGold(), int64(18000));
    TestTrue(TEXT("Completed run can return to selection"), F.Runs->ResetRun());
    TestFalse(TEXT("Late old callback after reset ignored"), FHWQuestRunTestAccess::Complete(*F.Runs, F.World, Run));
    TestEqual(TEXT("No duplicate victory"), F.Profile->GetClearCount(TEXT("marsh")), 1);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWGameModeQuestOutcomeTest, "Hwanghon.Progression.GameModeQuestOutcome",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWGameModeQuestOutcomeTest::RunTest(const FString& Parameters)
{
    for (int32 Scenario = 0; Scenario < 3; ++Scenario)
    {
        FHWRunFixture F;
        if (!TestTrue(TEXT("Outcome fixture ready"), F.bReady)) { return false; }
        const FGuid Run = FHWQuestRunTestAccess::Request(*F.Runs, F.World);
        FHWQuestRunTestAccess::Attach(*F.Runs, F.World, Run);
        FActorSpawnParameters Spawn;
        Spawn.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
        AHWAinCharacter* Player = F.World->SpawnActor<AHWAinCharacter>(FVector::ZeroVector, FRotator::ZeroRotator, Spawn);
        AHWBossCharacter* Boss = F.World->SpawnActor<AHWBossCharacter>(FVector(400.f, 0.f, 0.f), FRotator::ZeroRotator, Spawn);
        AHWCombatGameMode* Mode = F.World->SpawnActor<AHWCombatGameMode>();
        if (!TestNotNull(TEXT("Player"), Player) || !TestNotNull(TEXT("Boss"), Boss) || !TestNotNull(TEXT("GameMode"), Mode)) { return false; }
        Player->DispatchBeginPlay();
        Player->GetCombat()->UseNeutralCharacterModifiers();
        Boss->DispatchBeginPlay();
        FHWQuestRunTestAccess::BindMode(*Mode, *F.Runs, Player, Boss);
        TStrongObjectPtr<UHWQuestRunTestObserver> Observer(NewObject<UHWQuestRunTestObserver>());
        Observer->Boss = Boss;
        if (Scenario == 0)
        {
            Boss->ReceivePlayerHit(Boss->GetHealth(), EHWAttackTier::Light, FVector::ZeroVector);
            TestTrue(TEXT("Tracked boss death records run"), F.Runs->GetRunState() == EHWQuestRunState::Victory);
            TestEqual(TEXT("GameMode connects to durable profile"), F.Profile->GetClearCount(TEXT("marsh")), 1);
        }
        else if (Scenario == 1)
        {
            // No possession remains to query; the original participant is authoritative.
            Player->GetCombat()->OnDamaged.AddDynamic(Observer.Get(), &UHWQuestRunTestObserver::KillBossFromDamage);
            Player->GetCombat()->ApplyIncomingDamage(Player->GetCombat()->GetHealth(), EHWAttackTier::Light);
            TestTrue(TEXT("Lethal callback can also kill boss"), Boss->IsDead());
            TestTrue(TEXT("Already dead original player takes precedence"), F.Runs->GetRunState() == EHWQuestRunState::Defeat);
            TestEqual(TEXT("Simultaneous callback cannot award victory"), F.Profile->GetClearCount(TEXT("marsh")), 0);
        }
        else
        {
            Player->Destroy();
            Boss->ReceivePlayerHit(Boss->GetHealth(), EHWAttackTier::Light, FVector::ZeroVector);
            TestTrue(TEXT("Destroyed participant cannot win"), F.Runs->GetRunState() == EHWQuestRunState::Defeat);
            TestEqual(TEXT("Destroyed player has no clear receipt"), F.Profile->GetClearCount(TEXT("marsh")), 0);
        }
    }
    return true;
}

#endif
