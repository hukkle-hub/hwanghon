#pragma once

#include "Subsystems/GameInstanceSubsystem.h"
#include "Containers/Ticker.h"
#include "MHLabPerfSubsystem.generated.h"

/**
 * Tablet cost of the MetaHuman heroes (docs/design/177 §5): on start, visits L_PerfEmpty / L_PerfParty / L_PerfRaid,
 * waits 8 s on each, samples 20 s of frame / game / render / GPU time, and logs one "MHPERF" line per map.
 * The external UECommandLine.txt is not readable on Android 16, so the run is built in.
 */
UCLASS()
class UMHLabPerfSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

private:
	bool Tick(float DeltaTime);

	FTSTicker::FDelegateHandle TickHandle;
	TArray<FString> Maps;
	int32 MapIndex = -1;
	double PhaseStart = 0.0;
	bool bSampling = false;
	int32 Frames = 0;
	double SumFrame = 0, SumGame = 0, SumRender = 0, SumGPU = 0, MaxFrame = 0;
};
