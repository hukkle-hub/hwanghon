#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/AutomationTest.h"
#include "Boss/HWScriptedCanonRules.h"
#include "Boss/HWBossCharacter.h"
#include "Character/HWAinCharacter.h"
#include "Dom/JsonObject.h"
#include "Engine/World.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

// The Part 1 fight grammar (docs/design/150): only a band hit inside an opening moves the fight on.
namespace
{
    TSharedPtr<FJsonObject> ParseJson(const FString& Text)
    {
        TSharedPtr<FJsonObject> Obj;
        FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), Obj);
        return Obj;
    }

    struct FHWScriptWorld
    {
        UWorld* World = nullptr;
        AHWBossCharacter* Boss = nullptr;
        AHWAinCharacter* Ain = nullptr;
        UHWScriptedCanonRules* Rules = nullptr;

        explicit FHWScriptWorld(const FString& Script)
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
            if (!Boss || !Ain) return;
            Boss->DispatchBeginPlay();
            Ain->DispatchBeginPlay();
            Rules = NewObject<UHWScriptedCanonRules>(Boss, TEXT("CanonRules"));
            Rules->SetupCast(Ain, TMap<FName, AActor*>());
            Rules->Configure(ParseJson(Script));
            Rules->RegisterComponent();
        }
        ~FHWScriptWorld() { if (World) World->DestroyWorld(false); }

        void HitFrom(float DistanceCm)
        {
            Ain->SetActorLocation(FVector(-DistanceCm, 0.f, 0.f));
            Boss->ReceivePlayerHit(1.0e6f, EHWAttackTier::Light, Ain->GetActorLocation());
        }
        void Tick(float Seconds)
        {
            for (float T = 0.f; T < Seconds; T += 0.1f) Rules->TickComponent(0.1f, LEVELTICK_All, nullptr);
        }
    };
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWScriptedGrammarTest, "Hwanghon.Canon.Scripted.OnlyTheOpeningMovesIt",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FHWScriptedGrammarTest::RunTest(const FString& Parameters)
{
    FHWScriptWorld W(TEXT(R"({"band":[150,240],"guard":"deflect","walk_in_cm":100000,"patterns":[],
        "steps":[{"id":"a","open":"after:1","open_s":2.0,"needs":2,"then":"next"},
                 {"id":"b","open":"after:0.5","open_s":2.0,"needs":1,"then":"kill"}]})"));
    if (!TestNotNull(TEXT("boss"), W.Boss) || !TestNotNull(TEXT("rules"), W.Rules)) return false;
    const float Full = W.Boss->GetHealth();
    TestEqual(TEXT("two steps"), W.Rules->GetStepCount(), 2);

    W.HitFrom(200.f);
    TestEqual(TEXT("a band hit before the opening glances off (deflect)"), W.Boss->GetHealth(), Full);
    W.Tick(1.2f);
    TestTrue(TEXT("the opening comes at its time"), W.Rules->IsOpen());
    W.HitFrom(100.f);
    TestEqual(TEXT("inside the guard nothing lands, even in the opening"), W.Boss->GetHealth(), Full);
    W.HitFrom(320.f);
    TestEqual(TEXT("too far nothing lands"), W.Boss->GetHealth(), Full);
    W.HitFrom(200.f);
    TestEqual(TEXT("one of two needed hits does not move it on"), W.Rules->GetStepIndex(), 0);
    W.HitFrom(200.f);
    TestEqual(TEXT("the second band hit in the opening moves to the next step"), W.Rules->GetStepIndex(), 1);
    TestFalse(TEXT("'next' does not kill"), W.Boss->IsDead());

    W.Tick(0.7f);
    TestTrue(TEXT("the last step opens"), W.Rules->IsOpen());
    W.HitFrom(200.f);
    TestTrue(TEXT("its decisive cut kills"), W.Boss->IsDead());
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWScriptedOpenOnTest, "Hwanghon.Canon.Scripted.OpenOnTheNthMove",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FHWScriptedOpenOnTest::RunTest(const FString& Parameters)
{
    // EP26 L14376-L14406: three circles are watched, the fourth is taken.
    FHWScriptWorld W(TEXT(R"({"band":[150,240],"guard":"cut","walk_in_cm":100000,
        "patterns":[{"ko":"군도 원","clip":"Spin","tell":0.9}],
        "steps":[{"id":"memorize","open":"pattern:군도 원","open_on":4,"open_s":2.0,"needs":1,"then":"kill"}]})"));
    if (!TestNotNull(TEXT("rules"), W.Rules)) return false;
    FHWBossPatternSpec Circle;
    TestTrue(TEXT("the script's move is chosen"), W.Rules->ChoosePattern(*W.Boss, Circle));
    TestEqual(TEXT("it carries the novel's name"), Circle.DisplayName, FString(TEXT("군도 원")));
    W.Boss->StartCanonPattern(Circle);
    const FHWBossBeatSpec Beat = Circle.Beats[0];
    for (int32 N = 1; N <= 3; ++N)
    {
        TestFalse(*FString::Printf(TEXT("circle %d lands as written"), N), W.Rules->InterceptBeat(*W.Boss, Beat));
    }
    TestTrue(TEXT("the fourth circle is taken"), W.Rules->InterceptBeat(*W.Boss, Beat));
    TestTrue(TEXT("and opens the fight"), W.Rules->IsOpen());
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FHWStoryEpisodesDataTest, "Hwanghon.Story.Episodes.EveryFightParses",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FHWStoryEpisodesDataTest::RunTest(const FString& Parameters)
{
    FString Text;
    const FString Path = FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Data/story_episodes.json"));
    if (!TestTrue(TEXT("story_episodes.json loads"), FFileHelper::LoadFileToString(Text, *Path))) return false;
    const TSharedPtr<FJsonObject> Root = ParseJson(Text);
    const TSharedPtr<FJsonObject>* Episodes = nullptr;
    if (!TestTrue(TEXT("episodes object"), Root && Root->TryGetObjectField(TEXT("episodes"), Episodes))) return false;
    TestEqual(TEXT("all 28 episodes of Part 1"), (*Episodes)->Values.Num(), 28);
    int32 Fights = 0;
    for (const auto& Pair : (*Episodes)->Values)
    {
        const TArray<TSharedPtr<FJsonValue>>* Battles = nullptr;
        if (!Pair.Value->AsObject()->TryGetArrayField(TEXT("battles"), Battles)) continue;
        for (const TSharedPtr<FJsonValue>& V : *Battles)
        {
            const TSharedPtr<FJsonObject> B = V->AsObject();
            const FString Where = FString(Pair.Key) + TEXT(" ") + B->GetStringField(TEXT("first_scene"));
            UClass* Class = FindFirstObject<UClass>(*B->GetStringField(TEXT("rules")), EFindFirstObjectOptions::None);
            TestTrue(Where + TEXT(": rules class exists"), Class && Class->IsChildOf(UHWBossCanonRules::StaticClass()));
            const TSharedPtr<FJsonObject>* Script = nullptr;
            if (!B->TryGetObjectField(TEXT("script"), Script)) continue;
            UHWScriptedCanonRules* Rules = NewObject<UHWScriptedCanonRules>();
            Rules->Configure(*Script);
            TestEqual(Where + TEXT(": every step is read"), Rules->GetStepCount(), (*Script)->GetArrayField(TEXT("steps")).Num());
            TestTrue(Where + TEXT(": at least one step"), Rules->GetStepCount() > 0);
            ++Fights;
        }
    }
    TestTrue(TEXT("Part 1 fights are all scripted"), Fights >= 33);
    return true;
}

#endif
