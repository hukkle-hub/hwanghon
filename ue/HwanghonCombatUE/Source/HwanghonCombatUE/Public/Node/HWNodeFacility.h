#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Node/HWNodeConfig.h"
#include "Node/HWNodeRules.h"
#include "HWNodeFacility.generated.h"

class UStaticMeshComponent;
class UTextRenderComponent;
class UMaterialInstanceDynamic;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWNodeFacilitySignature, class AHWNodeFacility*, Facility);

// A node facility with its own health (docs/design/200 §4): the gate (first target, blocks the road until broken),
// the generator (power steps down with damage) and the comms centre (destroyed or held = the node falls).
// Players cannot hurt it; enemies do (AHWNodeEnemy). A graybox cube with a label until the real meshes come.
UCLASS()
class HWANGHONCOMBATUE_API AHWNodeFacility : public AActor
{
    GENERATED_BODY()

public:
    AHWNodeFacility();

    void Configure(const FHWNodeFacilityDef& Def);

    // Returns true on the blow that destroys it.
    bool ApplyEnemyDamage(float Amount);

    void RepairBy(float Amount);

    UPROPERTY(BlueprintAssignable)
    FHWNodeFacilitySignature OnFacilityDestroyed;

    UPROPERTY(BlueprintAssignable)
    FHWNodeFacilitySignature OnFacilityDamaged;

    UFUNCTION(BlueprintPure)
    EHWNodeFacilityKind GetKind() const { return Kind; }

    UFUNCTION(BlueprintPure)
    float GetHealthFraction() const { return Rules.Fraction(); }

    UFUNCTION(BlueprintPure)
    bool IsDestroyed() const { return Rules.IsDestroyed(); }

    // 0..3 (HWNodeRules::GeneratorPower); 3 for anything that is not a generator.
    UFUNCTION(BlueprintPure)
    int32 GetPower() const { return Kind == EHWNodeFacilityKind::Generator ? HWNodeRules::GeneratorPower(Rules.Fraction()) : 3; }

    FVector GetHalfExtent() const { return HalfExtent; }
    FName GetFacilityId() const { return FacilityId; }

    // Horizontal distance from a point to the box's surface (0 inside).
    float DistanceToSurface2D(const FVector& Point) const;

private:
    void Refresh();

    UPROPERTY()
    TObjectPtr<UStaticMeshComponent> Body;

    UPROPERTY()
    TObjectPtr<UTextRenderComponent> Label;

    UPROPERTY(Transient)
    TObjectPtr<UMaterialInstanceDynamic> Material;

    EHWNodeFacilityKind Kind = EHWNodeFacilityKind::Gate;
    FName FacilityId;
    FVector HalfExtent = FVector(100.f);
    HWNodeRules::FFacility Rules;
};
