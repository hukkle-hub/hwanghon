#include "Game/HWQuestRunSubsystem.h"
#include "Content/HWGameContentSubsystem.h"
#include "Progression/HWProfileSubsystem.h"
#include "Progression/HWSaveGame.h"
#include "Engine/Engine.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/PackageName.h"
#include "UObject/UObjectGlobals.h"

void UHWQuestRunSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    Collection.InitializeDependency<UHWGameContentSubsystem>();
    Collection.InitializeDependency<UHWProfileSubsystem>();
    Content = GetGameInstance()->GetSubsystem<UHWGameContentSubsystem>();
    Profile = GetGameInstance()->GetSubsystem<UHWProfileSubsystem>();
    MapLoadedHandle = FCoreUObjectDelegates::PostLoadMapWithWorld.AddUObject(this, &UHWQuestRunSubsystem::HandleMapLoaded);
    if (GEngine)
    {
        TravelFailureHandle = GEngine->OnTravelFailure().AddUObject(this, &UHWQuestRunSubsystem::HandleTravelFailure);
    }
}

void UHWQuestRunSubsystem::Deinitialize()
{
    FCoreUObjectDelegates::PostLoadMapWithWorld.Remove(MapLoadedHandle);
    if (GEngine)
    {
        GEngine->OnTravelFailure().Remove(TravelFailureHandle);
    }
    Super::Deinitialize();
}

bool UHWQuestRunSubsystem::Fail(const FString& Message)
{
    LastError = Message;
    return false;
}

bool UHWQuestRunSubsystem::ResolveRoute(const TArray<FHWEncounterRoute>& Routes,
    FName ArenaId, FName DungeonId, FString& OutPackage, FString& OutError)
{
    OutPackage.Reset();
    OutError.Reset();
    if (ArenaId.IsNone() || DungeonId.IsNone())
    {
        OutError = TEXT("Encounter identity is missing.");
        return false;
    }
    const FHWEncounterRoute* Match = nullptr;
    for (const FHWEncounterRoute& Route : Routes)
    {
        if (Route.ArenaId == ArenaId || Route.DungeonId == DungeonId)
        {
            if (Match || Route.ArenaId != ArenaId || Route.DungeonId != DungeonId)
            {
                OutError = TEXT("Encounter routes contain conflicting arena/dungeon identities.");
                return false;
            }
            Match = &Route;
        }
    }
    if (!Match)
    {
        OutError = TEXT("No authored UE map is registered for this encounter.");
        return false;
    }
    const FSoftObjectPath Path = Match->Map.ToSoftObjectPath();
    const FString Package = Path.GetLongPackageName();
    if (!Path.IsValid() || !Path.GetSubPathString().IsEmpty()
        || !Package.StartsWith(TEXT("/Game/")) || !FPackageName::IsValidLongPackageName(Package)
        || Path.GetAssetName() != FPackageName::GetShortName(Package))
    {
        OutError = TEXT("Encounter route must name a world asset under /Game/.");
        return false;
    }
    // One map cannot silently stand in for several distinct arena definitions.
    for (const FHWEncounterRoute& Route : Routes)
    {
        if (&Route != Match && Route.Map.ToSoftObjectPath().GetLongPackageName() == Package)
        {
            OutError = TEXT("Several encounters share the same map; author an explicit map per encounter.");
            return false;
        }
    }
    OutPackage = Package;
    return true;
}

bool UHWQuestRunSubsystem::PrepareQuest(FName QuestId)
{
    FHWQuestDefinition Quest;
    if (!Content || !Content->IsContentLoaded() || !Content->GetQuest(QuestId, Quest)
        || !Profile || !Profile->IsProfileAvailable())
    {
        return Fail(TEXT("Quest catalog or saved profile is unavailable."));
    }
    const EHWQuestState QuestState = Profile->GetQuestState(QuestId);
    if (QuestState == EHWQuestState::Unavailable || QuestState == EHWQuestState::Locked)
    {
        return Fail(TEXT("Complete the prerequisite encounter before selecting this quest."));
    }
    return Prepare(Quest.Id, Quest.ArenaId, Quest.DungeonId);
}

bool UHWQuestRunSubsystem::PrepareTraining()
{
    if (!Content || !Content->IsContentLoaded() || !Profile || !Profile->IsProfileAvailable())
    {
        return Fail(TEXT("Quest catalog or saved profile is unavailable."));
    }
    return Prepare(NAME_None, TEXT("tutorial"), TEXT("d01"));
}

bool UHWQuestRunSubsystem::Prepare(FName QuestId, FName ArenaId, FName DungeonId)
{
    if (State != EHWQuestRunState::Idle && State != EHWQuestRunState::Prepared)
    {
        return Fail(TEXT("Finish or reset the previous run before selecting another encounter."));
    }
    if (Profile->HasPendingSave())
    {
        return Fail(TEXT("Retry the pending profile save before starting another run."));
    }
    FString Package;
    FString RouteError;
    if (!ResolveRoute(GetDefault<UHWEncounterSettings>()->Routes, ArenaId, DungeonId, Package, RouteError))
    {
        return Fail(RouteError);
    }
    if (!FPackageName::DoesPackageExist(Package))
    {
        return Fail(TEXT("The encounter map is not installed/cooked. Selection was not changed."));
    }

    FHWQuestRunTicket NewTicket;
    NewTicket.RunId = FGuid::NewGuid();
    NewTicket.QuestId = QuestId;
    NewTicket.ArenaId = ArenaId;
    NewTicket.DungeonId = DungeonId;
    NewTicket.MapPackageName = Package;
    Ticket = NewTicket;
    State = EHWQuestRunState::Prepared;
    LastError.Reset();
    return true;
}

bool UHWQuestRunSubsystem::OpenPreparedEncounter()
{
    if (State != EHWQuestRunState::Prepared || !GetWorld() || !Profile
        || !Profile->IsProfileAvailable() || Profile->HasPendingSave())
    {
        return Fail(TEXT("A prepared encounter and a saved profile are required to travel."));
    }
    if (!FPackageName::DoesPackageExist(Ticket.MapPackageName))
    {
        return Fail(TEXT("Prepared encounter map no longer exists."));
    }
    State = EHWQuestRunState::Traveling;
    LastError.Reset();
    UGameplayStatics::OpenLevel(this, FName(*Ticket.MapPackageName), true,
        TEXT("HWRun=") + Ticket.RunId.ToString(EGuidFormats::Digits));
    return true; // Map readiness is acknowledged by AttachEncounter, not by OpenLevel.
}

FString UHWQuestRunSubsystem::GetMapPackage(const UWorld* World)
{
    if (!World)
    {
        return FString();
    }
    const FString Package = World->GetOutermost()->GetName();
    FString Name = FPackageName::GetShortName(Package);
    if (!World->StreamingLevelsPrefix.IsEmpty())
    {
        Name.RemoveFromStart(World->StreamingLevelsPrefix);
    }
    return FPackageName::GetLongPackagePath(Package) + TEXT("/") + Name;
}

bool UHWQuestRunSubsystem::AttachEncounter(UWorld* World, FName ArenaId, FName DungeonId,
    const FGuid& RequestedRun, FGuid& OutRun)
{
    OutRun.Invalidate();
    if (State != EHWQuestRunState::Traveling || !World || !RequestedRun.IsValid()
        || RequestedRun != Ticket.RunId || ArenaId != Ticket.ArenaId || DungeonId != Ticket.DungeonId
        || GetMapPackage(World) != Ticket.MapPackageName)
    {
        // A manually opened graybox must never clear whichever quest was selected.
        if (State == EHWQuestRunState::Traveling)
        {
            State = EHWQuestRunState::Aborted;
        }
        return Fail(TEXT("Loaded encounter does not match the requested run, map and arena/dungeon identity."));
    }
    ActiveWorld = World;
    State = EHWQuestRunState::InCombat;
    OutRun = Ticket.RunId;
    LastError.Reset();
    return true;
}

bool UHWQuestRunSubsystem::CompleteEncounter(UWorld* World, const FGuid& RunId)
{
    if (State != EHWQuestRunState::InCombat || ActiveWorld.Get() != World || !World || RunId != Ticket.RunId)
    {
        return false;
    }
    State = EHWQuestRunState::VictoryPendingSave; // Commit lifecycle before calling delegates/storage.
    TGuardValue<bool> SaveGuard(bSavingVictory, true);
    if (Profile && Profile->RecordVictory(Ticket.RunId, Ticket.ArenaId))
    {
        State = EHWQuestRunState::Victory;
        LastError.Reset();
        return true;
    }
    return Fail(Profile ? Profile->GetLastError() : TEXT("Profile unavailable; victory has not been saved."));
}

bool UHWQuestRunSubsystem::RetryVictorySave()
{
    if (bSavingVictory || State != EHWQuestRunState::VictoryPendingSave || !Profile)
    {
        return false;
    }
    TGuardValue<bool> SaveGuard(bSavingVictory, true);
    if (!Profile->HasSavedVictory(Ticket.RunId, Ticket.ArenaId))
    {
        // Also rebuild the receipt when the original profile call never reached storage.
        Profile->RecordVictory(Ticket.RunId, Ticket.ArenaId);
    }
    if (!Profile->HasSavedVictory(Ticket.RunId, Ticket.ArenaId))
    {
        return Fail(Profile->GetLastError());
    }
    State = EHWQuestRunState::Victory;
    LastError.Reset();
    return true;
}

bool UHWQuestRunSubsystem::FailEncounter(UWorld* World, const FGuid& RunId)
{
    if (State != EHWQuestRunState::InCombat || !World || ActiveWorld.Get() != World || RunId != Ticket.RunId)
    {
        return false;
    }
    State = EHWQuestRunState::Defeat;
    LastError.Reset();
    return true;
}

void UHWQuestRunSubsystem::LeaveEncounter(UWorld* World, const FGuid& RunId)
{
    if (State == EHWQuestRunState::InCombat && ActiveWorld.Get() == World && RunId == Ticket.RunId)
    {
        State = EHWQuestRunState::Aborted;
        LastError = TEXT("Encounter ended before a victory was recorded.");
    }
}

bool UHWQuestRunSubsystem::ResetRun()
{
    if (bSavingVictory || State == EHWQuestRunState::Traveling || State == EHWQuestRunState::InCombat
        || State == EHWQuestRunState::VictoryPendingSave || (Profile && Profile->HasPendingSave()))
    {
        return Fail(TEXT("An active run or pending save cannot be discarded."));
    }
    Ticket = FHWQuestRunTicket();
    State = EHWQuestRunState::Idle;
    ActiveWorld.Reset();
    LastError.Reset();
    return true;
}

void UHWQuestRunSubsystem::HandleTravelFailure(UWorld* World, ETravelFailure::Type Failure, const FString& Message)
{
    if (State == EHWQuestRunState::Traveling && World && World->GetGameInstance() == GetGameInstance())
    {
        State = EHWQuestRunState::Aborted;
        LastError = TEXT("Encounter travel failed: ") + Message;
    }
}

void UHWQuestRunSubsystem::HandleMapLoaded(UWorld* World)
{
    // PostLoadMap runs after BeginPlay. A different GameMode would never attach.
    if (State == EHWQuestRunState::Traveling && World && World->GetGameInstance() == GetGameInstance())
    {
        State = EHWQuestRunState::Aborted;
        LastError = TEXT("Map loaded without acknowledging the requested combat encounter.");
    }
}
