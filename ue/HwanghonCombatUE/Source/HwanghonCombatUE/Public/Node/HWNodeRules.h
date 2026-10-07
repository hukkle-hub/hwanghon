#pragma once

// Outpost (node) rules - plain C++, no engine types (docs/design/200).
// The UE classes in Node/ call these, and the same header is compiled and tested on the host with g++
// (Scripts/tests/node_rules_test.cpp, run by the repo's npm test), so the rules are checked even where no
// engine is installed. Keep it free of UE and std headers: float/int/bool, enums and fixed arrays only.

namespace HWNodeRules
{

// ---------------------------------------------------------------- counter grading (docs/design/200 §3)

enum class ECounterGrade : unsigned char { None, Normal, Perfect };

// Elapsed = seconds since the counter started when the blow lands. UHWCombatTuningAsset::PerfectCounterWindow /
// CounterWindow (0.10 / 0.25) were declared but never read before this.
inline ECounterGrade GradeCounter(float Elapsed, float PerfectWindow, float CounterWindow)
{
    if (Elapsed < 0.f || Elapsed > CounterWindow) return ECounterGrade::None;
    return Elapsed <= PerfectWindow ? ECounterGrade::Perfect : ECounterGrade::Normal;
}

// ---------------------------------------------------------------- arm core (first human boss, docs/design/200 §6)

// CoreArmor 100: a normal counter takes 8, a perfect one 22. At 0 the forearm armour breaks and the core shows.
// Below 10 % health with the core showing, the fight ends either way the player chooses - keep hitting (kill) or
// hold the extraction - and never by a dice roll.
struct FCoreArmor
{
    float Armor = 100.f;
    float MaxArmor = 100.f;
    float NormalCounterDamage = 8.f;
    float PerfectCounterDamage = 22.f;
    bool bExposed = false;

    // Returns true on the counter that breaks the armour (exactly once).
    bool ApplyCounter(ECounterGrade Grade)
    {
        if (bExposed || Grade == ECounterGrade::None) return false;
        Armor -= Grade == ECounterGrade::Perfect ? PerfectCounterDamage : NormalCounterDamage;
        if (Armor > 0.f) return false;
        Armor = 0.f;
        bExposed = true;
        return true;
    }

    float Fraction() const { return MaxArmor > 0.f ? Armor / MaxArmor : 0.f; }
};

inline bool CanFinish(const FCoreArmor& Core, float HealthFraction)
{
    return Core.bExposed && HealthFraction <= 0.10f;
}

enum class EExtraction : unsigned char { Idle, Channeling, Extracted, Interrupted };

// The extraction is a channel the player must hold without being hit: skill, not chance.
struct FCoreExtraction
{
    float Duration = 1.5f;
    float Elapsed = 0.f;
    EExtraction State = EExtraction::Idle;

    bool Begin(const FCoreArmor& Core, float HealthFraction)
    {
        if (State == EExtraction::Channeling || State == EExtraction::Extracted || !CanFinish(Core, HealthFraction)) return false;
        State = EExtraction::Channeling;
        Elapsed = 0.f;
        return true;
    }

    // Returns true on the tick that completes it.
    bool Tick(float DeltaSeconds)
    {
        if (State != EExtraction::Channeling) return false;
        Elapsed += DeltaSeconds;
        if (Elapsed < Duration) return false;
        State = EExtraction::Extracted;
        return true;
    }

    void Interrupt()
    {
        if (State == EExtraction::Channeling) State = EExtraction::Interrupted;
    }

    float Progress() const { return Duration > 0.f ? (Elapsed < Duration ? Elapsed / Duration : 1.f) : 1.f; }
};

// ---------------------------------------------------------------- facilities (docs/design/200 §4)

enum class EFacility : unsigned char { Gate, Generator, Comms, Count };

struct FFacility
{
    EFacility Kind = EFacility::Gate;
    float MaxHealth = 1.f;
    float Health = 1.f;

    // Returns true on the blow that destroys it.
    bool ApplyDamage(float Amount)
    {
        if (Health <= 0.f || Amount <= 0.f) return false;
        Health -= Amount;
        if (Health > 0.f) return false;
        Health = 0.f;
        return true;
    }

    void Repair(float Amount)
    {
        Health += Amount;
        if (Health > MaxHealth) Health = MaxHealth;
    }

    float Fraction() const { return MaxHealth > 0.f ? Health / MaxHealth : 0.f; }
    bool IsDestroyed() const { return Health <= 0.f; }
};

// Generator power steps down with its health: 3 full, 2 lights dim / turrets slow, 1 emergency, 0 offline.
inline int GeneratorPower(float HealthFraction)
{
    if (HealthFraction <= 0.f) return 0;
    if (HealthFraction <= 0.33f) return 1;
    if (HealthFraction <= 0.66f) return 2;
    return 3;
}

// ---------------------------------------------------------------- node state machine (docs/design/200 §2)

enum class ENodeState : unsigned char
{
    Stable,      // 안정
    Uneasy,      // 불안
    Alert,       // 경계
    Invasion,    // 침공
    Recovering,  // 복구 (after a held defence or a retake)
    Fallen,      // 함락 - first two hours: cannot be retaken
    Retakeable,  // 탈환 가능 - the occupiers keep fortifying (OccupationTier)
    Retaking     // 탈환전
};

// Fortification by hours held (점령 강화).
enum class EOccupationTier : unsigned char { Initial, Basic, EliteUp, Fortress, InfectionCore };

inline EOccupationTier OccupationTier(float Hours)
{
    if (Hours < 2.f) return EOccupationTier::Initial;
    if (Hours < 6.f) return EOccupationTier::Basic;
    if (Hours < 12.f) return EOccupationTier::EliteUp;
    if (Hours < 24.f) return EOccupationTier::Fortress;
    return EOccupationTier::InfectionCore;
}

// The longer it is held, the harder and the richer the retake.
inline float OccupationDifficulty(EOccupationTier Tier)
{
    switch (Tier)
    {
    case EOccupationTier::Initial: return 1.f;
    case EOccupationTier::Basic: return 1.f;
    case EOccupationTier::EliteUp: return 1.3f;
    case EOccupationTier::Fortress: return 1.65f;
    case EOccupationTier::InfectionCore: return 2.1f;
    }
    return 1.f;
}

inline float OccupationReward(EOccupationTier Tier)
{
    switch (Tier)
    {
    case EOccupationTier::Initial: return 0.f;
    case EOccupationTier::Basic: return 1.f;
    case EOccupationTier::EliteUp: return 1.35f;
    case EOccupationTier::Fortress: return 1.8f;
    case EOccupationTier::InfectionCore: return 2.4f;
    }
    return 0.f;
}

inline int OccupationExtraElites(EOccupationTier Tier)
{
    switch (Tier)
    {
    case EOccupationTier::EliteUp: return 1;
    case EOccupationTier::Fortress: return 2;
    case EOccupationTier::InfectionCore: return 3;
    default: return 0;
    }
}

struct FNodeStateMachine
{
    ENodeState State = ENodeState::Stable;
    float Threat = 0.f;              // 0..1 from the region (field events, forecasts)
    float CommsHeldSeconds = 0.f;    // enemies standing on the comms centre during an invasion
    float CommsHoldToFall = 20.f;
    float OccupiedHours = 0.f;
    float RecoverProgress = 0.f;     // 0..1, raised by repairs (NPC technicians speed it)
    float UneasyAt = 0.3f;
    float AlertAt = 0.6f;

    // Threat only moves the calm states; an invasion or an occupation ignores it.
    void SetThreat(float NewThreat)
    {
        Threat = NewThreat < 0.f ? 0.f : NewThreat > 1.f ? 1.f : NewThreat;
        if (State != ENodeState::Stable && State != ENodeState::Uneasy && State != ENodeState::Alert) return;
        State = Threat >= AlertAt ? ENodeState::Alert : Threat >= UneasyAt ? ENodeState::Uneasy : ENodeState::Stable;
    }

    bool StartInvasion()
    {
        if (State != ENodeState::Stable && State != ENodeState::Uneasy && State != ENodeState::Alert) return false;
        State = ENodeState::Invasion;
        CommsHeldSeconds = 0.f;
        return true;
    }

    // Every wave cleared and the comms centre stands.
    bool DefenceHeld()
    {
        if (State != ENodeState::Invasion) return false;
        State = ENodeState::Recovering;
        RecoverProgress = 0.f;
        return true;
    }

    // Comms destroyed, or held by the enemy long enough: the node falls.
    bool TickInvasion(float DeltaSeconds, bool bCommsDestroyed, bool bEnemyOnComms)
    {
        if (State != ENodeState::Invasion) return false;
        CommsHeldSeconds = bEnemyOnComms ? CommsHeldSeconds + DeltaSeconds : 0.f;
        if (!bCommsDestroyed && CommsHeldSeconds < CommsHoldToFall) return false;
        State = ENodeState::Fallen;
        OccupiedHours = 0.f;
        return true;
    }

    // Occupation clock (hours). Fallen opens to Retakeable after two hours; fortification keeps rising.
    void TickOccupation(float DeltaHours)
    {
        if (State != ENodeState::Fallen && State != ENodeState::Retakeable && State != ENodeState::Retaking) return;
        OccupiedHours += DeltaHours;
        if (State == ENodeState::Fallen && OccupationTier(OccupiedHours) != EOccupationTier::Initial) State = ENodeState::Retakeable;
    }

    bool StartRetake()
    {
        if (State != ENodeState::Retakeable) return false;
        State = ENodeState::Retaking;
        return true;
    }

    bool RetakeEnded(bool bSucceeded)
    {
        if (State != ENodeState::Retaking) return false;
        State = bSucceeded ? ENodeState::Recovering : ENodeState::Retakeable;
        if (bSucceeded)
        {
            RecoverProgress = 0.f;
            OccupiedHours = 0.f;
        }
        return true;
    }

    bool AddRecovery(float Amount)
    {
        if (State != ENodeState::Recovering) return false;
        RecoverProgress += Amount;
        if (RecoverProgress < 1.f) return false;
        RecoverProgress = 1.f;
        State = ENodeState::Stable;
        SetThreat(Threat);
        return true;
    }

    EOccupationTier Tier() const { return OccupationTier(OccupiedHours); }
};

// What the information node gives the region (남산 = 정보 거점). A fallen node does not just pay less - it blinds.
struct FNodeServices
{
    float MapIntel = 1.f;        // fraction of the regional map that is not UNKNOWN
    float EventDetection = 1.f;  // field events spotted
    bool bRescueSignals = true;
    bool bInvasionForecast = true;
};

inline FNodeServices NodeServices(ENodeState State, float CommsFraction, int Power)
{
    FNodeServices S;
    if (State == ENodeState::Fallen || State == ENodeState::Retakeable || State == ENodeState::Retaking)
    {
        S.MapIntel = 0.35f;
        S.EventDetection = 0.15f;
        S.bRescueSignals = false;
        S.bInvasionForecast = false;
        return S;
    }
    // working comms scaled by power: emergency power keeps rescue signals, loses the forecast
    const float Comms = CommsFraction < 0.f ? 0.f : CommsFraction > 1.f ? 1.f : CommsFraction;
    const float PowerScale = Power >= 3 ? 1.f : Power == 2 ? 0.75f : Power == 1 ? 0.45f : 0.2f;
    S.MapIntel = 0.35f + 0.65f * Comms * PowerScale;
    S.EventDetection = 0.15f + 0.85f * Comms * PowerScale;
    S.bRescueSignals = Comms > 0.f && Power >= 1;
    S.bInvasionForecast = Comms > 0.5f && Power >= 2;
    if (State == ENodeState::Recovering) S.bInvasionForecast = false;
    return S;
}

// ---------------------------------------------------------------- enemies and waves (docs/design/200 §5)

enum class EEnemyRole : unsigned char
{
    Normal,        // 일반 감염체: player or the barrier
    Runner,        // 질주형: flanks, then the rear
    Breaker,       // 파괴자: facilities before players
    Stalker,       // 추적자: NPCs first
    ArmoredElite,  // 철갑 엘리트: breaks the gate; counters and part breaks matter
    Count
};

enum class ETargetKind : unsigned char { None, Player, Gate, Generator, Comms, Npc };

// Distances in cm; a negative distance = that target is gone (destroyed, dead or absent).
struct FTargetView
{
    float Player = -1.f;
    float Gate = -1.f;
    float Generator = -1.f;
    float Comms = -1.f;
    float Npc = -1.f;
    bool bFlanked = false;  // a Runner that reached its flank point
};

inline bool Has(float D) { return D >= 0.f; }

inline ETargetKind ChooseTarget(EEnemyRole Role, const FTargetView& V)
{
    const auto Facility = [&V](bool bGeneratorFirst) -> ETargetKind
    {
        if (bGeneratorFirst && Has(V.Generator)) return ETargetKind::Generator;
        if (Has(V.Gate)) return ETargetKind::Gate;
        if (Has(V.Generator)) return ETargetKind::Generator;
        if (Has(V.Comms)) return ETargetKind::Comms;
        return ETargetKind::None;
    };
    switch (Role)
    {
    case EEnemyRole::Normal:
        if (Has(V.Player) && V.Player <= 900.f) return ETargetKind::Player;
        if (Facility(false) != ETargetKind::None) return Facility(false);
        return Has(V.Player) ? ETargetKind::Player : ETargetKind::None;
    case EEnemyRole::Runner:
        // only fights a player who catches it; otherwise around the wall to the rear
        if (Has(V.Player) && V.Player <= 300.f) return ETargetKind::Player;
        if (!V.bFlanked) return ETargetKind::None;  // still running to the flank point
        if (Has(V.Npc)) return ETargetKind::Npc;
        if (Has(V.Generator)) return ETargetKind::Generator;
        if (Has(V.Comms)) return ETargetKind::Comms;
        return Has(V.Player) ? ETargetKind::Player : ETargetKind::None;
    case EEnemyRole::Breaker:
    {
        const ETargetKind F = Facility(true);
        if (F != ETargetKind::None) return F;
        return Has(V.Player) ? ETargetKind::Player : ETargetKind::None;
    }
    case EEnemyRole::Stalker:
        if (Has(V.Npc)) return ETargetKind::Npc;
        return Has(V.Player) ? ETargetKind::Player : ETargetKind::None;
    case EEnemyRole::ArmoredElite:
        // shoves through the gate; turns on a player only when blocked face to face
        if (Has(V.Player) && V.Player <= 250.f) return ETargetKind::Player;
        if (Has(V.Gate)) return ETargetKind::Gate;
        if (Has(V.Comms)) return ETargetKind::Comms;
        return Has(V.Player) ? ETargetKind::Player : ETargetKind::None;
    default:
        return ETargetKind::None;
    }
}

// The gate line is a wall (+Y = north, enemies come from the south): anyone south of it whose target is north of it
// meets the gate first - except a Runner that has already gone round the flank.
inline bool BlockedByGate(float EnemyY, float TargetY, float GateY, bool bGateStanding, EEnemyRole Role, bool bFlanked)
{
    if (!bGateStanding) return false;
    if (Role == EEnemyRole::Runner && bFlanked) return false;
    return EnemyY < GateY && TargetY > GateY;
}

struct FRoleStats
{
    float Health;
    float Damage;           // to players
    float FacilityDamage;   // per blow to a facility
    float Speed;            // cm/s
    float AttackCooldown;
    float ArmorScale;       // damage taken while the armour holds
};

inline FRoleStats RoleStats(EEnemyRole Role)
{
    switch (Role)
    {
    case EEnemyRole::Runner: return { 3200.f, 600.f, 180.f, 520.f, 1.1f, 1.f };
    case EEnemyRole::Breaker: return { 7000.f, 700.f, 900.f, 240.f, 1.8f, 1.f };
    case EEnemyRole::Stalker: return { 4200.f, 800.f, 200.f, 380.f, 1.3f, 1.f };
    case EEnemyRole::ArmoredElite: return { 26000.f, 1500.f, 1400.f, 230.f, 2.4f, 0.25f };
    default: return { 5500.f, 850.f, 300.f, 285.f, 1.35f, 1.f };
    }
}

// The elite's armour holds until a counter (or a part break) cracks it; then it takes full damage for a while.
struct FEliteArmor
{
    float CrackedFor = 0.f;
    float CrackSeconds = 6.f;
    float PerfectCrackSeconds = 9.f;

    void OnCountered(ECounterGrade Grade)
    {
        if (Grade == ECounterGrade::None) return;
        CrackedFor = Grade == ECounterGrade::Perfect ? PerfectCrackSeconds : CrackSeconds;
    }

    void Tick(float DeltaSeconds) { CrackedFor = CrackedFor > DeltaSeconds ? CrackedFor - DeltaSeconds : 0.f; }
    float DamageScale(float ArmorScale) const { return CrackedFor > 0.f ? 1.f : ArmorScale; }
};

struct FWaveSpec
{
    int Count[static_cast<int>(EEnemyRole::Count)];
    float StartAt;  // seconds from the invasion start; a cleared wave pulls the next one forward
};

// Prototype A (docs/design/200 §5): about four minutes at the south gate.
constexpr int PrototypeAWaveCount = 4;
inline FWaveSpec PrototypeAWave(int Index)
{
    //                         Normal Runner Breaker Stalker Elite
    switch (Index)
    {
    case 0: return { { 4, 2, 0, 0, 0 }, 0.f };
    case 1: return { { 5, 3, 0, 0, 0 }, 55.f };
    case 2: return { { 6, 0, 1, 0, 0 }, 115.f };
    case 3: return { { 4, 0, 0, 0, 1 }, 175.f };
    default: return { { 0, 0, 0, 0, 0 }, 0.f };
    }
}

inline int WaveSize(const FWaveSpec& W)
{
    int N = 0;
    for (int I = 0; I < static_cast<int>(EEnemyRole::Count); ++I) N += W.Count[I];
    return N;
}

// Drives the waves: start time or an early pull (the previous wave cleared, after a short breather).
struct FWaveRunner
{
    int NextWave = 0;
    int Alive = 0;
    float Clock = 0.f;
    float ClearedAt = -1.f;
    float Breather = 8.f;
    int WaveCount = PrototypeAWaveCount;

    // Returns the wave index to spawn now, or -1.
    int Tick(float DeltaSeconds)
    {
        Clock += DeltaSeconds;
        if (NextWave >= WaveCount) return -1;
        const FWaveSpec W = PrototypeAWave(NextWave);
        const bool bDue = Clock >= W.StartAt;
        const bool bPulled = NextWave > 0 && Alive == 0 && ClearedAt >= 0.f && Clock - ClearedAt >= Breather;
        if (!bDue && !bPulled) return -1;
        if (bPulled && !bDue) Clock = W.StartAt;  // later waves keep their spacing from the pulled one
        Alive += WaveSize(W);
        ClearedAt = -1.f;
        return NextWave++;
    }

    void EnemyDied(float Now)
    {
        if (Alive > 0) --Alive;
        if (Alive == 0) ClearedAt = Now;
    }

    float Now() const { return Clock; }
    bool AllWavesSpawned() const { return NextWave >= WaveCount; }
    bool Done() const { return AllWavesSpawned() && Alive == 0; }
};

// ---------------------------------------------------------------- NPCs (docs/design/200 §7)

enum class ENpcState : unsigned char { Normal, Injured, Missing, Rescued };

// A technician is part of the node, not a shop: repairs run at this speed.
inline float TechnicianRepairScale(ENpcState State)
{
    switch (State)
    {
    case ENpcState::Normal: return 1.f;
    case ENpcState::Injured: return 0.5f;
    case ENpcState::Missing: return 0.2f;   // basic repairs only; advanced ones need the technician back
    case ENpcState::Rescued: return 0.6f;   // back but still recovering
    }
    return 1.f;
}

inline bool AdvancedRepairAvailable(ENpcState State) { return State == ENpcState::Normal || State == ENpcState::Injured; }

// ---------------------------------------------------------------- contribution and stewardship (docs/design/200 §8)

enum class EContribution : unsigned char { Kill, Defense, Repair, NpcRescue, Boss, Supply, Command, Count };

constexpr int ContributionCount = static_cast<int>(EContribution::Count);

inline float ContributionWeight(EContribution C)
{
    switch (C)
    {
    case EContribution::Kill: return 1.f;
    case EContribution::Defense: return 1.2f;
    case EContribution::Repair: return 1.f;
    case EContribution::NpcRescue: return 1.2f;
    case EContribution::Boss: return 1.f;
    case EContribution::Supply: return 0.8f;
    case EContribution::Command: return 0.8f;
    default: return 0.f;
    }
}

struct FContribution
{
    float Raw[ContributionCount] = {};
};

// Each category is scored against the best in that category this run (0..100), then weighted.
// So the top boss damage is worth at most 100 - one category among seven - and never wins alone.
inline float ContributionScore(const FContribution& Mine, const FContribution* All, int Count)
{
    float Total = 0.f;
    for (int C = 0; C < ContributionCount; ++C)
    {
        float Best = 0.f;
        for (int I = 0; I < Count; ++I) if (All[I].Raw[C] > Best) Best = All[I].Raw[C];
        if (Best > 0.f) Total += ContributionWeight(static_cast<EContribution>(C)) * 100.f * Mine.Raw[C] / Best;
    }
    return Total;
}

// Stewardship (관리권) goes to the guild with the highest summed member score this period - never to a bid.
// GuildOf[i] = member i's guild (0..GuildCount-1, -1 = none). Ties go to the lower guild index (earlier registered).
inline int StewardGuild(const float* MemberScores, const int* GuildOf, int MemberCount, int GuildCount)
{
    int Best = -1;
    float BestSum = 0.f;
    for (int G = 0; G < GuildCount; ++G)
    {
        float Sum = 0.f;
        for (int I = 0; I < MemberCount; ++I) if (GuildOf[I] == G) Sum += MemberScores[I];
        if (Sum > BestSum) { BestSum = Sum; Best = G; }
    }
    return Best;
}

enum class EPolicy : unsigned char { GateReinforce, GeneratorReinforce, ArmNpcs, Scouting, MedicalStock, ReservePower, Count };

inline int PolicyCost(EPolicy P)
{
    switch (P)
    {
    case EPolicy::GateReinforce: return 4;
    case EPolicy::GeneratorReinforce: return 4;
    case EPolicy::ArmNpcs: return 3;
    case EPolicy::Scouting: return 3;
    case EPolicy::MedicalStock: return 3;
    case EPolicy::ReservePower: return 4;
    default: return 99;
    }
}

constexpr int PolicyBudget = 10;  // never enough for everything: the steward chooses

// Picks[] may not repeat and must fit the budget.
inline bool ValidPolicies(const EPolicy* Picks, int Count, int Budget = PolicyBudget)
{
    int Spent = 0;
    for (int I = 0; I < Count; ++I)
    {
        if (Picks[I] >= EPolicy::Count) return false;
        for (int J = 0; J < I; ++J) if (Picks[J] == Picks[I]) return false;
        Spent += PolicyCost(Picks[I]);
    }
    return Spent <= Budget;
}

}  // namespace HWNodeRules
