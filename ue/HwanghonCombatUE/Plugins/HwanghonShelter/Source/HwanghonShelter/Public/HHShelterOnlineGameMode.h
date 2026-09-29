#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "Interfaces/IHttpRequest.h"
#include "HHShelterOnlineGameMode.generated.h"

class APawn;
class AHHDeploymentGate;
class AHHShelterOnlinePlayerController;
class AHHShelterOnlinePlayerState;

struct FHHPartyRuntime
{
    FString PartyId;
    FString LeaderAccountId;
    TWeakObjectPtr<AHHShelterOnlinePlayerState> Leader;
    TArray<TWeakObjectPtr<AHHShelterOnlinePlayerState>> Members;
    bool bAllocatingDungeon = false;
    FName MissionId = NAME_None;
};

UCLASS(Config=Game)
class HWANGHONSHELTER_API AHHShelterOnlineGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AHHShelterOnlineGameMode();

    virtual void BeginPlay() override;
    virtual void PostLogin(APlayerController* NewPlayer) override;
    virtual void Logout(AController* Exiting) override;
    virtual void RestartPlayer(AController* NewPlayer) override;

    virtual FString InitNewPlayer(
        APlayerController* NewPlayerController,
        const FUniqueNetIdRepl& UniqueId,
        const FString& Options,
        const FString& Portal = TEXT("")) override;

    virtual UClass* GetDefaultPawnClassForController_Implementation(AController* InController) override;
    virtual AActor* ChoosePlayerStart_Implementation(AController* Player) override;
    // HwanghonCombatUE: the start is chosen at login (StartSpot) - before the ticket says TownStart or
    // ManpowerOfficeReturn. Choose again when the admitted player is spawned (measured: returns spawned 19.7 m away
    // at the town start with ShelterSpawnPoint=ManpowerOfficeReturn).
    virtual bool ShouldSpawnAtStartSpot(AController* Player) override { return false; }

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Hwanghon|Characters")
    TMap<FName, TSoftClassPtr<APawn>> CharacterPawnClasses;

    UPROPERTY(Config, EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Server")
    int32 ShelterCapacity = 24;

    UPROPERTY(Config, EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Party")
    int32 PartyCapacity = 4;

    UPROPERTY(Config, EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Online")
    FString MatchmakerBaseUrl = TEXT("http://127.0.0.1:8080");

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Party")
    void CreateParty(AHHShelterOnlinePlayerController* Requester);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Party")
    void InviteToParty(AHHShelterOnlinePlayerController* Requester, AHHShelterOnlinePlayerState* Target);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Party")
    void AcceptPartyInvite(AHHShelterOnlinePlayerController* Requester);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Party")
    void DeclinePartyInvite(AHHShelterOnlinePlayerController* Requester);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Party")
    void LeaveParty(AHHShelterOnlinePlayerController* Requester);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Party")
    void SetPartyReady(AHHShelterOnlinePlayerController* Requester, bool bReady);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Party")
    void RequestDungeonForParty(AHHShelterOnlinePlayerController* Requester, FName MissionId);

private:
    TMap<FString, FHHPartyRuntime> Parties;
    TMap<TWeakObjectPtr<APlayerController>, FString> PendingAdmissionTokens;

    FTimerHandle HeartbeatTimer;
    FString InstanceId;
    FString AdvertisedAddress;
    FString InstanceSecret;
    bool bAllowDevAdmission = false;

    bool IsAllowedCharacter(FName Id) const;
    FString NewPartyId() const;

    FHHPartyRuntime* FindPartyFor(AHHShelterOnlinePlayerState* PS);
    AHHShelterOnlinePlayerController* ControllerFor(AHHShelterOnlinePlayerState* PS) const;
    void NormalizeParty(FHHPartyRuntime& Party);
    void RemovePartyIfEmpty(const FString& PartyId);
    void ResetInvite(AHHShelterOnlinePlayerState* PS);
    void RestorePartyFromAdmission(AHHShelterOnlinePlayerState* PS, const FString& LeaderAccountId);

    AHHDeploymentGate* FindDeploymentGate() const;
    bool CollectPartyMembers(FHHPartyRuntime& Party, TArray<AHHShelterOnlinePlayerState*>& OutMembers);

    void ValidateShelterAdmission(APlayerController* PC, const FString& Token);
    void HandleShelterAdmissionResponse(
        FHttpRequestPtr Request,
        FHttpResponsePtr Response,
        bool bSucceeded,
        TWeakObjectPtr<APlayerController> PlayerController);

    void StartHeartbeat();
    void SendHeartbeat();

    void HandleDungeonAllocation(
        FHttpRequestPtr Request,
        FHttpResponsePtr Response,
        bool bSucceeded,
        FString PartyId);

    void DispatchDungeonTravel(
        FString PartyId,
        FString Address,
        TMap<FString, FString> TicketsByAccount);
};
