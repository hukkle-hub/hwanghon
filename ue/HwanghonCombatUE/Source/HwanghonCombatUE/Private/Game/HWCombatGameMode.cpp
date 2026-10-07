#include "Game/HWCombatGameMode.h"
#include "System/HWSystemRulesLibrary.h"
#include "Boss/HWBossCharacter.h"
#include "Character/HWAinCharacter.h"
#include "System/HWPlayableCharacterVariants.h"
#include "World/HWGrayboxArena.h"
#include "World/HWSeohanLightingRig.h"
#include "Audit/HWCombatAuditActor.h"
#include "Progression/HWProfileSubsystem.h"
#include "Game/HWQuestRunSubsystem.h"
#include "Combat/HWCombatComponent.h"
#include "System/HWSystemTypes.h"
#include "Network/HWRaidWorldBridge.h"
#include "Network/HWRaidNetworkSubsystem.h"
#include "System/HWCoopCombatSubsystem.h"
#include "System/HWDungeonDirector.h"
#include "Node/HWNodeDirector.h"
#include "System/HWCoopLifeComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Engine/GameInstance.h"
#include "UI/HWCombatHUD.h"

#include "Kismet/GameplayStatics.h"

AHWCombatGameMode::AHWCombatGameMode()
{
    DefaultPawnClass = AHWAinCharacter::StaticClass();
    HUDClass = AHWCombatHUD::StaticClass();
}

UClass* AHWCombatGameMode::GetDefaultPawnClassForController_Implementation(AController* InController)
{
    FName CharacterId = TEXT("ain");
    if (UGameInstance* GI = GetGameInstance())
    {
        if (UHWRaidNetworkSubsystem* Network = GI->GetSubsystem<UHWRaidNetworkSubsystem>())
        {
            const FHWNetProfile NetProfile = Network->GetProfile();
            if (Network->GetRoom().bHasRaid && NetProfile.bCharacterCreated)
                CharacterId = NetProfile.Character;
            else if (UHWProfileSubsystem* Profile = GI->GetSubsystem<UHWProfileSubsystem>())
                CharacterId = Profile->GetSelectedCharacter();
        }
        else if (UHWProfileSubsystem* Profile = GI->GetSubsystem<UHWProfileSubsystem>())
        {
            CharacterId = Profile->GetSelectedCharacter();
        }
    }

    if (CharacterId == TEXT("kain")) return AHWKainCharacter::StaticClass();
    if (CharacterId == TEXT("ryu")) return AHWRyuCharacter::StaticClass();
    if (CharacterId == TEXT("sera")) return AHWSeraCharacter::StaticClass();
    return AHWAinCharacter::StaticClass();
}

void AHWCombatGameMode::BeginPlay()
{
    Super::BeginPlay();
    RunId = FGuid::NewGuid();
    const bool bOnlineRaid = GetGameInstance() && GetGameInstance()->GetSubsystem<UHWRaidNetworkSubsystem>() && GetGameInstance()->GetSubsystem<UHWRaidNetworkSubsystem>()->GetRoom().bHasRaid;

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

    // A local dungeon can also be opened on any combat map with ?HWDungeon=<id> (development/QA).
    // Such runs never credit progression.
    FName LocalDungeonId = DungeonId;
    const FString DungeonOption = UGameplayStatics::ParseOption(OptionsString, TEXT("HWDungeon"));
    if (LocalDungeonId.IsNone() && !DungeonOption.IsEmpty())
    {
        LocalDungeonId = FName(*DungeonOption);
        bCanRecordVictory = false;
    }

    // An outpost run (docs/design/200): ?HWNode=namsan_n01 on any combat map. The node builds its own graybox,
    // facilities, waves and boss and handles the player's death and return - the arena, the stand-in boss and the
    // dungeon flow below stay out. Development/QA only for now: it never credits progression.
    bool bNodeRun = false;
    const FString NodeOption = UGameplayStatics::ParseOption(OptionsString, TEXT("HWNode"));
    if (!bOnlineRaid && !NodeOption.IsEmpty())
    {
        AHWNodeDirector* Node = GetWorld()->SpawnActorDeferred<AHWNodeDirector>(AHWNodeDirector::StaticClass(), FTransform::Identity);
        if (Node && Node->ConfigureNode(FName(*NodeOption), OptionsString))
        {
            UGameplayStatics::FinishSpawningActor(Node, FTransform::Identity);
            bNodeRun = true;
            bCanRecordVictory = false;
        }
        else if (Node)
        {
            Node->Destroy();
        }
    }

    if (!bOnlineRaid && !bNodeRun && !LocalDungeonId.IsNone())
    {
        // a boss dungeon brings its own body (docs/design/181 §10): the map's placed stand-in boss would be a second
        // boss in the arena (QA: the scarecrow fought next to Shadow Fang)
        if (!UHWSystemRulesLibrary::DungeonDefinition(LocalDungeonId).BossBody.IsNone())
        {
            TArray<AActor*> Placed;
            UGameplayStatics::GetAllActorsOfClass(this, AHWBossCharacter::StaticClass(), Placed);
            for (AActor* A : Placed) A->Destroy();
        }
        EncounterDungeon = Cast<AHWDungeonDirector>(
            UGameplayStatics::GetActorOfClass(this, AHWDungeonDirector::StaticClass()));

        if (!EncounterDungeon)
        {
            EncounterDungeon = GetWorld()->SpawnActor<AHWDungeonDirector>(
                AHWDungeonDirector::StaticClass(),
                FVector::ZeroVector,
                FRotator::ZeroRotator);
        }

        if (EncounterDungeon)
        {
            EncounterDungeon->ConfigureDungeon(LocalDungeonId, EHWSystemDifficulty::Normal);
            EncounterDungeon->OnDungeonCompleted.AddUniqueDynamic(
                this,
                &AHWCombatGameMode::HandleDungeonCompleted);
            EncounterDungeon->OnDungeonFailed.AddUniqueDynamic(
                this,
                &AHWCombatGameMode::HandleDungeonFailed);
            EncounterDungeon->StartDungeon();
        }
    }

    if (!bOnlineRaid && !bNodeRun && !UGameplayStatics::GetActorOfClass(this, AHWGrayboxArena::StaticClass()))
    {
        GetWorld()->SpawnActor<AHWGrayboxArena>(AHWGrayboxArena::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator);
    }

    ACharacter* Player = UGameplayStatics::GetPlayerCharacter(this, 0);
    if (Player && !bNodeRun)   // a node places the player itself and brings them back after a death
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
    if (!Boss && !EncounterDungeon && !bNodeRun)
    {
        Boss = GetWorld()->SpawnActor<AHWBossCharacter>(
            AHWBossCharacter::StaticClass(),
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

    if (bOnlineRaid && !UGameplayStatics::GetActorOfClass(this, AHWRaidWorldBridge::StaticClass()))
    {
        GetWorld()->SpawnActor<AHWRaidWorldBridge>(AHWRaidWorldBridge::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator);
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

    if (UHWCoopCombatSubsystem* Coop =
        GetWorld() ? GetWorld()->GetSubsystem<UHWCoopCombatSubsystem>() : nullptr)
    {
        if (Coop->GetPartySize() > 1 && Coop->GetAliveCount() > 0)
        {
            // One player is down. The other players may revive them.
            return;
        }
    }

    if (EncounterDungeon)
    {
        EncounterDungeon->ReportPartyWipe();
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


void AHWCombatGameMode::HandleDungeonCompleted()
{
    if (bOutcomeResolved)
    {
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

    if (GetGameInstance())
    {
        if (UHWProfileSubsystem* Profile =
            GetGameInstance()->GetSubsystem<UHWProfileSubsystem>())
        {
            Profile->RecordVictory(RunId, EncounterId);
        }
    }
}

bool AHWCombatGameMode::RetryDungeonFromCheckpoint()
{
    if (bQuestRun || !EncounterDungeon || !IsValid(EncounterPlayer)
        || EncounterDungeon->GetDungeonState() != EHWSystemDungeonState::Failed)
    {
        return false;
    }
    UHWCombatComponent* PlayerCombat = EncounterPlayer->GetCombat();
    if (!PlayerCombat || !EncounterDungeon->RetryFromCheckpoint())
    {
        return false;
    }
    PlayerCombat->Revive(1.f);
    if (UHWCoopLifeComponent* Life = EncounterPlayer->GetCoopLife())
    {
        Life->ResetForRetry();
    }
    EncounterPlayer->SetActorLocation(FVector(-450.f, 0.f, 96.f));
    bOutcomeResolved = false;
    return true;
}

void AHWCombatGameMode::HandleDungeonFailed(FString Reason)
{
    if (bOutcomeResolved)
    {
        return;
    }

    bOutcomeResolved = true;
    if (bQuestRun && QuestRuns)
    {
        QuestRuns->FailEncounter(GetWorld(), RunId);
    }
}
