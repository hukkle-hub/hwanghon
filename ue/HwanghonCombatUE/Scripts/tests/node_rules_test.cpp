// Host test for Source/HwanghonCombatUE/Public/Node/HWNodeRules.h - no engine needed (docs/design/200).
// Built and run by tests/ue-node-rules.test.cjs:  g++ -std=c++17 -Wall -Wextra -Wshadow -Wconversion -Werror
#include "../../Source/HwanghonCombatUE/Public/Node/HWNodeRules.h"
#include <cstdio>
#include <cmath>

using namespace HWNodeRules;

static int Failures = 0;
#define CHECK(Cond) do { if (!(Cond)) { std::printf("FAIL %s:%d  %s\n", __FILE__, __LINE__, #Cond); ++Failures; } } while (0)
static bool Near(float A, float B) { return std::fabs(A - B) < 1e-3f; }

static void CounterGrades()
{
    CHECK(GradeCounter(0.05f, 0.10f, 0.25f) == ECounterGrade::Perfect);
    CHECK(GradeCounter(0.10f, 0.10f, 0.25f) == ECounterGrade::Perfect);
    CHECK(GradeCounter(0.11f, 0.10f, 0.25f) == ECounterGrade::Normal);
    CHECK(GradeCounter(0.25f, 0.10f, 0.25f) == ECounterGrade::Normal);
    CHECK(GradeCounter(0.26f, 0.10f, 0.25f) == ECounterGrade::None);
    CHECK(GradeCounter(-0.01f, 0.10f, 0.25f) == ECounterGrade::None);
}

static void CoreArmor()
{
    // 100 armour: five perfect counters (22 each) break it, twelve normal ones (8 each) do too - and never earlier
    FCoreArmor P;
    for (int I = 0; I < 4; ++I) CHECK(!P.ApplyCounter(ECounterGrade::Perfect));
    CHECK(Near(P.Armor, 12.f));
    CHECK(P.ApplyCounter(ECounterGrade::Perfect));
    CHECK(P.bExposed && Near(P.Armor, 0.f));
    CHECK(!P.ApplyCounter(ECounterGrade::Perfect));  // breaks exactly once

    FCoreArmor N;
    int Hits = 0;
    while (!N.ApplyCounter(ECounterGrade::Normal)) ++Hits;
    CHECK(Hits + 1 == 13);  // 12 x 8 = 96 < 100, the 13th breaks it
    CHECK(!N.ApplyCounter(ECounterGrade::None));

    // finish only with the core out and health at or below 10 %
    FCoreArmor C;
    CHECK(!CanFinish(C, 0.05f));
    C.bExposed = true;
    CHECK(!CanFinish(C, 0.11f));
    CHECK(CanFinish(C, 0.10f));

    // extraction: held for its full duration completes; a hit interrupts; nothing is random
    FCoreExtraction X;
    CHECK(!X.Begin(C, 0.5f));
    CHECK(X.Begin(C, 0.08f));
    CHECK(!X.Tick(1.0f));
    CHECK(X.Tick(0.6f));
    CHECK(X.State == EExtraction::Extracted);
    FCoreExtraction Y;
    CHECK(Y.Begin(C, 0.08f));
    Y.Tick(1.0f);
    Y.Interrupt();
    CHECK(Y.State == EExtraction::Interrupted);
    CHECK(!Y.Tick(1.0f));
    CHECK(Y.Begin(C, 0.08f));  // may try again
}

static void Facilities()
{
    FFacility G{ EFacility::Generator, 100.f, 100.f };
    CHECK(GeneratorPower(G.Fraction()) == 3);
    CHECK(!G.ApplyDamage(40.f));
    CHECK(GeneratorPower(G.Fraction()) == 2);
    CHECK(!G.ApplyDamage(30.f));
    CHECK(GeneratorPower(G.Fraction()) == 1);
    CHECK(G.ApplyDamage(50.f));
    CHECK(G.IsDestroyed() && GeneratorPower(G.Fraction()) == 0);
    CHECK(!G.ApplyDamage(10.f));  // destroyed once
    G.Repair(500.f);
    CHECK(Near(G.Health, 100.f));
}

static void StateMachine()
{
    FNodeStateMachine M;
    M.SetThreat(0.2f); CHECK(M.State == ENodeState::Stable);
    M.SetThreat(0.4f); CHECK(M.State == ENodeState::Uneasy);
    M.SetThreat(0.7f); CHECK(M.State == ENodeState::Alert);
    M.SetThreat(0.1f); CHECK(M.State == ENodeState::Stable);
    CHECK(M.StartInvasion());
    M.SetThreat(0.0f); CHECK(M.State == ENodeState::Invasion);  // threat does not end an invasion

    // held defence -> recovering -> stable
    FNodeStateMachine D = M;
    CHECK(D.DefenceHeld() && D.State == ENodeState::Recovering);
    CHECK(!D.AddRecovery(0.6f));
    CHECK(D.AddRecovery(0.6f) && D.State == ENodeState::Stable);

    // comms held 20 s by the enemy -> fallen; stepping off resets the clock
    FNodeStateMachine F = M;
    CHECK(!F.TickInvasion(15.f, false, true));
    CHECK(!F.TickInvasion(1.f, false, false));
    CHECK(Near(F.CommsHeldSeconds, 0.f));
    CHECK(!F.TickInvasion(19.f, false, true));
    CHECK(F.TickInvasion(1.f, false, true) && F.State == ENodeState::Fallen);

    // destroyed comms -> fallen at once
    FNodeStateMachine K = M;
    CHECK(K.TickInvasion(0.1f, true, false) && K.State == ENodeState::Fallen);

    // no retake for two hours; fortification rises with time
    CHECK(!K.StartRetake());
    K.TickOccupation(1.9f); CHECK(K.State == ENodeState::Fallen && K.Tier() == EOccupationTier::Initial);
    K.TickOccupation(0.2f); CHECK(K.State == ENodeState::Retakeable && K.Tier() == EOccupationTier::Basic);
    K.TickOccupation(5.f); CHECK(K.Tier() == EOccupationTier::EliteUp);
    K.TickOccupation(6.f); CHECK(K.Tier() == EOccupationTier::Fortress);
    K.TickOccupation(12.f); CHECK(K.Tier() == EOccupationTier::InfectionCore);
    CHECK(OccupationDifficulty(K.Tier()) > OccupationDifficulty(EOccupationTier::Fortress));
    CHECK(OccupationReward(K.Tier()) > OccupationReward(EOccupationTier::Fortress));
    CHECK(OccupationExtraElites(EOccupationTier::Basic) == 0 && OccupationExtraElites(EOccupationTier::InfectionCore) == 3);

    // failed retake keeps the occupation (and its clock); a success recovers and resets it
    CHECK(K.StartRetake());
    K.TickOccupation(1.f);
    CHECK(K.RetakeEnded(false) && K.State == ENodeState::Retakeable && K.OccupiedHours > 25.f);
    CHECK(K.StartRetake() && K.RetakeEnded(true) && K.State == ENodeState::Recovering && Near(K.OccupiedHours, 0.f));
    CHECK(!K.StartInvasion());  // not while recovering
}

static void Services()
{
    const FNodeServices Ok = NodeServices(ENodeState::Stable, 1.f, 3);
    CHECK(Near(Ok.MapIntel, 1.f) && Ok.bRescueSignals && Ok.bInvasionForecast);
    const FNodeServices Fallen = NodeServices(ENodeState::Fallen, 1.f, 3);
    CHECK(Fallen.MapIntel < 0.5f && !Fallen.bRescueSignals && !Fallen.bInvasionForecast && Fallen.EventDetection < 0.2f);
    const FNodeServices Emergency = NodeServices(ENodeState::Invasion, 1.f, 1);
    CHECK(Emergency.bRescueSignals && !Emergency.bInvasionForecast && Emergency.MapIntel < Ok.MapIntel);
    const FNodeServices Dark = NodeServices(ENodeState::Stable, 1.f, 0);
    CHECK(!Dark.bRescueSignals);
}

static void Roles()
{
    FTargetView V;
    V.Player = 1200.f; V.Gate = 400.f; V.Generator = 3000.f; V.Comms = 6000.f; V.Npc = 5000.f;
    CHECK(ChooseTarget(EEnemyRole::Normal, V) == ETargetKind::Gate);
    V.Player = 500.f;
    CHECK(ChooseTarget(EEnemyRole::Normal, V) == ETargetKind::Player);
    CHECK(ChooseTarget(EEnemyRole::Breaker, V) == ETargetKind::Generator);  // facilities before the player beside it
    CHECK(ChooseTarget(EEnemyRole::Stalker, V) == ETargetKind::None);  // round the flank first (v04/v07)
    CHECK(ChooseTarget(EEnemyRole::ArmoredElite, V) == ETargetKind::Gate);
    CHECK(ChooseTarget(EEnemyRole::Runner, V) == ETargetKind::None);  // still flanking
    V.bFlanked = true;
    CHECK(ChooseTarget(EEnemyRole::Runner, V) == ETargetKind::Npc);
    CHECK(ChooseTarget(EEnemyRole::Stalker, V) == ETargetKind::Npc);
    CHECK(!BlockedByGate(-12000.f, 2100.f, -9800.f, true, EEnemyRole::Stalker, true));   // flanked: past the gate
    V.Player = 200.f;
    CHECK(ChooseTarget(EEnemyRole::Runner, V) == ETargetKind::Player);
    CHECK(ChooseTarget(EEnemyRole::ArmoredElite, V) == ETargetKind::Player);  // blocked face to face
    V.Player = 600.f; V.Gate = -1.f;
    // v07 defence lines: gate down = the central plaza, the walkers and the armoured push the defenders (any distance);
    // the generator down too = the comms centre's last stand
    CHECK(DefenseLine(true, true) == EDefenseLine::MainGate && DefenseLine(false, true) == EDefenseLine::CentralPlaza && DefenseLine(false, false) == EDefenseLine::CommsFinal);
    V.Player = 4000.f;
    CHECK(ChooseTarget(EEnemyRole::ArmoredElite, V) == ETargetKind::Player);
    CHECK(ChooseTarget(EEnemyRole::Normal, V) == ETargetKind::Player);
    V.Generator = -1.f;
    CHECK(ChooseTarget(EEnemyRole::ArmoredElite, V) == ETargetKind::Comms);  // the last stand: the comms centre
    CHECK(ChooseTarget(EEnemyRole::Normal, V) == ETargetKind::Comms);
    V.Player = 600.f; V.Generator = 3000.f;
    V.Npc = -1.f;
    CHECK(ChooseTarget(EEnemyRole::Stalker, V) == ETargetKind::Player);

    // the resonator (v04/v05): behind the pack, a player only when close, a walker when alone
    FTargetView Q;
    Q.Player = 2000.f; Q.Gate = 300.f; Q.Ally = 900.f;
    CHECK(ChooseTarget(EEnemyRole::Resonator, Q) == ETargetKind::Ally);
    Q.Player = 500.f;
    CHECK(ChooseTarget(EEnemyRole::Resonator, Q) == ETargetKind::Player);
    Q.Player = 2000.f; Q.Ally = -1.f;
    CHECK(ChooseTarget(EEnemyRole::Resonator, Q) == ETargetKind::Gate);
    // the aura: one stack at most, never on a resonator, gone outside 18 m
    CHECK(ResonanceStacks(0) == 0 && ResonanceStacks(1) == 1 && ResonanceStacks(3) == 1);
    CHECK(InResonance(EEnemyRole::Normal, 1800.f) && !InResonance(EEnemyRole::Normal, 1801.f) && !InResonance(EEnemyRole::Resonator, 10.f));
    CHECK(Near(ResonanceMove(1), 1.1f) && Near(ResonanceAttack(2), 1.12f) && Near(ResonanceMove(0), 1.f));
    // the breaker (v05): generator, comms, gate
    FTargetView B;
    B.Player = 200.f; B.Gate = 300.f; B.Comms = 5000.f;
    CHECK(ChooseTarget(EEnemyRole::Breaker, B) == ETargetKind::Comms);
    // the stalker weighs the technician over a closer NPC (v05 scenario: 26 m vs 12 m)
    CHECK(NpcPickScore(EEnemyRole::Stalker, ENpcRole::Technician, 2600.f) > NpcPickScore(EEnemyRole::Stalker, ENpcRole::Scout, 1200.f));
    CHECK(NpcPickScore(EEnemyRole::Runner, ENpcRole::Technician, 2600.f) < NpcPickScore(EEnemyRole::Runner, ENpcRole::Scout, 1200.f));
    // the armoured's crush cannot be countered; only the charge pays a perfect counter
    CHECK(!CounterAllowed(ArmoredAttackAt(3)) && CounterAllowed(ArmoredAttackAt(0)) && ArmoredAttackAt(1) == EArmoredAttack::HeavyCharge);
    CHECK(ArmoredCrackGrade(EArmoredAttack::ShieldBash, ECounterGrade::Perfect) == ECounterGrade::Normal);
    CHECK(ArmoredCrackGrade(EArmoredAttack::HeavyCharge, ECounterGrade::Perfect) == ECounterGrade::Perfect);
    CHECK(ArmoredCrackGrade(EArmoredAttack::OverheadCrush, ECounterGrade::Perfect) == ECounterGrade::None);
    CHECK(Near(ArmoredStaggerSeconds(EArmoredAttack::HeavyCharge, ECounterGrade::Perfect), 1.4f * 2.25f));
    // the PIE proof (v06)
    FTier5Evidence E;
    for (int R = 0; R < static_cast<int>(EEnemyRole::Count); ++R) E.NoteSpawn(static_cast<EEnemyRole>(R), 5);
    E.NoteTarget(EEnemyRole::Breaker, ETargetKind::Generator); E.NoteTarget(EEnemyRole::Stalker, ETargetKind::Npc);
    CHECK(E.Check(0) && E.Check(1) && E.Check(2) && E.Check(3) && !E.Check(4) && !E.Pass());
    E.NoteTarget(EEnemyRole::ArmoredElite, ETargetKind::Gate); E.NoteResonance(0, 1, false); E.NoteResonance(1, 0, false);
    CHECK(!E.Pass());   // walked out of the aura is not «the resonator is gone»
    E.NoteResonance(1, 0, true);
    CHECK(!E.Pass());   // and the battle at the gate (v07)
    E.NoteDefenderHit(-9000.f, -9800.f, true); CHECK(!E.Check(7));   // inside the gate: not the gate battle
    E.NoteDefenderHit(-10200.f, -9800.f, false); CHECK(!E.Check(7));  // outside, but the gate was already down
    E.NoteDefenderHit(-10200.f, -9800.f, true);
    CHECK(E.Pass());

    // elite armour: a quarter damage until countered; a perfect counter cracks it longer
    FEliteArmor A;
    const float Scale = RoleStats(EEnemyRole::ArmoredElite).ArmorScale;
    CHECK(Near(A.DamageScale(Scale), 0.25f));
    A.OnCountered(ECounterGrade::Normal); CHECK(Near(A.DamageScale(Scale), 1.f));
    A.Tick(6.1f); CHECK(Near(A.DamageScale(Scale), 0.25f));
    A.OnCountered(ECounterGrade::Perfect); A.Tick(8.f); CHECK(Near(A.DamageScale(Scale), 1.f));
    // the gate is in the way of anything going north - a breaker smashes it, a flanked runner is already past
    CHECK(BlockedByGate(-12000.f, 2100.f, -9800.f, true, EEnemyRole::Breaker, false));
    CHECK(!BlockedByGate(-12000.f, 2100.f, -9800.f, false, EEnemyRole::Breaker, false));
    CHECK(!BlockedByGate(-12000.f, 2100.f, -9800.f, true, EEnemyRole::Runner, true));
    CHECK(BlockedByGate(-12000.f, 2100.f, -9800.f, true, EEnemyRole::Runner, false));
    CHECK(!BlockedByGate(-9000.f, 2100.f, -9800.f, true, EEnemyRole::Normal, false));
    CHECK(RoleStats(EEnemyRole::Breaker).FacilityDamage > RoleStats(EEnemyRole::Normal).FacilityDamage * 2.f);
    CHECK(RoleStats(EEnemyRole::Runner).Speed > RoleStats(EEnemyRole::Normal).Speed * 1.5f);
}

static void Waves()
{
    // Prototype A, GuildWorld v04: 6 + 8 + 6 + 7 + 9 = 36 grade-5 invaders, all six roles, last wave at 200 s
    int Total = 0;
    for (int I = 0; I < PrototypeAWaveCount; ++I) Total += WaveSize(PrototypeAWave(I));
    CHECK(PrototypeAWaveCount == 5 && Total == 36);
    CHECK(PrototypeAWave(3).Count[static_cast<int>(EEnemyRole::ArmoredElite)] == 1 && PrototypeAWave(3).Count[static_cast<int>(EEnemyRole::Resonator)] == 1);
    CHECK(PrototypeAWave(2).Count[static_cast<int>(EEnemyRole::Breaker)] == 2);
    for (int R = 0; R < static_cast<int>(EEnemyRole::Count); ++R)
    {
        int Seen = 0;
        for (int I = 0; I < PrototypeAWaveCount; ++I) Seen += PrototypeAWave(I).Count[R];
        CHECK(Seen > 0);   // every role appears
    }

    // on the clock: waves at 0 / 45 / 95 / 150 / 200 s if nobody clears them
    FWaveRunner R;
    int Spawned[5] = { -1, -1, -1, -1, -1 };
    for (int Step = 0; Step < 2400; ++Step)
    {
        const int W = R.Tick(0.1f);
        if (W >= 0) Spawned[W] = Step;
    }
    CHECK(Spawned[0] == 0 && Spawned[1] >= 449 && Spawned[1] <= 451 && Spawned[3] >= 1499 && Spawned[3] <= 1501 && Spawned[4] >= 1999 && Spawned[4] <= 2001);
    CHECK(R.AllWavesSpawned() && !R.Done());

    // a cleared wave pulls the next one forward after the 8 s breather
    FWaveRunner Q;
    CHECK(Q.Tick(0.1f) == 0);
    for (int I = 0; I < 6; ++I) Q.EnemyDied(Q.Now());
    CHECK(Q.Alive == 0);
    int Pulled = -1;
    for (int Step = 0; Step < 100 && Pulled < 0; ++Step) Pulled = Q.Tick(0.1f) == 1 ? Step : -1;
    CHECK(Pulled >= 78 && Pulled <= 81);  // ~8 s later, not at 45 s
    CHECK(Near(Q.Now(), 45.f));  // the rest keep their spacing

    FWaveRunner E;
    E.Tick(0.1f);
    CHECK(!E.Done());
}

static void Npcs()
{
    CHECK(TechnicianRepairScale(ENpcState::Normal) > TechnicianRepairScale(ENpcState::Injured));
    CHECK(TechnicianRepairScale(ENpcState::Injured) > TechnicianRepairScale(ENpcState::Missing));
    CHECK(!AdvancedRepairAvailable(ENpcState::Missing) && AdvancedRepairAvailable(ENpcState::Normal));
}

static void Contribution()
{
    // boss-damage king vs a defender who held the gate, repaired and rescued: the defender ranks first
    FContribution Players[3];
    Players[0].Raw[static_cast<int>(EContribution::Boss)] = 900000.f;
    Players[0].Raw[static_cast<int>(EContribution::Kill)] = 6.f;
    Players[1].Raw[static_cast<int>(EContribution::Defense)] = 4000.f;
    Players[1].Raw[static_cast<int>(EContribution::Repair)] = 300.f;
    Players[1].Raw[static_cast<int>(EContribution::NpcRescue)] = 2.f;
    Players[1].Raw[static_cast<int>(EContribution::Kill)] = 4.f;
    Players[1].Raw[static_cast<int>(EContribution::Boss)] = 200000.f;
    Players[2].Raw[static_cast<int>(EContribution::Kill)] = 3.f;
    const float Dps = ContributionScore(Players[0], Players, 3);
    const float Defender = ContributionScore(Players[1], Players, 3);
    const float Other = ContributionScore(Players[2], Players, 3);
    CHECK(Defender > Dps);
    CHECK(Dps > Other);
    CHECK(Dps <= 100.f * ContributionWeight(EContribution::Boss) + 100.f * ContributionWeight(EContribution::Kill) + 0.01f);

    // stewardship: highest summed score; nobody scoring = nobody
    const float Scores[4] = { Dps, Defender, Other, 10.f };
    const int Guilds[4] = { 0, 1, 1, -1 };
    CHECK(StewardGuild(Scores, Guilds, 4, 2) == 1);
    const float Zero[2] = { 0.f, 0.f };
    const int G2[2] = { 0, 1 };
    CHECK(StewardGuild(Zero, G2, 2, 2) == -1);

    // policies: within budget, no repeats, can't take everything
    const EPolicy Two[2] = { EPolicy::GateReinforce, EPolicy::MedicalStock };
    CHECK(ValidPolicies(Two, 2));
    const EPolicy Three[3] = { EPolicy::GateReinforce, EPolicy::GeneratorReinforce, EPolicy::Scouting };
    CHECK(!ValidPolicies(Three, 3));
    const EPolicy Repeat[2] = { EPolicy::Scouting, EPolicy::Scouting };
    CHECK(!ValidPolicies(Repeat, 2));
    EPolicy All[6];
    for (int I = 0; I < 6; ++I) All[I] = static_cast<EPolicy>(I);
    CHECK(!ValidPolicies(All, 6));
}


static void Strategy()
{
    const EPolicy Picks[2] = { EPolicy::Scouting, EPolicy::ReservePower };
    const FPolicyEffects P = PolicyEffects(Picks, 2);
    CHECK(P.bWavePreview && Near(P.PrepBonusSeconds, 20.f) && Near(P.ReservePowerSeconds, 90.f));
    CHECK(Near(P.GateHealthScale, 1.f) && !P.bNpcsArmed);
    const EPolicy Gate[1] = { EPolicy::GateReinforce };
    CHECK(Near(PolicyEffects(Gate, 1).GateHealthScale, 1.5f));

    // a dead generator: emergency power while the reserve lasts, then dark; turrets follow the power
    CHECK(EffectivePower(0.f, 30.f) == 1 && EffectivePower(0.f, 0.f) == 0 && EffectivePower(0.9f, 0.f) == 3);
    CHECK(TurretDps(3) > TurretDps(2) && TurretDps(2) > TurretDps(1) && TurretDps(1) > 0.f && Near(TurretDps(0), 0.f));

    FSupplyPool S{ 5 };
    CHECK(S.Spend(ESupplyUse::Barricade) && S.Points == 2);
    CHECK(!S.Spend(ESupplyUse::Barricade) && S.Points == 2);  // not enough left
    CHECK(S.Spend(ESupplyUse::TurretRepair) && S.Points == 0);
}

static void NpcRoles()
{
    // life: two beatings to go missing; rescued comes back to normal after a minute
    FNpcLife L{ ENpcState::Normal, 1000.f, 1000.f, 0.f };
    CHECK(!L.ApplyDamage(600.f));
    CHECK(L.ApplyDamage(600.f) && L.State == ENpcState::Injured && Near(L.Health, 500.f));
    CHECK(L.ApplyDamage(600.f) && L.State == ENpcState::Missing);
    CHECK(!L.IsTargetable() && !L.ApplyDamage(600.f));
    CHECK(L.Rescue() && L.State == ENpcState::Rescued && !L.Rescue());
    CHECK(!L.Tick(30.f) && L.Tick(31.f) && L.State == ENpcState::Normal);

    // the roster runs the node: lose the scout, lose the forecast; lose the operator, lose rescue signals
    ENpcState All[NpcRoleCount] = { ENpcState::Normal, ENpcState::Normal, ENpcState::Normal, ENpcState::Normal, ENpcState::Normal };
    const FPolicyEffects None{};
    const FNpcEffects Full = NpcEffects(All, None);
    CHECK(Full.bWavePreview && Full.bRescueSignals && Full.MedicalHealPerSecond > 0.f && Near(Full.GuardDps, 0.f));
    CHECK(PrepSeconds(Full, None) > 20.f);
    All[static_cast<int>(ENpcRole::Scout)] = ENpcState::Missing;
    All[static_cast<int>(ENpcRole::Operator)] = ENpcState::Missing;
    All[static_cast<int>(ENpcRole::Medic)] = ENpcState::Injured;
    const FNpcEffects Hurt = NpcEffects(All, None);
    CHECK(!Hurt.bWavePreview && !Hurt.bRescueSignals && Near(Hurt.MedicalHealPerSecond, Full.MedicalHealPerSecond * 0.5f));
    CHECK(Near(PrepSeconds(Hurt, None), 20.f));
    // scouting policy keeps the preview without the scout; armed guards shoot
    const EPolicy Arm[2] = { EPolicy::Scouting, EPolicy::ArmNpcs };
    const FNpcEffects Policy = NpcEffects(All, PolicyEffects(Arm, 2));
    CHECK(Policy.bWavePreview && Policy.GuardDps > 0.f);
    CHECK(NpcMaxHealth(ENpcRole::Guard, true) > NpcMaxHealth(ENpcRole::Guard, false));
    CHECK(TechnicianRepairPerSecond(ENpcState::Normal) > TechnicianRepairPerSecond(ENpcState::Injured));
}

static void GuildCommand()
{
    CHECK(HasPermission(EGuildRole::Leader, EGuildPerm::AssignRoles));
    CHECK(!HasPermission(EGuildRole::Vice, EGuildPerm::AssignRoles) && HasPermission(EGuildRole::Vice, EGuildPerm::SelectPolicy));
    CHECK(HasPermission(EGuildRole::CombatCaptain, EGuildPerm::Rally) && !HasPermission(EGuildRole::CombatCaptain, EGuildPerm::SelectPolicy));
    CHECK(HasPermission(EGuildRole::SupplyCaptain, EGuildPerm::AllocateSupply) && !HasPermission(EGuildRole::SupplyCaptain, EGuildPerm::Ping));
    CHECK(HasPermission(EGuildRole::CraftCaptain, EGuildPerm::InvestFacility) && HasPermission(EGuildRole::CraftCaptain, EGuildPerm::OrderNpc));
    CHECK(!HasPermission(EGuildRole::Member, EGuildPerm::Ping));
    CHECK(PingCredits(10.f, 500.f) && !PingCredits(16.f, 500.f) && !PingCredits(5.f, 900.f));
    CHECK(KillWeight(EEnemyRole::ArmoredElite) > KillWeight(EEnemyRole::Breaker) && KillWeight(EEnemyRole::Breaker) > KillWeight(EEnemyRole::Normal));
    CHECK(Near(DefenseCredit(EEnemyRole::Breaker, 900.f), 2.f) && Near(DefenseCredit(EEnemyRole::Breaker, 1600.f), 0.f) && Near(DefenseCredit(EEnemyRole::Normal, -1.f), 0.f));
}

static void GuildWar()
{
    CHECK(ValidWarTeams(8, 8) && ValidWarTeams(12, 12) && !ValidWarTeams(8, 12) && !ValidWarTeams(20, 20));
    // kills alone never win; holding objectives does
    FWarMatch M;
    for (int I = 0; I < 500; ++I) M.Kill(0);
    M.TickHolds(100.f, 0, 2);
    CHECK(M.Score[0] == 0 && M.Score[1] == 200 && M.Result() == -1);
    M.Objective(0, EWarObjective::CoreCarry);
    M.Objective(0, EWarObjective::CommanderEscort);
    CHECK(M.Score[0] == 350);
    M.TickHolds(400.f, 1, 2);   // B reaches 1000 first
    CHECK(M.Score[1] >= 1000 && M.Result() == 1);
    FWarMatch T;
    T.TickHolds(900.f, 1, 1);
    CHECK(T.Result() == 2);     // equal at the bell
    FWarMatch Half;
    Half.TickHolds(0.5f, 1, 0);
    Half.TickHolds(0.5f, 1, 0);
    CHECK(Half.Score[0] == 1);  // fractional seconds add up
}

int main()
{
    CounterGrades();
    CoreArmor();
    Facilities();
    StateMachine();
    Services();
    Roles();
    Waves();
    Npcs();
    Contribution();
    Strategy();
    NpcRoles();
    GuildCommand();
    GuildWar();
    if (Failures) { std::printf("%d check(s) failed\n", Failures); return 1; }
    std::printf("node rules: all checks passed\n");
    return 0;
}
