#include "Game/HWStoryDirector.h"

#include "AssetRegistry/IAssetRegistry.h"
#include "Boss/HWBossCharacter.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Camera/HWLockOnComponent.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Components/CapsuleComponent.h"
#include "Dom/JsonObject.h"
#include "EngineUtils.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "LevelSequence.h"
#include "LevelSequenceActor.h"
#include "LevelSequencePlayer.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "UI/HWCombatHUD.h"
#include "UI/HWStoryHUD.h"
#include "WorldPartition/DataLayer/DataLayerInstance.h"
#include "WorldPartition/DataLayer/DataLayerManager.h"

namespace
{
    const FName TagAinStart(TEXT("AinStart"));
    const FName TagBossSpawn(TEXT("BossSpawn"));
    // The graybox stand-in of the boss body (DL_Phase1): the cinema shows it, the fight replaces it.
    const FName TagStandIn(TEXT("HW_BossStandIn"));
    const FName CardCamera(TEXT("CAM_Entry_Wide"));
}

AHWStoryDirector::AHWStoryDirector()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.bTickEvenWhenPaused = false;
    BossName = NSLOCTEXT("HWStory", "Ep01Boss", "훈련용 짚단 허수아비");
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

    FString Options;
    if (AGameModeBase* GM = GetWorld()->GetAuthGameMode())
    {
        Options = GM->OptionsString;
    }
    const FString StoryOption = UGameplayStatics::ParseOption(Options, TEXT("HWStory"));
    bStoryMode = StoryOption.IsEmpty() || StoryOption != TEXT("0");

    if (!LoadEpisode() || BattleIndex == INDEX_NONE)
    {
        UE_LOG(LogTemp, Error, TEXT("[HWStory] %s: no scenes or no boss battle in the novel master"), *EpisodeId.ToString());
        bDisabled = true;
        SetActorTickEnabled(false);
        return;
    }

    const FString Start = UGameplayStatics::ParseOption(Options, TEXT("HWStoryStart"));
    StartIndex = 0;
    if (!bStoryMode || Start == TEXT("Battle"))
    {
        StartIndex = BattleIndex;
    }
    else if (!Start.IsEmpty())
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
    UE_LOG(LogTemp, Display, TEXT("[HWStory] %s %s: %d segments, entry=%d battle=%d result=%d, start=%d"),
        *EpisodeId.ToString(), bStoryMode ? TEXT("story") : TEXT("boss"), Segments.Num(), EntryIndex, BattleIndex, ResultIndex, StartIndex);
}

bool AHWStoryDirector::LoadEpisode()
{
    FString Raw;
    const FString Path = FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Data/novel_game_master.json"));
    TSharedPtr<FJsonObject> Root;
    if (!FFileHelper::LoadFileToString(Raw, *Path) || !FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Raw), Root) || !Root)
    {
        return false;
    }

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
        const bool bBattle = Modes.Contains(TEXT("BOSS_BATTLE"));
        if (bBattle && Segments.Num() > 0 && Segments.Last().Kind == EHWStorySegmentKind::BossBattle)
        {
            Segments.Last().CoveredScenes.Add(SceneId);
            continue;
        }

        FHWStorySegment& Seg = Segments.AddDefaulted_GetRef();
        Seg.SceneId = SceneId;
        Seg.CoveredScenes.Add(SceneId);
        Seg.Kind = bBattle ? EHWStorySegmentKind::BossBattle : EHWStorySegmentKind::Cinematic;
        Seg.GameMode = Modes.Num() > 0 ? Modes[0] : FString();
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

        const int32 Index = Segments.Num() - 1;
        if (bBattle && BattleIndex == INDEX_NONE) BattleIndex = Index;
        if (Modes.Contains(TEXT("BOSS_ENTRY")) && EntryIndex == INDEX_NONE) EntryIndex = Index;
        if (Modes.Contains(TEXT("BOSS_RESULT")) && ResultIndex == INDEX_NONE) ResultIndex = Index;
    }
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
                Combat->SetBossName(BossName);
            }
        }
        StartSegment(StartIndex);
        return;
    }
    PhaseElapsed += DeltaSeconds;

    // Data Layer cells stream in a frame or more after activation: keep the stand-in hidden once the fight owns the arena.
    if (Phase == EHWStoryPhase::Handoff || Phase == EHWStoryPhase::Battle || Phase == EHWStoryPhase::BattleOver
        || (Phase == EHWStoryPhase::Cinematic && SegmentIndex == ResultIndex))
    {
        SetStandInsHidden(true);
    }

    switch (Phase)
    {
    case EHWStoryPhase::Cinematic:
        if (SequencePlayer)
        {
            // The body is gone when the novel says it turns to dust (DL_Aftermath flips in the same sequence).
            if (SegmentIndex == ResultIndex && Boss && SequencePlayer->GetCurrentTime().AsSeconds() >= 3.f)
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
                UGameplayStatics::OpenLevel(this, FName(*UGameplayStatics::GetCurrentLevelName(this)), true, TEXT("HWStoryStart=Battle"));
                break;
            }
            SetPlayerControl(false);
            if (Ain && Ain->GetLockOn()) Ain->GetLockOn()->ClearTarget();
            StartSegment(ResultIndex != INDEX_NONE ? ResultIndex : BattleIndex + 1);
        }
        break;
    case EHWStoryPhase::Finished:
        if (bStoryMode && !bQA && PhaseElapsed >= 6.f)
        {
            SetActorTickEnabled(false);
            UGameplayStatics::OpenLevel(this, FName(*ExitMap));
        }
        break;
    default:
        break;
    }
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
    SetArenaState(StateAtStart(Index));

    if (S.Kind == EHWStorySegmentKind::BossBattle)
    {
        BeginBattle(false);
        return;
    }

    Phase = EHWStoryPhase::Cinematic;
    const bool bInArena = S.LocationId == ArenaLocationId.ToString();
    if (Index == ResultIndex && Boss)
    {
        // The result cinema is staged at the spawn point (its cameras are placed there): the body is laid there
        // under the cut, facing where the fight left it.
        if (const AActor* Spot = FindTagged(TagBossSpawn))
        {
            FVector At = Spot->GetActorLocation();
            At.Z = Boss->GetActorLocation().Z;
            Boss->SetActorLocation(At, false, nullptr, ETeleportType::TeleportPhysics);
        }
    }
    PlacePlayer(bInArena);   // she is in the room during the arena scenes; elsewhere the arena is not on screen
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
            if (ACameraActor* Cam = FindCamera(CardCamera)) PC->SetViewTarget(Cam);
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
    SetArenaState(StateAtEnd(Index));
    if (Index == ResultIndex && Boss)
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
}

void AHWStoryDirector::BeginBattle(bool bFromCinema)
{
    Phase = bFromCinema ? EHWStoryPhase::Handoff : EHWStoryPhase::Battle;
    PhaseElapsed = 0.f;
    SetArenaState(EArenaState::Fight);
    SetStandInsHidden(true);
    PlacePlayer(true);

    if (!Boss)
    {
        const AActor* Spot = FindTagged(TagBossSpawn);
        FVector Location = Spot ? Spot->GetActorLocation() : FVector(300.f, 0.f, 5.f);
        Location.Z += 110.f;
        const FVector AinAt = Ain ? Ain->GetActorLocation() : FVector::ZeroVector;
        const FRotator Facing(0.f, (AinAt - Location).Rotation().Yaw, 0.f);
        FActorSpawnParameters Params;
        Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
        Boss = GetWorld()->SpawnActor<AHWBossCharacter>(AHWBossCharacter::StaticClass(), Location, Facing, Params);
        if (Boss)
        {
            Boss->OnBossDied.AddUniqueDynamic(this, &AHWStoryDirector::HandleBossDied);
        }
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
    if (AHWStoryHUD* HUD = GetStoryHUD())
    {
        HUD->GetOverlay()->ShowHandoff();
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

void AHWStoryDirector::HandleBossDied(AHWBossCharacter* DeadBoss)
{
    if (Phase != EHWStoryPhase::Battle || DeadBoss != Boss) return;
    Phase = EHWStoryPhase::BattleOver;
    PhaseElapsed = 0.f;
    PendingTimer = 1.8f;
    Emit(TEXT("boss_died"));
}

void AHWStoryDirector::HandlePlayerDied()
{
    if (Phase != EHWStoryPhase::Battle) return;
    Phase = EHWStoryPhase::BattleOver;
    PhaseElapsed = 0.f;
    PendingTimer = 2.5f;
    Emit(TEXT("player_died"));
}

void AHWStoryDirector::FinishEpisode()
{
    Phase = EHWStoryPhase::Finished;
    PhaseElapsed = 0.f;
    SetPlayerControl(false);
    if (AHWStoryHUD* HUD = GetStoryHUD())
    {
        HUD->SetCombatVisible(false);
        HUD->GetOverlay()->ShowEnd(FText::FromString(FString::Printf(TEXT("%s  %s"), *EpisodeId.ToString(), *EpisodeTitle.ToString())));
    }
    Emit(TEXT("finished"));
}

AHWStoryDirector::EArenaState AHWStoryDirector::StateAtStart(int32 Index) const
{
    if (!bStoryMode || Index == BattleIndex || Index == ResultIndex) return EArenaState::Fight;
    if (Index == EntryIndex || Index < BattleIndex) return EArenaState::PreBattle;
    return EArenaState::After;
}

AHWStoryDirector::EArenaState AHWStoryDirector::StateAtEnd(int32 Index) const
{
    if (Index == EntryIndex) return EArenaState::Fight;       // the blast inside the entry sequence
    if (Index == ResultIndex) return EArenaState::After;      // the body turns to dust inside the result sequence
    return StateAtStart(Index);
}

void AHWStoryDirector::SetArenaState(EArenaState State)
{
    UDataLayerManager* LayerManager = UDataLayerManager::GetDataLayerManager(GetWorld());
    if (!LayerManager) return;
    LayerManager->ForEachDataLayerInstance([&](UDataLayerInstance* I)
    {
        const FString Name = I->GetDataLayerShortName();
        bool bOn;
        if (Name == TEXT("DL_Story_PreBattle")) bOn = State == EArenaState::PreBattle;
        else if (Name == TEXT("DL_Phase1")) bOn = State == EArenaState::Fight;
        else if (Name == TEXT("DL_Aftermath")) bOn = State == EArenaState::After;
        else return true;   // Base, Cinematic and the (empty per canon) Phase2/3 layers stay as authored
        LayerManager->SetDataLayerInstanceRuntimeState(I, bOn ? EDataLayerRuntimeState::Activated : EDataLayerRuntimeState::Unloaded);
        return true;
    });
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

void AHWStoryDirector::PlacePlayer(bool bVisible)
{
    APlayerController* PC = GetWorld()->GetFirstPlayerController();
    Ain = PC ? Cast<AHWAinCharacter>(PC->GetPawn()) : nullptr;
    if (!Ain) return;
    if (const AActor* Spot = FindTagged(TagAinStart))
    {
        const AActor* BossSpot = FindTagged(TagBossSpawn);
        FVector Location = Spot->GetActorLocation();
        Location.Z += Ain->GetCapsuleComponent()->GetScaledCapsuleHalfHeight() + 2.f;
        const float Yaw = BossSpot ? (BossSpot->GetActorLocation() - Location).Rotation().Yaw : Spot->GetActorRotation().Yaw;
        Ain->SetActorLocationAndRotation(Location, FRotator(0.f, Yaw, 0.f), false, nullptr, ETeleportType::TeleportPhysics);
    }
    Ain->SetActorHiddenInGame(!bVisible);
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
