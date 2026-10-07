#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Node/HWNodeRules.h"
#include "HWNodeNpc.generated.h"

class UTextRenderComponent;

// A node NPC that is part of the node, not a shop (docs/design/200 §7). The technician's state sets how fast the
// node is repaired: Normal -> Injured (hurt by stalkers) -> Missing (hurt again) ; Rescued -> back to Normal later.
// Dummy body: the "enemy" mannequin in a different scale until the real cast exists.
UCLASS()
class HWANGHONCOMBATUE_API AHWNodeNpc : public ACharacter
{
    GENERATED_BODY()

public:
    AHWNodeNpc();

    virtual void BeginPlay() override;

    void ApplyEnemyDamage(float Amount);

    // Player interaction near a missing technician brings them back (Rescued).
    bool Rescue();

    HWNodeRules::ENpcState GetState() const { return State; }
    bool IsTargetable() const { return State == HWNodeRules::ENpcState::Normal || State == HWNodeRules::ENpcState::Injured; }
    float RepairScale() const { return HWNodeRules::TechnicianRepairScale(State); }

private:
    void Refresh();

    UPROPERTY()
    TObjectPtr<UTextRenderComponent> Tag;

    HWNodeRules::ENpcState State = HWNodeRules::ENpcState::Normal;
    float Health = 3000.f;
    float MaxHealth = 3000.f;
};
