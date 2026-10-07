#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Node/HWNodeConfig.h"
#include "Node/HWNodeRules.h"
#include "HWNodeNpc.generated.h"

class AHWNodeDirector;
class UTextRenderComponent;

// A node NPC that is part of the node, not a shop (docs/design/201 §3). Each role carries one function:
// technician = repairs (and goes where ordered), medic = heals at the medical bay, scout = forecast and prep time,
// operator = rescue signals, guard = shoots at the gate when the steward armed the NPCs.
// Normal -> Injured -> Missing: a missing NPC is dragged to the holding spot and must be rescued there.
// Dummy body: the "enemy" mannequin until the real cast exists.
UCLASS()
class HWANGHONCOMBATUE_API AHWNodeNpc : public ACharacter
{
    GENERATED_BODY()

public:
    AHWNodeNpc();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    void Configure(AHWNodeDirector* InDirector, const FHWNodeNpcDef& Def, bool bArmed);

    // Returns true when the NPC went down a state (injured, or taken).
    bool ApplyEnemyDamage(float Amount);

    // A player at the holding spot frees them: back home, recovering.
    bool Rescue();

    // Technician only: walk this path (waypoints) to the facility and repair it there. Empty path = come home.
    void OrderTo(const TArray<FVector>& Path, EHWNodeFacilityKind Facility);
    void ClearOrder();

    // Evacuation: walk this path to the shelter and stay there (off post: no function). ReturnHome undoes it.
    void EvacuateTo(const TArray<FVector>& Path);
    void ReturnHome();
    bool IsEvacuated() const { return bEvacuated; }

    EHWNodeNpcRole GetRole() const { return Role; }
    FName GetNpcId() const { return NpcId; }
    FName GetRoute() const { return RouteName; }
    HWNodeRules::ENpcState GetState() const { return Life.State; }
    bool IsTargetable() const { return Life.IsTargetable(); }
    bool IsCaptive() const { return Life.State == HWNodeRules::ENpcState::Missing; }
    bool HasOrder() const { return bOrdered; }
    EHWNodeFacilityKind GetOrderFacility() const { return OrderFacility; }
    FVector GetHome() const { return Home; }

private:
    void Refresh();

    UPROPERTY(Transient)
    TObjectPtr<AHWNodeDirector> Director;

    UPROPERTY()
    TObjectPtr<UTextRenderComponent> Tag;

    EHWNodeNpcRole Role = EHWNodeNpcRole::Technician;
    FName NpcId;
    FName RouteName;
    FVector Home = FVector::ZeroVector;
    HWNodeRules::FNpcLife Life;
    TArray<FVector> OrderPath;
    int32 OrderIndex = 0;
    EHWNodeFacilityKind OrderFacility = EHWNodeFacilityKind::Gate;
    bool bOrdered = false;
    bool bEvacuated = false;
};
