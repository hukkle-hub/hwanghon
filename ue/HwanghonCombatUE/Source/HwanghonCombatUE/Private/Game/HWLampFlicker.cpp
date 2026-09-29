#include "Game/HWLampFlicker.h"

#include "Components/LightComponent.h"
#include "Engine/World.h"
#include "EngineUtils.h"

void UHWLampFlickerSubsystem::OnWorldBeginPlay(UWorld& InWorld)
{
    Super::OnWorldBeginPlay(InWorld);
    Lamps.Reset();
    if (InWorld.GetNetMode() == NM_DedicatedServer) return;
    int32 Index = 0;
    for (TActorIterator<AActor> It(&InWorld); It; ++It)
    {
        if (!It->Tags.Contains(TEXT("HW_Flicker"))) continue;
        TArray<ULightComponent*> Lights;
        It->GetComponents(Lights);
        for (ULightComponent* L : Lights)
        {
            FLamp Lamp;
            Lamp.Light = L;
            Lamp.Base = L->Intensity;
            Lamp.Phase = FMath::Fmod(Index * 2.37f, Interval);   // spread, but fixed: the same lamp blinks at the same beat
            Lamps.Add(Lamp);
            ++Index;
        }
    }
}

float UHWLampFlickerSubsystem::FactorAt(float CycleTime, float Blink)
{
    // a double blink: down to 25 %, back, down to 45 %, back - then steady until the next cycle
    if (CycleTime < 0.f || CycleTime >= Blink) return 1.f;
    const float T = CycleTime / Blink;
    if (T < 0.25f) return 0.25f;
    if (T < 0.45f) return 1.f;
    if (T < 0.7f) return 0.45f;
    return 1.f;
}

void UHWLampFlickerSubsystem::Tick(float DeltaTime)
{
    Clock += DeltaTime;
    for (FLamp& Lamp : Lamps)
    {
        ULightComponent* L = Lamp.Light.Get();
        if (!L) continue;
        const float Cycle = QAHoldCycle >= 0.f ? QAHoldCycle : FMath::Fmod(Clock + Lamp.Phase, Interval);
        const float Want = Lamp.Base * FactorAt(Cycle, BlinkTime);
        if (!FMath::IsNearlyEqual(L->Intensity, Want)) L->SetIntensity(Want);
    }
}

int32 UHWLampFlickerSubsystem::NumDimmed() const
{
    int32 N = 0;
    for (const FLamp& Lamp : Lamps) if (const ULightComponent* L = Lamp.Light.Get()) N += L->Intensity < Lamp.Base * 0.99f;
    return N;
}
