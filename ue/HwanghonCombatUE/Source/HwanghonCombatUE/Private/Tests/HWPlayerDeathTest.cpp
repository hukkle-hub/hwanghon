#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/AutomationTest.h"
#include "Tests/HWPlayerDeathTestObserver.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatTuningAsset.h"
#include "Engine/EngineBaseTypes.h"
#include "Engine/World.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "UObject/StrongObjectPtr.h"

struct FHWPlayerDeathTestAccess
{
    static EHWActionType QueuedAction(const UHWCombatComponent& Combat) { return Combat.QueuedAction; }
    static float HitStopRemaining(const UHWCombatComponent& Combat) { return Combat.HitStopRemaining; }

    static void TryRestart(UHWCombatComponent& Combat)
    {
        Combat.StartAction(EHWActionType::Attack1);
        Combat.RequestDefensiveAction(EHWActionType::Jump);
        Combat.InterruptInto(EHWActionType::Counter);
        Combat.FinishAction();
    }
};

namespace
{
    struct FHWPlayerTestWorld
    {
        UWorld* World = nullptr;
        AHWAinCharacter* Player = nullptr;
        UHWCombatComponent* Combat = nullptr;
        TStrongObjectPtr<UHWPlayerDeathTestObserver> Observer;

        FHWPlayerTestWorld()
            : Observer(NewObject<UHWPlayerDeathTestObserver>())
        {
            const UWorld::InitializationValues InitializationValues = UWorld::InitializationValues()
                .AllowAudioPlayback(false)
                .RequiresHitProxies(false)
                .CreatePhysicsScene(true)
                .CreateNavigation(false)
                .CreateAISystem(false)
                .ShouldSimulatePhysics(false)
                .SetTransactional(false);
            World = UWorld::CreateWorld(EWorldType::Game, false, NAME_None, nullptr,
                true, ERHIFeatureLevel::Num, &InitializationValues, false);
            if (!World)
            {
                return;
            }
            World->InitializeActorsForPlay(FURL());
            Player = World->SpawnActor<AHWAinCharacter>();
            if (!Player)
            {
                return;
            }
            Player->DispatchBeginPlay();
            Combat = Player->GetCombat();
            Combat->UseNeutralCharacterModifiers();
            Observer->Combat = Combat;
            Combat->OnDied.AddDynamic(Observer.Get(), &UHWPlayerDeathTestObserver::HandleDeath);
            Combat->OnDamaged.AddDynamic(Observer.Get(), &UHWPlayerDeathTestObserver::HandleDamage);
            Combat->OnActionStarted.AddDynamic(Observer.Get(), &UHWPlayerDeathTestObserver::HandleStarted);
            Combat->OnActionEnded.AddDynamic(Observer.Get(), &UHWPlayerDeathTestObserver::HandleEnded);
            Combat->OnContact.AddDynamic(Observer.Get(), &UHWPlayerDeathTestObserver::HandleContact);
        }

        ~FHWPlayerTestWorld()
        {
            if (World)
            {
                World->DestroyWorld(false);
            }
        }

        void Tick(float Seconds) { Combat->TickComponent(Seconds, LEVELTICK_All, nullptr); }
    };
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWPlayerDeathLifecycleTest,
    "Hwanghon.Combat.PlayerDeathLifecycle",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWPlayerDeathLifecycleTest::RunTest(const FString& Parameters)
{
    FHWPlayerTestWorld Fixture;
    if (!TestNotNull(TEXT("Transient player combat"), Fixture.Combat))
    {
        return false;
    }
    UHWCombatComponent& Combat = *Fixture.Combat;
    TestTrue(TEXT("Attack starts"), Combat.RequestAttack());
    TestTrue(TEXT("Combo is queued"), Combat.RequestAttack());
    Combat.ApplyHitStop(2.f);
    Fixture.Player->GetCharacterMovement()->Velocity = FVector(200.f, 0.f, 0.f);
    const float StaminaAtDeath = Combat.GetStamina();

    TestTrue(TEXT("Lethal hit is accepted"), Combat.ApplyIncomingDamage(Combat.GetHealth() + 100.f, EHWAttackTier::Stagger));
    TestTrue(TEXT("Death is terminal before damage listeners run"), Fixture.Observer->bLethalDamageWasTerminal);
    TestTrue(TEXT("Death observer sees canceled action and zero HP"), Fixture.Observer->bDeadWhenNotified);
    TestTrue(TEXT("Death listeners cannot act or damage again"), Fixture.Observer->bDeathCallbacksRejectActions);
    TestEqual(TEXT("Lethal damage is reported once"), Fixture.Observer->DamageCount, 1);
    TestEqual(TEXT("Death event once"), Fixture.Observer->DeathCount, 1);
    TestEqual(TEXT("Interrupted attack ends once"), Fixture.Observer->EndedCount, 1);
    TestEqual(TEXT("No lethal stagger reaction starts"), Fixture.Observer->StartedCount, 1);
    TestTrue(TEXT("Queued combo is canceled"), FHWPlayerDeathTestAccess::QueuedAction(Combat) == EHWActionType::None);
    TestEqual(TEXT("Hitstop clears including reentrant request"), FHWPlayerDeathTestAccess::HitStopRemaining(Combat), 0.f);
    TestTrue(TEXT("Movement stops"), Fixture.Player->GetVelocity().IsNearlyZero());
    TestTrue(TEXT("Movement disabled"), Fixture.Player->GetCharacterMovement()->MovementMode == MOVE_None);

    FHWPlayerDeathTestAccess::TryRestart(Combat);
    Fixture.Tick(10.f);
    TestTrue(TEXT("All internal entry points keep dead state"), Combat.IsDead());
    TestTrue(TEXT("Dead actor remains actionless"), Combat.GetCurrentAction() == EHWActionType::None);
    TestEqual(TEXT("No postmortem contact"), Fixture.Observer->ContactCount, 0);
    TestEqual(TEXT("No repeated death"), Fixture.Observer->DeathCount, 1);
    TestEqual(TEXT("No repeated action end"), Fixture.Observer->EndedCount, 1);
    TestEqual(TEXT("Dead action clock stays zero"), Combat.GetActionElapsed(), 0.f);
    TestEqual(TEXT("Dead stamina does not regenerate"), Combat.GetStamina(), StaminaAtDeath);
    TestFalse(TEXT("Dead actor is not invulnerable"), Combat.IsInvulnerable());
    TestFalse(TEXT("Dead actor cannot counter"), Combat.IsCounterActive());
    TestFalse(TEXT("Dead actor cannot jump"), Combat.IsJumping());
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWPlayerReentrantDeathTest,
    "Hwanghon.Combat.PlayerReentrantDeath",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWPlayerReentrantDeathTest::RunTest(const FString& Parameters)
{
    for (int32 Callback = 0; Callback < 4; ++Callback)
    {
        FHWPlayerTestWorld Fixture;
        if (!TestNotNull(TEXT("Transient player for callback"), Fixture.Combat))
        {
            return false;
        }
        UHWCombatComponent& Combat = *Fixture.Combat;
        Fixture.Observer->bKillOnDamage = Callback == 0;
        Fixture.Observer->bKillOnContact = Callback == 1;
        Fixture.Observer->bKillOnEnd = Callback == 2;
        Fixture.Observer->bKillOnStart = Callback == 3;
        Combat.RequestAttack();
        if (Callback != 3)
        {
            Combat.RequestAttack();
            if (Callback == 0)
            {
                Combat.ApplyIncomingDamage(1.f, EHWAttackTier::Break);
            }
            else
            {
                Fixture.Tick(Combat.Tuning->Attack1.Duration + 0.01f);
            }
        }
        const FString Context = FString::Printf(TEXT("Callback %d: "), Callback);
        TestTrue(Context + TEXT("death survives caller continuation"), Combat.IsDead());
        TestTrue(Context + TEXT("no action revived"), Combat.GetCurrentAction() == EHWActionType::None);
        TestEqual(Context + TEXT("one death event"), Fixture.Observer->DeathCount, 1);
        TestEqual(Context + TEXT("no reaction or queued combo started"), Fixture.Observer->StartedCount, 1);
        TestEqual(Context + TEXT("action ended once"), Fixture.Observer->EndedCount, 1);
        const int32 Contacts = Fixture.Observer->ContactCount;
        Fixture.Tick(10.f);
        TestEqual(Context + TEXT("no later contact"), Fixture.Observer->ContactCount, Contacts);
    }
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWPlayerLivingCombatPreservedTest,
    "Hwanghon.Combat.PlayerLivingCombatPreserved",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWPlayerLivingCombatPreservedTest::RunTest(const FString& Parameters)
{
    FHWPlayerTestWorld Fixture;
    if (!TestNotNull(TEXT("Living player combat"), Fixture.Combat))
    {
        return false;
    }
    UHWCombatComponent& Combat = *Fixture.Combat;
    Combat.RequestAttack();
    Combat.RequestAttack();
    Fixture.Tick(Combat.Tuning->Attack1.HitAt - 0.01f);
    TestEqual(TEXT("No contact before configured hit time"), Fixture.Observer->ContactCount, 0);
    Fixture.Tick(0.02f);
    TestEqual(TEXT("Contact at configured hit time"), Fixture.Observer->ContactCount, 1);
    Fixture.Tick(Combat.Tuning->Attack1.Duration);
    TestTrue(TEXT("Existing combo handoff remains direct"), Combat.GetCurrentAction() == EHWActionType::Attack2);
    TestEqual(TEXT("Combo starts exactly once"), Fixture.Observer->StartedCount, 2);
    Fixture.Tick(Combat.Tuning->Attack2.Duration);
    TestTrue(TEXT("Living combo ends normally"), Combat.GetCurrentAction() == EHWActionType::None);
    TestTrue(TEXT("Dodge still accepted"), Combat.RequestDodge());
    const float Health = Combat.GetHealth();
    TestFalse(TEXT("Dodge i-frame still rejects lethal damage"), Combat.ApplyIncomingDamage(Health * 2.f, EHWAttackTier::Break));
    TestEqual(TEXT("Invulnerable health unchanged"), Combat.GetHealth(), Health);
    Fixture.Tick(Combat.Tuning->Dodge.Duration);
    TestTrue(TEXT("Nonlethal hit still accepted"), Combat.ApplyIncomingDamage(1.f, EHWAttackTier::Stagger));
    TestTrue(TEXT("Living stagger reaction unchanged"), Combat.GetCurrentAction() == EHWActionType::Stagger);
    TestFalse(TEXT("Living actor remains alive"), Combat.IsDead());
    TestEqual(TEXT("No death event"), Fixture.Observer->DeathCount, 0);
    return true;
}

#endif
