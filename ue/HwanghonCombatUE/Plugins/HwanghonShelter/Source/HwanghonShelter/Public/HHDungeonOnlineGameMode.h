#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "Interfaces/IHttpRequest.h"
#include "HHDungeonOnlineGameMode.generated.h"

class APawn;
class AHHShelterOnlinePlayerController;

UCLASS(Config=Game)
class HWANGHONSHELTER_API AHHDungeonOnlineGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AHHDungeonOnlineGameMode();

    virtual void BeginPlay() override;
    virtual FString InitNewPlayer(
        APlayerController* NewPlayerController,
        const FUniqueNetIdRepl& UniqueId,
        const FString& Options,
        const FString& Portal = TEXT("")) override;
    virtual void PostLogin(APlayerController* NewPlayer) override;
    virtual UClass* GetDefaultPawnClassForController_Implementation(AController* InController) override;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Hwanghon|Characters")
    TMap<FName, TSoftClassPtr<APawn>> CharacterPawnClasses;

    UPROPERTY(Config, EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Online")
    FString MatchmakerBaseUrl = TEXT("http://127.0.0.1:8080");

    UPROPERTY(Config, EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Server")
    int32 DungeonCapacity = 4;

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Dungeon")
    void CompleteDungeonRun();

private:
    FTimerHandle HeartbeatTimer;
    FString InstanceId;
    FString AdvertisedAddress;
    FString InstanceSecret;
    FName RuntimeMissionId = TEXT("GangnamStation_B2");
    FString RuntimeOriginShelterInstanceId;
    bool bReturnAllocationInFlight = false;

    TMap<TWeakObjectPtr<APlayerController>, FString> PendingJoinTokens;

    void StartHeartbeat();
    void SendHeartbeat();

    void ValidateTicket(APlayerController* PC, const FString& Token);
    void HandleTicketValidation(
        FHttpRequestPtr Request,
        FHttpResponsePtr Response,
        bool bSucceeded,
        TWeakObjectPtr<APlayerController> PC);

    void HandleReturnShelterAllocation(
        FHttpRequestPtr Request,
        FHttpResponsePtr Response,
        bool bSucceeded);
};
