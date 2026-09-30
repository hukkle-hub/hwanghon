#include "Game/HWStoryDirector.h"

#include "AssetRegistry/IAssetRegistry.h"
#include "Boss/HWBossCanonRules.h"
#include "Boss/HWBossCharacter.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Camera/HWLockOnComponent.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Dom/JsonObject.h"
#include "Engine/PostProcessVolume.h"
#include "Engine/StaticMesh.h"
#include "Engine/StaticMeshActor.h"
#include "EngineUtils.h"
#include "Game/HWStoryNpc.h"
#include "HHBossIntroDirector.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "LevelSequence.h"
#include "LevelSequenceActor.h"
#include "LevelSequencePlayer.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Progression/HWProfileSubsystem.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "System/HWCoopCombatSubsystem.h"
#include "System/HWPlayableCharacterVariants.h"
#include "UI/HWCombatHUD.h"
#include "UI/HWStoryHUD.h"
#include "WorldPartition/DataLayer/DataLayerInstance.h"
#include "WorldPartition/DataLayer/DataLayerManager.h"

namespace
{
    // The graybox stand-in of the boss body: the cinema shows it, the fight replaces it.
    const FName TagStandIn(TEXT("HW_BossStandIn"));

    TSharedPtr<FJsonObject> LoadJson(const TCHAR* Relative)
    {
        FString Raw;
        TSharedPtr<FJsonObject> Root;
        const FString Path = FPaths::Combine(FPaths::ProjectContentDir(), Relative);
        if (!FFileHelper::LoadFileToString(Raw, *Path) || !FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Raw), Root))
        {
            return nullptr;
        }
        return Root;
    }

    TArray<FName> Names(const TSharedPtr<FJsonObject>& O, const TCHAR* Field)
    {
        TArray<FName> Out;
        TArray<FString> S;
        if (O && O->TryGetStringArrayField(Field, S)) for (const FString& X : S) Out.Add(FName(*X));
        return Out;
    }

    FString MemberTag(const FString& Prefix, FName Id)
    {
        FString S = Id.ToString();
        if (!S.IsEmpty()) S[0] = FChar::ToUpper(S[0]);
        return Prefix + S + TEXT("Start");
    }
}

AHWStoryDirector::AHWStoryDirector()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.bTickEvenWhenPaused = false;
}

AHWAinCharacter* AHWStoryDirector::GetKain() const
{
    return Cast<AHWAinCharacter>(PartyActors.FindRef(TEXT("kain")));
}

void AHWStoryDirector::BeginPlay()
{
    Super::BeginPlay();

    // The arena review shoots the bare world; nothing may play over it.
    FString QA;
    if (FParse::Value(FCommandLine::Get(), TEXT("HWQA="), QA) && QA == TEXT("arenashow"))
    {
        bDisabled = true;
        SetActorTickEnabled(false);
        return;
    }

    // EPnn_* worlds name their episode.
    const FString Map = UWorld::RemovePIEPrefix(GetWorld()->GetMapName());
    if (Map.Len() >= 4 && Map.StartsWith(TEXT("EP")) && FChar::IsDigit(Map[2]) && FChar::IsDigit(Map[3]))
    {
        EpisodeId = FName(*Map.Left(4));
    }
    SequenceFolder = FString::Printf(TEXT("/Game/Hwanghon/Story/%s/Sequences"), *EpisodeId.ToString());

    FString Options;
    if (AGameModeBase* GM = GetWorld()->GetAuthGameMode())
    {
        Options = GM->OptionsString;
    }
    const FString StoryOption = UGameplayStatics::ParseOption(Options, TEXT("HWStory"));
    bStoryMode = StoryOption.IsEmpty() || StoryOption != TEXT("0");

    if (!LoadEpisode())
    {
        UE_LOG(LogTemp, Error, TEXT("[HWStory] %s: no scenes in the novel master"), *EpisodeId.ToString());
        bDisabled = true;
        SetActorTickEnabled(false);
        return;
    }

    // Start: the first scene; ?HWStoryStart=<SceneId>|Battle; boss mode starts at a fight (?HWBattle=<SceneId>).
    const FString Start = UGameplayStatics::ParseOption(Options, bStoryMode ? TEXT("HWStoryStart") : TEXT("HWBattle"));
    StartIndex = 0;
    const int32 FirstBattle = Battles.Num() > 0 ? Battles[0].SegmentIndex : INDEX_NONE;
    if ((!bStoryMode || Start == TEXT("Battle")) && FirstBattle != INDEX_NONE)
    {
        StartIndex = FirstBattle;
    }
    if (!Start.IsEmpty() && Start != TEXT("Battle"))
    {
        for (int32 I = 0; I < Segments.Num(); ++I)
        {
            if (Segments[I].SceneId.ToString() == Start || Segments[I].CoveredScenes.Contains(FName(*Start)))
            {
                StartIndex = I;
                break;
            }
        }
    }
    if (!bStoryMode && FirstBattle == INDEX_NONE)
    {
        bDisabled = true;   // an episode without a fight has no boss mode
        SetActorTickEnabled(false);
        return;
    }

    if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
    {
        EnableInput(PC);
        if (InputComponent)
        {
            for (const FKey& Key : { EKeys::SpaceBar, EKeys::Enter, EKeys::Escape, EKeys::Gamepad_FaceButton_Right, EKeys::Android_Back })
            {
                InputComponent->BindKey(Key, IE_Pressed, this, &AHWStoryDirector::SkipCurrent);
            }
        }
    }
    FString BattleList;
    for (const FHWStoryBattle& B : Battles) BattleList += FString::Printf(TEXT(" %s@%d"), *B.FirstScene.ToString(), B.SegmentIndex);
    UE_LOG(LogTemp, Display, TEXT("[HWStory] %s %s: %d segments, battles:%s, start=%d"),
        *EpisodeId.ToString(), bStoryMode ? TEXT("story") : TEXT("boss"), Segments.Num(), *BattleList, StartIndex);
}

bool AHWStoryDirector::LoadEpisodeConfig(TMap<FName, int32>& OutBattleByScene)
{
    // Content/Data/story_episodes.json (tools/story/build_story_episodes.py): the fights of each episode as the
    // novel stages them. An episode with no entry is animation only.
    const TSharedPtr<FJsonObject> Root = LoadJson(TEXT("Data/story_episodes.json"));
    const TSharedPtr<FJsonObject>* Episodes = nullptr;
    const TSharedPtr<FJsonObject>* Mine = nullptr;
    if (!Root || !Root->TryGetObjectField(TEXT("episodes"), Episodes) || !(*Episodes)->TryGetObjectField(EpisodeId.ToString(), Mine))
    {
        return false;
    }
    const TSharedPtr<FJsonObject>& E = *Mine;
    E->TryGetStringArrayField(TEXT("arena_locations"), ArenaLocations);
    FString Cam;
    if (E->TryGetStringField(TEXT("card_camera"), Cam)) CardCamera = FName(*Cam);
    E->TryGetStringField(TEXT("next_world"), NextWorld);
    const TArray<TSharedPtr<FJsonValue>>* List = nullptr;
    if (!E->TryGetArrayField(TEXT("battles"), List)) return true;
    for (const TSharedPtr<FJsonValue>& V : *List)
    {
        const TSharedPtr<FJsonObject> O = V->AsObject();
        FHWStoryBattle& B = Battles.AddDefaulted_GetRef();
        B.FirstScene = FName(*O->GetStringField(TEXT("first_scene")));
        O->TryGetStringField(TEXT("rules"), B.RulesClass);
        B.BossName = FText::FromString(O->GetStringField(TEXT("boss_ko")));
        double Scale = 1.0;
        if (O->TryGetNumberField(TEXT("boss_scale"), Scale)) B.BossScale = static_cast<float>(Scale);
        bool bSpawn = true;
        if (O->TryGetBoolField(TEXT("spawn_boss"), bSpawn)) B.bSpawnBoss = bSpawn;
        B.Party = Names(O, TEXT("party"));
        O->TryGetStringField(TEXT("prefix"), B.Prefix);
        FString BodyId, StaticPath;
        if (O->TryGetStringField(TEXT("body"), BodyId)) B.Body = FName(*BodyId);
        if (O->TryGetStringField(TEXT("body_static"), StaticPath)) B.StaticBody = FSoftObjectPath(StaticPath);
        FString Recover;
        if (O->TryGetStringField(TEXT("recover"), Recover)) B.Recover = FName(*Recover);
        double CScale = 0.035;
        if (O->TryGetNumberField(TEXT("crystal_scale"), CScale)) B.CrystalScale = static_cast<float>(CScale);
        FString RLine;
        if (O->TryGetStringField(TEXT("recover_line"), RLine)) B.RecoverLine = FText::FromString(RLine);
        const TSharedPtr<FJsonObject>* Calls = nullptr;
        if (O->TryGetObjectField(TEXT("callouts"), Calls))
        {
            for (const auto& Pair : (*Calls)->Values) B.Callouts.Add(FName(*Pair.Key), Pair.Value->AsString());
        }
        const TSharedPtr<FJsonObject>* LayerSpec = nullptr;
        if (O->TryGetObjectField(TEXT("layers"), LayerSpec))
        {
            B.LayersPre = Names(*LayerSpec, TEXT("pre"));
            B.LayersFight = Names(*LayerSpec, TEXT("fight"));
            B.LayersAfter = Names(*LayerSpec, TEXT("after"));
        }
        const TSharedPtr<FJsonObject>* ScriptObj = nullptr;
        if (O->TryGetObjectField(TEXT("script"), ScriptObj)) B.Script = *ScriptObj;
        OutBattleByScene.Add(B.FirstScene, Battles.Num() - 1);
    }
    return true;
}

bool AHWStoryDirector::LoadEpisode()
{
    const TSharedPtr<FJsonObject> Root = LoadJson(TEXT("Data/novel_game_master.json"));
    if (!Root) return false;

    TMap<FName, int32> BattleByScene;
    LoadEpisodeConfig(BattleByScene);

    TMap<FString, FString> LocationNames;
    for (const TSharedPtr<FJsonValue>& V : Root->GetArrayField(TEXT("locations")))
    {
        const TSharedPtr<FJsonObject> L = V->AsObject();
        LocationNames.Add(L->GetStringField(TEXT("LocationId")), L->GetStringField(TEXT("NameKo")));
    }
    for (const TSharedPtr<FJsonValue>& V : Root->GetArrayField(TEXT("episodes")))
    {
        const TSharedPtr<FJsonObject> E = V->AsObject();
        if (E->GetStringField(TEXT("EpisodeId")) == EpisodeId.ToString())
        {
            EpisodeTitle = FText::FromString(E->GetStringField(TEXT("TitleKo")));
        }
    }

    // Sequences are found by name: LS_<SceneId>_<anything> in the episode folder.
    TArray<FAssetData> SequenceAssets;
    IAssetRegistry& Registry = IAssetRegistry::GetChecked();
    if (!FPlatformProperties::RequiresCookedData())
    {
        Registry.ScanPathsSynchronous({ SequenceFolder }, false);
    }
    Registry.GetAssetsByPath(FName(*SequenceFolder), SequenceAssets, true);

    Segments.Reset();
    for (const TSharedPtr<FJsonValue>& V : Root->GetArrayField(TEXT("scenes")))
    {
        const TSharedPtr<FJsonObject> S = V->AsObject();
        if (S->GetStringField(TEXT("EpisodeId")) != EpisodeId.ToString())
        {
            continue;
        }
        TArray<FString> Modes;
        S->TryGetStringArrayField(TEXT("GameMode"), Modes);
        const FName SceneId(*S->GetStringField(TEXT("SceneId")));
        // A scene is played as a fight only when the episode config stages one there.
        const int32* BattleAt = BattleByScene.Find(SceneId);
        const bool bBattle = Modes.Contains(TEXT("BOSS_BATTLE"));
        if (bBattle && !BattleAt && Segments.Num() > 0 && Segments.Last().Kind == EHWStorySegmentKind::BossBattle)
        {
            Segments.Last().CoveredScenes.Add(SceneId);
            continue;
        }

        FHWStorySegment& Seg = Segments.AddDefaulted_GetRef();
        Seg.SceneId = SceneId;
        Seg.CoveredScenes.Add(SceneId);
        Seg.Kind = BattleAt ? EHWStorySegmentKind::BossBattle : EHWStorySegmentKind::Cinematic;
        Seg.Battle = BattleAt ? *BattleAt : INDEX_NONE;
        Seg.GameModes = Modes;
        Seg.LocationId = S->GetStringField(TEXT("Location"));
        const FString* LocName = LocationNames.Find(Seg.LocationId);
        Seg.LocationName = FText::FromString(LocName ? *LocName : Seg.LocationId);
        Seg.Summary = FText::FromString(S->GetStringField(TEXT("NovelSummary")));
        Seg.NovelSource = S->GetStringField(TEXT("NovelSource"));
        const FString Prefix = FString::Printf(TEXT("LS_%s_"), *SceneId.ToString());
        for (const FAssetData& A : SequenceAssets)
        {
            if (A.AssetName.ToString().StartsWith(Prefix))
            {
                Seg.Sequence = A.GetSoftObjectPath();
                break;
            }
        }
        if (BattleAt) Battles[*BattleAt].SegmentIndex = Segments.Num() - 1;
    }

    // Each fight's entry (the nearest BOSS_ENTRY before it) and result (the nearest BOSS_RESULT after it).
    for (int32 BI = 0; BI < Battles.Num(); ++BI)
    {
        FHWStoryBattle& B = Battles[BI];
        if (B.SegmentIndex == INDEX_NONE)
        {
            UE_LOG(LogTemp, Error, TEXT("[HWStory] battle %s: scene not in %s"), *B.FirstScene.ToString(), *EpisodeId.ToString());
            continue;
        }
        const int32 Prev = BI > 0 ? Battles[BI - 1].SegmentIndex : -1;
        const int32 Next = BI + 1 < Battles.Num() && Battles[BI + 1].SegmentIndex != INDEX_NONE ? Battles[BI + 1].SegmentIndex : Segments.Num();
        for (int32 I = B.SegmentIndex - 1; I > Prev; --I)
        {
            if (Segments[I].GameModes.Contains(TEXT("BOSS_ENTRY"))) { B.EntryIndex = I; break; }
        }
        for (int32 I = B.SegmentIndex + 1; I < Next; ++I)
        {
            if (Segments[I].GameModes.Contains(TEXT("BOSS_RESULT"))) { B.ResultIndex = I; break; }
        }
    }
    Battles.RemoveAll([](const FHWStoryBattle& B) { return B.SegmentIndex == INDEX_NONE; });
    for (FHWStorySegment& S : Segments) S.Battle = INDEX_NONE;
    for (int32 BI = 0; BI < Battles.Num(); ++BI) Segments[Battles[BI].SegmentIndex].Battle = BI;
    return Segments.Num() > 0;
}

void AHWStoryDirector::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (bDisabled) return;

    if (!bStarted)
    {
        bStarted = true;
        if (AHWStoryHUD* HUD = GetStoryHUD())
        {
            HUD->GetOverlay()->OnSkip = [this]() { SkipCurrent(); };
            if (UHWCombatHUDWidget* Combat = HUD->GetCombatWidget())
            {
                Combat->SetStoryOwnsOutcome(bStoryMode);
            }
        }
        // The fight's people are in the place before it (EP01: Kain half a step behind her).
        const int32 B = BattleForSegment(StartIndex);
        if (Battles.IsValidIndex(B)) SpawnParty(Battles[B]);
        StartSegment(StartIndex);
        return;
    }
    PhaseElapsed += DeltaSeconds;
    TickSever();

    const FHWStoryBattle* Cur = Battles.IsValidIndex(CurrentBattle) ? &Battles[CurrentBattle] : nullptr;
    // Data Layer cells stream in a frame or more after activation: keep the stand-in hidden once the fight owns the arena.
    if (Phase == EHWStoryPhase::Handoff || Phase == EHWStoryPhase::BossIntro || Phase == EHWStoryPhase::Battle
        || Phase == EHWStoryPhase::BattleOver || (Phase == EHWStoryPhase::Cinematic && Cur && SegmentIndex == Cur->ResultIndex))
    {
        SetStandInsHidden(true);
    }

    switch (Phase)
    {
    case EHWStoryPhase::Cinematic:
        if (SequencePlayer)
        {
            // The body is gone when the novel says it turns to dust (the after layer flips in the same sequence).
            if (Cur && SegmentIndex == Cur->ResultIndex && Boss && SequencePlayer->GetCurrentTime().AsSeconds() >= 3.f)
            {
                Boss->SetActorHiddenInGame(true);
            }
            if (PhaseElapsed > 0.2f && !SequencePlayer->IsPlaying())
            {
                EndSegment();
            }
        }
        else if (PhaseElapsed >= CardSeconds)
        {
            EndSegment();
        }
        break;
    case EHWStoryPhase::Handoff:
        if (PhaseElapsed >= HandoffBlendSeconds)
        {
            EnterBattleControl();
        }
        break;
    case EHWStoryPhase::BossIntro:
        if (PhaseElapsed >= BossIntroTimeoutSeconds)
        {
            UE_LOG(LogTemp, Warning, TEXT("[HWStory] boss intro did not finish in %.0f s - cut"), BossIntroTimeoutSeconds);
            if (IntroDirector && IntroDirector->bIntroPlaying) IntroDirector->ForceFinishBossIntro();
            else HandleBossIntroFinished(NAME_None);
        }
        break;
    case EHWStoryPhase::BattleOver:
        if (PendingTimer >= 0.f && PhaseElapsed >= PendingTimer)
        {
            PendingTimer = -1.f;
            if (!bStoryMode)
            {
                break;   // boss mode: the combat HUD shows the result
            }
            if (Ain && Ain->GetCombat() && Ain->GetCombat()->IsDead())
            {
                // Retry the fight, not the episode: the animation before it is not replayed.
                const FString Retry = Cur ? Cur->FirstScene.ToString() : FString(TEXT("Battle"));
                UGameplayStatics::OpenLevel(this, FName(*UGameplayStatics::GetCurrentLevelName(this)), true, TEXT("HWStoryStart=") + Retry);
                break;
            }
            if (Ain && Ain->GetLockOn()) Ain->GetLockOn()->ClearTarget();
            if (Crystal && !bCrystalRecovered)
            {
                BeginRecover();
                break;
            }
            SetPlayerControl(false);
            StartSegment(Cur && Cur->ResultIndex != INDEX_NONE ? Cur->ResultIndex : SegmentIndex + 1);
        }
        break;
    case EHWStoryPhase::Recover:
        if (bCrystalRecovered && PhaseElapsed >= 1.4f)
        {
            SetPlayerControl(false);
            if (AHWStoryHUD* HUD = GetStoryHUD()) HUD->GetOverlay()->SetPrompt(FText::GetEmpty(), nullptr);
            StartSegment(Cur && Cur->ResultIndex != INDEX_NONE ? Cur->ResultIndex : SegmentIndex + 1);
        }
        break;
    case EHWStoryPhase::Finished:
        if (bStoryMode && !bQA && PhaseElapsed >= 6.f)
        {
            SetActorTickEnabled(false);
            // Each episode's end opens the next (production master §0: the end flags are the next one's entry).
            UGameplayStatics::OpenLevel(this, FName(*(NextWorld.IsEmpty() ? ExitMap : NextWorld)));
        }
        break;
    default:
        break;
    }
}

int32 AHWStoryDirector::BattleForSegment(int32 Index) const
{
    // The fight a scene belongs to: the next one at or after it, else the last one before it.
    for (int32 BI = 0; BI < Battles.Num(); ++BI)
    {
        if (Battles[BI].SegmentIndex >= Index) return BI;
    }
    return Battles.Num() - 1;
}

AHWStoryDirector::EArenaState AHWStoryDirector::BattleStateAt(const FHWStoryBattle& B, int32 Index, bool bAtEnd) const
{
    if (!bStoryMode) return Index >= B.SegmentIndex && Index <= FMath::Max(B.SegmentIndex, B.ResultIndex) ? EArenaState::Fight : EArenaState::PreBattle;
    if (Index == B.EntryIndex) return bAtEnd ? EArenaState::Fight : EArenaState::PreBattle;   // the entry sequence turns it
    if (Index < B.SegmentIndex) return EArenaState::PreBattle;
    if (Index == B.SegmentIndex) return EArenaState::Fight;
    if (B.ResultIndex != INDEX_NONE && Index < B.ResultIndex) return EArenaState::Fight;
    if (Index == B.ResultIndex) return bAtEnd ? EArenaState::After : EArenaState::Fight;       // the result sequence turns it
    return EArenaState::After;
}

void AHWStoryDirector::ApplyLayers(int32 Index, bool bAtEnd)
{
    UDataLayerManager* LayerManager = UDataLayerManager::GetDataLayerManager(GetWorld());
    if (!LayerManager || Battles.IsEmpty()) return;
    TMap<FString, bool> Want;
    for (const FHWStoryBattle& B : Battles)
    {
        const EArenaState S = BattleStateAt(B, Index, bAtEnd);
        for (const FName& L : B.LayersPre) Want.Add(L.ToString(), S == EArenaState::PreBattle);
        for (const FName& L : B.LayersFight) Want.Add(L.ToString(), S == EArenaState::Fight);
        for (const FName& L : B.LayersAfter) Want.Add(L.ToString(), S == EArenaState::After);
    }
    LayerManager->ForEachDataLayerInstance([&](UDataLayerInstance* I)
    {
        if (const bool* On = Want.Find(I->GetDataLayerShortName()))   // layers no fight names stay as authored
        {
            LayerManager->SetDataLayerInstanceRuntimeState(I, *On ? EDataLayerRuntimeState::Activated : EDataLayerRuntimeState::Unloaded);
        }
        return true;
    });
}

void AHWStoryDirector::StartSegment(int32 Index)
{
    if (!Segments.IsValidIndex(Index))
    {
        FinishEpisode();
        return;
    }
    SegmentIndex = Index;
    PhaseElapsed = 0.f;
    const FHWStorySegment& S = Segments[Index];
    ApplyLayers(Index, false);

    if (S.Kind == EHWStorySegmentKind::BossBattle)
    {
        BeginBattle(false);
        return;
    }

    Phase = EHWStoryPhase::Cinematic;
    CurrentBattle = BattleForSegment(Index);
    const bool bInArena = ArenaLocations.Contains(S.LocationId);
    const FHWStoryBattle* Cur = Battles.IsValidIndex(CurrentBattle) ? &Battles[CurrentBattle] : nullptr;
    if (Cur && Index == Cur->ResultIndex && Boss)
    {
        // The result cinema is staged at the spawn point (its cameras are placed there): the body is laid there
        // under the cut, facing where the fight left it.
        if (const AActor* Spot = FindMarker(Cur->Prefix + TEXT("BossSpawn")))
        {
            FVector At = Spot->GetActorLocation();
            At.Z = Boss->GetActorLocation().Z;
            Boss->SetActorLocation(At, false, nullptr, ETeleportType::TeleportPhysics);
        }
    }
    PlaceCast(bInArena);   // they are in the place during its scenes; elsewhere the arena is not on screen
    SetPlayerControl(false);

    AHWStoryHUD* HUD = GetStoryHUD();
    if (HUD)
    {
        HUD->SetCombatVisible(false);
        HUD->GetOverlay()->SetProgress(FText::FromString(FString::Printf(TEXT("%s  %d / %d"),
            *EpisodeId.ToString(), Index + 1, Segments.Num())));
    }

    if (ULevelSequence* Seq = Cast<ULevelSequence>(S.Sequence.TryLoad()))
    {
        FMovieSceneSequencePlaybackSettings Settings;
        Settings.bPauseAtEnd = true;   // hold the last frame: the handoff blends from it
        Settings.bDisableMovementInput = true;
        Settings.bDisableLookAtInput = true;
        ALevelSequenceActor* OutActor = nullptr;
        SequencePlayer = ULevelSequencePlayer::CreateLevelSequencePlayer(GetWorld(), Seq, Settings, OutActor);
        SequenceActor = OutActor;
        if (SequencePlayer)
        {
            SequencePlayer->Play();
        }
    }

    if (HUD)
    {
        if (SequencePlayer)
        {
            HUD->GetOverlay()->ShowCinema(FText::FromString(FString::Printf(TEXT("%s · %s"),
                *S.SceneId.ToString(), *S.LocationName.ToString())));
        }
        else
        {
            // No animation yet for this scene: its novel card, so the order and the text are already the real ones.
            HUD->GetOverlay()->ShowCard(
                FText::FromString(FString::Printf(TEXT("%s · %s"), *S.SceneId.ToString(), *S.LocationName.ToString())),
                S.Summary,
                FText::FromString(S.NovelSource),
                !bInArena);
        }
    }
    if (!SequencePlayer && bInArena)
    {
        if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
        {
            if (ACameraActor* Cam = FindCamera(FName(*((Cur ? Cur->Prefix : FString()) + CardCamera.ToString()))))
            {
                PC->SetViewTarget(Cam);
            }
            else if (ACameraActor* Any = FindCamera(CardCamera))
            {
                PC->SetViewTarget(Any);
            }
        }
    }
    Emit(SequencePlayer ? TEXT("sequence") : TEXT("card"));
}

void AHWStoryDirector::EndSegment()
{
    const int32 Index = SegmentIndex;
    APlayerController* PC = GetWorld()->GetFirstPlayerController();
    FMinimalViewInfo POV;
    const bool bHavePOV = PC && PC->PlayerCameraManager;
    if (bHavePOV)
    {
        POV = PC->PlayerCameraManager->GetCameraCacheView();
    }
    if (SequencePlayer)
    {
        SequencePlayer->Stop();
        SequencePlayer = nullptr;
    }
    if (SequenceActor)
    {
        SequenceActor->Destroy();
        SequenceActor = nullptr;
    }
    ApplyLayers(Index, true);
    const FHWStoryBattle* Cur = Battles.IsValidIndex(CurrentBattle) ? &Battles[CurrentBattle] : nullptr;
    if (Cur && Index == Cur->ResultIndex && Boss)
    {
        Boss->SetActorHiddenInGame(true);
    }

    const bool bNextIsBattle = Segments.IsValidIndex(Index + 1) && Segments[Index + 1].Kind == EHWStorySegmentKind::BossBattle;
    if (bNextIsBattle)
    {
        // Hold exactly the frame the cinema ended on, then blend from it into the camera behind Ain.
        if (bHavePOV)
        {
            FActorSpawnParameters Params;
            Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
            HandoffCamera = GetWorld()->SpawnActor<ACameraActor>(POV.Location, POV.Rotation, Params);
            if (HandoffCamera)
            {
                HandoffCamera->GetCameraComponent()->SetFieldOfView(POV.FOV);
                HandoffCamera->GetCameraComponent()->bConstrainAspectRatio = false;
                PC->SetViewTarget(HandoffCamera);
            }
        }
        SegmentIndex = Index + 1;
        BeginBattle(true);
        return;
    }
    StartSegment(Index + 1);
}

void AHWStoryDirector::SkipCurrent()
{
    if (Phase == EHWStoryPhase::Cinematic && PhaseElapsed > 0.15f)
    {
        Emit(TEXT("skip"));
        EndSegment();
    }
    else if (Phase == EHWStoryPhase::BossIntro && PhaseElapsed > 0.15f && IntroDirector)
    {
        Emit(TEXT("skip"));
        IntroDirector->ForceFinishBossIntro();
    }
}

void AHWStoryDirector::BeginBattle(bool bFromCinema)
{
    Phase = bFromCinema ? EHWStoryPhase::Handoff : EHWStoryPhase::Battle;
    PhaseElapsed = 0.f;
    CurrentBattle = Segments[SegmentIndex].Battle;
    const FHWStoryBattle& B = Battles[CurrentBattle];
    ApplyLayers(SegmentIndex, false);
    SetStandInsHidden(true);
    SpawnParty(B);
    PlaceCast(true);
    bCrystalRecovered = false;

    // A new fight gets its own body (EP03: the plaza's shield-bearer, then the one on the track).
    if (Boss)
    {
        Boss->Destroy();
        Boss = nullptr;
        Rules = nullptr;
    }
    if (B.bSpawnBoss)
    {
        const AActor* Spot = FindMarker(B.Prefix + TEXT("BossSpawn"));
        FVector Location = Spot ? Spot->GetActorLocation() : FVector(300.f, 0.f, 5.f);
        Location.Z += 110.f * B.BossScale;
        const FVector AinAt = Ain ? Ain->GetActorLocation() : FVector::ZeroVector;
        const FRotator Facing(0.f, (AinAt - Location).Rotation().Yaw, 0.f);
        FActorSpawnParameters Params;
        Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
        Boss = GetWorld()->SpawnActor<AHWBossCharacter>(AHWBossCharacter::StaticClass(), Location, Facing, Params);
        if (Boss)
        {
            Boss->SetActorScale3D(FVector(B.BossScale));
            if (!B.Body.IsNone())
            {
                Boss->WearBody(B.Body);
            }
            else if (UStaticMesh* Rigid = Cast<UStaticMesh>(B.StaticBody.TryLoad()))
            {
                Boss->WearStaticBody(Rigid);
            }
            Boss->OnBossDied.AddUniqueDynamic(this, &AHWStoryDirector::HandleBossDied);
            Boss->SpawnDefaultController();   // the rules may walk it in
        }
    }
    // The novel's rules for this fight (docs/design/138, 150-...).
    UClass* RulesClass = B.RulesClass.IsEmpty() ? nullptr : FindFirstObject<UClass>(*B.RulesClass, EFindFirstObjectOptions::None);
    if (RulesClass && RulesClass->IsChildOf(UHWBossCanonRules::StaticClass()))
    {
        AActor* RulesOwner = Boss ? static_cast<AActor*>(Boss) : static_cast<AActor*>(this);
        Rules = NewObject<UHWBossCanonRules>(RulesOwner, RulesClass, TEXT("CanonRules"));
        TMap<FName, AActor*> Cast_;
        for (const auto& Pair : PartyActors) Cast_.Add(Pair.Key, Pair.Value.Get());
        Rules->SetupCast(Ain, Cast_);
        if (B.Script.IsValid()) Rules->Configure(B.Script);
        Rules->SetLive(!bFromCinema);   // held through the handoff blend (EnterBattleControl lets it go)
        Rules->OnCanonBeat.AddDynamic(this, &AHWStoryDirector::HandleCanonBeat);
        Rules->RegisterComponent();
    }
    else if (!B.RulesClass.IsEmpty())
    {
        UE_LOG(LogTemp, Error, TEXT("[HWStory] rules class %s not found"), *B.RulesClass);
    }

    if (AHWStoryHUD* HUD = GetStoryHUD())
    {
        if (UHWCombatHUDWidget* Combat = HUD->GetCombatWidget()) Combat->SetBossName(B.BossName);
        HUD->GetOverlay()->ShowHandoff();
    }
    APlayerController* PC = GetWorld()->GetFirstPlayerController();
    if (PC && Ain && Boss)
    {
        const FRotator Look = (Boss->GetActorLocation() - Ain->GetActorLocation()).Rotation();
        PC->SetControlRotation(FRotator(FMath::Clamp(Look.Pitch, -25.f, 25.f), Look.Yaw, 0.f));
        if (UHWLockOnComponent* Lock = Ain->GetLockOn())
        {
            if (!Lock->IsLocked()) Lock->ToggleLockOn();
        }
    }
    if (StartBossIntro(B, bFromCinema))
    {
        return;   // the intro hands the camera back and starts the fight (HandleBossIntroFinished)
    }
    if (PC && Ain)
    {
        if (bFromCinema && HandoffCamera)
        {
            PC->SetViewTargetWithBlend(Ain, HandoffBlendSeconds, VTBlend_Cubic);
            Emit(TEXT("handoff"));
        }
        else
        {
            PC->SetViewTarget(Ain);
            EnterBattleControl();
        }
    }
}

void AHWStoryDirector::EnterBattleControl()
{
    Phase = EHWStoryPhase::Battle;
    PhaseElapsed = 0.f;
    if (HandoffCamera)
    {
        HandoffCamera->Destroy();
        HandoffCamera = nullptr;
    }
    SetPlayerControl(true);
    if (Rules) Rules->SetLive(true);
    if (AHWStoryHUD* HUD = GetStoryHUD())
    {
        HUD->GetOverlay()->HideAll();
        HUD->SetCombatVisible(true);
    }
    if (Ain && Ain->GetCombat())
    {
        Ain->GetCombat()->OnDied.AddUniqueDynamic(this, &AHWStoryDirector::HandlePlayerDied);
    }
    Emit(TEXT("battle"));
}

void AHWStoryDirector::EndBattle(float Pause)
{
    if (Phase != EHWStoryPhase::Battle) return;
    Phase = EHWStoryPhase::BattleOver;
    PhaseElapsed = 0.f;
    PendingTimer = Pause;
}

void AHWStoryDirector::SpawnParty(const FHWStoryBattle& B)
{
    for (const FName& Id : B.Party)
    {
        if (PartyActors.Contains(Id)) continue;
        const AActor* Spot = FindMarker(MemberTag(B.Prefix, Id));
        const AActor* BossSpot = FindMarker(B.Prefix + TEXT("BossSpawn"));
        FVector Location = Spot ? Spot->GetActorLocation() : FVector(-400.f, 120.f * (PartyActors.Num() + 1), 5.f);
        Location.Z += 100.f;
        const float Yaw = BossSpot ? (BossSpot->GetActorLocation() - Location).Rotation().Yaw : 0.f;
        FActorSpawnParameters Params;
        Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
        UClass* Class = Id == TEXT("kain") ? AHWKainCharacter::StaticClass()
            : Id == TEXT("ryu") ? AHWRyuCharacter::StaticClass()
            : Id == TEXT("sera") ? AHWSeraCharacter::StaticClass()
            : AHWStoryNpc::StaticClass();
        APawn* Member = GetWorld()->SpawnActor<APawn>(Class, Location, FRotator(0.f, Yaw, 0.f), Params);
        if (!Member) continue;
        Member->Tags.Add(FName(*(TEXT("Party_") + Id.ToString())));
        if (AHWStoryNpc* Npc = Cast<AHWStoryNpc>(Member)) Npc->NpcId = Id;
        if (!Member->GetController()) Member->SpawnDefaultController();
        // The fight is Ain's; companions are not threat targets for the boss.
        if (AHWAinCharacter* Hero = Cast<AHWAinCharacter>(Member))
        {
            if (UHWCoopCombatSubsystem* Coop = GetWorld()->GetSubsystem<UHWCoopCombatSubsystem>())
            {
                Coop->UnregisterCombatant(Hero);
            }
        }
        PartyActors.Add(Id, Member);
    }
}

void AHWStoryDirector::PlaceCast(bool bVisible)
{
    APlayerController* PC = GetWorld()->GetFirstPlayerController();
    Ain = PC ? Cast<AHWAinCharacter>(PC->GetPawn()) : nullptr;
    const FHWStoryBattle* Cur = Battles.IsValidIndex(CurrentBattle) ? &Battles[CurrentBattle] : nullptr;
    const FString Prefix = Cur ? Cur->Prefix : FString();
    const AActor* BossSpot = FindMarker(Prefix + TEXT("BossSpawn"));
    auto Put = [&](AActor* Who, const AActor* Spot, float HalfHeight)
    {
        if (!Who) return;
        if (Spot)
        {
            FVector Location = Spot->GetActorLocation();
            Location.Z += HalfHeight + 2.f;
            const float Yaw = BossSpot ? (BossSpot->GetActorLocation() - Location).Rotation().Yaw : Spot->GetActorRotation().Yaw;
            Who->SetActorLocationAndRotation(Location, FRotator(0.f, Yaw, 0.f), false, nullptr, ETeleportType::TeleportPhysics);
        }
        Who->SetActorHiddenInGame(!bVisible);
    };
    if (Ain) Put(Ain, FindMarker(Prefix + TEXT("AinStart")), Ain->GetCapsuleComponent()->GetScaledCapsuleHalfHeight());
    for (const auto& Pair : PartyActors)
    {
        ACharacter* C = Cast<ACharacter>(Pair.Value.Get());
        const bool bInFight = Cur && Cur->Party.Contains(Pair.Key);
        if (!C) continue;
        if (!bInFight) { C->SetActorHiddenInGame(true); continue; }
        Put(C, FindMarker(MemberTag(Prefix, Pair.Key)), C->GetCapsuleComponent()->GetScaledCapsuleHalfHeight());
    }
}

void AHWStoryDirector::HandleCanonBeat(FName Beat)
{
    const FHWStoryBattle* Cur = Battles.IsValidIndex(CurrentBattle) ? &Battles[CurrentBattle] : nullptr;
    // The novel's own lines at the moments they are said (line numbers in story_episodes.json).
    if (Cur)
    {
        if (const FString* Word = Cur->Callouts.Find(Beat)) Callout(*Word);
    }
    if (Beat == TEXT("sever") || Beat == TEXT("decisive"))
    {
        BeginSever();
    }
    if (Beat == TEXT("battle_end"))
    {
        EndBattle(1.2f);   // a fight the novel ends without a death (retreat, containment, a phase that moves on)
    }
    Emit(FName(*(TEXT("canon_") + Beat.ToString())));
}

void AHWStoryDirector::Callout(const FString& Text)
{
    if (AHWStoryHUD* HUD = GetStoryHUD())
    {
        if (UHWCombatHUDWidget* Combat = HUD->GetCombatWidget()) Combat->ShowCallout(Text);
    }
}

void AHWStoryDirector::BeginSever()
{
    UWorld* World = GetWorld();
    SeverRealStart = World->GetRealTimeSeconds();
    UGameplayStatics::SetGlobalTimeDilation(this, 0.25f);

    // Saturation bursts, the swing's trail breaks into pieces (fringe) — EP01 L547-L549.
    SeverPost = World->SpawnActor<APostProcessVolume>(APostProcessVolume::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator);
    if (SeverPost)
    {
        SeverPost->bUnbound = true;
        SeverPost->Priority = 100.f;
        SeverPost->BlendWeight = 0.f;
        FPostProcessSettings& S = SeverPost->Settings;
        S.bOverride_ColorSaturation = true;
        S.ColorSaturation = FVector4(1.45f, 1.45f, 1.45f, 1.f);   // 1.75 blew the lit ceiling out to yellow
        S.bOverride_ColorContrast = true;
        S.ColorContrast = FVector4(1.15f, 1.15f, 1.15f, 1.f);
        S.bOverride_SceneFringeIntensity = true;
        S.SceneFringeIntensity = 2.5f;
    }
    DropCrystal();
}

void AHWStoryDirector::DropCrystal()
{
    // The joint's crystal falls out of the cut (EP01 L563-L567: thumbnail-sized; EP03 L3416: a fist).
    const FHWStoryBattle* Cur = Battles.IsValidIndex(CurrentBattle) ? &Battles[CurrentBattle] : nullptr;
    if (!Boss || Crystal || !Cur || Cur->Recover != TEXT("crystal")) return;
    FVector At = Boss->GetActorLocation() + FVector(0.f, 0.f, 60.f);
    for (const TCHAR* Bone : { TEXT("mixamorig_RightForeArm"), TEXT("mixamorig_LeftForeArm") })
    {
        if (Boss->GetMesh() && Boss->GetMesh()->DoesSocketExist(Bone))
        {
            At = Boss->GetMesh()->GetSocketLocation(Bone);
            break;
        }
    }
    FActorSpawnParameters Params;
    Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    Crystal = GetWorld()->SpawnActor<AStaticMeshActor>(AStaticMeshActor::StaticClass(), At, FRotator(45.f, 30.f, 45.f), Params);
    if (!Crystal) return;
    UStaticMeshComponent* Mesh = Crystal->GetStaticMeshComponent();
    Mesh->SetMobility(EComponentMobility::Movable);
    Mesh->SetStaticMesh(LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube")));
    Crystal->SetActorScale3D(FVector(Cur->CrystalScale));
    if (UMaterialInterface* Base = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial")))
    {
        UMaterialInstanceDynamic* Mid = UMaterialInstanceDynamic::Create(Base, Crystal);
        Mid->SetVectorParameterValue(TEXT("Color"), FLinearColor(1.f, 0.42f, 0.06f));
        Mesh->SetMaterial(0, Mid);
    }
    Mesh->SetCollisionProfileName(TEXT("PhysicsActor"));
    Mesh->SetSimulatePhysics(true);
    UPointLightComponent* Glow = NewObject<UPointLightComponent>(Crystal, TEXT("CrystalGlow"));
    Glow->SetupAttachment(Mesh);
    Glow->RegisterComponent();
    Glow->SetIntensity(12.f);   // small: the light pool is what the eye finds
    Glow->SetAttenuationRadius(220.f);
    Glow->SetLightColor(FLinearColor(1.f, 0.45f, 0.1f));
    Crystal->Tags.Add(TEXT("Story_Crystal"));
}

void AHWStoryDirector::TickSever()
{
    if (SeverRealStart < 0.0) return;
    const float T = static_cast<float>(GetWorld()->GetRealTimeSeconds() - SeverRealStart);
    if (SeverPost)
    {
        SeverPost->BlendWeight = T < 0.15f ? T / 0.15f : (T > 1.0f ? FMath::Max(0.f, 1.f - (T - 1.0f) / 0.2f) : 1.f);
    }
    if (T >= 1.2f)
    {
        UGameplayStatics::SetGlobalTimeDilation(this, 1.f);
        if (SeverPost) SeverPost->Destroy();
        SeverPost = nullptr;
        SeverRealStart = -1.0;
    }
}

void AHWStoryDirector::BeginRecover()
{
    Phase = EHWStoryPhase::Recover;
    PhaseElapsed = 0.f;
    SetPlayerControl(true);   // she walks to it
    if (Ain)
    {
        Ain->OnLocalInteract.Remove(InteractHandle);
        InteractHandle = Ain->OnLocalInteract.AddWeakLambda(this, [this]() { TryRecoverCrystal(); });
    }
    if (AHWStoryHUD* HUD = GetStoryHUD())
    {
        HUD->GetOverlay()->SetPrompt(NSLOCTEXT("HWStory", "TakeCrystal", "결정 — 낫 끝으로 건드려 받는다  [G]"),
            [this]() { TryRecoverCrystal(); });
    }
    Emit(TEXT("recover"));
}

bool AHWStoryDirector::TryRecoverCrystal()
{
    if (Phase != EHWStoryPhase::Recover || bCrystalRecovered || !Crystal || !Ain) return false;
    const float Distance = FVector::Dist2D(Ain->GetActorLocation(), Crystal->GetActorLocation());
    if (Distance > CrystalReachCm)
    {
        Callout(TEXT("낫 하나 길이."));   // 제1부 통합본 L2067
        Emit(TEXT("crystal_too_far"));
        return false;
    }
    bCrystalRecovered = true;
    PhaseElapsed = 0.f;
    Crystal->Destroy();
    Crystal = nullptr;
    Ain->OnLocalInteract.Remove(InteractHandle);
    const FHWStoryBattle* Cur = Battles.IsValidIndex(CurrentBattle) ? &Battles[CurrentBattle] : nullptr;
    if (AHWStoryHUD* HUD = GetStoryHUD()) HUD->GetOverlay()->SetPrompt(FText::GetEmpty(), nullptr);
    if (Cur && !Cur->RecoverLine.IsEmpty()) Callout(Cur->RecoverLine.ToString());   // the text's own line, or none
    Emit(TEXT("crystal_recovered"));
    return true;
}

void AHWStoryDirector::HandleBossDied(AHWBossCharacter* DeadBoss)
{
    if (Phase != EHWStoryPhase::Battle || DeadBoss != Boss) return;
    DropCrystal();   // a fight that ends without the slow sever still leaves its crystal
    EndBattle(1.8f);
    Emit(TEXT("boss_died"));
}

void AHWStoryDirector::HandlePlayerDied()
{
    if (Phase != EHWStoryPhase::Battle) return;
    EndBattle(2.5f);
    Emit(TEXT("player_died"));
}

void AHWStoryDirector::FinishEpisode()
{
    Phase = EHWStoryPhase::Finished;
    PhaseElapsed = 0.f;
    SetPlayerControl(false);
    if (bStoryMode)
    {
        WriteEpisodeFlags();
    }
    if (AHWStoryHUD* HUD = GetStoryHUD())
    {
        HUD->SetCombatVisible(false);
        HUD->GetOverlay()->ShowEnd(FText::FromString(FString::Printf(TEXT("%s  %s"), *EpisodeId.ToString(), *EpisodeTitle.ToString())));
    }
    Emit(TEXT("finished"));
}

void AHWStoryDirector::WriteEpisodeFlags()
{
    // The production master's end-of-episode SaveFlags, novel-corrected (tools/story/build_part1_saveflags.py, doc 143/144).
    const TSharedPtr<FJsonObject> Root = LoadJson(TEXT("Data/part1_saveflags.json"));
    const TSharedPtr<FJsonObject>* Episodes = nullptr;
    const TSharedPtr<FJsonObject>* Mine = nullptr;
    if (!Root || !Root->TryGetObjectField(TEXT("episodes"), Episodes) || !(*Episodes)->TryGetObjectField(EpisodeId.ToString(), Mine))
    {
        UE_LOG(LogTemp, Error, TEXT("[HWStory] saveflags: no entry for %s"), *EpisodeId.ToString());
        return;
    }
    TMap<FName, FString> Flags;
    FString Line;
    for (const auto& Pair : (*Mine)->Values)
    {
        Flags.Add(FName(*Pair.Key), Pair.Value->AsString());
        Line += FString::Printf(TEXT(" %s=%s"), *Pair.Key, *Pair.Value->AsString());
    }
    UHWProfileSubsystem* Profile = GetGameInstance() ? GetGameInstance()->GetSubsystem<UHWProfileSubsystem>() : nullptr;
    const bool bSaved = !bQA && Profile && Profile->SetStoryFlags(Flags);
    UE_LOG(LogTemp, Display, TEXT("[HWStory] saveflags %s (%s):%s"), *EpisodeId.ToString(),
        bQA ? TEXT("QA, not written") : (bSaved ? TEXT("saved") : TEXT("save failed")), *Line);
}

void AHWStoryDirector::SetStandInsHidden(bool bHide)
{
    for (TActorIterator<AActor> It(GetWorld()); It; ++It)
    {
        if (It->Tags.Contains(TagStandIn) && It->IsHidden() != bHide)
        {
            It->SetActorHiddenInGame(bHide);
            It->SetActorEnableCollision(!bHide);
        }
    }
}

void AHWStoryDirector::SetPlayerControl(bool bEnabled)
{
    APlayerController* PC = GetWorld()->GetFirstPlayerController();
    if (!PC) return;
    if (bEnabled)
    {
        DisableInput(PC);   // the skip keys must not eat Space/Enter in the fight
        if (Ain) Ain->EnableInput(PC);
        PC->SetInputMode(FInputModeGameOnly());
        PC->SetShowMouseCursor(false);
    }
    else
    {
        EnableInput(PC);
        if (Ain)
        {
            Ain->DisableInput(PC);
            Ain->GetCharacterMovement()->StopMovementImmediately();
        }
        FInputModeGameAndUI Mode;
        Mode.SetHideCursorDuringCapture(false);
        PC->SetInputMode(Mode);
        PC->SetShowMouseCursor(true);
    }
}

ACameraActor* AHWStoryDirector::FindCamera(FName Tag) const
{
    for (TActorIterator<ACameraActor> It(GetWorld()); It; ++It)
    {
        if (It->Tags.Contains(Tag)) return *It;
    }
    return nullptr;
}

AActor* AHWStoryDirector::FindTagged(FName Tag) const
{
    for (TActorIterator<AActor> It(GetWorld()); It; ++It)
    {
        if (It->Tags.Contains(Tag)) return *It;
    }
    return nullptr;
}

AActor* AHWStoryDirector::FindMarker(const FString& Name) const
{
    return FindTagged(FName(*Name));
}

AHWStoryHUD* AHWStoryDirector::GetStoryHUD() const
{
    APlayerController* PC = GetWorld()->GetFirstPlayerController();
    AHWStoryHUD* HUD = PC ? Cast<AHWStoryHUD>(PC->GetHUD()) : nullptr;
    return HUD && HUD->GetOverlay() ? HUD : nullptr;
}

void AHWStoryDirector::Emit(FName Event)
{
    const FName Scene = Segments.IsValidIndex(SegmentIndex) ? Segments[SegmentIndex].SceneId : NAME_None;
    UE_LOG(LogTemp, Display, TEXT("[HWStory] %s %s"), *Event.ToString(), *Scene.ToString());
    OnStoryEvent.Broadcast(Event, Scene);
}

bool AHWStoryDirector::StartBossIntro(const FHWStoryBattle& B, bool bFromCinema)
{
    IntroDirector = Cast<AHHBossIntroDirector>(FindTagged(FName(*(B.Prefix + TEXT("BossIntro")))));
    if (!IntroDirector || !Boss) return false;

    // The fight waits: rules not live, boss held (HH_BossIntroBegin), Ain's hands off, the combat HUD away -
    // v10: no title card, no bars; the place and the body say who this is, the HUD names it after the handback.
    Phase = EHWStoryPhase::BossIntro;
    PhaseElapsed = 0.f;
    if (Rules) Rules->SetLive(false);
    Boss->SetIntroHold(true);
    SetPlayerControl(false);
    if (AHWStoryHUD* HUD = GetStoryHUD())
    {
        HUD->GetOverlay()->HideAll();
        HUD->SetCombatVisible(false);
    }
    IntroDirector->BossActor = Boss;
    IntroDirector->OnIntroFinished.AddUniqueDynamic(this, &AHWStoryDirector::HandleBossIntroFinished);
    // A retry, or a boss met before (EP03's two Clave fights): the short version - same beats, shorter holds.
    // After a boss-entry Level Sequence (EP01 SC015 shows the awakening for 9.5 s) the entrance is not told twice at length.
    const bool bAfterEntrySequence = bFromCinema && Segments.IsValidIndex(SegmentIndex - 1) && !Segments[SegmentIndex - 1].Sequence.IsNull();
    const bool bShort = !bFromCinema || bAfterEntrySequence || IntroDirector->Tags.Contains(TEXT("HW_IntroShort"));
    Emit(bShort ? TEXT("bossintro_short") : TEXT("bossintro"));
    IntroDirector->StartBossIntro(bShort);
    return true;
}

void AHWStoryDirector::HandleBossIntroFinished(FName IntroBossId)
{
    if (Phase != EHWStoryPhase::BossIntro) return;
    if (IntroDirector) IntroDirector->OnIntroFinished.RemoveDynamic(this, &AHWStoryDirector::HandleBossIntroFinished);
    if (Boss) Boss->SetIntroHold(false);
    if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
    {
        if (Ain && PC->GetViewTarget() != Ain) PC->SetViewTarget(Ain);   // cut or timed out: the director did not hand back
    }
    EnterBattleControl();
}
