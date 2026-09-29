#include "HHShelterHubManager.h"
#include "HHHubSubsystem.h"
#include "HHShelterStation.h"
#include "HHShelterNPC.h"

#include "GameFramework/PlayerController.h"
#include "Engine/World.h"
#include "InputCoreTypes.h"

AHHShelterHubManager::AHHShelterHubManager()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickInterval = 0.08f;
}

void AHHShelterHubManager::BeginPlay()
{
    Super::BeginPlay();

    if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
    {
        EnableInput(PC);
        if (InputComponent)
        {
            InputComponent->BindKey(EKeys::F, IE_Pressed, this, &AHHShelterHubManager::HandleInteract);
            InputComponent->BindKey(EKeys::Enter, IE_Pressed, this, &AHHShelterHubManager::HandleInteract);
            InputComponent->BindKey(EKeys::E, IE_Pressed, this, &AHHShelterHubManager::HandleUseStation);
            InputComponent->BindKey(EKeys::Escape, IE_Pressed, this, &AHHShelterHubManager::HandleClose);
        }
    }
}

void AHHShelterHubManager::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    RefreshFocus();
}

void AHHShelterHubManager::RefreshFocus()
{
    APlayerController* PC = GetWorld()->GetFirstPlayerController();
    UHHHubSubsystem* Hub = GetWorld()->GetSubsystem<UHHHubSubsystem>();
    if (!PC || !Hub) return;

    // Keep focus stable while a modal dialogue/service is open.
    if (Hub->GetActiveNPC() || Hub->GetActiveStation()) return;

    FVector CamLoc;
    FRotator CamRot;
    PC->GetPlayerViewPoint(CamLoc, CamRot);

    Hub->SetFocusedNPC(Hub->FindBestNPC(CamLoc, CamRot.Vector(), FocusDistance, MinFacingDot));

    if (Hub->GetFocusedNPC())
    {
        Hub->SetFocusedStation(nullptr);
    }
    else
    {
        Hub->SetFocusedStation(Hub->FindBestStation(CamLoc, CamRot.Vector(), FocusDistance, MinFacingDot));
    }
}

void AHHShelterHubManager::HandleInteract()
{
    APlayerController* PC = GetWorld()->GetFirstPlayerController();
    UHHHubSubsystem* Hub = GetWorld()->GetSubsystem<UHHHubSubsystem>();
    if (!PC || !Hub) return;

    if (AHHShelterNPC* ActiveNPC = Hub->GetActiveNPC())
    {
        if (!ActiveNPC->AdvanceDialogue())
        {
            Hub->CloseNPC();
        }
        return;
    }

    if (AHHShelterNPC* FocusedNPC = Hub->GetFocusedNPC())
    {
        FocusedNPC->Interact(PC);
        return;
    }

    if (AHHShelterStation* Station = Hub->GetFocusedStation())
    {
        Station->Interact(PC);
    }
}

void AHHShelterHubManager::HandleUseStation()
{
    UHHHubSubsystem* Hub = GetWorld()->GetSubsystem<UHHHubSubsystem>();
    if (!Hub) return;

    AHHShelterNPC* NPC = Hub->GetActiveNPC();
    if (!NPC) NPC = Hub->GetFocusedNPC();
    if (!NPC || NPC->BoundStationId.IsNone()) return;

    if (AHHShelterStation* Station = Hub->FindStationById(NPC->BoundStationId))
    {
        Hub->OpenStation(Station);
    }
}

void AHHShelterHubManager::HandleClose()
{
    if (UHHHubSubsystem* Hub = GetWorld()->GetSubsystem<UHHHubSubsystem>())
    {
        Hub->CloseAll();
    }
}
