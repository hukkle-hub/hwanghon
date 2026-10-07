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
// the armoured elite takes a quarter damage until a counter cracks its armour.
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
    float ReachTo(HWNodeRules::ETargetKind Kind) const;

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
    TArray<FVector> Extension;  // plaza -> generator / comms, chosen by the target
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
};
