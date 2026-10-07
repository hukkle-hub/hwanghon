#include "Node/HWNodeDirector.h"

#include "Boss/HWBossCharacter.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/Engine.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Node/HWBossCoreComponent.h"
#include "Node/HWNodeEnemy.h"
#include "Node/HWNodeFacility.h"
#include "Node/HWNodeNpc.h"
#include "System/HWBossSystemComponent.h"

namespace HWNodeDirectorLocal
{
    const TCHAR* StateName(HWNodeRules::ENodeState S)
    {
        switch (S)
        {
        case HWNodeRules::ENodeState::Stable: return TEXT("STABLE");
        case HWNodeRules::ENodeState::Uneasy: return TEXT("UNEASY");
        case HWNodeRules::ENodeState::Alert: return TEXT("ALERT");
        case HWNodeRules::ENodeState::Invasion: return TEXT("INVASION");
        case HWNodeRules::ENodeState::Recovering: return TEXT("RECOVERING");
        case HWNodeRules::ENodeState::Fallen: return TEXT("FALLEN");
        case HWNodeRules::ENodeState::Retakeable: return TEXT("RETAKEABLE");
        case HWNodeRules::ENodeState::Retaking: return TEXT("RETAKING");
        }
        return TEXT("?");
    }

    const TCHAR* TierName(HWNodeRules::EOccupationTier T)
    {
        switch (T)
        {
        case HWNodeRules::EOccupationTier::Initial: return TEXT("initial (no retake)");
        case HWNodeRules::EOccupationTier::Basic: return TEXT("basic");
        case HWNodeRules::EOccupationTier::EliteUp: return TEXT("elites up");
        case HWNodeRules::EOccupationTier::Fortress: return TEXT("fortified");
        case HWNodeRules::EOccupationTier::InfectionCore: return TEXT("infection core");
        }
        return TEXT("?");
    }

    constexpr float RespawnSeconds = 5.f;
    constexpr float RepairPerSecond = 900.f;    // facility HP per second while recovering, x technician scale
    constexpr float RecoverPerSecond = 0.05f;   // 20 s to Stable with the technician well
    constexpr int32 HudKey = 920000;            // on-screen message keys (one per line)
}

AHWNodeDirector::AHWNodeDirector()
{
    PrimaryActorTick.bCanEverTick = true;
    SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    RootComponent = SceneRoot;
}

bool AHWNodeDirector::ConfigureNode(FName NodeId)
{
    Config = UHWNodeConfig::LoadFromJson(NodeId, this);
    return Config != nullptr;
}

void AHWNodeDirector::BeginPlay()
{
    Super::BeginPlay();
    if (!Config)
    {
        UE_LOG(LogTemp, Warning, TEXT("[HWNode] director has no config - nothing to run"));
        return;
    }
    BuildGraybox();
    SpawnFacilities();

    FActorSpawnParameters Params;
    Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
    Technician = GetWorld()->SpawnActor<AHWNodeNpc>(AHWNodeNpc::StaticClass(), Config->TechnicianStart + FVector(0.f, 0.f, 100.f), FRotator(0.f, -90.f, 0.f), Params);

    Machine.CommsHoldToFall = Config->CommsHoldToFall;
    Machine.SetThreat(0.7f);   // the forecast saw it coming: Alert, then the invasion
    SetState(Machine.State);

    // the player is placed on the first tick it exists (the pawn may not be spawned yet here) - TickPlayer
}

void AHWNodeDirector::BuildGraybox()
{
    UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
    if (!Cube) return;
    int32 Index = 0;
    for (const FHWNodeBlock& B : Config->Blocks)
    {
        UStaticMeshComponent* Part = NewObject<UStaticMeshComponent>(this, *FString::Printf(TEXT("Graybox_%d"), Index++));
        Part->SetStaticMesh(Cube);
        Part->SetCollisionProfileName(TEXT("BlockAll"));
        Part->SetupAttachment(SceneRoot);
        Part->SetWorldLocationAndRotation(B.Center, FRotator(B.Pitch, B.Yaw, 0.f));
        Part->SetWorldScale3D(B.HalfExtent / 50.f);   // engine cube is 100 cm
        Part->RegisterComponent();
        if (UMaterialInterface* Base = Part->GetMaterial(0))
        {
            UMaterialInstanceDynamic* Mat = UMaterialInstanceDynamic::Create(Base, this);
            Mat->SetVectorParameterValue(TEXT("Color"), B.Color);
            Part->SetMaterial(0, Mat);
        }
        GrayboxParts.Add(Part);
    }
}

void AHWNodeDirector::SpawnFacilities()
{
    for (const FHWNodeFacilityDef& Def : Config->Facilities)
    {
        AHWNodeFacility* F = GetWorld()->SpawnActor<AHWNodeFacility>(AHWNodeFacility::StaticClass(), Def.Location, FRotator::ZeroRotator);
        if (!F) continue;
        F->Configure(Def);
        F->OnFacilityDestroyed.AddUniqueDynamic(this, &AHWNodeDirector::HandleFacilityDestroyed);
        Facilities.Add(F);
    }
}

AHWAinCharacter* AHWNodeDirector::GetPlayer() const
{
    return Cast<AHWAinCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0));
}

AHWNodeFacility* AHWNodeDirector::GetFacility(EHWNodeFacilityKind Kind) const
{
    for (AHWNodeFacility* F : Facilities)
    {
        if (F && F->GetKind() == Kind) return F;
    }
    return nullptr;
}

bool AHWNodeDirector::IsGateStanding() const
{
    const AHWNodeFacility* Gate = GetFacility(EHWNodeFacilityKind::Gate);
    return Gate && !Gate->IsDestroyed();
}

float AHWNodeDirector::GateLineY() const
{
    const AHWNodeFacility* Gate = GetFacility(EHWNodeFacilityKind::Gate);
    return Gate ? Gate->GetActorLocation().Y : -1e9f;
}

HWNodeRules::FTargetView AHWNodeDirector::BuildView(const FVector& From, bool bFlanked) const
{
    HWNodeRules::FTargetView V;
    V.bFlanked = bFlanked;
    if (const AHWAinCharacter* Player = GetPlayer())
    {
        if (Player->GetCombat() && !Player->GetCombat()->IsDead()) V.Player = FVector::Dist2D(From, Player->GetActorLocation());
    }
    const auto Distance = [this, &From](EHWNodeFacilityKind Kind)
    {
        const AHWNodeFacility* F = GetFacility(Kind);
        return F && !F->IsDestroyed() ? F->DistanceToSurface2D(From) : -1.f;
    };
    V.Gate = Distance(EHWNodeFacilityKind::Gate);
    V.Generator = Distance(EHWNodeFacilityKind::Generator);
    V.Comms = Distance(EHWNodeFacilityKind::Comms);
    if (Technician && Technician->IsTargetable()) V.Npc = FVector::Dist2D(From, Technician->GetActorLocation());
    return V;
}

FVector AHWNodeDirector::TargetPoint(HWNodeRules::ETargetKind Kind, const FVector& From) const
{
    switch (Kind)
    {
    case HWNodeRules::ETargetKind::Player:
        if (const AHWAinCharacter* Player = GetPlayer()) return Player->GetActorLocation();
        break;
    case HWNodeRules::ETargetKind::Npc:
        if (Technician) return Technician->GetActorLocation();
        break;
    case HWNodeRules::ETargetKind::Gate:
    case HWNodeRules::ETargetKind::Generator:
    case HWNodeRules::ETargetKind::Comms:
        if (const AHWNodeFacility* F = GetFacility(static_cast<EHWNodeFacilityKind>(static_cast<uint8>(Kind) - static_cast<uint8>(HWNodeRules::ETargetKind::Gate))))
        {
            // the nearest point of the box (2D), at the enemy's height: walk to its face
            const FVector C = F->GetActorLocation(), H = F->GetHalfExtent();
            return FVector(FMath::Clamp(From.X, C.X - H.X, C.X + H.X), FMath::Clamp(From.Y, C.Y - H.Y, C.Y + H.Y), From.Z);
        }
        break;
    default:
        break;
    }
    return From;
}

const TArray<FVector>& AHWNodeDirector::ExtensionFor(HWNodeRules::ETargetKind Kind) const
{
    static const TArray<FVector> None;
    if (!Config) return None;
    if (Kind == HWNodeRules::ETargetKind::Generator || Kind == HWNodeRules::ETargetKind::Npc) return Config->GeneratorRoute;
    if (Kind == HWNodeRules::ETargetKind::Comms) return Config->CommsRoute;
    return None;
}

void AHWNodeDirector::StartInvasion()
{
    if (!Config || !Machine.StartInvasion()) return;
    Waves = HWNodeRules::FWaveRunner();
    SetState(Machine.State);
}

void AHWNodeDirector::SpawnWave(int32 WaveIndex)
{
    const HWNodeRules::FWaveSpec Spec = HWNodeRules::PrototypeAWave(WaveIndex);
    for (int32 RoleIndex = 0; RoleIndex < static_cast<int32>(HWNodeRules::EEnemyRole::Count); ++RoleIndex)
    {
        for (int32 N = 0; N < Spec.Count[RoleIndex]; ++N) SpawnEnemy(static_cast<EHWNodeEnemyRole>(RoleIndex), SpawnSerial++);
    }
}

void AHWNodeDirector::SpawnEnemy(EHWNodeEnemyRole EnemyRole, int32 Serial)
{
    if (Config->SpawnPoints.Num() == 0) return;
    // runners alternate the two flank trails; everyone else takes the road through the gate
    const bool bRunner = EnemyRole == EHWNodeEnemyRole::Runner;
    const TArray<FVector>& EnemyRoute = !bRunner ? Config->MainRoute : (Serial % 2 == 0 ? Config->WestRoute : Config->EastRoute);
    const FVector Base = bRunner && EnemyRoute.Num() > 0 ? EnemyRoute[0] : Config->SpawnPoints[Serial % Config->SpawnPoints.Num()];
    const float Angle = Serial * 2.39996f;   // golden-angle scatter so a wave does not stack on one point
    const FVector At = Base + FVector(FMath::Cos(Angle) * 160.f, FMath::Sin(Angle) * 160.f, 110.f);

    FActorSpawnParameters Params;
    Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
    AHWNodeEnemy* Enemy = GetWorld()->SpawnActor<AHWNodeEnemy>(AHWNodeEnemy::StaticClass(), At, FRotator(0.f, 90.f, 0.f), Params);
    if (!Enemy)
    {
        Waves.EnemyDied(Waves.Now());   // never arrived: do not hold the wave
        return;
    }
    Enemy->Configure(this, EnemyRole, EnemyRoute, 1.f);
    Enemy->OnEnemyDied.AddUniqueDynamic(this, &AHWNodeDirector::HandleEnemyDied);
    Enemies.Add(Enemy);
}

void AHWNodeDirector::HandleEnemyDied(AHWNodeEnemy* Enemy)
{
    Enemies.Remove(Enemy);
    if (Enemy && Enemy->WasKilled()) ++Kills;
    Waves.EnemyDied(Waves.Now());
}

void AHWNodeDirector::HandleFacilityDestroyed(AHWNodeFacility* Facility)
{
    if (!Facility) return;
    if (Facility->GetKind() == EHWNodeFacilityKind::Gate) Outcome = TEXT("The south gate is down - hold the central barrier");
    if (Facility->GetKind() == EHWNodeFacilityKind::Generator) Outcome = TEXT("Generator lost - lights, turrets and the forecast are out");
}

void AHWNodeDirector::ReportCounter(bool bPerfect)
{
    ++Counters;
    if (bPerfect) ++PerfectCounters;
    bLastCounterPerfect = bPerfect;
    LastCounterShownFor = 1.2f;
}

void AHWNodeDirector::SpawnBoss()
{
    bBossPhase = true;
    FActorSpawnParameters Params;
    Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
    Boss = GetWorld()->SpawnActor<AHWBossCharacter>(AHWBossCharacter::StaticClass(), Config->BossStart + FVector(0.f, 0.f, 120.f), FRotator(0.f, -90.f, 0.f), Params);
    if (!Boss)
    {
        HandleBossDied(nullptr);
        return;
    }
    Boss->SpawnDefaultController();
    // the relay (중계자): an infected human, core on the left forearm - stand-in body until its model exists
    BossCore = NewObject<UHWBossCoreComponent>(Boss, TEXT("ArmCoreRules"));
    BossCore->RegisterComponent();
    BossCore->OnCoreExposed.AddUniqueDynamic(this, &AHWNodeDirector::HandleCoreExposed);
    BossCore->OnCoreExtracted.AddUniqueDynamic(this, &AHWNodeDirector::HandleCoreExtracted);
    Boss->OnBossDied.AddUniqueDynamic(this, &AHWNodeDirector::HandleBossDied);
    Outcome = TEXT("The Relay comes through the central barrier");
}

void AHWNodeDirector::HandleCoreExposed()
{
    Outcome = TEXT("Arm armour broken - the core is out (finish at 10%: hit to kill, or Execute to extract)");
}

void AHWNodeDirector::HandleCoreExtracted()
{
    Outcome = TEXT("Core extracted");
}

void AHWNodeDirector::HandleBossDied(AHWBossCharacter* DeadBoss)
{
    const bool bExtracted = BossCore && BossCore->WasExtracted();
    if (Machine.DefenceHeld())
    {
        Outcome = bExtracted ? TEXT("Defence held - the Relay's core extracted") : TEXT("Defence held - the Relay is dead");
        SetState(Machine.State);
    }
}

void AHWNodeDirector::HandleInteract()
{
    // after the run: Interact starts it again; a missing technician is rescued by walking to them and interacting
    if (Machine.State == HWNodeRules::ENodeState::Stable || Machine.State == HWNodeRules::ENodeState::Fallen
        || Machine.State == HWNodeRules::ENodeState::Retakeable)
    {
        RestartRun();
        return;
    }
    if (Technician && GetPlayer() && FVector::Dist2D(Technician->GetActorLocation(), GetPlayer()->GetActorLocation()) < 400.f) Technician->Rescue();
}

void AHWNodeDirector::RestartRun()
{
    if (!Config) return;
    for (AHWNodeEnemy* E : TArray<TObjectPtr<AHWNodeEnemy>>(Enemies)) if (E) E->Discard();
    Enemies.Reset();
    if (Boss) Boss->Destroy();
    Boss = nullptr;
    BossCore = nullptr;
    bBossPhase = false;
    for (AHWNodeFacility* F : Facilities) if (F) F->RepairBy(1e9f);
    if (Technician) Technician->Destroy();
    FActorSpawnParameters Params;
    Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
    Technician = GetWorld()->SpawnActor<AHWNodeNpc>(AHWNodeNpc::StaticClass(), Config->TechnicianStart + FVector(0.f, 0.f, 100.f), FRotator(0.f, -90.f, 0.f), Params);
    Machine = HWNodeRules::FNodeStateMachine();
    Machine.CommsHoldToFall = Config->CommsHoldToFall;
    Machine.SetThreat(0.7f);
    Waves = HWNodeRules::FWaveRunner();
    StartDelay = 6.f;
    Kills = Counters = PerfectCounters = 0;
    Outcome.Reset();
    SetState(Machine.State);
    if (AHWAinCharacter* Player = GetPlayer())
    {
        if (Player->GetCombat() && Player->GetCombat()->IsDead()) Player->GetCombat()->Revive(1.f);
        Player->SetActorLocation(Config->PlayerStart + FVector(0.f, 0.f, 100.f));
    }
}

void AHWNodeDirector::SetState(HWNodeRules::ENodeState NewState)
{
    OnNodeStateChanged.Broadcast(static_cast<EHWNodeState>(NewState));
}

bool AHWNodeDirector::EnemyOnComms() const
{
    const AHWNodeFacility* Comms = GetFacility(EHWNodeFacilityKind::Comms);
    if (!Comms) return false;
    for (const AHWNodeEnemy* E : Enemies)
    {
        if (E && !E->IsDeadEnemy() && Comms->DistanceToSurface2D(E->GetActorLocation()) <= Config->CommsHoldRadius) return true;
    }
    return false;
}

void AHWNodeDirector::TickPlayer(float DeltaSeconds)
{
    AHWAinCharacter* Player = GetPlayer();
    if (!Player || !Player->GetCombat()) return;
    if (!bPlayerPlaced)
    {
        Player->SetActorLocation(Config->PlayerStart + FVector(0.f, 0.f, 100.f));
        Player->SetActorRotation(FRotator(0.f, -90.f, 0.f));   // facing south, down the road the enemies come up
        bPlayerPlaced = true;
    }
    if (!bInteractBound)
    {
        Player->OnLocalInteract.AddUObject(this, &AHWNodeDirector::HandleInteract);
        Player->OnLocalExecute.AddWeakLambda(this, [this]()
        {
            if (BossCore && GetPlayer()) BossCore->TryBeginExtraction(GetPlayer());
        });
        bInteractBound = true;
    }

    // fell off the graybox: back to the start, no death
    if (Player->GetActorLocation().Z < Config->FallZ)
    {
        Player->SetActorLocation(Config->PlayerStart + FVector(0.f, 0.f, 100.f));
    }

    // death -> back at the gate after a few seconds, full health (P0 death / return)
    if (Player->GetCombat()->IsDead())
    {
        if (PlayerDeadFor < 0.f)
        {
            PlayerDeadFor = 0.f;
            ++PlayerDeaths;
        }
        PlayerDeadFor += DeltaSeconds;
        if (PlayerDeadFor >= HWNodeDirectorLocal::RespawnSeconds && Player->GetCombat()->Revive(1.f))
        {
            Player->SetActorLocation(Config->PlayerStart + FVector(0.f, 0.f, 100.f));
            PlayerDeadFor = -1.f;
        }
    }
    else
    {
        PlayerDeadFor = -1.f;
    }
}

void AHWNodeDirector::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!Config) return;

    TickPlayer(DeltaSeconds);
    LastCounterShownFor = FMath::Max(0.f, LastCounterShownFor - DeltaSeconds);

    for (AHWNodeEnemy* E : TArray<TObjectPtr<AHWNodeEnemy>>(Enemies))
    {
        if (E && !E->IsDeadEnemy() && E->GetActorLocation().Z < Config->FallZ) E->Discard();
    }

    switch (Machine.State)
    {
    case HWNodeRules::ENodeState::Alert:
    case HWNodeRules::ENodeState::Uneasy:
    case HWNodeRules::ENodeState::Stable:
        if (StartDelay > 0.f)
        {
            StartDelay -= DeltaSeconds;
            if (StartDelay <= 0.f && Outcome.IsEmpty()) StartInvasion();
        }
        break;

    case HWNodeRules::ENodeState::Invasion:
    {
        if (!bBossPhase)
        {
            const int32 Wave = Waves.Tick(DeltaSeconds);
            if (Wave >= 0) SpawnWave(Wave);
            if (Waves.Done()) SpawnBoss();
        }
        const AHWNodeFacility* Comms = GetFacility(EHWNodeFacilityKind::Comms);
        if (Machine.TickInvasion(DeltaSeconds, Comms && Comms->IsDestroyed(), EnemyOnComms()))
        {
            Outcome = TEXT("Namsan has fallen - the map goes dark (Interact to try again)");
            SetState(Machine.State);
        }
        break;
    }

    case HWNodeRules::ENodeState::Recovering:
    {
        // the technician sets the pace (HWNodeRules::TechnicianRepairScale)
        const float Scale = Technician ? Technician->RepairScale() : HWNodeRules::TechnicianRepairScale(HWNodeRules::ENpcState::Missing);
        for (AHWNodeFacility* F : Facilities) if (F && F->GetHealthFraction() < 1.f) F->RepairBy(HWNodeDirectorLocal::RepairPerSecond * Scale * DeltaSeconds);
        if (Machine.AddRecovery(HWNodeDirectorLocal::RecoverPerSecond * Scale * DeltaSeconds))
        {
            Outcome = TEXT("Namsan is stable again (Interact to run the defence again)");
            SetState(Machine.State);
        }
        break;
    }

    case HWNodeRules::ENodeState::Fallen:
    case HWNodeRules::ENodeState::Retakeable:
    case HWNodeRules::ENodeState::Retaking:
    {
        const HWNodeRules::ENodeState Before = Machine.State;
        Machine.TickOccupation(DeltaSeconds / 3600.f);
        if (Machine.State != Before) SetState(Machine.State);
        break;
    }
    }

    DrawHud();
}

void AHWNodeDirector::DrawHud() const
{
    // ugly but playable (hand-off §21): engine on-screen lines until the node HUD widget exists
    if (!GEngine) return;
    using namespace HWNodeDirectorLocal;
    const AHWNodeFacility* Gate = GetFacility(EHWNodeFacilityKind::Gate);
    const AHWNodeFacility* Gen = GetFacility(EHWNodeFacilityKind::Generator);
    const AHWNodeFacility* Comms = GetFacility(EHWNodeFacilityKind::Comms);
    const int32 Power = Gen ? Gen->GetPower() : 0;
    const HWNodeRules::FNodeServices S = HWNodeRules::NodeServices(Machine.State, Comms ? Comms->GetHealthFraction() : 0.f, Power);
    int32 Line = 0;
    const auto Show = [&Line](const FString& Text, const FColor& Color)
    {
        GEngine->AddOnScreenDebugMessage(HudKey + Line++, 0.f, Color, Text);
    };

    Show(FString::Printf(TEXT("%s  [%s]"), *Config->DisplayName, StateName(Machine.State)), FColor(255, 210, 120));
    if (Machine.State == HWNodeRules::ENodeState::Invasion)
    {
        Show(bBossPhase
                ? FString::Printf(TEXT("THE RELAY  %.0f%%   core armour %.0f%%%s"),
                    Boss ? 100.f * Boss->GetHealth() / FMath::Max(1.f, Boss->GetMaxHealth()) : 0.f,
                    BossCore ? 100.f * BossCore->GetCoreArmorFraction() : 100.f,
                    BossCore && BossCore->CanFinish() ? TEXT("   FINISH: hit = kill / Execute = extract") : TEXT(""))
                : FString::Printf(TEXT("Wave %d/%d   %.0fs   enemies %d   kills %d"), FMath::Min(Waves.NextWave, Waves.WaveCount), Waves.WaveCount, Waves.Now(), Waves.Alive, Kills),
            FColor::White);
        if (Machine.CommsHeldSeconds > 0.f) Show(FString::Printf(TEXT("ENEMY ON COMMS  %.0f / %.0fs"), Machine.CommsHeldSeconds, Machine.CommsHoldToFall), FColor::Red);
        if (BossCore && BossCore->GetExtractionProgress() > 0.f) Show(FString::Printf(TEXT("EXTRACTING  %.0f%%  - do not get hit"), 100.f * BossCore->GetExtractionProgress()), FColor(255, 80, 60));
    }
    if (Machine.State == HWNodeRules::ENodeState::Fallen || Machine.State == HWNodeRules::ENodeState::Retakeable)
    {
        Show(FString::Printf(TEXT("Occupied %.2fh - %s"), Machine.OccupiedHours, TierName(Machine.Tier())), FColor(255, 120, 120));
    }
    if (StartDelay > 0.f && Machine.State == HWNodeRules::ENodeState::Alert) Show(FString::Printf(TEXT("Invasion in %.0fs - hold the south gate"), StartDelay), FColor(255, 160, 80));
    Show(FString::Printf(TEXT("Gate %.0f%%   Generator %.0f%% (power %d)   Comms %.0f%%   Tech %s"),
        Gate ? 100.f * Gate->GetHealthFraction() : 0.f, Gen ? 100.f * Gen->GetHealthFraction() : 0.f, Power,
        Comms ? 100.f * Comms->GetHealthFraction() : 0.f,
        !Technician ? TEXT("-") : Technician->GetState() == HWNodeRules::ENpcState::Normal ? TEXT("ok") :
        Technician->GetState() == HWNodeRules::ENpcState::Injured ? TEXT("injured") :
        Technician->GetState() == HWNodeRules::ENpcState::Missing ? TEXT("MISSING") : TEXT("rescued")), FColor(180, 220, 255));
    Show(FString::Printf(TEXT("Map intel %.0f%%   event detection %.0f%%   rescue signals %s   forecast %s"),
        100.f * S.MapIntel, 100.f * S.EventDetection, S.bRescueSignals ? TEXT("on") : TEXT("OFF"), S.bInvasionForecast ? TEXT("on") : TEXT("OFF")), FColor(150, 200, 150));
    Show(FString::Printf(TEXT("Counters %d (perfect %d)   deaths %d"), Counters, PerfectCounters, PlayerDeaths), FColor(200, 200, 200));
    if (LastCounterShownFor > 0.f) Show(bLastCounterPerfect ? TEXT("PERFECT COUNTER") : TEXT("COUNTER"), bLastCounterPerfect ? FColor(255, 230, 80) : FColor(200, 200, 255));
    if (PlayerDeadFor >= 0.f) Show(FString::Printf(TEXT("Down - back at the gate in %.0fs"), FMath::Max(0.f, RespawnSeconds - PlayerDeadFor)), FColor::Red);
    if (!Outcome.IsEmpty()) Show(Outcome, FColor(255, 220, 160));
    // clear the lines this frame did not use
    for (int32 Spare = Line; Spare < 14; ++Spare) GEngine->RemoveOnScreenDebugMessage(HudKey + Spare);
}
