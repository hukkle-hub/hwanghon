#include "System/HWCoopCombatSubsystem.h"

#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"

void UHWCoopCombatSubsystem::Compact()
{
    Combatants.RemoveAll([](const FRuntime& R){ return !R.Character.IsValid(); });
}

void UHWCoopCombatSubsystem::RegisterCombatant(
    AHWAinCharacter* Character,
    FName CharacterId)
{
    if (!IsValid(Character)) return;

    Compact();
    for (FRuntime& R : Combatants)
    {
        if (R.Character.Get() == Character)
        {
            R.CharacterId = CharacterId;
            return;
        }
    }

    if (Combatants.Num() >= 4) return;

    FRuntime R;
    R.Character = Character;
    R.CharacterId = CharacterId;
    Combatants.Add(R);
    OnPartySizeChanged.Broadcast(GetPartySize());
}

void UHWCoopCombatSubsystem::UnregisterCombatant(AHWAinCharacter* Character)
{
    const int32 Removed = Combatants.RemoveAll(
        [Character](const FRuntime& R){ return R.Character.Get() == Character; });

    if (Removed > 0)
    {
        OnPartySizeChanged.Broadcast(GetPartySize());
    }
}

void UHWCoopCombatSubsystem::AddThreat(AHWAinCharacter* Character, float Amount)
{
    if (!IsValid(Character) || Amount <= 0.f) return;

    for (FRuntime& R : Combatants)
    {
        if (R.Character.Get() == Character)
        {
            R.Threat += Amount;
            return;
        }
    }
}

void UHWCoopCombatSubsystem::AddThreatFromDamage(
    AHWAinCharacter* Character,
    float Damage,
    float Multiplier)
{
    AddThreat(Character, FMath::Max(0.f, Damage) * FMath::Max(0.f, Multiplier));
}

void UHWCoopCombatSubsystem::ResetThreat()
{
    for (FRuntime& R : Combatants)
    {
        R.Threat = 0.f;
    }
}

int32 UHWCoopCombatSubsystem::GetPartySize() const
{
    int32 Count = 0;
    for (const FRuntime& R : Combatants)
    {
        if (R.Character.IsValid()) ++Count;
    }
    return FMath::Clamp(Count, 1, 4);
}

int32 UHWCoopCombatSubsystem::GetAliveCount() const
{
    int32 Count = 0;
    for (const FRuntime& R : Combatants)
    {
        if (AHWAinCharacter* Character = R.Character.Get())
        {
            if (Character->GetCombat() && !Character->GetCombat()->IsDead()) ++Count;
        }
    }
    return Count;
}

TArray<FHWCoopCombatantView> UHWCoopCombatSubsystem::GetCombatants() const
{
    TArray<FHWCoopCombatantView> Out;

    for (const FRuntime& R : Combatants)
    {
        AHWAinCharacter* Character = R.Character.Get();
        if (!Character) continue;

        FHWCoopCombatantView View;
        View.Character = Character;
        View.CharacterId = R.CharacterId;
        View.Threat = R.Threat;
        View.bAlive = Character->GetCombat() && !Character->GetCombat()->IsDead();
        Out.Add(View);
    }
    return Out;
}

AHWAinCharacter* UHWCoopCombatSubsystem::SelectHighestThreatTarget() const
{
    AHWAinCharacter* Best = nullptr;
    float BestThreat = -1.f;

    for (const FRuntime& R : Combatants)
    {
        AHWAinCharacter* Character = R.Character.Get();
        if (!Character || !Character->GetCombat() || Character->GetCombat()->IsDead()) continue;

        if (!Best || R.Threat > BestThreat)
        {
            Best = Character;
            BestThreat = R.Threat;
        }
    }
    return Best;
}

AHWAinCharacter* UHWCoopCombatSubsystem::SelectClosestLivingTarget(FVector From) const
{
    AHWAinCharacter* Best = nullptr;
    float BestDistanceSq = TNumericLimits<float>::Max();

    for (const FRuntime& R : Combatants)
    {
        AHWAinCharacter* Character = R.Character.Get();
        if (!Character || !Character->GetCombat() || Character->GetCombat()->IsDead()) continue;

        const float DistanceSq = FVector::DistSquared2D(From, Character->GetActorLocation());
        if (DistanceSq < BestDistanceSq)
        {
            Best = Character;
            BestDistanceSq = DistanceSq;
        }
    }
    return Best;
}

float UHWCoopCombatSubsystem::BossHealthScale() const
{
    switch (GetPartySize())
    {
        case 2: return 1.65f;
        case 3: return 2.30f;
        case 4: return 2.95f;
        default: return 1.f;
    }
}

float UHWCoopCombatSubsystem::BossPostureScale() const
{
    // Authoritative Raid keeps its posture/down threshold at 100.
    return 1.f;
}

float UHWCoopCombatSubsystem::EnemyCountScale() const
{
    switch (GetPartySize())
    {
        case 2: return 1.35f;
        case 3: return 1.65f;
        case 4: return 1.90f;
        default: return 1.f;
    }
}
