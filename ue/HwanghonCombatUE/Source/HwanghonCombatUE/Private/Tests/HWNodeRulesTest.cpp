#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/AutomationTest.h"
#include "Node/HWNodeConfig.h"
#include "Node/HWNodeRules.h"

// The node rules are also compiled and checked without the engine (Scripts/tests/node_rules_test.cpp, npm test);
// these run the same headline cases inside UE so the one-click Windows run covers them (docs/design/200).

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWNodeCounterAndCoreTest,
    "Hwanghon.Node.CounterGradeAndArmCore",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWNodeCounterAndCoreTest::RunTest(const FString& Parameters)
{
    using namespace HWNodeRules;
    TestTrue(TEXT("0.05 s = perfect"), GradeCounter(0.05f, 0.10f, 0.25f) == ECounterGrade::Perfect);
    TestTrue(TEXT("0.2 s = normal"), GradeCounter(0.2f, 0.10f, 0.25f) == ECounterGrade::Normal);
    TestTrue(TEXT("0.3 s = none"), GradeCounter(0.3f, 0.10f, 0.25f) == ECounterGrade::None);

    FCoreArmor Core;
    int32 Perfects = 0;
    while (!Core.ApplyCounter(ECounterGrade::Perfect)) ++Perfects;
    TestEqual(TEXT("five perfect counters break 100 core armour"), Perfects + 1, 5);
    TestTrue(TEXT("core exposed"), Core.bExposed);
    TestFalse(TEXT("no finish above 10 %"), CanFinish(Core, 0.2f));
    TestTrue(TEXT("finish at 10 %"), CanFinish(Core, 0.1f));

    FCoreExtraction Hold;
    TestTrue(TEXT("extraction starts"), Hold.Begin(Core, 0.08f));
    Hold.Tick(1.0f);
    Hold.Interrupt();
    TestTrue(TEXT("a hit interrupts it"), Hold.State == EExtraction::Interrupted);
    TestTrue(TEXT("may try again"), Hold.Begin(Core, 0.08f));
    TestTrue(TEXT("held to the end it completes"), Hold.Tick(1.6f) && Hold.State == EExtraction::Extracted);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWNodeStateMachineTest,
    "Hwanghon.Node.StateMachineAndOccupation",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWNodeStateMachineTest::RunTest(const FString& Parameters)
{
    using namespace HWNodeRules;
    FNodeStateMachine M;
    M.SetThreat(0.7f);
    TestTrue(TEXT("alert"), M.State == ENodeState::Alert);
    TestTrue(TEXT("invasion"), M.StartInvasion());
    TestTrue(TEXT("comms destroyed -> fallen"), M.TickInvasion(0.1f, true, false) && M.State == ENodeState::Fallen);
    TestFalse(TEXT("no retake in the first two hours"), M.StartRetake());
    M.TickOccupation(2.5f);
    TestTrue(TEXT("retakeable after two hours"), M.State == ENodeState::Retakeable);
    M.TickOccupation(30.f);
    TestTrue(TEXT("a day held = infection core"), M.Tier() == EOccupationTier::InfectionCore);
    TestTrue(TEXT("harder than basic"), OccupationDifficulty(M.Tier()) > OccupationDifficulty(EOccupationTier::Basic));

    const FNodeServices Fallen = NodeServices(ENodeState::Fallen, 1.f, 3);
    TestFalse(TEXT("a fallen node shows no rescue signals"), Fallen.bRescueSignals);
    TestTrue(TEXT("and leaves most of the map unknown"), Fallen.MapIntel < 0.5f);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWNodeRolesAndWavesTest,
    "Hwanghon.Node.RolesAndWaves",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWNodeRolesAndWavesTest::RunTest(const FString& Parameters)
{
    using namespace HWNodeRules;
    FTargetView V;
    V.Player = 400.f;
    V.Gate = 300.f;
    V.Generator = 9000.f;
    V.Comms = 15000.f;
    V.Npc = 9000.f;
    TestTrue(TEXT("normal fights the nearby player"), ChooseTarget(EEnemyRole::Normal, V) == ETargetKind::Player);
    TestTrue(TEXT("breaker ignores the player for the generator"), ChooseTarget(EEnemyRole::Breaker, V) == ETargetKind::Generator);
    TestTrue(TEXT("stalker hunts the technician"), ChooseTarget(EEnemyRole::Stalker, V) == ETargetKind::Npc);
    TestTrue(TEXT("elite goes for the gate"), ChooseTarget(EEnemyRole::ArmoredElite, V) == ETargetKind::Gate);
    TestTrue(TEXT("the gate is in the way"), BlockedByGate(-12000.f, 2100.f, -9800.f, true, EEnemyRole::Breaker, false));

    int32 Total = 0;
    for (int32 I = 0; I < PrototypeAWaveCount; ++I) Total += WaveSize(PrototypeAWave(I));
    TestEqual(TEXT("prototype A = 26 enemies"), Total, 26);
    TestEqual(TEXT("last wave at 175 s"), PrototypeAWave(PrototypeAWaveCount - 1).StartAt, 175.f);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWNodeNamsanConfigTest,
    "Hwanghon.Node.NamsanConfigLoads",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWNodeNamsanConfigTest::RunTest(const FString& Parameters)
{
    const UHWNodeConfig* C = UHWNodeConfig::LoadFromJson(TEXT("namsan_n01"), nullptr);
    if (!TestNotNull(TEXT("Content/Data/node_namsan_n01.json loads"), C)) return false;
    TestEqual(TEXT("three facilities"), C->Facilities.Num(), 3);
    TestNotNull(TEXT("a gate"), C->FindFacility(EHWNodeFacilityKind::Gate));
    TestNotNull(TEXT("a generator"), C->FindFacility(EHWNodeFacilityKind::Generator));
    TestNotNull(TEXT("a comms centre"), C->FindFacility(EHWNodeFacilityKind::Comms));
    TestEqual(TEXT("7 pads + 12 roads + 4 walls"), C->Blocks.Num(), 23);
    TestEqual(TEXT("three spawn points"), C->SpawnPoints.Num(), 3);
    TestTrue(TEXT("routes"), C->MainRoute.Num() > 0 && C->WestRoute.Num() > 0 && C->EastRoute.Num() > 0 && C->GeneratorRoute.Num() > 0 && C->CommsRoute.Num() > 0);
    TestEqual(TEXT("gate anchor from the hand-off"), C->Anchor(TEXT("SouthGate")), FVector(0.f, -9800.f, -1250.f));

    // the first road's slab top passes through both ends (same maths as tools/ue/node-graybox.js)
    const FHWNodeBlock& Road = C->Blocks[7];
    const FRotator Rot(Road.Pitch, Road.Yaw, 0.f);
    const FVector Top = Road.Center + Rot.RotateVector(FVector::UpVector) * Road.HalfExtent.Z;
    TestTrue(TEXT("road top runs between its ends"), FMath::IsNearlyEqual(Top.Z, (-2150.f + -1250.f) * 0.5f, 2.f));
    return true;
}

#endif
