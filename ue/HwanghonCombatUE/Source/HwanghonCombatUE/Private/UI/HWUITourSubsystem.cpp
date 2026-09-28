#include "HWUITourSubsystem.h"

#include "Boss/HWBossCharacter.h"
#include "Camera/HWLockOnComponent.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "Graphics/HWGraphicsQualitySubsystem.h"
#include "HAL/FileManager.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/CommandLine.h"
#include "Misc/FileHelper.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "UI/HWFrontendRootWidget.h"
#include "UnrealClient.h"
#include "HAL/PlatformTime.h"

namespace
{
    const TCHAR* TierName(EHWGraphicsTier Tier)
    {
        return Tier == EHWGraphicsTier::High ? TEXT("high") : Tier == EHWGraphicsTier::Mid ? TEXT("mid") : TEXT("low");
    }

    const TMap<FName, TArray<TPair<float, int32>>>& Defense()
    {
        // Seconds after Strike entry and what to press: 0 counter, 1 dodge, 2 jump (HWCombatTuningAsset beats).
        static const TMap<FName, TArray<TPair<float, int32>>> Table = {
            { TEXT("Slam"), { { 0.f, 0 } } },
            { TEXT("HookCombo"), { { 0.f, 1 }, { 1.03f, 0 } } },
            { TEXT("GroundWave"), { { 0.f, 2 } } },
            { TEXT("Charge"), { { 0.f, 1 } } },
            { TEXT("Spin"), { { 0.f, 1 } } },
        };
        return Table;
    }

    float TellSeconds(FName Pattern)
    {
        static const TMap<FName, float> Tell = {
            { TEXT("HookCombo"), 0.75f }, { TEXT("Charge"), 1.0f }, { TEXT("Slam"), 1.25f }, { TEXT("Spin"), 1.45f }, { TEXT("GroundWave"), 1.15f },
        };
        const float* Found = Tell.Find(Pattern);
        return Found ? *Found : 1.f;
    }
}

bool UHWUITourSubsystem::ShouldCreateSubsystem(UObject* Outer) const
{
#if UE_BUILD_SHIPPING
    return false;
#else
    return FParse::Param(FCommandLine::Get(), TEXT("HWUITour"));
#endif
}

void UHWUITourSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    Collection.InitializeDependency(UHWGraphicsQualitySubsystem::StaticClass());
    if (!FParse::Value(FCommandLine::Get(), TEXT("HWUITourOut="), OutDir))
    {
        OutDir = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("UITour"));
    }
    OutDir = FPaths::ConvertRelativePathToFull(OutDir);
    IFileManager::Get().DeleteDirectory(*OutDir, false, true);
    IFileManager::Get().MakeDirectory(*FPaths::Combine(OutDir, TEXT("video")), true);
    if (UHWGraphicsQualitySubsystem* Graphics = GetGameInstance()->GetSubsystem<UHWGraphicsQualitySubsystem>())
    {
        Graphics->ApplyTier(EHWGraphicsTier::High, false);
    }
    BuildFrontendSteps();
    bActive = true;
    Log(TEXT("tour armed"));
}

void UHWUITourSubsystem::Log(const FString& Line)
{
    Report.Add(FString::Printf(TEXT("[%05d] %s"), Frame, *Line));
    UE_LOG(LogTemp, Display, TEXT("[HwanghonUITour] %s"), *Line);
}

void UHWUITourSubsystem::RequestShot(const FString& Name)
{
    PendingShot = Name;
}

void UHWUITourSubsystem::BuildFrontendSteps()
{
    auto Root = []() { return UHWFrontendRootWidget::GetActive(); };
    auto Tier = [this](EHWGraphicsTier T)
    {
        return [this, T]()
        {
            if (UHWGraphicsQualitySubsystem* Graphics = GetGameInstance()->GetSubsystem<UHWGraphicsQualitySubsystem>())
            {
                Graphics->ApplyTier(T, false);
            }
            if (UHWFrontendRootWidget* R = UHWFrontendRootWidget::GetActive())
            {
                R->RefreshChrome();
            }
        };
    };
    auto Show = [Root](EHWFrontendScreen S) { return [Root, S]() { if (UHWFrontendRootWidget* R = Root()) { R->ShowScreen(S); } }; };
    auto Open = [Root](EHWFrontendOverlay O) { return [Root, O]() { if (UHWFrontendRootWidget* R = Root()) { R->OpenOverlay(O); } }; };
    auto Add = [this](float Hold, TFunction<void()> Enter, const FString& Shot = FString()) { Steps.Add({ Hold, MoveTemp(Enter), Shot }); };

    // Navigation strip (recorded) with High-tier stills.
    Add(0.f, [this]() { bRecord = true; Log(TEXT("record on")); });
    Add(1.6f, []() {}, TEXT("01_title"));
    Add(1.8f, Show(EHWFrontendScreen::Lobby), TEXT("02_lobby_high"));
    Add(1.2f, Show(EHWFrontendScreen::OfficeQuest), TEXT("03_quest"));
    Add(1.0f, [Root]() { if (UHWFrontendRootWidget* R = Root()) { R->SelectedQuest = TEXT("q_sewage"); if (UHWScreenWidget* W = R->GetScreenWidget(EHWFrontendScreen::OfficeQuest)) { W->RequestRefresh(); } } },
        TEXT("03b_quest_select"));
    Add(1.2f, Show(EHWFrontendScreen::Character), TEXT("04_character"));
    Add(1.0f, [Root]() { if (UHWFrontendRootWidget* R = Root()) { R->SelectedCharacter = TEXT("kain"); if (UHWScreenWidget* W = R->GetScreenWidget(EHWFrontendScreen::Character)) { W->RequestRefresh(); } } },
        TEXT("04b_character_kain"));
    Add(1.2f, Show(EHWFrontendScreen::Inventory), TEXT("05_inventory"));
    Add(1.0f, Show(EHWFrontendScreen::Skills), TEXT("06_skills"));
    Add(1.2f, Show(EHWFrontendScreen::Forge), TEXT("07_forge"));
    Add(1.2f, Show(EHWFrontendScreen::Shop), TEXT("08_shop"));
    Add(1.0f, Show(EHWFrontendScreen::Looks), TEXT("09_looks"));
    Add(0.8f, [Root]() { if (UHWFrontendRootWidget* R = Root()) { R->SelectedCharacter = TEXT("ain"); R->ShowScreen(EHWFrontendScreen::Lobby); } });
    Add(1.4f, Open(EHWFrontendOverlay::Recruit), TEXT("10_drawer_high"));
    Add(0.4f, Open(EHWFrontendOverlay::None));
    Add(1.4f, Open(EHWFrontendOverlay::Story), TEXT("11_story_high"));
    Add(0.4f, Open(EHWFrontendOverlay::None));
    Add(1.4f, [Root]() { if (UHWFrontendRootWidget* R = Root()) { R->SelectedQuest = TEXT("q_marsh"); R->OpenOverlay(EHWFrontendOverlay::Result); } },
        TEXT("12_result_high"));
    Add(0.4f, Open(EHWFrontendOverlay::None));
    Add(1.2f, Show(EHWFrontendScreen::Profile), TEXT("13_profile"));
    Add(0.f, [this]() { bRecord = false; Log(TEXT("record off")); });

    // Tier stills (Mid / Low use OverlayDim + PanelStrong, no blur).
    for (const EHWGraphicsTier T : { EHWGraphicsTier::Mid, EHWGraphicsTier::Low })
    {
        const FString Suffix = TierName(T);
        Add(0.2f, Tier(T));
        Add(1.0f, Show(EHWFrontendScreen::Lobby), TEXT("14_lobby_") + Suffix);
        Add(1.2f, Open(EHWFrontendOverlay::Recruit), TEXT("15_drawer_") + Suffix);
        Add(0.4f, Open(EHWFrontendOverlay::None));
        Add(1.2f, Open(EHWFrontendOverlay::Result), TEXT("16_result_") + Suffix);
        Add(0.4f, Open(EHWFrontendOverlay::None));
    }
    Add(0.2f, Tier(EHWGraphicsTier::High));
    Add(0.5f, [this]()
    {
        Log(TEXT("travel to combat"));
        bInCombat = true;
        CombatTime = 0.f;
        StageStart = 0.f;
        UGameplayStatics::OpenLevel(GetGameInstance()->GetWorld(), TEXT("Seohan_Combat_VS01"));
    });
}

void UHWUITourSubsystem::Tick(float RawDeltaTime)
{
    // Screenshot frames are slow in wall time; the tour runs on frames (-benchmark -fps=30),
    // so holds and the bot see game time, not how long a PNG took to write.
    const float DeltaTime = 1.f / 30.f;
    ++Frame;
    if (ShotCooldown > 0)
    {
        --ShotCooldown;
    }
    if (!PendingBare.IsEmpty())
    {
        // The twin keeps the key art and drops the UI. In combat the art is the 3D view (UI off);
        // on the frontend the art is itself UMG (background + hero), so the root hides everything else.
        UHWFrontendRootWidget* Root = bInCombat ? nullptr : UHWFrontendRootWidget::GetActive();
        if (BareStage == 0)
        {
            if (Root) { Root->SetArtOnly(true); }
            BareStage = 1;
        }
        else if (BareStage == 1)
        {
            FScreenshotRequest::RequestScreenshot(FPaths::Combine(OutDir, PendingBare + TEXT("_noui.png")), Root != nullptr, false);
            Log(TEXT("shot ") + PendingBare + TEXT("_noui"));
            BareStage = 2;
        }
        else
        {
            if (Root) { Root->SetArtOnly(false); }
            BareStage = 0;
            ShotCooldown = 3;
            PendingBare.Reset();
        }
    }
    else if (!PendingShot.IsEmpty())
    {
        const FString File = FPaths::Combine(OutDir, PendingShot + TEXT(".png"));
        FScreenshotRequest::RequestScreenshot(File, true, false);
        ShotCooldown = 3;
        Log(TEXT("shot ") + PendingShot);
        static const TArray<FString> Bare = { TEXT("02_lobby_high"), TEXT("03_quest"), TEXT("05_inventory"), TEXT("20_combat_hud_high") };
        if (Bare.Contains(PendingShot))
        {
            PendingBare = PendingShot;
        }
        PendingShot.Reset();
    }
    else if (bRecord && (Frame % 2) == 0)
    {
        FScreenshotRequest::RequestScreenshot(FPaths::Combine(OutDir, TEXT("video"), FString::Printf(TEXT("f_%05d.png"), VideoFrame++)), true, false);
    }

    if (bInCombat)
    {
        TickCombat(DeltaTime);
    }
    else
    {
        TickFrontend(DeltaTime);
    }
}

void UHWUITourSubsystem::TickFrontend(float DeltaTime)
{
    if (!UHWFrontendRootWidget::GetActive())
    {
        return; // wait for the frontend map
    }
    if (StepIndex == INDEX_NONE)
    {
        StepTime += DeltaTime;
        if (StepTime < 1.0f)
        {
            return; // let fonts/art settle
        }
        StepIndex = 0;
        StepTime = 0.f;
        StepWallStart = FPlatformTime::Seconds();
        bShotTaken = false;
        if (Steps.IsValidIndex(0) && Steps[0].Enter) { Steps[0].Enter(); }
        return;
    }
    if (!Steps.IsValidIndex(StepIndex))
    {
        return;
    }
    StepTime += DeltaTime;
    const FStep& Step = Steps[StepIndex];
    // Both game frames and wall time: drawer/modal tweens (0.2 s) tick on real time.
    const bool bWallSettled = FPlatformTime::Seconds() - StepWallStart >= 0.4;
    if (!bShotTaken && !Step.Shot.IsEmpty() && StepTime >= Step.Hold * 0.8f && bWallSettled)
    {
        RequestShot(Step.Shot);
        bShotTaken = true;
    }
    if (StepTime >= Step.Hold && (Step.Shot.IsEmpty() || bShotTaken) && PendingShot.IsEmpty() && PendingBare.IsEmpty() && ShotCooldown == 0)
    {
        ++StepIndex;
        StepTime = 0.f;
        StepWallStart = FPlatformTime::Seconds();
        bShotTaken = false;
        if (Steps.IsValidIndex(StepIndex) && Steps[StepIndex].Enter)
        {
            Steps[StepIndex].Enter();
        }
    }
}

void UHWUITourSubsystem::TickCombat(float DeltaTime)
{
    UWorld* World = GetGameInstance()->GetWorld();
    AHWAinCharacter* Ain = World ? Cast<AHWAinCharacter>(UGameplayStatics::GetPlayerCharacter(World, 0)) : nullptr;
    AHWBossCharacter* Boss = World ? Cast<AHWBossCharacter>(UGameplayStatics::GetActorOfClass(World, AHWBossCharacter::StaticClass())) : nullptr;
    if (!Ain || !Boss || !Ain->GetCombat())
    {
        return;
    }
    CombatTime += DeltaTime;
    if (CombatTime > 75.f)
    {
        Log(TEXT("combat timeout"));
        Finish();
        return;
    }
    UHWCombatComponent* Combat = Ain->GetCombat();
    UHWLockOnComponent* LockOn = Ain->GetLockOn();

    const EHWBossState State = Boss->GetBossState();
    const FName Pattern = Boss->GetCurrentPatternId();
    if (static_cast<uint8>(State) != LastBossState)
    {
        if (State == EHWBossState::Tell) { TellTime = CombatTime; }
        if (State == EHWBossState::Strike) { StrikeTime = CombatTime; Answered.Reset(); }
        if (State == EHWBossState::Stagger && StaggerSeen < 0.f) { StaggerSeen = CombatTime; }
        LastBossState = static_cast<uint8>(State);
    }

    if (CombatTime > 0.8f && LockOn && !LockOn->IsLocked())
    {
        LockOn->ToggleLockOn();
    }

    // Defense.
    if (State == EHWBossState::Strike && StrikeTime >= 0.f)
    {
        if (const TArray<TPair<float, int32>>* Plan = Defense().Find(Pattern))
        {
            for (int32 Index = 0; Index < Plan->Num(); ++Index)
            {
                if (CombatTime - StrikeTime >= (*Plan)[Index].Key && !Answered.Contains(Index))
                {
                    Answered.Add(Index);
                    const int32 What = (*Plan)[Index].Value;
                    What == 0 ? Combat->RequestCounter() : What == 1 ? Combat->RequestDodge() : Combat->RequestJump();
                }
            }
        }
    }

    // Offense (same rule as Scripts/ue_pie_capture.py).
    const float ToStrike = State == EHWBossState::Strike ? 0.f
        : State == EHWBossState::Tell ? TellSeconds(Pattern) - (CombatTime - TellTime) : 99.f;
    const FVector Delta = Boss->GetActorLocation() - Ain->GetActorLocation();
    const float Dist = FVector(Delta.X, Delta.Y, 0.f).Size();
    const EHWActionType Action = Combat->GetCurrentAction();
    if (Action == EHWActionType::None)
    {
        PressedFor = 0;
        if (Dist > 200.f && CombatTime > 1.f)
        {
            Ain->AddMovementInput(FVector(Delta.X, Delta.Y, 0.f).GetSafeNormal(), 1.f);
        }
        else if (ToStrike > 0.7f && CombatTime > 1.2f)
        {
            if (bPlanSmash) { if (Combat->RequestSmash()) { bPlanSmash = false; } }
            else { Combat->RequestAttack(); }
        }
    }
    else if ((Action == EHWActionType::Attack1 || Action == EHWActionType::Attack2) && Combat->GetActionElapsed() >= 0.36f
        && PressedFor != static_cast<uint8>(Action))
    {
        PressedFor = static_cast<uint8>(Action);
        if (ToStrike > (0.48f - Combat->GetActionElapsed()) + 0.39f + 0.05f)
        {
            Combat->RequestAttack();
        }
    }
    else if (Action == EHWActionType::Attack3)
    {
        bPlanSmash = true;
    }

    // Stills.
    UHWGraphicsQualitySubsystem* Graphics = GetGameInstance()->GetSubsystem<UHWGraphicsQualitySubsystem>();
    const FString Tier = Graphics ? TierName(Graphics->GetCurrentTier()) : TEXT("high");
    if (!bHudShot && CombatTime - StageStart > 2.5f && State == EHWBossState::Tell && CombatTime - TellTime > 0.3f && LockOn && LockOn->IsLocked())
    {
        RequestShot(TEXT("20_combat_hud_") + Tier);
        bHudShot = true;
    }
    if (TierStage == 0 && !bCounterShot && StaggerSeen >= 0.f && CombatTime - StaggerSeen >= 0.1f)
    {
        RequestShot(TEXT("21_combat_counter"));
        bCounterShot = true;
    }
    if (StaggerSeen >= 0.f && CombatTime - StaggerSeen > 1.f)
    {
        StaggerSeen = -1.f;
    }

    const bool bStageDone = bHudShot && (TierStage != 0 || bCounterShot || CombatTime - StageStart > 40.f);
    if (bStageDone && PendingShot.IsEmpty() && PendingBare.IsEmpty() && ShotCooldown == 0)
    {
        ++TierStage;
        bHudShot = false;
        StageStart = CombatTime;
        if (TierStage >= 3)
        {
            Finish();
            return;
        }
        if (Graphics)
        {
            Graphics->ApplyTier(TierStage == 1 ? EHWGraphicsTier::Mid : EHWGraphicsTier::Low, false);
        }
        Log(FString::Printf(TEXT("combat tier stage %d"), TierStage));
    }
}

void UHWUITourSubsystem::Finish()
{
    if (!bActive)
    {
        return;
    }
    bActive = false;
    Log(FString::Printf(TEXT("done: %d video frames"), VideoFrame));
    FFileHelper::SaveStringArrayToFile(Report, *FPaths::Combine(OutDir, TEXT("tour_log.txt")));
    FPlatformMisc::RequestExit(false);
}
