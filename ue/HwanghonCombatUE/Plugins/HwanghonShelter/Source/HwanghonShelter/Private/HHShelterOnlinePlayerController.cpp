#include "HHShelterOnlinePlayerController.h"
#include "HHDungeonOnlineGameMode.h"
#include "HHShelterOnlineGameMode.h"
#include "HHShelterOnlinePlayerState.h"

#include "Engine/Engine.h"
#include "Camera/PlayerCameraManager.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "InputCoreTypes.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"

AHHShelterOnlinePlayerController::AHHShelterOnlinePlayerController()
{
    bReplicates = true;
}


void AHHShelterOnlinePlayerController::BeginPlayingState()
{
    Super::BeginPlayingState();

    if (IsLocalController() && PlayerCameraManager)
    {
        // Native travel lands softly in the shelter/dungeon instead of hard-cutting from the front end.
        PlayerCameraManager->StartCameraFade(
            1.f,
            0.f,
            0.38f,
            FLinearColor::Black,
            false,
            false
        );
    }
}

void AHHShelterOnlinePlayerController::SetupInputComponent()
{
    Super::SetupInputComponent();
    if (!InputComponent) return;

    InputComponent->BindKey(EKeys::P, IE_Pressed, this, &AHHShelterOnlinePlayerController::InputCreateParty);
    InputComponent->BindKey(EKeys::I, IE_Pressed, this, &AHHShelterOnlinePlayerController::InputInviteLookTarget);
    InputComponent->BindKey(EKeys::Y, IE_Pressed, this, &AHHShelterOnlinePlayerController::InputAcceptInvite);
    InputComponent->BindKey(EKeys::N, IE_Pressed, this, &AHHShelterOnlinePlayerController::InputDeclineInvite);
    InputComponent->BindKey(EKeys::R, IE_Pressed, this, &AHHShelterOnlinePlayerController::InputToggleReady);
    InputComponent->BindKey(EKeys::L, IE_Pressed, this, &AHHShelterOnlinePlayerController::InputLeaveParty);
    InputComponent->BindKey(EKeys::G, IE_Pressed, this, &AHHShelterOnlinePlayerController::InputStartDungeon);
    InputComponent->BindKey(EKeys::H, IE_Pressed, this, &AHHShelterOnlinePlayerController::InputDevCompleteDungeon);
}

AHHShelterOnlinePlayerState* AHHShelterOnlinePlayerController::FindLookTargetPlayerState(float MaxDistance) const
{
    if (!GetWorld()) return nullptr;

    FVector Start;
    FRotator Rotation;
    GetPlayerViewPoint(Start, Rotation);
    const FVector End = Start + Rotation.Vector() * MaxDistance;

    FHitResult Hit;
    FCollisionQueryParams Params(SCENE_QUERY_STAT(HHPartyInvite), false, GetPawn());

    if (!GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Pawn, Params))
    {
        return nullptr;
    }

    const APawn* HitPawn = Cast<APawn>(Hit.GetActor());
    return HitPawn ? HitPawn->GetPlayerState<AHHShelterOnlinePlayerState>() : nullptr;
}

void AHHShelterOnlinePlayerController::InputCreateParty(){ ServerCreateParty(); }
void AHHShelterOnlinePlayerController::InputAcceptInvite(){ ServerAcceptPartyInvite(); }
void AHHShelterOnlinePlayerController::InputDeclineInvite(){ ServerDeclinePartyInvite(); }
void AHHShelterOnlinePlayerController::InputLeaveParty(){ ServerLeaveParty(); }
void AHHShelterOnlinePlayerController::InputStartDungeon(){ ServerStartDungeon(DefaultMissionId); }
void AHHShelterOnlinePlayerController::InputDevCompleteDungeon(){ ServerDevCompleteDungeon(); }

void AHHShelterOnlinePlayerController::InputInviteLookTarget()
{
    if (AHHShelterOnlinePlayerState* Target = FindLookTargetPlayerState())
    {
        ServerInviteToParty(Target);
    }
    else
    {
        ClientPartyMessage(TEXT("초대할 플레이어를 바라보세요."));
    }
}

void AHHShelterOnlinePlayerController::InputToggleReady()
{
    if (AHHShelterOnlinePlayerState* PS = GetPlayerState<AHHShelterOnlinePlayerState>())
    {
        ServerSetPartyReady(!PS->bPartyReady);
    }
}

void AHHShelterOnlinePlayerController::ServerCreateParty_Implementation()
{
    if (AHHShelterOnlineGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<AHHShelterOnlineGameMode>() : nullptr)
    {
        GM->CreateParty(this);
    }
}

void AHHShelterOnlinePlayerController::ServerInviteToParty_Implementation(AHHShelterOnlinePlayerState* Target)
{
    if (AHHShelterOnlineGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<AHHShelterOnlineGameMode>() : nullptr)
    {
        GM->InviteToParty(this, Target);
    }
}

void AHHShelterOnlinePlayerController::ServerAcceptPartyInvite_Implementation()
{
    if (AHHShelterOnlineGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<AHHShelterOnlineGameMode>() : nullptr)
    {
        GM->AcceptPartyInvite(this);
    }
}

void AHHShelterOnlinePlayerController::ServerDeclinePartyInvite_Implementation()
{
    if (AHHShelterOnlineGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<AHHShelterOnlineGameMode>() : nullptr)
    {
        GM->DeclinePartyInvite(this);
    }
}

void AHHShelterOnlinePlayerController::ServerLeaveParty_Implementation()
{
    if (AHHShelterOnlineGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<AHHShelterOnlineGameMode>() : nullptr)
    {
        GM->LeaveParty(this);
    }
}

void AHHShelterOnlinePlayerController::ServerSetPartyReady_Implementation(bool bReady)
{
    if (AHHShelterOnlineGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<AHHShelterOnlineGameMode>() : nullptr)
    {
        GM->SetPartyReady(this, bReady);
    }
}

void AHHShelterOnlinePlayerController::ServerStartDungeon_Implementation(FName MissionId)
{
    if (AHHShelterOnlineGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<AHHShelterOnlineGameMode>() : nullptr)
    {
        GM->RequestDungeonForParty(this, MissionId);
    }
}

void AHHShelterOnlinePlayerController::ServerDevCompleteDungeon_Implementation()
{
    AHHDungeonOnlineGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<AHHDungeonOnlineGameMode>() : nullptr;
    AHHShelterOnlinePlayerState* PS = GetPlayerState<AHHShelterOnlinePlayerState>();
    // HwanghonCombatUE: a dev hook - only on a dungeon server started with -AllowDevComplete
    if (GM && PS && PS->bPartyLeader && FParse::Param(FCommandLine::Get(), TEXT("AllowDevComplete")))
    {
        GM->CompleteDungeonRun();
    }
}

void AHHShelterOnlinePlayerController::ClientPartyMessage_Implementation(const FString& Message)
{
    if (GEngine)
    {
        GEngine->AddOnScreenDebugMessage(-1, 4.0f, FColor(235, 180, 80), Message);
    }
}

void AHHShelterOnlinePlayerController::ClientTravelToDungeon_Implementation(
    const FString& Address,
    const FString& JoinToken)
{
    const FString URL = FString::Printf(TEXT("%s?JoinToken=%s"), *Address, *JoinToken);
    ClientTravel(URL, TRAVEL_Absolute);
}

void AHHShelterOnlinePlayerController::ClientTravelBackToShelter_Implementation(
    const FString& Address,
    const FString& ReturnToken,
    FName CharacterId,
    const FString& AccountId)
{
    const FString URL = FString::Printf(
        TEXT("%s?Character=%s?AccountId=%s?JoinToken=%s"),
        *Address,
        *CharacterId.ToString().ToLower(),
        *AccountId,
        *ReturnToken
    );
    ClientTravel(URL, TRAVEL_Absolute);
}
