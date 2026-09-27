#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/AutomationTest.h"
#include "Tests/HWBossLifecycleTestObserver.h"
#include "Boss/HWBossCharacter.h"
#include "Camera/HWLockOnComponent.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Engine/EngineBaseTypes.h"
#include "Engine/World.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "UObject/StrongObjectPtr.h"

// Keep deterministic pattern setup out of the gameplay API.
struct FHWBossLifecycleTestAccess
{
    static void BeginStrike(AHWBossCharacter& Boss, AHWAinCharacter& Player, const FHWBossPatternSpec& Pattern)
    {
        Boss.TargetPlayer = &Player;
        Boss.BeginPattern(Pattern);
        Boss.BeginStrike();
    }

    static float LungeRemaining(const AHWBossCharacter& Boss) { return Boss.LungeRemaining; }
    static float HitStopRemaining(const AHWBossCharacter& Boss) { return Boss.HitStopRemaining; }
    static int32 NextBeatIndex(const AHWBossCharacter& Boss) { return Boss.NextBeatIndex; }

    static void TryRestart(AHWBossCharacter& Boss, const FHWBossPatternSpec& Pattern)
    {
        Boss.BeginPattern(Pattern);
        Boss.BeginStrike();
        Boss.BeginRecover();
        Boss.FinishRecover();
    }
};

namespace
{
    struct FHWBossTestWorld
    {
        UWorld* World = nullptr;
        AHWBossCharacter* Boss = nullptr;
        AHWAinCharacter* Player = nullptr;
        TStrongObjectPtr<UHWBossLifecycleTestObserver> Observer;

        FHWBossTestWorld()
            : Observer(NewObject<UHWBossLifecycleTestObserver>())
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

            FActorSpawnParameters SpawnParameters;
            SpawnParameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
            Boss = World->SpawnActor<AHWBossCharacter>(FVector::ZeroVector, FRotator::ZeroRotator, SpawnParameters);
            Player = World->SpawnActor<AHWAinCharacter>(FVector(150.f, 0.f, 0.f), FRotator::ZeroRotator, SpawnParameters);
            if (!Boss || !Player)
            {
                return;
            }

            Boss->DispatchBeginPlay();
            Player->DispatchBeginPlay();
            Observer->Boss = Boss;
            Boss->OnBossDied.AddDynamic(Observer.Get(), &UHWBossLifecycleTestObserver::HandleDeath);
            Boss->OnBossStateChanged.AddDynamic(Observer.Get(), &UHWBossLifecycleTestObserver::HandleState);
            Boss->OnBossReaction.AddDynamic(Observer.Get(), &UHWBossLifecycleTestObserver::HandleReaction);
            Player->GetCombat()->OnDamaged.AddDynamic(Observer.Get(), &UHWBossLifecycleTestObserver::HandlePlayerDamaged);
        }

        ~FHWBossTestWorld()
        {
            if (World)
            {
                World->DestroyWorld(false);
            }
        }
    };

    FHWBossPatternSpec MakeTwoBeatPattern(bool bCounterFirstBeat)
    {
        FHWBossPatternSpec Pattern;
        Pattern.Id = TEXT("LifecycleTest");
        Pattern.StrikeDuration = 0.2f;
        Pattern.LungeDistanceCm = 30.f;
        Pattern.LungeDuration = 0.5f;
        FHWBossBeatSpec Beat;
        Beat.At = 0.f;
        Beat.Damage = 100.f;
        Beat.RangeCm = 1000.f;
        Beat.bCounterable = bCounterFirstBeat;
        Pattern.Beats.Add(Beat);
        Beat.bCounterable = false;
        Pattern.Beats.Add(Beat);
        return Pattern;
    }
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWBossDeathLifecycleTest,
    "Hwanghon.Combat.BossDeathLifecycle",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWBossDeathLifecycleTest::RunTest(const FString& Parameters)
{
    FHWBossTestWorld Fixture;
    if (!TestNotNull(TEXT("Transient boss"), Fixture.Boss)
        || !TestNotNull(TEXT("Transient player"), Fixture.Player))
    {
        return false;
    }

    const FHWBossPatternSpec Pattern = MakeTwoBeatPattern(false);
    AHWBossCharacter& Boss = *Fixture.Boss;
    FHWBossLifecycleTestAccess::BeginStrike(Boss, *Fixture.Player, Pattern);
    UHWLockOnComponent* LockOn = Fixture.Player->GetLockOn();
    LockOn->ToggleLockOn();
    TestTrue(TEXT("Living boss can be locked"), LockOn->IsLocked());
    TestTrue(TEXT("Lock selects this encounter boss"), LockOn->GetTarget() == &Boss);
    Boss.GetCharacterMovement()->Velocity = FVector(200.f, 0.f, 0.f);
    Boss.ApplyHitStop(0.2f);
    const float PlayerHealth = Fixture.Player->GetCombat()->GetHealth();

    Boss.ReceivePlayerHit(Boss.GetHealth() + 100.f, EHWAttackTier::Break, FVector::ZeroVector);
    TestTrue(TEXT("Lethal damage commits Dead"), Boss.IsDead());
    TestEqual(TEXT("Health clamps to zero"), Boss.GetHealth(), 0.f);
    TestEqual(TEXT("Death delegate fires once including reentrant damage"), Fixture.Observer->DeathCount, 1);
    TestTrue(TEXT("Observer sees committed death"), Fixture.Observer->bDeadWhenNotified);
    TestEqual(TEXT("Dead state notification once"), Fixture.Observer->DeadStateCount, 1);
    TestEqual(TEXT("Lethal hit does not play a hit reaction"), Fixture.Observer->ReactionCount, 0);
    TestEqual(TEXT("All beats canceled"), FHWBossLifecycleTestAccess::NextBeatIndex(Boss), Pattern.Beats.Num());
    TestEqual(TEXT("Lunge canceled"), FHWBossLifecycleTestAccess::LungeRemaining(Boss), 0.f);
    TestEqual(TEXT("Hit stop cleared"), FHWBossLifecycleTestAccess::HitStopRemaining(Boss), 0.f);
    TestTrue(TEXT("Velocity cleared"), Boss.GetVelocity().IsNearlyZero());
    TestTrue(TEXT("Movement disabled"), Boss.GetCharacterMovement()->MovementMode == MOVE_None);
    TestFalse(TEXT("Dead boss no longer blocks collision"), Boss.GetActorEnableCollision());
    TestFalse(TEXT("Dead boss removed from lock-on candidates"), Boss.ActorHasTag(TEXT("LockOnTarget")));
    TestFalse(TEXT("Existing lock clears immediately on death"), LockOn->IsLocked());
    TestNull(TEXT("Dead target hidden from callers before next camera tick"), LockOn->GetTarget());

    const FVector DeathLocation = Boss.GetActorLocation();
    Boss.ReceivePlayerHit(200.f, EHWAttackTier::Stagger, FVector::ZeroVector);
    Boss.ApplyHitStop(2.f);
    FHWBossLifecycleTestAccess::TryRestart(Boss, Pattern);
    Boss.Tick(2.f);
    TestTrue(TEXT("Death remains terminal after every transition entry point"), Boss.IsDead());
    TestEqual(TEXT("Repeated hits do not repeat death"), Fixture.Observer->DeathCount, 1);
    TestEqual(TEXT("Repeated hits do not emit reactions"), Fixture.Observer->ReactionCount, 0);
    TestEqual(TEXT("Dead boss ignores hit stop"), FHWBossLifecycleTestAccess::HitStopRemaining(Boss), 0.f);
    TestTrue(TEXT("Dead boss does not move"), Boss.GetActorLocation().Equals(DeathLocation));
    TestEqual(TEXT("Dead boss cannot damage player"), Fixture.Player->GetCombat()->GetHealth(), PlayerHealth);

    AHWBossCharacter* NextBoss = Fixture.World->SpawnActor<AHWBossCharacter>(FVector(800.f, 0.f, 0.f), FRotator::ZeroRotator);
    if (TestNotNull(TEXT("Next lock-on candidate spawns"), NextBoss))
    {
        LockOn->ToggleLockOn();
        TestTrue(TEXT("One toggle acquires a new target after old target died"), LockOn->GetTarget() == NextBoss);
        NextBoss->Tags.Remove(TEXT("LockOnTarget"));
        LockOn->TickComponent(0.01f, LEVELTICK_All, nullptr);
        NextBoss->Tags.Add(TEXT("LockOnTarget"));
        TestFalse(TEXT("Tick discards invalid lock even without a player controller"), LockOn->IsLocked());
    }
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWBossCounterCancelsQueuedBeatsTest,
    "Hwanghon.Combat.BossCounterCancelsQueuedBeats",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWBossCounterCancelsQueuedBeatsTest::RunTest(const FString& Parameters)
{
    FHWBossTestWorld Fixture;
    if (!TestNotNull(TEXT("Transient boss"), Fixture.Boss)
        || !TestNotNull(TEXT("Transient player"), Fixture.Player))
    {
        return false;
    }

    const FHWBossPatternSpec Pattern = MakeTwoBeatPattern(true);
    FHWBossLifecycleTestAccess::BeginStrike(*Fixture.Boss, *Fixture.Player, Pattern);
    TestTrue(TEXT("Counter is accepted"), Fixture.Player->GetCombat()->RequestCounter());
    const float PlayerHealth = Fixture.Player->GetCombat()->GetHealth();

    // Both beats and the recovery boundary are due in this one update.
    Fixture.Boss->Tick(0.25f);
    TestTrue(TEXT("Counter interruption survives the strike update"), Fixture.Boss->GetBossState() == EHWBossState::Stagger);
    TestEqual(TEXT("No queued beat damages the player"), Fixture.Player->GetCombat()->GetHealth(), PlayerHealth);
    TestEqual(TEXT("No damage delegate after counter"), Fixture.Observer->PlayerDamageCount, 0);
    TestEqual(TEXT("Counter cancels lunge"), FHWBossLifecycleTestAccess::LungeRemaining(*Fixture.Boss), 0.f);
    TestEqual(TEXT("Counter consumes all pending beats"), FHWBossLifecycleTestAccess::NextBeatIndex(*Fixture.Boss), Pattern.Beats.Num());
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWBossReentrantDeathTest,
    "Hwanghon.Combat.BossReentrantDeath",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWBossReentrantDeathTest::RunTest(const FString& Parameters)
{
    {
        FHWBossTestWorld Fixture;
        if (!TestNotNull(TEXT("Transient boss for reaction callback"), Fixture.Boss))
        {
            return false;
        }
        Fixture.Observer->bKillOnReaction = true;
        Fixture.Boss->ReceivePlayerHit(1.f, EHWAttackTier::Break, FVector::ZeroVector);
        TestTrue(TEXT("Reaction callback death cannot be overwritten by Break"), Fixture.Boss->IsDead());
        TestEqual(TEXT("Reentrant reaction emits death once"), Fixture.Observer->DeathCount, 1);
        TestEqual(TEXT("Lethal callback does not emit another reaction"), Fixture.Observer->ReactionCount, 1);
    }

    {
        FHWBossTestWorld Fixture;
        if (!TestNotNull(TEXT("Transient boss for player damage callback"), Fixture.Boss)
            || !TestNotNull(TEXT("Transient player for damage callback"), Fixture.Player))
        {
            return false;
        }
        const FHWBossPatternSpec Pattern = MakeTwoBeatPattern(false);
        FHWBossLifecycleTestAccess::BeginStrike(*Fixture.Boss, *Fixture.Player, Pattern);
        Fixture.Observer->bKillOnPlayerDamage = true;
        const float PlayerHealth = Fixture.Player->GetCombat()->GetHealth();
        Fixture.Boss->Tick(0.25f);
        TestTrue(TEXT("Death during player damage is terminal"), Fixture.Boss->IsDead());
        TestEqual(TEXT("Only the first beat damages the player"), Fixture.Player->GetCombat()->GetHealth(), PlayerHealth - 100.f);
        TestEqual(TEXT("No second queued damage callback"), Fixture.Observer->PlayerDamageCount, 1);
        TestEqual(TEXT("Death during strike emitted once"), Fixture.Observer->DeathCount, 1);
    }
    return true;
}

#endif
