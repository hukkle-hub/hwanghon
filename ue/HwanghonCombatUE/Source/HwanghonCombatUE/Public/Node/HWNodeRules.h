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

enum class EFacility : unsigned char { Gate, Generator, Comms, Turret, Barricade, Count };

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

    // A retake fails the way a defence falls: the comms centre destroyed, or held by the enemy long enough -
    // the node stays occupied (Retakeable). On the server its clock keeps running; in PIE G starts the same retake again.
    bool TickRetake(float DeltaSeconds, bool bCommsDestroyed, bool bEnemyOnComms)
    {
        if (State != ENodeState::Retaking) return false;
        CommsHeldSeconds = bEnemyOnComms ? CommsHeldSeconds + DeltaSeconds : 0.f;
        if (!bCommsDestroyed && CommsHeldSeconds < CommsHoldToFall) return false;
        CommsHeldSeconds = 0.f;
        State = ENodeState::Retakeable;
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
        CommsHeldSeconds = 0.f;
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
    Resonator,     // 공진형: keeps behind the pack and strengthens it (GuildWorld v04, docs/design/203)
    Count
};

// Every N-01 invader is threat grade 5 (GuildWorld v04 N01_Tier5): six roles, one grade - the roles differ, not the grade.
constexpr int NodeThreatGrade = 5;

// The package's archetype ids (N01_Tier5_Monsters_v04.json) for the HUD and the run log.
inline const char* ArchetypeId(EEnemyRole Role)
{
    switch (Role)
    {
    case EEnemyRole::Runner: return "T5_RUNNER";
    case EEnemyRole::Breaker: return "T5_BREAKER";
    case EEnemyRole::Stalker: return "T5_STALKER";
    case EEnemyRole::ArmoredElite: return "T5_ARMORED";
    case EEnemyRole::Resonator: return "T5_RESONATOR";
    default: return "T5_WALKER";
    }
}

// Ally = the rear of the pack (the resonator's place); never attacked.
enum class ETargetKind : unsigned char { None, Player, Gate, Generator, Comms, Npc, Ally };

// Distances in cm; a negative distance = that target is gone (destroyed, dead or absent).
struct FTargetView
{
    float Player = -1.f;
    float Gate = -1.f;
    float Generator = -1.f;
    float Comms = -1.f;
    float Npc = -1.f;
    float Ally = -1.f;      // nearest other living invader that is not a resonator (the pack)
    bool bFlanked = false;  // a Runner that reached its flank point
};

inline bool Has(float D) { return D >= 0.f; }

// The resonator turns on a player this close; otherwise it holds this far behind the nearest of its pack.
constexpr float ResonatorSelfDefenceCm = 600.f;
constexpr float ResonatorTrailCm = 350.f;

// The defence line (GuildWorld v07 N01_DefenseFlow): the battle moves back as the node is pushed - the gate falls, the
// line is the central plaza; the generator falls too, it is the comms centre's last stand. Read off what still stands.
// (v07's own code only reaches CommsFinal when the comms are destroyed - the node is lost then, so here it is the
// generator that marks it.) The gate lets the defenders through and stops the infected (doc 203 §9).
enum class EDefenseLine : unsigned char { MainGate, CentralPlaza, CommsFinal };

inline EDefenseLine DefenseLine(bool bGateStanding, bool bGeneratorStanding)
{
    if (bGateStanding) return EDefenseLine::MainGate;
    return bGeneratorStanding ? EDefenseLine::CentralPlaza : EDefenseLine::CommsFinal;
}

inline ETargetKind ChooseTarget(EEnemyRole Role, const FTargetView& V)
{
    const EDefenseLine Line = DefenseLine(Has(V.Gate), Has(V.Generator));
    const auto Facility = [&V](bool bGeneratorFirst) -> ETargetKind
    {
        // the breaker (v05): generator, then comms, then the gate - a facility north of a standing gate still meets
        // the gate first (BlockedByGate)
        if (bGeneratorFirst && Has(V.Generator)) return ETargetKind::Generator;
        if (bGeneratorFirst && Has(V.Comms)) return ETargetKind::Comms;
        if (Has(V.Gate)) return ETargetKind::Gate;
        if (Has(V.Generator)) return ETargetKind::Generator;
        if (Has(V.Comms)) return ETargetKind::Comms;
        return ETargetKind::None;
    };
    switch (Role)
    {
    case EEnemyRole::Normal:
        // v07: at the plaza the walkers follow the defenders' line (any distance); at the gate and the last stand they
        // take a player who is close and otherwise the facility
        if (Line == EDefenseLine::CentralPlaza && Has(V.Player)) return ETargetKind::Player;
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
        // v04 «out of sight», v07 «hunts NPCs whatever the line»: round the flank like a runner, then the NPC
        if (!V.bFlanked) return ETargetKind::None;
        if (Has(V.Npc)) return ETargetKind::Npc;
        return Has(V.Player) ? ETargetKind::Player : ETargetKind::None;
    case EEnemyRole::ArmoredElite:
        // shoves through the gate; turns on a player only when blocked face to face. v07: through the gate it pushes the
        // defenders' formation at the plaza, and the comms centre at the last stand
        if (Line == EDefenseLine::CentralPlaza && Has(V.Player)) return ETargetKind::Player;
        if (Has(V.Player) && V.Player <= 250.f) return ETargetKind::Player;
        if (Has(V.Gate)) return ETargetKind::Gate;
        if (Has(V.Comms)) return ETargetKind::Comms;
        return Has(V.Player) ? ETargetKind::Player : ETargetKind::None;
    case EEnemyRole::Resonator:
        // behind the pack while there is one; strikes only a player who reaches it; alone it is just another walker
        if (Has(V.Player) && V.Player <= ResonatorSelfDefenceCm) return ETargetKind::Player;
        if (Has(V.Ally)) return ETargetKind::Ally;
        return ChooseTarget(EEnemyRole::Normal, V);
    default:
        return ETargetKind::None;
    }
}

// The gate line is a wall (+Y = north, enemies come from the south): anyone south of it whose target is north of it
// meets the gate first - except a Runner or a Stalker that has already gone round the flank.
inline bool GoesRoundTheFlank(EEnemyRole Role) { return Role == EEnemyRole::Runner || Role == EEnemyRole::Stalker; }

inline bool BlockedByGate(float EnemyY, float TargetY, float GateY, bool bGateStanding, EEnemyRole Role, bool bFlanked)
{
    if (!bGateStanding) return false;
    if (GoesRoundTheFlank(Role) && bFlanked) return false;
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
    // the package's ratios to the walker (hp 0.98, move 0.92/0.9, attack 0.75) on our walker's numbers
    case EEnemyRole::Resonator: return { 5400.f, 640.f, 220.f, 290.f, 1.5f, 1.f };
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

// The resonator's aura (N01_Tier5_Monsters_v04.json): every other invader within the radius of a living resonator moves
// and hits harder. Computed by the authority (the director / the simulator), never by the enemy itself; two resonators
// do not stack - the cap is one.
constexpr float ResonanceRadiusCm = 1800.f;
constexpr float ResonanceMoveScale = 1.1f;
constexpr float ResonanceAttackScale = 1.12f;
constexpr int ResonanceStackCap = 1;

inline int ResonanceStacks(int ResonatorsInRange)
{
    return ResonatorsInRange <= 0 ? 0 : (ResonatorsInRange < ResonanceStackCap ? ResonatorsInRange : ResonanceStackCap);
}

inline bool InResonance(EEnemyRole Role, float DistanceToResonatorCm)
{
    return Role != EEnemyRole::Resonator && DistanceToResonatorCm >= 0.f && DistanceToResonatorCm <= ResonanceRadiusCm;
}

inline float ResonanceMove(int Stacks) { return Stacks > 0 ? ResonanceMoveScale : 1.f; }
inline float ResonanceAttack(int Stacks) { return Stacks > 0 ? ResonanceAttackScale : 1.f; }
constexpr float ResonanceRefreshSeconds = 0.4f;   // a dead resonator's aura is gone within this

// Where the resonator holds: ResonatorTrailCm behind the pack's centre, on its own side (2D, cm). Distance = the 2D
// distance from the pack's centre to the resonator (the caller has a vector maths library; this header has none).
inline void ResonatorHoldPoint(float SelfX, float SelfY, float PackX, float PackY, float Distance, float& OutX, float& OutY)
{
    const float Dx = SelfX - PackX, Dy = SelfY - PackY;
    if (Distance < 1.f) { OutX = PackX; OutY = PackY - ResonatorTrailCm; return; }   // on top of it: behind = south (the spawn side)
    const float K = ResonatorTrailCm / Distance;
    OutX = PackX + Dx * K;
    OutY = PackY + Dy * K;
}
constexpr float ResonatorPackRadiusCm = 3000.f;   // the pack = the others within this of the resonator (else the nearest one)

// How often each role looks for a new target (N01_Tier5_Monsters_v05.json target_reevaluate_sec).
inline float ThinkSeconds(EEnemyRole Role)
{
    switch (Role)
    {
    case EEnemyRole::Runner: return 0.35f;
    case EEnemyRole::Breaker: return 0.6f;
    case EEnemyRole::Stalker: return 0.4f;
    case EEnemyRole::ArmoredElite: return 0.65f;
    case EEnemyRole::Resonator: return 0.8f;
    default: return 0.7f;
    }
}

// The armoured's three blows (v05), in turn. The counter judgement itself is untouched (GradeCounter / the combat
// component); only what a counter does to this blow is decided here.
enum class EArmoredAttack : unsigned char
{
    ShieldBash,     // holds the line: any counter cracks the armour (the normal crack)
    HeavyCharge,    // breaks formation: a perfect counter cracks it for the perfect time and staggers it 2.25x longer
    OverheadCrush   // cannot be countered: dodge it
};

constexpr int ArmoredCycle = 4;
inline EArmoredAttack ArmoredAttackAt(int Blow)
{
    switch (((Blow % ArmoredCycle) + ArmoredCycle) % ArmoredCycle)
    {
    case 1: return EArmoredAttack::HeavyCharge;
    case 3: return EArmoredAttack::OverheadCrush;
    default: return EArmoredAttack::ShieldBash;
    }
}

inline bool CounterAllowed(EArmoredAttack A) { return A != EArmoredAttack::OverheadCrush; }

// The crack a counter of this blow gives (FEliteArmor::OnCountered): only the charge pays the perfect counter.
inline ECounterGrade ArmoredCrackGrade(EArmoredAttack A, ECounterGrade Grade)
{
    if (!CounterAllowed(A) || Grade == ECounterGrade::None) return ECounterGrade::None;
    if (A == EArmoredAttack::HeavyCharge) return Grade;
    return ECounterGrade::Normal;
}

constexpr float ArmoredPerfectPostureScale = 2.25f;
inline float ArmoredStaggerSeconds(EArmoredAttack A, ECounterGrade Grade)
{
    const float Base = 1.4f;   // the elite's countered stagger (AHWNodeEnemy::Strike)
    return A == EArmoredAttack::HeavyCharge && Grade == ECounterGrade::Perfect ? Base * ArmoredPerfectPostureScale : Base;
}

inline float ArmoredWindupSeconds(EArmoredAttack A)
{
    switch (A)
    {
    case EArmoredAttack::HeavyCharge: return 1.0f;
    case EArmoredAttack::OverheadCrush: return 1.2f;   // long and readable: time to get out
    default: return 0.8f;
    }
}

// The PIE proof (GuildWorld v06 N01_PIE_Scenario_v06.json pass_conditions), kept by the authority during a run and
// printed as PASS / FAIL lines at its end - the same checks in the simulator (tools/ue/node-sim.cjs).
constexpr int Tier5CheckCount = 8;
struct FTier5Evidence
{
    bool Spawned[static_cast<int>(EEnemyRole::Count)] = {};
    int NotGrade5 = 0;
    bool BreakerOnGenerator = false;
    bool StalkerOnNpc = false;
    bool ArmoredOnGate = false;
    bool AuraApplied = false;    // a living grade-5 invader went from no resonance to resonance
    bool AuraReverted = false;   // ...and back, still alive, because a resonator died (not just walked out of the radius)
    bool MainGateFight = false;  // v07: a defender hit an invader outside the standing gate (the battle is at the gate)

    void NoteSpawn(EEnemyRole Role, int Grade)
    {
        Spawned[static_cast<int>(Role)] = true;
        if (Grade != NodeThreatGrade) ++NotGrade5;
    }
    void NoteTarget(EEnemyRole Role, ETargetKind Kind)
    {
        if (Role == EEnemyRole::Breaker && Kind == ETargetKind::Generator) BreakerOnGenerator = true;
        if (Role == EEnemyRole::Stalker && Kind == ETargetKind::Npc) StalkerOnNpc = true;
        if (Role == EEnemyRole::ArmoredElite && Kind == ETargetKind::Gate) ArmoredOnGate = true;
    }
    // bResonatorGone: this refresh has fewer living resonators than the last one
    void NoteResonance(int Before, int After, bool bResonatorGone)
    {
        if (Before == 0 && After > 0) AuraApplied = true;
        if (Before > 0 && After == 0 && bResonatorGone) AuraReverted = true;
    }
    void NoteDefenderHit(float EnemyY, float GateY, bool bGateStanding)
    {
        if (bGateStanding && EnemyY < GateY) MainGateFight = true;
    }
    bool AllSpawned() const
    {
        for (int I = 0; I < static_cast<int>(EEnemyRole::Count); ++I) if (!Spawned[I]) return false;
        return true;
    }
    // 0 all six roles spawn, 1 all grade 5, 2 breaker -> generator, 3 stalker -> NPC, 4 armoured -> gate,
    // 5 the aura raises a neighbour, 6 the aura comes off again, 7 the defenders fight at the standing gate (v07)
    bool Check(int Index) const
    {
        switch (Index)
        {
        case 0: return AllSpawned();
        case 1: return AllSpawned() && NotGrade5 == 0;
        case 2: return BreakerOnGenerator;
        case 3: return StalkerOnNpc;
        case 4: return ArmoredOnGate;
        case 5: return AuraApplied;
        case 6: return AuraReverted;
        case 7: return MainGateFight;
        default: return false;
        }
    }
    bool Pass() const
    {
        for (int I = 0; I < Tier5CheckCount; ++I) if (!Check(I)) return false;
        return true;
    }
};

inline const char* Tier5CheckName(int Index)
{
    switch (Index)
    {
    case 0: return "all six roles spawn";
    case 1: return "all spawned monsters report ThreatGrade 5";
    case 2: return "Breaker selects Generator at least once";
    case 3: return "Stalker selects NPC at least once";
    case 4: return "Armored selects Gate at least once";
    case 5: return "Resonator aura changes a nearby T5 monster multiplier";
    case 6: return "the multiplier returns once the Resonator is gone";
    case 7: return "defenders fight at the MainGate before it falls";
    default: return "";
    }
}

struct FWaveSpec
{
    int Count[static_cast<int>(EEnemyRole::Count)];
    float StartAt;  // seconds from the invasion start; a cleared wave pulls the next one forward
};

// Prototype A at the south gate, GuildWorld v04 (N01_Tier5_Waves_v04.json): five waves, all six grade-5 roles.
// The package times count from 20 s before the first contact; ours count from the invasion start (W1 = 0 s).
constexpr int PrototypeAWaveCount = 5;
inline FWaveSpec PrototypeAWave(int Index)
{
    //                         Walker Runner Breaker Stalker Armored Resonator
    switch (Index)
    {
    case 0: return { { 4, 2, 0, 0, 0, 0 }, 0.f };     // W1 contact
    case 1: return { { 4, 3, 0, 1, 0, 0 }, 45.f };    // W2 flank
    case 2: return { { 4, 0, 2, 0, 0, 0 }, 95.f };    // W3 facility
    case 3: return { { 5, 0, 0, 0, 1, 1 }, 150.f };   // W4 pressure
    case 4: return { { 4, 2, 1, 1, 1, 0 }, 200.f };   // W5 breach
    default: return { { 0, 0, 0, 0, 0, 0 }, 0.f };
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

    void EnemyDied(float NowSeconds)
    {
        if (Alive > 0) --Alive;
        if (Alive == 0) ClearedAt = NowSeconds;
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

// Command counts for at most 10% of the non-command score; 4+ categories with a real (> 0) contribution earn x1.1.
// Only the cap and the bonus came from the GPT package (GuildRules_v02) - the weights stay ours (docs/design/202 §6).
constexpr float CommandCap = 0.10f;
constexpr int DiversityMin = 4;
constexpr float DiversityBonus = 1.1f;
inline float CapAndBonus(const float (&Terms)[ContributionCount], const FContribution& Raw)
{
    float NonCommand = 0.f;
    int Kinds = 0;
    for (int C = 0; C < ContributionCount; ++C)
    {
        if (C != static_cast<int>(EContribution::Command)) NonCommand += Terms[C];
        if (Raw.Raw[C] > 0.f) ++Kinds;
    }
    const float Command = Terms[static_cast<int>(EContribution::Command)];
    const float Capped = Command < NonCommand * CommandCap ? Command : NonCommand * CommandCap;
    return (NonCommand + Capped) * (Kinds >= DiversityMin ? DiversityBonus : 1.f);
}

// Each category is scored against the best in that category this run (0..100), then weighted, then CapAndBonus.
// So the top boss damage is worth at most 100 - one category among seven - and never wins alone.
inline float ContributionScore(const FContribution& Mine, const FContribution* All, int Count)
{
    float Terms[ContributionCount] = {};
    for (int C = 0; C < ContributionCount; ++C)
    {
        float Best = 0.f;
        for (int I = 0; I < Count; ++I) if (All[I].Raw[C] > Best) Best = All[I].Raw[C];
        if (Best > 0.f) Terms[C] = ContributionWeight(static_cast<EContribution>(C)) * 100.f * Mine.Raw[C] / Best;
    }
    return CapAndBonus(Terms, Mine);
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

// ---------------------------------------------------------------- strategy: policies, prep, turrets, supplies (docs/design/201 §2)

// What the steward guild's policy picks do in play. Never all at once (PolicyBudget): the guild chooses.
struct FPolicyEffects
{
    float GateHealthScale = 1.f;       // GateReinforce
    float GeneratorHealthScale = 1.f;  // GeneratorReinforce (turrets too)
    bool bNpcsArmed = false;           // ArmNpcs: the guard shoots, NPCs take more punishment
    float PrepBonusSeconds = 0.f;      // Scouting
    bool bWavePreview = false;         // Scouting: the next wave is known before it comes
    float MedicalHealScale = 1.f;      // MedicalStock
    int ExtraPotions = 0;              // MedicalStock
    float ReservePowerSeconds = 0.f;   // ReservePower: a dead generator keeps emergency power this long
};

inline FPolicyEffects PolicyEffects(const EPolicy* Picks, int Count)
{
    FPolicyEffects E;
    for (int I = 0; I < Count; ++I)
    {
        switch (Picks[I])
        {
        case EPolicy::GateReinforce: E.GateHealthScale = 1.5f; break;
        case EPolicy::GeneratorReinforce: E.GeneratorHealthScale = 1.5f; break;
        case EPolicy::ArmNpcs: E.bNpcsArmed = true; break;
        case EPolicy::Scouting: E.PrepBonusSeconds = 20.f; E.bWavePreview = true; break;
        case EPolicy::MedicalStock: E.MedicalHealScale = 1.6f; E.ExtraPotions = 3; break;
        case EPolicy::ReservePower: E.ReservePowerSeconds = 90.f; break;
        default: break;
        }
    }
    return E;
}

// Power the base actually has: a destroyed generator still gives emergency power (1) while the reserve lasts.
inline int EffectivePower(float GeneratorFraction, float ReserveLeftSeconds)
{
    const int P = GeneratorPower(GeneratorFraction);
    return P == 0 && ReserveLeftSeconds > 0.f ? 1 : P;
}

// Automatic turrets run on the generator: full, dimmed, emergency, dark.
constexpr float TurretBaseDps = 320.f;
constexpr float TurretRangeCm = 1500.f;
inline float TurretDps(int Power)
{
    return Power >= 3 ? TurretBaseDps : Power == 2 ? TurretBaseDps * 0.6f : Power == 1 ? TurretBaseDps * 0.25f : 0.f;
}

// Supplies (보급): the supply captain's pool for the next defence.
enum class ESupplyUse : unsigned char { Barricade, TurretRepair, Potions, Count };
inline int SupplyCost(ESupplyUse Use)
{
    switch (Use)
    {
    case ESupplyUse::Barricade: return 3;
    case ESupplyUse::TurretRepair: return 2;
    case ESupplyUse::Potions: return 1;
    default: return 99;
    }
}

struct FSupplyPool
{
    int Points = 0;
    bool Spend(ESupplyUse Use)
    {
        const int Cost = SupplyCost(Use);
        if (Points < Cost) return false;
        Points -= Cost;
        return true;
    }
};

// What the supplies buy during a run (docs/design/201 §4): a turret repair puts half its health back (a wrecked turret
// comes back up), a potion heals 40% of the player's health. The medical-stock policy's potions go first, free.
constexpr float TurretRepairFraction = 0.5f;
constexpr float TurretRepairBelow = 0.5f;    // only a turret at or under half is worth 2 supplies (a 99% turret is not)
constexpr float PotionHealFraction = 0.4f;
constexpr float PotionUseBelow = 0.9f;       // a stray G at full-ish health does not burn a potion
enum class EPotionSource : unsigned char { None, Free, Supply };
inline EPotionSource PotionSource(int FreeLeft, int SupplyPoints)
{
    if (FreeLeft > 0) return EPotionSource::Free;
    if (SupplyPoints >= SupplyCost(ESupplyUse::Potions)) return EPotionSource::Supply;
    return EPotionSource::None;
}

// ---------------------------------------------------------------- the region reaches the run (docs/design/202 §2.5)
// Seoul's strategic network (server/region-rules.cjs) is service, not HP: what the other nodes still provide changes a
// Namsan run. s = that role's regional service, 0..1 (online 1, degraded 0.55, occupied 0, recovering 0.75..1).
//   logistics     (Hangang N04)          -> supply cap per period   12 x (0.5 + 0.5 s)   6..12
//   recon         (Bugak N06)            -> preparation seconds     -10 x (1 - s)        0..-10
//   manufacturing (Yongsan N03, Guro N08) -> turret repair amount   x (0.5 + 0.5 s)
// First guesses, to be tuned against PIE like everything else (the director's call).
constexpr int SupplyCapBase = 12;
struct FRegionEffects
{
    int SupplyCap = SupplyCapBase;
    float PrepDeltaSeconds = 0.f;
    float TurretRepairScale = 1.f;
};
inline FRegionEffects RegionEffects(float Logistics, float Recon, float Manufacturing)
{
    const auto Unit = [](float V) { return V < 0.f ? 0.f : V > 1.f ? 1.f : V; };
    FRegionEffects E;
    E.SupplyCap = static_cast<int>(static_cast<float>(SupplyCapBase) * (0.5f + 0.5f * Unit(Logistics)) + 0.5f);
    E.PrepDeltaSeconds = -10.f * (1.f - Unit(Recon));
    E.TurretRepairScale = 0.5f + 0.5f * Unit(Manufacturing);
    return E;
}

// ---------------------------------------------------------------- NPC roles (docs/design/201 §3)

// Each NPC carries one node function; losing them loses the function, not just a vendor.
enum class ENpcRole : unsigned char { Technician, Medic, Scout, Operator, Guard, Count };
constexpr int NpcRoleCount = static_cast<int>(ENpcRole::Count);

inline float NpcMaxHealth(ENpcRole Role, bool bArmed)
{
    const float Base = Role == ENpcRole::Guard ? 6000.f : 3000.f;
    return bArmed ? Base * 1.5f : Base;
}

// Which NPC an invader goes for (v05 N01_AI_TargetScenarios): the stalker weighs the technician (1.5) and the medic
// (1.35) over the rest (1.0), losing 0.08 per 10 m; everybody else takes the nearest. Higher score wins.
inline float NpcImportance(ENpcRole Role)
{
    switch (Role)
    {
    case ENpcRole::Technician: return 1.5f;
    case ENpcRole::Medic: return 1.35f;
    default: return 1.f;
    }
}
constexpr float NpcDistancePenaltyPer1000Cm = 0.08f;
inline float NpcPickScore(EEnemyRole Hunter, ENpcRole Npc, float DistanceCm)
{
    if (Hunter == EEnemyRole::Stalker) return NpcImportance(Npc) - DistanceCm / 1000.f * NpcDistancePenaltyPer1000Cm;
    return -DistanceCm;
}

// Normal -> Injured -> Missing (dragged to the holding spot) ; Missing -> Rescued (by a player) -> Normal after recovery.
struct FNpcLife
{
    ENpcState State = ENpcState::Normal;
    float Health = 3000.f;
    float MaxHealth = 3000.f;
    float RecoverLeft = 0.f;

    bool IsTargetable() const { return State == ENpcState::Normal || State == ENpcState::Injured || State == ENpcState::Rescued; }

    // Returns true when the state changed.
    bool ApplyDamage(float Amount)
    {
        if (!IsTargetable() || Amount <= 0.f) return false;
        Health -= Amount;
        if (Health > 0.f) return false;
        if (State == ENpcState::Missing) return false;
        State = State == ENpcState::Normal ? ENpcState::Injured : ENpcState::Missing;
        Health = State == ENpcState::Injured ? MaxHealth * 0.5f : 0.f;
        return true;
    }

    bool Rescue()
    {
        if (State != ENpcState::Missing) return false;
        State = ENpcState::Rescued;
        Health = MaxHealth * 0.5f;
        RecoverLeft = 60.f;
        return true;
    }

    // A rescued NPC is back to normal after a minute (between waves the medic can speed it - later).
    bool Tick(float DeltaSeconds)
    {
        if (State != ENpcState::Rescued) return false;
        RecoverLeft -= DeltaSeconds;
        if (RecoverLeft > 0.f) return false;
        State = ENpcState::Normal;
        Health = MaxHealth;
        return true;
    }
};

// Function of a role in a state: 1 full, 0.5 half, 0 lost.
inline float NpcFunction(ENpcState State)
{
    switch (State)
    {
    case ENpcState::Normal: return 1.f;
    case ENpcState::Injured: return 0.5f;
    case ENpcState::Rescued: return 0.6f;
    case ENpcState::Missing: return 0.f;
    }
    return 0.f;
}

struct FNpcEffects
{
    float RepairScale = 1.f;          // technician
    float MedicalHealPerSecond = 0.f; // fraction of max health at the medical bay (medic)
    float PrepBonusSeconds = 0.f;     // scout
    bool bWavePreview = false;        // scout
    bool bRescueSignals = true;       // operator (on top of comms + power)
    float GuardDps = 0.f;             // guard, armed by policy
};

inline FNpcEffects NpcEffects(const ENpcState* States, const FPolicyEffects& Policy)
{
    FNpcEffects E;
    const auto F = [States](ENpcRole R) { return NpcFunction(States[static_cast<int>(R)]); };
    E.RepairScale = TechnicianRepairScale(States[static_cast<int>(ENpcRole::Technician)]);
    E.MedicalHealPerSecond = 0.08f * F(ENpcRole::Medic) * Policy.MedicalHealScale;
    E.PrepBonusSeconds = 10.f * F(ENpcRole::Scout);
    E.bWavePreview = F(ENpcRole::Scout) > 0.f || Policy.bWavePreview;
    E.bRescueSignals = F(ENpcRole::Operator) > 0.f;
    E.GuardDps = Policy.bNpcsArmed ? 150.f * (F(ENpcRole::Guard) >= 1.f ? 1.f : 0.f) : 0.f;
    return E;
}

// Preparation before an invasion: base 20 s, the scout and the scouting policy buy more.
inline float PrepSeconds(const FNpcEffects& Npc, const FPolicyEffects& Policy)
{
    return 20.f + Npc.PrepBonusSeconds + Policy.PrepBonusSeconds;
}

// A technician sent to a facility repairs it while standing there (an order, not a menu).
inline float TechnicianRepairPerSecond(ENpcState State) { return 400.f * TechnicianRepairScale(State); }

// ---------------------------------------------------------------- guild roles and command (docs/design/201 §4)

enum class EGuildRole : unsigned char { Member, CraftCaptain, SupplyCaptain, CombatCaptain, Vice, Leader };
enum class EGuildPerm : unsigned char { Ping, Rally, OrderNpc, AllocateSupply, InvestFacility, SelectPolicy, AssignRoles };

// Roles are real powers (hand-off §14): the combat captain pings and rallies, the supply captain allocates, the craft
// captain invests in facilities and orders the technician; policy belongs to the leader and the vice.
inline bool HasPermission(EGuildRole Role, EGuildPerm Perm)
{
    switch (Role)
    {
    case EGuildRole::Leader: return true;
    case EGuildRole::Vice: return Perm != EGuildPerm::AssignRoles;
    case EGuildRole::CombatCaptain: return Perm == EGuildPerm::Ping || Perm == EGuildPerm::Rally || Perm == EGuildPerm::OrderNpc;
    case EGuildRole::SupplyCaptain: return Perm == EGuildPerm::AllocateSupply;
    case EGuildRole::CraftCaptain: return Perm == EGuildPerm::InvestFacility || Perm == EGuildPerm::OrderNpc;
    default: return false;
    }
}

// A ping credits its author with command contribution for kills near it soon after.
constexpr float PingLifeSeconds = 15.f;
constexpr float PingRadiusCm = 800.f;
inline bool PingCredits(float PingAgeSeconds, float DistanceCm)
{
    return PingAgeSeconds >= 0.f && PingAgeSeconds <= PingLifeSeconds && DistanceCm <= PingRadiusCm;
}

// Kill contribution by role: the elite and the breaker matter more than a straggler.
inline float KillWeight(EEnemyRole Role)
{
    switch (Role)
    {
    case EEnemyRole::Runner: return 1.2f;
    case EEnemyRole::Breaker: return 2.f;
    case EEnemyRole::Stalker: return 1.5f;
    case EEnemyRole::ArmoredElite: return 5.f;
    case EEnemyRole::Resonator: return 2.f;   // the first to take down (the package): like the breaker
    default: return 1.f;
    }
}

// Defence contribution: a kill close to a standing facility (or NPC) is a kill that defended something.
constexpr float DefenseRadiusCm = 1500.f;
inline float DefenseCredit(EEnemyRole Role, float DistanceToDefendedCm)
{
    return DistanceToDefendedCm >= 0.f && DistanceToDefendedCm <= DefenseRadiusCm ? KillWeight(Role) : 0.f;
}

// ---------------------------------------------------------------- guild war: objectives, not a deathmatch (docs/design/201 §5)

enum class EWarObjective : unsigned char { Generator, CommsPoint, CoreCarry, CommanderEscort, FacilityDestroy, Count };

inline bool ValidWarTeams(int TeamA, int TeamB) { return TeamA == TeamB && (TeamA == 8 || TeamA == 12); }

struct FWarMatch
{
    int Score[2] = { 0, 0 };
    float HoldCarry[2] = { 0.f, 0.f };  // fractional hold points
    float Clock = 0.f;
    float TimeLimit = 900.f;            // 15 minutes
    int ScoreToWin = 1000;
    int KillsCounted[2] = { 0, 0 };     // kept for stats - kills never score

    // Points held (generator, comms point) score one point per second each.
    void TickHolds(float DeltaSeconds, int HeldByA, int HeldByB)
    {
        Clock += DeltaSeconds;
        HoldCarry[0] += DeltaSeconds * static_cast<float>(HeldByA);
        HoldCarry[1] += DeltaSeconds * static_cast<float>(HeldByB);
        for (int T = 0; T < 2; ++T)
        {
            const int Whole = static_cast<int>(HoldCarry[T]);
            Score[T] += Whole;
            HoldCarry[T] -= static_cast<float>(Whole);
        }
    }

    void Objective(int Team, EWarObjective O)
    {
        if (Team < 0 || Team > 1) return;
        switch (O)
        {
        case EWarObjective::CoreCarry: Score[Team] += 150; break;
        case EWarObjective::CommanderEscort: Score[Team] += 200; break;
        case EWarObjective::FacilityDestroy: Score[Team] += 100; break;
        default: break;
        }
    }

    void Kill(int Team) { if (Team == 0 || Team == 1) ++KillsCounted[Team]; }

    // -1 still going, 0/1 the winner, 2 a draw at the bell.
    int Result() const
    {
        if (Score[0] >= ScoreToWin || Score[1] >= ScoreToWin) return Score[0] >= Score[1] ? (Score[0] == Score[1] ? 2 : 0) : 1;
        if (Clock < TimeLimit) return -1;
        return Score[0] == Score[1] ? 2 : Score[0] > Score[1] ? 0 : 1;
    }
};

}  // namespace HWNodeRules
