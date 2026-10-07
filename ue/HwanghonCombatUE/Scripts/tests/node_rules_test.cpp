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
    CHECK(ChooseTarget(EEnemyRole::Stalker, V) == ETargetKind::Npc);
    CHECK(ChooseTarget(EEnemyRole::ArmoredElite, V) == ETargetKind::Gate);
    CHECK(ChooseTarget(EEnemyRole::Runner, V) == ETargetKind::None);  // still flanking
    V.bFlanked = true;
    CHECK(ChooseTarget(EEnemyRole::Runner, V) == ETargetKind::Npc);
    V.Player = 200.f;
    CHECK(ChooseTarget(EEnemyRole::Runner, V) == ETargetKind::Player);
    CHECK(ChooseTarget(EEnemyRole::ArmoredElite, V) == ETargetKind::Player);  // blocked face to face
    V.Player = 600.f; V.Gate = -1.f;
    CHECK(ChooseTarget(EEnemyRole::ArmoredElite, V) == ETargetKind::Comms);  // gate down: on to the comms centre
    V.Npc = -1.f;
    CHECK(ChooseTarget(EEnemyRole::Stalker, V) == ETargetKind::Player);

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
    // Prototype A: 4+2, 5+3, 6+1 breaker, elite+4 = 26 enemies, last wave at 175 s
    int Total = 0;
    for (int I = 0; I < PrototypeAWaveCount; ++I) Total += WaveSize(PrototypeAWave(I));
    CHECK(Total == 26);
    CHECK(PrototypeAWave(3).Count[static_cast<int>(EEnemyRole::ArmoredElite)] == 1);
    CHECK(PrototypeAWave(2).Count[static_cast<int>(EEnemyRole::Breaker)] == 1);

    // on the clock: waves at 0 / 55 / 115 / 175 s if nobody clears them
    FWaveRunner R;
    int Spawned[4] = { -1, -1, -1, -1 };
    for (int Step = 0; Step < 2400; ++Step)
    {
        const int W = R.Tick(0.1f);
        if (W >= 0) Spawned[W] = Step;
    }
    CHECK(Spawned[0] == 0 && Spawned[1] >= 549 && Spawned[1] <= 551 && Spawned[3] >= 1749 && Spawned[3] <= 1751);
    CHECK(R.AllWavesSpawned() && !R.Done());

    // a cleared wave pulls the next one forward after the 8 s breather
    FWaveRunner Q;
    CHECK(Q.Tick(0.1f) == 0);
    for (int I = 0; I < 6; ++I) Q.EnemyDied(Q.Now());
    CHECK(Q.Alive == 0);
    int Pulled = -1;
    for (int Step = 0; Step < 100 && Pulled < 0; ++Step) Pulled = Q.Tick(0.1f) == 1 ? Step : -1;
    CHECK(Pulled >= 78 && Pulled <= 81);  // ~8 s later, not at 55 s
    CHECK(Near(Q.Now(), 55.f));  // the rest keep their spacing

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
    if (Failures) { std::printf("%d check(s) failed\n", Failures); return 1; }
    std::printf("node rules: all checks passed\n");
    return 0;
}
