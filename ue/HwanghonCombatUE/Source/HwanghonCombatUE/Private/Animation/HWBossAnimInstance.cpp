#include "Animation/HWBossAnimInstance.h"

#include "Boss/HWBossCharacter.h"

void UHWBossAnimInstance::NativeInitializeAnimation()
{
    Super::NativeInitializeAnimation();
    BossOwner = Cast<AHWBossCharacter>(TryGetPawnOwner());
}

void UHWBossAnimInstance::NativeUpdateAnimation(float DeltaSeconds)
{
    Super::NativeUpdateAnimation(DeltaSeconds);

    if (!BossOwner)
    {
        BossOwner = Cast<AHWBossCharacter>(TryGetPawnOwner());
    }

    if (!BossOwner)
    {
        return;
    }

    BossState = BossOwner->GetBossState();
    PatternId = BossOwner->GetCurrentPatternId();
    StatePhase = BossOwner->GetBossStateNormalized();
    bTell = BossState == EHWBossState::Tell;
    bStrike = BossState == EHWBossState::Strike;
    bRecover = BossState == EHWBossState::Recover;

    const FHWBossPatternSpec& Pattern = BossOwner->GetCurrentPattern();
    bBigPattern = Pattern.bBig;

    const FVector Velocity = BossOwner->GetVelocity();
    GroundSpeed = FVector(Velocity.X, Velocity.Y, 0.f).Size();
}
