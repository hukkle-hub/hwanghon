#include "Animation/HWAnimationSetAsset.h"

const FHWSequenceBinding* UHWAnimationSetAsset::GetPlayerBinding(EHWActionType Action) const
{
    switch (Action)
    {
        case EHWActionType::Attack1: return &Attack1;
        case EHWActionType::Attack2: return &Attack2;
        case EHWActionType::Attack3: return &Attack3;
        case EHWActionType::Smash: return &Smash;
        case EHWActionType::Dodge: return &Dodge;
        case EHWActionType::Jump: return &Jump;
        case EHWActionType::Counter: return &Counter;
        case EHWActionType::Hit: return &Hit;
        case EHWActionType::Stagger: return &Stagger;
        default: return nullptr;
    }
}

const FHWBossPatternAnimationBinding* UHWAnimationSetAsset::GetBossPatternBinding(FName PatternId) const
{
    return BossPatterns.Find(PatternId);
}

const FHWSequenceBinding* UHWAnimationSetAsset::GetBossReactionBinding(EHWAttackTier Tier) const
{
    switch (Tier)
    {
        case EHWAttackTier::Light: return &BossLightReaction;
        case EHWAttackTier::Finisher: return &BossFinisherReaction;
        case EHWAttackTier::Smash: return &BossSmashReaction;
        case EHWAttackTier::Counter: return &BossCounterReaction;
        case EHWAttackTier::Stagger: return &BossStaggerReaction;
        case EHWAttackTier::Break: return &BossBreakReaction;
        default: return &BossLightReaction;
    }
}
