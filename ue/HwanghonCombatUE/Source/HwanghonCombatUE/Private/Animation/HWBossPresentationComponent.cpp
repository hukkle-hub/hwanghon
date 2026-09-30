#include "Animation/HWBossPresentationComponent.h"
#include "Kismet/GameplayStatics.h"

#include "Animation/AnimInstance.h"
#include "Animation/AnimMontage.h"
#include "Animation/AnimSequenceBase.h"
#include "Boss/HWBossCharacter.h"
#include "GameFramework/Character.h"
#include "Animation/AnimSingleNodeInstance.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/CapsuleComponent.h"

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
    BodyMesh = Character->GetMesh();
    bSingleNode = BodyMesh->GetAnimationMode() == EAnimationMode::AnimationSingleNode;
    MeshBaseZ = BodyMesh->GetRelativeLocation().Z;

    Boss->OnBossStateChanged.AddDynamic(this, &UHWBossPresentationComponent::HandleBossStateChanged);
    Boss->OnBossReaction.AddDynamic(this, &UHWBossPresentationComponent::HandleBossReaction);
}

void UHWBossPresentationComponent::TickComponent(
    float DeltaTime,
    ELevelTick TickType,
    FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    if (bSingleNode)
    {
        TickSingleNode(DeltaTime);
        return;
    }
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

    if (bSingleNode)
    {
        return;   // TickSingleNode reads the boss state every frame
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
    if (bSingleNode)
    {
        // A flinch never interrupts a windup/strike on screen (the combat clock owns those).
        const EHWBossState S = Boss->GetBossState();
        const FHWSequenceBinding* R = AnimationSet->GetBossReactionBinding(Tier);
        if (R && R->Sequence && (S == EHWBossState::Idle || S == EHWBossState::Recover))
        {
            ReactionSequence = R->Sequence;
            ReactionTime = 0.f;
        }
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

void UHWBossPresentationComponent::ShowClip(UAnimSequenceBase* Sequence, float Time, bool bLoop)
{
    UAnimSingleNodeInstance* Node = BodyMesh ? BodyMesh->GetSingleNodeInstance() : nullptr;
    if (!Node || !Sequence) return;
    if (Node->GetAnimationAsset() != Sequence)
    {
        Node->SetAnimationAsset(Sequence, bLoop);
    }
    const float* Ground = AnimationSet ? AnimationSet->ClipGroundOffsetCm.Find(Sequence) : nullptr;
    ClipGroundCm = Ground ? *Ground : 0.f;
    Node->SetPlaying(false);
    ShownClip = Sequence;
    ShownTime = FMath::Clamp(Time, 0.f, Sequence->GetPlayLength());
    Node->SetPosition(ShownTime, false);
}

void UHWBossPresentationComponent::TickSingleNode(float DeltaTime)
{
    TickSingleNodePose(DeltaTime);
    GroundBody(DeltaTime);
}

void UHWBossPresentationComponent::StartRagdoll()
{
    bRagdoll = true;
    // Die() turns the whole actor's collision off; the body needs the world to land on. The capsule stays out.
    Boss->SetActorEnableCollision(true);
    if (UCapsuleComponent* Capsule = Boss->GetCapsuleComponent())
    {
        Capsule->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    }
    if (UAnimSingleNodeInstance* Node = BodyMesh->GetSingleNodeInstance())
    {
        Node->SetPlaying(false);   // the pose it died in is where the fall starts
    }
    BodyMesh->SetCollisionProfileName(TEXT("Ragdoll"));
    BodyMesh->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    BodyMesh->SetAllBodiesSimulatePhysics(true);
    BodyMesh->SetSimulatePhysics(true);
    BodyMesh->WakeAllRigidBodies();
    BodyMesh->bBlendPhysics = true;
    // a 3 m body of wire and straw drops heavily: damped limbs (no doll flailing), a little extra down on the pelvis
    for (FBodyInstance* BI : BodyMesh->Bodies)
    {
        if (!BI) continue;
        BI->LinearDamping = 0.35f;
        BI->AngularDamping = 2.5f;
        BI->UpdateDampingProperties();
    }
    RagdollStart = GetWorld()->GetTimeSeconds();
    bRagdollLogged = false;
    // it falls away from the blow: push from the player's side, at the chest, gently (a 3 m body, not a flung doll)
    if (const APawn* P = UGameplayStatics::GetPlayerPawn(this, 0))
    {
        FVector Away = (Boss->GetActorLocation() - P->GetActorLocation()).GetSafeNormal2D();
        BodyMesh->AddImpulseToAllBodiesBelow(Away * 180.f + FVector(0, 0, -40.f), NAME_None, true, true);
    }
    const FName Pelvis = BodyMesh->GetBoneName(0);
    BodyMesh->AddImpulse(FVector(0, 0, -250.f), Pelvis, true);
}

void UHWBossPresentationComponent::GroundBody(float DeltaTime)
{
    if (!BodyMesh || !IsValid(Boss) || bRagdoll) return;
    const EHWBossState State = Boss->GetBossState();
    const float Scale = BodyMesh->GetRelativeScale3D().Z;
    if (State == EHWBossState::Dead || State == EHWBossState::Break)
    {
        // Lowest bone of the last evaluated pose onto the floor (capsule bottom) + 3 cm.
        float Lowest = TNumericLimits<float>::Max();
        for (int32 I = 0; I < BodyMesh->GetNumBones(); ++I)
        {
            Lowest = FMath::Min(Lowest, BodyMesh->GetBoneLocation(BodyMesh->GetBoneName(I)).Z);
        }
        const UCapsuleComponent* Capsule = Boss->GetCapsuleComponent();
        const float Floor = Boss->GetActorLocation().Z - (Capsule ? Capsule->GetScaledCapsuleHalfHeight() : 0.f);
        const float Error = Lowest - (Floor + 3.f);
        LyingDrop = FMath::Max(0.f, LyingDrop + Error * FMath::Min(1.f, DeltaTime * 12.f));
    }
    else
    {
        LyingDrop = FMath::FInterpTo(LyingDrop, 0.f, DeltaTime, 6.f);
        // Standing: the toes are never under the floor (docs/design/165 - QA measured Shadow Fang's feet 37 cm into
        // the ground, Clave's 36 cm in some moves). Below: lift at once. Above: settle back slowly, so a jump stays one.
        float Toe = TNumericLimits<float>::Max();
        for (int32 I = 0; I < BodyMesh->GetNumBones(); ++I)
        {
            const FName N = BodyMesh->GetBoneName(I);
            const FString S = N.ToString().ToLower();
            if (S.Contains(TEXT("toe")) || S.Contains(TEXT("foot")) || S.Contains(TEXT("ball")))
            {
                Toe = FMath::Min(Toe, BodyMesh->GetBoneLocation(N).Z);
            }
        }
        if (Toe < TNumericLimits<float>::Max())
        {
            const UCapsuleComponent* Capsule = Boss->GetCapsuleComponent();
            const float Floor = Boss->GetActorLocation().Z - (Capsule ? Capsule->GetScaledCapsuleHalfHeight() : 0.f);
            const float Under = (Floor + 2.f) - (Toe - StandLift);   // how far the unlifted toe would be under
            const float Want = FMath::Max(0.f, Under);
            StandLift = Want > StandLift ? Want : FMath::FInterpTo(StandLift, Want, DeltaTime, 2.f);
        }
    }
    FVector L = BodyMesh->GetRelativeLocation();
    L.Z = MeshBaseZ - ClipGroundCm * Scale - LyingDrop + StandLift;
    BodyMesh->SetRelativeLocation(L);
}

void UHWBossPresentationComponent::TickSingleNodePose(float DeltaTime)
{
    if (!IsValid(Boss) || !AnimationSet || !BodyMesh) return;
    auto Len = [](const UAnimSequenceBase* S) { return S ? FMath::Max(0.001f, S->GetPlayLength()) : 1.f; };

    if (Boss->IsDead())
    {
        if (!bRagdoll && BodyMesh && BodyMesh->GetPhysicsAsset())
        {
            StartRagdoll();
        }
        if (bRagdoll)
        {
            // measured, not eyeballed (docs/design/165): how the body lies 3 s after the fall
            if (!bRagdollLogged && GetWorld()->GetTimeSeconds() - RagdollStart > 3.f)
            {
                bRagdollLogged = true;
                float Low = TNumericLimits<float>::Max(), High = -Low;
                for (int32 I = 0; I < BodyMesh->GetNumBones(); ++I)
                {
                    const float Z = BodyMesh->GetBoneLocation(BodyMesh->GetBoneName(I)).Z;
                    Low = FMath::Min(Low, Z);
                    High = FMath::Max(High, Z);
                }
                const float Hips = BodyMesh->GetBoneLocation(BodyMesh->GetBoneName(0)).Z - Low;
                UE_LOG(LogTemp, Display, TEXT("[HWRagdoll] 3s after the fall: pelvis %.0f cm, highest bone %.0f cm above the lowest"), Hips, High - Low);
            }
            return;
        }
        // Killed while already down (the EP01 sever lands inside the break): stay down — play the down clip on
        // to its end instead of a death clip that starts from standing (doc 141).
        if (DownedClip)
        {
            DownedTime = FMath::Min(DownedTime + DeltaTime, Len(DownedClip));
            ShowClip(DownedClip, DownedTime, false);
            return;
        }
        if (UAnimSequenceBase* Death = AnimationSet->BossDeath.Sequence)
        {
            DeathTime += DeltaTime;
            ShowClip(Death, FMath::Min(DeathTime, Len(Death)), false);   // hold the last frame
        }
        return;
    }
    DeathTime = 0.f;

    if (IntroClip)
    {
        IntroElapsed += DeltaTime;
        const float A = IntroSeconds > 0.f ? FMath::Clamp(IntroElapsed / IntroSeconds, 0.f, 1.f) : 1.f;
        ShowClip(IntroClip, FMath::InterpEaseOut(0.f, IntroTo, A, 2.f) * Len(IntroClip), false);
        return;
    }

    const EHWBossState State = Boss->GetBossState();
    const float Phase = FMath::Clamp(Boss->GetPresentationStatePhase(), 0.f, 1.f);

    if (State == EHWBossState::Tell || State == EHWBossState::Strike || State == EHWBossState::Recover)
    {
        ReactionTime = -1.f;
        const FHWBossPatternSpec& Spec = Boss->GetPresentedPattern();
        const FHWBossPatternAnimationBinding* P = AnimationSet->GetBossPatternBinding(Spec.Id);
        float Time = 0.f;
        if (UAnimSequenceBase* Seq = P ? PatternClipAt(*P, Spec, State, Phase, Time) : nullptr)
        {
            ShowClip(Seq, Time, false);
            return;
        }
    }
    if (State == EHWBossState::Stagger || State == EHWBossState::Break)
    {
        const FHWSequenceBinding& B = State == EHWBossState::Break ? AnimationSet->BossBreakReaction : AnimationSet->BossStaggerReaction;
        if (B.Sequence)
        {
            ShowClip(B.Sequence, Phase * Len(B.Sequence), false);
            DownedClip = State == EHWBossState::Break ? B.Sequence.Get() : nullptr;
            DownedTime = Phase * Len(B.Sequence);
            return;
        }
    }
    DownedClip = nullptr;
    if (ReactionTime >= 0.f && ReactionSequence)
    {
        ReactionTime += DeltaTime;
        if (ReactionTime < Len(ReactionSequence))
        {
            ShowClip(ReactionSequence, ReactionTime, false);
            return;
        }
        ReactionTime = -1.f;
    }
    // Base: idle or walk by ground speed (the walk clip is paced to about 200 cm/s).
    const float Speed = Boss->GetVelocity().Size2D();
    UAnimSequenceBase* Base = Speed > 30.f && AnimationSet->BossWalk.Sequence ? AnimationSet->BossWalk.Sequence.Get() : AnimationSet->BossIdle.Sequence.Get();
    if (Base)
    {
        BaseTime += DeltaTime * (Base == AnimationSet->BossWalk.Sequence ? FMath::Clamp(Speed / 200.f, 0.5f, 2.f) : 1.f);
        ShowClip(Base, FMath::Fmod(BaseTime, Len(Base)), true);
    }
}

UAnimSequenceBase* UHWBossPresentationComponent::PatternClipAt(
    const FHWBossPatternAnimationBinding& P, const FHWBossPatternSpec& Spec, EHWBossState State, float Phase, float& OutTime) const
{
    // Contacts: beat k lands at Spec.Beats[k].At (strike clock) on clip k at SourceBeatNormalized[k].
    const int32 N = FMath::Max(1, Spec.Beats.Num());
    auto Clip = [&P](int32 K) -> UAnimSequenceBase*
    {
        UAnimSequenceBase* S = P.BeatSequences.IsValidIndex(K) ? P.BeatSequences[K].Get() : nullptr;
        return S ? S : P.Strike.Sequence.Get();
    };
    auto Len = [](const UAnimSequenceBase* S) { return FMath::Max(0.001f, S->GetPlayLength()); };
    auto At = [&Spec](int32 K) { return Spec.Beats.IsValidIndex(K) ? Spec.Beats[K].At : 0.f; };
    auto Contact = [&](int32 K)
    {
        const float U = P.SourceBeatNormalized.IsValidIndex(K) ? P.SourceBeatNormalized[K] : P.Strike.SourceContactNormalized;
        return U * Len(Clip(K));
    };
    if (!Clip(0))
    {
        return nullptr;
    }

    if (State == EHWBossState::Tell)
    {
        // The whole windup up to the first contact, stretched over the telegraph (the tell reads slow).
        OutTime = Phase * FMath::Max(0.f, Contact(0) - At(0));
        return Clip(0);
    }
    const float StrikeLen = FMath::Max(0.001f, Spec.StrikeDuration);
    if (State == EHWBossState::Recover)
    {
        // The rest of the last clip, fitted into the recovery.
        UAnimSequenceBase* Last = Clip(N - 1);
        const float From = FMath::Min(Len(Last), Contact(N - 1) + (StrikeLen - At(N - 1)));
        OutTime = FMath::Lerp(From, Len(Last), Phase);
        return Last;
    }

    // Strike: real speed around each contact; two beats on one clip interpolate between their contacts.
    const float T = Phase * StrikeLen;
    int32 K = 0;
    while (K + 1 < N && T > At(K + 1) - (Clip(K + 1) == Clip(K) ? 0.f : 0.5f * (At(K + 1) - At(K))))
    {
        ++K;
    }
    UAnimSequenceBase* Seq = Clip(K);
    if (K + 1 < N && Clip(K + 1) == Seq && T >= At(K))
    {
        const float U = (T - At(K)) / FMath::Max(0.001f, At(K + 1) - At(K));
        OutTime = FMath::Lerp(Contact(K), Contact(K + 1), FMath::Clamp(U, 0.f, 1.f));
    }
    else
    {
        OutTime = FMath::Clamp(Contact(K) + (T - At(K)), 0.f, Len(Seq));
    }
    return Seq;
}

void UHWBossPresentationComponent::SetIntroStill()
{
    IntroClip = AnimationSet ? AnimationSet->BossIdle.Sequence.Get() : nullptr;
    IntroTo = 0.f;
    IntroSeconds = 1.f;
    IntroElapsed = 0.f;
}

void UHWBossPresentationComponent::SetIntroWindup(FName PatternId, float Seconds)
{
    const FHWBossPatternAnimationBinding* P = AnimationSet ? AnimationSet->GetBossPatternBinding(PatternId) : nullptr;
    UAnimSequenceBase* Clip = P && P->BeatSequences.Num() > 0 ? P->BeatSequences[0].Get() : (P ? P->Strike.Sequence.Get() : nullptr);
    if (!Clip) { IntroClip = nullptr; return; }
    const float Contact = P->SourceBeatNormalized.Num() > 0 ? P->SourceBeatNormalized[0] : P->Strike.SourceContactNormalized;
    IntroClip = Clip;
    IntroTo = FMath::Max(0.f, Contact * 0.85f);   // the wind-up only: it never lands in the intro
    IntroSeconds = FMath::Max(0.1f, Seconds * 0.8f);
    IntroElapsed = 0.f;
}
