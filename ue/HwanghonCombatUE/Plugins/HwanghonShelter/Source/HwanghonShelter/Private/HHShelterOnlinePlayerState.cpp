#include "HHShelterOnlinePlayerState.h"
#include "Net/UnrealNetwork.h"

AHHShelterOnlinePlayerState::AHHShelterOnlinePlayerState()
{
    bReplicates = true;
}

void AHHShelterOnlinePlayerState::OnRep_PartyState()
{
}

void AHHShelterOnlinePlayerState::OnRep_PendingInvite()
{
}

void AHHShelterOnlinePlayerState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);

    DOREPLIFETIME(AHHShelterOnlinePlayerState, SelectedCharacterId);
    DOREPLIFETIME_CONDITION(AHHShelterOnlinePlayerState, AccountId, COND_OwnerOnly);
    DOREPLIFETIME(AHHShelterOnlinePlayerState, PartyId);
    DOREPLIFETIME(AHHShelterOnlinePlayerState, bPartyLeader);
    DOREPLIFETIME(AHHShelterOnlinePlayerState, bPartyReady);
    DOREPLIFETIME(AHHShelterOnlinePlayerState, SelectedMissionId);
    DOREPLIFETIME_CONDITION(AHHShelterOnlinePlayerState, PendingInvitePartyId, COND_OwnerOnly);
    DOREPLIFETIME_CONDITION(AHHShelterOnlinePlayerState, PendingInviteLeaderName, COND_OwnerOnly);
    DOREPLIFETIME_CONDITION(AHHShelterOnlinePlayerState, bAdmissionValidated, COND_OwnerOnly);
    DOREPLIFETIME_CONDITION(AHHShelterOnlinePlayerState, ShelterSpawnPoint, COND_OwnerOnly);
    DOREPLIFETIME_CONDITION(AHHShelterOnlinePlayerState, OriginShelterInstanceId, COND_OwnerOnly);
    DOREPLIFETIME_CONDITION(AHHShelterOnlinePlayerState, AdmissionSource, COND_OwnerOnly);
}
