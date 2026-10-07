#include "Node/HWNodeDirector.h"

#include "Boss/HWBossCharacter.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Components/StaticMeshComponent.h"
#include "DrawDebugHelpers.h"
#include "Engine/Engine.h"
#include "Engine/GameInstance.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Node/HWBossCoreComponent.h"
#include "Node/HWNodeEnemy.h"
#include "Node/HWNodeFacility.h"
#include "Network/HWRaidNetworkSubsystem.h"
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
        case HWNodeRules::ENodeState::Alert: return TEXT("ALERT - PREPARE");
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

    const TCHAR* NpcStateShort(HWNodeRules::ENpcState S)
    {
        switch (S)
        {
        case HWNodeRules::ENpcState::Normal: return TEXT("ok");
        case HWNodeRules::ENpcState::Injured: return TEXT("hurt");
        case HWNodeRules::ENpcState::Missing: return TEXT("TAKEN");
        case HWNodeRules::ENpcState::Rescued: return TEXT("back");
        }
        return TEXT("?");
    }

    const TCHAR* GuildRoleName(HWNodeRules::EGuildRole R)
    {
        switch (R)
        {
        case HWNodeRules::EGuildRole::Leader: return TEXT("leader");
        case HWNodeRules::EGuildRole::Vice: return TEXT("vice");
        case HWNodeRules::EGuildRole::CombatCaptain: return TEXT("combat captain");
        case HWNodeRules::EGuildRole::SupplyCaptain: return TEXT("supply captain");
        case HWNodeRules::EGuildRole::CraftCaptain: return TEXT("craft captain");
        default: return TEXT("member");
        }
    }

    bool PolicyNamed(const FString& Key, HWNodeRules::EPolicy& Out)
    {
        static const TCHAR* PolicyKeys[] = { TEXT("gate_reinforce"), TEXT("generator_reinforce"), TEXT("arm_npcs"), TEXT("scouting"), TEXT("medical_stock"), TEXT("reserve_power") };
        for (int32 I = 0; I < 6; ++I)
        {
            if (Key == PolicyKeys[I]) { Out = static_cast<HWNodeRules::EPolicy>(I); return true; }
        }
        return false;
    }

    bool SegmentHitsBox2D(const FVector& A, const FVector& B, const FVector& Center, const FVector& Half)
    {
        for (int32 K = 0; K <= 40; ++K)
        {
            const FVector P = FMath::Lerp(A, B, K / 40.f);
            if (FMath::Abs(P.X - Center.X) <= Half.X + 40.f && FMath::Abs(P.Y - Center.Y) <= Half.Y + 40.f && FMath::Abs(P.Z - Center.Z) <= Half.Z + 200.f) return true;
        }
        return false;
    }

    constexpr float RespawnSeconds = 5.f;
    constexpr float RepairPerSecond = 900.f;    // facility HP per second while recovering, x technician scale
    constexpr float RecoverPerSecond = 0.05f;   // 20 s to Stable with the technician well
    constexpr float ShotEvery = 0.25f;          // turrets and the guard land their damage in quarter-second blows

    // hwnode-run/1 keys (tools/ue/node-sim.cjs uses the same strings)
    const TCHAR* NpcStateKey(HWNodeRules::ENpcState S)
    {
        switch (S)
        {
        case HWNodeRules::ENpcState::Normal: return TEXT("normal");
        case HWNodeRules::ENpcState::Injured: return TEXT("injured");
        case HWNodeRules::ENpcState::Missing: return TEXT("missing");
        case HWNodeRules::ENpcState::Rescued: return TEXT("rescued");
        }
        return TEXT("normal");
    }

    const TCHAR* FacilityKey(EHWNodeFacilityKind K)
    {
        switch (K)
        {
        case EHWNodeFacilityKind::Gate: return TEXT("gate");
        case EHWNodeFacilityKind::Generator: return TEXT("generator");
        case EHWNodeFacilityKind::Comms: return TEXT("comms");
        case EHWNodeFacilityKind::Turret: return TEXT("turret");
        case EHWNodeFacilityKind::Barricade: return TEXT("barricade");
        }
        return TEXT("gate");
    }

    // the simulator's e.tk[0]
    TCHAR TargetKey(HWNodeRules::ETargetKind K)
    {
        switch (K)
        {
        case HWNodeRules::ETargetKind::Player: return TEXT('p');
        case HWNodeRules::ETargetKind::Gate: return TEXT('g');
        case HWNodeRules::ETargetKind::Generator: return TEXT('g');
        case HWNodeRules::ETargetKind::Comms: return TEXT('c');
        default: return TEXT('n');
        }
    }
    constexpr float InteractReach = 500.f;
    constexpr int32 HudKey = 920000;
}

AHWNodeDirector::AHWNodeDirector()
{
    PrimaryActorTick.bCanEverTick = true;
    SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    RootComponent = SceneRoot;
}

bool AHWNodeDirector::ConfigureNode(FName NodeId, const FString& Options)
{
    Config = UHWNodeConfig::LoadFromJson(NodeId, this);
    if (!Config) return false;

    // the local player's guild role (permissions) - the server decides it online (server/node-store.cjs guildRoleOf)
    const FString RoleOption = UGameplayStatics::ParseOption(Options, TEXT("HWGuildRole"));
    if (RoleOption == TEXT("vice")) GuildRole = HWNodeRules::EGuildRole::Vice;
    else if (RoleOption == TEXT("combat")) GuildRole = HWNodeRules::EGuildRole::CombatCaptain;
    else if (RoleOption == TEXT("supply")) GuildRole = HWNodeRules::EGuildRole::SupplyCaptain;
    else if (RoleOption == TEXT("craft")) GuildRole = HWNodeRules::EGuildRole::CraftCaptain;
    else if (RoleOption == TEXT("member")) GuildRole = HWNodeRules::EGuildRole::Member;

    // the steward's policy picks: within the budget, or none
    TArray<FString> PolicyNames;
    UGameplayStatics::ParseOption(Options, TEXT("HWPolicies")).ParseIntoArray(PolicyNames, TEXT(","));
    for (const FString& PolicyName : PolicyNames)
    {
        HWNodeRules::EPolicy P;
        if (HWNodeDirectorLocal::PolicyNamed(PolicyName.TrimStartAndEnd(), P)) Policies.Add(P);
    }
    if (!HWNodeRules::ValidPolicies(Policies.GetData(), Policies.Num()))
    {
        PolicyNote = FString::Printf(TEXT("policies over budget %d or repeated - none applied"), HWNodeRules::PolicyBudget);
        Policies.Reset();
    }
    Policy = HWNodeRules::PolicyEffects(Policies.GetData(), Policies.Num());

    const FString SupplyOption = UGameplayStatics::ParseOption(Options, TEXT("HWSupply"));
    SupplyStart = SupplyOption.IsEmpty() ? Config->DefaultSupply : FMath::Clamp(FCString::Atoi(*SupplyOption), 0, 30);
    return true;
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
    SpawnNpcs();
    Machine.CommsHoldToFall = Config->CommsHoldToFall;
    BeginPreparation();
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
        if (UMaterialInterface* BaseMaterial = Part->GetMaterial(0))
        {
            UMaterialInstanceDynamic* Mat = UMaterialInstanceDynamic::Create(BaseMaterial, this);
            Mat->SetVectorParameterValue(TEXT("Color"), B.Color);
            Part->SetMaterial(0, Mat);
        }
        GrayboxParts.Add(Part);
    }

    // flat floor marks (no collision) where G does something: the shelter (blue), the medical bay (green), the holding spot (white)
    const auto AddMark = [this, Cube, &Index](const FVector& At, const FLinearColor& MarkColor)
    {
        if (At.IsZero()) return;
        UStaticMeshComponent* Mark = NewObject<UStaticMeshComponent>(this, *FString::Printf(TEXT("Graybox_%d"), Index++));
        Mark->SetStaticMesh(Cube);
        Mark->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        Mark->SetupAttachment(SceneRoot);
        Mark->SetWorldLocation(At + FVector(0.f, 0.f, 3.f));
        Mark->SetWorldScale3D(FVector(3.f, 3.f, 0.04f));   // 3 m square, 4 cm thick
        Mark->RegisterComponent();
        if (UMaterialInterface* BaseMaterial = Mark->GetMaterial(0))
        {
            UMaterialInstanceDynamic* Mat = UMaterialInstanceDynamic::Create(BaseMaterial, this);
            Mat->SetVectorParameterValue(TEXT("Color"), MarkColor);
            Mark->SetMaterial(0, Mat);
        }
        GrayboxParts.Add(Mark);
    };
    AddMark(Config->ShelterPoint, FLinearColor(0.25f, 0.75f, 1.f));
    AddMark(Config->MedicalBay, FLinearColor(0.25f, 0.9f, 0.5f));
    AddMark(Config->HoldingSpot, FLinearColor(0.9f, 0.9f, 0.9f));
}

void AHWNodeDirector::SpawnFacilities()
{
    for (FHWNodeFacilityDef Def : Config->Facilities)
    {
        // the steward's reinforcement policies
        if (Def.Kind == EHWNodeFacilityKind::Gate) Def.MaxHealth *= Policy.GateHealthScale;
        if (Def.Kind == EHWNodeFacilityKind::Generator || Def.Kind == EHWNodeFacilityKind::Turret) Def.MaxHealth *= Policy.GeneratorHealthScale;
        AHWNodeFacility* F = GetWorld()->SpawnActor<AHWNodeFacility>(AHWNodeFacility::StaticClass(), Def.Location, FRotator::ZeroRotator);
        if (!F) continue;
        F->Configure(Def);
        F->OnFacilityDestroyed.AddUniqueDynamic(this, &AHWNodeDirector::HandleFacilityDestroyed);
        Facilities.Add(F);
    }
}

void AHWNodeDirector::SpawnNpcs()
{
    FActorSpawnParameters Params;
    Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
    for (const FHWNodeNpcDef& Def : Config->Npcs)
    {
        AHWNodeNpc* Npc = GetWorld()->SpawnActor<AHWNodeNpc>(AHWNodeNpc::StaticClass(), Def.Location + FVector(0.f, 0.f, 100.f), FRotator(0.f, -90.f, 0.f), Params);
        if (!Npc) continue;
        Npc->Configure(this, Def, Policy.bNpcsArmed);
        Npcs.Add(Npc);
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

AHWNodeNpc* AHWNodeDirector::FindNpc(EHWNodeNpcRole NpcRole) const
{
    for (AHWNodeNpc* Npc : Npcs)
    {
        if (Npc && Npc->GetRole() == NpcRole) return Npc;
    }
    return nullptr;
}

AHWNodeNpc* AHWNodeDirector::NearestTargetableNpc(const FVector& From) const
{
    AHWNodeNpc* Best = nullptr;
    float BestDistance = TNumericLimits<float>::Max();
    for (AHWNodeNpc* Npc : Npcs)
    {
        if (!Npc || !Npc->IsTargetable()) continue;
        const float D = FVector::Dist2D(From, Npc->GetActorLocation());
        if (D < BestDistance) { BestDistance = D; Best = Npc; }
    }
    return Best;
}

AHWNodeFacility* AHWNodeDirector::BarricadeOnPath(const FVector& From, const FVector& To) const
{
    for (AHWNodeFacility* F : Facilities)
    {
        if (F && F->GetKind() == EHWNodeFacilityKind::Barricade && !F->IsDestroyed()
            && HWNodeDirectorLocal::SegmentHitsBox2D(From, To, F->GetActorLocation(), F->GetHalfExtent())) return F;
    }
    return nullptr;
}

AHWNodeFacility* AHWNodeDirector::TurretNear(const FVector& At, float Radius) const
{
    for (AHWNodeFacility* F : Facilities)
    {
        if (F && F->GetKind() == EHWNodeFacilityKind::Turret && !F->IsDestroyed() && F->DistanceToSurface2D(At) <= Radius) return F;
    }
    return nullptr;
}

AHWNodeFacility* AHWNodeDirector::NearestStanding(const FVector& At, float& OutDistance) const
{
    AHWNodeFacility* Best = nullptr;
    OutDistance = -1.f;
    for (AHWNodeFacility* F : Facilities)
    {
        if (!F || F->IsDestroyed()) continue;
        const float D = F->DistanceToSurface2D(At);
        if (!Best || D < OutDistance) { Best = F; OutDistance = D; }
    }
    return Best;
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
    if (const AHWNodeNpc* Npc = NearestTargetableNpc(From)) V.Npc = FVector::Dist2D(From, Npc->GetActorLocation());
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
        if (const AHWNodeNpc* Npc = NearestTargetableNpc(From)) return Npc->GetActorLocation();
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

TArray<FVector> AHWNodeDirector::ExtensionFor(HWNodeRules::ETargetKind Kind, const FVector& From) const
{
    if (!Config) return {};
    // the target's route (generator, comms, or the route to the NPC it is after) gives the end point; the route graph
    // gives the way there from wherever the enemy is (UHWNodeConfig::PathBetween, docs/design/201 §8)
    // An NPC is followed to where it is now, not to its home route's end - a technician sent to the gate had a runner
    // circling the generator building for good (tools/ue/node-sim.cjs).
    if (Kind == HWNodeRules::ETargetKind::Npc)
    {
        const AHWNodeNpc* Npc = NearestTargetableNpc(From);
        if (!Npc) return {};
        TArray<FVector> ToNpc = Config->PathBetween(From, Npc->GetActorLocation());
        return ToNpc.Num() > 0 ? ToNpc : Config->Route(Npc->GetRoute());
    }
    FName TargetRoute = NAME_None;
    if (Kind == HWNodeRules::ETargetKind::Generator) TargetRoute = FName(TEXT("generator"));
    else if (Kind == HWNodeRules::ETargetKind::Comms) TargetRoute = FName(TEXT("comms"));
    if (TargetRoute.IsNone()) return {};
    const TArray<FVector>& Plain = Config->Route(TargetRoute);
    if (Plain.Num() == 0) return {};
    TArray<FVector> GraphPath = Config->PathBetween(From, Plain.Last());
    return GraphPath.Num() > 0 ? GraphPath : Plain;   // a node file without a connected graph: the plain route as before
}

TArray<FVector> AHWNodeDirector::PathFromTechnicianTo(EHWNodeFacilityKind Kind) const
{
    // home (generator) -> plaza, then out along the facility's route. Routes run plaza-outwards, so reverse the first.
    TArray<FVector> Path;
    const AHWNodeNpc* Tech = FindNpc(EHWNodeNpcRole::Technician);
    if (!Tech || !Config) return Path;
    const TArray<FVector>& HomeRoute = Config->Route(Tech->GetRoute());
    for (int32 I = HomeRoute.Num() - 1; I >= 0; --I) Path.Add(HomeRoute[I]);
    const TArray<FVector>& Main = Config->Route(TEXT("main"));
    if (Main.Num() > 0) Path.Add(Main.Last());   // the plaza
    if (Kind == EHWNodeFacilityKind::Generator) Path.Append(Config->Route(TEXT("generator")));
    else if (Kind == EHWNodeFacilityKind::Comms) Path.Append(Config->Route(TEXT("comms")));
    else
    {
        // south: back down the main road to just inside the gate - and up to its inner face: the road's waypoint stops
        // 440 cm short, outside the 220 cm repair reach, so an ordered technician never repaired (node-campaign.cjs)
        for (int32 I = Main.Num() - 1; I >= 1; --I) Path.Add(Main[I]);
        if (const AHWNodeFacility* Gate = GetFacility(EHWNodeFacilityKind::Gate))
        {
            const FVector GateAt = Gate->GetActorLocation();
            Path.Add(FVector(GateAt.X, GateAt.Y + Gate->GetHalfExtent().Y + 80.f, Path.Num() > 0 ? Path.Last().Z : GateAt.Z));
        }
    }
    return Path;
}

FString AHWNodeDirector::WavePreview(int32 WaveIndex) const
{
    if (WaveIndex >= HWNodeRules::PrototypeAWaveCount) return TEXT("the Relay (boss)");
    static const TCHAR* RoleNames[] = { TEXT("infected"), TEXT("runner"), TEXT("breaker"), TEXT("stalker"), TEXT("ARMORED") };
    const HWNodeRules::FWaveSpec W = HWNodeRules::PrototypeAWave(WaveIndex);
    FString Text;
    for (int32 I = 0; I < static_cast<int32>(HWNodeRules::EEnemyRole::Count); ++I)
    {
        if (W.Count[I] > 0) Text += FString::Printf(TEXT("%s%s x%d"), Text.IsEmpty() ? TEXT("") : TEXT(", "), RoleNames[I], W.Count[I]);
    }
    return Text;
}

HWNodeRules::FNpcEffects AHWNodeDirector::CurrentNpcEffects() const
{
    HWNodeRules::ENpcState States[HWNodeRules::NpcRoleCount];
    for (int32 I = 0; I < HWNodeRules::NpcRoleCount; ++I)
    {
        const AHWNodeNpc* Npc = FindNpc(static_cast<EHWNodeNpcRole>(I));
        States[I] = Npc ? Npc->GetState() : HWNodeRules::ENpcState::Missing;
        // off post in the shelter: the medic, the scout and the operator lose their function (the technician and the
        // guard are never evacuated)
        if (Npc && Npc->IsEvacuated()) States[I] = HWNodeRules::ENpcState::Missing;
    }
    return HWNodeRules::NpcEffects(States, Policy);
}

void AHWNodeDirector::BeginPreparation()
{
    Machine.SetThreat(0.7f);   // the forecast saw it coming: Alert
    Supply.Points = SupplyStart;
    PrepLeft = HWNodeRules::PrepSeconds(CurrentNpcEffects(), Policy);
    SetState(Machine.State);
}

void AHWNodeDirector::StartInvasion()
{
    if (!Config || !Machine.StartInvasion()) return;
    Waves = HWNodeRules::FWaveRunner();
    PrepLeft = 0.f;
    BeginRunLog();
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
    const TArray<FVector>& EnemyRoute = Config->Route(Config->RouteForRole(EnemyRole, Serial));
    // flank routes start on their own trail; the rest at the checkpoint spawns
    const bool bOwnStart = EnemyRole == EHWNodeEnemyRole::Runner && EnemyRoute.Num() > 0;
    const FVector Base = bOwnStart ? EnemyRoute[0] : Config->SpawnPoints[Serial % Config->SpawnPoints.Num()];
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
    if (Enemy && Enemy->WasKilledByPlayer()) ++PlayerKills;   // turret and guard kills are the node's, not yours
    Waves.EnemyDied(Waves.Now());
}

void AHWNodeDirector::HandleFacilityDestroyed(AHWNodeFacility* Facility)
{
    if (!Facility) return;
    RunEvent(TEXT("facility"), Facility->GetFacilityId().ToString(), TEXT("destroyed"));
    if (Facility->GetKind() == EHWNodeFacilityKind::Gate) Notice = TEXT("The south gate is down - hold the central barrier");
    if (Facility->GetKind() == EHWNodeFacilityKind::Barricade) Notice = TEXT("A barricade on the forest trail broke");
    if (Facility->GetKind() == EHWNodeFacilityKind::Turret) Notice = TEXT("A turret is down");
    if (Facility->GetKind() == EHWNodeFacilityKind::Generator)
    {
        Notice = Policy.ReservePowerSeconds > 0.f ? TEXT("Generator lost - reserve power for 90 s") : TEXT("Generator lost - turrets, lights and the forecast are out");
        if (!bReserveUsed)
        {
            ReserveLeft = Policy.ReservePowerSeconds;
            bReserveUsed = true;
        }
    }
    NoticeFor = 5.f;
}

void AHWNodeDirector::ReportCounter(bool bPerfect)
{
    ++Counters;
    if (bPerfect) ++PerfectCounters;
    bLastCounterPerfect = bPerfect;
    LastCounterShownFor = 1.2f;
}

void AHWNodeDirector::ReportKill(EHWNodeEnemyRole EnemyRole, const FVector& At, bool bByPlayer, bool bWasAttacking)
{
    if (!bByPlayer) return;   // turrets and the guard are the node's, not the player's
    const HWNodeRules::EEnemyRole R = static_cast<HWNodeRules::EEnemyRole>(EnemyRole);
    Ledger.Raw[static_cast<int32>(HWNodeRules::EContribution::Kill)] += HWNodeRules::KillWeight(R);
    // defence = stopping an attack on the node (a facility, a barricade, a turret or an NPC), wherever it is caught.
    // It was «a kill within 15 m of a standing facility»: a virtual-guild campaign (tools/ue/node-campaign.cjs) showed that
    // paid guilds for letting enemies reach the base and starved the ones that stopped them out on the road.
    Ledger.Raw[static_cast<int32>(HWNodeRules::EContribution::Defense)] += HWNodeRules::DefenseCredit(R, bWasAttacking ? 0.f : -1.f);
    for (const FPing& P : Pings)
    {
        if (HWNodeRules::PingCredits(Clock - P.Born, FVector::Dist2D(At, P.At)))
        {
            Ledger.Raw[static_cast<int32>(HWNodeRules::EContribution::Command)] += 1.f;
            break;
        }
    }
}

void AHWNodeDirector::ReportRepair(float Amount)
{
    // the technician repairs on the player's order: the order-giver's contribution (per 100 HP)
    Ledger.Raw[static_cast<int32>(HWNodeRules::EContribution::Repair)] += Amount / 100.f;
}

void AHWNodeDirector::ReportNpcHurt(AHWNodeNpc* Npc)
{
    if (!Npc) return;
    RunEvent(TEXT("npc"), Npc->GetNpcId().ToString(), HWNodeDirectorLocal::NpcStateKey(Npc->GetState()));
    Notice = Npc->IsCaptive() ? FString::Printf(TEXT("%s was taken to the holding spot - rescue them (G there)"), *Npc->GetNpcId().ToString())
                              : FString::Printf(TEXT("%s is injured"), *Npc->GetNpcId().ToString());
    NoticeFor = 5.f;
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
    LastBossHealth = Boss->GetHealth();
    Notice = TEXT("The Relay comes through the central barrier");
    NoticeFor = 5.f;
}

void AHWNodeDirector::HandleCoreExposed()
{
    Notice = TEXT("Arm armour broken - the core is out (at 10%: hit to kill, or Execute to extract)");
    NoticeFor = 6.f;
}

void AHWNodeDirector::HandleCoreExtracted()
{
    Notice = TEXT("Core extracted");
    NoticeFor = 5.f;
}

void AHWNodeDirector::HandleBossDied(AHWBossCharacter* DeadBoss)
{
    const bool bExtracted = BossCore && BossCore->WasExtracted();
    if (Machine.DefenceHeld())
    {
        Outcome = bExtracted ? TEXT("Defence held - the Relay's core extracted") : TEXT("Defence held - the Relay is dead");
        SetState(Machine.State);
        FinishRun(TEXT("held"));
    }
}

void AHWNodeDirector::FinishRun(const TCHAR* ReportOutcome)
{
    if (bReported) return;
    bReported = true;
    // the run's report for the node server ({type:'node', action:'report'} - server/node-store.cjs nodeReport).
    // Written to Saved/HWNode/last_report.json until the client sends it over the raid socket.
    static const TCHAR* Keys[] = { TEXT("kill"), TEXT("defense"), TEXT("repair"), TEXT("npc_rescue"), TEXT("boss"), TEXT("supply"), TEXT("command") };
    FString Contrib;
    for (int32 I = 0; I < HWNodeRules::ContributionCount; ++I)
    {
        Contrib += FString::Printf(TEXT("%s\"%s\":%.2f"), I ? TEXT(",") : TEXT(""), Keys[I], Ledger.Raw[I]);
    }
    const FString Json = FString::Printf(TEXT("{\"node\":\"%s\",\"outcome\":\"%s\",\"contrib\":{%s}}"), *Config->NodeId.ToString(), ReportOutcome, *Contrib);
    FFileHelper::SaveStringToFile(Json, *FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("HWNode"), TEXT("last_report.json")));
    UE_LOG(LogTemp, Display, TEXT("[HWNode] report %s"), *Json);

    // online (-HWServer= / the raid socket is up): send it; the server's view comes back as HandleNodeReply
    UGameInstance* GameInstance = GetGameInstance();
    UHWRaidNetworkSubsystem* Net = GameInstance ? GameInstance->GetSubsystem<UHWRaidNetworkSubsystem>() : nullptr;
    if (Net && Net->IsConnected())
    {
        Net->OnNodeReply.AddUniqueDynamic(this, &AHWNodeDirector::HandleNodeReply);
        Net->OnNetworkError.AddUniqueDynamic(this, &AHWNodeDirector::HandleNetError);
        bReportPending = Net->SendNodeReport(Json);
        Notice = bReportPending ? TEXT("Report sent to the node server") : TEXT("Report could not be sent (saved locally)");
        NoticeFor = 5.f;
    }
}

void AHWNodeDirector::HandleNodeReply(FString ServerNodeState, FString ServerSteward)
{
    if (!bReportPending) return;   // a node reply to something else (info, policy, supply)
    bReportPending = false;
    Notice = FString::Printf(TEXT("Node server: %s - steward %s"), *ServerNodeState, ServerSteward.IsEmpty() ? TEXT("none yet") : *ServerSteward);
    NoticeFor = 8.f;
}

void AHWNodeDirector::HandleNetError(FString ServerError)
{
    if (!bReportPending) return;   // the server refused the report: say so (rate limit, not a defence now ...)
    bReportPending = false;
    Notice = FString::Printf(TEXT("Node server refused the report: %s (kept in Saved/HWNode)"), *ServerError);
    NoticeFor = 8.f;
}

void AHWNodeDirector::HandleInteract()
{
    AHWAinCharacter* Player = GetPlayer();
    if (!Player || !Config) return;
    const FVector Here = Player->GetActorLocation();

    // 1) captives at the holding spot: free them
    if (FVector::Dist2D(Here, Config->HoldingSpot) < HWNodeDirectorLocal::InteractReach)
    {
        int32 Freed = 0;
        for (AHWNodeNpc* Npc : Npcs)
        {
            if (Npc && Npc->IsCaptive() && Npc->Rescue())
            {
                ++Freed;
                RunEvent(TEXT("npc"), Npc->GetNpcId().ToString(), TEXT("rescued"));
            }
        }
        if (Freed > 0)
        {
            Ledger.Raw[static_cast<int32>(HWNodeRules::EContribution::NpcRescue)] += static_cast<float>(Freed);
            Notice = FString::Printf(TEXT("Rescued %d - they head home to recover"), Freed);
            NoticeFor = 4.f;
            return;
        }
    }

    // 2) preparation: build a barricade on a slot (supplies, a captain's call)
    if (Machine.State == HWNodeRules::ENodeState::Alert)
    {
        for (const FHWNodeFacilityDef& Slot : Config->BarricadeSlots)
        {
            if (FVector::Dist2D(Here, Slot.Location) > HWNodeDirectorLocal::InteractReach) continue;
            bool bBuilt = false;
            for (AHWNodeFacility* F : Facilities) bBuilt |= F && F->GetKind() == EHWNodeFacilityKind::Barricade && FVector::Dist2D(F->GetActorLocation(), Slot.Location) < 50.f;
            if (bBuilt) continue;
            if (!Can(HWNodeRules::EGuildPerm::InvestFacility) && !Can(HWNodeRules::EGuildPerm::AllocateSupply))
            {
                Notice = TEXT("Only the craft or supply captain (or the leaders) can build here");
            }
            else if (!Supply.Spend(HWNodeRules::ESupplyUse::Barricade))
            {
                Notice = FString::Printf(TEXT("Not enough supplies (a barricade costs %d)"), HWNodeRules::SupplyCost(HWNodeRules::ESupplyUse::Barricade));
            }
            else if (AHWNodeFacility* F = GetWorld()->SpawnActor<AHWNodeFacility>(AHWNodeFacility::StaticClass(), Slot.Location, FRotator::ZeroRotator))
            {
                F->Configure(Slot);
                F->OnFacilityDestroyed.AddUniqueDynamic(this, &AHWNodeDirector::HandleFacilityDestroyed);
                Facilities.Add(F);
                Ledger.Raw[static_cast<int32>(HWNodeRules::EContribution::Supply)] += static_cast<float>(HWNodeRules::SupplyCost(HWNodeRules::ESupplyUse::Barricade));
                Notice = TEXT("Barricade up on the forest trail");
            }
            NoticeFor = 4.f;
            return;
        }
    }

    // 3) preparation, at the shelter point: evacuate the NPCs under turret cover (or send them back to their posts).
    // Safety against function: the medic, scout and operator off post do nothing (docs/design/201 §3; node-sim.cjs:
    // captives 4 -> 1). The technician (repairs, orders) and the guard stay.
    if (Machine.State == HWNodeRules::ENodeState::Alert && !Config->ShelterPoint.IsZero()
        && FVector::Dist2D(Here, Config->ShelterPoint) < HWNodeDirectorLocal::InteractReach)
    {
        if (!Can(HWNodeRules::EGuildPerm::OrderNpc))
        {
            Notice = TEXT("Only a captain or the leaders can order an evacuation");
        }
        else
        {
            bool bAnyEvacuated = false;
            for (const AHWNodeNpc* Npc : Npcs) bAnyEvacuated |= Npc && Npc->IsEvacuated();
            int32 ShelterSlot = 0;
            for (AHWNodeNpc* Npc : Npcs)
            {
                if (!Npc || Npc->GetRole() == EHWNodeNpcRole::Guard || Npc->GetRole() == EHWNodeNpcRole::Technician) continue;
                if (bAnyEvacuated)
                {
                    Npc->ReturnHome();
                    continue;
                }
                const FVector Spot = Config->ShelterPoint + FVector((static_cast<float>(ShelterSlot++) - 1.5f) * 220.f, 150.f, 0.f);
                TArray<FVector> ShelterPath = Config->PathBetween(Npc->GetActorLocation(), Spot);
                ShelterPath.Add(Spot);
                Npc->EvacuateTo(ShelterPath);
            }
            Notice = bAnyEvacuated ? TEXT("NPCs back to their posts") : TEXT("Evacuation: NPCs gather under the central turrets (off post - no medic, forecast or rescue signals)");
        }
        NoticeFor = 4.f;
        return;
    }

    // 4) the technician: cycle the repair order (gate -> generator -> comms -> stay home)
    if (AHWNodeNpc* Tech = FindNpc(EHWNodeNpcRole::Technician))
    {
        if (FVector::Dist2D(Here, Tech->GetActorLocation()) < HWNodeDirectorLocal::InteractReach && Tech->IsTargetable())
        {
            if (!Can(HWNodeRules::EGuildPerm::OrderNpc))
            {
                Notice = TEXT("Only a captain or the leaders can give the technician orders");
            }
            else if (!Tech->HasOrder())
            {
                Tech->OrderTo(PathFromTechnicianTo(EHWNodeFacilityKind::Gate), EHWNodeFacilityKind::Gate);
            }
            else if (Tech->GetOrderFacility() == EHWNodeFacilityKind::Gate)
            {
                Tech->OrderTo(PathFromTechnicianTo(EHWNodeFacilityKind::Generator), EHWNodeFacilityKind::Generator);
            }
            else if (Tech->GetOrderFacility() == EHWNodeFacilityKind::Generator)
            {
                Tech->OrderTo(PathFromTechnicianTo(EHWNodeFacilityKind::Comms), EHWNodeFacilityKind::Comms);
            }
            else
            {
                Tech->ClearOrder();
                Tech->SetActorLocation(Tech->GetHome() + FVector(0.f, 0.f, 100.f));
            }
            NoticeFor = 3.f;
            return;
        }
    }

    // 5) after a run: again
    if (Machine.State == HWNodeRules::ENodeState::Stable || Machine.State == HWNodeRules::ENodeState::Fallen
        || Machine.State == HWNodeRules::ENodeState::Retakeable)
    {
        RestartRun();
    }
}

void AHWNodeDirector::HandleExecute()
{
    if (BossCore && GetPlayer()) BossCore->TryBeginExtraction(GetPlayer());
}

void AHWNodeDirector::HandlePing()
{
    const AHWAinCharacter* Player = GetPlayer();
    if (!Player) return;
    if (!Can(HWNodeRules::EGuildPerm::Ping))
    {
        Notice = TEXT("Rally pings are the combat captain's (or the leaders')");
        NoticeFor = 3.f;
        return;
    }
    FPing P;
    P.At = Player->GetActorLocation();
    P.Born = Clock;
    Pings.Add(P);
    Notice = TEXT("RALLY - kills here in the next 15 s count as command");
    NoticeFor = 3.f;
}

void AHWNodeDirector::RestartRun()
{
    if (!Config) return;
    InvasionClock = -1.f;   // a new run, a new log
    for (AHWNodeEnemy* E : TArray<TObjectPtr<AHWNodeEnemy>>(Enemies)) if (E) E->Discard();
    Enemies.Reset();
    if (Boss) Boss->Destroy();
    Boss = nullptr;
    BossCore = nullptr;
    bBossPhase = false;
    // built barricades go; everything else is repaired
    for (AHWNodeFacility* F : TArray<TObjectPtr<AHWNodeFacility>>(Facilities))
    {
        if (!F) continue;
        if (F->GetKind() == EHWNodeFacilityKind::Barricade)
        {
            Facilities.Remove(F);
            F->Destroy();
        }
        else
        {
            F->RepairBy(1e9f);
        }
    }
    for (AHWNodeNpc* Npc : Npcs) if (Npc) Npc->Destroy();
    Npcs.Reset();
    SpawnNpcs();
    Machine = HWNodeRules::FNodeStateMachine();
    Machine.CommsHoldToFall = Config->CommsHoldToFall;
    Waves = HWNodeRules::FWaveRunner();
    Ledger = HWNodeRules::FContribution();
    Pings.Reset();
    Kills = PlayerKills = Counters = PerfectCounters = 0;
    ShotAccumulators.Reset();   // the old guard and turrets are gone
    ReserveLeft = 0.f;
    bReserveUsed = false;
    bReported = false;
    Outcome.Reset();
    BeginPreparation();
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
        // only an enemy that came for the comms centre holds it - not one fighting the operator next door or passing by
        // (with armed NPCs the operator's longer fight used to hand over the node in two minutes: tools/ue/node-sim.cjs)
        if (E && !E->IsDeadEnemy() && E->GetTargetKind() == HWNodeRules::ETargetKind::Comms
            && Comms->DistanceToSurface2D(E->GetActorLocation()) <= Config->CommsHoldRadius) return true;
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
    if (InputBoundTo.Get() != Player)   // bind again if the pawn was replaced, not just revived
    {
        Player->OnLocalInteract.AddUObject(this, &AHWNodeDirector::HandleInteract);
        Player->OnLocalExecute.AddUObject(this, &AHWNodeDirector::HandleExecute);
        Player->OnLocalOpening.AddUObject(this, &AHWNodeDirector::HandlePing);
        InputBoundTo = Player;
    }

    // fell off the graybox: back to the start, no death
    if (Player->GetActorLocation().Z < Config->FallZ) Player->SetActorLocation(Config->PlayerStart + FVector(0.f, 0.f, 100.f));

    // the medic heals a player at the medical bay (HWNodeRules::NpcEffects)
    const HWNodeRules::FNpcEffects NpcFx = CurrentNpcEffects();
    if (!Player->GetCombat()->IsDead() && NpcFx.MedicalHealPerSecond > 0.f && FVector::Dist2D(Player->GetActorLocation(), Config->MedicalBay) < 300.f)
    {
        Player->GetCombat()->Heal(Player->GetCombat()->GetMaxHealth() * NpcFx.MedicalHealPerSecond * DeltaSeconds);
    }

    // death -> back at the gate after a few seconds, full health (P0 death / return)
    if (Player->GetCombat()->IsDead())
    {
        if (PlayerDeadFor < 0.f)
        {
            PlayerDeadFor = 0.f;
            ++PlayerDeaths;
            RunEvent(TEXT("player"), TEXT("player"), TEXT("dead"));
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

    // boss damage dealt (only the player hits the boss) -> boss contribution
    if (Boss && !Boss->IsDead() && LastBossHealth >= 0.f)
    {
        const float BossHealthNow = Boss->GetHealth();
        if (BossHealthNow < LastBossHealth) Ledger.Raw[static_cast<int32>(HWNodeRules::EContribution::Boss)] += LastBossHealth - BossHealthNow;
        LastBossHealth = BossHealthNow;
    }
}

void AHWNodeDirector::TickDefences(float DeltaSeconds)
{
    // turrets on generator power (with reserve), and the armed guard: nearest enemy in range, quarter-second blows
    const AHWNodeFacility* Gen = GetFacility(EHWNodeFacilityKind::Generator);
    ReserveLeft = FMath::Max(0.f, ReserveLeft - DeltaSeconds);
    const int32 Power = HWNodeRules::EffectivePower(Gen ? Gen->GetHealthFraction() : 0.f, ReserveLeft);
    const float TurretDps = HWNodeRules::TurretDps(Power);
    const HWNodeRules::FNpcEffects NpcFx = CurrentNpcEffects();

    struct FShooter { AActor* From; float Dps; float Range; };
    TArray<FShooter> Shooters;
    for (AHWNodeFacility* F : Facilities)
    {
        if (F && F->GetKind() == EHWNodeFacilityKind::Turret && !F->IsDestroyed() && TurretDps > 0.f) Shooters.Add({ F, TurretDps, HWNodeRules::TurretRangeCm });
    }
    if (AHWNodeNpc* Guard = FindNpc(EHWNodeNpcRole::Guard))
    {
        if (NpcFx.GuardDps > 0.f && Guard->IsTargetable()) Shooters.Add({ Guard, NpcFx.GuardDps, 1200.f });
    }
    for (const FShooter& S : Shooters)
    {
        AHWNodeEnemy* Target = nullptr;
        float Best = S.Range;
        for (AHWNodeEnemy* E : Enemies)
        {
            if (!E || E->IsDeadEnemy() || FMath::Abs(E->GetActorLocation().Z - S.From->GetActorLocation().Z) > 700.f) continue;
            const float D = FVector::Dist2D(E->GetActorLocation(), S.From->GetActorLocation());
            if (D < Best) { Best = D; Target = E; }
        }
        if (!Target) continue;
        float& Acc = ShotAccumulators.FindOrAdd(S.From);
        Acc += S.Dps * DeltaSeconds;
        if (Acc < S.Dps * HWNodeDirectorLocal::ShotEvery) continue;
        IHWCombatTargetInterface::Execute_ReceiveSystemHit(Target, Acc, EHWAttackTier::Light, S.From->GetActorLocation(), S.From);
        Acc = 0.f;
#if ENABLE_DRAW_DEBUG
        DrawDebugLine(GetWorld(), S.From->GetActorLocation() + FVector(0.f, 0.f, 100.f), Target->GetActorLocation(), FColor(255, 120, 220), false, 0.08f, 0, 3.f);
#endif
    }
}

void AHWNodeDirector::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!Config) return;
    Clock += DeltaSeconds;
    NoticeFor = FMath::Max(0.f, NoticeFor - DeltaSeconds);
    LastCounterShownFor = FMath::Max(0.f, LastCounterShownFor - DeltaSeconds);
    Pings.RemoveAll([this](const FPing& P) { return Clock - P.Born > HWNodeRules::PingLifeSeconds; });

    TickPlayer(DeltaSeconds);
    for (AHWNodeEnemy* E : TArray<TObjectPtr<AHWNodeEnemy>>(Enemies))
    {
        if (E && !E->IsDeadEnemy() && E->GetActorLocation().Z < Config->FallZ) E->Discard();
    }

    switch (Machine.State)
    {
    case HWNodeRules::ENodeState::Alert:
    case HWNodeRules::ENodeState::Uneasy:
    case HWNodeRules::ENodeState::Stable:
        if (PrepLeft > 0.f)
        {
            PrepLeft -= DeltaSeconds;
            if (PrepLeft <= 0.f && Outcome.IsEmpty()) StartInvasion();
        }
        break;

    case HWNodeRules::ENodeState::Invasion:
    {
        TickDefences(DeltaSeconds);
        if (!bBossPhase)
        {
            const int32 Wave = Waves.Tick(DeltaSeconds);
            if (Wave >= 0)
            {
                RunEvent(TEXT("wave"), FString::FromInt(Wave + 1), TEXT("spawned"));
                SpawnWave(Wave);
            }
            if (Waves.Done())
            {
                RunEvent(TEXT("state"), TEXT("node"), TEXT("held"));   // the simulator stops here: the waves are held
                WriteRunLog(TEXT("held"));
                SpawnBoss();
            }
        }
        if (InvasionClock >= 0.f)
        {
            InvasionClock += DeltaSeconds;
            if (InvasionClock >= NextFrameAt)
            {
                RecordFrame();
                NextFrameAt = FMath::FloorToFloat(InvasionClock) + 1.f;   // after a hitch: next whole second, no bunched frames
            }
        }
        const AHWNodeFacility* Comms = GetFacility(EHWNodeFacilityKind::Comms);
        if (Machine.TickInvasion(DeltaSeconds, Comms && Comms->IsDestroyed(), EnemyOnComms()))
        {
            Outcome = TEXT("Namsan has fallen - the map goes dark (G to try again)");
            SetState(Machine.State);
            RunEvent(TEXT("state"), TEXT("node"), TEXT("fallen"));
            WriteRunLog(TEXT("fallen"));
            FinishRun(TEXT("fallen"));
        }
        break;
    }

    case HWNodeRules::ENodeState::Recovering:
    {
        // the technician sets the pace (HWNodeRules::TechnicianRepairScale)
        const float Scale = CurrentNpcEffects().RepairScale;
        for (AHWNodeFacility* F : Facilities) if (F && F->GetHealthFraction() < 1.f) F->RepairBy(HWNodeDirectorLocal::RepairPerSecond * Scale * DeltaSeconds);
        if (Machine.AddRecovery(HWNodeDirectorLocal::RecoverPerSecond * Scale * DeltaSeconds))
        {
            Outcome = TEXT("Namsan is stable again (G to run the defence again)");
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
    const int32 Power = HWNodeRules::EffectivePower(Gen ? Gen->GetHealthFraction() : 0.f, ReserveLeft);
    const HWNodeRules::FNpcEffects NpcFx = CurrentNpcEffects();
    HWNodeRules::FNodeServices S = HWNodeRules::NodeServices(Machine.State, Comms ? Comms->GetHealthFraction() : 0.f, Power);
    S.bRescueSignals = S.bRescueSignals && NpcFx.bRescueSignals;   // no operator, no rescue signals
    int32 Line = 0;
    const auto Show = [&Line](const FString& Text, const FColor& Color)
    {
        GEngine->AddOnScreenDebugMessage(HudKey + Line++, 0.f, Color, Text);
    };

    Show(FString::Printf(TEXT("%s  [%s]   you: %s"), *Config->DisplayName, StateName(Machine.State), GuildRoleName(GuildRole)), FColor(255, 210, 120));
    if (Machine.State == HWNodeRules::ENodeState::Alert && PrepLeft > 0.f)
    {
        Show(FString::Printf(TEXT("PREPARE %.0fs - supplies %d (barricade %d at a forest-trail slot: G)   technician orders: G next to them"),
            PrepLeft, Supply.Points, HWNodeRules::SupplyCost(HWNodeRules::ESupplyUse::Barricade)), FColor(255, 170, 90));
        if (!Config->ShelterPoint.IsZero()) Show(TEXT("Evacuate the NPCs under the central turrets: G at the shelter point (they leave their posts)"), FColor(120, 200, 255));
        Show(NpcFx.bWavePreview ? FString::Printf(TEXT("Scout report - first wave: %s"), *WavePreview(0)) : FString(TEXT("No scout report (scout lost, no scouting policy)")), FColor(170, 220, 255));
    }
    if (Machine.State == HWNodeRules::ENodeState::Invasion)
    {
        const FString Next = NpcFx.bWavePreview && Waves.NextWave < Waves.WaveCount ? FString::Printf(TEXT("   next: %s"), *WavePreview(Waves.NextWave)) : FString();
        Show(bBossPhase
                ? FString::Printf(TEXT("THE RELAY  %.0f%%   core armour %.0f%%%s"),
                    Boss ? 100.f * Boss->GetHealth() / FMath::Max(1.f, Boss->GetMaxHealth()) : 0.f,
                    BossCore ? 100.f * BossCore->GetCoreArmorFraction() : 100.f,
                    BossCore && BossCore->CanFinish() ? TEXT("   FINISH: hit = kill / Execute (V) = extract") : TEXT(""))
                : FString::Printf(TEXT("Wave %d/%d   %.0fs   enemies %d   kills %d (you %d)%s"), FMath::Min(Waves.NextWave, Waves.WaveCount), Waves.WaveCount, Waves.Now(), Waves.Alive, Kills, PlayerKills, *Next),
            FColor::White);
        if (Machine.CommsHeldSeconds > 0.f) Show(FString::Printf(TEXT("ENEMY ON COMMS  %.0f / %.0fs"), Machine.CommsHeldSeconds, Machine.CommsHoldToFall), FColor::Red);
        if (BossCore && BossCore->GetExtractionProgress() > 0.f) Show(FString::Printf(TEXT("EXTRACTING  %.0f%%  - do not get hit"), 100.f * BossCore->GetExtractionProgress()), FColor(255, 80, 60));
    }
    if (Machine.State == HWNodeRules::ENodeState::Fallen || Machine.State == HWNodeRules::ENodeState::Retakeable)
    {
        Show(FString::Printf(TEXT("Occupied %.2fh - %s (difficulty x%.2f, reward x%.2f)"), Machine.OccupiedHours, TierName(Machine.Tier()),
            HWNodeRules::OccupationDifficulty(Machine.Tier()), HWNodeRules::OccupationReward(Machine.Tier())), FColor(255, 120, 120));
    }
    int32 Turrets = 0;
    for (const AHWNodeFacility* F : Facilities) Turrets += F && F->GetKind() == EHWNodeFacilityKind::Turret && !F->IsDestroyed() ? 1 : 0;
    const FString Reserve = ReserveLeft > 0.f ? FString::Printf(TEXT(", reserve %.0fs"), ReserveLeft) : FString();
    Show(FString::Printf(TEXT("Gate %.0f%%   Generator %.0f%% (power %d%s)   Comms %.0f%%   turrets %d (%.0f dps each)"),
        Gate ? 100.f * Gate->GetHealthFraction() : 0.f, Gen ? 100.f * Gen->GetHealthFraction() : 0.f, Power, *Reserve,
        Comms ? 100.f * Comms->GetHealthFraction() : 0.f, Turrets, HWNodeRules::TurretDps(Power)), FColor(180, 220, 255));
    FString Roster;
    for (const AHWNodeNpc* N : Npcs)
    {
        if (N) Roster += FString::Printf(TEXT("%s %s   "), *N->GetNpcId().ToString(), NpcStateShort(N->GetState()));
    }
    Show(Roster, FColor(140, 230, 160));
    Show(FString::Printf(TEXT("Map intel %.0f%%   detection %.0f%%   rescue signals %s   forecast %s   medic %.0f%%/s"),
        100.f * S.MapIntel, 100.f * S.EventDetection, S.bRescueSignals ? TEXT("on") : TEXT("OFF"), S.bInvasionForecast ? TEXT("on") : TEXT("OFF"),
        100.f * NpcFx.MedicalHealPerSecond), FColor(150, 200, 150));
    {
        FString Picks;
        static const TCHAR* PolicyLabels[] = { TEXT("gate+"), TEXT("generator+"), TEXT("armed NPCs"), TEXT("scouting"), TEXT("medical"), TEXT("reserve power") };
        for (const HWNodeRules::EPolicy P : Policies) Picks += FString::Printf(TEXT("%s "), PolicyLabels[static_cast<int32>(P)]);
        if (Picks.IsEmpty()) Picks = TEXT("none ");
        const FString Note = PolicyNote.IsEmpty() ? FString() : FString::Printf(TEXT("(%s)"), *PolicyNote);
        Show(FString::Printf(TEXT("Policies: %s%s"), *Picks, *Note), FColor(200, 190, 255));
    }
    Show(FString::Printf(TEXT("Contribution  kill %.1f  defense %.1f  repair %.1f  rescue %.0f  boss %.0f  supply %.0f  command %.0f   |  counters %d (perfect %d)  deaths %d"),
        Ledger.Raw[0], Ledger.Raw[1], Ledger.Raw[2], Ledger.Raw[3], Ledger.Raw[4], Ledger.Raw[5], Ledger.Raw[6], Counters, PerfectCounters, PlayerDeaths), FColor(200, 200, 200));
    if (LastCounterShownFor > 0.f) Show(bLastCounterPerfect ? TEXT("PERFECT COUNTER") : TEXT("COUNTER"), bLastCounterPerfect ? FColor(255, 230, 80) : FColor(200, 200, 255));
    if (PlayerDeadFor >= 0.f) Show(FString::Printf(TEXT("Down - back at the gate in %.0fs"), FMath::Max(0.f, RespawnSeconds - PlayerDeadFor)), FColor::Red);
    if (NoticeFor > 0.f && !Notice.IsEmpty()) Show(Notice, FColor(255, 230, 170));
    if (!Outcome.IsEmpty()) Show(Outcome, FColor(255, 220, 160));
    // clear the lines this frame did not use
    for (int32 Spare = Line; Spare < 18; ++Spare) GEngine->RemoveOnScreenDebugMessage(HudKey + Spare);
}

// ---------------------------------------------------------------- run log (hwnode-run/1, docs/design/201 §8)

void AHWNodeDirector::BeginRunLog()
{
    RunEvents.Reset();
    RunFrames.Reset();
    InvasionClock = 0.f;
    NextFrameAt = 0.f;
    DealtByPlayer = DealtByTurret = DealtByGuard = 0.0;

    // the options the simulator needs to play the same run: policies, barricades built, the technician's order, evacuation
    static const TCHAR* PolicyKeys[] = { TEXT("gate_reinforce"), TEXT("generator_reinforce"), TEXT("arm_npcs"), TEXT("scouting"), TEXT("medical_stock"), TEXT("reserve_power") };
    TArray<FString> PolicyList;
    for (const HWNodeRules::EPolicy P : Policies) PolicyList.Add(FString::Printf(TEXT("\"%s\""), PolicyKeys[static_cast<int32>(P)]));
    TArray<FString> BarricadeList;
    for (const AHWNodeFacility* F : Facilities)
    {
        if (F && F->GetKind() == EHWNodeFacilityKind::Barricade) BarricadeList.Add(FString::Printf(TEXT("\"%s\""), *F->GetFacilityId().ToString()));
    }
    FString TechOrder = TEXT("null");
    bool bAnyEvacuated = false;
    for (const AHWNodeNpc* Npc : Npcs)
    {
        if (!Npc) continue;
        bAnyEvacuated |= Npc->IsEvacuated();
        if (Npc->GetRole() == EHWNodeNpcRole::Technician && Npc->HasOrder())
        {
            TechOrder = FString::Printf(TEXT("\"%s\""), HWNodeDirectorLocal::FacilityKey(Npc->GetOrderFacility()));
        }
    }
    RunOptions = FString::Printf(TEXT("{\"policies\":[%s],\"barricades\":[%s],\"tech\":%s,\"evacuate\":%s,\"guildRole\":\"%s\",\"supply\":%d}"),
        *FString::Join(PolicyList, TEXT(",")), *FString::Join(BarricadeList, TEXT(",")), *TechOrder, bAnyEvacuated ? TEXT("true") : TEXT("false"),
        HWNodeDirectorLocal::GuildRoleName(GuildRole), Supply.Points);
}

void AHWNodeDirector::RunEvent(const TCHAR* Kind, const FString& Id, const TCHAR* To)
{
    if (InvasionClock < 0.f) return;
    RunEvents.Add(FString::Printf(TEXT("{\"t\":%.1f,\"kind\":\"%s\",\"id\":\"%s\",\"to\":\"%s\",\"text\":\"%s %s %s\"}"),
        InvasionClock, Kind, *Id, To, Kind, *Id, To));
}

void AHWNodeDirector::ReportEnemyDamage(float Amount, const AActor* Source)
{
    if (InvasionClock < 0.f || Amount <= 0.f || !Source) return;
    const APawn* Pawn = Cast<APawn>(Source);
    if (Cast<AHWNodeNpc>(Source)) DealtByGuard += Amount;
    else if (Cast<AHWNodeFacility>(Source)) DealtByTurret += Amount;
    else if (Pawn && Pawn->IsPlayerControlled()) DealtByPlayer += Amount;
}

void AHWNodeDirector::RecordFrame()
{
    const AHWNodeFacility* Gen = GetFacility(EHWNodeFacilityKind::Generator);
    const int32 Power = HWNodeRules::EffectivePower(Gen ? Gen->GetHealthFraction() : 0.f, ReserveLeft);
    TArray<FString> EnemyList;
    for (const AHWNodeEnemy* E : Enemies)
    {
        if (!E || E->IsDeadEnemy()) continue;
        const FVector At = E->GetActorLocation();
        EnemyList.Add(FString::Printf(TEXT("[%d,%d,%d,%.2f,\"%c\",0]"), FMath::RoundToInt(At.X), FMath::RoundToInt(At.Y),
            static_cast<int32>(E->GetRole()), E->GetHealthFraction(), HWNodeDirectorLocal::TargetKey(E->GetTargetKind())));
    }
    TArray<FString> FacilityList;
    for (const AHWNodeFacility* F : Facilities) FacilityList.Add(FString::Printf(TEXT("%.3f"), F ? F->GetHealthFraction() : 0.f));
    TArray<FString> NpcList;
    for (const AHWNodeNpc* Npc : Npcs)
    {
        if (!Npc) continue;
        const FVector At = Npc->GetActorLocation();
        NpcList.Add(FString::Printf(TEXT("[%d,%d,\"%c\"]"), FMath::RoundToInt(At.X), FMath::RoundToInt(At.Y), HWNodeDirectorLocal::NpcStateKey(Npc->GetState())[0]));
    }
    FString PlayerFrame = TEXT("null");
    if (const AHWAinCharacter* Player = GetPlayer())
    {
        const UHWCombatComponent* Combat = Player->GetCombat();
        const FVector At = Player->GetActorLocation();
        const float HealthFraction = Combat && Combat->GetMaxHealth() > 0.f ? Combat->GetHealth() / Combat->GetMaxHealth() : 0.f;
        PlayerFrame = FString::Printf(TEXT("[%d,%d,%.2f,%d]"), FMath::RoundToInt(At.X), FMath::RoundToInt(At.Y), HealthFraction, Combat && Combat->IsDead() ? 1 : 0);
    }
    RunFrames.Add(FString::Printf(TEXT("{\"t\":%.1f,\"power\":%d,\"e\":[%s],\"f\":[%s],\"n\":[%s],\"p\":%s}"), InvasionClock, Power,
        *FString::Join(EnemyList, TEXT(",")), *FString::Join(FacilityList, TEXT(",")), *FString::Join(NpcList, TEXT(",")), *PlayerFrame));
}

void AHWNodeDirector::WriteRunLog(const TCHAR* RunResult)
{
    if (InvasionClock < 0.f || !Config) return;
    TArray<FString> FacilityList;
    for (const AHWNodeFacility* F : Facilities)
    {
        if (!F) continue;
        const FVector Center = F->GetActorLocation(), Half = F->GetHalfExtent();
        FacilityList.Add(FString::Printf(TEXT("{\"id\":\"%s\",\"kind\":\"%s\",\"c\":[%.0f,%.0f,%.0f],\"h\":[%.0f,%.0f,%.0f]}"),
            *F->GetFacilityId().ToString(), HWNodeDirectorLocal::FacilityKey(F->GetKind()), Center.X, Center.Y, Center.Z, Half.X, Half.Y, Half.Z));
    }
    TArray<FString> NpcIds;
    for (const AHWNodeNpc* Npc : Npcs) if (Npc) NpcIds.Add(FString::Printf(TEXT("\"%s\""), *Npc->GetNpcId().ToString()));
    const FString Json = FString::Printf(
        TEXT("{\"format\":\"hwnode-run/1\",\"source\":\"ue\",\"node\":\"%s\",\"result\":\"%s\",\"t\":%.1f,\"opt\":%s,")
        TEXT("\"dealt\":{\"player\":%.0f,\"turret\":%.0f,\"guard\":%.0f},\"player\":{\"deaths\":%d},")
        TEXT("\"facilities\":[%s],\"npcIds\":[%s],\"events\":[%s],\"frames\":[%s]}"),
        *Config->NodeId.ToString(), RunResult, InvasionClock, *RunOptions, DealtByPlayer, DealtByTurret, DealtByGuard, PlayerDeaths,
        *FString::Join(FacilityList, TEXT(",")), *FString::Join(NpcIds, TEXT(",")), *FString::Join(RunEvents, TEXT(",")), *FString::Join(RunFrames, TEXT(",")));
    const FString Dir = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("HWNode"));
    FFileHelper::SaveStringToFile(Json, *FPaths::Combine(Dir, TEXT("last_run.json")));
    FFileHelper::SaveStringToFile(Json, *FPaths::Combine(Dir, TEXT("runs"), FString::Printf(TEXT("run_%s.json"), *FDateTime::Now().ToString(TEXT("%Y%m%d_%H%M%S")))));
    UE_LOG(LogTemp, Display, TEXT("[HWNode] run log written (%s, %.0f s, %d frames) - compare: node tools/ue/node-compare.mjs <file>"), RunResult, InvasionClock, RunFrames.Num());
    // the log covers what the simulator plays (up to held or fallen): stop here so the boss phase cannot overwrite it
    InvasionClock = -1.f;
}
