#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/AutomationTest.h"
#include "Game/HWLampFlicker.h"

// The shelter's lamps «일정 간격으로 명멸» (EP01 L253, docs/design/161): a short double blink, then steady.
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWLampFlickerTest,
    "Hwanghon.Shelter.LampFlicker",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWLampFlickerTest::RunTest(const FString& Parameters)
{
    const float Blink = 0.42f;
    TestEqual(TEXT("first dip is deep"), UHWLampFlickerSubsystem::FactorAt(0.05f, Blink), 0.25f);
    TestEqual(TEXT("back up between the two dips"), UHWLampFlickerSubsystem::FactorAt(0.15f, Blink), 1.f);
    TestEqual(TEXT("second dip is shallower"), UHWLampFlickerSubsystem::FactorAt(0.25f, Blink), 0.45f);
    TestEqual(TEXT("steady after the blink"), UHWLampFlickerSubsystem::FactorAt(0.5f, Blink), 1.f);
    TestEqual(TEXT("steady most of the cycle"), UHWLampFlickerSubsystem::FactorAt(5.f, Blink), 1.f);
    // over one 6.5 s cycle the lamp is dimmed for well under a tenth of the time - a flicker, not a broken lamp
    int32 Dim = 0, N = 650;
    for (int32 i = 0; i < N; ++i) if (UHWLampFlickerSubsystem::FactorAt(i * 0.01f, Blink) < 1.f) ++Dim;
    TestTrue(FString::Printf(TEXT("dimmed %d of %d samples"), Dim, N), Dim > 0 && Dim < N / 20);
    return true;
}

#endif
