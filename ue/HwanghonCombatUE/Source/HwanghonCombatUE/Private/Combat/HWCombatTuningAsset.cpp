#include "Combat/HWCombatTuningAsset.h"
#include <initializer_list>

namespace
{
    FHWBossBeatSpec Beat(float At, float Damage, float RangeCm, bool bCounterable = false)
    {
        FHWBossBeatSpec B;
        B.At = At;
        B.Damage = Damage;
        B.RangeCm = RangeCm;
        B.bCounterable = bCounterable;
        return B;
    }

    FHWBossPatternSpec Pattern(
        FName Id,
        float Tell,
        float Strike,
        float Recovery,
        std::initializer_list<FHWBossBeatSpec> Beats,
        bool bCounterable = true,
        bool bUnblockable = false,
        bool bJumpOnly = false,
        bool bBig = false,
        float LungeDistanceCm = 0.f,
        float LungeDuration = 0.f)
    {
        FHWBossPatternSpec P;
        P.Id = Id;
        P.TellDuration = Tell;
        P.StrikeDuration = Strike;
        P.RecoveryDuration = Recovery;
        for (const FHWBossBeatSpec& BeatSpec : Beats)
        {
            P.Beats.Add(BeatSpec);
        }
        P.bCounterable = bCounterable;
        P.bUnblockable = bUnblockable;
        P.bJumpOnly = bJumpOnly;
        P.bBig = bBig;
        P.LungeDistanceCm = LungeDistanceCm;
        P.LungeDuration = LungeDuration;
        return P;
    }
}

UHWCombatTuningAsset::UHWCombatTuningAsset()
{
    // Existing Hwanghon rules: keep combat feel comparable to the Three.js reference.
    Attack1 = {0.66f, 0.24f, 0.48f, 0.f, 1150.f, EHWAttackTier::Light, "Attack1", 0.39f};
    Attack2 = {0.66f, 0.24f, 0.48f, 0.f, 1250.f, EHWAttackTier::Light, "Attack2", 0.39f};
    Attack3 = {0.66f, 0.24f, 0.48f, 0.f, 1600.f, EHWAttackTier::Finisher, "Attack3", 0.39f};

    // Ain-specific heavy timing already established in the existing design.
    // defCancelAt = hit 0.48 + active 0.14 + defCancel 0.06 = 0.68.
    Smash = {1.15f, 0.48f, 0.91f, 20.f, 2600.f, EHWAttackTier::Smash, "Smash", 0.68f};

    Dodge = {0.45f, -1.f, 0.f, 25.f, 0.f, EHWAttackTier::Light, "Dodge", 0.f};
    Jump = {0.45f, -1.f, 0.f, 15.f, 0.f, EHWAttackTier::Light, "Jump", 0.f};
    Counter = {1.53f, 0.5049f, 1.15f, 0.f, 0.f, EHWAttackTier::Counter, "Counter", 0.f};

    // Vertical Slice boss: values derive from the current d01 training-boss vocabulary.
    BossPatterns =
    {
        Pattern("HookCombo", 0.75f, 1.35f, 0.90f,
            {
                Beat(0.08f, 5200.f, 210.f, false),
                Beat(0.40f, 5400.f, 210.f, false),
                Beat(1.15f, 8000.f, 250.f, true)
            },
            true, false, false, false),

        Pattern("Charge", 1.00f, 0.32f, 0.90f,
            { Beat(0.10f, 7000.f, 240.f, false) },
            false, true, false, false, 920.f, 0.30f),   // three.js 규칙 460 px ÷ 50 = 9.2 m (문서 121 §5 — px 를 cm 로 옮겨 절반이던 값)

        Pattern("Slam", 1.25f, 0.22f, 1.00f,
            { Beat(0.12f, 8000.f, 290.f, true) },
            true, false, false, true),

        Pattern("Spin", 1.45f, 0.55f, 0.85f,
            {
                Beat(0.12f, 2000.f, 280.f, false),   // three.js 규칙 합계 6500 (1 타). 다단은 두고 합계만 맞춘다 (문서 121 §5)
                Beat(0.29f, 2000.f, 280.f, false),
                Beat(0.46f, 2500.f, 280.f, false)
            },
            false, true, false, true),

        Pattern("GroundWave", 1.15f, 0.20f, 1.00f,
            { Beat(0.10f, 6500.f, 320.f, false) },
            false, true, true, true)
    };
}

const FHWActionSpec& UHWCombatTuningAsset::GetActionSpec(EHWActionType Action) const
{
    switch (Action)
    {
        case EHWActionType::Attack1: return Attack1;
        case EHWActionType::Attack2: return Attack2;
        case EHWActionType::Attack3: return Attack3;
        case EHWActionType::Smash: return Smash;
        case EHWActionType::Dodge: return Dodge;
        case EHWActionType::Jump: return Jump;
        case EHWActionType::Counter: return Counter;
        default: return Attack1;
    }
}
