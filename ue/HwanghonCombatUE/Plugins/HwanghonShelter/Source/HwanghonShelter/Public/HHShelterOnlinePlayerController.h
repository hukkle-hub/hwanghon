#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "HHShelterOnlinePlayerController.generated.h"

class AHHShelterOnlinePlayerState;

UCLASS()
class HWANGHONSHELTER_API AHHShelterOnlinePlayerController : public APlayerController
{
    GENERATED_BODY()

public:
    AHHShelterOnlinePlayerController();

    virtual void SetupInputComponent() override;
    virtual void BeginPlayingState() override;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Party")
    FName DefaultMissionId = TEXT("GangnamStation_B2");

    UFUNCTION(BlueprintCallable, Server, Reliable, Category="Hwanghon|Party")
    void ServerCreateParty();

    UFUNCTION(BlueprintCallable, Server, Reliable, Category="Hwanghon|Party")
    void ServerInviteToParty(AHHShelterOnlinePlayerState* Target);

    UFUNCTION(BlueprintCallable, Server, Reliable, Category="Hwanghon|Party")
    void ServerAcceptPartyInvite();

    UFUNCTION(BlueprintCallable, Server, Reliable, Category="Hwanghon|Party")
    void ServerDeclinePartyInvite();

    UFUNCTION(BlueprintCallable, Server, Reliable, Category="Hwanghon|Party")
    void ServerLeaveParty();

    UFUNCTION(BlueprintCallable, Server, Reliable, Category="Hwanghon|Party")
    void ServerSetPartyReady(bool bReady);

    UFUNCTION(BlueprintCallable, Server, Reliable, Category="Hwanghon|Party")
    void ServerStartDungeon(FName MissionId);

    // Development vertical-slice hook. Final boss/exit Blueprint should call the Dungeon GameMode instead.
    UFUNCTION(BlueprintCallable, Server, Reliable, Category="Hwanghon|Dungeon")
    void ServerDevCompleteDungeon();

    UFUNCTION(Client, Reliable, Category="Hwanghon|Party")
    void ClientPartyMessage(const FString& Message);

    UFUNCTION(Client, Reliable, Category="Hwanghon|Online")
    void ClientTravelToDungeon(
        const FString& Address,
        const FString& JoinToken);

    UFUNCTION(Client, Reliable, Category="Hwanghon|Online")
    void ClientTravelBackToShelter(
        const FString& Address,
        const FString& ReturnToken,
        FName CharacterId,
        const FString& AccountId);

private:
    void InputCreateParty();
    void InputInviteLookTarget();
    void InputAcceptInvite();
    void InputDeclineInvite();
    void InputToggleReady();
    void InputLeaveParty();
    void InputStartDungeon();
    void InputDevCompleteDungeon();

    AHHShelterOnlinePlayerState* FindLookTargetPlayerState(float MaxDistance = 1200.f) const;
};
