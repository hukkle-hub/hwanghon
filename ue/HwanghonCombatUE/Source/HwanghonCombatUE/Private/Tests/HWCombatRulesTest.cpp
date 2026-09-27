#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/AutomationTest.h"
#include "Combat/HWCombatTuningAsset.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWPlayerTimingDefaultsTest,
    "Hwanghon.Combat.PlayerTimingDefaults",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWPlayerTimingDefaultsTest::RunTest(const FString& Parameters)
{
    const UHWCombatTuningAsset* Tuning = NewObject<UHWCombatTuningAsset>();

    TestEqual(TEXT("Attack1 duration"), Tuning->Attack1.Duration, 0.66f);
    TestEqual(TEXT("Attack2 duration"), Tuning->Attack2.Duration, 0.66f);
    TestEqual(TEXT("Attack3 duration"), Tuning->Attack3.Duration, 0.66f);

    TestEqual(TEXT("Attack1 hit"), Tuning->Attack1.HitAt, 0.24f);
    TestEqual(TEXT("Attack2 hit"), Tuning->Attack2.HitAt, 0.24f);
    TestEqual(TEXT("Attack3 hit"), Tuning->Attack3.HitAt, 0.24f);

    TestEqual(TEXT("Attack1 defensive cancel"), Tuning->Attack1.DefenseCancelAt, 0.39f);
    TestEqual(TEXT("Attack2 defensive cancel"), Tuning->Attack2.DefenseCancelAt, 0.39f);
    TestEqual(TEXT("Attack3 defensive cancel"), Tuning->Attack3.DefenseCancelAt, 0.39f);
    TestEqual(TEXT("Smash defensive cancel"), Tuning->Smash.DefenseCancelAt, 0.68f);

    TestEqual(TEXT("Dodge i-frames"), Tuning->DodgeIFrames, 0.30f);
    TestEqual(TEXT("Jump duration"), Tuning->JumpDuration, 0.45f);
    TestEqual(TEXT("Counter window"), Tuning->CounterWindow, 0.25f);

    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWBossVerticalSlicePatternsTest,
    "Hwanghon.Combat.BossVerticalSlicePatterns",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWBossVerticalSlicePatternsTest::RunTest(const FString& Parameters)
{
    const UHWCombatTuningAsset* Tuning = NewObject<UHWCombatTuningAsset>();

    TestTrue(TEXT("At least five boss patterns"), Tuning->BossPatterns.Num() >= 5);

    bool bHasCharge = false;
    bool bHasJumpOnly = false;
    bool bHasBig = false;

    for (const FHWBossPatternSpec& Pattern : Tuning->BossPatterns)
    {
        TestTrue(TEXT("Tell > 0"), Pattern.TellDuration > 0.f);
        TestTrue(TEXT("Strike > 0"), Pattern.StrikeDuration > 0.f);
        TestTrue(TEXT("Recovery > 0"), Pattern.RecoveryDuration > 0.f);
        TestTrue(TEXT("At least one beat"), !Pattern.Beats.IsEmpty());

        bHasCharge |= Pattern.LungeDistanceCm > 0.f && Pattern.LungeDuration > 0.f;
        bHasJumpOnly |= Pattern.bJumpOnly;
        bHasBig |= Pattern.bBig;
    }

    TestTrue(TEXT("Charge/lunge exists"), bHasCharge);
    TestTrue(TEXT("Jump-only pattern exists"), bHasJumpOnly);
    TestTrue(TEXT("Big pattern exists"), bHasBig);

    return true;
}

#endif
