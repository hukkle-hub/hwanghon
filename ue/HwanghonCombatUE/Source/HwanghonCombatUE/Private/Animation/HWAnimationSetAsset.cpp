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

const FHWSequenceBinding* UHWAnimationSetAsset::GetAbilityBinding(EHWAbilitySlot Slot) const
{
    switch (Slot)
    {
        case EHWAbilitySlot::Skill1: return &Skill1;
        case EHWAbilitySlot::Skill2: return &Skill2;
        case EHWAbilitySlot::Skill3: return &Skill3;
        case EHWAbilitySlot::Skill4: return &Skill4;
        case EHWAbilitySlot::Ultimate: return &Ultimate;
        default: return nullptr;
    }
}

const FHWSequenceBinding* UHWAnimationSetAsset::GetServerClipBinding(FName Clip, int32 ComboIndex) const
{
    const FString C = Clip.ToString().ToLower();
    if (C.IsEmpty() || Clip.IsNone()) return nullptr;
    if (C == TEXT("skill1")) return &Skill1;
    if (C == TEXT("skill2")) return &Skill2;
    if (C == TEXT("skill3")) return &Skill3;
    if (C == TEXT("skill4")) return &Skill4;
    if (C.StartsWith(TEXT("ult"))) return &Ultimate;
    if (C.StartsWith(TEXT("smash")) || C.StartsWith(TEXT("exec"))) return &Smash;
    if (C.StartsWith(TEXT("counter"))) return &Counter;
    if (C.StartsWith(TEXT("dodge")) || C.StartsWith(TEXT("roll"))) return &Dodge;
    if (C.StartsWith(TEXT("jump"))) return &Jump;
    if (C.StartsWith(TEXT("attack")))
    {
        const int32 Step = C.EndsWith(TEXT("3")) ? 3 : C.EndsWith(TEXT("2")) ? 2 : C.EndsWith(TEXT("1")) ? 1 : (ComboIndex % 3) + 1;
        return Step == 3 ? &Attack3 : Step == 2 ? &Attack2 : &Attack1;
    }
    return nullptr;
}
