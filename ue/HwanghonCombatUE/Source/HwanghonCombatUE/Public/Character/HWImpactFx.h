#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HWImpactFx.generated.h"

class UInstancedStaticMeshComponent;
class UMaterialInstanceDynamic;
class UMaterialInterface;
class UStaticMesh;

/**
 * The code-driven impact layer (docs/design/174, from the Crimson Desert study, doc 173): what the Paragon packs
 * could not give - thin fast line sparks, radial needles, a one-frame lens streak, the struck material's own response
 * (straw, rock chips, dust/mist), embers left on the floor, thin ring arcs turning around a spin, a crack decal.
 * Simulated on the CPU, drawn as instanced quads/meshes: colour, count and timing are exact, and the budget is a
 * number (fewer on Android). One per world, made on first use.
 */
UCLASS(NotPlaceable)
class HWANGHONCOMBATUE_API AHWImpactFx : public AActor
{
    GENERATED_BODY()

public:
    AHWImpactFx();

    static AHWImpactFx* Get(UWorld* World);

    /** Line sparks in a cone around Dir (deg), with gravity; Speed cm/s. */
    void Sparks(const FVector& At, const FVector& Dir, int32 Count, const FLinearColor& Color, float Speed, float SpreadDeg,
        float Life = 0.35f, float Gravity = 980.f, float Width = 2.2f);
    /** Needles shot out flat all around (a ring of streaks), no gravity, short. */
    void Needles(const FVector& At, int32 Count, const FLinearColor& Color, float Speed, float Life = 0.22f, float Up = 0.25f);
    /** The one-frame lens streak across the screen at the hit. */
    void LensStreak(const FVector& At, const FLinearColor& Color, float Length);
    /** Chips thrown off the struck surface: bChipsAreStraw = straw, else rock. FloorZ: where they land and bounce. */
    void Debris(const FVector& At, int32 Count, float Speed, bool bChipsAreStraw, float FloorZ);
    /** Soft puffs (dust, mist) that grow and fade. */
    void Puff(const FVector& At, int32 Count, const FLinearColor& Color, float Size, float Life, float Spread = 60.f, float Rise = 40.f);
    /** Embers left lying on the floor, flickering out. */
    void Embers(const FVector& At, int32 Count, const FLinearColor& Color, float Radius, float Life);
    /** Thin ring arcs turning around an actor's feet for Seconds (a spin skill). */
    void Rings(AActor* Around, const FLinearColor& Color, float Radius, float Seconds, float FloorZ);
    /** A crack decal on the floor that fades. */
    void Crack(const FVector& At, float Radius, float Seconds);

    virtual void Tick(float DeltaSeconds) override;

    FString Describe() const;

private:
    enum class EKind : uint8 { Streak, Lens, Puff, Rock, Straw, Ember };
    struct FPart
    {
        EKind Kind;
        FVector P, V;
        float Age = 0.f, Life = 0.3f, Size = 2.f, Len = 20.f, Gravity = 0.f, Drag = 0.f, FloorZ = -1e9f;
        FQuat Rot = FQuat::Identity;
        FVector Spin = FVector::ZeroVector;
        int32 Group = 0;
    };
    struct FRing
    {
        TWeakObjectPtr<AActor> Around;
        int32 Group = 0;
        float Age = 0.f, Seconds = 1.f, Radius = 250.f, FloorZ = 0.f, Yaw = 0.f;
    };

    int32 GroupFor(EKind Kind, const FLinearColor& Color);
    bool Room() const;
    UInstancedStaticMeshComponent* MakeIsm(UStaticMesh* Mesh, UMaterialInterface* Mat);

    UPROPERTY(Transient)
    TArray<TObjectPtr<UInstancedStaticMeshComponent>> Groups;

    UPROPERTY(Transient)
    TObjectPtr<UMaterialInterface> CrackMat;

    TArray<EKind> GroupKinds;
    TArray<uint32> GroupKeys;
    TArray<FPart> Parts;
    TArray<FRing> RingList;
    int32 Spawned = 0;
    int32 Peak = 0;
    float RockScale = 0.1f;
};
