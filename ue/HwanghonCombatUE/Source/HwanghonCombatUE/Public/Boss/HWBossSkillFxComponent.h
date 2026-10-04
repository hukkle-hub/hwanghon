#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Combat/HWCombatTypes.h"
#include "HWBossSkillFxComponent.generated.h"

class AHWBossCharacter;
class UCameraComponent;

/**
 * What the parry rules look like (docs/design/183 §5, approved motion study tools/vfx/parry-motion-study.html), on
 * every boss, drawn with the code-driven impact layer (AHWImpactFx) so it costs the same on phones:
 *   parry      - warm white sparks + needles at the meeting point, growing with the streak (1.0 -> 1.4), small shake
 *   break      - lens streak + needles, a 0.06 s white screen flash, shake 0.25 s; a body broken in the air
 *                lands with a dark dust ring, rock chips and a crack
 *   riposte    - red streak + sparks, a red edge flash, the camera closes in (field of view x0.72) for a second
 *   must-dodge - a beat that cannot be parried flashes red-orange twice at the chest (0.85 / 0.63 s before) and
 *                draws a red-orange ring of embers on the floor where it lands (0.5 s before)
 */
UCLASS(ClassGroup=(Hwanghon), meta=(BlueprintSpawnableComponent))
class HWANGHONCOMBATUE_API UHWBossSkillFxComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UHWBossSkillFxComponent();

    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    // QA: how many of each effect fired (docs/design/183 §4)
    FString Describe() const;

private:
    UFUNCTION()
    void HandleParried(FName PatternId, int32 BeatIndex);

    UFUNCTION()
    void HandleRiposte(float Damage);

    UFUNCTION()
    void HandleState(EHWBossState NewState, FName PatternId);

    UFUNCTION()
    void HandleBeat(FName PatternId, int32 BeatIndex);

    UFUNCTION()
    void HandleSpot(int32 BeatIndex, FVector Spot, float RadiusCm, float Seconds);

    UFUNCTION()
    void HandlePhaseIntro(int32 Phase);

    void Shake(float Seconds, float AmplitudeCm);
    void ScreenFlash(const FLinearColor& Color, float Alpha, float Seconds);
    void TickDanger();
    void TickCamera(float DeltaTime);
    float FloorZ() const;
    FVector ChestPoint() const;

    UPROPERTY(Transient)
    TObjectPtr<AHWBossCharacter> Boss;

    TWeakObjectPtr<UCameraComponent> Camera;
    FVector CameraBase = FVector::ZeroVector;
    float BaseFov = -1.f;

    double LastParryAt = -10.0;
    int32 Streak = 0;
    float ShakeLeft = 0.f, ShakeTotal = 0.f, ShakeAmp = 0.f;
    float ZoomLeft = 0.f;
    float ZoomAmount = 0.f;
    bool bWatchLanding = false;
    float LastShownLift = 0.f;

    FName DangerPattern = NAME_None;
    TSet<int32> DangerFired;   // beat * 4 + cue (0, 1 = chest flashes, 2 = ring)

    bool bWasBlinkHidden = false;
    int32 NParry = 0, NBreak = 0, NLand = 0, NRiposte = 0, NDanger = 0, NBlast = 0, NSmoke = 0, NSpot = 0, NBolt = 0, NPhase = 0;
};
