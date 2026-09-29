#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Interfaces/IHttpRequest.h"
#include "HHOnlineFlowSubsystem.generated.h"

class APlayerController;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHHCharacterSelectionChanged, FName, CharacterId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FHHMatchmakingStarted);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHHMatchmakingFailed, const FString&, Reason);

UCLASS(Config=Game)
class HWANGHONSHELTER_API UHHOnlineFlowSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;

    UPROPERTY(BlueprintAssignable, Category="Hwanghon|Online")
    FHHCharacterSelectionChanged OnCharacterSelectionChanged;

    UPROPERTY(BlueprintAssignable, Category="Hwanghon|Online")
    FHHMatchmakingStarted OnMatchmakingStarted;

    UPROPERTY(BlueprintAssignable, Category="Hwanghon|Online")
    FHHMatchmakingFailed OnMatchmakingFailed;

    UPROPERTY(Config, EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Online")
    FString MatchmakerUrl = TEXT("http://127.0.0.1:8080/v1/match/shelter");

    UPROPERTY(Config, EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Online")
    FString FallbackShelterAddress = TEXT("127.0.0.1:7777");

    UPROPERTY(Config, EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Flow")
    FName LoadingMap = TEXT("L_Loading");

    UPROPERTY(Config, EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Flow")
    FName CharacterSelectMap = TEXT("L_CharacterSelect");

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Flow")
    FName SelectedCharacterId = NAME_None;

    // Prototype identity. Replace with authenticated account id in production.
    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Online")
    FString ClientAccountId;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|Online")
    bool bMatchmaking = false;

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Flow")
    void SelectCharacter(FName CharacterId);

    UFUNCTION(BlueprintPure, Category="Hwanghon|Flow")
    bool IsValidCharacter(FName CharacterId) const;

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Flow")
    void GoToCharacterSelect();

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Online")
    void RequestShelterAndTravel(APlayerController* PlayerController);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Online")
    void TravelDirectToShelter(
        APlayerController* PlayerController,
        const FString& Address,
        const FString& JoinToken);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Online")
    void SetTravelDeferred(bool bDeferred);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Online")
    void ReleaseDeferredTravel();

    UFUNCTION(BlueprintPure, Category="Hwanghon|Online")
    bool HasPendingTravel() const { return !PendingTravelAddress.IsEmpty() && !PendingTravelToken.IsEmpty(); }

private:
    TSharedPtr<IHttpRequest, ESPMode::ThreadSafe> ActiveRequest;

    bool bDeferTravel = false;
    FString PendingTravelAddress;
    FString PendingTravelToken;
    TWeakObjectPtr<APlayerController> PendingTravelPlayer;

    FString BuildTravelUrl(const FString& Address, const FString& JoinToken) const;
    FString LoadOrCreateClientAccountId();

    void HandleMatchResponse(
        FHttpRequestPtr Request,
        FHttpResponsePtr Response,
        bool bSucceeded,
        TWeakObjectPtr<APlayerController> PlayerController);
};
