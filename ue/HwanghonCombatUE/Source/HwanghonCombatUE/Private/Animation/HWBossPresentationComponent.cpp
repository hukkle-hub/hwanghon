#include "Animation/HWBossPresentationComponent.h"

#include "Animation/AnimInstance.h"
#include "Animation/AnimMontage.h"
#include "Animation/AnimSequenceBase.h"
#include "Boss/HWBossCharacter.h"
#include "GameFramework/Character.h"

UHWBossPresentationComponent::UHWBossPresentationComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UHWBossPresentationComponent::BeginPlay()
{
    Super::BeginPlay();

    Boss = Cast<AHWBossCharacter>(GetOwner());
    ACharacter* Character = Cast<ACharacter>(GetOwner());

    if (!Boss || !Character || !Character->GetMesh())
    {
        return;
    }

    AnimInstance = Character->GetMesh()->GetAnimInstance();

    Boss->OnBossStateChanged.AddDynamic(this, &UHWBossPresentationComponent::HandleBossStateChanged);
    Boss->OnBossReaction.AddDynamic(this, &UHWBossPresentationComponent::HandleBossReaction);
}

void UHWBossPresentationComponent::TickComponent(
    float DeltaTime,
    ELevelTick TickType,
    FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    SyncStateToBossClock();
}

void UHWBossPresentationComponent::HandleBossStateChanged(EHWBossState NewState, FName PatternId)
{
    ActiveState = NewState;
    ActivePatternId = PatternId;
    PreviousStatePhase = 0.f;
    NextVisualBeat = 0;

    if (NewState == EHWBossState::Dead)
    {
        if (AnimInstance)
        {
            if (ActiveStateMontage) AnimInstance->Montage_Stop(0.f, ActiveStateMontage);
            if (ActiveReactionMontage) AnimInstance->Montage_Stop(0.f, ActiveReactionMontage);
        }
        ActiveStateMontage = nullptr;
        ActiveReactionMontage = nullptr;
        ActiveStateBinding = FHWSequenceBinding();
        return;
    }

    if (!AnimationSet || !AnimInstance)
    {
        return;
    }

    if (NewState == EHWBossState::Idle)
    {
        if (ActiveStateMontage)
        {
            AnimInstance->Montage_Stop(0.16f, ActiveStateMontage);
            ActiveStateMontage = nullptr;
        }
        return;
    }

    const FHWBossPatternAnimationBinding* PatternBinding =
        AnimationSet->GetBossPatternBinding(PatternId);

    if (!PatternBinding)
    {
        return;
    }

    const FHWSequenceBinding* Binding = nullptr;
    switch (NewState)
    {
        case EHWBossState::Tell: Binding = &PatternBinding->Tell; break;
        case EHWBossState::Strike: Binding = &PatternBinding->Strike; break;
        case EHWBossState::Recover: Binding = &PatternBinding->Recover; break;
        default: break;
    }

    if (Binding && Binding->Sequence)
    {
        PlayStateBinding(NewState, PatternId, *Binding);
    }
}

void UHWBossPresentationComponent::HandleBossReaction(
    EHWAttackTier Tier,
    FVector WorldDirection)
{
    if (!AnimationSet || !Boss || Boss->IsDead())
    {
        return;
    }

    const FHWSequenceBinding* Binding = AnimationSet->GetBossReactionBinding(Tier);
    if (Binding && Binding->Sequence)
    {
        PlayReactionBinding(*Binding);
    }
}

void UHWBossPresentationComponent::PlayStateBinding(
    EHWBossState State,
    FName PatternId,
    const FHWSequenceBinding& Binding)
{
    if (!AnimInstance || !Binding.Sequence)
    {
        return;
    }

    ActiveStateBinding = Binding;

    ActiveStateMontage = AnimInstance->PlaySlotAnimationAsDynamicMontage(
        Binding.Sequence,
        Binding.SlotName,
        Binding.BlendIn,
        Binding.BlendOut,
        1.f,
        Binding.bLoop ? 999 : 1,
        -1.f,
        0.f);

    if (ActiveStateMontage)
    {
        AnimInstance->Montage_SetPlayRate(ActiveStateMontage, 0.f);
        AnimInstance->Montage_SetPosition(ActiveStateMontage, 0.f);
    }
}

void UHWBossPresentationComponent::PlayReactionBinding(const FHWSequenceBinding& Binding)
{
    if (!AnimInstance || !Binding.Sequence)
    {
        return;
    }

    ActiveReactionMontage = AnimInstance->PlaySlotAnimationAsDynamicMontage(
        Binding.Sequence,
        Binding.SlotName.IsNone() ? FName(TEXT("UpperBodyReaction")) : Binding.SlotName,
        Binding.BlendIn,
        Binding.BlendOut,
        1.f,
        1,
        -1.f,
        0.f);
}

void UHWBossPresentationComponent::SyncStateToBossClock()
{
    if (!IsValid(Boss) || Boss->IsActorBeingDestroyed() || Boss->IsDead()
        || !IsValid(AnimInstance) || !ActiveStateMontage || !ActiveStateBinding.Sequence)
    {
        return;
    }

    const EHWBossState StateAtStart = ActiveState;
    const EHWBossState CombatStateAtStart = Boss->GetBossState();
    const FName PatternAtStart = ActivePatternId;
    UAnimMontage* const MontageAtStart = ActiveStateMontage;
    UAnimInstance* const AnimInstanceAtStart = AnimInstance;

    const float StatePhase = Boss->GetBossStateNormalized();
    const float SourceLength = FMath::Max(0.001f, ActiveStateBinding.Sequence->GetPlayLength());
    float SourcePhase = StatePhase;

    if (ActiveState == EHWBossState::Strike && AnimationSet)
    {
        const FHWBossPatternAnimationBinding* PatternBinding =
            AnimationSet->GetBossPatternBinding(ActivePatternId);

        if (PatternBinding)
        {
            SourcePhase = MapStrikePhaseToSourcePhase(
                StatePhase,
                Boss->GetCurrentPattern(),
                *PatternBinding);

            const FHWBossPatternSpec& Pattern = Boss->GetCurrentPattern();
            while (NextVisualBeat < Pattern.Beats.Num())
            {
                const float BeatPhase = Pattern.StrikeDuration > 0.f
                    ? Pattern.Beats[NextVisualBeat].At / Pattern.StrikeDuration
                    : 1.f;

                if (PreviousStatePhase < BeatPhase && StatePhase >= BeatPhase)
                {
                    // Consume before invoking listeners: they may kill or interrupt the boss.
                    const int32 BeatIndex = NextVisualBeat++;
                    OnVisualBossBeat.Broadcast(PatternAtStart, BeatIndex);
                    if (!IsValid(Boss) || Boss->IsActorBeingDestroyed() || Boss->IsDead()
                        || ActiveState != StateAtStart || Boss->GetBossState() != CombatStateAtStart
                        || ActivePatternId != PatternAtStart || ActiveStateMontage != MontageAtStart
                        || AnimInstance != AnimInstanceAtStart || !IsValid(AnimInstance))
                    {
                        // Do not process more beats or seek a montage cleared by the callback.
                        return;
                    }
                }
                else
                {
                    break;
                }
            }
        }
    }

    AnimInstance->Montage_SetPosition(
        ActiveStateMontage,
        SourceLength * FMath::Clamp(SourcePhase, 0.f, 1.f));

    PreviousStatePhase = StatePhase;
}

float UHWBossPresentationComponent::MapStrikePhaseToSourcePhase(
    float StatePhase,
    const FHWBossPatternSpec& Pattern,
    const FHWBossPatternAnimationBinding& AnimBinding) const
{
    StatePhase = FMath::Clamp(StatePhase, 0.f, 1.f);

    if (Pattern.Beats.IsEmpty()
        || AnimBinding.SourceBeatNormalized.Num() != Pattern.Beats.Num()
        || Pattern.StrikeDuration <= 0.f)
    {
        return StatePhase;
    }

    TArray<float> CombatKeys;
    TArray<float> SourceKeys;

    CombatKeys.Reserve(Pattern.Beats.Num() + 2);
    SourceKeys.Reserve(Pattern.Beats.Num() + 2);

    CombatKeys.Add(0.f);
    SourceKeys.Add(0.f);

    for (int32 Index = 0; Index < Pattern.Beats.Num(); ++Index)
    {
        CombatKeys.Add(FMath::Clamp(
            Pattern.Beats[Index].At / Pattern.StrikeDuration,
            0.001f,
            0.999f));

        SourceKeys.Add(FMath::Clamp(
            AnimBinding.SourceBeatNormalized[Index],
            0.001f,
            0.999f));
    }

    CombatKeys.Add(1.f);
    SourceKeys.Add(1.f);

    for (int32 Segment = 0; Segment < CombatKeys.Num() - 1; ++Segment)
    {
        const float C0 = CombatKeys[Segment];
        const float C1 = CombatKeys[Segment + 1];

        if (StatePhase <= C1 || Segment == CombatKeys.Num() - 2)
        {
            const float U = (StatePhase - C0) / FMath::Max(0.0001f, C1 - C0);
            return FMath::Lerp(SourceKeys[Segment], SourceKeys[Segment + 1], FMath::Clamp(U, 0.f, 1.f));
        }
    }

    return 1.f;
}
