#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "HWLampFlicker.generated.h"

class ULightComponent;

/**
 * The shelter's old generator (EP01 L253 «조명이 일정 간격으로 명멸했다. 발전기가 늙었다는 뜻이었다», docs/design/161):
 * every light on an actor tagged HW_Flicker dips at a steady interval - a short double blink, then its own level again.
 * Each lamp keeps its own phase so the passage does not blink in unison. Picture only: skipped on a dedicated server.
 */
UCLASS()
class HWANGHONCOMBATUE_API UHWLampFlickerSubsystem : public UTickableWorldSubsystem
{
    GENERATED_BODY()

public:
    virtual void OnWorldBeginPlay(UWorld& InWorld) override;
    virtual void Tick(float DeltaTime) override;
    virtual TStatId GetStatId() const override { RETURN_QUICK_DECLARE_CYCLE_STAT(UHWLampFlickerSubsystem, STATGROUP_Tickables); }
    virtual bool IsTickable() const override { return Lamps.Num() > 0; }

    /** Seconds between blinks (the text's «일정 간격») and the blink itself. */
    float Interval = 6.5f;
    float BlinkTime = 0.42f;

    int32 NumLamps() const { return Lamps.Num(); }
    /** Lamps below their own level right now. */
    int32 NumDimmed() const;
    /** QA only (-HWQA=sheltertour): >= 0 holds every lamp at this time into the cycle, so a blink can be photographed. */
    float QAHoldCycle = -1.f;

    /** 0..1 brightness factor at a time into the cycle - public so the rule can be tested. */
    static float FactorAt(float CycleTime, float BlinkTime);

private:
    struct FLamp
    {
        TWeakObjectPtr<ULightComponent> Light;
        float Base = 0.f;
        float Phase = 0.f;
    };
    TArray<FLamp> Lamps;
    float Clock = 0.f;
};
