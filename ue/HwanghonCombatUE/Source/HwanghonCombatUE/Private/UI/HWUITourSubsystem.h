#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Tickable.h"
#include "HWUITourSubsystem.generated.h"

// Capture tour for Clean UI v1 review (docs/design/126). Exists only when the game is started
// with -HWUITour (never in normal play, PIE or automation). It walks the frontend with the same
// calls the buttons make, saves stills and a 15 fps navigation strip with UI through
// FScreenshotRequest, then plays the graybox fight for HUD stills at High / Mid / Low and quits.
//   UnrealEditor.exe HwanghonCombatUE.uproject /Game/Maps/HW_Frontend -game -windowed
//     -ResX=2340 -ResY=1080 -benchmark -fps=30 -HWUITour [-HWUITourOut=<dir>]
UCLASS()
class UHWUITourSubsystem : public UGameInstanceSubsystem, public FTickableGameObject
{
    GENERATED_BODY()

public:
    virtual bool ShouldCreateSubsystem(UObject* Outer) const override;
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;

    virtual void Tick(float RawDeltaTime) override;
    virtual TStatId GetStatId() const override { RETURN_QUICK_DECLARE_CYCLE_STAT(UHWUITourSubsystem, STATGROUP_Tickables); }
    virtual bool IsTickable() const override { return !IsTemplate() && bActive; }
    virtual ETickableTickType GetTickableTickType() const override { return ETickableTickType::Conditional; }

private:
    struct FStep
    {
        float Hold = 1.f;
        TFunction<void()> Enter;
        FString Shot;
    };

    void BuildFrontendSteps();
    void TickFrontend(float DeltaTime);
    void TickCombat(float DeltaTime);
    void RequestShot(const FString& Name);
    void Log(const FString& Line);
    void Finish();

    TArray<FStep> Steps;
    int32 StepIndex = INDEX_NONE;
    float StepTime = 0.f;
    double StepWallStart = 0.0;   // UMG animations run on real time; frames alone can outrun them
    bool bShotTaken = false;

    bool bActive = false;
    bool bRecord = false;
    bool bInCombat = false;
    int32 Frame = 0;
    int32 VideoFrame = 0;
    FString OutDir;
    FString PendingShot;
    // Shots that also get a UI-less twin on the next frame (UI coverage = pixel difference).
    FString PendingBare;
    // Frames to hold after a screenshot is issued, so the next step cannot change the captured frame.
    int32 ShotCooldown = 0;
    int32 BareStage = 0;
    TArray<FString> Report;

    // Combat bot.
    float CombatTime = 0.f;
    float StrikeTime = -1.f;
    float TellTime = -1.f;
    uint8 LastBossState = 255;
    TSet<int32> Answered;
    bool bPlanSmash = false;
    uint8 PressedFor = 0;
    int32 TierStage = 0;          // 0 High, 1 Mid, 2 Low, 3 done
    bool bHudShot = false;
    bool bCounterShot = false;
    float StaggerSeen = -1.f;
    float StageStart = 0.f;
};
