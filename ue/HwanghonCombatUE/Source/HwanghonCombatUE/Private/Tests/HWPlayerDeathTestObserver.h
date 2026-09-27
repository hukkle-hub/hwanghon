#pragma once

#include "CoreMinimal.h"
#include "Combat/HWCombatComponent.h"
#include "HWPlayerDeathTestObserver.generated.h"

// Reflected receivers exercise the actual production multicast delegates.
UCLASS(Transient)
class UHWPlayerDeathTestObserver : public UObject
{
    GENERATED_BODY()

public:
    UPROPERTY()
    TObjectPtr<UHWCombatComponent> Combat;

    int32 DeathCount = 0;
    int32 DamageCount = 0;
    int32 StartedCount = 0;
    int32 EndedCount = 0;
    int32 ContactCount = 0;
    bool bDeadWhenNotified = false;
    bool bLethalDamageWasTerminal = false;
    bool bDeathCallbacksRejectActions = false;
    bool bKillOnDamage = false;
    bool bKillOnStart = false;
    bool bKillOnEnd = false;
    bool bKillOnContact = false;

    void KillIfLiving()
    {
        if (Combat && !Combat->IsDead())
        {
            Combat->ApplyIncomingDamage(Combat->GetHealth(), EHWAttackTier::Light);
        }
    }

    UFUNCTION()
    void HandleDeath()
    {
        ++DeathCount;
        bDeadWhenNotified = Combat && Combat->IsDead() && Combat->GetHealth() == 0.f
            && Combat->GetCurrentAction() == EHWActionType::None;
        if (Combat)
        {
            // Reentrant notifications cannot resurrect the action queue or repeat death.
            const bool bAttack = Combat->RequestAttack();
            const bool bSmash = Combat->RequestSmash();
            const bool bDodge = Combat->RequestDodge();
            const bool bJump = Combat->RequestJump();
            const bool bCounter = Combat->RequestCounter();
            const bool bDamage = Combat->ApplyIncomingDamage(1.f, EHWAttackTier::Break);
            bDeathCallbacksRejectActions = !bAttack && !bSmash && !bDodge && !bJump && !bCounter && !bDamage;
        }
    }

    UFUNCTION()
    void HandleDamage(float Damage, EHWAttackTier Tier)
    {
        ++DamageCount;
        if (Combat && Combat->GetHealth() == 0.f)
        {
            bLethalDamageWasTerminal = Combat->IsDead()
                && Combat->GetCurrentAction() == EHWActionType::None
                && !Combat->RequestAttack()
                && !Combat->ApplyIncomingDamage(1.f, EHWAttackTier::Stagger);
            Combat->ApplyHitStop(10.f);
            Combat->TickComponent(10.f, LEVELTICK_All, nullptr);
        }
        if (bKillOnDamage)
        {
            KillIfLiving();
        }
    }

    UFUNCTION()
    void HandleStarted(EHWActionType Action)
    {
        ++StartedCount;
        if (bKillOnStart)
        {
            KillIfLiving();
        }
    }

    UFUNCTION()
    void HandleEnded(EHWActionType Action)
    {
        ++EndedCount;
        if (bKillOnEnd)
        {
            KillIfLiving();
        }
    }

    UFUNCTION()
    void HandleContact(EHWActionType Action, EHWAttackTier Tier, float Damage)
    {
        ++ContactCount;
        if (bKillOnContact)
        {
            KillIfLiving();
        }
    }
};
