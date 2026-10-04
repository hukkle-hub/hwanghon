#include "System/HWDungeonDirector.h"

#include "System/HWSystemRulesLibrary.h"
#include "System/HWCoopCombatSubsystem.h"
#include "System/HWDungeonEnemy.h"
#include "System/HWDungeonObjectiveNode.h"
#include "Boss/HWBossCharacter.h"

AHWDungeonDirector::AHWDungeonDirector()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    SetReplicateMovement(false);
}

void AHWDungeonDirector::BeginPlay()
{
    Super::BeginPlay();

    Coop = GetWorld() ? GetWorld()->GetSubsystem<UHWCoopCombatSubsystem>() : nullptr;

    if (!bConfigured)
    {
        ConfigureDungeon(DungeonId, Difficulty);
    }
}

void AHWDungeonDirector::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (State == EHWSystemDungeonState::Combat
        || State == EHWSystemDungeonState::Boss
        || State == EHWSystemDungeonState::RoomIntro)
    {
        ElapsedSeconds += DeltaSeconds;
        RoomElapsed += DeltaSeconds;

        if (Definition.EnrageSeconds > 0.f
            && ElapsedSeconds >= Definition.EnrageSeconds * 2.f
            && State != EHWSystemDungeonState::Complete)
        {
            SetState(EHWSystemDungeonState::Failed);
            OnDungeonFailed.Broadcast(TEXT("Time limit exceeded."));
            return;
        }

        if (Definition.Rooms.IsValidIndex(CurrentRoomIndex))
        {
            const FHWSystemDungeonRoom& Room = Definition.Rooms[CurrentRoomIndex];
            if (Room.TimeLimit > 0.f && RoomElapsed >= Room.TimeLimit)
            {
                SetState(EHWSystemDungeonState::Failed);
                OnDungeonFailed.Broadcast(TEXT("Room time limit exceeded."));
            }
        }
    }
}

void AHWDungeonDirector::ConfigureDungeon(
    FName InDungeonId,
    EHWSystemDifficulty InDifficulty)
{
    DungeonId = InDungeonId;
    Difficulty = InDifficulty;
    Definition = UHWSystemRulesLibrary::DungeonDefinition(DungeonId);
    ReviveTokens = Definition.ReviveTokens;
    CurrentRoomIndex = INDEX_NONE;
    CheckpointRoomIndex = 0;
    RemainingEnemies = 0;
    RemainingObjectives = 0;
    ElapsedSeconds = 0.f;
    RoomElapsed = 0.f;
    bConfigured = true;
    SetState(EHWSystemDungeonState::Idle);
}

bool AHWDungeonDirector::StartDungeon()
{
    if (!bConfigured || Definition.Rooms.IsEmpty()
        || (State != EHWSystemDungeonState::Idle && State != EHWSystemDungeonState::Failed))
    {
        return false;
    }

    ElapsedSeconds = 0.f;
    EnterRoom(0);
    return true;
}

void AHWDungeonDirector::SetState(EHWSystemDungeonState NewState)
{
    if (State == NewState) return;
    State = NewState;
    OnDungeonStateChanged.Broadcast(State);
}

int32 AHWDungeonDirector::ScaledEnemyCount(int32 BaseCount) const
{
    const float Scale = Coop ? Coop->EnemyCountScale() : 1.f;
    const float DifficultyScale =
        Difficulty == EHWSystemDifficulty::Nightmare ? 1.35f :
        Difficulty == EHWSystemDifficulty::Hard ? 1.15f : 1.f;

    return FMath::Max(0, FMath::RoundToInt(BaseCount * Scale * DifficultyScale));
}

void AHWDungeonDirector::EnterRoom(int32 Index)
{
    if (!Definition.Rooms.IsValidIndex(Index))
    {
        SetState(EHWSystemDungeonState::Complete);
        OnDungeonCompleted.Broadcast();
        return;
    }

    CurrentRoomIndex = Index;
    RoomElapsed = 0.f;

    const FHWSystemDungeonRoom& Room = Definition.Rooms[Index];

    if (Room.bCheckpoint)
    {
        CheckpointRoomIndex = Index;
    }

    RemainingEnemies =
        ScaledEnemyCount(Room.EnemyCount)
        + ScaledEnemyCount(Room.EliteCount);
    RemainingObjectives = Room.Type == EHWRoomType::Objective
        ? FMath::Max(1, Room.EnemyCount)
        : 0;

    switch (Room.Type)
    {
        case EHWRoomType::Boss:
            SetState(EHWSystemDungeonState::Boss);
            break;
        case EHWRoomType::Rest:
            SetState(EHWSystemDungeonState::RoomClear);
            break;
        default:
            SetState(EHWSystemDungeonState::Combat);
            break;
    }

    BP_SpawnRoom(
        Room.Id,
        Room.Type,
        ScaledEnemyCount(Room.EnemyCount),
        ScaledEnemyCount(Room.EliteCount));

    if (bUseFallbackGrayboxSpawns)
    {
        SpawnFallbackRoom(Room);
    }

    OnRoomStarted.Broadcast(CurrentRoomIndex, Room.Id, Room.Type);

    if (Room.Type == EHWRoomType::Rest)
    {
        CompleteCurrentRoom();
    }
}

void AHWDungeonDirector::ReportEnemyDefeated(int32 Count)
{
    if (State != EHWSystemDungeonState::Combat || Count <= 0) return;

    RemainingEnemies = FMath::Max(0, RemainingEnemies - Count);

    const FHWSystemDungeonRoom& Room = Definition.Rooms[CurrentRoomIndex];
    if ((Room.Type == EHWRoomType::Combat || Room.Type == EHWRoomType::Elite)
        && RemainingEnemies <= 0)
    {
        CompleteCurrentRoom();
    }
}

void AHWDungeonDirector::ReportObjectiveProgress(int32 Count)
{
    if (State != EHWSystemDungeonState::Combat || Count <= 0) return;
    if (!Definition.Rooms.IsValidIndex(CurrentRoomIndex)) return;

    const FHWSystemDungeonRoom& Room = Definition.Rooms[CurrentRoomIndex];
    if (Room.Type != EHWRoomType::Objective) return;

    RemainingObjectives = FMath::Max(0, RemainingObjectives - Count);
    if (RemainingObjectives <= 0)
    {
        CompleteCurrentRoom();
    }
}

void AHWDungeonDirector::ReportBossDefeated()
{
    if (State == EHWSystemDungeonState::Boss)
    {
        CompleteCurrentRoom();
    }
}

void AHWDungeonDirector::CompleteCurrentRoom()
{
    if (!Definition.Rooms.IsValidIndex(CurrentRoomIndex)) return;

    const FHWSystemDungeonRoom& Room = Definition.Rooms[CurrentRoomIndex];
    SetState(EHWSystemDungeonState::RoomClear);
    BP_ClearRoomActors(Room.Id);
    DestroyFallbackActors();
    OnRoomCleared.Broadcast(CurrentRoomIndex, Room.Id);
    TransitionToNextRoom();
}

void AHWDungeonDirector::TransitionToNextRoom()
{
    EnterRoom(CurrentRoomIndex + 1);
}

void AHWDungeonDirector::ReportPartyWipe()
{
    if (State == EHWSystemDungeonState::Complete || State == EHWSystemDungeonState::Failed)
        return;

    SetState(EHWSystemDungeonState::Failed);
    OnDungeonFailed.Broadcast(TEXT("Party wiped."));
}

bool AHWDungeonDirector::RetryFromCheckpoint()
{
    if (State != EHWSystemDungeonState::Failed || ReviveTokens <= 0)
        return false;

    --ReviveTokens;
    SetState(EHWSystemDungeonState::RoomIntro);
    // Survivors of the failed attempt would otherwise stack on the re-spawned room and double-count.
    BP_ClearRoomActors(Definition.Rooms.IsValidIndex(CurrentRoomIndex) ? Definition.Rooms[CurrentRoomIndex].Id : NAME_None);
    DestroyFallbackActors();
    EnterRoom(FMath::Clamp(CheckpointRoomIndex, 0, Definition.Rooms.Num() - 1));
    return true;
}

float AHWDungeonDirector::GetDifficultyHealthScale() const
{
    return UHWSystemRulesLibrary::DifficultyHealthScale(Difficulty);
}

float AHWDungeonDirector::GetDifficultyDamageScale() const
{
    return UHWSystemRulesLibrary::DifficultyDamageScale(Difficulty);
}


void AHWDungeonDirector::SpawnFallbackRoom(const FHWSystemDungeonRoom& Room)
{
    if (!GetWorld()) return;

    const float HealthScale = GetDifficultyHealthScale();
    const float DamageScale = GetDifficultyDamageScale();

    const FVector Origin = GetActorLocation();

    if (Room.Type == EHWRoomType::Combat || Room.Type == EHWRoomType::Elite)
    {
        const int32 NormalCount = ScaledEnemyCount(Room.EnemyCount);
        const int32 EliteCount = ScaledEnemyCount(Room.EliteCount);

        for (int32 Index = 0; Index < NormalCount + EliteCount; ++Index)
        {
            const bool bElite = Index >= NormalCount;
            const float Angle = FMath::DegreesToRadians(Index * 57.f);
            const float Radius = 350.f + 90.f * (Index % 3);
            const FVector Location =
                Origin + FVector(FMath::Cos(Angle), FMath::Sin(Angle), 0.f) * Radius;

            if (AHWDungeonEnemy* Enemy = GetWorld()->SpawnActor<AHWDungeonEnemy>(
                AHWDungeonEnemy::StaticClass(),
                Location,
                FRotator::ZeroRotator))
            {
                Enemy->ConfigureEnemy(bElite, HealthScale, DamageScale);
                FallbackActors.Add(Enemy);
            }
        }
    }
    else if (Room.Type == EHWRoomType::Objective)
    {
        const int32 Count = FMath::Max(1, Room.EnemyCount);
        for (int32 Index = 0; Index < Count; ++Index)
        {
            const FVector Location =
                Origin + FVector(-250.f + Index * 250.f, (Index % 2) * 220.f - 110.f, 70.f);

            if (AHWDungeonObjectiveNode* Node =
                GetWorld()->SpawnActor<AHWDungeonObjectiveNode>(
                    AHWDungeonObjectiveNode::StaticClass(),
                    Location,
                    FRotator::ZeroRotator))
            {
                FallbackActors.Add(Node);
            }
        }
    }
    else if (Room.Type == EHWRoomType::Boss)
    {
        AHWBossCharacter* Boss = GetWorld()->SpawnActor<AHWBossCharacter>(
            AHWBossCharacter::StaticClass(),
            Origin + FVector(550.f, 0.f, 115.f),
            FRotator(0.f, 180.f, 0.f));

        if (Boss)
        {
            if (!Definition.BossBody.IsNone())
            {
                Boss->WearBody(Definition.BossBody);   // and its designed skills (AHWBossCharacter::WearBody)
            }
            Boss->OnBossDied.AddDynamic(
                this,
                &AHWDungeonDirector::HandleSpawnedBossDied);
            FallbackActors.Add(Boss);
        }
    }
}

void AHWDungeonDirector::DestroyFallbackActors()
{
    for (AActor* Actor : FallbackActors)
    {
        if (IsValid(Actor))
        {
            if (AHWBossCharacter* Boss = Cast<AHWBossCharacter>(Actor))
            {
                if (Boss->IsDead())
                {
                    Boss->SetLifeSpan(1.f);
                    continue;
                }
            }
            Actor->Destroy();
        }
    }
    FallbackActors.Reset();
}

void AHWDungeonDirector::HandleSpawnedBossDied(AHWBossCharacter* Boss)
{
    ReportBossDefeated();
}
