#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HWHeroMetaHumanComponent.generated.h"

/**
 * Puts a hero's MetaHuman on its combat body (docs/design/184; heroes built in the MetaHuman lab, docs/design/176-182).
 * Content/Data/hero_metahumans.json, per character id:
 *   blueprint      the built BP_MH_<name> (body, face, its own grooms)
 *   outfit         one skeletal mesh on the MetaHuman skeleton, materials on the asset (tools/metahuman/export_heroes_to_game.py)
 *   groom / groom_material   the design-shaped strand hair, authored in the character's space, carried by the head bone
 *   hide_grooms    the MetaHuman's own groom components to switch off (its preset hair)
 *   retargeter     Countess -> MetaHuman IK Retargeter (Scripts/ue_metahuman_retarget.py)
 * The combat body (owner's mesh: clips, montages, sockets, weapon) keeps animating unseen; the MetaHuman body copies
 * its pose every frame (UHWRetargetAnimInstance). -HWNoMetaHuman keeps the old body for comparison.
 */
UCLASS(ClassGroup=(Hwanghon), meta=(BlueprintSpawnableComponent))
class HWANGHONCOMBATUE_API UHWHeroMetaHumanComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UHWHeroMetaHumanComponent();

    // Wear (or re-wear) the MetaHuman of this character id; false when it has none.
    bool Wear(FName CharacterId);

    AActor* GetMetaHumanActor() const { return Worn.Get(); }

    virtual void EndPlay(const EEndPlayReason::Type Reason) override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

private:
    void TakeOff();
    void LogRenderCost() const;

    TWeakObjectPtr<AActor> Worn;
    FName WornId = NAME_None;
    int32 RegripIn = -1;   // frames until the weapons move onto the MetaHuman's hands
    int32 DiagIn = -1;     // frames until the one-off render cost log
};
