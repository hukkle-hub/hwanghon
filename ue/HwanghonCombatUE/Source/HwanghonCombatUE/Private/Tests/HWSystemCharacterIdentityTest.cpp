#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/AutomationTest.h"
#include "System/HWSystemRulesLibrary.h"

namespace
{
    void CheckProfile(
        FAutomationTestBase& Test,
        const TCHAR* Label,
        FName Id,
        float Hp,
        float Atk,
        float Def,
        float Crit,
        float CritDmg,
        float Aspd,
        float Mspd)
    {
        const FHWCharacterSystemProfile P =
            UHWSystemRulesLibrary::CharacterProfile(Id);

        Test.TestEqual(FString::Printf(TEXT("%s id"), Label), P.CharacterId, Id);
        Test.TestEqual(FString::Printf(TEXT("%s HP"), Label), P.BaseHealth, Hp);
        Test.TestEqual(FString::Printf(TEXT("%s ATK"), Label), P.BaseAttack, Atk);
        Test.TestEqual(FString::Printf(TEXT("%s DEF"), Label), P.BaseDefense, Def);
        Test.TestEqual(FString::Printf(TEXT("%s Crit"), Label), P.CritChancePercent, Crit);
        Test.TestEqual(FString::Printf(TEXT("%s CritDmg"), Label), P.CritDamagePercent, CritDmg);
        Test.TestEqual(FString::Printf(TEXT("%s ASPD"), Label), P.AttackSpeedPercent, Aspd);
        Test.TestEqual(FString::Printf(TEXT("%s MSPD"), Label), P.MoveSpeedPercent, Mspd);
    }
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWCharacterIdentityProfilesTest,
    "Hwanghon.System.CharacterIdentity.Profiles",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWCharacterIdentityProfilesTest::RunTest(const FString& Parameters)
{
    CheckProfile(*this, TEXT("Ain"),  TEXT("ain"),  24450.f, 2980.f, 1780.f, 18.2f, 142.6f, 112.5f, 105.f);
    CheckProfile(*this, TEXT("Kain"), TEXT("kain"), 38200.f, 3410.f, 2960.f,  9.4f, 118.0f,  96.0f,  98.f);
    CheckProfile(*this, TEXT("Ryu"),  TEXT("ryu"),  21800.f, 2640.f, 1520.f, 22.6f, 151.0f, 124.0f, 112.f);
    CheckProfile(*this, TEXT("Sera"), TEXT("sera"), 19600.f, 1480.f, 1610.f,  6.0f, 110.0f, 100.0f, 104.f);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWCharacterIdentityTimingTest,
    "Hwanghon.System.CharacterIdentity.AttackClock",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWCharacterIdentityTimingTest::RunTest(const FString& Parameters)
{
    const auto Ain = UHWSystemRulesLibrary::CharacterProfile(TEXT("ain"));
    const auto Kain = UHWSystemRulesLibrary::CharacterProfile(TEXT("kain"));
    const auto Ryu = UHWSystemRulesLibrary::CharacterProfile(TEXT("ryu"));
    const auto Sera = UHWSystemRulesLibrary::CharacterProfile(TEXT("sera"));

    auto Duration = [](const FHWCharacterSystemProfile& P)
    {
        return 0.66f / FMath::Max(0.01f, P.AttackSpeedPercent / 100.f);
    };

    TestTrue(TEXT("Ryu attacks faster than Ain"), Duration(Ryu) < Duration(Ain));
    TestTrue(TEXT("Ain attacks faster than Sera"), Duration(Ain) < Duration(Sera));
    TestTrue(TEXT("Sera attacks faster than Kain"), Duration(Sera) < Duration(Kain));
    TestTrue(TEXT("Kain has the largest HP pool"), Kain.BaseHealth > Ain.BaseHealth && Kain.BaseHealth > Ryu.BaseHealth && Kain.BaseHealth > Sera.BaseHealth);
    TestTrue(TEXT("Sera is support, not a hidden DPS stat clone"), Sera.BaseAttack < Ain.BaseAttack && Sera.BaseAttack < Kain.BaseAttack && Sera.BaseAttack < Ryu.BaseAttack);
    return true;
}

#endif
