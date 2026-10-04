#include "System/HWPerfLogSubsystem.h"

#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "HAL/PlatformTime.h"
#include "RenderCore.h"
#include "RHI.h"

void UHWPerfLogSubsystem::Tick(float DeltaTime)
{
#if !UE_BUILD_SHIPPING
    if (DeltaTime <= 0.f) return;
    ++Frames;
    Window += DeltaTime;
    GameMs += FPlatformTime::ToMilliseconds(GGameThreadTime);
    RenderMs += FPlatformTime::ToMilliseconds(GRenderThreadTime);
    GpuMs += FPlatformTime::ToMilliseconds(RHIGetGPUFrameCycles());
    WorstMs = FMath::Max(WorstMs, DeltaTime * 1000.0);
    if (Window >= 5.0)
    {
        const UWorld* World = GetGameInstance() ? GetGameInstance()->GetWorld() : nullptr;
        UE_LOG(LogTemp, Display, TEXT("[HWPerf] %s fps %.1f frame %.1f ms (worst %.1f) game %.1f render %.1f gpu %.1f"),
            World ? *World->GetMapName() : TEXT("-"), Frames / Window, Window * 1000.0 / Frames, WorstMs,
            GameMs / Frames, RenderMs / Frames, GpuMs / Frames);
        Window = 0.0;
        Frames = 0;
        GameMs = RenderMs = GpuMs = WorstMs = 0.0;
    }
#endif
}
