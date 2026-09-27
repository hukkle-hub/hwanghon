#pragma once

#include "CoreMinimal.h"
#include "Boss/HWBossCharacter.h"
#include "HWBossLifecycleTestObserver.generated.h"

// A reflected receiver is required to exercise the production dynamic delegates.
// Only automation tests construct this transient object.
UCLASS(Transient)
class UHWBossLifecycleTestObserver : public UObject
{
    GENERATED_BODY()

public:
    UPROPERTY()
    TObjectPtr<AHWBossCharacter> Boss;

    int32 DeathCount = 0;
    int32 DeadStateCount = 0;
    int32 ReactionCount = 0;
    int32 PlayerDamageCount = 0;
    bool bDeadWhenNotified = false;
    bool bKillOnReaction = false;
    bool bKillOnPlayerDamage = false;

    UFUNCTION()
    void HandleDeath(AHWBossCharacter* DeadBoss)
    {
        ++DeathCount;
        bDeadWhenNotified = DeadBoss && DeadBoss->IsDead() && DeadBoss->GetHealth() == 0.f;
        // A reward listener can reenter combat. This must not emit another death.
        if (DeadBoss)
        {
            DeadBoss->ReceivePlayerHit(1.f, EHWAttackTier::Break, FVector::ZeroVector);
        }
    }

    UFUNCTION()
    void HandleState(EHWBossState NewState, FName PatternId)
    {
        if (NewState == EHWBossState::Dead)
        {
            ++DeadStateCount;
        }
    }

    UFUNCTION()
    void HandleReaction(EHWAttackTier Tier, FVector WorldDirection)
    {
        ++ReactionCount;
        if (bKillOnReaction && Boss)
        {
            Boss->ReceivePlayerHit(Boss->GetHealth(), EHWAttackTier::Light, FVector::ZeroVector);
        }
    }

    UFUNCTION()
    void HandlePlayerDamaged(float Damage, EHWAttackTier Tier)
    {
        ++PlayerDamageCount;
        if (bKillOnPlayerDamage && Boss)
        {
            Boss->ReceivePlayerHit(Boss->GetHealth(), EHWAttackTier::Light, FVector::ZeroVector);
        }
    }
};
