#include "Tests/HWSystemQASubsystem.h"

#include "Boss/HWBossCharacter.h"
#include "Camera/HWLockOnComponent.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Game/HWCombatGameMode.h"
#include "Network/HWRaidExpeditionProxy.h"
#include "Network/HWRaidHazardProxy.h"
#include "Network/HWRaidNetworkSubsystem.h"
#include "Network/HWRaidRemoteAvatar.h"
#include "Network/HWRaidWorldBridge.h"
#include "Progression/HWProfileSubsystem.h"
#include "Progression/HWSaveGame.h"
#include "System/HWBossPartTarget.h"
#include "System/HWBossSystemComponent.h"
#include "System/HWCharacterKitComponent.h"
#include "System/HWCombatTargetInterface.h"
#include "System/HWCoopLifeComponent.h"
#include "System/HWDungeonDirector.h"
#include "System/HWDungeonEnemy.h"
#include "System/HWDungeonObjectiveNode.h"
#include "System/HWPlayableCharacterVariants.h"
#include "System/HWSystemRulesLibrary.h"

#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/InputSettings.h"
#include "GameFramework/PlayerController.h"
#include "InputKeyEventArgs.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/CommandLine.h"
#include "Misc/FileHelper.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "Animation/AnimInstance.h"
#include "Animation/HWPlayerPresentationComponent.h"
#include "Camera/CameraActor.h"
#include "Engine/StaticMeshActor.h"
#include "Camera/CameraComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Animation/HWBossPresentationComponent.h"
#include "Animation/HWAnimationSetAsset.h"
#include "Animation/AnimSequenceBase.h"
#include "Animation/SkeletalMeshActor.h"
#include "WorldPartition/DataLayer/DataLayerManager.h"
#include "WorldPartition/DataLayer/DataLayerInstance.h"
#include "Components/CapsuleComponent.h"
#include "Kismet/KismetMathLibrary.h"
#include "UnrealClient.h"
#include "Engine/DirectionalLight.h"
#include "Components/LightComponent.h"

namespace
{
    // Server world distances are anisotropic (js/world-sim.js DEPTH).
    constexpr float QADepth = 0.55f;
    const TCHAR* QAProfileSlot = TEXT("HwanghonCombatUE_Profile_v1");

    float AnisoDist(float AX, float AY, float BX, float BY)
    {
        const float DX = AX - BX;
        const float DY = (AY - BY) / QADepth;
        return FMath::Sqrt(DX * DX + DY * DY);
    }

    float AnisoYaw(float AX, float AY, float BX, float BY)
    {
        return FMath::RadiansToDegrees(FMath::Atan2((BY - AY) / QADepth, BX - AX));
    }

    UClass* PawnClassFor(FName Id)
    {
        if (Id == TEXT("kain")) return AHWKainCharacter::StaticClass();
        if (Id == TEXT("ryu")) return AHWRyuCharacter::StaticClass();
        if (Id == TEXT("sera")) return AHWSeraCharacter::StaticClass();
        return AHWAinCharacter::StaticClass();
    }

    FString Param(const TCHAR* Key)
    {
        FString Value;
        FParse::Value(FCommandLine::Get(), Key, Value);
        return Value;
    }

    TSharedPtr<FJsonValue> Num(double V) { return MakeShared<FJsonValueNumber>(V); }
    TSharedPtr<FJsonValue> Str(const FString& V) { return MakeShared<FJsonValueString>(V); }

    template <typename T>
    FString EnumName(T Value)
    {
        return StaticEnum<T>()->GetNameStringByValue(static_cast<int64>(Value));
    }
}

bool UHWSystemQASubsystem::ShouldCreateSubsystem(UObject* Outer) const
{
#if UE_BUILD_SHIPPING
    return false;
#else
    FString Value;
    return FParse::Value(FCommandLine::Get(), TEXT("HWQA="), Value) && !Value.IsEmpty();
#endif
}

void UHWSystemQASubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    Collection.InitializeDependency<UHWProfileSubsystem>();
    Collection.InitializeDependency<UHWRaidNetworkSubsystem>();

    Mode = Param(TEXT("HWQA="));
    OutPath = Param(TEXT("HWQAOut="));
    ShareDir = Param(TEXT("HWQAShare="));
    ExpectCharacter = FName(*Param(TEXT("HWQAExpect=")));
    NextCharacter = FName(*Param(TEXT("HWQASelect=")));
    bCheckOnly = FParse::Param(FCommandLine::Get(), TEXT("HWQACheckOnly"));
    LocalDungeonId = FName(*Param(TEXT("HWQADungeon=")));
    Role = Param(TEXT("HWQARole="));
    Index = FCString::Atoi(*Param(TEXT("HWQAIndex=")));
    Players = FMath::Max(1, FCString::Atoi(*Param(TEXT("HWQAPlayers="))));
    LevelId = Param(TEXT("HWQALevel="));
    const FString Victim = Param(TEXT("HWQAVictim="));
    VictimIndex = Victim.IsEmpty() ? -1 : FCString::Atoi(*Victim);
    bResume = FParse::Param(FCommandLine::Get(), TEXT("HWQAResume"));
    ServerUrl = Param(TEXT("HWServer="));

    Report = MakeShared<FJsonObject>();
    Gates = MakeShared<FJsonObject>();
    Report->SetStringField(TEXT("mode"), Mode);
    Report->SetStringField(TEXT("role"), Role);
    Report->SetNumberField(TEXT("index"), Index);
    Report->SetStringField(TEXT("character_arg"), Param(TEXT("HWCharacter=")));
    Note(FString::Printf(TEXT("QA start mode=%s role=%s index=%d players=%d level=%s"), *Mode, *Role, Index, Players, *LevelId));
    if (Mode == TEXT("net")) LoadGrid();
}

void UHWSystemQASubsystem::Deinitialize()
{
    if (!bFinished) Flush();
    Super::Deinitialize();
}

TStatId UHWSystemQASubsystem::GetStatId() const
{
    RETURN_QUICK_DECLARE_CYCLE_STAT(UHWSystemQASubsystem, STATGROUP_Tickables);
}

ETickableTickType UHWSystemQASubsystem::GetTickableTickType() const
{
    return HasAnyFlags(RF_ClassDefaultObject) ? ETickableTickType::Never : ETickableTickType::Conditional;
}

bool UHWSystemQASubsystem::IsTickable() const
{
    return !bFinished && !HasAnyFlags(RF_ClassDefaultObject);
}

// ---------------------------------------------------------------- report

void UHWSystemQASubsystem::Gate(const FString& Name, bool bPass, const FString& Detail)
{
    TSharedPtr<FJsonObject> G = MakeShared<FJsonObject>();
    G->SetBoolField(TEXT("pass"), bPass);
    G->SetStringField(TEXT("detail"), Detail);
    G->SetNumberField(TEXT("t"), Elapsed);
    Gates->SetObjectField(Name, G);
    Note(FString::Printf(TEXT("GATE %s %s — %s"), *Name, bPass ? TEXT("PASS") : TEXT("FAIL"), *Detail));
}

void UHWSystemQASubsystem::Note(const FString& Line)
{
    UE_LOG(LogTemp, Display, TEXT("HWQA %.1f %s"), Elapsed, *Line);
    Lines.Add(Str(FString::Printf(TEXT("%.1f %s"), Elapsed, *Line)));
}

void UHWSystemQASubsystem::Flush()
{
    if (OutPath.IsEmpty() || !Report.IsValid()) return;
    Report->SetObjectField(TEXT("gates"), Gates);
    Report->SetArrayField(TEXT("timeline"), Timeline);
    Report->SetArrayField(TEXT("log"), Lines);
    Report->SetArrayField(TEXT("telegraphs"), TelegraphLog);
    if (BodySamples.Num() > 0) Report->SetArrayField(TEXT("body"), BodySamples);
    TSharedPtr<FJsonObject> C = MakeShared<FJsonObject>();
    for (const TPair<FString, int32>& Pair : Counters) C->SetNumberField(Pair.Key, Pair.Value);
    Report->SetObjectField(TEXT("counters"), C);
    Report->SetNumberField(TEXT("elapsed"), Elapsed);
    FString Out;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Out);
    FJsonSerializer::Serialize(Report.ToSharedRef(), Writer);
    FFileHelper::SaveStringToFile(Out, *OutPath, FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM);
}

void UHWSystemQASubsystem::Finish(bool bOk, const FString& Why)
{
    if (bFinished) return;
    ReleaseAll();
    Report->SetBoolField(TEXT("ok"), bOk);
    Report->SetStringField(TEXT("why"), Why);
    Note(FString::Printf(TEXT("FINISH ok=%d %s"), bOk ? 1 : 0, *Why));
    Flush();
    bFinished = true;
    FPlatformMisc::RequestExit(false, TEXT("HWQA"));
}

void UHWSystemQASubsystem::WriteShare(const FString& Name, const FString& Body) const
{
    if (ShareDir.IsEmpty()) return;
    FFileHelper::SaveStringToFile(Body, *FPaths::Combine(ShareDir, Name), FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM);
}

bool UHWSystemQASubsystem::ReadShare(const FString& Name, FString& Out) const
{
    return !ShareDir.IsEmpty() && FFileHelper::LoadFileToString(Out, *FPaths::Combine(ShareDir, Name));
}

bool UHWSystemQASubsystem::HasShare(const FString& Name) const
{
    return !ShareDir.IsEmpty() && FPaths::FileExists(FPaths::Combine(ShareDir, Name));
}

// ---------------------------------------------------------------- input

APlayerController* UHWSystemQASubsystem::GetPC() const
{
    return GetGameInstance() ? GetGameInstance()->GetFirstLocalPlayerController() : nullptr;
}

AHWAinCharacter* UHWSystemQASubsystem::GetPawn() const
{
    APlayerController* PC = GetPC();
    return PC ? Cast<AHWAinCharacter>(PC->GetPawn()) : nullptr;
}

FKey UHWSystemQASubsystem::KeyForAction(FName Action) const
{
    const UInputSettings* Settings = UInputSettings::GetInputSettings();
    if (Action == TEXT("MoveForward"))
    {
        TArray<FInputAxisKeyMapping> Axis;
        Settings->GetAxisMappingByName(Action, Axis);
        for (const FInputAxisKeyMapping& M : Axis)
        {
            if (M.Scale > 0.f && !M.Key.IsGamepadKey()) return M.Key;
        }
        return EKeys::Invalid;
    }
    TArray<FInputActionKeyMapping> Mappings;
    Settings->GetActionMappingByName(Action, Mappings);
    for (const FInputActionKeyMapping& M : Mappings)
    {
        if (!M.Key.IsGamepadKey() && !M.Key.IsMouseButton()) return M.Key;
    }
    return Mappings.Num() > 0 ? Mappings[0].Key : EKeys::Invalid;
}

void UHWSystemQASubsystem::Hold(FName Action, bool bDown)
{
    APlayerController* PC = GetPC();
    const FKey Key = KeyForAction(Action);
    if (!PC || !Key.IsValid()) return;
    if (bDown == HeldActions.Contains(Action)) return;
    PC->InputKey(FInputKeyEventArgs::CreateSimulated(Key, bDown ? IE_Pressed : IE_Released, bDown ? 1.f : 0.f));
    if (bDown) HeldActions.Add(Action); else HeldActions.Remove(Action);
}

void UHWSystemQASubsystem::Tap(FName Action)
{
    // Pressed now, released next tick (ReleaseTaps below) — the same edge a key press produces.
    APlayerController* PC = GetPC();
    const FKey Key = KeyForAction(Action);
    if (!PC || !Key.IsValid())
    {
        ++Counters.FindOrAdd(TEXT("tap_missing_") + Action.ToString());
        return;
    }
    if (HeldActions.Contains(Action)) return;
    PC->InputKey(FInputKeyEventArgs::CreateSimulated(Key, IE_Pressed, 1.f));
    HeldActions.Add(FName(*(TEXT("~") + Action.ToString())));
    ++Counters.FindOrAdd(TEXT("tap_") + Action.ToString());
}

void UHWSystemQASubsystem::Steer(float YawDegrees, bool bMove)
{
    APlayerController* PC = GetPC();
    if (!PC) return;
    if (bMove) PC->SetControlRotation(FRotator(0.f, YawDegrees, 0.f));
    if (bMove != bHoldingForward)
    {
        const FKey Key = KeyForAction(TEXT("MoveForward"));
        if (Key.IsValid()) PC->InputKey(FInputKeyEventArgs::CreateSimulated(Key, bMove ? IE_Pressed : IE_Released, bMove ? 1.f : 0.f));
        bHoldingForward = bMove;
    }
}

void UHWSystemQASubsystem::Backpedal(bool bBack)
{
    APlayerController* PC = GetPC();
    if (!PC || bBack == bHoldingBack) return;
    TArray<FInputAxisKeyMapping> Axis;
    UInputSettings::GetInputSettings()->GetAxisMappingByName(TEXT("MoveForward"), Axis);
    for (const FInputAxisKeyMapping& M : Axis)
    {
        if (M.Scale < 0.f && !M.Key.IsGamepadKey())
        {
            PC->InputKey(FInputKeyEventArgs::CreateSimulated(M.Key, bBack ? IE_Pressed : IE_Released, bBack ? 1.f : 0.f));
            break;
        }
    }
    bHoldingBack = bBack;
}

void UHWSystemQASubsystem::ReleaseAll()
{
    Steer(0.f, false);
    Backpedal(false);
    TArray<FName> Held = HeldActions.Array();
    for (FName Action : Held)
    {
        const FString S = Action.ToString();
        if (S.StartsWith(TEXT("~")))
        {
            if (APlayerController* PC = GetPC())
            {
                const FKey Key = KeyForAction(FName(*S.RightChop(1)));
                if (Key.IsValid()) PC->InputKey(FInputKeyEventArgs::CreateSimulated(Key, IE_Released, 0.f));
            }
            HeldActions.Remove(Action);
        }
        else
        {
            Hold(Action, false);
        }
    }
}

// ---------------------------------------------------------------- tick

void UHWSystemQASubsystem::Tick(float DeltaTime)
{
    if (bFinished) return;
    const float Dt = FMath::Min(DeltaTime, 0.1f);
    Elapsed += Dt;

    // Release last tick's taps (press/release on separate frames, like a real key).
    for (auto It = HeldActions.CreateIterator(); It; ++It)
    {
        const FString S = It->ToString();
        if (!S.StartsWith(TEXT("~"))) continue;
        if (APlayerController* PC = GetPC())
        {
            const FKey Key = KeyForAction(FName(*S.RightChop(1)));
            if (Key.IsValid()) PC->InputKey(FInputKeyEventArgs::CreateSimulated(Key, IE_Released, 0.f));
        }
        It.RemoveCurrent();
    }

    if (Mode == TEXT("select")) TickSelect();
    else if (Mode == TEXT("writev2")) TickWriteV2();
    else if (Mode == TEXT("local")) TickLocal(Dt);
    else if (Mode == TEXT("net")) TickNet(Dt);
    else if (Mode == TEXT("showcase")) TickShowcase(Dt);
    else if (Mode == TEXT("bossshow")) TickBossShow(Dt);
    else if (Mode == TEXT("clipreview")) TickClipReview(Dt);
    else if (Mode == TEXT("arenashow")) TickArenaShow(Dt);
    else Finish(false, TEXT("Unknown -HWQA mode: ") + Mode);

    FlushTimer += Dt;
    if (!bFinished && FlushTimer > 5.f)
    {
        FlushTimer = 0.f;
        Flush();
    }
}

// ---------------------------------------------------------------- select / save migration

void UHWSystemQASubsystem::TickSelect()
{
    UHWProfileSubsystem* Profile = GetGameInstance()->GetSubsystem<UHWProfileSubsystem>();
    if (!Profile) { Finish(false, TEXT("No profile subsystem")); return; }
    if (!Profile->IsProfileAvailable())
    {
        Gate(TEXT("profile_loaded"), false, Profile->GetLastError());
        Finish(false, TEXT("Profile unavailable"));
        return;
    }
    int32 DiskVersion = -1;
    if (const UHWSaveGame* Disk = Cast<UHWSaveGame>(UGameplayStatics::LoadGameFromSlot(QAProfileSlot, 0)))
    {
        DiskVersion = Disk->Version;
    }
    Report->SetNumberField(TEXT("disk_version_before"), DiskVersion);
    const FName Selected = Profile->GetSelectedCharacter();
    Report->SetStringField(TEXT("selected_before"), Selected.ToString());
    Gate(TEXT("profile_loaded"), true, FString::Printf(TEXT("disk v%d, selected=%s"), DiskVersion, *Selected.ToString()));
    if (!ExpectCharacter.IsNone())
    {
        Gate(TEXT("selection_persisted"), Selected == ExpectCharacter,
            FString::Printf(TEXT("expected %s, loaded %s"), *ExpectCharacter.ToString(), *Selected.ToString()));
    }
    if (!NextCharacter.IsNone())
    {
        const bool bSaved = Profile->SelectCharacter(NextCharacter);
        const UHWSaveGame* After = Cast<UHWSaveGame>(UGameplayStatics::LoadGameFromSlot(QAProfileSlot, 0));
        Gate(TEXT("selection_saved"), bSaved && Profile->GetSelectedCharacter() == NextCharacter
            && After && After->SelectedCharacter == NextCharacter && After->Version == UHWSaveGame::CurrentVersion,
            FString::Printf(TEXT("select %s -> ok=%d, disk %s v%d"), *NextCharacter.ToString(), bSaved ? 1 : 0,
                After ? *After->SelectedCharacter.ToString() : TEXT("-"), After ? After->Version : -1));
        // A non-playable id must be refused and must not replace the saved one.
        const bool bRejected = !Profile->SelectCharacter(TEXT("party3"));
        Gate(TEXT("selection_rejects_invalid"), bRejected && Profile->GetSelectedCharacter() == NextCharacter,
            TEXT("SelectCharacter(party3) refused"));
    }
    Finish(true, TEXT("select done"));
}

void UHWSystemQASubsystem::TickWriteV2()
{
    // An old v2 profile: no character field yet (NAME_None), schema 2.
    UHWSaveGame* Old = NewObject<UHWSaveGame>(this);
    Old->Version = 2;
    Old->SelectedCharacter = NAME_None;
    const bool bSaved = UGameplayStatics::SaveGameToSlot(Old, QAProfileSlot, 0);
    const UHWSaveGame* Disk = Cast<UHWSaveGame>(UGameplayStatics::LoadGameFromSlot(QAProfileSlot, 0));
    Gate(TEXT("v2_written"), bSaved && Disk && Disk->Version == 2,
        FString::Printf(TEXT("disk v%d selected=%s"), Disk ? Disk->Version : -1, Disk ? *Disk->SelectedCharacter.ToString() : TEXT("-")));
    Finish(bSaved, TEXT("v2 save written"));
}

// ---------------------------------------------------------------- identity

void UHWSystemQASubsystem::RecordIdentity(AHWAinCharacter* Pawn, FName Expected, bool bOnline)
{
    UWorld* World = GetGameInstance()->GetWorld();
    int32 PawnCount = 0;
    for (TActorIterator<AHWAinCharacter> It(World); It; ++It) ++PawnCount;
    UHWProfileSubsystem* Profile = GetGameInstance()->GetSubsystem<UHWProfileSubsystem>();
    const FName LocalSelection = Profile ? Profile->GetSelectedCharacter() : NAME_None;
    const FString ClassName = Pawn->GetClass()->GetName();
    const FName KitId = Pawn->GetCharacterKit() ? Pawn->GetCharacterKit()->GetCharacterId() : NAME_None;

    TSharedPtr<FJsonObject> Id = MakeShared<FJsonObject>();
    Id->SetStringField(TEXT("expected"), Expected.ToString());
    Id->SetStringField(TEXT("local_selection"), LocalSelection.ToString());
    Id->SetStringField(TEXT("pawn_class"), ClassName);
    Id->SetStringField(TEXT("system_id"), Pawn->GetSystemCharacterId().ToString());
    Id->SetStringField(TEXT("kit_id"), KitId.ToString());
    Id->SetNumberField(TEXT("player_pawns"), PawnCount);
    Id->SetStringField(TEXT("map"), World ? World->GetOutermost()->GetName() : TEXT("-"));
    Report->SetObjectField(TEXT("identity"), Id);

    if (!bOnline)
    {
        Gate(TEXT("selection_persisted"), LocalSelection == Expected,
            FString::Printf(TEXT("saved selection %s (expected %s)"), *LocalSelection.ToString(), *Expected.ToString()));
    }
    Gate(TEXT("pawn_class"), Pawn->GetClass() == PawnClassFor(Expected),
        FString::Printf(TEXT("%s for %s%s"), *ClassName, *Expected.ToString(),
            bOnline ? *FString::Printf(TEXT(" (local save says %s)"), *LocalSelection.ToString()) : TEXT("")));
    Gate(TEXT("single_pawn"), PawnCount == 1, FString::Printf(TEXT("%d player pawn(s) in world"), PawnCount));
    Gate(TEXT("kit_matches"), Pawn->GetSystemCharacterId() == Expected && KitId == Expected,
        FString::Printf(TEXT("system=%s kit=%s"), *Pawn->GetSystemCharacterId().ToString(), *KitId.ToString()));
}

// ---------------------------------------------------------------- 1P local dungeon

void UHWSystemQASubsystem::LocalSummary(const FHWSystemDungeonDefinition& Def)
{
    TArray<TSharedPtr<FJsonValue>> Rooms;
    for (const FString& R : RoomOrder) Rooms.Add(Str(R));
    Report->SetArrayField(TEXT("rooms"), Rooms);
    TArray<TSharedPtr<FJsonValue>> Skills;
    for (int32 I = 0; I < 5; ++I)
    {
        TSharedPtr<FJsonObject> S = MakeShared<FJsonObject>();
        S->SetNumberField(TEXT("attempts"), SkillAttempts[I]);
        S->SetNumberField(TEXT("activations"), SkillActivations[I]);
        S->SetNumberField(TEXT("damage"), SkillDamage[I]);
        Skills.Add(MakeShared<FJsonValueObject>(S));
    }
    Report->SetArrayField(TEXT("skills"), Skills);
    bool bSkills = true;
    for (int32 I = 0; I < 4; ++I) bSkills &= SkillActivations[I] > 0;
    Gate(TEXT("skills_1_4"), bSkills, FString::Printf(TEXT("activations %d/%d/%d/%d, damage %.0f/%.0f/%.0f/%.0f"),
        SkillActivations[0], SkillActivations[1], SkillActivations[2], SkillActivations[3],
        SkillDamage[0], SkillDamage[1], SkillDamage[2], SkillDamage[3]));
    Gate(TEXT("ultimate"), SkillActivations[4] > 0, FString::Printf(TEXT("activations %d, damage %.0f"), SkillActivations[4], SkillDamage[4]));
    bool bCombat = false, bElite = false, bObjective = false, bBoss = false;
    for (const FHWSystemDungeonRoom& R : Def.Rooms)
    {
        bCombat |= R.Type == EHWRoomType::Combat; bElite |= R.Type == EHWRoomType::Elite;
        bObjective |= R.Type == EHWRoomType::Objective; bBoss |= R.Type == EHWRoomType::Boss;
    }
    Gate(TEXT("dungeon_rooms"), bCombat && bElite && bObjective && bBoss && ElitesSeen > 0 && ObjectivesTouched > 0,
        FString::Join(RoomOrder, TEXT(" > ")) + FString::Printf(TEXT(" | elites %d, objectives %d"), ElitesSeen, ObjectivesTouched));
    Gate(TEXT("boss_phases"), MaxPhase >= 3, FString::Printf(TEXT("max phase %d"), MaxPhase));
    Gate(TEXT("boss_break"), BreakCount > 0, FString::Printf(TEXT("breaks %d"), BreakCount));
    Gate(TEXT("part_lock_break"), bPartLocked && BrokenParts.Num() > 0,
        FString::Printf(TEXT("part lock %d, broken %d"), bPartLocked ? 1 : 0, BrokenParts.Num()));
}

void UHWSystemQASubsystem::TickLocal(float Dt)
{
    UWorld* World = GetGameInstance()->GetWorld();
    AHWCombatGameMode* GM = World ? Cast<AHWCombatGameMode>(World->GetAuthGameMode()) : nullptr;
    AHWAinCharacter* Pawn = GetPawn();
    if (!GM || !Pawn)
    {
        if (Elapsed > 90.f) Finish(false, TEXT("No combat game mode/pawn"));
        return;
    }
    if (!bIdentityDone)
    {
        if (Elapsed < 1.f) return;   // let BeginPlay settle
        bIdentityDone = true;
        RecordIdentity(Pawn, ExpectCharacter.IsNone() ? FName(TEXT("ain")) : ExpectCharacter, false);
        if (bCheckOnly)
        {
            if (!NextCharacter.IsNone())
            {
                UHWProfileSubsystem* Profile = GetGameInstance()->GetSubsystem<UHWProfileSubsystem>();
                const bool bSaved = Profile && Profile->SelectCharacter(NextCharacter);
                Gate(TEXT("selection_saved"), bSaved, FString::Printf(TEXT("next sortie character %s"), *NextCharacter.ToString()));
            }
            Finish(true, TEXT("identity check done"));
        }
        return;
    }

    AHWDungeonDirector* Director = GM->GetEncounterDungeon();
    if (!Director) { Finish(false, TEXT("No dungeon director (launch with ?HWDungeon=<id>)")); return; }
    if (ShotDir.IsEmpty()) ShotDir = Param(TEXT("HWQAShots="));
    if (!PendingShot.IsEmpty() && (PendingShotTimer -= Dt) <= 0.f) { Shot(PendingShot); MeasureBody(PendingShot, Pawn); PendingShot.Reset(); }
    const float ShotEvery = FCString::Atof(*Param(TEXT("HWQAShotEvery=")));
    if (!ShotDir.IsEmpty() && ShotEvery > 0.f && (ShotEveryTimer += Dt) >= ShotEvery)
    {
        ShotEveryTimer = 0.f;
        Shot(FString::Printf(TEXT("play_%03d_tick"), FMath::RoundToInt(Elapsed)));
    }
    const FHWSystemDungeonDefinition Def = UHWSystemRulesLibrary::DungeonDefinition(LocalDungeonId.IsNone() ? FName(TEXT("d01")) : LocalDungeonId);
    const EHWSystemDungeonState State = Director->GetDungeonState();
    const int32 Room = Director->GetCurrentRoomIndex();
    const EHWRoomType RoomType = Def.Rooms.IsValidIndex(Room) ? Def.Rooms[Room].Type : EHWRoomType::Combat;

    if (Room != LastRoom)
    {
        LastRoom = Room;
        const FString Entry = FString::Printf(TEXT("%d:%s"), Room, *EnumName(RoomType));
        RoomOrder.Add(Entry);
        Note(TEXT("room ") + Entry);
    }
    if ((uint8)State != LastDungeonState)
    {
        LastDungeonState = (uint8)State;
        Note(TEXT("dungeon state ") + EnumName(State));
    }

    UHWCombatComponent* Combat = Pawn->GetCombat();
    UHWCharacterKitComponent* Kit = Pawn->GetCharacterKit();
    UHWLockOnComponent* LockOn = Pawn->GetLockOn();

    // Pending skill: did the kit fire and did the locked target lose health?
    if (PendingSlot >= 0)
    {
        PendingTimer += Dt;
        if (PendingTimer > 0.25f)
        {
            const float Cooldown =
                PendingSlot == 0 ? Kit->GetSkill1Cooldown() : PendingSlot == 1 ? Kit->GetSkill2Cooldown() :
                PendingSlot == 2 ? Kit->GetSkill3Cooldown() : PendingSlot == 3 ? Kit->GetSkill4Cooldown() : Kit->GetUltimateCooldown();
            if (Cooldown > 0.f) ++SkillActivations[PendingSlot];
            float HpAfter = PendingHpBefore;
            if (AHWDungeonEnemy* E = Cast<AHWDungeonEnemy>(PendingTarget.Get())) HpAfter = E->GetHealth();
            else if (AHWBossCharacter* B = Cast<AHWBossCharacter>(PendingTarget.Get())) HpAfter = B->GetHealth();
            else if (AHWBossPartTarget* PT = Cast<AHWBossPartTarget>(PendingTarget.Get())) HpAfter = PT->GetBoss() ? PT->GetBoss()->GetHealth() : HpAfter;
            else if (!PendingTarget.IsValid()) HpAfter = 0.f;   // killed and cleaned up
            SkillDamage[PendingSlot] += FMath::Max(0.f, PendingHpBefore - HpAfter);
            PendingSlot = -1;
        }
    }

    if (State == EHWSystemDungeonState::Complete)
    {
        LocalSummary(Def);
        Gate(TEXT("dungeon_complete"), true, FString::Printf(TEXT("%.0fs, retries %d"), Director->GetElapsedSeconds(), Retries));
        Finish(true, TEXT("dungeon complete"));
        return;
    }

    if (State == EHWSystemDungeonState::Failed)
    {
        ReleaseAll();
        if (FailedTimer == 0.f)
        {
            for (TActorIterator<AHWBossCharacter> It(World); It; ++It)
            {
                Note(FString::Printf(TEXT("wiped: boss hp %.0f phase %d"), It->GetHealth(), It->GetBossSystem() ? It->GetBossSystem()->GetPhase() : 0));
            }
        }
        FailedTimer += Dt;
        if (FailedTimer < 2.f) return;
        FailedTimer = 0.f;
        const int32 TokensBefore = Director->GetReviveTokens();
        const int32 Checkpoint = Director->GetCheckpointRoomIndex();
        const bool bRetry = GM->RetryDungeonFromCheckpoint();
        const bool bAlive = !Combat->IsDead();
        const float Hp = Combat->GetHealth(), MaxHp = Combat->GetMaxHealth();
        Gate(Retries == 0 ? TEXT("wipe_retry") : *FString::Printf(TEXT("wipe_retry_%d"), Retries + 1), bRetry && bAlive && Director->GetCurrentRoomIndex() == Checkpoint
            && Director->GetReviveTokens() == TokensBefore - 1 && FMath::IsNearlyEqual(Hp, MaxHp)
            && !Pawn->GetCoopLife()->IsFullyDefeated() && Director->GetDungeonState() != EHWSystemDungeonState::Failed,
            FString::Printf(TEXT("retry=%d room %d (checkpoint %d) tokens %d->%d hp %.0f/%.0f state %s forced=%d"),
                bRetry ? 1 : 0, Director->GetCurrentRoomIndex(), Checkpoint, TokensBefore, Director->GetReviveTokens(),
                Hp, MaxHp, *EnumName(Director->GetDungeonState()), bForcedWipe ? 1 : 0));
        ++Retries;
        bWipeTest = false;
        bWipeDone = true;
        LastRoom = -2;
        if (!bRetry)
        {
            LocalSummary(Def);
            Finish(false, TEXT("out of revive tokens"));
        }
        return;
    }

    if (Combat->IsDead())
    {
        ReleaseAll();
        return;
    }

    // Boss telemetry
    AHWBossCharacter* Boss = nullptr;
    for (TActorIterator<AHWBossCharacter> It(World); It; ++It)
    {
        if (!It->IsDead()) { Boss = *It; break; }
    }
    // Which boss pattern is hurting us (bot tuning evidence).
    const float Health = Combat->GetHealth();
    if (LastLocalHealth > 0.f && Health < LastLocalHealth)
    {
        const FString Key = TEXT("hurt_") + (Boss ? Boss->GetCurrentPatternId().ToString() : FString(TEXT("mob")));
        Counters.FindOrAdd(Key) += FMath::RoundToInt(LastLocalHealth - Health);
    }
    LastLocalHealth = Health;

    if (RoomType == EHWRoomType::Boss && Boss && Boss->GetBossSystem())
    {
        BossRoomTime += Dt;
        UHWBossSystemComponent* Sys = Boss->GetBossSystem();
        if (Sys->GetPhase() > MaxPhase) { MaxPhase = Sys->GetPhase(); Note(FString::Printf(TEXT("boss phase %d (hp %.0f)"), MaxPhase, Boss->GetHealth())); }
        if (Sys->GetBreakCount() > BreakCount) { BreakCount = Sys->GetBreakCount(); Note(FString::Printf(TEXT("boss break #%d"), BreakCount)); }
        for (const FHWBossPartRuntime& Part : Sys->GetParts())
        {
            if (Part.bBroken && !BrokenParts.Contains(Part.Id)) { BrokenParts.Add(Part.Id); Note(TEXT("part broken ") + Part.Id.ToString()); }
        }
        // Wipe/checkpoint test once, after phase 2 + a part break (or 150 s in the boss room).
        if (!bWipeDone && !bWipeTest && ((MaxPhase >= 2 && BrokenParts.Num() > 0) || BossRoomTime > 150.f))
        {
            bWipeTest = true;
            WipeTimer = 0.f;
            Note(TEXT("wipe test: stop fighting and let the boss win"));
        }
    }

    if (bWipeTest)
    {
        ReleaseAll();
        WipeTimer += Dt;
        if (WipeTimer > 75.f && !bForcedWipe)
        {
            bForcedWipe = true;
            Note(TEXT("boss did not finish the idle player in 75 s; applying a lethal hit"));
            Combat->ApplyIncomingDamage(1.0e9f, EHWAttackTier::Finisher);
        }
        return;
    }

    // Objective room: walk onto each node (overlap is the interaction in graybox).
    if (RoomType == EHWRoomType::Objective)
    {
        AActor* Best = nullptr;
        float BestD = TNumericLimits<float>::Max();
        for (TActorIterator<AHWDungeonObjectiveNode> It(World); It; ++It)
        {
            if (It->IsHidden()) continue;
            const float D = FVector::Dist2D(It->GetActorLocation(), Pawn->GetActorLocation());
            if (D < BestD) { BestD = D; Best = *It; }
        }
        if (Best)
        {
            const FVector To = Best->GetActorLocation() - Pawn->GetActorLocation();
            Steer(To.Rotation().Yaw, true);
            if (BestD < 60.f) ++Counters.FindOrAdd(TEXT("objective_near"));
        }
        const int32 Remaining = Director->GetRemainingObjectives();
        if (LastObjectivesRemaining >= 0 && Remaining < LastObjectivesRemaining) ObjectivesTouched += LastObjectivesRemaining - Remaining;
        LastObjectivesRemaining = Remaining;
        return;
    }

    for (TActorIterator<AHWDungeonEnemy> It(World); It; ++It)
    {
        if (It->IsElite() && !It->Tags.Contains(TEXT("QASeen"))) { It->Tags.Add(TEXT("QASeen")); ++ElitesSeen; }
    }

    // Target: fresh lock (nearest enemy/boss). In the boss room lock a part first (CycleTarget) and break it.
    LockTimer -= Dt;
    AActor* Target = LockOn->GetTarget();
    const bool bWantPart = RoomType == EHWRoomType::Boss && BrokenParts.Num() == 0;
    if (LockTimer <= 0.f)
    {
        if (!Target)
        {
            Tap(TEXT("LockOn"));
            LockTimer = 0.3f;
        }
        else if (bWantPart && !Target->IsA<AHWBossPartTarget>())
        {
            Tap(TEXT("CycleTarget"));
            LockTimer = 0.3f;
        }
        else if (!bWantPart && Target->IsA<AHWBossPartTarget>())
        {
            Tap(TEXT("CycleTarget"));
            LockTimer = 0.3f;
        }
    }
    if (Target && Target->IsA<AHWBossPartTarget>() && !bPartLocked)
    {
        bPartLocked = true;
        Note(TEXT("locked boss part ") + Cast<AHWBossPartTarget>(Target)->GetPartId().ToString());
    }
    if (!Target)
    {
        ReleaseAll();
        return;
    }

    const float Dist = FVector::Dist2D(Target->GetActorLocation(), Pawn->GetActorLocation());
    const FVector To = Target->GetActorLocation() - Pawn->GetActorLocation();
    Backpedal(false);
    Steer(To.Rotation().Yaw, Dist > 190.f);

    // Defend on the boss's real beat clock: stop attacking before the beat, then counter
    // (counterable beat), jump (jump-only pattern) or dodge (i-frames) just before it lands.
    CounterTimer -= Dt;
    if (Boss && (Boss->GetBossState() == EHWBossState::Tell || Boss->GetBossState() == EHWBossState::Strike))
    {
        const FHWBossPatternSpec& Pattern = Boss->GetCurrentPattern();
        const float Speed = FMath::Max(0.1f, Boss->GetBossSystem() ? Boss->GetBossSystem()->GetPatternSpeedScale() : 1.f);
        const float Norm = Boss->GetBossStateNormalized();
        const float Clock = Boss->GetBossState() == EHWBossState::Tell
            ? -Pattern.TellDuration * (1.f - Norm) : Norm * Pattern.StrikeDuration;
        const FHWBossBeatSpec* Next = nullptr;
        for (const FHWBossBeatSpec& Beat : Pattern.Beats) if (Beat.At > Clock + 0.001f) { Next = &Beat; break; }
        const float BossDist = FVector::Dist2D(Boss->GetActorLocation(), Pawn->GetActorLocation());
        if (Next && BossDist <= Next->RangeCm + 80.f)
        {
            const float ToHit = (Next->At - Clock) / Speed;
            const bool bCounterBeat = Pattern.bCounterable && Next->bCounterable;
            // Multi-beat swings outpace the dodge cooldown: walk out of range instead.
            const bool bRetreat = !Pattern.bJumpOnly && !bCounterBeat && Pattern.LungeDistanceCm <= 0.f;
            // Counter starts only from no action (UHWCombatComponent::RequestCounter), so stop swinging
            // as soon as the tell begins; fall back to a dodge (it cancels attacks) if still mid-action.
            if (ToHit < 1.6f)
            {
                // Lock-on keeps the camera on the boss, so back off with the backward key, not by turning.
                Steer(To.Rotation().Yaw, false);
                Backpedal(bRetreat && ToHit < 1.2f);
                if (ToHit <= 0.12f && CounterTimer <= 0.f && (!bRetreat || BossDist <= Next->RangeCm))
                {
                    const FName Defense = Pattern.bJumpOnly ? FName(TEXT("CombatJump"))
                        : (bCounterBeat && Combat->GetCurrentAction() == EHWActionType::None) ? FName(TEXT("Counter")) : FName(TEXT("Dodge"));
                    Tap(Defense);
                    ++Counters.FindOrAdd(TEXT("defense_") + Defense.ToString());
                    CounterTimer = 0.3f;
                }
                return;
            }
        }
    }

    if (Dist > 250.f) return;

    // Skills / ultimate through the real bindings; normal attacks fill the gauges.
    SkillTimer -= Dt;
    if (SkillTimer <= 0.f && PendingSlot < 0 && Combat->GetCurrentAction() == EHWActionType::None)
    {
        const float Cds[4] = { Kit->GetSkill1Cooldown(), Kit->GetSkill2Cooldown(), Kit->GetSkill3Cooldown(), Kit->GetSkill4Cooldown() };
        int32 Slot = -1;
        if (Kit->GetUltimateGauge() >= 100.f && Kit->GetUltimateCooldown() <= 0.f) Slot = 4;
        else for (int32 I = 0; I < 4; ++I) if (Cds[I] <= 0.f && (Slot < 0 || SkillAttempts[I] < SkillAttempts[Slot])) Slot = I;
        if (Slot >= 0)
        {
            static const FName Actions[5] = { TEXT("Skill1"), TEXT("Skill2"), TEXT("Skill3"), TEXT("Skill4"), TEXT("Ultimate") };
            PendingTarget = Target;
            PendingHpBefore = 0.f;
            if (AHWDungeonEnemy* E = Cast<AHWDungeonEnemy>(Target)) PendingHpBefore = E->GetHealth();
            else if (AHWBossCharacter* B = Cast<AHWBossCharacter>(Target)) PendingHpBefore = B->GetHealth();
            else if (AHWBossPartTarget* PT = Cast<AHWBossPartTarget>(Target)) PendingHpBefore = PT->GetBoss() ? PT->GetBoss()->GetHealth() : 0.f;
            Tap(Actions[Slot]);
            ++SkillAttempts[Slot];
            if (!ShotDir.IsEmpty() && SkillShots < 12)
            {
                ++SkillShots;
                PendingShot = FString::Printf(TEXT("play_%03d_%s"), FMath::RoundToInt(Elapsed), *Actions[Slot].ToString());
                PendingShotTimer = 0.3f;
            }
            PendingSlot = Slot;
            PendingTimer = 0.f;
            SkillTimer = 0.6f;
            return;
        }
    }
    AttackTimer -= Dt;
    if (AttackTimer <= 0.f)
    {
        Tap((++Counters.FindOrAdd(TEXT("attack_cycle")) % 5) == 0 ? TEXT("Smash") : TEXT("Attack"));
        AttackTimer = 0.14f;
    }
}

// ---------------------------------------------------------------- online

bool UHWSystemQASubsystem::LoadGrid()
{
    const FString GridPath = Param(TEXT("HWQAGrid="));
    FString Text;
    if (GridPath.IsEmpty() || !FFileHelper::LoadFileToString(Text, *GridPath)) return false;
    TSharedPtr<FJsonObject> Root;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Text);
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid()) return false;
    Cell = (float)Root->GetNumberField(TEXT("cell"));
    const TArray<TSharedPtr<FJsonValue>>& Rows = Root->GetArrayField(TEXT("rows"));
    GridH = Rows.Num();
    GridW = GridH > 0 ? Rows[0]->AsString().Len() : 0;
    Solid.Init(1, GridW * GridH);
    for (int32 Y = 0; Y < GridH; ++Y)
    {
        const FString Row = Rows[Y]->AsString();
        for (int32 X = 0; X < GridW && X < Row.Len(); ++X)
        {
            const TCHAR C = Row[X];
            Solid[Y * GridW + X] = (C == TEXT('#') || C == TEXT('|')) ? 1 : 0;
        }
    }
    Note(FString::Printf(TEXT("grid %dx%d cell %.0f"), GridW, GridH, Cell));
    return GridW > 0;
}

bool UHWSystemQASubsystem::SteerToServerPoint(const FHWRaidNetPlayer& Me, float X, float Y, float Arrive)
{
    if (AnisoDist(Me.X, Me.Y, X, Y) <= Arrive)
    {
        Steer(0.f, false);
        return true;
    }
    PathAge += 0.05f;
    if (GridW > 0 && (PathGoal != FVector2D(X, Y) || PathAge > 3.f || Path.Num() == 0))
    {
        PathGoal = FVector2D(X, Y);
        PathAge = 0.f;
        Path.Reset();
        const FIntPoint Start(FMath::FloorToInt(Me.X / Cell), FMath::FloorToInt(Me.Y / Cell));
        const FIntPoint Goal(FMath::FloorToInt(X / Cell), FMath::FloorToInt(Y / Cell));
        TMap<FIntPoint, FIntPoint> From;
        TArray<FIntPoint> Queue = { Start };
        From.Add(Start, Start);
        for (int32 Head = 0; Head < Queue.Num(); ++Head)
        {
            const FIntPoint A = Queue[Head];
            if (A == Goal)
            {
                for (FIntPoint K = A; K != Start; K = From[K]) Path.Insert(FVector2D((K.X + 0.5f) * Cell, (K.Y + 0.5f) * Cell), 0);
                break;
            }
            static const FIntPoint Steps[4] = { FIntPoint(1, 0), FIntPoint(-1, 0), FIntPoint(0, 1), FIntPoint(0, -1) };
            for (const FIntPoint& S : Steps)
            {
                const FIntPoint B = A + S;
                if (B.X < 0 || B.Y < 0 || B.X >= GridW || B.Y >= GridH || From.Contains(B)) continue;
                if (Solid[B.Y * GridW + B.X] && B != Goal) continue;
                From.Add(B, A);
                Queue.Add(B);
            }
        }
    }
    while (Path.Num() > 0 && AnisoDist(Me.X, Me.Y, Path[0].X, Path[0].Y) < 16.f) Path.RemoveAt(0);
    const FVector2D Next = Path.Num() > 0 ? Path[0] : FVector2D(X, Y);
    Steer(AnisoYaw(Me.X, Me.Y, Next.X, Next.Y), true);
    return false;
}

void UHWSystemQASubsystem::TickNet(float Dt)
{
    UHWRaidNetworkSubsystem* Net = GetGameInstance()->GetSubsystem<UHWRaidNetworkSubsystem>();
    if (!Net) { Finish(false, TEXT("No network subsystem")); return; }
    StageTimer += Dt;
    ActionTimer -= Dt;
    const float Limit = Players >= 4 ? 1500.f : 1000.f;
    if (Elapsed > Limit) { Finish(false, TEXT("Scenario timed out")); return; }
    if (HasShare(TEXT("end")) && NetStage != ENetStage::Done)
    {
        NetStage = ENetStage::Done;
        Finish(true, TEXT("scenario end"));
        return;
    }
    const FHWPartyNetSnapshot Room = Net->GetRoom();

    switch (NetStage)
    {
    case ENetStage::Connect:
    {
        const FHWNetProfile Profile = Net->GetProfile();
        if (!Net->IsConnected() || Profile.Id.IsEmpty() || !Profile.bCharacterCreated)
        {
            if (StageTimer > 60.f) Finish(false, TEXT("No welcome/character profile from server"));
            return;
        }
        KnownId = Net->GetPlayerId();
        KnownToken = Net->GetSessionToken();
        const FName Wanted = FName(*Param(TEXT("HWCharacter=")));
        const FString WantedName = Param(TEXT("HWCharacterName="));
        if (bResume)
        {
            FString Before;
            ReadShare(FString::Printf(TEXT("client%d.json"), Index), Before);
            Gate(TEXT("resume_same_player"), Before.Contains(FString::Printf(TEXT("\"id\":\"%s\""), *KnownId)),
                FString::Printf(TEXT("token login -> %s"), *KnownId));
        }
        else
        {
            Gate(TEXT("online_character_created"), Profile.Character == Wanted && Profile.Name == WantedName,
                FString::Printf(TEXT("server profile %s / %s (requested %s / %s)"), *Profile.Name, *Profile.Character.ToString(),
                    *WantedName, *Wanted.ToString()));
        }
        WriteShare(FString::Printf(TEXT("client%d.json"), Index), FString::Printf(
            TEXT("{\"id\":\"%s\",\"token\":\"%s\",\"character\":\"%s\",\"name\":\"%s\"}"),
            *KnownId, *KnownToken, *Profile.Character.ToString(), *Profile.Name));
        Report->SetStringField(TEXT("player_id"), KnownId);
        Report->SetStringField(TEXT("profile_character"), Profile.Character.ToString());
        NetStage = bResume ? ENetStage::WaitRaid : ENetStage::Go;
        StageTimer = 0.f;
        return;
    }
    case ENetStage::Go:
        if (HasShare(TEXT("go"))) { NetStage = ENetStage::Room; StageTimer = 0.f; ActionTimer = 0.f; }
        return;
    case ENetStage::Room:
        if (Role == TEXT("host"))
        {
            if (!Room.Code.IsEmpty())
            {
                WriteShare(TEXT("room.txt"), Room.Code);
                Note(TEXT("room ") + Room.Code);
                NetStage = ENetStage::Ready; StageTimer = 0.f; ActionTimer = 0.f;
            }
            else if (ActionTimer <= 0.f)
            {
                Net->CreateRoom(FName(*LevelId), false, TEXT("first"), 0);
                ActionTimer = 4.f;
            }
        }
        else
        {
            FString Code;
            if (!Room.Code.IsEmpty()) { NetStage = ENetStage::Ready; StageTimer = 0.f; ActionTimer = 0.f; }
            else if (ActionTimer <= 0.f && ReadShare(TEXT("room.txt"), Code))
            {
                Net->JoinRoom(Code.TrimStartAndEnd());
                ActionTimer = 3.f;
            }
        }
        if (StageTimer > 90.f) Finish(false, TEXT("Room create/join timed out"));
        return;
    case ENetStage::Ready:
    {
        const FHWRaidNetMember* Mine = Room.Members.FindByPredicate([this](const FHWRaidNetMember& M) { return M.Id == KnownId; });
        if (!Room.bHasRaid && ActionTimer <= 0.f && (!Mine || !Mine->bReady))
        {
            Net->SetReady(true);
            ActionTimer = 3.f;
        }
        if (Role == TEXT("host") && !Room.bHasRaid)
        {
            int32 Ready = 0;
            for (const FHWRaidNetMember& M : Room.Members) Ready += (M.bReady && M.bConnected) ? 1 : 0;
            StartTimer -= Dt;
            if (Room.Members.Num() == Players && Ready == Players && StartTimer <= 0.f)
            {
                Net->StartRaid();
                StartTimer = 3.f;
            }
        }
        if (Room.bHasRaid) { NetStage = ENetStage::WaitRaid; StageTimer = 0.f; }
        if (StageTimer > 120.f) Finish(false, TEXT("Ready/start timed out"));
        return;
    }
    case ENetStage::WaitRaid:
    {
        UWorld* World = GetGameInstance()->GetWorld();
        AHWAinCharacter* Pawn = GetPawn();
        const bool bRaidMap = World && World->GetOutermost()->GetName().EndsWith(TEXT("Hwanghon_OnlineRaid"));
        AHWRaidWorldBridge* Bridge = World ? Cast<AHWRaidWorldBridge>(UGameplayStatics::GetActorOfClass(World, AHWRaidWorldBridge::StaticClass())) : nullptr;
        if (!Room.bHasRaid || !bRaidMap || !Pawn || !Bridge || StageTimer < 2.f)
        {
            if (StageTimer > 90.f) Finish(false, TEXT("Raid map/pawn/bridge not ready"));
            return;
        }
        RecordIdentity(Pawn, Net->GetProfile().Character, true);
        Report->SetNumberField(TEXT("party_size"), Room.Raid.Players.Num());
        // One player = one character: the creation API refuses once a character exists.
        const bool bSwitch = Net->CreateCharacter(TEXT("Switcher"), Net->GetProfile().Character == TEXT("ain") ? FName(TEXT("kain")) : FName(TEXT("ain")));
        Gate(TEXT("no_character_switch"), !bSwitch, TEXT("CreateCharacter refused in raid (character already created)"));
        if (bResume) WriteShare(FString::Printf(TEXT("client%d.resumed"), Index), KnownId);
        NetStage = ENetStage::Raid;
        StageTimer = 0.f;
        return;
    }
    case ENetStage::Raid:
        TickRaid(Dt);
        return;
    default:
        return;
    }
}

void UHWSystemQASubsystem::ConsumeRaidEvents(const FHWRaidNetSnapshot& R)
{
    for (const FHWRaidNetEvent& E : R.Events)
    {
        if (E.Id <= LastEventId) continue;
        LastEventId = E.Id;
        const FString Type = E.Type.ToString();
        ++Counters.FindOrAdd(TEXT("ev_") + Type);
        if (E.Type == TEXT("telegraph"))
        {
            TeleEnd = E.Time + E.Duration;
            TeleTarget = E.PlayerId;
            if (!LastTelegraphTarget.IsEmpty() && LastTelegraphTarget != E.PlayerId) ++TargetSwitches;
            LastTelegraphTarget = E.PlayerId;
            TSharedPtr<FJsonObject> T = MakeShared<FJsonObject>();
            T->SetNumberField(TEXT("rt"), E.Time);
            T->SetStringField(TEXT("target"), E.PlayerId);
            T->SetNumberField(TEXT("dur"), E.Duration);
            TSharedPtr<FJsonObject> Threat = MakeShared<FJsonObject>();
            for (const FHWRaidNetPlayer& P : R.Players) Threat->SetNumberField(P.Id, P.Threat - AnisoDist(P.X, P.Y, R.Boss.X, R.Boss.Y) * 10.f);
            T->SetObjectField(TEXT("score"), Threat);
            TelegraphLog.Add(MakeShared<FJsonValueObject>(T));
        }
        else if (E.Type != TEXT("hit") && E.Type != TEXT("swing") && E.Type != TEXT("whiff") && E.Type != TEXT("feedback"))
        {
            Note(FString::Printf(TEXT("event %s player=%s part=%s name=%s rt=%.1f"), *Type, *E.PlayerId, *E.PartId.ToString(), *E.Name, E.Time));
        }
    }
}

void UHWSystemQASubsystem::SampleRaid(const FHWRaidNetSnapshot& R)
{
    UWorld* World = GetGameInstance()->GetWorld();
    TSharedPtr<FJsonObject> S = MakeShared<FJsonObject>();
    S->SetNumberField(TEXT("t"), Elapsed);
    S->SetNumberField(TEXT("rt"), R.Time);
    S->SetStringField(TEXT("st"), R.State.ToString());
    S->SetNumberField(TEXT("ph"), R.Phase);
    TSharedPtr<FJsonObject> B = MakeShared<FJsonObject>();
    B->SetNumberField(TEXT("hp"), R.Boss.Hp);
    B->SetNumberField(TEXT("max"), R.Boss.MaxHp);
    B->SetNumberField(TEXT("posture"), R.Boss.Posture);
    B->SetStringField(TEXT("state"), R.Boss.State.ToString());
    B->SetNumberField(TEXT("x"), R.Boss.X);
    B->SetNumberField(TEXT("y"), R.Boss.Y);
    TArray<TSharedPtr<FJsonValue>> Parts;
    for (const FHWRaidNetBossPart& P : R.Boss.Parts)
    {
        TSharedPtr<FJsonObject> O = MakeShared<FJsonObject>();
        O->SetStringField(TEXT("id"), P.Id.ToString());
        O->SetNumberField(TEXT("hp"), P.Hp);
        O->SetNumberField(TEXT("max"), P.MaxHp);
        O->SetBoolField(TEXT("broken"), P.bBroken);
        Parts.Add(MakeShared<FJsonValueObject>(O));
    }
    B->SetArrayField(TEXT("parts"), Parts);
    S->SetObjectField(TEXT("boss"), B);
    TArray<TSharedPtr<FJsonValue>> Ps;
    for (const FHWRaidNetPlayer& P : R.Players)
    {
        TSharedPtr<FJsonObject> O = MakeShared<FJsonObject>();
        O->SetStringField(TEXT("id"), P.Id);
        O->SetStringField(TEXT("char"), P.Character.ToString());
        O->SetNumberField(TEXT("hp"), P.Hp);
        O->SetNumberField(TEXT("max"), P.MaxHp);
        O->SetNumberField(TEXT("stamina"), P.Stamina);
        O->SetNumberField(TEXT("ult"), P.Ultimate);
        O->SetNumberField(TEXT("downT"), P.DownTime);
        O->SetNumberField(TEXT("revive"), P.ReviveProgress);
        O->SetBoolField(TEXT("dead"), P.bDead);
        O->SetBoolField(TEXT("conn"), P.bConnected);
        O->SetNumberField(TEXT("threat"), P.Threat);
        O->SetNumberField(TEXT("dmg"), P.DamageDone);
        O->SetNumberField(TEXT("x"), P.X);
        O->SetNumberField(TEXT("y"), P.Y);
        O->SetStringField(TEXT("target"), P.TargetPart.ToString());
        TArray<TSharedPtr<FJsonValue>> Cds;
        for (const FHWRaidNetSkillState& K : P.Skills) Cds.Add(Num(K.CooldownRemaining));
        O->SetArrayField(TEXT("cds"), Cds);
        Ps.Add(MakeShared<FJsonValueObject>(O));
    }
    S->SetArrayField(TEXT("players"), Ps);
    TArray<TSharedPtr<FJsonValue>> Hz;
    for (const FHWRaidNetHazard& H : R.Hazards)
    {
        Hz.Add(Str(FString::Printf(TEXT("%s%s:%s"), H.bArenaHazard ? TEXT("arena_") : TEXT(""), *H.Id.ToString(), *H.Phase.ToString())));
        HazardPhasesSeen.Add(FString::Printf(TEXT("%s:%s"), H.bArenaHazard ? TEXT("arena") : TEXT("expedition"), *H.Phase.ToString()));
    }
    S->SetArrayField(TEXT("hazards"), Hz);
    int32 Done = 0;
    for (const FHWRaidNetExpeditionNode& N : R.Expedition.Nodes) Done += N.bDone ? 1 : 0;
    S->SetNumberField(TEXT("nodes_done"), Done);
    S->SetNumberField(TEXT("nodes"), R.Expedition.Nodes.Num());
    S->SetBoolField(TEXT("gate_open"), R.Gate.bOpen);
    S->SetBoolField(TEXT("checkpoint"), R.Expedition.Checkpoint.bValid);
    // What the UE world shows for that snapshot (presentation/reconciliation).
    int32 Remote = 0, HazardProxies = 0, NodeProxies = 0, GateProxies = 0;
    for (TActorIterator<AHWRaidRemoteAvatar> It(World); It; ++It) ++Remote;
    for (TActorIterator<AHWRaidHazardProxy> It(World); It; ++It) ++HazardProxies;
    for (TActorIterator<AHWRaidExpeditionNodeProxy> It(World); It; ++It) ++NodeProxies;
    for (TActorIterator<AHWRaidGateProxy> It(World); It; ++It) ++GateProxies;
    S->SetNumberField(TEXT("ue_remote_avatars"), Remote);
    S->SetNumberField(TEXT("ue_hazard_proxies"), HazardProxies);
    S->SetNumberField(TEXT("ue_node_proxies"), NodeProxies);
    S->SetNumberField(TEXT("ue_gate_proxies"), GateProxies);
    if (AHWAinCharacter* Pawn = GetPawn())
    {
        S->SetNumberField(TEXT("ue_pawn_x"), Pawn->GetActorLocation().X);
        S->SetNumberField(TEXT("ue_pawn_y"), Pawn->GetActorLocation().Y);
        S->SetNumberField(TEXT("ue_pawn_hp"), Pawn->GetCombat()->GetHealth());
        S->SetStringField(TEXT("ue_pawn_class"), Pawn->GetClass()->GetName());
    }
    if (AHWBossCharacter* Boss = Cast<AHWBossCharacter>(UGameplayStatics::GetActorOfClass(World, AHWBossCharacter::StaticClass())))
    {
        S->SetNumberField(TEXT("ue_boss_hp"), Boss->GetHealth());
        S->SetNumberField(TEXT("ue_boss_x"), Boss->GetActorLocation().X);
        S->SetNumberField(TEXT("ue_boss_y"), Boss->GetActorLocation().Y);
    }
    int32 UEBrokenParts = 0, UEParts = 0;
    for (TActorIterator<AHWBossPartTarget> It(World); It; ++It)
    {
        ++UEParts;
        UEBrokenParts += IHWCombatTargetInterface::Execute_IsSystemTargetDead(*It) ? 1 : 0;
    }
    S->SetNumberField(TEXT("ue_parts"), UEParts);
    S->SetNumberField(TEXT("ue_parts_broken"), UEBrokenParts);
    Timeline.Add(MakeShared<FJsonValueObject>(S));
}

void UHWSystemQASubsystem::TickRaid(float Dt)
{
    UHWRaidNetworkSubsystem* Net = GetGameInstance()->GetSubsystem<UHWRaidNetworkSubsystem>();
    const FHWPartyNetSnapshot Room = Net->GetRoom();

    // In-process reconnect with the session token (client index 3 in the 4P scenario).
    if (Players >= 4 && Index == 3 && HasShare(TEXT("retried")) && ReconnectStage < 3)
    {
        ReconnectTimer += Dt;
        if (ReconnectStage == 0 && ReconnectTimer > 8.f)
        {
            ReleaseAll();
            Note(TEXT("reconnect: disconnecting"));
            Net->Disconnect();
            ReconnectStage = 1;
            ReconnectTimer = 0.f;
            return;
        }
        if (ReconnectStage == 1)
        {
            if (ReconnectTimer > 3.f)
            {
                Note(TEXT("reconnect: connecting with session token"));
                Net->Connect(ServerUrl, KnownToken, Param(TEXT("HWName=")));
                ReconnectStage = 2;
                ReconnectTimer = 0.f;
            }
            return;
        }
        if (ReconnectStage == 2)
        {
            const FHWRaidNetPlayer* MeAgain = Room.bHasRaid ? Room.Raid.Players.FindByPredicate([Net](const FHWRaidNetPlayer& P) { return P.Id == Net->GetPlayerId(); }) : nullptr;
            if (Net->IsConnected() && MeAgain && MeAgain->bConnected)
            {
                Gate(TEXT("reconnect_token"), Net->GetPlayerId() == KnownId,
                    FString::Printf(TEXT("same player %s, raid %s state %s"), *Net->GetPlayerId(), *Room.Raid.RaidId, *Room.Raid.State.ToString()));
                WriteShare(TEXT("client3.reconnected"), KnownId);
                ReconnectStage = 3;
            }
            else if (ReconnectTimer > 30.f)
            {
                Gate(TEXT("reconnect_token"), false, TEXT("no raid snapshot after reconnect"));
                ReconnectStage = 3;
            }
            return;
        }
    }

    if (!Room.bHasRaid) return;
    const FHWRaidNetSnapshot& R = Room.Raid;
    ConsumeRaidEvents(R);
    const FHWRaidNetPlayer* MePtr = R.Players.FindByPredicate([Net](const FHWRaidNetPlayer& P) { return P.Id == Net->GetPlayerId(); });
    if (!MePtr) return;
    const FHWRaidNetPlayer& Me = *MePtr;

    SampleTimer += Dt;
    if (SampleTimer >= 1.f)
    {
        SampleTimer = 0.f;
        SampleRaid(R);
    }

    if (R.State != LastRaidState)
    {
        Note(FString::Printf(TEXT("raid state %s -> %s (rt %.1f)"), *LastRaidState.ToString(), *R.State.ToString(), R.Time));
        if (R.State == TEXT("wiped"))
        {
            int32 Alive = 0;
            for (const FHWRaidNetPlayer& P : R.Players) Alive += (P.Hp > 0.f && !P.bDead) ? 1 : 0;
            Gate(TEXT("wipe"), Alive == 0, FString::Printf(TEXT("all %d players down (rt %.1f)"), R.Players.Num(), R.Time));
        }
        if (LastRaidState == TEXT("wiped") && R.State == TEXT("explore"))
        {
            bool bFull = true;
            for (const FHWRaidNetPlayer& P : R.Players) bFull &= P.Hp >= P.MaxHp && !P.bDead;
            const bool bAtCheckpoint = !R.Expedition.Checkpoint.bValid || AnisoDist(Me.X, Me.Y, R.Expedition.Checkpoint.X, R.Expedition.Checkpoint.Y) < 120.f;
            Gate(TEXT("retry"), bFull && bAtCheckpoint, FString::Printf(TEXT("explore again, all full hp=%d, at checkpoint %s=%d, gate open=%d"),
                bFull ? 1 : 0, *R.Expedition.Checkpoint.Id, bAtCheckpoint ? 1 : 0, R.Gate.bOpen ? 1 : 0));
            if (Role == TEXT("host")) WriteShare(TEXT("retried"), FString::SanitizeFloat(R.Time));
        }
        LastRaidState = R.State;
        Path.Reset();
    }
    if (R.Phase != LastRaidPhase)
    {
        if (LastRaidPhase >= 0) Note(FString::Printf(TEXT("boss stage %d -> %d, max hp %.0f"), LastRaidPhase, R.Phase, R.Boss.MaxHp));
        LastRaidPhase = R.Phase;
    }
    for (const FHWRaidNetBossPart& P : R.Boss.Parts)
    {
        const FString Key = FString::Printf(TEXT("%d:%s"), R.Phase, *P.Id.ToString());
        if (P.bBroken && !PartsBrokenNet.Contains(Key)) { PartsBrokenNet.Add(Key); Note(TEXT("part broken (server) ") + Key); }
    }

    // Scenario control
    bWipeMode = HasShare(TEXT("wipe")) && !HasShare(TEXT("retried"));
    if (R.State == TEXT("fight"))
    {
        FightTime += Dt;
        if (R.Phase >= 1) PhaseOneTime += Dt;
        if (Role == TEXT("host") && Players >= 4 && !HasShare(TEXT("wipe")) && !HasShare(TEXT("retried"))
            && (PhaseOneTime > 20.f || FightTime > 420.f))
        {
            WriteShare(TEXT("wipe"), FString::SanitizeFloat(R.Time));
            Note(TEXT("scenario: party stops defending (wipe test)"));
        }
    }
    if (Role == TEXT("host") && Players >= 4 && HasShare(TEXT("client3.reconnected")) && HasShare(TEXT("client2.resumed")))
    {
        if (PostReconnectTimer < 0.f) { PostReconnectTimer = 0.f; Note(TEXT("scenario: both reconnects done, playing on")); }
        PostReconnectTimer += Dt;
        if (PostReconnectTimer > 40.f) { WriteShare(TEXT("end"), TEXT("4p")); }
    }

    // Victim bookkeeping (2P down/revive gate): the server's "revive" event names the revived player.
    if (VictimIndex == Index && !bVictimRevived)
    {
        if (Me.Hp <= 0.f && !Me.bDead && !bVictimDowned && R.State != TEXT("wiped"))
        {
            bVictimDowned = true;
            VictimDownAt = R.Time;
            Gate(TEXT("down"), Me.DownTime > 0.f, FString::Printf(TEXT("downed at rt %.1f (%s), bleed-out %.1fs"), R.Time, *R.State.ToString(), Me.DownTime));
        }
        for (const FHWRaidNetEvent& E : R.Events)
        {
            if (E.Type == TEXT("revive") && E.PlayerId == Me.Id && bVictimDowned && E.Time >= VictimDownAt)
            {
                bVictimRevived = true;
                const float Frac = Me.MaxHp > 0.f ? Me.Hp / Me.MaxHp : 0.f;
                Gate(TEXT("revive_30pct"), FMath::Abs(Frac - 0.30f) < 0.02f && (E.Time - VictimDownAt) >= 3.f,
                    FString::Printf(TEXT("revived with %.0f/%.0f hp (%.0f%%) %.1fs after going down"), Me.Hp, Me.MaxHp, Frac * 100.f, E.Time - VictimDownAt));
                break;
            }
        }
        if (R.State == TEXT("wiped")) bVictimDowned = false;   // try again after the retry
    }

    DecisionTimer -= Dt;
    if (DecisionTimer > 0.f) return;
    DecisionTimer = 0.05f;

    const bool bAlive = Me.Hp > 0.f && !Me.bDead;
    if (R.State == TEXT("explore"))
    {
        if (!bAlive) { ReleaseAll(); return; }
        RaidExplore(R, Me);
    }
    else if (R.State == TEXT("fight"))
    {
        RaidFight(R, Me, 0.05f);
    }
    else if (R.State == TEXT("wiped"))
    {
        ReleaseAll();
        RetryTimer += 0.05f;
        if (Role == TEXT("host") && RetryTimer > 3.f && (!bRetrySent || RetryTimer > 8.f))
        {
            Note(TEXT("host: retry"));
            Net->RetryRaid();
            bRetrySent = true;
            RetryTimer = 0.f;
        }
    }
    else if (R.State == TEXT("clear"))
    {
        ReleaseAll();
        ClearTimer += 0.05f;
        if (R.bHasResult && (R.RewardStatus == TEXT("saved") || ClearTimer > 20.f) && !Gates->HasField(TEXT("clear_reward")))
        {
            Gate(TEXT("clear_reward"), R.RewardStatus == TEXT("saved"), TEXT("result rewardStatus=") + R.RewardStatus);
            if (Role == TEXT("host")) WriteShare(TEXT("end"), TEXT("clear"));
        }
    }
    else
    {
        Steer(0.f, false);
    }
}

bool UHWSystemQASubsystem::ReviveDuty(const FHWRaidNetSnapshot& R, const FHWRaidNetPlayer& Me)
{
    // The nearest living teammate goes to a downed player and holds Revive (3 s, server-timed).
    const FHWRaidNetPlayer* Downed = nullptr;
    for (const FHWRaidNetPlayer& P : R.Players) if (P.Id != Me.Id && P.Hp <= 0.f && !P.bDead) { Downed = &P; break; }
    if (!Downed)
    {
        if (!ReviveHelping.IsEmpty())
        {
            const FHWRaidNetPlayer* Helped = R.Players.FindByPredicate([this](const FHWRaidNetPlayer& P) { return P.Id == ReviveHelping; });
            if (Helped && Helped->Hp > 0.f)
            {
                ++Counters.FindOrAdd(TEXT("revives_done"));
                Note(FString::Printf(TEXT("revive: %s is up with %.0f/%.0f"), *ReviveHelping, Helped->Hp, Helped->MaxHp));
            }
            ReviveHelping.Reset();
        }
        Hold(TEXT("Revive"), false);
        return false;
    }
    const FHWRaidNetPlayer* Nearest = nullptr;
    float Best = TNumericLimits<float>::Max();
    for (const FHWRaidNetPlayer& P : R.Players)
    {
        if (P.Hp <= 0.f || P.bDead || !P.bConnected) continue;
        const float PD = AnisoDist(P.X, P.Y, Downed->X, Downed->Y);
        if (PD < Best) { Best = PD; Nearest = &P; }
    }
    if (!Nearest || Nearest->Id != Me.Id)
    {
        Hold(TEXT("Revive"), false);
        return false;
    }
    if (ReviveHelping != Downed->Id)
    {
        ReviveHelping = Downed->Id;
        LastReviveProgress = 0.f;
        ReviveStall = 0.f;
        Note(TEXT("revive: going to ") + Downed->Id);
    }
    // Stand clear of a hazard the downed player lies in (hazard damage cancels the channel).
    float SpotX = Downed->X, SpotY = Downed->Y;
    for (const FHWRaidNetHazard& H : R.Hazards)
    {
        const float HD = AnisoDist(Downed->X, Downed->Y, H.X, H.Y);
        if (HD < H.Radius + 40.f)
        {
            const float Len = FMath::Max(1.f, Downed->X - H.X);
            SpotX = Downed->X + 60.f * (Downed->X >= H.X ? 1.f : -1.f);
            SpotY = Downed->Y;
            (void)Len;
            break;
        }
    }
    if (!SteerToServerPoint(Me, SpotX, SpotY, 15.f))
    {
        Hold(TEXT("Revive"), false);
        return true;
    }
    // A hit clears the server-side hold (raid.cjs hurt()); press again when progress stalls.
    if (HeldActions.Contains(TEXT("Revive")))
    {
        if (Downed->ReviveProgress > LastReviveProgress + 0.001f) ReviveStall = 0.f;
        else if ((ReviveStall += 0.05f) > 0.4f) { Hold(TEXT("Revive"), false); ReviveStall = 0.f; }
    }
    else
    {
        Hold(TEXT("Revive"), true);
        ++Counters.FindOrAdd(TEXT("revive_press"));
    }
    LastReviveProgress = Downed->ReviveProgress;
    return true;
}

void UHWSystemQASubsystem::RaidExplore(const FHWRaidNetSnapshot& R, const FHWRaidNetPlayer& Me)
{
    if (ReviveDuty(R, Me)) return;
    // 2P down/revive: the victim stands in an expedition hazard (no boss involved) until downed.
    if (VictimIndex == Index && !bVictimRevived)
    {
        for (const FHWRaidNetHazard& H : R.Hazards)
        {
            if (H.bArenaHazard) continue;
            SteerToServerPoint(Me, H.X + H.Radius * 0.6f, H.Y, 8.f);
            return;
        }
    }
    // Nodes are shared round-robin by party index (respecting "requires" via bEnabled).
    const FHWRaidNetExpeditionNode* Mine = nullptr;
    bool bOthersPending = false;
    for (int32 K = 0; K < R.Expedition.Nodes.Num(); ++K)
    {
        const FHWRaidNetExpeditionNode& N = R.Expedition.Nodes[K];
        if (!N.bEnabled || N.bDone) continue;
        if (K % Players == Index % Players) { if (!Mine) Mine = &N; }
        else bOthersPending = true;
    }
    if (Mine)
    {
        if (SteerToServerPoint(Me, Mine->X, Mine->Y, FMath::Min(55.f, Mine->Range * 0.45f)) && ActionTimer <= 0.f)
        {
            Tap(TEXT("Interact"));
            ActionTimer = 0.6f;
        }
        return;
    }
    if (bOthersPending || !R.Gate.bOpen)
    {
        // Wait on this side of the gate.
        SteerToServerPoint(Me, R.Gate.X - Cell * 2.f, R.Gate.Y, 40.f);
        return;
    }
    SteerToServerPoint(Me, R.Gate.X + Cell * 1.5f, R.Gate.Y, 12.f);
}

void UHWSystemQASubsystem::RaidFight(const FHWRaidNetSnapshot& R, const FHWRaidNetPlayer& Me, float Dt)
{
    UHWRaidNetworkSubsystem* Net = GetGameInstance()->GetSubsystem<UHWRaidNetworkSubsystem>();
    const bool bAlive = Me.Hp > 0.f && !Me.bDead;

    if (!bAlive)
    {
        ReleaseAll();
        return;
    }

    const FHWRaidNetBoss& B = R.Boss;
    const float Reach = R.Reach > 0.f ? R.Reach : 150.f;
    const float D = AnisoDist(Me.X, Me.Y, B.X, B.Y);

    // Part target (sent as the "target" intent; the server decides what breaks).
    FName Want = NAME_None;
    for (const FHWRaidNetBossPart& P : B.Parts) if (P.bBreakable && !P.bBroken) { Want = P.Id; break; }
    if (Want.IsNone()) for (const FHWRaidNetBossPart& P : B.Parts) if (P.Id == TEXT("core")) { Want = P.Id; break; }
    if (Want.IsNone() && B.Parts.Num() > 0) Want = B.Parts[0].Id;
    TargetTimer -= Dt;
    if (!Want.IsNone() && Me.TargetPart != Want && TargetTimer <= 0.f)
    {
        Net->SendTarget(Want);
        TargetTimer = 0.4f;
    }

    const bool bVictim = VictimIndex == Index && !bVictimRevived;

    if (!bWipeMode && ReviveDuty(R, Me)) return;
    if (HeldActions.Contains(TEXT("Revive")) && ReviveHelping.IsEmpty()) Hold(TEXT("Revive"), false);

    // Defense: counter targeted counterable tells in the window, step out + dodge the rest.
    if (!bVictim && !bWipeMode && B.State == TEXT("telegraph") && TeleEnd > 0.f)
    {
        const float Remaining = TeleEnd - R.Time;
        const bool bCounterable = B.bPatternCounterable;
        if (bCounterable && TeleTarget == Me.Id && D <= Reach)
        {
            Steer(AnisoYaw(Me.X, Me.Y, B.X, B.Y), false);
            if (Remaining <= 0.11f && Remaining > -0.02f && ActionTimer <= 0.f)
            {
                Tap(TEXT("Attack"));
                ActionTimer = 0.05f;
                ++Counters.FindOrAdd(TEXT("counter_attempts"));
            }
            return;
        }
        if (!bCounterable && Remaining < 1.2f)
        {
            Steer(AnisoYaw(B.X, B.Y, Me.X, Me.Y), true);
            if (Remaining < 0.2f && ActionTimer <= 0.f)
            {
                Tap(TEXT("Dodge"));
                ActionTimer = 0.3f;
            }
            return;
        }
    }

    if (D > Reach * 0.7f)
    {
        SteerToServerPoint(Me, B.X, B.Y, Reach * 0.6f);
        return;
    }
    Steer(AnisoYaw(Me.X, Me.Y, B.X, B.Y), false);
    if (ActionTimer > 0.f) return;
    if (Me.Ultimate >= 100.f)
    {
        Tap(TEXT("Ultimate"));
        ActionTimer = 0.3f;
        return;
    }
    static const FName SkillActions[4] = { TEXT("Skill1"), TEXT("Skill2"), TEXT("Skill3"), TEXT("Skill4") };
    int32 Pick = -1;
    for (int32 I = 0; I < Me.Skills.Num() && I < 4; ++I)
    {
        if (Me.Skills[I].CooldownRemaining <= 0.f && (Pick < 0 || SkillAttemptsNet[I] < SkillAttemptsNet[Pick])) Pick = I;
    }
    if (Pick >= 0 && Me.Stamina > 40.f && !bVictim)
    {
        Tap(SkillActions[Pick]);
        ++SkillAttemptsNet[Pick];
        ActionTimer = 0.3f;
        return;
    }
    Tap(TEXT("Attack"));
    ActionTimer = 0.12f;
}

// ---------------------------------------------------------------- showcase (motion review)

void UHWSystemQASubsystem::Shot(const FString& Name)
{
    if (ShotDir.IsEmpty()) return;
    FScreenshotRequest::RequestScreenshot(FPaths::Combine(ShotDir, Name + TEXT(".png")), false, false);
    Note(TEXT("shot ") + Name);
}

void UHWSystemQASubsystem::MeasureBody(const FString& Label, AActor* Actor)
{
    ACharacter* Character = Cast<ACharacter>(Actor);
    USkeletalMeshComponent* Mesh = Character ? Character->GetMesh()
        : (Actor ? Actor->FindComponentByClass<USkeletalMeshComponent>() : nullptr);
    if (!Mesh) return;
    TSharedPtr<FJsonObject> O = MakeShared<FJsonObject>();
    O->SetStringField(TEXT("label"), Label);
    O->SetStringField(TEXT("actor"), Actor->GetName());
    O->SetArrayField(TEXT("loc"), { Num(FMath::RoundToFloat(Actor->GetActorLocation().X)), Num(FMath::RoundToFloat(Actor->GetActorLocation().Y)) });
    O->SetNumberField(TEXT("speed"), FMath::RoundToFloat(Actor->GetVelocity().Size2D()));
    O->SetStringField(TEXT("mesh"), Mesh->GetSkeletalMeshAsset() ? Mesh->GetSkeletalMeshAsset()->GetName() : TEXT("-"));
    UAnimInstance* Anim = Mesh->GetAnimInstance();
    O->SetStringField(TEXT("anim"), Anim ? Anim->GetClass()->GetName() : TEXT("-"));
    O->SetBoolField(TEXT("montage"), Anim && Anim->Montage_IsPlaying(nullptr));
    O->SetBoolField(TEXT("upper_body"), Anim && Anim->IsSlotActive(TEXT("UpperBody")));
    O->SetBoolField(TEXT("full_body"), Anim && Anim->IsSlotActive(TEXT("FullBody")));
    // Bone positions in the actor frame (cm): what the body is actually doing.
    const FTransform ActorT = Actor->GetActorTransform();
    const TCHAR* Bones[] = { TEXT("pelvis"), TEXT("head"), TEXT("hand_r"), TEXT("weapon_r"), TEXT("hand_l"), TEXT("foot_l") };
    // Mixamo rigs (the training boss) name the same bones differently; keys stay the standard ones.
    static const TMap<FString, FName> Mixamo = {
        { TEXT("pelvis"), TEXT("mixamorig_Hips") }, { TEXT("head"), TEXT("mixamorig_Head") },
        { TEXT("hand_r"), TEXT("mixamorig_RightHand") }, { TEXT("hand_l"), TEXT("mixamorig_LeftHand") },
        { TEXT("foot_l"), TEXT("mixamorig_LeftFoot") }, { TEXT("weapon_r"), TEXT("mixamorig_RightHandSlot") } };
    for (const TCHAR* Bone : Bones)
    {
        FName Name = Bone;
        if (Mesh->GetBoneIndex(Name) == INDEX_NONE)
        {
            const FName* Alt = Mixamo.Find(Bone);
            if (!Alt || Mesh->GetBoneIndex(*Alt) == INDEX_NONE) continue;
            Name = *Alt;
        }
        const FVector L = ActorT.InverseTransformPosition(Mesh->GetBoneLocation(Name));
        TArray<TSharedPtr<FJsonValue>> V = { Num(FMath::RoundToFloat(L.X)), Num(FMath::RoundToFloat(L.Y)), Num(FMath::RoundToFloat(L.Z)) };
        O->SetArrayField(Bone, V);
    }
    BodySamples.Add(MakeShared<FJsonValueObject>(O));
}

void UHWSystemQASubsystem::TickShowcase(float Dt)
{
    UWorld* World = GetGameInstance()->GetWorld();
    AHWAinCharacter* Pawn = GetPawn();
    if (!World || !Pawn)
    {
        if (Elapsed > 90.f) Finish(false, TEXT("No pawn for showcase"));
        return;
    }
    if (ShowTime < 0.f)
    {
        if (Elapsed < 2.f) return;
        ShowTime = 0.f;
        ShowStart = World->GetTimeSeconds();
        ShotDir = Param(TEXT("HWQAShots="));
        RecordIdentity(Pawn, ExpectCharacter.IsNone() ? FName(TEXT("ain")) : ExpectCharacter, false);

        // The boss would walk in and swing: park it out of shot for a body/motion review.
        for (TActorIterator<AHWBossCharacter> It(World); It; ++It)
        {
            It->SetActorTickEnabled(false);
            It->SetActorHiddenInGame(true);
            It->SetActorLocation(FVector(4000.f, 4000.f, 200.f));
        }
        const FVector P = Pawn->GetActorLocation();
        Pawn->SetActorRotation(FRotator::ZeroRotator);
        if (APlayerController* PC = GetPC())
        {
            PC->SetControlRotation(FRotator::ZeroRotator);
            Pawn->DisableInput(PC);
        }

        // The other characters as remote avatars (the path the online raid uses).
        const FName Others[4] = { TEXT("ain"), TEXT("kain"), TEXT("ryu"), TEXT("sera") };
        int32 Slot = 1;
        for (const FName& Id : Others)
        {
            if (Id == Pawn->GetSystemCharacterId()) continue;
            const FVector Where = P + FVector(0.f, 170.f * Slot++, 0.f);
            if (AHWRaidRemoteAvatar* A = World->SpawnActor<AHWRaidRemoteAvatar>(AHWRaidRemoteAvatar::StaticClass(), Where, FRotator::ZeroRotator))
            {
                A->ApplySnapshot(Id.ToString(), Id, Where, 0.f, 1000.f, 1000.f, false, 0.016f);
                ShowAvatars.Add(A);
            }
        }
        // Key light from the camera side (front shots look along -X): faces lit, shoulders not blown out.
        if (ADirectionalLight* Sun = World->SpawnActor<ADirectionalLight>(ADirectionalLight::StaticClass(), P, FRotator(-28.f, 200.f, 0.f)))
        {
            Sun->GetLightComponent()->SetIntensity(2.2f);
        }
        ACameraActor* Cam = World->SpawnActor<ACameraActor>(ACameraActor::StaticClass(), P, FRotator::ZeroRotator);
        if (Cam)
        {
            Cam->GetCameraComponent()->SetFieldOfView(50.f);
            Cam->GetCameraComponent()->bConstrainAspectRatio = false;
            ShowCamera = Cam;
            if (APlayerController* PC = GetPC()) PC->SetViewTargetWithBlend(Cam, 0.f);
        }
        auto Front = [this, P]()
        {
            if (AActor* C = ShowCamera.Get())
            {
                const FVector Center = P + FVector(0.f, 255.f, 0.f);
                const FVector From = Center + FVector(900.f, 0.f, 60.f);
                C->SetActorLocationAndRotation(From, UKismetMathLibrary::FindLookAtRotation(From, Center));
            }
        };
        auto ShowOthers = [this](bool bShow) { for (auto& A : ShowAvatars) if (AActor* Av = A.Get()) Av->SetActorHiddenInGame(!bShow); };
        auto Side = [this, P, ShowOthers]()
        {
            ShowOthers(false);   // the avatars stand behind the player from this side
            if (AActor* C = ShowCamera.Get())
            {
                const FVector Center = P + FVector(40.f, 0.f, 0.f);
                const FVector From = Center + FVector(0.f, -430.f, 30.f);
                C->SetActorLocationAndRotation(From, UKismetMathLibrary::FindLookAtRotation(From, Center));
            }
        };
        UHWPlayerPresentationComponent* Pres = Pawn->GetPresentation();
        float T = 0.f;
        auto At = [this](float When, TFunction<void()> Fn) { ShowSteps.Add(TPair<float, TFunction<void()>>(When, MoveTemp(Fn))); };
        // Warm-up: the Countess AnimBP plays its LevelStart intro and shaders compile on first sight.
        At(T += 0.2f, Front);
        At(T += 4.0f, [this, Pawn]() {
            Shot(TEXT("01_lineup_front"));
            MeasureBody(TEXT("idle"), Pawn);
            for (auto& A : ShowAvatars) MeasureBody(TEXT("avatar_idle"), A.Get()); });
        At(T += 0.2f, Side);
        At(T += 0.8f, [this, Pawn]() { Shot(TEXT("02_idle_side")); MeasureBody(TEXT("idle_side"), Pawn); });
        const EHWAbilitySlot Slots[5] = { EHWAbilitySlot::Skill1, EHWAbilitySlot::Skill2, EHWAbilitySlot::Skill3, EHWAbilitySlot::Skill4, EHWAbilitySlot::Ultimate };
        for (int32 I = 0; I < 5; ++I)
        {
            const EHWAbilitySlot S = Slots[I];
            const FString Name = I < 4 ? FString::Printf(TEXT("skill%d"), I + 1) : FString(TEXT("ult"));
            At(T += 0.8f, [this, Pres, S, Name]() {
                const bool bOk = Pres && Pres->PlayAbility(S);
                Note(FString::Printf(TEXT("play %s -> %d"), *Name, bOk ? 1 : 0)); });
            TArray<float> Offsets;
            if (I < 4) Offsets = { 0.15f, 0.40f, 0.75f };
            else Offsets = { 0.45f, 1.1f, 1.8f, 2.6f };
            for (int32 K = 0; K < Offsets.Num(); ++K)
            {
                const FString Tag = FString::Printf(TEXT("1%d_%s_%c_%03d"), I, *Name, TCHAR('a' + K), FMath::RoundToInt(Offsets[K] * 100.f));
                At(T + Offsets[K], [this, Pawn, Tag]() { Shot(Tag); MeasureBody(Tag, Pawn); });
            }
            T += Offsets.Last() + 0.4f;
        }
        // Real input: Q -> kit -> OnAbilityActivated -> presentation (no direct call).
        At(T += 1.0f, [this, Pawn]() {
            if (APlayerController* PC = GetPC()) Pawn->EnableInput(PC);
            if (Pawn->GetLockOn() && !Pawn->GetLockOn()->IsLocked()) Pawn->GetLockOn()->ToggleLockOn();
            Tap(TEXT("Skill1")); });
        At(T += 0.35f, [this, Pawn]() {
            UHWPlayerPresentationComponent* P2 = Pawn->GetPresentation();
            const float Cd = Pawn->GetCharacterKit()->GetSkill1Cooldown();
            Gate(TEXT("key_skill_motion"), Cd > 0.f && P2 && P2->GetOneShotMontage() != nullptr,
                FString::Printf(TEXT("Q -> skill1 cooldown %.2f, one-shot montage %s"), Cd,
                    P2 && P2->GetOneShotMontage() ? TEXT("playing") : TEXT("none")));
            Shot(TEXT("20_key_skill1"));
            MeasureBody(TEXT("key_skill1"), Pawn); });
        // Remote avatars follow server clips.
        At(T += 1.2f, [Front, ShowOthers]() { ShowOthers(true); Front(); });
        At(T += 0.1f, [this]() {
            const FName Clips[3] = { TEXT("skill3"), TEXT("skill1"), TEXT("ult") };
            const float Durs[3] = { 1.f, 0.9f, 3.f };
            for (int32 I = 0; I < ShowAvatars.Num(); ++I)
            {
                if (AHWRaidRemoteAvatar* A = Cast<AHWRaidRemoteAvatar>(ShowAvatars[I].Get())) A->ApplyAction(Clips[I % 3], 0.f, Durs[I % 3], false);
            } });
        At(T += 0.35f, [this]() { Shot(TEXT("30_avatars_clips_a")); for (auto& A : ShowAvatars) MeasureBody(TEXT("avatar_clip_a"), A.Get()); });
        At(T += 0.45f, [this]() { Shot(TEXT("31_avatars_clips_b")); for (auto& A : ShowAvatars) MeasureBody(TEXT("avatar_clip_b"), A.Get()); });
        // Replicated movement -> AnimBP locomotion (velocity fed from snapshots).
        At(T += 1.2f, [this]() { WalkFrom = ShowTime; });
        At(T += 1.0f, [this]() {
            Shot(TEXT("32_avatars_moving"));
            for (auto& A : ShowAvatars) MeasureBody(TEXT("avatar_moving"), A.Get());
            WalkFrom = -1.f;
            // Stop like the server would: one more snapshot at rest.
            for (auto& A : ShowAvatars) if (AHWRaidRemoteAvatar* R = Cast<AHWRaidRemoteAvatar>(A.Get())) R->ApplySnapshot(R->GetPlayerId(), R->GetCharacterId(), R->GetActorLocation(), 0.f, 1000.f, 1000.f, false, 0.016f); });
        // Down: online hp 0 for the pawn, downed flag for avatars.
        At(T += 1.5f, [this, Pawn, Side]() {
            Side();
            Pawn->GetCombat()->ApplyAuthoritativeVitals(0.f, Pawn->GetCombat()->GetMaxHealth(), 0.f, true);
            for (auto& A : ShowAvatars) if (AHWRaidRemoteAvatar* R = Cast<AHWRaidRemoteAvatar>(A.Get())) R->ApplyAction(NAME_None, 0.f, 0.f, true); });
        At(T += 0.7f, [this, Pawn]() { Shot(TEXT("40_downed_side")); MeasureBody(TEXT("downed_a"), Pawn); });
        At(T += 0.2f, [Front, ShowOthers]() { ShowOthers(true); Front(); });
        At(T += 1.0f, [this, Pawn]() {
            Shot(TEXT("41_downed_b"));
            MeasureBody(TEXT("downed_b"), Pawn);
            for (auto& A : ShowAvatars) MeasureBody(TEXT("avatar_downed"), A.Get()); });
        // Revive: the ragdoll re-attaches and the body gets up.
        At(T += 0.6f, [this, Pawn]() {
            Pawn->GetCombat()->ApplyAuthoritativeVitals(Pawn->GetCombat()->GetMaxHealth() * 0.3f, Pawn->GetCombat()->GetMaxHealth(), 50.f, false);
            for (auto& A : ShowAvatars) if (AHWRaidRemoteAvatar* R = Cast<AHWRaidRemoteAvatar>(A.Get())) R->ApplyAction(NAME_None, 0.f, 0.f, false); });
        At(T += 0.35f, [this, Pawn]() { Shot(TEXT("50_getup_a")); MeasureBody(TEXT("getup_a"), Pawn); for (auto& A : ShowAvatars) MeasureBody(TEXT("avatar_getup_a"), A.Get()); });
        At(T += 1.2f, [this, Pawn]() { Shot(TEXT("51_getup_b")); MeasureBody(TEXT("getup_b"), Pawn); for (auto& A : ShowAvatars) MeasureBody(TEXT("avatar_getup_b"), A.Get()); });
        At(T += 0.5f, [this]() { Finish(true, TEXT("showcase done")); });
        return;
    }
    const float PrevShow = ShowTime;
    ShowTime = World->GetTimeSeconds() - ShowStart;   // world time: frames are slow while shaders compile
    if (WalkFrom >= 0.f)
    {
        // Snapshots walking the avatars toward the camera at 350 cm/s (server-style position updates).
        // Like the server: the snapshot position runs ahead at a fixed speed from where the walk began.
        const float StepDt = FMath::Max(0.001f, ShowTime - PrevShow);
        for (int32 I = 0; I < ShowAvatars.Num(); ++I)
        {
            if (AHWRaidRemoteAvatar* R = Cast<AHWRaidRemoteAvatar>(ShowAvatars[I].Get()))
            {
                if (WalkStart.Num() <= I) WalkStart.Add(R->GetActorLocation());
                const FVector To = WalkStart[I] + FVector(350.f * (ShowTime - WalkFrom), 0.f, 0.f);
                R->ApplySnapshot(R->GetPlayerId(), R->GetCharacterId(), To, 0.f, 1000.f, 1000.f, false, StepDt);
            }
        }
    }
    while (ShowStep < ShowSteps.Num() && ShowTime >= ShowSteps[ShowStep].Key)
    {
        ShowSteps[ShowStep].Value();
        ++ShowStep;
        if (bFinished) return;
    }
}

// ---------------------------------------------------------------- boss show (-HWQA=bossshow, doc 132)
// The boss fights a pawn that cannot die; every pattern is shot from the side at mid-telegraph, at each
// gameplay beat (the combat contact) and mid-recovery, with bone positions, then a flinch and the death.
void UHWSystemQASubsystem::TickBossShow(float Dt)
{
    UWorld* World = GetGameInstance()->GetWorld();
    AHWAinCharacter* Pawn = GetPawn();
    AHWBossCharacter* Boss = World ? Cast<AHWBossCharacter>(UGameplayStatics::GetActorOfClass(World, AHWBossCharacter::StaticClass())) : nullptr;
    if (!World || !Pawn || !Boss)
    {
        if (Elapsed > 90.f) Finish(false, TEXT("No pawn/boss for boss show"));
        return;
    }
    if (ShowTime < 0.f)
    {
        if (Elapsed < 2.f) return;
        ShowTime = 0.f;
        ShowStart = World->GetTimeSeconds();
        ShotDir = Param(TEXT("HWQAShots="));
        Pawn->GetCombat()->ConfigureCharacterStats(1.0e8f, 1.f, 0.f, 0.f, 100.f, 100.f);   // the target never dies
        if (APlayerController* PC = GetPC()) Pawn->DisableInput(PC);
        Boss->SetActorLocation(Pawn->GetActorLocation() + FVector(900.f, 0.f, 0.f));
        if (ADirectionalLight* Sun = World->SpawnActor<ADirectionalLight>(ADirectionalLight::StaticClass(), Pawn->GetActorLocation(), FRotator(-35.f, 120.f, 0.f)))
        {
            Sun->GetLightComponent()->SetIntensity(3.f);
            BossShowLight = Sun;
        }
        {
            USkeletalMeshComponent* M = Boss->GetMesh();
            const UHWBossPresentationComponent* Pres = Boss->FindComponentByClass<UHWBossPresentationComponent>();
            Note(FString::Printf(TEXT("boss body %s mode %d anim %s set %s scale %.2f yaw %.0f"),
                M && M->GetSkeletalMeshAsset() ? *M->GetSkeletalMeshAsset()->GetPathName() : TEXT("-"),
                M ? (int32)M->GetAnimationMode() : -1,
                M && M->GetAnimInstance() ? *M->GetAnimInstance()->GetClass()->GetName() : TEXT("-"),
                Pres && Pres->AnimationSet ? *Pres->AnimationSet->GetName() : TEXT("-"),
                M ? M->GetRelativeScale3D().X : 0.f, M ? M->GetRelativeRotation().Yaw : 0.f));
        }
        if (ACameraActor* Cam = World->SpawnActor<ACameraActor>(ACameraActor::StaticClass(), Pawn->GetActorLocation(), FRotator::ZeroRotator))
        {
            Cam->GetCameraComponent()->SetFieldOfView(50.f);
            Cam->GetCameraComponent()->bConstrainAspectRatio = false;
            ShowCamera = Cam;
            if (APlayerController* PC = GetPC()) PC->SetViewTargetWithBlend(Cam, 0.f);
        }
        return;
    }
    ShowTime = World->GetTimeSeconds() - ShowStart;

    // Side camera on the boss, square to the boss -> pawn line.
    if (AActor* C = ShowCamera.Get())
    {
        FVector Line = Pawn->GetActorLocation() - Boss->GetActorLocation();
        Line.Z = 0.f;
        const FVector Side = FVector::CrossProduct(Line.GetSafeNormal(), FVector::UpVector);
        const FVector Center = (Boss->GetActorLocation() * 0.7f + Pawn->GetActorLocation() * 0.3f) + FVector(0.f, 0.f, 10.f);
        const FVector From = Center + Side * 560.f + FVector(0.f, 0.f, 40.f);
        C->SetActorLocationAndRotation(From, UKismetMathLibrary::FindLookAtRotation(From, Center));
        if (AActor* L = BossShowLight.Get())
        {
            // Key light from over the camera's shoulder: the side we look at is the lit side.
            L->SetActorRotation(FRotator(-35.f, (Center - From).Rotation().Yaw + 25.f, 0.f));
        }
    }
    auto Snap = [this, Boss](const FString& Tag)
    {
        Shot(Tag);
        MeasureBody(Tag, Boss);
        const UHWBossPresentationComponent* Pres = Boss->FindComponentByClass<UHWBossPresentationComponent>();
        if (Pres && Pres->GetShownClip())
        {
            const float Len = FMath::Max(0.001f, Pres->GetShownClip()->GetPlayLength());
            Note(FString::Printf(TEXT("%s clip %s t=%.3f (%.3f) phase %.3f"), *Tag, *Pres->GetShownClip()->GetName(),
                Pres->GetShownTime(), Pres->GetShownTime() / Len, Boss->GetPresentationStatePhase()));
        }
    };

    if (ShowTime < 5.f) return;   // warm-up (shaders)
    if (!BossShotsTaken.Contains(TEXT("00_walk")) && Boss->GetVelocity().Size2D() > 30.f) { BossShotsTaken.Add(TEXT("00_walk")); Snap(TEXT("00_walk")); }

    const EHWBossState State = Boss->GetBossState();
    const FName Pattern = Boss->GetCurrentPatternId();
    const float Phase = Boss->GetBossStateNormalized();
    if (State == EHWBossState::Idle && !BossShotsTaken.Contains(TEXT("01_idle")) && Boss->GetVelocity().Size2D() < 5.f)
    {
        BossShotsTaken.Add(TEXT("01_idle"));
        Snap(TEXT("01_idle"));
    }
    if (State != BossShowState || Pattern != BossShowPattern)
    {
        BossShowState = State;
        BossShowPattern = Pattern;
        BossShowPrevPhase = 0.f;
    }
    auto Once = [this, &Snap](const FString& Tag)
    {
        if (BossShotsTaken.Contains(Tag)) return;
        BossShotsTaken.Add(Tag);
        Snap(Tag);
    };
    const FString P = Pattern.ToString();
    if (State == EHWBossState::Tell && BossShowPrevPhase < 0.6f && Phase >= 0.6f) Once(FString::Printf(TEXT("%s_1tell"), *P));
    if (State == EHWBossState::Recover && BossShowPrevPhase < 0.5f && Phase >= 0.5f) Once(FString::Printf(TEXT("%s_3recover"), *P));
    if (State == EHWBossState::Strike)
    {
        const FHWBossPatternSpec& Spec = Boss->GetCurrentPattern();
        for (int32 K = 0; K < Spec.Beats.Num(); ++K)
        {
            const float BeatPhase = Spec.StrikeDuration > 0.f ? Spec.Beats[K].At / Spec.StrikeDuration : 0.f;
            if (BossShowPrevPhase < BeatPhase && Phase >= BeatPhase) Once(FString::Printf(TEXT("%s_2beat%d"), *P, K));
        }
    }
    BossShowPrevPhase = State == BossShowState ? Phase : 0.f;

    int32 Done = 0;
    for (const TCHAR* Id : { TEXT("HookCombo"), TEXT("Charge"), TEXT("Slam"), TEXT("Spin"), TEXT("GroundWave") })
    {
        if (BossShotsTaken.Contains(FString::Printf(TEXT("%s_3recover"), Id))) ++Done;
    }
    // Charge is only picked from 5 m+: once the close patterns are in, step the boss back out.
    const bool bNeedCharge = !BossShotsTaken.Contains(TEXT("Charge_3recover"));
    if (bNeedCharge && State == EHWBossState::Idle && ShowTime - BossShowMovedAt > 4.f
        && BossShotsTaken.Contains(TEXT("HookCombo_3recover")) && BossShotsTaken.Contains(TEXT("Spin_3recover"))
        && FVector::Dist2D(Boss->GetActorLocation(), Pawn->GetActorLocation()) < 600.f)
    {
        BossShowMovedAt = ShowTime;
        Boss->SetActorLocation(Pawn->GetActorLocation() + FVector(900.f, 0.f, 0.f));
        Note(TEXT("boss stepped back for Charge"));
    }
    if (Done == 4 && !BossShowPhasePush && !BossShotsTaken.Contains(TEXT("GroundWave_3recover")) && State == EHWBossState::Idle)
    {
        // GroundWave is a phase 2+ pattern: take the boss past the first phase threshold.
        BossShowPhasePush = true;
        Boss->ReceivePlayerHit(Boss->GetHealth() * 0.45f, EHWAttackTier::Light, Pawn->GetActorLocation());
        Note(FString::Printf(TEXT("phase push: boss hp %.0f"), Boss->GetHealth()));
    }
    if (BossEndAt < 0.f && (Done == 5 || ShowTime > 200.f) && State == EHWBossState::Idle)
    {
        BossEndAt = ShowTime;
        Note(FString::Printf(TEXT("patterns captured %d/5"), Done));
        Boss->ReceivePlayerHit(1.f, EHWAttackTier::Light, Pawn->GetActorLocation());
    }
    if (BossEndAt >= 0.f)
    {
        const float T = ShowTime - BossEndAt;
        if (T > 0.25f) Once(TEXT("90_hit"));
        if (T > 1.5f && !Boss->IsDead()) Boss->ReceivePlayerHit(1.0e9f, EHWAttackTier::Break, Pawn->GetActorLocation());
        if (T > 2.3f) Once(TEXT("91_death_a"));
        if (T > 4.5f) Once(TEXT("92_death_end"));
        if (T > 5.f) Finish(Done == 5, FString::Printf(TEXT("boss show: patterns %d/5"), Done));
    }
}

// ---------------------------------------------------------------- clip review (-HWQA=clipreview, doc 133)
// Candidate clips side by side on one body: -HWQAClips=<anim path>+... -HWQAMesh=<skeletal mesh path>
// -HWQATimes=0.2+0.4+... (normalized). One shot per time, clips in a row seen from the side, bones measured.
static float ReviewSpacing(int32 Count)
{
    return Count <= 2 ? 220.f : 300.f;   // a donor/target pair stands close for a large side view
}

void UHWSystemQASubsystem::TickClipReview(float Dt)
{
    UWorld* World = GetGameInstance()->GetWorld();
    if (!World) return;
    if (ShowTime < 0.f)
    {
        if (Elapsed < 2.f) return;
        ShowTime = 0.f;
        ShowStart = World->GetTimeSeconds();
        ShotDir = Param(TEXT("HWQAShots="));
        FString Clips = Param(TEXT("HWQAClips="));
        FString MeshPath = Param(TEXT("HWQAMesh="));
        FString Times = Param(TEXT("HWQATimes="));
        if (MeshPath.IsEmpty()) MeshPath = TEXT("/Game/ParagonCountess/Characters/Heroes/Countess/Meshes/SM_Countess.SM_Countess");
        if (Times.IsEmpty()) Times = TEXT("0.15+0.3+0.45+0.6+0.75+0.9");
        TArray<FString> ClipList, TimeList;
        // '+' separated: the command-line parser stops values at commas.
        Clips.ParseIntoArray(ClipList, TEXT("+"));
        Times.ParseIntoArray(TimeList, TEXT("+"));
        for (const FString& T : TimeList) ReviewTimes.Add(T == TEXT("c") ? -1.f : FCString::Atof(*T));   // c = each clip's contact
        USkeletalMesh* Body = LoadObject<USkeletalMesh>(nullptr, *MeshPath);
        FVector Origin(0.f, 0.f, 0.f);
        if (ACharacter* P = GetPawn())
        {
            // Stand the row on the floor the player stands on.
            Origin = P->GetActorLocation() - FVector(0.f, 0.f, P->GetCapsuleComponent()->GetScaledCapsuleHalfHeight())
                + FVector(200.f, 0.f, 0.f);   // start inside the platform, not on its edge
            P->SetActorHiddenInGame(true);
        }
        for (TActorIterator<AHWBossCharacter> It(World); It; ++It) It->SetActorHiddenInGame(true);
        for (int32 I = 0; I < ClipList.Num(); ++I)
        {
            // Entry: <anim path>[@<skeletal mesh path>][@<contact 0..1>] — donor and retarget side by side.
            TArray<FString> Parts;
            ClipList[I].ParseIntoArray(Parts, TEXT("@"));
            UAnimSequenceBase* Seq = LoadObject<UAnimSequenceBase>(nullptr, *Parts[0]);
            USkeletalMesh* ClipBody = Parts.Num() > 1 && !Parts[1].IsEmpty() ? LoadObject<USkeletalMesh>(nullptr, *Parts[1]) : Body;
            ReviewContacts.Add(Parts.Num() > 2 ? FCString::Atof(*Parts[2]) : 0.5f);
            ASkeletalMeshActor* A = World->SpawnActor<ASkeletalMeshActor>(ASkeletalMeshActor::StaticClass(),
                Origin + FVector(ReviewSpacing(ClipList.Num()) * I, 0.f, 0.f), FRotator(0.f, 0.f, 0.f));
            if (!A || !ClipBody || !Seq)
            {
                Note(FString::Printf(TEXT("clip review: missing %s"), *ClipList[I]));
                continue;
            }
            USkeletalMeshComponent* M = A->GetSkeletalMeshComponent();
            M->SetMobility(EComponentMobility::Movable);
            M->SetSkeletalMeshAsset(ClipBody);
            M->SetRelativeRotation(FRotator(0.f, -90.f, 0.f));   // mannequin/Countess face +Y
            M->SetAnimationMode(EAnimationMode::AnimationSingleNode);
            M->PlayAnimation(Seq, false);
            M->Stop();
            ReviewActors.Add(A);
            ReviewClips.Add(Seq);
        }
        if (ADirectionalLight* Sun = World->SpawnActor<ADirectionalLight>(ADirectionalLight::StaticClass(), FVector::ZeroVector, FRotator(-35.f, 150.f, 0.f)))
        {
            Sun->GetLightComponent()->SetIntensity(3.f);
        }
        if (ACameraActor* Cam = World->SpawnActor<ACameraActor>(ACameraActor::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator))
        {
            // Side view: bodies stand in a row along X, all facing +X; the camera looks from -Y.
            const float Span = ReviewSpacing(ReviewActors.Num()) * FMath::Max(0, ReviewActors.Num() - 1);
            const FVector Center = Origin + FVector(Span * 0.5f + 40.f, 0.f, 95.f);
            const FVector From = Center + FVector(0.f, -(Span * 0.8f + 300.f), 10.f);
            Cam->SetActorLocationAndRotation(From, UKismetMathLibrary::FindLookAtRotation(From, Center));
            Cam->GetCameraComponent()->SetFieldOfView(55.f);
            Cam->GetCameraComponent()->bConstrainAspectRatio = false;
            if (APlayerController* PC = GetPC()) PC->SetViewTargetWithBlend(Cam, 0.f);
        }
        Note(FString::Printf(TEXT("clip review: %d clips x %d times"), ReviewActors.Num(), ReviewTimes.Num()));
        return;
    }
    ShowTime = World->GetTimeSeconds() - ShowStart;
    if (ShowTime < 4.f) return;   // shaders
    const int32 Step = FMath::FloorToInt((ShowTime - 4.f) / 0.6f);   // pose at +0, shot at +0.3
    const int32 K = Step;
    if (K >= ReviewTimes.Num())
    {
        Finish(true, TEXT("clip review done"));
        return;
    }
    const float U = ReviewTimes[K];
    for (int32 I = 0; I < ReviewActors.Num(); ++I)
    {
        ASkeletalMeshActor* A = Cast<ASkeletalMeshActor>(ReviewActors[I].Get());
        if (!A || !ReviewClips[I]) continue;
        const float Ui = U < 0.f && ReviewContacts.IsValidIndex(I) ? ReviewContacts[I] : U;
        A->GetSkeletalMeshComponent()->SetPosition(Ui * ReviewClips[I]->GetPlayLength(), false);
    }
    const float Into = (ShowTime - 4.f) - Step * 0.6f;
    if (Into > 0.3f && ReviewShotStep < K + 1)
    {
        ReviewShotStep = K + 1;
        const FString Tag = U < 0.f ? FString(TEXT("contact")) : FString::Printf(TEXT("t%03d"), FMath::RoundToInt(U * 100.f));
        Shot(Tag);
        for (int32 I = 0; I < ReviewActors.Num(); ++I)
        {
            if (AActor* A = ReviewActors[I].Get())
            {
                MeasureBody(FString::Printf(TEXT("%s %s"), *Tag, *ReviewClips[I]->GetName()), A);
            }
        }
    }
}

// ---------------------------------------------------------------- arena show (-HWQA=arenashow, doc 136)
// Story boss arena review: for each phase state the runtime Data Layers are switched (same world the game and
// the cinematics use), then every placed CineCamera (tagged CAM_*) and a roof-off overview are shot.
void UHWSystemQASubsystem::TickArenaShow(float Dt)
{
    UWorld* World = GetGameInstance()->GetWorld();
    if (!World) return;
    UDataLayerManager* Layers = UDataLayerManager::GetDataLayerManager(World);
    if (ShowTime < 0.f)
    {
        if (Elapsed < 2.f) return;
        ShowTime = 0.f;
        ShowStart = World->GetTimeSeconds();
        ShotDir = Param(TEXT("HWQAShots="));
        for (TActorIterator<ACameraActor> It(World); It; ++It)
        {
            for (const FName& Tag : It->Tags)
            {
                if (Tag.ToString().StartsWith(TEXT("CAM_"))) ArenaCameras.Add(*It);
            }
        }
        ArenaCameras.Sort([](const TWeakObjectPtr<ACameraActor>& A, const TWeakObjectPtr<ACameraActor>& B)
        {
            return A->Tags[0].LexicalLess(B->Tags[0]);
        });
        if (ACameraActor* Top = World->SpawnActor<ACameraActor>(FVector(0.f, 150.f, 2300.f), FRotator(-90.f, 0.f, 0.f)))
        {
            Top->Tags.Add(TEXT("TOP_Overview"));
            Top->GetCameraComponent()->SetFieldOfView(60.f);
            Top->GetCameraComponent()->bConstrainAspectRatio = false;
            ArenaCameras.Insert(Top, 0);
        }
        for (TActorIterator<APawn> It(World); It; ++It) It->SetActorHiddenInGame(true);   // default pawn sphere too
        Note(FString::Printf(TEXT("arena show: %d cameras, data layers %s"), ArenaCameras.Num(), Layers ? TEXT("yes") : TEXT("none")));
        return;
    }
    ShowTime = World->GetTimeSeconds() - ShowStart;
    // Phase states from the spec: PreBattle -> Phase1 (after the blast) -> Aftermath.
    static const TCHAR* StateNames[] = { TEXT("0_prebattle"), TEXT("1_phase1"), TEXT("2_aftermath") };
    static const TCHAR* StateLayer[] = { TEXT("DL_Story_PreBattle"), TEXT("DL_Phase1"), TEXT("DL_Aftermath") };
    constexpr int32 NumStates = 3;
    const float PerShot = 0.5f, Settle = 2.5f;
    const float PerState = Settle + PerShot * ArenaCameras.Num();
    const int32 S = FMath::FloorToInt((ShowTime - 3.f) / PerState);
    if (ShowTime < 3.f) return;   // shaders
    if (S >= NumStates)
    {
        Finish(true, TEXT("arena show done"));
        return;
    }
    if (ArenaState != S)
    {
        ArenaState = S;
        ArenaShot = -1;
        if (Layers)
        {
            Layers->ForEachDataLayerInstance([&](UDataLayerInstance* I)
            {
                const FString Name = I->GetDataLayerShortName();
                const bool bOn = Name == TEXT("DL_Arena_Base") || Name == TEXT("DL_Cinematic") || Name == StateLayer[S];
                Layers->SetDataLayerInstanceRuntimeState(I, bOn ? EDataLayerRuntimeState::Activated : EDataLayerRuntimeState::Unloaded);
                return true;
            });
        }
        // Roof off for the overview only while it is the current shot (see below).
        Note(FString(TEXT("arena state ")) + StateNames[S]);
    }
    const float Into = ShowTime - 3.f - S * PerState - Settle;
    const int32 K = Into < 0.f ? -1 : FMath::FloorToInt(Into / PerShot);
    if (K >= 0 && K < ArenaCameras.Num() && K != ArenaShot)
    {
        ArenaShot = K;
        ACameraActor* Cam = ArenaCameras[K].Get();
        if (!Cam) return;
        const bool bTop = Cam->Tags.Contains(TEXT("TOP_Overview"));
        for (TActorIterator<AStaticMeshActor> It(World); It; ++It)
        {
            const FString Label = It->GetActorNameOrLabel();
            if (Label.Contains(TEXT("Ceiling")) || Label.Contains(TEXT("Tube"))) It->SetActorHiddenInGame(bTop);
        }
        if (APlayerController* PC = GetPC()) PC->SetViewTargetWithBlend(Cam, 0.f);
        ArenaPendingTag = FString::Printf(TEXT("%s__%s"), StateNames[S], *Cam->Tags[0].ToString());
        ArenaShotDelay = 0.2f;   // one frame at the new view before capturing
    }
    if (ArenaShotDelay > 0.f)
    {
        ArenaShotDelay -= Dt;
        if (ArenaShotDelay <= 0.f) Shot(ArenaPendingTag);
    }
}
