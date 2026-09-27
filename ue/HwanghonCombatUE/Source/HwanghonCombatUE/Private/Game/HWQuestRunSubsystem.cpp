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
    FString Reason;
    if (!CanPrepareQuest(QuestId, Reason)) { return Fail(Reason); }
    FHWQuestDefinition Quest;
    Content->GetQuest(QuestId, Quest);
    return Prepare(Quest.Id, Quest.ArenaId, Quest.DungeonId);
}

bool UHWQuestRunSubsystem::CanPrepareQuest(FName QuestId, FString& OutReason) const
{
    OutReason.Reset();
    FHWQuestDefinition Quest;
    if (!Content || !Content->IsContentLoaded() || !Content->GetQuest(QuestId, Quest)
        || !Profile || !Profile->IsProfileAvailable())
    {
        OutReason = TEXT("Quest catalog or saved profile is unavailable.");
        return false;
    }
    const EHWQuestState QuestState = Profile->GetQuestState(QuestId);
    if (QuestState == EHWQuestState::Unavailable || QuestState == EHWQuestState::Locked)
    {
        OutReason = TEXT("Complete the prerequisite encounter before selecting this quest.");
        return false;
    }
    FString Package;
    return CanPrepareEncounter(Quest.ArenaId, Quest.DungeonId, Package, OutReason);
}

bool UHWQuestRunSubsystem::PrepareTraining()
{
    FString Reason;
    if (!CanPrepareTraining(Reason)) { return Fail(Reason); }
    return Prepare(NAME_None, TEXT("tutorial"), TEXT("d01"));
}

bool UHWQuestRunSubsystem::CanPrepareTraining(FString& OutReason) const
{
    OutReason.Reset();
    if (!Content || !Content->IsContentLoaded() || !Profile || !Profile->IsProfileAvailable())
    {
        OutReason = TEXT("Quest catalog or saved profile is unavailable.");
        return false;
    }
    FString Package;
    return CanPrepareEncounter(TEXT("tutorial"), TEXT("d01"), Package, OutReason);
}

bool UHWQuestRunSubsystem::CanPrepareEncounter(FName ArenaId, FName DungeonId,
    FString& OutPackage, FString& OutReason) const
{
    OutPackage.Reset();
    OutReason.Reset();
    if (bSavingVictory || bReturningToLobby
        || (State != EHWQuestRunState::Idle && State != EHWQuestRunState::Prepared))
    {
        OutReason = TEXT("Finish or reset the previous run before selecting another encounter.");
        return false;
    }
    if (!Profile || !Profile->IsProfileAvailable() || Profile->HasPendingSave())
    {
        OutReason = TEXT("A saved profile is required; retry any pending save before starting another run.");
        return false;
    }
    if (!ResolveRoute(GetDefault<UHWEncounterSettings>()->Routes, ArenaId, DungeonId, OutPackage, OutReason))
    {
        return false;
    }
    if (!FPackageName::DoesPackageExist(OutPackage))
    {
        OutPackage.Reset();
        OutReason = TEXT("The encounter map is not installed/cooked. Selection was not changed.");
        return false;
    }
    return true;
}

bool UHWQuestRunSubsystem::Prepare(FName QuestId, FName ArenaId, FName DungeonId)
{
    FString Package, Reason;
    if (!CanPrepareEncounter(ArenaId, DungeonId, Package, Reason)) { return Fail(Reason); }

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
    if (bSavingVictory || bReturningToLobby || State != EHWQuestRunState::Prepared || !GetWorld() || !Profile
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
    if (bReturningToLobby || State != EHWQuestRunState::Traveling || !World || !RequestedRun.IsValid()
        || RequestedRun != Ticket.RunId || ArenaId != Ticket.ArenaId || DungeonId != Ticket.DungeonId
        || GetMapPackage(World) != Ticket.MapPackageName)
    {
        // A manually opened graybox must never clear whichever quest was selected.
        if (State == EHWQuestRunState::Traveling)
        {
            if (!RestoreRetryResult()) { State = EHWQuestRunState::Aborted; }
        }
        return Fail(TEXT("Loaded encounter does not match the requested run, map and arena/dungeon identity."));
    }
    ActiveWorld = World;
    bRetryTravel = false;
    PreviousTicket = FHWQuestRunTicket();
    PreviousWorld.Reset();
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
    if (bSavingVictory || bReturningToLobby || State != EHWQuestRunState::VictoryPendingSave || !Profile)
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
    if (bSavingVictory || bReturningToLobby || State == EHWQuestRunState::Traveling || State == EHWQuestRunState::InCombat
        || State == EHWQuestRunState::VictoryPendingSave || (Profile && Profile->HasPendingSave()))
    {
        return Fail(TEXT("An active run or pending save cannot be discarded."));
    }
    Ticket = FHWQuestRunTicket();
    State = EHWQuestRunState::Idle;
    ActiveWorld.Reset();
    bRetryTravel = false;
    PreviousTicket = FHWQuestRunTicket();
    PreviousWorld.Reset();
    LastError.Reset();
    return true;
}

bool UHWQuestRunSubsystem::ReturnToLobby(bool bAbandonActiveRun)
{
    if (bSavingVictory || bReturningToLobby || State == EHWQuestRunState::Traveling
        || State == EHWQuestRunState::VictoryPendingSave || !Profile
        || !Profile->IsProfileAvailable() || Profile->HasPendingSave())
    {
        return Fail(TEXT("Finish travel and retry any pending save before returning to the lobby."));
    }
    if (State == EHWQuestRunState::InCombat && !bAbandonActiveRun)
    {
        return Fail(TEXT("Returning during combat requires an explicit abandon request."));
    }
    const FSoftObjectPath Path = GetDefault<UHWEncounterSettings>()->LobbyMap.ToSoftObjectPath();
    const FString Package = Path.GetLongPackageName();
    if (!Path.IsValid() || !Path.GetSubPathString().IsEmpty() || !Package.StartsWith(TEXT("/Game/"))
        || !FPackageName::IsValidLongPackageName(Package)
        || Path.GetAssetName() != FPackageName::GetShortName(Package)
        || !FPackageName::DoesPackageExist(Package))
    {
        return Fail(TEXT("The configured lobby map is not installed/cooked. The run was retained."));
    }
    if (!GetWorld())
    {
        return Fail(TEXT("A world is required to return to the lobby. The run was retained."));
    }
    // Commit abandonment before any EndPlay callback. Never manufacture a clear
    // when leaving live combat, and never erase a result before map acknowledgment.
    if (State == EHWQuestRunState::InCombat) { State = EHWQuestRunState::Aborted; }
    bReturningToLobby = true;
    LobbyTravelPackage = Package;
    LastError.Reset();
    UGameplayStatics::OpenLevel(this, FName(*Package), true);
    return true;
}

bool UHWQuestRunSubsystem::RetryEncounter()
{
    if (bSavingVictory || bReturningToLobby || !Profile || !Profile->IsProfileAvailable()
        || Profile->HasPendingSave() || !Ticket.RunId.IsValid()
        || (State != EHWQuestRunState::Victory && State != EHWQuestRunState::Defeat
            && State != EHWQuestRunState::Aborted))
    {
        return Fail(TEXT("Only a finished encounter with no pending save can be retried."));
    }
    if (!GetWorld()) { return Fail(TEXT("A world is required to retry the encounter.")); }
    const FHWQuestRunTicket OldTicket = Ticket;
    const EHWQuestRunState OldState = State;
    const TWeakObjectPtr<UWorld> OldWorld = ActiveWorld;
    if (!ResetRun()) { return false; }
    PreviousTicket = OldTicket;
    PreviousState = OldState;
    PreviousWorld = OldWorld;
    bRetryTravel = true;
    const bool bPrepared = OldTicket.QuestId.IsNone()
        ? (OldTicket.ArenaId == TEXT("tutorial") && OldTicket.DungeonId == TEXT("d01") && PrepareTraining())
        : PrepareQuest(OldTicket.QuestId);
    if (!bPrepared || !OpenPreparedEncounter())
    {
        RestoreRetryResult();
        if (LastError.IsEmpty()) { LastError = TEXT("The previous encounter cannot be retried."); }
        return false;
    }
    return true;
}

bool UHWQuestRunSubsystem::RestoreRetryResult()
{
    if (!bRetryTravel) { return false; }
    Ticket = PreviousTicket;
    State = PreviousState;
    ActiveWorld = PreviousWorld;
    bRetryTravel = false;
    PreviousTicket = FHWQuestRunTicket();
    PreviousWorld.Reset();
    return true;
}

void UHWQuestRunSubsystem::HandleTravelFailure(UWorld* World, ETravelFailure::Type Failure, const FString& Message)
{
    if (!World || World->GetGameInstance() != GetGameInstance()) { return; }
    if (bReturningToLobby)
    {
        bReturningToLobby = false;
        LobbyTravelPackage.Reset();
        LastError = TEXT("Lobby travel failed; the run was retained: ") + Message;
    }
    else if (State == EHWQuestRunState::Traveling)
    {
        if (!RestoreRetryResult()) { State = EHWQuestRunState::Aborted; }
        LastError = TEXT("Encounter travel failed: ") + Message;
    }
}

void UHWQuestRunSubsystem::HandleMapLoaded(UWorld* World)
{
    if (!World || World->GetGameInstance() != GetGameInstance()) { return; }
    if (bReturningToLobby)
    {
        bReturningToLobby = false;
        const bool bCorrectLobby = GetMapPackage(World) == LobbyTravelPackage;
        LobbyTravelPackage.Reset();
        if (bCorrectLobby) { ResetRun(); }
        else { LastError = TEXT("A different map loaded; the previous run was retained."); }
        return;
    }
    // PostLoadMap runs after BeginPlay. A different GameMode would never attach.
    if (State == EHWQuestRunState::Traveling)
    {
        if (!RestoreRetryResult()) { State = EHWQuestRunState::Aborted; }
        LastError = TEXT("Map loaded without acknowledging the requested combat encounter.");
    }
}
