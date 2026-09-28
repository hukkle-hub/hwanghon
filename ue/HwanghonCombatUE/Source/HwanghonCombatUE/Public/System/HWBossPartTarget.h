#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "System/HWCombatTargetInterface.h"
#include "HWBossPartTarget.generated.h"

class USphereComponent;

UCLASS()
class HWANGHONCOMBATUE_API AHWBossPartTarget
    : public AActor
    , public IHWCombatTargetInterface
{
    GENERATED_BODY()

public:
    AHWBossPartTarget();

    UFUNCTION(BlueprintCallable)
    void ConfigurePart(
        class AHWBossCharacter* InBoss,
        FName InPartId,
        FVector RelativeOffset,
        float InDamageToBossScale = 0.85f);

    UFUNCTION(BlueprintPure)
    FName GetPartId() const { return PartId; }

    UFUNCTION(BlueprintPure)
    class AHWBossCharacter* GetBoss() const { return Boss; }

    UFUNCTION(BlueprintCallable)
    void SetAuthoritativeBroken(bool bInBroken);

    virtual bool ReceiveSystemHit_Implementation(
        float Damage,
        EHWAttackTier Tier,
        FVector SourceLocation,
        AActor* InstigatorActor) override;

    virtual bool IsSystemTargetDead_Implementation() const override;

private:
    UPROPERTY(VisibleAnywhere)
    TObjectPtr<USphereComponent> HitSphere;

    UPROPERTY(Transient)
    TObjectPtr<class AHWBossCharacter> Boss;

    FName PartId = NAME_None;
    float DamageToBossScale = 0.85f;
    bool bBroken = false;
};
