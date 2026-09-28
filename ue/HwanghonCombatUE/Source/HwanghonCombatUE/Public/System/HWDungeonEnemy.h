#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "System/HWCombatTargetInterface.h"
#include "HWDungeonEnemy.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWDungeonEnemyDiedSignature, class AHWDungeonEnemy*, Enemy);

UCLASS()
class HWANGHONCOMBATUE_API AHWDungeonEnemy
    : public ACharacter
    , public IHWCombatTargetInterface
{
    GENERATED_BODY()

public:
    AHWDungeonEnemy();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    UPROPERTY(BlueprintAssignable)
    FHWDungeonEnemyDiedSignature OnEnemyDied;

    UFUNCTION(BlueprintCallable)
    void ConfigureEnemy(bool bInElite, float HealthScale, float DamageScale);

    UFUNCTION(BlueprintPure)
    float GetHealth() const { return Health; }

    UFUNCTION(BlueprintPure)
    bool IsElite() const { return bElite; }

    virtual bool ReceiveSystemHit_Implementation(
        float Damage,
        EHWAttackTier Tier,
        FVector SourceLocation,
        AActor* InstigatorActor) override;

    virtual bool IsSystemTargetDead_Implementation() const override
    {
        return bDead;
    }

private:
    void Die();
    void UpdateTarget();
    void TryAttack(float DeltaSeconds);

    UPROPERTY(Transient)
    TWeakObjectPtr<class AHWAinCharacter> Target;

    float MaxHealth = 5500.f;
    float Health = 5500.f;
    float Damage = 850.f;
    float AttackCooldown = 1.35f;
    float AttackCooldownRemaining = 0.f;
    float AttackRangeCm = 165.f;
    bool bElite = false;
    bool bDead = false;
};
