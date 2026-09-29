#include "HHHubSubsystem.h"
#include "HHShelterStation.h"
#include "HHShelterNPC.h"

void UHHHubSubsystem::RegisterStation(AHHShelterStation* Station)
{
    if (Station) Stations.AddUnique(Station);
}

void UHHHubSubsystem::UnregisterStation(AHHShelterStation* Station)
{
    Stations.RemoveAll([Station](const TWeakObjectPtr<AHHShelterStation>& P){ return !P.IsValid() || P.Get() == Station; });
    if (FocusedStation.Get() == Station) SetFocusedStation(nullptr);
    if (ActiveStation.Get() == Station) CloseStation();
}

void UHHHubSubsystem::RegisterNPC(AHHShelterNPC* NPC)
{
    if (NPC) NPCs.AddUnique(NPC);
}

void UHHHubSubsystem::UnregisterNPC(AHHShelterNPC* NPC)
{
    NPCs.RemoveAll([NPC](const TWeakObjectPtr<AHHShelterNPC>& P){ return !P.IsValid() || P.Get() == NPC; });
    if (FocusedNPC.Get() == NPC) SetFocusedNPC(nullptr);
    if (ActiveNPC.Get() == NPC) CloseNPC();
}

void UHHHubSubsystem::SetFocusedStation(AHHShelterStation* Station)
{
    if (FocusedStation.Get() == Station) return;
    FocusedStation = Station;
    OnFocusedStationChanged.Broadcast(Station);
}

void UHHHubSubsystem::SetFocusedNPC(AHHShelterNPC* NPC)
{
    if (FocusedNPC.Get() == NPC) return;
    FocusedNPC = NPC;
    OnFocusedNPCChanged.Broadcast(NPC);
}

void UHHHubSubsystem::OpenStation(AHHShelterStation* Station)
{
    if (!Station) return;
    if (ActiveStation.Get() == Station)
    {
        CloseStation();
        return;
    }

    CloseNPC();
    ActiveStation = Station;
    OnActiveStationChanged.Broadcast(Station);
}

void UHHHubSubsystem::CloseStation()
{
    if (!ActiveStation.IsValid()) return;
    ActiveStation.Reset();
    OnActiveStationChanged.Broadcast(nullptr);
}

void UHHHubSubsystem::OpenNPC(AHHShelterNPC* NPC)
{
    if (!NPC) return;

    CloseStation();
    if (ActiveNPC.Get() != NPC)
    {
        ActiveNPC = NPC;
        NPC->StartDialogue();
        OnActiveNPCChanged.Broadcast(NPC);
    }
}

void UHHHubSubsystem::CloseNPC()
{
    if (!ActiveNPC.IsValid()) return;
    ActiveNPC.Reset();
    OnActiveNPCChanged.Broadcast(nullptr);
}

void UHHHubSubsystem::CloseAll()
{
    CloseNPC();
    CloseStation();
}

AHHShelterStation* UHHHubSubsystem::FindStationById(FName StationId) const
{
    for (const TWeakObjectPtr<AHHShelterStation>& Weak : Stations)
    {
        if (AHHShelterStation* Station = Weak.Get())
        {
            if (Station->StationId == StationId) return Station;
        }
    }
    return nullptr;
}

AHHShelterStation* UHHHubSubsystem::FindBestStation(const FVector& Origin, const FVector& Forward, float MaxDistance, float MinFacingDot) const
{
    AHHShelterStation* Best = nullptr;
    float BestScore = -BIG_NUMBER;

    for (const TWeakObjectPtr<AHHShelterStation>& Weak : Stations)
    {
        AHHShelterStation* S = Weak.Get();
        if (!S) continue;

        FVector To = S->GetActorLocation() - Origin;
        const float Dist = To.Size();
        if (Dist > MaxDistance || Dist < KINDA_SMALL_NUMBER) continue;

        To /= Dist;
        const float Dot = FVector::DotProduct(Forward, To);
        if (Dot < MinFacingDot) continue;

        const float Score = Dot * 2.0f - (Dist / MaxDistance);
        if (Score > BestScore)
        {
            BestScore = Score;
            Best = S;
        }
    }
    return Best;
}

AHHShelterNPC* UHHHubSubsystem::FindBestNPC(const FVector& Origin, const FVector& Forward, float MaxDistance, float MinFacingDot) const
{
    AHHShelterNPC* Best = nullptr;
    float BestScore = -BIG_NUMBER;

    for (const TWeakObjectPtr<AHHShelterNPC>& Weak : NPCs)
    {
        AHHShelterNPC* NPC = Weak.Get();
        if (!NPC) continue;

        FVector To = NPC->GetActorLocation() - Origin;
        const float Dist = To.Size();
        if (Dist > MaxDistance || Dist < KINDA_SMALL_NUMBER) continue;

        To /= Dist;
        const float Dot = FVector::DotProduct(Forward, To);
        if (Dot < MinFacingDot) continue;

        // NPC gets a small priority so F naturally talks before opening the station marker.
        const float Score = 0.25f + Dot * 2.0f - (Dist / MaxDistance);
        if (Score > BestScore)
        {
            BestScore = Score;
            Best = NPC;
        }
    }

    return Best;
}
