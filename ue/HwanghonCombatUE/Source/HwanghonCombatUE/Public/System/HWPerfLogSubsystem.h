#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Tickable.h"
#include "HWPerfLogSubsystem.generated.h"

/**
 * Frame cost to the log every 5 s in non-shipping builds (docs/design/184 §6): "[HWPerf] map fps frame game render gpu".
 * The tablet cannot take a command line (Android 16 does not read UECommandLine.txt), so the measure lives in the
 * game: play, then read `adb logcat -s UE` and grep HWPerf.
 */
UCLASS()
class HWANGHONCOMBATUE_API UHWPerfLogSubsystem : public UGameInstanceSubsystem, public FTickableGameObject
{
    GENERATED_BODY()

public:
    virtual void Tick(float DeltaTime) override;
    virtual TStatId GetStatId() const override { RETURN_QUICK_DECLARE_CYCLE_STAT(UHWPerfLogSubsystem, STATGROUP_Tickables); }
    virtual bool IsTickable() const override { return !IsTemplate(); }
    virtual ETickableTickType GetTickableTickType() const override { return ETickableTickType::Conditional; }

private:
    double Window = 0.0;
    int32 Frames = 0;
    double GameMs = 0.0, RenderMs = 0.0, GpuMs = 0.0, WorstMs = 0.0;
};
