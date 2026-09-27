#include "Progression/HWProfileSubsystem.h"
#include "Content/HWGameContentSubsystem.h"
#include "Kismet/GameplayStatics.h"
#include "Subsystems/SubsystemCollection.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "HAL/IConsoleManager.h"

namespace
{
    const FString ProfileSlot = TEXT("HwanghonCombatUE_Profile_v1");
    constexpr int32 ProfileUser = 0;
#if !UE_BUILD_SHIPPING
    TAutoConsoleVariable<int32> FailQASaves(TEXT("hw.QA.FailProfileSaves"), 0,
        TEXT("Simulate storage failure only for explicitly isolated HWShellQA profiles."), ECVF_Cheat);
#endif

    class FHWPlatformProfileStorage final : public IHWProfileStorage
    {
    public:
        FHWPlatformProfileStorage() : Slot(ProfileSlot)
        {
#if !UE_BUILD_SHIPPING
            if (FParse::Param(FCommandLine::Get(), TEXT("HWShellQA")))
            {
                FString Override;
                const bool bFound = FParse::Value(FCommandLine::Get(), TEXT("HWProfileSlot="), Override);
                bool bSafeCharacters = true;
                for (TCHAR C : Override) { bSafeCharacters &= FChar::IsAlnum(C) || C == TCHAR('_'); }
                const bool bSafe = bFound && Override.StartsWith(TEXT("Hwanghon_Automation_"))
                    && Override.Len() > 19 && Override.Len() <= 100
                    && bSafeCharacters;
                // Malformed QA flags must never fall back to a user's real slot.
                Slot = bSafe ? Override : FString();
                bAutomationProfile = bSafe;
            }
#endif
        }
        virtual bool Exists() const override { return Slot.IsEmpty() || UGameplayStatics::DoesSaveGameExist(Slot, ProfileUser); }
        virtual UHWSaveGame* Load() override { return Slot.IsEmpty() ? nullptr : Cast<UHWSaveGame>(UGameplayStatics::LoadGameFromSlot(Slot, ProfileUser)); }
        virtual bool Save(UHWSaveGame* Candidate) override
        {
#if !UE_BUILD_SHIPPING
            if (bAutomationProfile && FailQASaves.GetValueOnGameThread() != 0) { return false; }
#endif
            return !Slot.IsEmpty() && UGameplayStatics::SaveGameToSlot(Candidate, Slot, ProfileUser);
        }
    private:
        FString Slot;
        bool bAutomationProfile = false;
    };
}

void UHWProfileSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    UHWGameContentSubsystem* Content = Collection.InitializeDependency<UHWGameContentSubsystem>();
    if (!Content || !Content->IsContentLoaded())
    {
        bInitialized = true;
        Fail(TEXT("Quest catalog unavailable. Existing save has not been replaced."));
        return;
    }
    InitializeProfile(MakeShared<FHWPlatformProfileStorage>(), Content->GetQuests());
}

bool UHWProfileSubsystem::InitializeProfile(TSharedRef<IHWProfileStorage> InStorage, const TArray<FHWQuestDefinition>& InQuests)
{
    if (bInitialized) return Fail(TEXT("A live profile cannot be reinitialized."));
    bInitialized = true;
    Storage = InStorage;
    Quests = InQuests;
    RewardRandom.GenerateNewSeed();
    UHWSaveGame* Loaded = Storage->Exists() ? Storage->Load() : NewObject<UHWSaveGame>(this);
    if (!Loaded || !Loaded->MigrateToCurrentVersion() || !Loaded->ValidateAgainstCatalog(Quests))
    {
        // Never overwrite unreadable, truncated, inconsistent, or future data.
        return Fail(TEXT("Existing profile or quest catalog is invalid or unsupported. Save is disabled."));
    }
    Profile = DuplicateObject<UHWSaveGame>(Loaded, this);
    return true;
}

bool UHWProfileSubsystem::Fail(const FString& Message)
{
    LastError = Message;
    UE_LOG(LogTemp, Warning, TEXT("Hwanghon profile: %s"), *Message);
    // An error listener may retry immediately; repeated storage failure must not
    // recursively broadcast the same callback until the stack overflows.
    if (!bDispatchingError)
    {
        TGuardValue<bool> ErrorGuard(bDispatchingError, true);
        OnProfileError.Broadcast(Message);
    }
    return false;
}

bool UHWProfileSubsystem::RecordVictory(const FGuid& RunId, FName EncounterId)
{
    if (!RunId.IsValid() || EncounterId.IsNone()) return Fail(TEXT("Victory requires a valid run ID and encounter ID."));
    if (!Profile) return Fail(TEXT("Profile unavailable; existing save has not been replaced."));
    // Accumulate receipts across retries/map transitions while storage is unavailable.
    UHWSaveGame* Candidate = DuplicateObject<UHWSaveGame>(PendingProfile ? PendingProfile.Get() : Profile.Get(), this);
    if (!Candidate->RecordClear(RunId, EncounterId)) return Fail(TEXT("Victory receipt was invalid or reused for another encounter."));
    if (!PendingProfile && Candidate->Clears.Num() == Profile->Clears.Num()) return true;
    PendingProfile = Candidate;
    return RetryPendingSave();
}

bool UHWProfileSubsystem::ClaimQuest(FName QuestId)
{
    if (!Profile) return Fail(TEXT("Profile unavailable; existing save has not been replaced."));
    const FHWQuestDefinition* Quest = Quests.FindByPredicate([QuestId](const FHWQuestDefinition& Row) { return Row.Id == QuestId; });
    if (!Quest) return Fail(TEXT("Unknown quest cannot be claimed."));
    if (Profile->GetQuestState(*Quest) == EHWQuestState::Claimed) return Fail(TEXT("Quest reward was already claimed."));
    // A failed save has already resolved rewards. Retry that exact candidate.
    if (PendingProfile && PendingProfile->GetQuestState(*Quest) == EHWQuestState::Claimed) return RetryPendingSave();
    UHWSaveGame* Candidate = DuplicateObject<UHWSaveGame>(PendingProfile ? PendingProfile.Get() : Profile.Get(), this);
    if (!Candidate->ClaimQuest(*Quest, RewardRandom)) return Fail(TEXT("Quest must be cleared and rewards must be valid before claiming."));
    PendingProfile = Candidate;
    return RetryPendingSave();
}

bool UHWProfileSubsystem::RetryPendingSave()
{
    if (!PendingProfile || !Profile || !Storage) return false;
    if (!PendingProfile->ValidateAgainstCatalog(Quests)) return Fail(TEXT("Pending profile failed validation. Save is disabled."));
    if (!Storage->Save(PendingProfile)) return Fail(TEXT("Profile save failed. Exact receipts retained in memory for RetryPendingSave."));

    TSet<FName> ChangedEncounters;
    for (int32 Index = Profile->Clears.Num(); Index < PendingProfile->Clears.Num(); ++Index)
    {
        ChangedEncounters.Add(PendingProfile->Clears[Index].EncounterId);
    }
    const int32 FirstNewClaim = Profile->Claims.Num();
    Profile = PendingProfile;
    PendingProfile = nullptr;
    LastError.Reset();
    for (FName EncounterId : ChangedEncounters)
    {
        FNotification Notification;
        Notification.Id = EncounterId;
        Notification.ClearCount = Profile->GetClearCount(EncounterId);
        PendingNotifications.Add(Notification);
    }
    for (int32 Index = FirstNewClaim; Index < Profile->Claims.Num(); ++Index)
    {
        FNotification Notification;
        Notification.Id = Profile->Claims[Index].QuestId;
        Notification.bClaim = true;
        PendingNotifications.Add(Notification);
    }
    // Dispatch immutable committed events in order, even when a listener causes
    // another save. Neither failures nor a no-op retry emits a claim notification.
    if (!bDispatchingNotifications)
    {
        TGuardValue<bool> DispatchGuard(bDispatchingNotifications, true);
        while (!PendingNotifications.IsEmpty())
        {
            const FNotification Notification = PendingNotifications[0];
            PendingNotifications.RemoveAt(0);
            if (Notification.bClaim) OnQuestClaimed.Broadcast(Notification.Id);
            else OnClearSaved.Broadcast(Notification.Id, Notification.ClearCount);
        }
    }
    return true;
}

int32 UHWProfileSubsystem::GetClearCount(FName EncounterId) const
{
    return Profile ? Profile->GetClearCount(EncounterId) : 0;
}

bool UHWProfileSubsystem::HasSavedVictory(const FGuid& RunId, FName EncounterId) const
{
    return Profile && Profile->HasClear(RunId, EncounterId);
}

EHWQuestState UHWProfileSubsystem::GetQuestState(FName QuestId) const
{
    const FHWQuestDefinition* Quest = Quests.FindByPredicate([QuestId](const FHWQuestDefinition& Row) { return Row.Id == QuestId; });
    return Profile && Quest ? Profile->GetQuestState(*Quest) : EHWQuestState::Unavailable;
}

int64 UHWProfileSubsystem::GetGold() const { return Profile ? Profile->Gold : 0; }
int64 UHWProfileSubsystem::GetExperience() const { return Profile ? Profile->Experience : 0; }
int64 UHWProfileSubsystem::GetItemCount(FName ItemId) const { return Profile ? Profile->Inventory.FindRef(ItemId) : 0; }
