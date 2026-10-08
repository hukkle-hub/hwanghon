#include "Node/HWNodeDirector.h"

#include "Boss/HWBossCharacter.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Components/CapsuleComponent.h"
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

    // the simulator's line ids (node-combat-rules.cjs defenseLine)
    const TCHAR* LineKey(HWNodeRules::EDefenseLine L)
    {
        switch (L)
        {
        case HWNodeRules::EDefenseLine::CentralPlaza: return TEXT("central_plaza");
        case HWNodeRules::EDefenseLine::CommsFinal: return TEXT("comms_final");
        default: return TEXT("main_gate");
        }
    }

    // the simulator's e.tk[0]
    TCHAR TargetKey(HWNodeRules::ETargetKind K)
    {
        switch (K)
        {
        case HWNodeRules::ETargetKind::Player: return TEXT('p');
        case HWNodeRules::ETargetKind::Gate: return TEXT('g');
        case HWNodeRules::ETargetKind::Generator: return TEXT('e');   // gEnerator: the breaker's mark (v05 proof) - 'g' is the gate
        case HWNodeRules::ETargetKind::Comms: return TEXT('c');
        case HWNodeRules::ETargetKind::Ally: return TEXT('a');   // the simulator's e.tk[0]: 'ally'
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

    // a retake run: the node has been in the infected's hands for this many hours (docs/design/201 §2)
    const FString RetakeOption = UGameplayStatics::ParseOption(Options, TEXT("HWRetake"));
    // under two hours the node is not retakeable yet (OccupationTier Initial): start at two
    if (!RetakeOption.IsEmpty()) RetakeHours = FMath::Max(2.f, FCString::Atof(*RetakeOption));

    // Seoul's strategic network reaches the run (docs/design/202 §2.5): logistics, recon, manufacturing service 0..1
    const FString RegionOption = UGameplayStatics::ParseOption(Options, TEXT("HWRegion"));
    bRegionFromOption = !RegionOption.IsEmpty();
    if (bRegionFromOption)
    {
        TArray<FString> Parts;
        RegionOption.ParseIntoArray(Parts, TEXT(","), true);
        for (int32 K = 0; K < 3 && K < Parts.Num(); ++K) RegionServices[K] = FMath::Clamp(FCString::Atof(*Parts[K]), 0.f, 1.f);
    }
    RegionFx = HWNodeRules::RegionEffects(RegionServices[0], RegionServices[1], RegionServices[2]);   // online: RequestRegion replaces it

    const FString SupplyOption = UGameplayStatics::ParseOption(Options, TEXT("HWSupply"));
    SupplyRequested = SupplyOption.IsEmpty() ? Config->DefaultSupply : FMath::Clamp(FCString::Atoi(*SupplyOption), 0, 30);
    SupplyStart = FMath::Min(SupplyRequested, RegionFx.SupplyCap);   // the server caps allocations the same way (Hangang)

    // the "T5 / ROLE / TARGET" development labels (v06); ?HWLabels=0 for the phone frame-drop check
    bShowLabels = UGameplayStatics::ParseOption(Options, TEXT("HWLabels")) != TEXT("0");
    // a guild operation by default (x3 health and damage, every wave x5); ?HWGuildScale=0 to try the node alone
    bGuildScale = UGameplayStatics::ParseOption(Options, TEXT("HWGuildScale")) != TEXT("0");
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

AHWNodeNpc* AHWNodeDirector::PreferredNpc(const FVector& From, EHWNodeEnemyRole Hunter) const
{
    const HWNodeRules::EEnemyRole R = static_cast<HWNodeRules::EEnemyRole>(Hunter);
    AHWNodeNpc* Best = nullptr;
    float BestScore = -TNumericLimits<float>::Max();
    for (AHWNodeNpc* Npc : Npcs)
    {
        if (!Npc || !Npc->IsTargetable()) continue;
        const float Score = HWNodeRules::NpcPickScore(R, static_cast<HWNodeRules::ENpcRole>(Npc->GetRole()), FVector::Dist2D(From, Npc->GetActorLocation()));
        if (Score > BestScore) { BestScore = Score; Best = Npc; }
    }
    return Best;
}

bool AHWNodeDirector::ResonatorHold(const AHWNodeEnemy* Resonator, FVector& OutPoint) const
{
    if (!Resonator) return false;
    const FVector Here = Resonator->GetActorLocation();
    // the pack: the others (no resonators) within ResonatorPackRadiusCm - their centre; none that close: the nearest one
    FVector Sum = FVector::ZeroVector;
    int32 N = 0;
    const AHWNodeEnemy* Nearest = nullptr;
    float NearestD = TNumericLimits<float>::Max();
    // a runner already round the flank, north of a standing gate, is not the pack it stands behind - counted, it pulled
    // the hold point over the gate line and the resonator onto the gate (code review)
    const bool bGate = IsGateStanding();
    const float GateY = GateLineY();
    for (const AHWNodeEnemy* E : Enemies)
    {
        if (!E || E == Resonator || E->IsDeadEnemy() || E->GetRole() == EHWNodeEnemyRole::Resonator) continue;
        if (bGate && (Here.Y < GateY) != (E->GetActorLocation().Y < GateY)) continue;
        const float D = FVector::Dist2D(Here, E->GetActorLocation());
        if (D < NearestD) { NearestD = D; Nearest = E; }
        if (D <= HWNodeRules::ResonatorPackRadiusCm) { Sum += E->GetActorLocation(); ++N; }
    }
    if (N == 0 && !Nearest) return false;
    const FVector Pack = N > 0 ? Sum / N : Nearest->GetActorLocation();
    float X = 0.f, Y = 0.f;
    HWNodeRules::ResonatorHoldPoint(Here.X, Here.Y, Pack.X, Pack.Y, FVector::Dist2D(Here, Pack), X, Y);
    OutPoint = FVector(X, Y, Here.Z);
    return true;
}

void AHWNodeDirector::ReportTargetChosen(const AHWNodeEnemy* Enemy, HWNodeRules::ETargetKind Kind)
{
    if (!Enemy || InvasionClock < 0.f) return;
    Tier5.NoteTarget(static_cast<HWNodeRules::EEnemyRole>(Enemy->GetRole()), Kind);
}

void AHWNodeDirector::RefreshResonance()
{
    // server-authoritative (v04/v05): the director counts living resonators within the radius of every other invader.
    // Never more than one stack; the resonator itself and other resonators are not strengthened.
    TArray<const AHWNodeEnemy*> Resonators;
    for (const AHWNodeEnemy* E : Enemies)
    {
        if (E && !E->IsDeadEnemy() && E->GetRole() == EHWNodeEnemyRole::Resonator) Resonators.Add(E);
    }
    int32 Affected = 0;
    for (AHWNodeEnemy* E : Enemies)
    {
        if (!E || E->IsDeadEnemy()) continue;
        const HWNodeRules::EEnemyRole R = static_cast<HWNodeRules::EEnemyRole>(E->GetRole());
        int32 InRange = 0;
        for (const AHWNodeEnemy* Res : Resonators)
        {
            if (Res != E && HWNodeRules::InResonance(R, FVector::Dist2D(E->GetActorLocation(), Res->GetActorLocation()))) ++InRange;
        }
        const int32 Before = E->GetResonance();
        E->SetResonance(InRange);
        if (InvasionClock >= 0.f) Tier5.NoteResonance(Before, E->GetResonance(), Resonators.Num() < LivingResonators);
        if (E->GetResonance() > 0) ++Affected;
    }
    if ((Affected > 0) != (ResonatingNow > 0))
    {
        RunEvent(TEXT("aura"), TEXT("resonator"), Affected > 0 ? TEXT("on") : TEXT("off"));
        UE_LOG(LogTemp, Display, TEXT("[HWNode] resonance %s (%d invaders x%.2f move, x%.2f attack)"), Affected > 0 ? TEXT("ON") : TEXT("OFF"),
            Affected, HWNodeRules::ResonanceMoveScale, HWNodeRules::ResonanceAttackScale);
    }
    ResonatingNow = Affected;
    LivingResonators = Resonators.Num();
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

HWNodeRules::FTargetView AHWNodeDirector::BuildView(const FVector& From, bool bFlanked, const AHWNodeEnemy* Self) const
{
    HWNodeRules::FTargetView V;
    V.bFlanked = bFlanked;
    if (const AHWAinCharacter* Player = GetPlayer())
    {
        // a player across the standing gate from the inside is out of reach: chasing him pinned the infected on the
        // gate's inner face for good (the defenders fight outside now - doc 203 §9). From the outside, BlockedByGate.
        const bool bAcrossFromInside = IsGateStanding() && From.Y > GateLineY() && Player->GetActorLocation().Y < GateLineY();
        if (Player->GetCombat() && !Player->GetCombat()->IsDead() && !bAcrossFromInside) V.Player = FVector::Dist2D(From, Player->GetActorLocation());
    }
    const auto Distance = [this, &From](EHWNodeFacilityKind Kind)
    {
        const AHWNodeFacility* F = GetFacility(Kind);
        return F && !F->IsDestroyed() ? F->DistanceToSurface2D(From) : -1.f;
    };
    V.Gate = Distance(EHWNodeFacilityKind::Gate);
    V.Generator = Distance(EHWNodeFacilityKind::Generator);
    V.Comms = Distance(EHWNodeFacilityKind::Comms);
    const EHWNodeEnemyRole Hunter = Self ? Self->GetRole() : EHWNodeEnemyRole::Normal;
    if (const AHWNodeNpc* Npc = PreferredNpc(From, Hunter)) V.Npc = FVector::Dist2D(From, Npc->GetActorLocation());
    FVector Hold;
    if (Hunter == EHWNodeEnemyRole::Resonator && ResonatorHold(Self, Hold)) V.Ally = FVector::Dist2D(From, Hold);
    return V;
}

FVector AHWNodeDirector::TargetPoint(HWNodeRules::ETargetKind Kind, const FVector& From, const AHWNodeEnemy* Self) const
{
    switch (Kind)
    {
    case HWNodeRules::ETargetKind::Player:
        if (const AHWAinCharacter* Player = GetPlayer()) return Player->GetActorLocation();
        break;
    case HWNodeRules::ETargetKind::Npc:
        if (const AHWNodeNpc* Npc = PreferredNpc(From, Self ? Self->GetRole() : EHWNodeEnemyRole::Normal)) return Npc->GetActorLocation();
        break;
    case HWNodeRules::ETargetKind::Ally:
    {
        FVector Hold;
        if (ResonatorHold(Self, Hold)) return Hold;
        break;
    }
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

TArray<FVector> AHWNodeDirector::ExtensionFor(HWNodeRules::ETargetKind Kind, const FVector& From, const AHWNodeEnemy* Self) const
{
    if (!Config) return {};
    // the target's route (generator, comms, or the route to the NPC it is after) gives the end point; the route graph
    // gives the way there from wherever the enemy is (UHWNodeConfig::PathBetween, docs/design/201 §8)
    // An NPC is followed to where it is now, not to its home route's end - a technician sent to the gate had a runner
    // circling the generator building for good (tools/ue/node-sim.cjs).
    if (Kind == HWNodeRules::ETargetKind::Npc)
    {
        const AHWNodeNpc* Npc = PreferredNpc(From, Self ? Self->GetRole() : EHWNodeEnemyRole::Normal);
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
    static const TCHAR* RoleNames[] = { TEXT("walker"), TEXT("runner"), TEXT("breaker"), TEXT("stalker"), TEXT("ARMORED"), TEXT("RESONATOR") };
    static_assert(static_cast<int32>(UE_ARRAY_COUNT(RoleNames)) == static_cast<int32>(HWNodeRules::EEnemyRole::Count), "a name per role");
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
    // a server answer that came in during the last run takes effect now, before supplies and the countdown are set
    if (bNextRegion)
    {
        bNextRegion = false;
        RegionServices[0] = NextRegion[0];
        RegionServices[1] = NextRegion[1];
        RegionServices[2] = NextRegion[2];
        RegionFx = HWNodeRules::RegionEffects(RegionServices[0], RegionServices[1], RegionServices[2]);
        SupplyStart = FMath::Min(SupplyRequested, RegionFx.SupplyCap);
    }
    Supply.Points = SupplyStart;
    FreePotions = Policy.ExtraPotions;
    // recon (Bugak) lost = less warning; never under 5 s to build anything at all
    PrepLeft = FMath::Max(5.f, HWNodeRules::PrepSeconds(CurrentNpcEffects(), Policy) + RegionFx.PrepDeltaSeconds);
    RequestRegion();   // online: the server's Seoul network, before the run starts
    if (IsRetakeRun())
    {
        // occupied for RetakeHours: Retakeable once past two hours - prepare, then take it back
        Machine.State = HWNodeRules::ENodeState::Fallen;
        Machine.OccupiedHours = 0.f;
        Machine.TickOccupation(RetakeHours);
    }
    else
    {
        Machine.SetThreat(0.7f);   // the forecast saw it coming: Alert
    }
    SetState(Machine.State);
}

void AHWNodeDirector::StartInvasion()
{
    if (!Config || !Machine.StartInvasion()) return;
    Waves = HWNodeRules::FWaveRunner();
    Waves.CountScale = bGuildScale ? HWNodeRules::GuildOperationWaveScale : 1;
    PrepLeft = 0.f;
    RunDifficulty = bGuildScale ? HWNodeRules::GuildOperationHealthScale : 1.f;
    RunExtraElites = 0;
    BeginRunLog();
    SetState(Machine.State);
}

void AHWNodeDirector::SpawnWave(int32 WaveIndex)
{
    const HWNodeRules::FWaveSpec Spec = HWNodeRules::PrototypeAWave(WaveIndex);
    for (int32 Copy = 0; Copy < Waves.CountScale; ++Copy)   // a guild operation: the make-up comes this many times over
    {
        for (int32 RoleIndex = 0; RoleIndex < static_cast<int32>(HWNodeRules::EEnemyRole::Count); ++RoleIndex)
        {
            for (int32 N = 0; N < Spec.Count[RoleIndex]; ++N) SpawnEnemy(static_cast<EHWNodeEnemyRole>(RoleIndex), SpawnSerial++);
        }
    }
    // the package's evidence line (v04: «HUD/로그상 ThreatGrade=5»)
    FString Line;
    for (int32 RoleIndex = 0; RoleIndex < static_cast<int32>(HWNodeRules::EEnemyRole::Count); ++RoleIndex)
    {
        if (Spec.Count[RoleIndex] > 0) Line += FString::Printf(TEXT(" %s x%d"), ANSI_TO_TCHAR(HWNodeRules::ArchetypeId(static_cast<HWNodeRules::EEnemyRole>(RoleIndex))), Spec.Count[RoleIndex]);
    }
    UE_LOG(LogTemp, Display, TEXT("[HWNode] wave %d:%s x%d ThreatGrade=%d"), WaveIndex + 1, *Line, Waves.CountScale, HWNodeRules::NodeThreatGrade);
    // a retake's last wave carries the occupation tier's extra armoured elites (the wave runner counts them too)
    if (WaveIndex == Waves.WaveCount - 1 && RunExtraElites > 0)
    {
        Waves.Alive += RunExtraElites;
        for (int32 K = 0; K < RunExtraElites; ++K) SpawnEnemy(EHWNodeEnemyRole::ArmoredElite, SpawnSerial++);
    }
}

void AHWNodeDirector::SpawnEnemy(EHWNodeEnemyRole EnemyRole, int32 Serial)
{
    if (Config->SpawnPoints.Num() == 0) return;
    const TArray<FVector>& EnemyRoute = Config->Route(Config->RouteForRole(EnemyRole, Serial));
    // flank routes start on their own trail; the rest at the checkpoint spawns
    const bool bOwnStart = HWNodeRules::GoesRoundTheFlank(static_cast<HWNodeRules::EEnemyRole>(EnemyRole)) && EnemyRoute.Num() > 0;
    // a flank trail: 150 cm behind its start, scattered 60 - scattered 160 round the start itself, a runner landed beside
    // the trail and walked into the ramp's side (64 cm over the pad, above the 45 cm step) for good (node-sim.cjs, W5)
    const FVector Back = bOwnStart && EnemyRoute.Num() > 1 ? (EnemyRoute[0] - EnemyRoute[1]).GetSafeNormal2D() : FVector::ZeroVector;
    const FVector Base = bOwnStart ? EnemyRoute[0] + Back * 150.f : Config->SpawnPoints[Serial % Config->SpawnPoints.Num()];
    const float Scatter = bOwnStart ? 60.f : 160.f;
    const float Angle = Serial * 2.39996f;   // golden-angle scatter so a wave does not stack on one point
    const FVector At = Base + FVector(FMath::Cos(Angle) * Scatter, FMath::Sin(Angle) * Scatter, 110.f);

    FActorSpawnParameters Params;
    Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
    AHWNodeEnemy* Enemy = GetWorld()->SpawnActor<AHWNodeEnemy>(AHWNodeEnemy::StaticClass(), At, FRotator(0.f, 90.f, 0.f), Params);
    if (!Enemy)
    {
        Waves.EnemyDied(Waves.Now());   // never arrived: do not hold the wave
        return;
    }
    Enemy->Configure(this, EnemyRole, EnemyRoute, RunDifficulty);
    Enemy->SetLabelVisible(bShowLabels);
    Enemy->OnEnemyDied.AddUniqueDynamic(this, &AHWNodeDirector::HandleEnemyDied);
    Enemies.Add(Enemy);
    Tier5.NoteSpawn(static_cast<HWNodeRules::EEnemyRole>(EnemyRole), Enemy->GetThreatGrade());
    if (EnemyRole == EHWNodeEnemyRole::Resonator) ResonanceLeft = 0.f;   // its aura from the next tick
}

void AHWNodeDirector::HandleEnemyDied(AHWNodeEnemy* Enemy)
{
    Enemies.Remove(Enemy);
    if (Enemy && Enemy->GetRole() == EHWNodeEnemyRole::Resonator) ResonanceLeft = 0.f;   // its aura comes off now, not 0.4 s later
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
    else if (Machine.RetakeEnded(true))
    {
        Outcome = bExtracted ? TEXT("Namsan retaken - the Relay's core extracted") : TEXT("Namsan retaken - the Relay is dead");
        SetState(Machine.State);
        FinishRun(TEXT("retaken"));
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
        Net->OnNodeRegion.AddUniqueDynamic(this, &AHWNodeDirector::HandleNodeRegion);   // the reply's guild-order bonus (even with ?HWRegion=)
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
    const FString BonusNote = PendingOrderBonus > 0.f ? FString::Printf(TEXT(" - guild order here: contribution +%.0f%%"), PendingOrderBonus * 100.f) : FString();
    Notice = FString::Printf(TEXT("Node server: %s - steward %s%s"), *ServerNodeState, ServerSteward.IsEmpty() ? TEXT("none yet") : *ServerSteward, *BonusNote);
    PendingOrderBonus = 0.f;
    NoticeFor = 8.f;
}

void AHWNodeDirector::RequestRegion()
{
    if (bRegionFromOption || !Config) return;
    UGameInstance* GameInstance = GetGameInstance();
    UHWRaidNetworkSubsystem* Net = GameInstance ? GameInstance->GetSubsystem<UHWRaidNetworkSubsystem>() : nullptr;
    if (!Net || !Net->IsConnected()) return;
    Net->OnNodeRegion.AddUniqueDynamic(this, &AHWNodeDirector::HandleNodeRegion);
    Net->SendNodeInfo(Config->NodeId.ToString());
}

void AHWNodeDirector::ApplyRegion(float Logistics, float Recon, float Manufacturing)
{
    const float Next[3] = { FMath::Clamp(Logistics, 0.f, 1.f), FMath::Clamp(Recon, 0.f, 1.f), FMath::Clamp(Manufacturing, 0.f, 1.f) };
    // a run under way keeps the services it started with (the run log's "region" says so): the answer waits for the next preparation
    if (Machine.State == HWNodeRules::ENodeState::Invasion || Machine.State == HWNodeRules::ENodeState::Retaking)
    {
        for (int32 K = 0; K < 3; ++K) NextRegion[K] = Next[K];
        bNextRegion = true;
        return;
    }
    bNextRegion = false;   // a newer answer than anything queued mid-run
    const float OldPrepDelta = RegionFx.PrepDeltaSeconds;
    const int32 OldStart = SupplyStart;
    for (int32 K = 0; K < 3; ++K) RegionServices[K] = Next[K];
    RegionFx = HWNodeRules::RegionEffects(RegionServices[0], RegionServices[1], RegionServices[2]);
    SupplyStart = FMath::Min(SupplyRequested, RegionFx.SupplyCap);   // recomputed from the request: a cap that rises gives it back
    if (IsPreparing())
    {
        // move the countdown by the change only; never push a short countdown back up to the floor
        const float Shift = RegionFx.PrepDeltaSeconds - OldPrepDelta;
        if (!FMath::IsNearlyZero(Shift)) PrepLeft = FMath::Max(FMath::Min(PrepLeft, 5.f), PrepLeft + Shift);
        // this preparation's supplies follow the cap too (barricades already built stay paid for)
        Supply.Points = FMath::Max(0, Supply.Points + (SupplyStart - OldStart));
    }
}

void AHWNodeDirector::HandleNodeRegion(float Logistics, float Recon, float Manufacturing, float OrderBonus)
{
    if (bReportPending) PendingOrderBonus = OrderBonus;   // a report's answer: HandleNodeReply shows it next
    if (bRegionFromOption) return;
    const bool bChanged = !FMath::IsNearlyEqual(Logistics, RegionServices[0]) || !FMath::IsNearlyEqual(Recon, RegionServices[1])
        || !FMath::IsNearlyEqual(Manufacturing, RegionServices[2]);
    ApplyRegion(Logistics, Recon, Manufacturing);
    const bool bInRun = Machine.State == HWNodeRules::ENodeState::Invasion || Machine.State == HWNodeRules::ENodeState::Retaking;
    if (bChanged && !bReportPending && !bInRun)   // mid-run the answer is queued (ApplyRegion): no notice with the old numbers
    {
        Notice = FString::Printf(TEXT("Seoul network (server): logistics %.0f%% - recon %.0f%% - manufacturing %.0f%%"),
            RegionServices[0] * 100.f, RegionServices[1] * 100.f, RegionServices[2] * 100.f);
        NoticeFor = 6.f;
    }
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
    if (IsPreparing())
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
    if (IsPreparing() && !Config->ShelterPoint.IsZero()
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

    // 4) during the run, next to a turret at half or less: repair it with supplies (a captain's call, like a barricade).
    // A wrecked turret comes back up. Credited as supply, as the barricade is (docs/design/201 §4).
    // Someone who cannot repair it (no permission, no supplies) but is hurt falls through to the technician and a potion.
    const bool bInRun = Machine.State == HWNodeRules::ENodeState::Invasion || Machine.State == HWNodeRules::ENodeState::Retaking;
    const UHWCombatComponent* PlayerCombat = Player->GetCombat();
    const bool bHurt = PlayerCombat && !PlayerCombat->IsDead() && PlayerCombat->GetHealth() < PlayerCombat->GetMaxHealth() * HWNodeRules::PotionUseBelow;
    if (bInRun)
    {
        const bool bMayRepair = Can(HWNodeRules::EGuildPerm::InvestFacility) || Can(HWNodeRules::EGuildPerm::AllocateSupply);
        const bool bCanAfford = Supply.Points >= HWNodeRules::SupplyCost(HWNodeRules::ESupplyUse::TurretRepair);
        for (AHWNodeFacility* Turret : Facilities)
        {
            if (!Turret || Turret->GetKind() != EHWNodeFacilityKind::Turret || Turret->GetHealthFraction() > HWNodeRules::TurretRepairBelow
                || Turret->DistanceToSurface2D(Here) > HWNodeDirectorLocal::InteractReach) continue;
            if ((!bMayRepair || !bCanAfford) && bHurt) break;
            if (!bMayRepair)
            {
                Notice = TEXT("Only the craft or supply captain (or the leaders) can repair a turret");
            }
            else if (!Supply.Spend(HWNodeRules::ESupplyUse::TurretRepair))
            {
                Notice = FString::Printf(TEXT("Not enough supplies (a turret repair costs %d)"), HWNodeRules::SupplyCost(HWNodeRules::ESupplyUse::TurretRepair));
            }
            else
            {
                Turret->RepairBy(Turret->GetMaxHealth() * HWNodeRules::TurretRepairFraction * RegionFx.TurretRepairScale);   // manufacturing (Yongsan, Guro)
                Ledger.Raw[static_cast<int32>(HWNodeRules::EContribution::Supply)] += static_cast<float>(HWNodeRules::SupplyCost(HWNodeRules::ESupplyUse::TurretRepair));
                RunEvent(TEXT("supply"), Turret->GetFacilityId().ToString(), TEXT("turret_repair"));
                Notice = FString::Printf(TEXT("Turret repaired (%.0f%%) - supplies %d"), Turret->GetHealthFraction() * 100.f, Supply.Points);
            }
            NoticeFor = 4.f;
            return;
        }
    }

    // 5) the technician: cycle the repair order (gate -> generator -> comms -> stay home)
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

    // 6) during the run, anywhere else: a potion - the medical-stock policy's free ones first, then 1 supply each.
    // Not credited: it keeps one player up, it is not spent on the node.
    if (bInRun && bHurt)
    {
        if (UHWCombatComponent* Combat = Player->GetCombat())
        {
            const HWNodeRules::EPotionSource Source = HWNodeRules::PotionSource(FreePotions, Supply.Points);
            if (Source == HWNodeRules::EPotionSource::None)
            {
                Notice = FString::Printf(TEXT("No potions left (one costs %d supply)"), HWNodeRules::SupplyCost(HWNodeRules::ESupplyUse::Potions));
            }
            else
            {
                if (Source == HWNodeRules::EPotionSource::Free) --FreePotions;
                else Supply.Spend(HWNodeRules::ESupplyUse::Potions);
                Combat->Heal(Combat->GetMaxHealth() * HWNodeRules::PotionHealFraction);
                RunEvent(TEXT("supply"), TEXT("potion"), Source == HWNodeRules::EPotionSource::Free ? TEXT("free") : TEXT("supply"));
                Notice = FString::Printf(TEXT("Potion - free %d, supplies %d"), FreePotions, Supply.Points);
            }
            NoticeFor = 3.f;
            return;
        }
    }

    // 7) after a run: again (not while a retake run is still being prepared - the state is Retakeable then too)
    if ((Machine.State == HWNodeRules::ENodeState::Stable || Machine.State == HWNodeRules::ENodeState::Fallen
        || Machine.State == HWNodeRules::ENodeState::Retakeable) && !IsPreparing())
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
    // the gate stops the infected, not the defenders (doc 203 §9, GuildWorld v07 «MainGate battle»): the player's capsule
    // ignores it when moving, the enemies' capsules still hit it. Again if the pawn was replaced.
    if (GatePassFor.Get() != Player)
    {
        if (AHWNodeFacility* Gate = GetFacility(EHWNodeFacilityKind::Gate))
        {
            Player->MoveIgnoreActorAdd(Gate);   // = IgnoreActorWhenMoving on the root capsule; the movement sweeps honour it
            GatePassFor = Player;
        }
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
    case HWNodeRules::ENodeState::Retaking:
        TickRun(DeltaSeconds);
        break;

    case HWNodeRules::ENodeState::Recovering:
    {
        // the technician sets the pace (HWNodeRules::TechnicianRepairScale)
        const float Scale = CurrentNpcEffects().RepairScale;
        for (AHWNodeFacility* F : Facilities) if (F && F->GetHealthFraction() < 1.f) F->RepairBy(HWNodeDirectorLocal::RepairPerSecond * Scale * DeltaSeconds);
        if (Machine.AddRecovery(HWNodeDirectorLocal::RecoverPerSecond * Scale * DeltaSeconds))
        {
            Outcome = IsRetakeRun() ? TEXT("Namsan is stable again (G to run the retake again)") : TEXT("Namsan is stable again (G to run the defence again)");
            SetState(Machine.State);
        }
        break;
    }

    case HWNodeRules::ENodeState::Fallen:
    case HWNodeRules::ENodeState::Retakeable:
    {
        const HWNodeRules::ENodeState Before = Machine.State;
        Machine.TickOccupation(DeltaSeconds / 3600.f);
        if (Machine.State != Before) SetState(Machine.State);
        // a retake run's preparation (?HWRetake=): the countdown, then the push in
        if (IsPreparing())
        {
            PrepLeft -= DeltaSeconds;
            if (PrepLeft <= 0.f && Outcome.IsEmpty()) StartRetakeRun();
        }
        break;
    }
    }

    DrawHud();
}

bool AHWNodeDirector::IsPreparing() const
{
    if (PrepLeft <= 0.f) return false;
    return Machine.State == HWNodeRules::ENodeState::Alert
        || (IsRetakeRun() && Machine.State == HWNodeRules::ENodeState::Retakeable);
}

void AHWNodeDirector::StartRetakeRun()
{
    if (!Config || !Machine.StartRetake()) return;
    // the occupiers fortified while the node was theirs: tougher enemies, armoured elites added to the last wave
    const HWNodeRules::EOccupationTier Tier = HWNodeRules::OccupationTier(Machine.OccupiedHours);
    RunDifficulty = HWNodeRules::OccupationDifficulty(Tier) * (bGuildScale ? HWNodeRules::GuildOperationHealthScale : 1.f);
    RunExtraElites = HWNodeRules::OccupationExtraElites(Tier);
    Waves = HWNodeRules::FWaveRunner();
    Waves.CountScale = bGuildScale ? HWNodeRules::GuildOperationWaveScale : 1;
    PrepLeft = 0.f;
    BeginRunLog();
    SetState(Machine.State);
    Notice = FString::Printf(TEXT("RETAKE - occupied %.1f h: enemies x%.2f, +%d armoured elite(s) in the last wave"), Machine.OccupiedHours, RunDifficulty, RunExtraElites);
    NoticeFor = 6.f;
}

void AHWNodeDirector::TickRun(float DeltaSeconds)
{
    TickDefences(DeltaSeconds);
    ResonanceLeft -= DeltaSeconds;
    if (ResonanceLeft <= 0.f)
    {
        RefreshResonance();
        ResonanceLeft = HWNodeRules::ResonanceRefreshSeconds;
    }
    // v07: the battle moves back as the node is pushed (the enemies' choice follows from what stands - HWNodeRules::DefenseLine)
    {
        const AHWNodeFacility* Gen = GetFacility(EHWNodeFacilityKind::Generator);
        const HWNodeRules::EDefenseLine NowLine = HWNodeRules::DefenseLine(IsGateStanding(), Gen && !Gen->IsDestroyed());
        if (NowLine != LineNow)
        {
            LineNow = NowLine;
            const TCHAR* Key = HWNodeDirectorLocal::LineKey(LineNow);
            RunEvent(TEXT("line"), Key, TEXT("line"));
            const TCHAR* LineText = LineNow == HWNodeRules::EDefenseLine::CentralPlaza ? TEXT("DEFENCE LINE -> CENTRAL PLAZA: hold the plaza")
                : LineNow == HWNodeRules::EDefenseLine::CommsFinal ? TEXT("DEFENCE LINE -> COMMS: last stand at the comms centre") : TEXT("DEFENCE LINE -> MAIN GATE");
            // after a facility notice of the same moment (generator lost - reserve power...), not over it
            Notice = NoticeFor > 0.f && !Notice.IsEmpty() ? FString::Printf(TEXT("%s | %s"), *Notice, LineText) : FString(LineText);
            NoticeFor = 5.f;
            UE_LOG(LogTemp, Display, TEXT("[HWNode] defence line -> %s"), Key);
        }
    }
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
    // the comms centre destroyed or held: a defence falls, a retake fails (the node stays theirs).
    // The run log keeps the simulator's words (held / fallen) so node-compare reads both runs alike.
    const AHWNodeFacility* Comms = GetFacility(EHWNodeFacilityKind::Comms);
    const bool bCommsDestroyed = Comms && Comms->IsDestroyed();
    const bool bRetake = Machine.State == HWNodeRules::ENodeState::Retaking;
    if (bRetake ? Machine.TickRetake(DeltaSeconds, bCommsDestroyed, EnemyOnComms()) : Machine.TickInvasion(DeltaSeconds, bCommsDestroyed, EnemyOnComms()))
    {
        Outcome = bRetake ? TEXT("Retake failed - the infected keep Namsan (G to try again)") : TEXT("Namsan has fallen - the map goes dark (G to try again)");
        SetState(Machine.State);
        RunEvent(TEXT("state"), TEXT("node"), TEXT("fallen"));
        WriteRunLog(TEXT("fallen"));
        FinishRun(bRetake ? TEXT("retake_failed") : TEXT("fallen"));
    }
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
    if (IsPreparing())
    {
        Show(FString::Printf(TEXT("PREPARE %.0fs - supplies %d (barricade %d at a forest-trail slot: G)   technician orders: G next to them"),
            PrepLeft, Supply.Points, HWNodeRules::SupplyCost(HWNodeRules::ESupplyUse::Barricade)), FColor(255, 170, 90));
        if (!Config->ShelterPoint.IsZero()) Show(TEXT("Evacuate the NPCs under the central turrets: G at the shelter point (they leave their posts)"), FColor(120, 200, 255));
        if (RegionServices[0] < 1.f || RegionServices[1] < 1.f || RegionServices[2] < 1.f)
        {
            Show(FString::Printf(TEXT("Seoul network: logistics %.0f%% (supply cap %d) - recon %.0f%% (prep %+.1f s) - manufacturing %.0f%% (turret repair x%.2f)"),
                RegionServices[0] * 100.f, RegionFx.SupplyCap, RegionServices[1] * 100.f, RegionFx.PrepDeltaSeconds, RegionServices[2] * 100.f, RegionFx.TurretRepairScale), FColor(230, 190, 120));
        }
        Show(NpcFx.bWavePreview ? FString::Printf(TEXT("Scout report - first wave: %s"), *WavePreview(0)) : FString(TEXT("No scout report (scout lost, no scouting policy)")), FColor(170, 220, 255));
    }
    if (Machine.State == HWNodeRules::ENodeState::Invasion || Machine.State == HWNodeRules::ENodeState::Retaking)
    {
        const FString Next = NpcFx.bWavePreview && Waves.NextWave < Waves.WaveCount ? FString::Printf(TEXT("   next: %s"), *WavePreview(Waves.NextWave)) : FString();
        Show(bBossPhase
                ? FString::Printf(TEXT("THE RELAY  %.0f%%   core armour %.0f%%%s"),
                    Boss ? 100.f * Boss->GetHealth() / FMath::Max(1.f, Boss->GetMaxHealth()) : 0.f,
                    BossCore ? 100.f * BossCore->GetCoreArmorFraction() : 100.f,
                    BossCore && BossCore->CanFinish() ? TEXT("   FINISH: hit = kill / Execute (V) = extract") : TEXT(""))
                : FString::Printf(TEXT("Wave %d/%d%s   %.0fs   enemies %d   kills %d (you %d)%s"), FMath::Min(Waves.NextWave, Waves.WaveCount), Waves.WaveCount,
                    Waves.CountScale > 1 ? *FString::Printf(TEXT(" (GUILD OPERATION x%d, enemies x%.0f)"), Waves.CountScale, RunDifficulty) : TEXT(""), Waves.Now(), Waves.Alive, Kills, PlayerKills, *Next),
            FColor::White);
        const FString RetakeNote = Machine.State == HWNodeRules::ENodeState::Retaking
            ? FString::Printf(TEXT("   RETAKE x%.2f, +%d elite(s)"), RunDifficulty, RunExtraElites) : FString();
        Show(FString::Printf(TEXT("Supplies %d  (G at a damaged turret: repair %d / G elsewhere when hurt: potion, %d free then %d supply)%s"),
            Supply.Points, HWNodeRules::SupplyCost(HWNodeRules::ESupplyUse::TurretRepair), FreePotions, HWNodeRules::SupplyCost(HWNodeRules::ESupplyUse::Potions), *RetakeNote),
            FColor(200, 230, 160));
        if (!bBossPhase)
        {
            Show(FString::Printf(TEXT("Line: %s   ThreatGrade %d - all six roles%s"), HWNodeDirectorLocal::LineKey(LineNow), HWNodeRules::NodeThreatGrade,
                ResonatingNow > 0 ? *FString::Printf(TEXT("   RESONANCE: %d strengthened (move x%.2f, attack x%.2f) - kill the resonator"), ResonatingNow,
                    HWNodeRules::ResonanceMoveScale, HWNodeRules::ResonanceAttackScale) : TEXT("")),
                ResonatingNow > 0 ? FColor(255, 110, 190) : FColor(200, 200, 200));
        }
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
    Tier5 = HWNodeRules::FTier5Evidence();
    LineNow = HWNodeRules::EDefenseLine::MainGate;
    ResonanceLeft = 0.f;
    ResonatingNow = 0;
    LivingResonators = 0;
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
    // supply = points left when the run starts (barricades already paid); retake runs carry the tier's difficulty and extra elites;
    // region = Seoul's logistics, recon, manufacturing service (?HWRegion=)
    RunOptions = FString::Printf(TEXT("{\"policies\":[%s],\"barricades\":[%s],\"tech\":%s,\"evacuate\":%s,\"guildRole\":\"%s\",\"supply\":%d,\"retake\":%s,\"difficulty\":%.2f,\"extraElites\":%d,\"waveScale\":%d,\"region\":[%.3f,%.3f,%.3f]}"),
        *FString::Join(PolicyList, TEXT(",")), *FString::Join(BarricadeList, TEXT(",")), *TechOrder, bAnyEvacuated ? TEXT("true") : TEXT("false"),
        HWNodeDirectorLocal::GuildRoleName(GuildRole), Supply.Points, Machine.State == HWNodeRules::ENodeState::Retaking ? TEXT("true") : TEXT("false"), RunDifficulty, RunExtraElites, Waves.CountScale,
        RegionServices[0], RegionServices[1], RegionServices[2]);
}

void AHWNodeDirector::RunEvent(const TCHAR* Kind, const FString& Id, const TCHAR* To)
{
    if (InvasionClock < 0.f) return;
    RunEvents.Add(FString::Printf(TEXT("{\"t\":%.1f,\"kind\":\"%s\",\"id\":\"%s\",\"to\":\"%s\",\"text\":\"%s %s %s\"}"),
        InvasionClock, Kind, *Id, To, Kind, *Id, To));
}

void AHWNodeDirector::ReportEnemyDamage(float Amount, const AActor* Source, const FVector& EnemyAt)
{
    if (InvasionClock < 0.f || Amount <= 0.f || !Source) return;
    const APawn* Pawn = Cast<APawn>(Source);
    if (Pawn && Pawn->IsPlayerControlled()) Tier5.NoteDefenderHit(EnemyAt.Y, GateLineY(), IsGateStanding());   // v07: the battle at the gate
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
        EnemyList.Add(FString::Printf(TEXT("[%d,%d,%d,%.2f,\"%c\",0,%d]"), FMath::RoundToInt(At.X), FMath::RoundToInt(At.Y),
            static_cast<int32>(E->GetRole()), E->GetHealthFraction(), HWNodeDirectorLocal::TargetKey(E->GetTargetKind()), E->GetResonance()));
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

// The v06 PIE scenario's verdict in the Output Log: one PASS / FAIL line per check (N01_PIE_Scenario_v06.json)
void AHWNodeDirector::LogTier5Evidence(const TCHAR* RunResult) const
{
    for (int32 I = 0; I < HWNodeRules::Tier5CheckCount; ++I)
    {
        UE_LOG(LogTemp, Display, TEXT("[HWNode][N01_TIER5_PIE_V06] %s  %s"), Tier5.Check(I) ? TEXT("PASS") : TEXT("FAIL"), ANSI_TO_TCHAR(HWNodeRules::Tier5CheckName(I)));
    }
    UE_LOG(LogTemp, Display, TEXT("[HWNode][N01_TIER5_PIE_V06] %s - run %s (scenario finished without a crash)"), Tier5.Pass() ? TEXT("PASS") : TEXT("FAIL"), RunResult);
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
    TArray<FString> Checks;
    for (int32 I = 0; I < HWNodeRules::Tier5CheckCount; ++I)
    {
        Checks.Add(FString::Printf(TEXT("{\"name\":\"%s\",\"pass\":%s}"), ANSI_TO_TCHAR(HWNodeRules::Tier5CheckName(I)), Tier5.Check(I) ? TEXT("true") : TEXT("false")));
    }
    LogTier5Evidence(RunResult);
    const FString Json = FString::Printf(
        TEXT("{\"format\":\"hwnode-run/1\",\"source\":\"ue\",\"node\":\"%s\",\"result\":\"%s\",\"t\":%.1f,\"opt\":%s,")
        TEXT("\"threatGrade\":%d,\"tier5\":{\"pass\":%s,\"checks\":[%s]},")
        TEXT("\"dealt\":{\"player\":%.0f,\"turret\":%.0f,\"guard\":%.0f},\"player\":{\"deaths\":%d},")
        TEXT("\"facilities\":[%s],\"npcIds\":[%s],\"events\":[%s],\"frames\":[%s]}"),
        *Config->NodeId.ToString(), RunResult, InvasionClock, *RunOptions,
        HWNodeRules::NodeThreatGrade, Tier5.Pass() ? TEXT("true") : TEXT("false"), *FString::Join(Checks, TEXT(",")),
        DealtByPlayer, DealtByTurret, DealtByGuard, PlayerDeaths,
        *FString::Join(FacilityList, TEXT(",")), *FString::Join(NpcIds, TEXT(",")), *FString::Join(RunEvents, TEXT(",")), *FString::Join(RunFrames, TEXT(",")));
    const FString Dir = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("HWNode"));
    FFileHelper::SaveStringToFile(Json, *FPaths::Combine(Dir, TEXT("last_run.json")));
    FFileHelper::SaveStringToFile(Json, *FPaths::Combine(Dir, TEXT("runs"), FString::Printf(TEXT("run_%s.json"), *FDateTime::Now().ToString(TEXT("%Y%m%d_%H%M%S")))));
    UE_LOG(LogTemp, Display, TEXT("[HWNode] run log written (%s, %.0f s, %d frames) - compare: node tools/ue/node-compare.mjs <file>"), RunResult, InvasionClock, RunFrames.Num());
    // the log covers what the simulator plays (up to held or fallen): stop here so the boss phase cannot overwrite it
    InvasionClock = -1.f;
}
