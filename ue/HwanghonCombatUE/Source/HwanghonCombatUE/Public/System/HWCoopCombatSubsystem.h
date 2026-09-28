#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "HWCoopCombatSubsystem.generated.h"

class AHWAinCharacter;

USTRUCT(BlueprintType)
struct FHWCoopCombatantView
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    TObjectPtr<AHWAinCharacter> Character = nullptr;

    UPROPERTY(BlueprintReadOnly)
    FName CharacterId = NAME_None;

    UPROPERTY(BlueprintReadOnly)
    float Threat = 0.f;

    UPROPERTY(BlueprintReadOnly)
    bool bAlive = false;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWPartySizeChangedSignature, int32, PartySize);

UCLASS()
class HWANGHONCOMBATUE_API UHWCoopCombatSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintAssignable)
    FHWPartySizeChangedSignature OnPartySizeChanged;

    UFUNCTION(BlueprintCallable)
    void RegisterCombatant(AHWAinCharacter* Character, FName CharacterId);

    UFUNCTION(BlueprintCallable)
    void UnregisterCombatant(AHWAinCharacter* Character);

    UFUNCTION(BlueprintCallable)
    void AddThreat(AHWAinCharacter* Character, float Amount);

    UFUNCTION(BlueprintCallable)
    void AddThreatFromDamage(AHWAinCharacter* Character, float Damage, float Multiplier = 1.f);

    UFUNCTION(BlueprintCallable)
    void ResetThreat();

    UFUNCTION(BlueprintPure)
    int32 GetPartySize() const;

    UFUNCTION(BlueprintPure)
    int32 GetAliveCount() const;

    UFUNCTION(BlueprintPure)
    TArray<FHWCoopCombatantView> GetCombatants() const;

    UFUNCTION(BlueprintPure)
    AHWAinCharacter* SelectHighestThreatTarget() const;

    UFUNCTION(BlueprintPure)
    AHWAinCharacter* SelectClosestLivingTarget(FVector From) const;

    UFUNCTION(BlueprintPure)
    float BossHealthScale() const;

    UFUNCTION(BlueprintPure)
    float BossPostureScale() const;

    UFUNCTION(BlueprintPure)
    float EnemyCountScale() const;

private:
    struct FRuntime
    {
        TWeakObjectPtr<AHWAinCharacter> Character;
        FName CharacterId = NAME_None;
        float Threat = 0.f;
    };

    void Compact();

    TArray<FRuntime> Combatants;
};
