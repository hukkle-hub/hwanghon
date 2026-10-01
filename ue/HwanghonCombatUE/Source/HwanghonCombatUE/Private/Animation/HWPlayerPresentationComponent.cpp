#include "Animation/HWPlayerPresentationComponent.h"

#include "Animation/AnimInstance.h"
#include "Animation/AnimMontage.h"
#include "Animation/AnimSequenceBase.h"
#include "Combat/HWCombatComponent.h"
#include "Combat/HWCombatTuningAsset.h"
#include "System/HWCharacterKitComponent.h"
#include "Animation/HWCharacterVisualSettings.h"
#include "Components/SkeletalMeshComponent.h"
#include "TimerManager.h"
#include "GameFramework/Character.h"

UHWPlayerPresentationComponent::UHWPlayerPresentationComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UHWPlayerPresentationComponent::BeginPlay()
{
    Super::BeginPlay();

    ACharacter* Character = Cast<ACharacter>(GetOwner());
    if (!Character || !Character->GetMesh())
    {
        return;
    }

    Combat = Character->FindComponentByClass<UHWCombatComponent>();
    AnimInstance = Character->GetMesh()->GetAnimInstance();

    if (Combat)
    {
        Combat->OnActionStarted.AddDynamic(this, &UHWPlayerPresentationComponent::HandleActionStarted);
        Combat->OnActionEnded.AddDynamic(this, &UHWPlayerPresentationComponent::HandleActionEnded);
    }
    if (UHWCharacterKitComponent* Kit = Character->FindComponentByClass<UHWCharacterKitComponent>())
    {
        Kit->OnAbilityActivated.AddDynamic(this, &UHWPlayerPresentationComponent::HandleAbilityActivated);
    }
}

void UHWPlayerPresentationComponent::HandleAbilityActivated(FName CharacterId, EHWAbilitySlot Slot, float Multiplier)
{
    // play the clip so its contact frame lands when the kit's hit lands (doc 169)
    const FHWSequenceBinding* Binding = AnimationSet ? AnimationSet->GetAbilityBinding(Slot) : nullptr;
    const float Contact = UHWCharacterKitComponent::FirstContactSeconds(CharacterId, Slot);
    float Rate = 1.f;
    if (Binding && Binding->Sequence && Contact > 0.05f)
    {
        const float Speed = Combat ? FMath::Max(0.01f, Combat->GetAttackSpeedMultiplier()) : 1.f;
        Rate = FMath::Clamp(Binding->SourceContactNormalized * Binding->Sequence->GetPlayLength() / Contact * Speed, 0.5f, 2.5f);
    }
    PlayOneShot(Binding, Rate);
}

bool UHWPlayerPresentationComponent::PlayAbility(EHWAbilitySlot Slot)
{
    return AnimationSet && PlayOneShot(AnimationSet->GetAbilityBinding(Slot));
}

bool UHWPlayerPresentationComponent::PlayServerClip(FName Clip)
{
    return AnimationSet && PlayOneShot(AnimationSet->GetServerClipBinding(Clip));
}

bool UHWPlayerPresentationComponent::PlayOneShot(const FHWSequenceBinding* Binding, float Rate)
{
    if (!AnimInstance || !Binding || !Binding->Sequence || (Combat && Combat->IsDead()))
    {
        return false;
    }
    // A kit ability is not a combat action: plain rate, on top of whatever the combat clock drives.
    if (ActiveMontage && ActiveAction == EHWActionType::None)
    {
        StopActive(Binding->BlendIn);
    }
    OneShotMontage = AnimInstance->PlaySlotAnimationAsDynamicMontage(
        Binding->Sequence, Binding->SlotName, Binding->BlendIn, Binding->BlendOut, Rate, 1, -1.f, 0.f);
    return OneShotMontage != nullptr;
}

void UHWPlayerPresentationComponent::Collapse()
{
    if (!Combat || !Combat->IsDead()) return;
    USkeletalMeshComponent* Mesh = GetOwner() ? GetOwner()->FindComponentByClass<USkeletalMeshComponent>() : nullptr;
    // Keep the buckled pose as the ragdoll's starting pose (no montage stop: a pose snap becomes velocity).
    bRagdoll = UHWCharacterVisualSettings::SetRagdoll(Mesh, true, SavedMeshRelative);
}

void UHWPlayerPresentationComponent::UpdateLifePose()
{
    const bool bDead = Combat && Combat->IsDead();
    if (bDead == bWasDead || !AnimInstance)
    {
        bWasDead = bDead;
        return;
    }
    bWasDead = bDead;
    USkeletalMeshComponent* Mesh = GetOwner() ? GetOwner()->FindComponentByClass<USkeletalMeshComponent>() : nullptr;
    if (bDead && Mesh && Mesh->GetPhysicsAsset() && GetWorld())
    {
        // Straight to ragdoll from the current pose (a buckle montage under the ragdoll launched bodies, doc 130 §2).
        AnimInstance->StopAllMontages(0.f);
        GetWorld()->GetTimerManager().SetTimer(CollapseTimer, this, &UHWPlayerPresentationComponent::Collapse, 0.05f, false);
        return;
    }
    if (!bDead && GetWorld())
    {
        GetWorld()->GetTimerManager().ClearTimer(CollapseTimer);
    }
    if (!bDead && bRagdoll)
    {
        bRagdoll = false;
        UHWCharacterVisualSettings::SetRagdoll(Mesh, false, SavedMeshRelative);
        if (AnimationSet && AnimationSet->GetUp.Sequence)
        {
            const FHWSequenceBinding& Up = AnimationSet->GetUp;
            AnimInstance->PlaySlotAnimationAsDynamicMontage(Up.Sequence, Up.SlotName, 0.f, Up.BlendOut, 1.f, 1, -1.f, AnimationSet->GetUpStartSeconds);
        }
    }
    if (bDead && !bRagdoll && AnimationSet)
    {
        // Online hp 0 / co-op bleed-out is "downed" (revivable); a solo death uses the death clip.
        const FHWSequenceBinding& Pose = AnimationSet->Downed.Sequence ? AnimationSet->Downed : AnimationSet->Death;
        if (Pose.Sequence)
        {
            StateMontage = AnimInstance->PlaySlotAnimationAsDynamicMontage(
                Pose.Sequence, Pose.SlotName, Pose.BlendIn, Pose.BlendOut, 1.f, Pose.bLoop ? 999 : 1, -1.f, 0.f);
            if (StateMontage && !Pose.bLoop)
            {
                // Hold the last frame: the body stays on the ground until revived.
                StateMontage->bEnableAutoBlendOut = false;
            }
        }
    }
    else if (!bDead && StateMontage)
    {
        AnimInstance->Montage_Stop(0.25f, StateMontage);
        StateMontage = nullptr;
    }
}

void UHWPlayerPresentationComponent::TickComponent(
    float DeltaTime,
    ELevelTick TickType,
    FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    UpdateLifePose();

    if (Combat && Combat->IsDead())
    {
        ActiveAction = EHWActionType::None;
        bPendingStop = false;
        StopActive(0.f);
        return;
    }

    if (bPendingStop)
    {
        bPendingStop = false;
        if (ActiveAction == EHWActionType::None)
        {
            StopActive(ActiveBinding.BlendOut);
        }
    }

    SyncToCombatClock();
}

void UHWPlayerPresentationComponent::HandleActionStarted(EHWActionType Action)
{
    if (Combat && Combat->IsDead())
    {
        return;
    }
    // End + next start may happen in the same combat tick.
    // Cancelling the pending stop avoids an idle leak between combo attacks.
    bPendingStop = false;

    if (!AnimationSet)
    {
        ActiveAction = Action;
        return;
    }

    const FHWSequenceBinding* Binding = AnimationSet->GetPlayerBinding(Action);
    if (!Binding || !Binding->Sequence)
    {
        ActiveAction = Action;
        ActiveBinding = FHWSequenceBinding();
        return;
    }

    PlayBinding(Action, *Binding);
}

void UHWPlayerPresentationComponent::HandleActionEnded(EHWActionType Action)
{
    if (Action != ActiveAction)
    {
        return;
    }

    ActiveAction = EHWActionType::None;
    bPendingStop = true;
}

void UHWPlayerPresentationComponent::PlayBinding(
    EHWActionType Action,
    const FHWSequenceBinding& Binding)
{
    if (!AnimInstance || !Binding.Sequence)
    {
        return;
    }

    ActiveBinding = Binding;
    ActiveAction = Action;
    ActiveSourceTime = 0.f;
    PreviousCombatElapsed = 0.f;
    bVisualContactFired = false;

    ActiveMontage = AnimInstance->PlaySlotAnimationAsDynamicMontage(
        Binding.Sequence,
        Binding.SlotName,
        Binding.BlendIn,
        Binding.BlendOut,
        1.f,
        Binding.bLoop ? 999 : 1,
        -1.f,
        0.f);

    if (ActiveMontage)
    {
        // Combat clock is authoritative. Keep the montage alive but scrub its
        // position every frame, so hitstop naturally freezes visual motion too.
        AnimInstance->Montage_SetPlayRate(ActiveMontage, 0.f);
        AnimInstance->Montage_SetPosition(ActiveMontage, 0.f);
    }
}

void UHWPlayerPresentationComponent::StopActive(float BlendOut)
{
    if (AnimInstance && ActiveMontage)
    {
        AnimInstance->Montage_Stop(FMath::Max(0.f, BlendOut), ActiveMontage);
    }

    ActiveMontage = nullptr;
    ActiveBinding = FHWSequenceBinding();
    ActiveSourceTime = 0.f;
    PreviousCombatElapsed = 0.f;
    bVisualContactFired = false;
}

void UHWPlayerPresentationComponent::SyncToCombatClock()
{
    if (!Combat || Combat->IsDead() || !AnimInstance || !ActiveMontage || !ActiveBinding.Sequence)
    {
        return;
    }

    const EHWActionType CombatAction = Combat->GetCurrentAction();
    if (CombatAction == EHWActionType::None || CombatAction != ActiveAction || !Combat->Tuning)
    {
        return;
    }

    const FHWActionSpec& Spec = Combat->Tuning->GetActionSpec(CombatAction);
    const float SourceLength = FMath::Max(0.001f, ActiveBinding.Sequence->GetPlayLength());
    const float CombatElapsed = Combat->GetActionElapsed();

    ActiveSourceTime = MapCombatTimeToSourceTime(
        CombatElapsed,
        Spec.Duration,
        Spec.HitAt,
        SourceLength,
        ActiveBinding.SourceContactNormalized);

    AnimInstance->Montage_SetPosition(ActiveMontage, ActiveSourceTime);

    if (!bVisualContactFired
        && Spec.HitAt >= 0.f
        && PreviousCombatElapsed < Spec.HitAt
        && CombatElapsed >= Spec.HitAt)
    {
        bVisualContactFired = true;
        OnVisualContact.Broadcast(ActiveAction, ActiveSourceTime);
        if (Combat->IsDead() || Combat->GetCurrentAction() != CombatAction)
        {
            return;
        }
    }

    PreviousCombatElapsed = CombatElapsed;
}

float UHWPlayerPresentationComponent::MapCombatTimeToSourceTime(
    float CombatElapsed,
    float CombatDuration,
    float HitAt,
    float SourceLength,
    float SourceContactNormalized) const
{
    CombatDuration = FMath::Max(0.001f, CombatDuration);
    CombatElapsed = FMath::Clamp(CombatElapsed, 0.f, CombatDuration);
    SourceLength = FMath::Max(0.001f, SourceLength);

    if (HitAt <= 0.f || HitAt >= CombatDuration)
    {
        return SourceLength * (CombatElapsed / CombatDuration);
    }

    const float SourceContact = SourceLength * FMath::Clamp(SourceContactNormalized, 0.01f, 0.99f);

    if (CombatElapsed <= HitAt)
    {
        return SourceContact * (CombatElapsed / HitAt);
    }

    const float AfterCombat = FMath::Max(0.001f, CombatDuration - HitAt);
    const float U = (CombatElapsed - HitAt) / AfterCombat;
    return SourceContact + (SourceLength - SourceContact) * U;
}

float UHWPlayerPresentationComponent::GetActiveSourceNormalized() const
{
    if (!ActiveBinding.Sequence)
    {
        return 0.f;
    }

    return FMath::Clamp(
        ActiveSourceTime / FMath::Max(0.001f, ActiveBinding.Sequence->GetPlayLength()),
        0.f,
        1.f);
}
