#include "CoreMinimal.h"

// The driver is absent from Shipping and inert unless explicitly enabled with an
// isolated automation save slot. It exercises the real runtime maps and Slate UI.
#if !UE_BUILD_SHIPPING
#include "Game/HWShellPlayerController.h"
#include "Game/HWQuestRunSubsystem.h"
#include "Progression/HWProfileSubsystem.h"
#include "Character/HWAinCharacter.h"
#include "Boss/HWBossCharacter.h"
#include "Camera/HWLockOnComponent.h"
#include "Combat/HWCombatComponent.h"
#include "Engine/World.h"
#include "Engine/GameViewportClient.h"
#include "Framework/Application/SlateApplication.h"
#include "Layout/Children.h"
#include "Layout/Clipping.h"
#include "Layout/WidgetPath.h"
#include "Widgets/SWidget.h"
#include "Widgets/SViewport.h"
#include "HAL/FileManager.h"
#include "HAL/IConsoleManager.h"
#include "HAL/PlatformTime.h"
#include "Misc/CommandLine.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonSerializer.h"
#include "UnrealClient.h"
#if WITH_EDITOR
#include "ShaderCompiler.h"
#endif

namespace
{
enum class EQAStage : uint8
{
    LobbyReady, LobbyCaptured, CombatReady, CombatCaptured, AttackContact,
    PendingReady, PendingCaptured, VictoryReady, VictoryCaptured, RetryReady,
    DefeatReady, DefeatCaptured, ReturnReady, ReturnCaptured, AbandonCombatReady,
    LeaveReady, LeaveCaptured, CancelLeaveReady, ConfirmLeaveReady,
    AbandonReturnReady, AbandonReturnCaptured, Finished
};

const TCHAR* StageName(EQAStage Stage)
{
    switch (Stage)
    {
    case EQAStage::LobbyReady: return TEXT("lobby-ready");
    case EQAStage::LobbyCaptured: return TEXT("lobby-captured");
    case EQAStage::CombatReady: return TEXT("combat-ready");
    case EQAStage::CombatCaptured: return TEXT("combat-captured");
    case EQAStage::AttackContact: return TEXT("attack-contact");
    case EQAStage::PendingReady: return TEXT("pending-save-ready");
    case EQAStage::PendingCaptured: return TEXT("pending-save-captured");
    case EQAStage::VictoryReady: return TEXT("victory-ready");
    case EQAStage::VictoryCaptured: return TEXT("victory-captured");
    case EQAStage::RetryReady: return TEXT("retry-ready");
    case EQAStage::DefeatReady: return TEXT("defeat-ready");
    case EQAStage::DefeatCaptured: return TEXT("defeat-captured");
    case EQAStage::ReturnReady: return TEXT("return-ready");
    case EQAStage::ReturnCaptured: return TEXT("return-captured");
    case EQAStage::AbandonCombatReady: return TEXT("abandon-combat-ready");
    case EQAStage::LeaveReady: return TEXT("leave-confirmation-ready");
    case EQAStage::LeaveCaptured: return TEXT("leave-confirmation-captured");
    case EQAStage::CancelLeaveReady: return TEXT("leave-cancel-ready");
    case EQAStage::ConfirmLeaveReady: return TEXT("leave-confirm-ready");
    case EQAStage::AbandonReturnReady: return TEXT("abandon-return-ready");
    case EQAStage::AbandonReturnCaptured: return TEXT("abandon-return-captured");
    default: return TEXT("finished");
    }
}

struct FTaggedControl
{
    TSharedRef<SWidget> Widget;
    bool bEnabled;
    bool bInQuestListScroll;
};

void GatherControls(const TSharedRef<SWidget>& Widget, bool bParentEnabled, bool bParentQuestListScroll, TArray<FTaggedControl>& Out)
{
    if (!Widget->GetVisibility().IsVisible()) { return; }
    const bool bEnabled = bParentEnabled && Widget->IsEnabled();
    const bool bQuestListScroll = Widget->GetTag() == TEXT("HW.QuestListScroll")
        && Widget->GetType() == TEXT("SScrollBox");
    if (Widget->GetTag().ToString().StartsWith(TEXT("HW.")) && !bQuestListScroll)
    {
        Out.Add({Widget, bEnabled, bParentQuestListScroll});
    }
    if (FChildren* Children = Widget->GetChildren())
    {
        for (int32 Index = 0; Index < Children->Num(); ++Index)
        {
            GatherControls(Children->GetChildAt(Index), bEnabled, bParentQuestListScroll || bQuestListScroll, Out);
        }
    }
}

bool PointUnclipped(const SWidget& Widget, const FVector2D& Point)
{
    const TOptional<FSlateClippingState>& Clip = Widget.GetCurrentClippingState();
    return !Clip.IsSet() || Clip->IsPointInside(Point);
}

struct FHWShellQA
{
    bool bInitialized = false;
    bool bEnabled = false;
    bool bFinished = false;
    bool bCapturing = false;
    bool bCaptureProcessed = false;
    double StartedAt = 0.;
    double StageStartedAt = 0.;
    int32 StableFrames = 0;
    int32 InitialClears = 0;
    float BossHealthBefore = 0.f;
    float PausedWorldTime = 0.f;
    EQAStage Stage = EQAStage::LobbyReady;
    FGuid FirstRun;
    FGuid RetriedRun;
    FString Directory;
    FString Slot;
    FString Scenario;
    FString ScreenshotPath;
    FIntPoint ScreenshotSize;
    FIntPoint RequestedSize = FIntPoint::ZeroValue;
    FDelegateHandle ScreenshotHandle;
    TSharedPtr<FJsonObject> PendingCapture;
    TSharedPtr<FJsonObject> Report = MakeShared<FJsonObject>();
    TArray<TSharedPtr<FJsonValue>> Captures;
    TArray<TSharedPtr<FJsonValue>> Interactions;

    void SetSaveFailure(bool bFail)
    {
        if (IConsoleVariable* Variable = IConsoleManager::Get().FindConsoleVariable(TEXT("hw.QA.FailProfileSaves")))
        {
            Variable->Set(bFail ? 1 : 0, ECVF_SetByCode);
        }
    }

    void Finish(bool bSuccess, const FString& Diagnostic, const AHWShellPlayerController* Controller = nullptr)
    {
        if (bFinished) { return; }
        bFinished = true;
        SetSaveFailure(false);
        if (ScreenshotHandle.IsValid())
        {
            FScreenshotRequest::OnScreenshotRequestProcessed().Remove(ScreenshotHandle);
        }
        Report->SetBoolField(TEXT("TestSuccess"), bSuccess);
        Report->SetStringField(TEXT("LastStage"), StageName(Stage));
        Report->SetStringField(TEXT("Diagnostic"), Diagnostic);
        Report->SetNumberField(TEXT("ElapsedSeconds"), FPlatformTime::Seconds() - StartedAt);
        Report->SetArrayField(TEXT("Screenshots"), Captures);
        Report->SetArrayField(TEXT("Interactions"), Interactions);
        if (Controller)
        {
            Report->SetStringField(TEXT("UIError"), Controller->GetUIError().ToString());
            if (Controller->Runs())
            {
                Report->SetNumberField(TEXT("LastRunState"), int32(Controller->Runs()->GetRunState()));
                Report->SetStringField(TEXT("RunError"), Controller->Runs()->GetLastError());
            }
            if (Controller->Profile())
            {
                Report->SetNumberField(TEXT("FinalTutorialClears"), Controller->Profile()->GetClearCount(TEXT("tutorial")));
                Report->SetStringField(TEXT("ProfileError"), Controller->Profile()->GetLastError());
            }
        }
        FString Json;
        FJsonSerializer::Serialize(Report.ToSharedRef(), TJsonWriterFactory<>::Create(&Json));
        const bool bWritten = !Directory.IsEmpty() && FFileHelper::SaveStringToFile(Json, *FPaths::Combine(Directory, TEXT("shell-qa.json")));
        UE_LOG(LogTemp, Display, TEXT("HW Shell QA %s: %s; report written=%d"), bSuccess ? TEXT("PASS") : TEXT("FAIL"), *Diagnostic, bWritten);
        Stage = EQAStage::Finished;
        FPlatformMisc::RequestExitWithStatus(false, bSuccess && bWritten ? 0 : 1);
    }

    void Initialize(AHWShellPlayerController& Controller)
    {
        bInitialized = true;
        bEnabled = FParse::Param(FCommandLine::Get(), TEXT("HWShellQA"));
        if (!bEnabled) { return; }
        StartedAt = StageStartedAt = FPlatformTime::Seconds();
        FParse::Value(FCommandLine::Get(), TEXT("HWProfileSlot="), Slot);
        FParse::Value(FCommandLine::Get(), TEXT("HWScreenshotDir="), Directory);
        FParse::Value(FCommandLine::Get(), TEXT("HWShellScenario="), Scenario);
        FParse::Value(FCommandLine::Get(), TEXT("ResX="), RequestedSize.X);
        FParse::Value(FCommandLine::Get(), TEXT("ResY="), RequestedSize.Y);
        if (Scenario.IsEmpty()) { Scenario = TEXT("full"); }
        bool bSafeSlot = Slot.StartsWith(TEXT("Hwanghon_Automation_")) && Slot.Len() > 19 && Slot.Len() <= 100;
        for (TCHAR Character : Slot)
        {
            bSafeSlot &= FChar::IsAlnum(Character) || Character == TEXT('_');
        }
        const bool bSafeDirectory = !Directory.IsEmpty() && !FPaths::IsRelative(Directory);
        if (!bSafeSlot || !bSafeDirectory)
        {
            // Do not write to an unvalidated path or touch a normal save slot.
            Directory.Reset();
            Finish(false, TEXT("QA requires an isolated Hwanghon_Automation_* slot and an absolute screenshot directory."));
            return;
        }
        FPaths::NormalizeDirectoryName(Directory);
        if (!IFileManager::Get().MakeDirectory(*Directory, true))
        {
            Finish(false, TEXT("Cannot create screenshot directory."));
            return;
        }
        Report->SetStringField(TEXT("Scenario"), Scenario);
        Report->SetStringField(TEXT("ProfileSlot"), Slot);
        Report->SetNumberField(TEXT("RequestedWidth"), RequestedSize.X);
        Report->SetNumberField(TEXT("RequestedHeight"), RequestedSize.Y);
        Report->SetStringField(TEXT("Scope"), TEXT("Native Slate pointer routing, runtime map travel, and paused abandon-confirmation/cancel/return checks; automated test, not manual gameplay or Android device validation."));
        Report->SetStringField(TEXT("ScriptedSetup"), TEXT("Full scenario teleports the player to 180 cm from the boss for a real lock-on/attack contact, injects one save failure, and applies scripted lethal damage for victory and defeat states."));
        if (Scenario != TEXT("full") && Scenario != TEXT("lobby") && Scenario != TEXT("reload"))
        {
            Finish(false, TEXT("Unknown scenario; expected full, lobby, or reload."), &Controller);
            return;
        }
        ScreenshotHandle = FScreenshotRequest::OnScreenshotRequestProcessed().AddLambda([this]()
        {
            if (bCapturing) { bCaptureProcessed = true; }
        });
    }

    void Next(EQAStage NewStage)
    {
        Stage = NewStage;
        StableFrames = 0;
        StageStartedAt = FPlatformTime::Seconds();
        UE_LOG(LogTemp, Display, TEXT("HW Shell QA stage: %s"), StageName(Stage));
    }

    bool Stable(bool bCondition, int32 FrameCount = 20)
    {
        StableFrames = bCondition ? StableFrames + 1 : 0;
        return StableFrames >= FrameCount;
    }

    TArray<FTaggedControl> Controls(AHWShellPlayerController& Controller)
    {
        TArray<FTaggedControl> Result;
        if (Controller.GetShellView()) { GatherControls(Controller.GetShellView().ToSharedRef(), true, false, Result); }
        return Result;
    }

    FWidgetPath HitPath(const FVector2D& Center)
    {
        FSlateApplication& App = FSlateApplication::Get();
        return App.LocateWindowUnderMouse(Center, App.GetInteractiveTopLevelWindows(), false, 0);
    }

    bool Click(AHWShellPlayerController& Controller, FName Tag)
    {
        for (const FTaggedControl& Control : Controls(Controller))
        {
            if (Control.Widget->GetTag() != Tag) { continue; }
            const FGeometry& Geometry = Control.Widget->GetCachedGeometry();
            const FVector2D Center = Geometry.LocalToAbsolute(Geometry.GetLocalSize() * 0.5f);
            const FVector2D Position = Geometry.GetAbsolutePosition();
            const FVector2D Size = Geometry.GetAbsoluteSize();
            const FVector2D Local = Position - FVector2D(Controller.GetShellView()->GetCachedGeometry().GetAbsolutePosition());
            int32 ViewportWidth = 0;
            int32 ViewportHeight = 0;
            Controller.GetViewportSize(ViewportWidth, ViewportHeight);
            const bool bFullyVisible = Size.X >= 63.5 && Size.Y >= 63.5
                && Local.X >= -0.5 && Local.Y >= -0.5
                && Local.X + Size.X <= ViewportWidth + 0.5 && Local.Y + Size.Y <= ViewportHeight + 0.5
                && PointUnclipped(*Control.Widget, Position + FVector2D(0.5, 0.5))
                && PointUnclipped(*Control.Widget, Position + Size - FVector2D(0.5, 0.5));
            FWidgetPath Path = HitPath(Center);
            if (!Control.bEnabled || !bFullyVisible || !PointUnclipped(*Control.Widget, Center) || !Path.ContainsWidget(&Control.Widget.Get()))
            {
                Finish(false, FString::Printf(TEXT("Control %s is disabled, below 64 px, clipped, or occluded; clicked targets must be fully visible."), *Tag.ToString()), &Controller);
                return false;
            }
            FSlateApplication& App = FSlateApplication::Get();
            TSet<FKey> EmptyButtons;
            TSet<FKey> PressedButtons;
            PressedButtons.Add(EKeys::LeftMouseButton);
            const FPointerEvent Move(0, Center, Center, EmptyButtons, EKeys::Invalid, 0.f, FModifierKeysState());
            App.RoutePointerMoveEvent(Path, Move, false);
            const FPointerEvent Down(0, Center, Center, PressedButtons, EKeys::LeftMouseButton, 0.f, FModifierKeysState());
            const FPointerEvent Up(0, Center, Center, EmptyButtons, EKeys::LeftMouseButton, 0.f, FModifierKeysState());
            const bool bDownHandled = App.RoutePointerDownEvent(Path, Down).IsEventHandled();
            const bool bUpHandled = App.RoutePointerUpEvent(Path, Up).IsEventHandled();
            TSharedPtr<FJsonObject> Entry = MakeShared<FJsonObject>();
            Entry->SetStringField(TEXT("Tag"), Tag.ToString());
            Entry->SetNumberField(TEXT("Width"), Size.X);
            Entry->SetNumberField(TEXT("Height"), Size.Y);
            Entry->SetBoolField(TEXT("FullyVisible"), bFullyVisible);
            Entry->SetBoolField(TEXT("PointerDownHandled"), bDownHandled);
            Entry->SetBoolField(TEXT("PointerUpHandled"), bUpHandled);
            Interactions.Add(MakeShared<FJsonValueObject>(Entry));
            if (!bDownHandled || !bUpHandled)
            {
                Finish(false, FString::Printf(TEXT("Control %s did not handle the routed click."), *Tag.ToString()), &Controller);
                return false;
            }
            return true;
        }
        Finish(false, FString::Printf(TEXT("Visible control %s was not found."), *Tag.ToString()), &Controller);
        return false;
    }

    bool Capture(AHWShellPlayerController& Controller, const TCHAR* Name)
    {
        Controller.GetViewportSize(ScreenshotSize.X, ScreenshotSize.Y);
        if (ScreenshotSize.X <= 0 || ScreenshotSize.Y <= 0 || !Controller.GetShellView())
        {
            Finish(false, TEXT("Screenshot viewport is not ready."), &Controller);
            return false;
        }
        if (RequestedSize.X <= 0 || RequestedSize.Y <= 0 || ScreenshotSize != RequestedSize)
        {
            Finish(false, FString::Printf(TEXT("Requested ResX/ResY %dx%d does not match the runtime viewport %dx%d."),
                RequestedSize.X, RequestedSize.Y, ScreenshotSize.X, ScreenshotSize.Y), &Controller);
            return false;
        }
        ScreenshotPath = FPaths::Combine(Directory, FString(Name) + TEXT(".png"));
        if (IFileManager::Get().FileExists(*ScreenshotPath))
        {
            Finish(false, TEXT("Refusing a stale screenshot path; use a fresh output directory."), &Controller);
            return false;
        }
        PendingCapture = MakeShared<FJsonObject>();
        PendingCapture->SetStringField(TEXT("Name"), Name);
        PendingCapture->SetStringField(TEXT("File"), ScreenshotPath);
        PendingCapture->SetNumberField(TEXT("ViewportWidth"), ScreenshotSize.X);
        PendingCapture->SetNumberField(TEXT("ViewportHeight"), ScreenshotSize.Y);
        const FGeometry& RootGeometry = Controller.GetShellView()->GetCachedGeometry();
        const FVector2D Origin = RootGeometry.GetAbsolutePosition();
        TArray<TSharedPtr<FJsonValue>> ControlRows;
        int32 SmallControls = 0;
        int32 ClippedControls = 0;
        int32 ScrollClippedRows = 0;
        int32 VisibleEnabledControls = 0;
        for (const FTaggedControl& Control : Controls(Controller))
        {
            const FGeometry& Geometry = Control.Widget->GetCachedGeometry();
            const FVector2D TopLeft = Geometry.GetAbsolutePosition();
            const FVector2D Size = Geometry.GetAbsoluteSize();
            const FVector2D BottomRight = TopLeft + Size;
            const FVector2D Center = TopLeft + Size * 0.5;
            const FVector2D Local = TopLeft - Origin;
            const bool bInViewport = Local.X >= -0.5 && Local.Y >= -0.5
                && Local.X + Size.X <= ScreenshotSize.X + 0.5 && Local.Y + Size.Y <= ScreenshotSize.Y + 0.5;
            const bool bHasArea = Size.X > 0. && Size.Y > 0.;
            const bool bCenterVisible = bHasArea && PointUnclipped(*Control.Widget, Center)
                && Local.X + Size.X > 0 && Local.Y + Size.Y > 0 && Local.X < ScreenshotSize.X && Local.Y < ScreenshotSize.Y;
            const bool bFullyUnclipped = bHasArea && PointUnclipped(*Control.Widget, TopLeft + FVector2D(0.5, 0.5))
                && PointUnclipped(*Control.Widget, BottomRight - FVector2D(0.5, 0.5));
            const bool bMinimum = Size.X >= 63.5 && Size.Y >= 63.5;
            const bool bHit = bCenterVisible && HitPath(Center).ContainsWidget(&Control.Widget.Get());
            const TOptional<FSlateClippingState>& Clip = Control.Widget->GetCurrentClippingState();
            const bool bScissorClip = Clip.IsSet() && Clip->ScissorRect.IsSet();
            const FSlateRect ClipBounds = bScissorClip ? Clip->ScissorRect->GetBoundingBox()
                : FSlateRect(Origin.X, Origin.Y, Origin.X + ScreenshotSize.X, Origin.Y + ScreenshotSize.Y);
            const bool bHorizontalUnclipped = Local.X >= -0.5 && Local.X + Size.X <= ScreenshotSize.X + 0.5
                && TopLeft.X >= ClipBounds.Left - 0.5 && BottomRight.X <= ClipBounds.Right + 0.5;
            const bool bClipInsideViewport = ClipBounds.Top >= Origin.Y - 0.5
                && ClipBounds.Bottom <= Origin.Y + ScreenshotSize.Y + 0.5;
            const FString Tag = Control.Widget->GetTag().ToString();
            const bool bSelectionRow = Tag == TEXT("HW.Training") || Tag.StartsWith(TEXT("HW.Quest."));
            // A partially exposed row at the edge of the dedicated quest list is
            // expected scroll behavior. This exception never applies to action
            // buttons, horizontal clipping, undersized rows, or clicked targets.
            const bool bExpectedScrollClipping = bSelectionRow && Control.bInQuestListScroll
                && bCenterVisible && !bFullyUnclipped && bMinimum && bScissorClip
                && bHorizontalUnclipped && bClipInsideViewport;
            const double VisibleWidth = FMath::Max(0., FMath::Min(double(BottomRight.X), double(ClipBounds.Right))
                - FMath::Max(double(TopLeft.X), double(ClipBounds.Left)));
            const double VisibleHeight = FMath::Max(0., FMath::Min(double(BottomRight.Y), double(ClipBounds.Bottom))
                - FMath::Max(double(TopLeft.Y), double(ClipBounds.Top)));
            // Fully scrolled-out controls are not currently visible controls. Record
            // them, but do not misreport a deliberate scrolling list as clipping.
            if (bCenterVisible && Control.bEnabled)
            {
                ++VisibleEnabledControls;
                SmallControls += !bMinimum;
                ClippedControls += (!bInViewport || !bFullyUnclipped) && !bExpectedScrollClipping;
                ScrollClippedRows += bExpectedScrollClipping;
            }
            TSharedPtr<FJsonObject> Row = MakeShared<FJsonObject>();
            Row->SetStringField(TEXT("Tag"), Control.Widget->GetTag().ToString());
            Row->SetNumberField(TEXT("X"), Local.X);
            Row->SetNumberField(TEXT("Y"), Local.Y);
            Row->SetNumberField(TEXT("Width"), Size.X);
            Row->SetNumberField(TEXT("Height"), Size.Y);
            Row->SetBoolField(TEXT("Enabled"), Control.bEnabled);
            Row->SetBoolField(TEXT("CenterVisible"), bCenterVisible);
            Row->SetBoolField(TEXT("CenterHitTestReachable"), bHit);
            Row->SetBoolField(TEXT("AtLeast64Px"), bMinimum);
            Row->SetBoolField(TEXT("WithinViewport"), bInViewport);
            Row->SetBoolField(TEXT("Unclipped"), bFullyUnclipped);
            Row->SetBoolField(TEXT("InQuestListScroll"), Control.bInQuestListScroll);
            Row->SetBoolField(TEXT("ExpectedScrollClipping"), bExpectedScrollClipping);
            Row->SetBoolField(TEXT("HorizontalUnclipped"), bHorizontalUnclipped);
            Row->SetNumberField(TEXT("VisibleWidth"), VisibleWidth);
            Row->SetNumberField(TEXT("VisibleHeight"), VisibleHeight);
            Row->SetNumberField(TEXT("ClipTop"), ClipBounds.Top - Origin.Y);
            Row->SetNumberField(TEXT("ClipBottom"), ClipBounds.Bottom - Origin.Y);
            ControlRows.Add(MakeShared<FJsonValueObject>(Row));
        }
        PendingCapture->SetArrayField(TEXT("Controls"), ControlRows);
        PendingCapture->SetNumberField(TEXT("VisibleEnabledControls"), VisibleEnabledControls);
        PendingCapture->SetNumberField(TEXT("ControlsBelow64Px"), SmallControls);
        PendingCapture->SetNumberField(TEXT("ClippedVisibleControls"), ClippedControls);
        PendingCapture->SetNumberField(TEXT("ScrollClippedRows"), ScrollClippedRows);
        PendingCapture->SetBoolField(TEXT("LayoutPass"), SmallControls == 0 && ClippedControls == 0 && VisibleEnabledControls > 0);
        bCapturing = true;
        bCaptureProcessed = false;
        FScreenshotRequest::RequestScreenshot(ScreenshotPath, true, false, false);
        return true;
    }

    bool CompleteCapture(AHWShellPlayerController& Controller)
    {
        if (!bCapturing) { return true; }
        if (!bCaptureProcessed) { return false; }
        bCapturing = false;
        TArray<uint8> Bytes;
        const bool bRead = FFileHelper::LoadFileToArray(Bytes, *ScreenshotPath);
        const uint8 PngSignature[] = {137, 80, 78, 71, 13, 10, 26, 10};
        const bool bPng = bRead && Bytes.Num() >= 24 && FMemory::Memcmp(Bytes.GetData(), PngSignature, 8) == 0;
        auto ReadBigEndian = [&Bytes](int32 Offset)
        {
            return (uint32(Bytes[Offset]) << 24) | (uint32(Bytes[Offset + 1]) << 16)
                | (uint32(Bytes[Offset + 2]) << 8) | uint32(Bytes[Offset + 3]);
        };
        const bool bCorrectSize = bPng && ReadBigEndian(16) == uint32(ScreenshotSize.X) && ReadBigEndian(20) == uint32(ScreenshotSize.Y);
        PendingCapture->SetBoolField(TEXT("FileVerified"), bCorrectSize);
        PendingCapture->SetNumberField(TEXT("FileBytes"), Bytes.Num());
        Captures.Add(MakeShared<FJsonValueObject>(PendingCapture));
        if (!bCorrectSize || !PendingCapture->GetBoolField(TEXT("LayoutPass")))
        {
            Finish(false, bCorrectSize ? TEXT("Visible clickable controls fail the 64 px or clipping requirement.")
                : TEXT("Screenshot was not saved as a PNG at the requested viewport size."), &Controller);
            return false;
        }
        PendingCapture.Reset();
        return true;
    }

    void Tick(AHWShellPlayerController& Controller)
    {
        if (!bInitialized) { Initialize(Controller); }
        if (!bEnabled || bFinished) { return; }
        if (FPlatformTime::Seconds() - StartedAt > 90.)
        {
            Finish(false, TEXT("90-second runtime QA timeout."), &Controller);
            return;
        }
        if (!CompleteCapture(Controller) || !Controller.Runs() || !Controller.Profile()) { return; }
#if WITH_EDITOR
        // Loading a runtime map can queue material shaders after BeginPlay. Count
        // stable frames only after compilation completes so checkerboard fallback
        // materials cannot be presented as a verified final screenshot.
        if (GShaderCompilingManager && GShaderCompilingManager->IsCompiling())
        {
            StableFrames = 0;
            return;
        }
#endif
        UHWQuestRunSubsystem* Runs = Controller.Runs();
        UHWProfileSubsystem* Profile = Controller.Profile();
        const EHWQuestRunState RunState = Runs->GetRunState();
        switch (Stage)
        {
        case EQAStage::LobbyReady:
            if (Stable(Controller.IsLobby() && Profile->IsProfileAvailable() && Controller.GetShellView().IsValid(), 30))
            {
                InitialClears = Profile->GetClearCount(TEXT("tutorial"));
                Report->SetNumberField(TEXT("InitialTutorialClears"), InitialClears);
                if (Scenario == TEXT("reload") && InitialClears < 1)
                {
                    Finish(false, TEXT("Reload scenario did not find a persisted tutorial clear."), &Controller);
                    return;
                }
                if (Capture(Controller, Scenario == TEXT("reload") ? TEXT("lobby-reloaded") : TEXT("lobby"))) { Next(EQAStage::LobbyCaptured); }
            }
            break;
        case EQAStage::LobbyCaptured:
            if (Scenario != TEXT("full")) { Finish(true, TEXT("Lobby screenshot and requested persistence checks passed."), &Controller); }
            else if (Click(Controller, TEXT("HW.Launch"))) { Next(EQAStage::CombatReady); }
            break;
        case EQAStage::CombatReady:
            if (Stable(RunState == EHWQuestRunState::InCombat && Controller.Boss() && Controller.GetPawn(), 30))
            {
                const FHWQuestRunTicket Ticket = Runs->GetRunTicket();
                if (Ticket.ArenaId != TEXT("tutorial") || !Controller.GetWorld()
                    || Controller.GetWorld()->GetOutermost()->GetName() != Ticket.MapPackageName)
                {
                    Finish(false, TEXT("Training did not arrive in its registered runtime map."), &Controller);
                    return;
                }
                FirstRun = Ticket.RunId;
                Report->SetStringField(TEXT("FirstRunId"), FirstRun.ToString());
                Report->SetStringField(TEXT("CombatMap"), Ticket.MapPackageName);
                if (Capture(Controller, TEXT("combat"))) { Next(EQAStage::CombatCaptured); }
            }
            break;
        case EQAStage::CombatCaptured:
        {
            AHWAinCharacter* Player = Cast<AHWAinCharacter>(Controller.GetPawn());
            AHWBossCharacter* Boss = Controller.Boss();
            if (!Player || !Boss) { Finish(false, TEXT("Combat participants disappeared."), &Controller); return; }
            const FVector Facing = Boss->GetActorForwardVector().GetSafeNormal2D();
            FVector Position = Boss->GetActorLocation() - Facing * 180.f;
            Position.Z = Player->GetActorLocation().Z;
            Player->SetActorLocation(Position, false, nullptr, ETeleportType::TeleportPhysics);
            Controller.SetControlRotation(Facing.Rotation());
            Player->SetActorRotation(Facing.Rotation());
            BossHealthBefore = Boss->GetHealth();
            Report->SetNumberField(TEXT("BossHealthBeforeRoutedAttack"), BossHealthBefore);
            if (!Click(Controller, TEXT("HW.Lock"))) { return; }
            if (!Player->GetLockOn()->IsLocked()) { Finish(false, TEXT("Routed lock-on click did not acquire the boss."), &Controller); return; }
            if (Click(Controller, TEXT("HW.Attack"))) { Next(EQAStage::AttackContact); }
            break;
        }
        case EQAStage::AttackContact:
            if (Controller.Boss() && Controller.Boss()->GetHealth() < BossHealthBefore)
            {
                Report->SetNumberField(TEXT("BossHealthAfterRoutedAttack"), Controller.Boss()->GetHealth());
                Report->SetBoolField(TEXT("RoutedAttackCausedRealContact"), true);
                if (!IConsoleManager::Get().FindConsoleVariable(TEXT("hw.QA.FailProfileSaves")))
                {
                    Finish(false, TEXT("Isolated save-failure injection is unavailable."), &Controller);
                    return;
                }
                SetSaveFailure(true);
                Controller.Boss()->ReceivePlayerHit(Controller.Boss()->GetHealth() + 1.f,
                    EHWAttackTier::Smash, Controller.GetPawn()->GetActorLocation());
                Next(EQAStage::PendingReady);
            }
            else if (FPlatformTime::Seconds() - StageStartedAt > 10.)
            {
                Finish(false, TEXT("Routed attack produced no boss damage within ten seconds."), &Controller);
            }
            break;
        case EQAStage::PendingReady:
            if (Stable(RunState == EHWQuestRunState::VictoryPendingSave, 15))
            {
                if (!Profile->HasPendingSave() || Profile->GetClearCount(TEXT("tutorial")) != InitialClears)
                {
                    Finish(false, TEXT("Failed save exposed a committed clear or lost the pending candidate."), &Controller);
                    return;
                }
                if (Capture(Controller, TEXT("victory-unsaved"))) { Next(EQAStage::PendingCaptured); }
            }
            break;
        case EQAStage::PendingCaptured:
            SetSaveFailure(false);
            if (Click(Controller, TEXT("HW.RetrySave"))) { Next(EQAStage::VictoryReady); }
            break;
        case EQAStage::VictoryReady:
            if (Stable(RunState == EHWQuestRunState::Victory, 15))
            {
                if (Profile->HasPendingSave() || Profile->GetClearCount(TEXT("tutorial")) != InitialClears + 1)
                {
                    Finish(false, TEXT("Save retry did not commit exactly one clear."), &Controller);
                    return;
                }
                if (Capture(Controller, TEXT("victory"))) { Next(EQAStage::VictoryCaptured); }
            }
            break;
        case EQAStage::VictoryCaptured:
            if (Click(Controller, TEXT("HW.RetryEncounter"))) { Next(EQAStage::RetryReady); }
            break;
        case EQAStage::RetryReady:
            if (Stable(RunState == EHWQuestRunState::InCombat && Controller.GetPawn(), 30))
            {
                const FGuid RetryRun = Runs->GetRunTicket().RunId;
                if (!RetryRun.IsValid() || RetryRun == FirstRun)
                {
                    Finish(false, TEXT("Retry reused the previous run identity."), &Controller);
                    return;
                }
                Report->SetStringField(TEXT("RetryRunId"), RetryRun.ToString());
                RetriedRun = RetryRun;
                AHWAinCharacter* Player = Cast<AHWAinCharacter>(Controller.GetPawn());
                if (!Player || !Player->GetCombat()->ApplyIncomingDamage(Player->GetCombat()->GetMaxHealth() + 1.f, EHWAttackTier::Smash))
                {
                    Finish(false, TEXT("Scripted defeat damage was not accepted."), &Controller);
                    return;
                }
                Next(EQAStage::DefeatReady);
            }
            break;
        case EQAStage::DefeatReady:
            if (Stable(RunState == EHWQuestRunState::Defeat, 15))
            {
                if (Profile->GetClearCount(TEXT("tutorial")) != InitialClears + 1)
                {
                    Finish(false, TEXT("Defeat incorrectly changed the clear ledger."), &Controller);
                    return;
                }
                if (Capture(Controller, TEXT("defeat"))) { Next(EQAStage::DefeatCaptured); }
            }
            break;
        case EQAStage::DefeatCaptured:
            if (Click(Controller, TEXT("HW.Return"))) { Next(EQAStage::ReturnReady); }
            break;
        case EQAStage::ReturnReady:
            if (Stable(Controller.IsLobby() && RunState == EHWQuestRunState::Idle, 30))
            {
                if (Profile->GetClearCount(TEXT("tutorial")) != InitialClears + 1)
                {
                    Finish(false, TEXT("Returning to the lobby lost or duplicated the saved clear."), &Controller);
                    return;
                }
                if (Capture(Controller, TEXT("lobby-after"))) { Next(EQAStage::ReturnCaptured); }
            }
            break;
        case EQAStage::ReturnCaptured:
            if (Click(Controller, TEXT("HW.Launch"))) { Next(EQAStage::AbandonCombatReady); }
            break;
        case EQAStage::AbandonCombatReady:
            if (Stable(RunState == EHWQuestRunState::InCombat && Controller.GetPawn(), 30))
            {
                const FGuid AbandonRun = Runs->GetRunTicket().RunId;
                if (!AbandonRun.IsValid() || AbandonRun == FirstRun || AbandonRun == RetriedRun)
                {
                    Finish(false, TEXT("The extra launch reused a prior run identity."), &Controller);
                    return;
                }
                Report->SetStringField(TEXT("AbandonRunId"), AbandonRun.ToString());
                if (Click(Controller, TEXT("HW.Leave")))
                {
                    PausedWorldTime = Controller.GetWorld()->GetTimeSeconds();
                    Next(EQAStage::LeaveReady);
                }
            }
            break;
        case EQAStage::LeaveReady:
            if (Stable(Controller.bLeaveConfirmation && Controller.GetWorld()->IsPaused()
                && RunState == EHWQuestRunState::InCombat, 10))
            {
                if (!FMath::IsNearlyEqual(Controller.GetWorld()->GetTimeSeconds(), PausedWorldTime))
                {
                    Finish(false, TEXT("World time advanced while the leave confirmation was paused."), &Controller);
                    return;
                }
                Report->SetBoolField(TEXT("LeaveConfirmationPausedWorld"), true);
                if (Capture(Controller, TEXT("leave-confirmation"))) { Next(EQAStage::LeaveCaptured); }
            }
            break;
        case EQAStage::LeaveCaptured:
            if (Click(Controller, TEXT("HW.CancelLeave"))) { Next(EQAStage::CancelLeaveReady); }
            break;
        case EQAStage::CancelLeaveReady:
            if (Stable(!Controller.bLeaveConfirmation && !Controller.GetWorld()->IsPaused()
                && RunState == EHWQuestRunState::InCombat, 10))
            {
                if (Profile->GetClearCount(TEXT("tutorial")) != InitialClears + 1)
                {
                    Finish(false, TEXT("Canceling leave changed the clear ledger."), &Controller);
                    return;
                }
                Report->SetBoolField(TEXT("CancelLeaveRestoredCombat"), true);
                if (Click(Controller, TEXT("HW.Leave"))) { Next(EQAStage::ConfirmLeaveReady); }
            }
            break;
        case EQAStage::ConfirmLeaveReady:
            if (Stable(Controller.bLeaveConfirmation && Controller.GetWorld()->IsPaused()
                && RunState == EHWQuestRunState::InCombat, 10))
            {
                if (Click(Controller, TEXT("HW.ConfirmLeave"))) { Next(EQAStage::AbandonReturnReady); }
            }
            break;
        case EQAStage::AbandonReturnReady:
            if (Stable(Controller.IsLobby() && RunState == EHWQuestRunState::Idle
                && !Controller.GetWorld()->IsPaused(), 30))
            {
                if (Profile->HasPendingSave() || Profile->GetClearCount(TEXT("tutorial")) != InitialClears + 1)
                {
                    Finish(false, TEXT("Confirmed abandon changed the clear ledger or left a pending save."), &Controller);
                    return;
                }
                Report->SetBoolField(TEXT("ConfirmedAbandonReturnedToLobby"), true);
                if (Capture(Controller, TEXT("lobby-abandoned"))) { Next(EQAStage::AbandonReturnCaptured); }
            }
            break;
        case EQAStage::AbandonReturnCaptured:
            Finish(true, TEXT("Runtime travel, routed attack, save retry, victory, fresh-run retry, defeat, lobby return, paused leave confirmation, cancel, and confirmed abandon passed."), &Controller);
            break;
        default: break;
        }
    }
};
}

void HWTickShellQA(AHWShellPlayerController& Controller)
{
    if (!Controller.IsLocalController()) { return; }
    static FHWShellQA Driver;
    Driver.Tick(Controller);
}
#endif
