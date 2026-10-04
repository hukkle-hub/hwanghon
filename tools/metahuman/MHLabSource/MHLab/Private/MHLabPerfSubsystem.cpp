#include "MHLabPerfSubsystem.h"

#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/App.h"
#include "RenderCore.h"
#include "RHI.h"

void UMHLabPerfSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
#if !WITH_EDITOR
	Maps = { TEXT("/Game/Perf/L_PerfEmpty"), TEXT("/Game/Perf/L_PerfParty"), TEXT("/Game/Perf/L_PerfRaid") };
	TickHandle = FTSTicker::GetCoreTicker().AddTicker(FTickerDelegate::CreateUObject(this, &UMHLabPerfSubsystem::Tick), 0.0f);
#endif
}

void UMHLabPerfSubsystem::Deinitialize()
{
	FTSTicker::GetCoreTicker().RemoveTicker(TickHandle);
	Super::Deinitialize();
}

bool UMHLabPerfSubsystem::Tick(float DeltaTime)
{
	UWorld* World = GetGameInstance() ? GetGameInstance()->GetWorld() : nullptr;
	if (!World)
	{
		return true;
	}
	const double Now = FPlatformTime::Seconds();
	if (MapIndex < 0 || (!bSampling && Now - PhaseStart > 30.0))
	{
		// next map (the first one replaces the default map)
		MapIndex++;
		if (MapIndex >= Maps.Num())
		{
			UE_LOG(LogTemp, Display, TEXT("MHPERF done"));
			return false;
		}
		UE_LOG(LogTemp, Display, TEXT("MHPERF open %s"), *Maps[MapIndex]);
		UGameplayStatics::OpenLevel(World, FName(*Maps[MapIndex]));
		PhaseStart = Now;
		bSampling = false;
		Frames = 0;
		SumFrame = SumGame = SumRender = SumGPU = MaxFrame = 0;
		return true;
	}
	const double Since = Now - PhaseStart;
	if (!bSampling && Since > 8.0 && World->GetMapName().Contains(FPaths::GetBaseFilename(Maps[MapIndex])))
	{
		bSampling = true;
	}
	if (bSampling)
	{
		const double FrameMs = FApp::GetDeltaTime() * 1000.0;
		SumFrame += FrameMs;
		MaxFrame = FMath::Max(MaxFrame, FrameMs);
		SumGame += FPlatformTime::ToMilliseconds(GGameThreadTime);
		SumRender += FPlatformTime::ToMilliseconds(GRenderThreadTime);
		SumGPU += FPlatformTime::ToMilliseconds(RHIGetGPUFrameCycles());
		Frames++;
		if (Since > 28.0)
		{
			const double N = FMath::Max(1, Frames);
			UE_LOG(LogTemp, Display, TEXT("MHPERF map=%s frames=%d frame_ms=%.2f max_ms=%.1f game_ms=%.2f render_ms=%.2f gpu_ms=%.2f"),
				*FPaths::GetBaseFilename(Maps[MapIndex]), Frames, SumFrame / N, MaxFrame, SumGame / N, SumRender / N, SumGPU / N);
			bSampling = false;
			PhaseStart = Now - 31.0;   // straight to the next map
		}
	}
	return true;
}
