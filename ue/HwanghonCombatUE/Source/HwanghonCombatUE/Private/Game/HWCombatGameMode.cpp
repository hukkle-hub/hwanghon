#include "Game/HWCombatGameMode.h"
#include "Boss/HWBossCharacter.h"
#include "Character/HWAinCharacter.h"
#include "World/HWGrayboxArena.h"
#include "World/HWSeohanLightingRig.h"
#include "Audit/HWCombatAuditActor.h"
#include "Progression/HWProfileSubsystem.h"
#include "Game/HWQuestRunSubsystem.h"
#include "Combat/HWCombatComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Engine/GameInstance.h"

#include "Kismet/GameplayStatics.h"

AHWCombatGameMode::AHWCombatGameMode()
{
    DefaultPawnClass = AHWAinCharacter::StaticClass();
    EncounterBossClass = AHWBossCharacter::StaticClass();
    ArenaClass = AHWGrayboxArena::StaticClass();
}

void AHWCombatGameMode::BeginPlay()
{
    Super::BeginPlay();
    RunId = FGuid::NewGuid();

    if (GetGameInstance())
    {
        if (UHWQuestRunSubsystem* Runs = GetGameInstance()->GetSubsystem<UHWQuestRunSubsystem>())
        {
            QuestRuns = Runs;
            const FString Requested = UGameplayStatics::ParseOption(OptionsString, TEXT("HWRun"));
            if (!Requested.IsEmpty() || Runs->GetRunState() == EHWQuestRunState::Traveling)
            {
                FGuid RequestedRun;
                FGuid::ParseExact(Requested, EGuidFormats::Digits, RequestedRun);
                bQuestRun = Runs->AttachEncounter(GetWorld(), EncounterId, DungeonId, RequestedRun, RunId);
                bCanRecordVictory = bQuestRun;
            }
            else if (EncounterId != TEXT("Seohan_Combat_VS01"))
            {
                // Manual level opens are useful for development but do not credit quests.
                bCanRecordVictory = false;
            }
        }
    }

    if (!UGameplayStatics::GetActorOfClass(this, AHWGrayboxArena::StaticClass()))
    {
        GetWorld()->SpawnActor<AHWGrayboxArena>(ArenaClass, FVector::ZeroVector, FRotator::ZeroRotator);
    }

    ACharacter* Player = UGameplayStatics::GetPlayerCharacter(this, 0);
    if (Player)
    {
        Player->SetActorLocation(FVector(-450.f, 0.f, 96.f));
        Player->SetActorRotation(FRotator(0.f, 0.f, 0.f));
        if (AHWAinCharacter* Ain = Cast<AHWAinCharacter>(Player))
        {
            EncounterPlayer = Ain;
            Ain->GetCombat()->OnDied.AddUniqueDynamic(this, &AHWCombatGameMode::HandlePlayerDied);
            Ain->OnDestroyed.AddUniqueDynamic(this, &AHWCombatGameMode::HandleParticipantDestroyed);
        }
    }

    AHWBossCharacter* Boss = Cast<AHWBossCharacter>(UGameplayStatics::GetActorOfClass(this, AHWBossCharacter::StaticClass()));
    if (!Boss)
    {
        Boss = GetWorld()->SpawnActor<AHWBossCharacter>(
            EncounterBossClass,
            FVector(450.f, 0.f, 115.f),
            FRotator(0.f, 180.f, 0.f));
    }


    if (Boss)
    {
        EncounterBoss = Boss;
        Boss->OnBossDied.AddUniqueDynamic(this, &AHWCombatGameMode::HandleBossDied);
        Boss->OnDestroyed.AddUniqueDynamic(this, &AHWCombatGameMode::HandleParticipantDestroyed);
    }

    if (!UGameplayStatics::GetActorOfClass(this, AHWSeohanLightingRig::StaticClass()))
    {
        GetWorld()->SpawnActor<AHWSeohanLightingRig>(
            AHWSeohanLightingRig::StaticClass(),
            FVector::ZeroVector,
            FRotator::ZeroRotator);
    }

    if (!UGameplayStatics::GetActorOfClass(this, AHWCombatAuditActor::StaticClass()))
    {
        GetWorld()->SpawnActor<AHWCombatAuditActor>(
            AHWCombatAuditActor::StaticClass(),
            FVector::ZeroVector,
            FRotator::ZeroRotator);
    }
}

void AHWCombatGameMode::HandleBossDied(AHWBossCharacter* Boss)
{
    if (!Boss || Boss != EncounterBoss || !Boss->IsDead() || !GetGameInstance() || bOutcomeResolved)
    {
        return;
    }
    // Keep the original participant: possession can change in a damage callback.
    if (!IsValid(EncounterPlayer) || EncounterPlayer->GetCombat()->IsDead())
    {
        HandlePlayerDied();
        return;
    }
    bOutcomeResolved = true;
    if (!bCanRecordVictory)
    {
        return;
    }
    if (bQuestRun)
    {
        if (QuestRuns)
        {
            QuestRuns->CompleteEncounter(GetWorld(), RunId);
        }
        return;
    }
    UHWProfileSubsystem* Profile = GetGameInstance()->GetSubsystem<UHWProfileSubsystem>();
    if (Profile)
    {
        Profile->RecordVictory(RunId, EncounterId);
    }
}

void AHWCombatGameMode::HandlePlayerDied()
{
    if (bOutcomeResolved)
    {
        return;
    }
    bOutcomeResolved = true;
    if (EncounterBoss)
    {
        EncounterBoss->SetActorTickEnabled(false);
        EncounterBoss->GetCharacterMovement()->StopMovementImmediately();
        EncounterBoss->GetCharacterMovement()->DisableMovement();
    }
    if (bQuestRun && QuestRuns)
    {
        QuestRuns->FailEncounter(GetWorld(), RunId);
    }
}

void AHWCombatGameMode::HandleParticipantDestroyed(AActor* Participant)
{
    if (Participant == EncounterPlayer)
    {
        HandlePlayerDied();
    }
    else if (Participant == EncounterBoss && !bOutcomeResolved)
    {
        bOutcomeResolved = true;
        if (bQuestRun && QuestRuns)
        {
            QuestRuns->LeaveEncounter(GetWorld(), RunId);
        }
    }
}

void AHWCombatGameMode::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (bQuestRun && QuestRuns)
    {
        QuestRuns->LeaveEncounter(GetWorld(), RunId);
    }
    Super::EndPlay(EndPlayReason);
}
