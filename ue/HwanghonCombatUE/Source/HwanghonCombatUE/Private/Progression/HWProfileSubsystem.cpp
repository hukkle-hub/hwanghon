#include "Progression/HWProfileSubsystem.h"
#include "Progression/HWSaveGame.h"
#include "Kismet/GameplayStatics.h"

namespace
{
    const FString ProfileSlot = TEXT("HwanghonCombatUE_Profile_v1");
    constexpr int32 ProfileUser = 0;
}

void UHWProfileSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    if (UGameplayStatics::DoesSaveGameExist(ProfileSlot, ProfileUser))
    {
        Profile = Cast<UHWSaveGame>(UGameplayStatics::LoadGameFromSlot(ProfileSlot, ProfileUser));
        if (!Profile || !Profile->IsValidProfile())
        {
            // Never overwrite an unreadable or newer profile with an empty save.
            Profile = nullptr;
            Fail(TEXT("Existing profile could not be loaded or has an unsupported schema. Save is disabled."));
        }
    }
    else
    {
        Profile = NewObject<UHWSaveGame>(this);
    }
}

bool UHWProfileSubsystem::Fail(const FString& Message)
{
    LastError = Message;
    UE_LOG(LogTemp, Warning, TEXT("Hwanghon profile: %s"), *Message);
    OnProfileError.Broadcast(Message);
    return false;
}

bool UHWProfileSubsystem::RecordVictory(const FGuid& RunId, FName EncounterId)
{
    if (!RunId.IsValid() || EncounterId.IsNone())
    {
        return Fail(TEXT("Victory requires a valid run ID and encounter ID."));
    }
    if (!Profile)
    {
        return Fail(TEXT("Profile unavailable; existing save has not been replaced."));
    }
    // Accumulate receipts across retries/map transitions if storage is temporarily unavailable.
    UHWSaveGame* Candidate = DuplicateObject<UHWSaveGame>(PendingProfile ? PendingProfile.Get() : Profile.Get(), this);
    if (!Candidate->RecordClear(RunId, EncounterId))
    {
        return Fail(TEXT("Victory receipt was invalid or reused for another encounter."));
    }
    if (Candidate->Clears.Num() == Profile->Clears.Num())
    {
        return true;
    }

    PendingProfile = Candidate;
    return RetryPendingSave();
}

bool UHWProfileSubsystem::RetryPendingSave()
{
    if (!PendingProfile || !Profile)
    {
        return false;
    }
    if (!UGameplayStatics::SaveGameToSlot(PendingProfile, ProfileSlot, ProfileUser))
    {
        return Fail(TEXT("Victory save failed. Receipt retained in memory for RetryPendingSave."));
    }

    TSet<FName> ChangedEncounters;
    for (int32 Index = Profile->Clears.Num(); Index < PendingProfile->Clears.Num(); ++Index)
    {
        ChangedEncounters.Add(PendingProfile->Clears[Index].EncounterId);
    }
    Profile = PendingProfile;
    PendingProfile = nullptr;
    LastError.Reset();
    for (FName EncounterId : ChangedEncounters)
    {
        PendingNotifications.Emplace(EncounterId, Profile->GetClearCount(EncounterId));
    }
    // A UI callback may synchronously save another victory. Finish delivering this
    // committed snapshot before dispatching notifications from that nested save.
    if (!bDispatchingNotifications)
    {
        TGuardValue<bool> DispatchGuard(bDispatchingNotifications, true);
        while (!PendingNotifications.IsEmpty())
        {
            const TPair<FName, int32> Notification = PendingNotifications[0];
            PendingNotifications.RemoveAt(0);
            OnClearSaved.Broadcast(Notification.Key, Notification.Value);
        }
    }
    return true;
}

int32 UHWProfileSubsystem::GetClearCount(FName EncounterId) const
{
    return Profile ? Profile->GetClearCount(EncounterId) : 0;
}
