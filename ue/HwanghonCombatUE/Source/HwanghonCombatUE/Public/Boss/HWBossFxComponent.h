#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Combat/HWCombatTypes.h"
#include "HWBossFxComponent.generated.h"

class AHWBossCharacter;
class UParticleSystem;
class UParticleSystemComponent;
class UPointLightComponent;

/**
 * The boss's effect layer (docs/design/167): Monster Hunter style readability on top of the body's motion.
 * - the tell is a glow that builds along the body (red), the hit a different colour (fire, sparks);
 * - a heavy attack leaves residue on the floor that burns out late (MH Wilds Arkveld);
 * - the novel's beats (deflect, elbow, rebound, sever) each get their own impact.
 * Timings come from the pattern itself (tell / strike / beats), so the effects follow the game, not a clip.
 * EP01 scarecrow profile only for now; the other bosses come after the four heroes' skills (director's order).
 */
UCLASS(ClassGroup=(Hwanghon), meta=(BlueprintSpawnableComponent))
class HWANGHONCOMBATUE_API UHWBossFxComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UHWBossFxComponent();

    /** Hook the boss and (optionally) its canon rules' beats. */
    void Bind(AHWBossCharacter* InBoss, class UHWBossCanonRules* Rules);

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
    virtual void EndPlay(const EEndPlayReason::Type Reason) override;

    /** The awakening roar: the glyph flares over the whole body at the roar's peak, dust rings off the mat. */
    void Roar();

    /** QA: what the layer is doing now (glow, live emitters) for the capture log. */
    FString Describe() const;

private:
    UFUNCTION()
    void HandleState(EHWBossState NewState, FName PatternId);

    UFUNCTION()
    void HandleCanonBeat(FName Beat);

    UFUNCTION()
    void HandlePartBroken(FName PartId);

    UParticleSystemComponent* Fire(const TCHAR* Key, const FVector& At, float Scale = 1.f);
    UParticleSystemComponent* FireAttached(const TCHAR* Key, FName Bone, float Scale = 1.f);
    FVector Bone(FName Name) const;
    FVector Feet() const;
    FVector TowardPlayer(float Cm, float Z) const;
    void ClearTrails();

    TWeakObjectPtr<AHWBossCharacter> Boss;

    UPROPERTY(Transient)
    TMap<FName, TObjectPtr<UParticleSystem>> Systems;

    UPROPERTY(Transient)
    TObjectPtr<class UMaterialInstanceDynamic> Skin;   // M_HW_GlyphOverlay on the body

    UPROPERTY(Transient)
    TObjectPtr<UPointLightComponent> Glyph;        // chest glow: the tell building up

    UPROPERTY(Transient)
    TObjectPtr<UPointLightComponent> Seam;         // the joint's orange pulse while the posture is broken

    UPROPERTY(Transient)
    TArray<TObjectPtr<UParticleSystemComponent>> Trails;

    struct FPending { float At; FName Key; FVector Where; float Scale; };
    TArray<FPending> Pending;                      // residue that goes off late

    EHWBossState State = EHWBossState::Idle;
    FName Pattern;
    float StateTime = 0.f;
    int32 NextBeat = 0;
    bool bFeetSet = false;
    bool bBreath = false;
    float Clock = 0.f;
    float StepCooldown[2] = { 0.f, 0.f };
    // part break (docs/design/166 tabs 5-7): what is broken keeps leaking - embers from the joint, sparks from the core
    TSet<FName> Broken;
    float LeakClock = 0.f;
    float RoarStart = -1.f;
    float PrevFootZ[2] = { 0.f, 0.f };
};
