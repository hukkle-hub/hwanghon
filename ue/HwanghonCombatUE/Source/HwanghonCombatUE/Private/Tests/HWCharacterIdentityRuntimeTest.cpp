#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/AutomationTest.h"
#include "Boss/HWBossCharacter.h"
#include "Camera/HWLockOnComponent.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Combat/HWCombatTuningAsset.h"
#include "Engine/World.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "System/HWCoopCombatSubsystem.h"
#include "System/HWCharacterKitComponent.h"

// v2.4: the sheet numbers must show up in a live pawn, not only in the profile table. Each character is
// spawned next to a boss and measured through the production paths (combat clock, lock-on contact,
// boss HP, coop threat, incoming damage).
namespace
{
    struct FHWIdentityMeasure
    {
        float MaxHealth = 0.f;
        float WalkSpeed = 0.f;
        float Attack1Damage = 0.f;
        float ContactSeconds = -1.f;
        float BossHpLoss = 0.f;
        float Threat = 0.f;
        float IncomingLoss = 0.f;
    };

    bool Measure(FAutomationTestBase& Test, FName Id, FHWIdentityMeasure& Out)
    {
        FWorldContext& Context = GEngine->CreateNewWorldContext(EWorldType::Game);
        UWorld::InitializationValues Init;
        Init.InitializeScenes(true).AllowAudioPlayback(false).RequiresHitProxies(false).CreatePhysicsScene(true)
            .CreateNavigation(false).CreateAISystem(false).ShouldSimulatePhysics(false).SetTransactional(false);
        UWorld* World = UWorld::CreateWorld(EWorldType::Game, false, NAME_None, nullptr, true, ERHIFeatureLevel::Num, &Init, false);
        if (!World) return false;
        Context.SetCurrentWorld(World);
        World->InitializeActorsForPlay(FURL());
        FActorSpawnParameters P;
        P.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
        AHWBossCharacter* Boss = World->SpawnActor<AHWBossCharacter>(FVector::ZeroVector, FRotator::ZeroRotator, P);
        AHWAinCharacter* Player = World->SpawnActor<AHWAinCharacter>(FVector(150.f, 0.f, 0.f), FRotator(0.f, 180.f, 0.f), P);
        bool bOk = Boss && Player;
        if (bOk)
        {
            Boss->DispatchBeginPlay();
            Player->DispatchBeginPlay();
            Player->SetSystemCharacterId(Id == TEXT("ain") ? FName(TEXT("kain")) : Id);   // force a reconfigure
            Player->SetSystemCharacterId(Id);
            UHWCombatComponent* Combat = Player->GetCombat();
            UHWCoopCombatSubsystem* Coop = World->GetSubsystem<UHWCoopCombatSubsystem>();
            if (Coop) Coop->RegisterCombatant(Player, Id);
            Player->GetLockOn()->ToggleLockOn();
            bOk = Test.TestTrue(*FString::Printf(TEXT("%s locks the boss"), *Id.ToString()), Player->GetLockOn()->GetTarget() == Boss);

            Out.MaxHealth = Combat->GetMaxHealth();
            Out.WalkSpeed = Player->GetCharacterMovement()->MaxWalkSpeed;
            Out.Attack1Damage = Combat->Tuning->Attack1.Damage;

            const float BossHp = Boss->GetHealth();
            Combat->RequestAttack();
            constexpr float Step = 1.f / 240.f;
            for (float T = Step; T < 2.f && bOk; T += Step)
            {
                Combat->TickComponent(Step, LEVELTICK_All, nullptr);
                if (Boss->GetHealth() < BossHp)
                {
                    Out.ContactSeconds = T;
                    break;
                }
            }
            Out.BossHpLoss = BossHp - Boss->GetHealth();
            if (Coop)
            {
                for (const FHWCoopCombatantView& V : Coop->GetCombatants())
                {
                    if (V.Character == Player) Out.Threat = V.Threat;
                }
            }
            Combat->TickComponent(2.f, LEVELTICK_All, nullptr);   // finish the swing
            const float Hp = Combat->GetHealth();
            Combat->ApplyIncomingDamage(10000.f, EHWAttackTier::Light);
            Out.IncomingLoss = Hp - Combat->GetHealth();
        }
        GEngine->DestroyWorldContext(World);
        World->DestroyWorld(false);
        return bOk;
    }
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWCharacterIdentityRuntimeTest,
    "Hwanghon.System.CharacterIdentity.Runtime",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWCharacterIdentityRuntimeTest::RunTest(const FString& Parameters)
{
    TMap<FName, FHWIdentityMeasure> M;
    for (const TCHAR* Id : { TEXT("ain"), TEXT("kain"), TEXT("ryu"), TEXT("sera") })
    {
        FHWIdentityMeasure R;
        if (!Measure(*this, Id, R)) return false;
        AddInfo(FString::Printf(TEXT("[identity] %s hp=%.0f walk=%.0f atk1=%.1f contact=%.4fs bossLoss=%.1f threat=%.1f threat/loss=%.3f incoming10000=%.1f"),
            Id, R.MaxHealth, R.WalkSpeed, R.Attack1Damage, R.ContactSeconds, R.BossHpLoss, R.Threat,
            R.BossHpLoss > 0.f ? R.Threat / R.BossHpLoss : 0.f, R.IncomingLoss));
        TestTrue(FString::Printf(TEXT("%s basic attack lands"), Id), R.ContactSeconds > 0.f && R.BossHpLoss > 0.f);
        M.Add(Id, R);
    }
    const FHWIdentityMeasure &Ain = M[TEXT("ain")], &Kain = M[TEXT("kain")], &Ryu = M[TEXT("ryu")], &Sera = M[TEXT("sera")];
    TestTrue(TEXT("HP: Kain > Ain > Ryu > Sera"), Kain.MaxHealth > Ain.MaxHealth && Ain.MaxHealth > Ryu.MaxHealth && Ryu.MaxHealth > Sera.MaxHealth);
    TestTrue(TEXT("Basic attack damage: Kain > Ain > Ryu > Sera"), Kain.Attack1Damage > Ain.Attack1Damage && Ain.Attack1Damage > Ryu.Attack1Damage && Ryu.Attack1Damage > Sera.Attack1Damage);
    TestTrue(TEXT("Attack clock: Ryu < Ain < Sera < Kain"), Ryu.ContactSeconds < Ain.ContactSeconds && Ain.ContactSeconds < Sera.ContactSeconds && Sera.ContactSeconds < Kain.ContactSeconds);
    TestTrue(TEXT("Move speed: Ryu > Ain > Sera > Kain"), Ryu.WalkSpeed > Ain.WalkSpeed && Ain.WalkSpeed > Sera.WalkSpeed && Sera.WalkSpeed > Kain.WalkSpeed);
    // min(25%, DEF/(DEF+5000)) like server/raid.cjs: Kain (2960) and Ain (1780) both sit on the 25% cap.
    TestNearlyEqual(TEXT("DEF cut: Kain and Ain on the 25% cap"), Kain.IncomingLoss, 7500.f, 1.f);
    TestNearlyEqual(TEXT("DEF cut: Ain on the 25% cap"), Ain.IncomingLoss, 7500.f, 1.f);
    TestTrue(TEXT("DEF cut: Sera < cap, Ryu takes most"), Ain.IncomingLoss < Sera.IncomingLoss && Sera.IncomingLoss < Ryu.IncomingLoss);
    TestNearlyEqual(TEXT("Kain threat is x1.25 of its damage"), Kain.Threat / FMath::Max(1.f, Kain.BossHpLoss), 1.25f, 0.01f);
    TestNearlyEqual(TEXT("Ain threat is x1 of its damage"), Ain.Threat / FMath::Max(1.f, Ain.BossHpLoss), 1.f, 0.01f);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHWSeraWardRuntimeTest,
    "Hwanghon.System.CharacterIdentity.SeraWard",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FHWSeraWardRuntimeTest::RunTest(const FString& Parameters)
{
    // Sera Skill4 on live pawns: a nearby ally is healed 15% and guarded 50%; one 30 m away is not.
    FWorldContext& Context = GEngine->CreateNewWorldContext(EWorldType::Game);
    UWorld::InitializationValues Init;
    Init.InitializeScenes(true).AllowAudioPlayback(false).RequiresHitProxies(false).CreatePhysicsScene(true)
        .CreateNavigation(false).CreateAISystem(false).ShouldSimulatePhysics(false).SetTransactional(false);
    UWorld* World = UWorld::CreateWorld(EWorldType::Game, false, NAME_None, nullptr, true, ERHIFeatureLevel::Num, &Init, false);
    if (!TestNotNull(TEXT("World"), World)) return false;
    Context.SetCurrentWorld(World);
    World->InitializeActorsForPlay(FURL());
    FActorSpawnParameters P;
    P.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    AHWAinCharacter* Sera = World->SpawnActor<AHWAinCharacter>(FVector::ZeroVector, FRotator::ZeroRotator, P);
    AHWAinCharacter* Near = World->SpawnActor<AHWAinCharacter>(FVector(200.f, 0.f, 0.f), FRotator::ZeroRotator, P);
    AHWAinCharacter* Far = World->SpawnActor<AHWAinCharacter>(FVector(3000.f, 0.f, 0.f), FRotator::ZeroRotator, P);
    bool bOk = TestTrue(TEXT("Three pawns"), Sera && Near && Far);
    if (bOk)
    {
        UHWCoopCombatSubsystem* Coop = World->GetSubsystem<UHWCoopCombatSubsystem>();
        const TPair<AHWAinCharacter*, FName> Party[] = { { Sera, TEXT("sera") }, { Near, TEXT("kain") }, { Far, TEXT("ryu") } };
        for (const auto& M : Party)
        {
            M.Key->DispatchBeginPlay();
            M.Key->SetSystemCharacterId(M.Value);
            if (Coop) Coop->RegisterCombatant(M.Key, M.Value);
            M.Key->GetCombat()->UseNeutralCharacterModifiers();   // measure the ward, not DEF
            M.Key->GetCombat()->ApplyIncomingDamage(M.Key->GetCombat()->GetMaxHealth() * 0.5f, EHWAttackTier::Light);
            M.Key->GetCombat()->TickComponent(3.f, LEVELTICK_All, nullptr);   // leave the hit reaction
        }
        const float NearHp = Near->GetCombat()->GetHealth(), FarHp = Far->GetCombat()->GetHealth();
        bOk = TestTrue(TEXT("Sera Skill4 activates"), Sera->GetCharacterKit()->RequestSkill4());
        const float NearMax = Near->GetCombat()->GetMaxHealth();
        AddInfo(FString::Printf(TEXT("[ward] near kain +%.0f (15%% = %.0f), far ryu +%.0f"),
            Near->GetCombat()->GetHealth() - NearHp, NearMax * 0.15f, Far->GetCombat()->GetHealth() - FarHp));
        TestNearlyEqual(TEXT("Nearby ally healed 15%"), Near->GetCombat()->GetHealth() - NearHp, NearMax * 0.15f, 1.f);
        TestEqual(TEXT("Far ally not healed"), Far->GetCombat()->GetHealth(), FarHp);
        const float Before = Near->GetCombat()->GetHealth();
        Near->GetCombat()->ApplyIncomingDamage(1000.f, EHWAttackTier::Light);
        AddInfo(FString::Printf(TEXT("[ward] near ally takes %.0f of 1000 inside the ward"), Before - Near->GetCombat()->GetHealth()));
        TestNearlyEqual(TEXT("Nearby ally guarded 50%"), Before - Near->GetCombat()->GetHealth(), 500.f, 1.f);
    }
    GEngine->DestroyWorldContext(World);
    World->DestroyWorld(false);
    return bOk;
}

#endif
