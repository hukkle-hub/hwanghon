#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "System/HWSystemTypes.h"
#include "HWHeroFxComponent.generated.h"

class AHWAinCharacter;
class UHWCharacterKitComponent;
class UMaterialInstanceDynamic;
class UParticleSystem;
class UParticleSystemComponent;
class UPointLightComponent;
class UStaticMeshComponent;
struct FHWPendingAbilityHit;

USTRUCT()
struct FHWHeroFxTints
{
    GENERATED_BODY()

    UPROPERTY(Transient)
    TArray<TObjectPtr<UMaterialInstanceDynamic>> Emitters;   // null: that emitter cannot be recoloured

    UPROPERTY(Transient)
    TArray<FName> Off;                                        // switched off instead (smoke, ribbons in the pack's red)
};

/**
 * The four heroes' skill effects (docs/design/171, concept tools/vfx/hero-skill-study.html). Layers, each on the
 * kit's own clock so they line up with the hit, not with a clip:
 * - tell: a glint on the blade tip as the skill starts;
 * - trail: the blade's arc in the hero's colour from the start to just after the last hit (Ryu both blades);
 * - hit: a flash and sparks where a hit lands, bigger on smash; an AoE hit rings the floor;
 * - Sera: an orb thrown from the hand that arrives on the hit time;
 * - dodge: a burst where the hero left; buff: the body glows in the hero's colour for the buff's length.
 * Colours: Ain orange, Kain steel, Ryu red, Sera blue. Paragon particles carry the shapes; M_HW_ParticleTint
 * recolours them (the packs have red, fire and green only), lights add the colour to the scene.
 */
UCLASS(ClassGroup=(Hwanghon), meta=(BlueprintSpawnableComponent))
class HWANGHONCOMBATUE_API UHWHeroFxComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UHWHeroFxComponent();

    void Bind(AHWAinCharacter* InHero, UHWCharacterKitComponent* Kit);

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
    virtual void EndPlay(const EEndPlayReason::Type Reason) override;

    /** QA: what the layer is doing now (for the capture log). */
    FString Describe() const;

private:
    UFUNCTION()
    void HandleAbility(FName CharacterId, EHWAbilitySlot Slot, float Multiplier);

    void HandleHit(const FHWPendingAbilityHit& Hit, AActor* Landed, EHWAbilitySlot Slot);

    bool ShouldTint(FName Key) const;
    void Tint(UParticleSystemComponent* C, UParticleSystem* PS);
    UParticleSystemComponent* Fire(FName Key, const FVector& At, float Scale = 1.f, const FRotator& Rot = FRotator::ZeroRotator);
    void Flash(const FVector& At, float Peak, float Seconds, float Radius);
    void StartTrails(float MaxSeconds);
    void EndTrails(float After);
    void Launch(const FVector& To, float Flight, float Arc, bool bAoe);
    void Buff(float Seconds);
    FVector Socket(FName Name) const;
    FVector AimPoint(float Forward) const;
    FLinearColor HeroColor() const;
    bool IsSlotBuff(EHWAbilitySlot Slot) const;
    bool IsSlotDodge(EHWAbilitySlot Slot) const;

    TWeakObjectPtr<AHWAinCharacter> Hero;
    FName Id;

    UPROPERTY(Transient)
    TMap<FName, TObjectPtr<UParticleSystem>> Systems;

    UPROPERTY(Transient)
    TObjectPtr<UMaterialInstanceDynamic> TrailMat;

    UPROPERTY(Transient)
    TObjectPtr<UMaterialInterface> TintBase;

    UPROPERTY(Transient)
    TMap<TObjectPtr<UParticleSystem>, FHWHeroFxTints> Tints;   // per system: one tinted material per emitter

    UPROPERTY(Transient)
    TObjectPtr<UMaterialInstanceDynamic> Skin;   // M_HW_GlyphOverlay: the buff glow over the body

    UPROPERTY(Transient)
    TObjectPtr<UPointLightComponent> Tip;        // the tell's glint on the blade tip

    UPROPERTY(Transient)
    TArray<TObjectPtr<UPointLightComponent>> Lights;   // hit flashes (a small pool)

    UPROPERTY(Transient)
    TArray<TObjectPtr<UParticleSystemComponent>> Trails;

    struct FLightFade { int32 Index; float Age; float Seconds; float Peak; };
    TArray<FLightFade> Fades;
    int32 NextLight = 0;
    float TipAge = 99.f;
    float TrailEndAt = -1.f;      // world seconds; <0 = none open
    float BuffLeft = 0.f;
    float BuffTotal = 0.f;

    struct FOrb
    {
        TObjectPtr<UStaticMeshComponent> Mesh;
        TObjectPtr<UPointLightComponent> Light;
        FVector From; FVector To; float Age = 0.f; float Flight = 0.3f; float Arc = 0.f; bool bAoe = false;
    };
    TArray<FOrb> Orbs;

    UPROPERTY(Transient)
    TArray<TObjectPtr<UObject>> OrbParts;        // keeps the orbs' components referenced

    struct FLaunch { float At; FVector To; float Flight; float Arc; bool bAoe; };
    TArray<FLaunch> Launches;

    int32 Counts[5] = {};                        // QA: what fired - tell, trail, hit, ring, orb
    float WorldTime() const;
};
