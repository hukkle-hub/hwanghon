#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerState.h"
#include "HHShelterOnlinePlayerState.generated.h"

UCLASS()
class HWANGHONSHELTER_API AHHShelterOnlinePlayerState : public APlayerState
{
    GENERATED_BODY()

public:
    AHHShelterOnlinePlayerState();

    UPROPERTY(Replicated, BlueprintReadOnly, Category="Hwanghon|Character")
    FName SelectedCharacterId = TEXT("ain");

    UPROPERTY(Replicated, BlueprintReadOnly, Category="Hwanghon|Online")
    FString AccountId;

    UPROPERTY(ReplicatedUsing=OnRep_PartyState, BlueprintReadOnly, Category="Hwanghon|Party")
    FString PartyId;

    UPROPERTY(ReplicatedUsing=OnRep_PartyState, BlueprintReadOnly, Category="Hwanghon|Party")
    bool bPartyLeader = false;

    UPROPERTY(ReplicatedUsing=OnRep_PartyState, BlueprintReadOnly, Category="Hwanghon|Party")
    bool bPartyReady = false;

    UPROPERTY(Replicated, BlueprintReadOnly, Category="Hwanghon|Party")
    FName SelectedMissionId = TEXT("GangnamStation_B2");

    UPROPERTY(ReplicatedUsing=OnRep_PendingInvite, BlueprintReadOnly, Category="Hwanghon|Party")
    FString PendingInvitePartyId;

    UPROPERTY(ReplicatedUsing=OnRep_PendingInvite, BlueprintReadOnly, Category="Hwanghon|Party")
    FString PendingInviteLeaderName;

    UPROPERTY(Replicated, BlueprintReadOnly, Category="Hwanghon|Online")
    bool bAdmissionValidated = false;

    // First entry into the town.
    UPROPERTY(Replicated, BlueprintReadOnly, Category="Hwanghon|Shelter")
    FName ShelterSpawnPoint = TEXT("TownStart");

    // Used to prefer the same shelter instance after a dungeon run.
    UPROPERTY(Replicated, BlueprintReadOnly, Category="Hwanghon|Shelter")
    FString OriginShelterInstanceId;

    UPROPERTY(Replicated, BlueprintReadOnly, Category="Hwanghon|Shelter")
    FString AdmissionSource;

    UFUNCTION(BlueprintPure, Category="Hwanghon|Party")
    bool IsInParty() const { return !PartyId.IsEmpty(); }

    UFUNCTION(BlueprintPure, Category="Hwanghon|Party")
    bool HasPendingInvite() const { return !PendingInvitePartyId.IsEmpty(); }

    UFUNCTION()
    void OnRep_PartyState();

    UFUNCTION()
    void OnRep_PendingInvite();

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
