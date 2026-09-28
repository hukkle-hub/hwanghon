#include "System/HWBossPartTarget.h"

#include "Boss/HWBossCharacter.h"
#include "System/HWBossSystemComponent.h"
#include "Components/SphereComponent.h"

AHWBossPartTarget::AHWBossPartTarget()
{
    PrimaryActorTick.bCanEverTick = false;
    bReplicates = true;

    HitSphere = CreateDefaultSubobject<USphereComponent>(TEXT("HitSphere"));
    RootComponent = HitSphere;
    HitSphere->InitSphereRadius(42.f);
    HitSphere->SetCollisionProfileName(TEXT("OverlapAllDynamic"));

    Tags.Add(TEXT("LockOnTarget"));
}

void AHWBossPartTarget::ConfigurePart(
    AHWBossCharacter* InBoss,
    FName InPartId,
    FVector RelativeOffset,
    float InDamageToBossScale)
{
    Boss = InBoss;
    PartId = InPartId;
    DamageToBossScale = FMath::Clamp(InDamageToBossScale, 0.f, 1.f);

    if (Boss)
    {
        AttachToActor(
            Boss,
            FAttachmentTransformRules::KeepRelativeTransform);
        SetActorRelativeLocation(RelativeOffset);
    }
}

bool AHWBossPartTarget::ReceiveSystemHit_Implementation(
    float Damage,
    EHWAttackTier Tier,
    FVector SourceLocation,
    AActor* InstigatorActor)
{
    return ReceiveWeightedSystemHit(
        Damage, Tier, SourceLocation, InstigatorActor, 1.f);
}

bool AHWBossPartTarget::ReceiveWeightedSystemHit(
    float Damage,
    EHWAttackTier Tier,
    FVector SourceLocation,
    AActor* InstigatorActor,
    float PartDamageMultiplier)
{
    if (bBroken || !Boss || Boss->IsDead() || Damage <= 0.f) return false;

    if (UHWBossSystemComponent* System = Boss->GetBossSystem())
    {
        const bool bJustBroken = System->DamagePart(
            PartId,
            Damage * FMath::Max(0.f, PartDamageMultiplier));
        if (bJustBroken)
        {
            bBroken = true;
            Tags.Remove(TEXT("LockOnTarget"));
            SetActorEnableCollision(false);
        }
    }

    Boss->ReceivePlayerHit(Damage * DamageToBossScale, Tier, SourceLocation);
    return true;
}

bool AHWBossPartTarget::IsSystemTargetDead_Implementation() const
{
    return bBroken || !Boss || Boss->IsDead();
}


void AHWBossPartTarget::SetAuthoritativeBroken(bool bInBroken)
{
    bBroken=bInBroken;
    if(bBroken)
    {
        Tags.Remove(TEXT("LockOnTarget"));
        SetActorEnableCollision(false);
        SetActorHiddenInGame(true);
    }
    else
    {
        if(!Tags.Contains(TEXT("LockOnTarget")))Tags.Add(TEXT("LockOnTarget"));
        SetActorEnableCollision(true);
        SetActorHiddenInGame(false);
    }
}
