#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "System/HWCombatTargetInterface.h"
#include "Node/HWNodeConfig.h"
#include "Node/HWNodeRules.h"
#include "HWNodeEnemy.generated.h"

class AHWNodeDirector;
class AHWNodeFacility;
class UTextRenderComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWNodeEnemyDiedSignature, class AHWNodeEnemy*, Enemy);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHWNodeEnemyCounteredSignature, class AHWNodeEnemy*, Enemy, bool, bPerfect);

// A node invader with a role (docs/design/200 §5): who it goes for comes from HWNodeRules::ChooseTarget, so the
// roles feel different in play - the breaker walks past you to the generator, the runner goes round the wall.
// Dummy body: the configured "enemy" mannequin, scaled per role. Its blows are telegraphed and can be countered;
// the armoured elite takes a quarter damage until a counter cracks its armour, and cycles three blows (v05: shield
// bash, heavy charge - the perfect counter pays - and an overhead crush that cannot be countered). All six roles are
// threat grade 5 (GuildWorld v04); the label over the head reads "T5 / ROLE / TARGET" (v06, not in Shipping).
// The resonator's aura is the director's (SetResonance): the enemy never decides its own buff.
UCLASS()
class HWANGHONCOMBATUE_API AHWNodeEnemy
    : public ACharacter
    , public IHWCombatTargetInterface
{
    GENERATED_BODY()

public:
    AHWNodeEnemy();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    // Route: the waypoints from the spawn to the plaza (main or a flank). Difficulty scales health and damage.
    void Configure(AHWNodeDirector* InDirector, EHWNodeEnemyRole InRole, const TArray<FVector>& InRoute, float Difficulty);

    UPROPERTY(BlueprintAssignable)
    FHWNodeEnemyDiedSignature OnEnemyDied;

    UPROPERTY(BlueprintAssignable)
    FHWNodeEnemyCounteredSignature OnEnemyCountered;

    UFUNCTION(BlueprintPure)
    EHWNodeEnemyRole GetRole() const { return Role; }

    UFUNCTION(BlueprintPure)
    bool IsDeadEnemy() const { return bDead; }

    UFUNCTION(BlueprintPure)
    int32 GetThreatGrade() const { return HWNodeRules::NodeThreatGrade; }

    // The resonator's aura from the director (HWNodeRules::ResonanceStacks: 0 or 1): move and attack multipliers.
    void SetResonance(int32 Stacks);
    int32 GetResonance() const { return Resonance; }
    float GetMoveSpeedNow() const;
    float GetAttackScaleNow() const { return HWNodeRules::ResonanceAttack(Resonance); }
    void SetLabelVisible(bool bVisible);
    float GetHealthFraction() const { return MaxHealth > 0.f ? Health / MaxHealth : 0.f; }
    HWNodeRules::ETargetKind GetTargetKind() const { return TargetKind; }

    // Killed by the player (false = discarded: fell off, or the run was reset).
    UFUNCTION(BlueprintPure)
    bool WasKilled() const { return bKilled; }
    bool WasKilledByPlayer() const { return bKilled && bLastHitByPlayer; }

    virtual bool ReceiveSystemHit_Implementation(float Damage, EHWAttackTier Tier, FVector SourceLocation, AActor* InstigatorActor) override;
    virtual bool IsSystemTargetDead_Implementation() const override { return bDead; }

    // Fell off the graybox or the run was reset: gone without a kill.
    void Discard();

private:
    enum class EPhase : uint8 { Move, Windup, Recover, Stagger };

    void Think();
    void StepMove(float DeltaSeconds);
    void Strike();
    void Die(bool bByPlayer);
    FVector GoalPoint() const;
    bool IsDirectApproach(const FVector& Here) const;   // the gate or a player close enough to walk straight at
    bool HasWaypoint(const FVector& Here) const;
    float ReachTo(HWNodeRules::ETargetKind Kind) const;
    void RefreshLabel();
    HWNodeRules::EEnemyRole RuleRole() const { return static_cast<HWNodeRules::EEnemyRole>(Role); }
    bool IsArmored() const { return Role == EHWNodeEnemyRole::ArmoredElite; }
    float WindupNow();   // starts a blow: the armoured picks its next attack

    UPROPERTY(Transient)
    TObjectPtr<AHWNodeDirector> Director;

    // A barricade in the way, or a turret shooting it: hit that first (overrides TargetKind).
    TWeakObjectPtr<AHWNodeFacility> Override;

    UPROPERTY()
    TObjectPtr<UTextRenderComponent> Tag;

    EHWNodeEnemyRole Role = EHWNodeEnemyRole::Normal;
    HWNodeRules::FRoleStats Stats = HWNodeRules::RoleStats(HWNodeRules::EEnemyRole::Normal);
    HWNodeRules::FEliteArmor Armor;
    HWNodeRules::ETargetKind TargetKind = HWNodeRules::ETargetKind::None;
    TArray<FVector> Route;      // spawn -> plaza
    TArray<FVector> Extension;  // the route graph's shortest path to the target's route end (UHWNodeConfig::PathBetween)
    int32 RouteIndex = 0;
    int32 ExtensionIndex = 0;
    EPhase Phase = EPhase::Move;
    float PhaseLeft = 0.f;
    float ThinkLeft = 0.f;
    float Cooldown = 0.f;
    float Health = 1.f;
    float MaxHealth = 1.f;
    float DamageScale = 1.f;
    bool bFlanked = false;
    bool bDead = false;
    bool bKilled = false;
    bool bLastHitByPlayer = false;   // turret and guard kills are not the player's contribution
    int32 Resonance = 0;             // stacks from the director (cap 1)
    int32 Blow = 0;                  // the armoured's attack cycle (HWNodeRules::ArmoredAttackAt)
    HWNodeRules::EArmoredAttack Attack = HWNodeRules::EArmoredAttack::ShieldBash;   // the blow being wound up
};
