#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/AutomationTest.h"
#include "Boss/HWBossCanonRules.h"
#include "Boss/HWBossCharacter.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Engine/World.h"

// EP01 boss by its novel (docs/design/138): the scythe band, the elbow answer, Kain's rebound, the sever.
namespace
{
    struct FHWHeosuabiWorld
    {
        UWorld* World = nullptr;
        AHWBossCharacter* Boss = nullptr;
        AHWAinCharacter* Ain = nullptr;
        AHWAinCharacter* Kain = nullptr;
        UHWHeosuabiRules* Rules = nullptr;

        explicit FHWHeosuabiWorld(bool bWithRules)
        {
            const UWorld::InitializationValues Init = UWorld::InitializationValues()
                .AllowAudioPlayback(false).RequiresHitProxies(false).CreatePhysicsScene(true)
                .CreateNavigation(false).CreateAISystem(false).ShouldSimulatePhysics(false).SetTransactional(false);
            World = UWorld::CreateWorld(EWorldType::Game, false, NAME_None, nullptr, true, ERHIFeatureLevel::Num, &Init, false);
            if (!World) return;
            World->InitializeActorsForPlay(FURL());
            FActorSpawnParameters P;
            P.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
            Boss = World->SpawnActor<AHWBossCharacter>(FVector::ZeroVector, FRotator::ZeroRotator, P);
            Ain = World->SpawnActor<AHWAinCharacter>(FVector(-200.f, 0.f, 0.f), FRotator::ZeroRotator, P);
            Kain = World->SpawnActor<AHWAinCharacter>(FVector(-600.f, 300.f, 0.f), FRotator::ZeroRotator, P);
            if (!Boss || !Ain || !Kain) return;
            Boss->DispatchBeginPlay();
            Ain->DispatchBeginPlay();
            Kain->DispatchBeginPlay();
            if (bWithRules)
            {
                Rules = NewObject<UHWHeosuabiRules>(Boss, TEXT("CanonRules"));
                Rules->SetCast(Ain, Kain);
                Rules->RegisterComponent();
            }
        }
        ~FHWHeosuabiWorld() { if (World) World->DestroyWorld(false); }

        void HitFrom(float DistanceCm, float Damage)
        {
            Ain->SetActorLocation(FVector(-DistanceCm, 0.f, 0.f));
            Boss->ReceivePlayerHit(Damage, EHWAttackTier::Light, Ain->GetActorLocation());
        }
    };
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWHeosuabiBandTest, "Hwanghon.Canon.Heosuabi.Band",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FHWHeosuabiBandTest::RunTest(const FString& Parameters)
{
    using R = UHWHeosuabiRules;
    TestTrue(TEXT("110 cm is too close"), R::Classify(110.f) == R::EBand::TooClose);
    TestTrue(TEXT("150 cm is the band (ring)"), R::Classify(150.f) == R::EBand::Band);
    TestTrue(TEXT("200 cm is the band"), R::Classify(200.f) == R::EBand::Band);
    TestTrue(TEXT("250 cm is too far"), R::Classify(250.f) == R::EBand::TooFar);
    TestEqual(TEXT("inside the guard: elbow"), R::PatternFor(100.f), FName(TEXT("Elbow")));
    TestEqual(TEXT("band and beyond: spin"), R::PatternFor(300.f), FName(TEXT("Spin")));
    TestEqual(TEXT("far: walk in, no pattern"), R::PatternFor(900.f), FName(NAME_None));
    TestTrue(TEXT("spin tell holds the breath (>= 1 s)"), R::Spin().TellDuration >= 1.f);
    TestEqual(TEXT("spin reaches the ring"), R::Spin().Beats[0].RangeCm, R::SpinReachCm);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWHeosuabiHitTest, "Hwanghon.Canon.Heosuabi.OnlyTheSeverEndsIt",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FHWHeosuabiHitTest::RunTest(const FString& Parameters)
{
    {
        // Control: without the novel rules the same blow simply kills (proves the rules are what changes it).
        FHWHeosuabiWorld W(false);
        if (!TestNotNull(TEXT("boss"), W.Boss)) return false;
        W.HitFrom(200.f, 1.0e7f);
        TestTrue(TEXT("control: generic boss dies to raw damage"), W.Boss->IsDead());
    }
    FHWHeosuabiWorld W(true);
    if (!TestNotNull(TEXT("rules"), W.Rules)) return false;
    const float Full = W.Boss->GetHealth();

    W.HitFrom(110.f, 5000.f);
    TestEqual(TEXT("too close: the blade glances off (no damage)"), W.Boss->GetHealth(), Full);
    TestEqual(TEXT("too close: the elbow answers"), W.Boss->GetCurrentPatternId(), FName(TEXT("Elbow")));

    W.HitFrom(250.f, 5000.f);
    TestEqual(TEXT("too far: nothing lands"), W.Boss->GetHealth(), Full);

    W.HitFrom(200.f, 1.0e7f);
    TestFalse(TEXT("in the band without an opening it cuts but does not end"), W.Boss->IsDead());
    TestTrue(TEXT("...and it did cut"), W.Boss->GetHealth() < Full);

    W.Boss->EnterSystemBreak(UHWHeosuabiRules::BreathWindowSeconds, W.Kain->GetActorLocation());
    W.HitFrom(110.f, 5000.f);
    TestFalse(TEXT("inside the breath, too close still glances"), W.Boss->IsDead());
    W.HitFrom(200.f, 1000.f);
    TestTrue(TEXT("inside the breath, one scythe length: the sever"), W.Boss->IsDead());
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWHeosuabiReboundTest, "Hwanghon.Canon.Heosuabi.KainRebound",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FHWHeosuabiReboundTest::RunTest(const FString& Parameters)
{
    FHWHeosuabiWorld W(true);
    if (!TestNotNull(TEXT("rules"), W.Rules)) return false;
    W.Ain->SetActorLocation(FVector(-330.f, 0.f, 0.f));
    W.Boss->StartCanonPattern(UHWHeosuabiRules::Spin());
    const FHWBossBeatSpec Beat = UHWHeosuabiRules::Spin().Beats[0];

    W.Kain->SetActorLocation(FVector(250.f, 0.f, 0.f));   // behind the boss
    TestFalse(TEXT("Kain behind the boss cannot take it back"), W.Rules->InterceptBeat(*W.Boss, Beat));
    W.Kain->SetActorLocation(FVector(-600.f, 0.f, 0.f));  // out of the spin
    TestFalse(TEXT("Kain outside the spin cannot take it back"), W.Rules->InterceptBeat(*W.Boss, Beat));

    W.Kain->SetActorLocation(FVector(-175.f, 0.f, 0.f));  // in front of it, on Ain's side
    TestTrue(TEXT("Kain in front, on Ain's side: rebound"), W.Rules->InterceptBeat(*W.Boss, Beat));
    TestEqual(TEXT("the posture breaks — one breath"), W.Boss->GetBossState(), EHWBossState::Break);
    return true;
}

#endif
