#include "HHBossIntroDirector.h"
#include "HHBossIntroAnchor.h"
#include "HHBossPresentationInterface.h"

#include "EngineUtils.h"
#include "GameFramework/HUD.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "Net/UnrealNetwork.h"

AHHBossIntroDirector::AHHBossIntroDirector()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    SetReplicateMovement(false);
}

void AHHBossIntroDirector::BeginPlay()
{
    Super::BeginPlay();
}

void AHHBossIntroDirector::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (!bIntroPlaying || CurrentIndex == INDEX_NONE)
    {
        return;
    }

    // Hwanghon (docs/design/162): a hitch (shaders compiling as the intro starts) must not eat a beat - EP01's 0.12 s
    // entry beat vanished inside one long frame. The beat clock moves at most 1/30 s per frame.
    BeatElapsed += FMath::Min(DeltaSeconds, 1.f / 30.f);

    if (BeatElapsed >= BeatHold)
    {
        AdvanceBeat();
    }
}

void AHHBossIntroDirector::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AHHBossIntroDirector, BossActor);
}

FHHBossIntroTimingProfile AHHBossIntroDirector::GetResolvedTimingProfile() const
{
    return HHBossIntroProfiles::Resolve(BossId);
}

void AHHBossIntroDirector::StartBossIntro(bool bShortVersion)
{
    if (!HasAuthority() || bIntroPlaying)
    {
        return;
    }

    MulticastStartBossIntro(BossId, bShortVersion);
}

void AHHBossIntroDirector::ForceFinishBossIntro()
{
    if (!HasAuthority())
    {
        return;
    }

    MulticastForceFinishBossIntro(BossId);
}

void AHHBossIntroDirector::MulticastStartBossIntro_Implementation(FName InBossId, bool bShortVersion)
{
    BeginLocalIntro(InBossId, bShortVersion);
}

void AHHBossIntroDirector::MulticastForceFinishBossIntro_Implementation(FName InBossId)
{
    if (bIntroPlaying && BossId == InBossId)
    {
        FinishLocalIntro();
    }
}

void AHHBossIntroDirector::DiscoverLocalAnchors()
{
    LocalSequence.Reset();

    if (ExplicitAnchors.Num() > 0)
    {
        for (AHHBossIntroAnchor* Anchor : ExplicitAnchors)
        {
            if (Anchor && (Anchor->BossId.IsNone() || Anchor->BossId == BossId))
            {
                LocalSequence.Add(Anchor);
            }
        }
    }
    else if (bAutoDiscoverAnchors && GetWorld())
    {
        for (TActorIterator<AHHBossIntroAnchor> It(GetWorld()); It; ++It)
        {
            AHHBossIntroAnchor* Anchor = *It;
            if (Anchor && (Anchor->BossId.IsNone() || Anchor->BossId == BossId))
            {
                LocalSequence.Add(Anchor);
            }
        }
    }

    LocalSequence.Sort([](
        const TWeakObjectPtr<AHHBossIntroAnchor>& A,
        const TWeakObjectPtr<AHHBossIntroAnchor>& B)
    {
        const AHHBossIntroAnchor* Left = A.Get();
        const AHHBossIntroAnchor* Right = B.Get();

        if (!Left) return false;
        if (!Right) return true;

        return static_cast<uint8>(Left->Beat) < static_cast<uint8>(Right->Beat);
    });
}

void AHHBossIntroDirector::BeginLocalIntro(FName InBossId, bool bShortVersion)
{
    BossId = InBossId;
    bLocalShortVersion = bShortVersion;
    LocalProfile = HHBossIntroProfiles::Resolve(BossId);

    DiscoverLocalAnchors();

    bIntroPlaying = true;
    CurrentIndex = INDEX_NONE;
    BeatElapsed = 0.f;
    BeatHold = 0.f;

    SetLocalCinematicState(true);
    DispatchBossBegin();

    OnIntroStarted.Broadcast(BossId, bShortVersion);

    if (LocalSequence.Num() == 0)
    {
        UE_LOG(
            LogTemp,
            Warning,
            TEXT("[Hwanghon BossIntro] No intro anchors found for %s"),
            *BossId.ToString());

        FinishLocalIntro();
        return;
    }

    EnterBeat(0);
}

void AHHBossIntroDirector::EnterBeat(int32 Index)
{
    if (!LocalSequence.IsValidIndex(Index))
    {
        FinishLocalIntro();
        return;
    }

    AHHBossIntroAnchor* Anchor = LocalSequence[Index].Get();
    if (!Anchor)
    {
        EnterBeat(Index + 1);
        return;
    }

    CurrentIndex = Index;
    CurrentBeat = Anchor->Beat;
    BeatElapsed = 0.f;
    BeatHold = ResolveBeatHold(Anchor);

    DispatchBossBeat(CurrentBeat);

    if (APlayerController* PC = LocalPlayerController.Get())
    {
        PC->SetViewTargetWithBlend(
            Anchor,
            ResolveBlendTime(Anchor),
            VTBlend_Cubic,
            0.f,
            true);
    }
}

void AHHBossIntroDirector::AdvanceBeat()
{
    EnterBeat(CurrentIndex + 1);
}

void AHHBossIntroDirector::FinishLocalIntro()
{
    if (!bIntroPlaying)
    {
        return;
    }

    bIntroPlaying = false;
    CurrentIndex = INDEX_NONE;
    BeatElapsed = 0.f;
    BeatHold = 0.f;

    DispatchBossEnd();
    SetLocalCinematicState(false);

    OnIntroFinished.Broadcast(BossId);
}

float AHHBossIntroDirector::ResolveBeatHold(const AHHBossIntroAnchor* Anchor) const
{
    float Hold = Anchor && Anchor->HoldOverride >= 0.f
        ? Anchor->HoldOverride
        : LocalProfile.GetHold(Anchor ? Anchor->Beat : EHHBossIntroBeat::PlayerEntry);

    if (bLocalShortVersion)
    {
        Hold *= FMath::Clamp(LocalProfile.ShortVersionMultiplier, 0.1f, 1.f);
    }

    return FMath::Max(0.05f, Hold);
}

float AHHBossIntroDirector::ResolveBlendTime(const AHHBossIntroAnchor* Anchor) const
{
    float Blend = Anchor && Anchor->BlendOverride >= 0.f
        ? Anchor->BlendOverride
        : LocalProfile.DefaultBlend;

    if (bLocalShortVersion)
    {
        Blend *= 0.70f;
    }

    return FMath::Max(0.f, Blend);
}

void AHHBossIntroDirector::SetLocalCinematicState(bool bEnabled)
{
    if (bEnabled)
    {
        APlayerController* Candidate = GetWorld()
            ? GetWorld()->GetFirstPlayerController()
            : nullptr;

        LocalPlayerController =
            (Candidate && Candidate->IsLocalController())
                ? Candidate
                : nullptr;

        if (APlayerController* PC = LocalPlayerController.Get())
        {
            if (bLockPlayerInput)
            {
                PC->SetIgnoreMoveInput(true);
                PC->SetIgnoreLookInput(true);
            }

            if (bHideHUDDuringIntro)
            {
                if (AHUD* HUD = PC->GetHUD())
                {
                    bSavedShowHUD = HUD->bShowHUD;
                    HUD->bShowHUD = false;
                }
            }
        }

        return;
    }

    if (APlayerController* PC = LocalPlayerController.Get())
    {
        if (APawn* Pawn = PC->GetPawn())
        {
            PC->SetViewTargetWithBlend(
                Pawn,
                ReturnToPlayerBlend,
                VTBlend_Cubic,
                0.f,
                true);
        }

        if (bLockPlayerInput)
        {
            PC->SetIgnoreMoveInput(false);
            PC->SetIgnoreLookInput(false);
        }

        if (bHideHUDDuringIntro)
        {
            if (AHUD* HUD = PC->GetHUD())
            {
                HUD->bShowHUD = bSavedShowHUD;
            }
        }
    }

    LocalPlayerController.Reset();
}

void AHHBossIntroDirector::DispatchBossBegin()
{
    if (BossActor
        && BossActor->GetClass()->ImplementsInterface(UHHBossPresentationInterface::StaticClass()))
    {
        IHHBossPresentationInterface::Execute_HH_BossIntroBegin(BossActor, BossId);
    }
}

void AHHBossIntroDirector::DispatchBossBeat(EHHBossIntroBeat Beat)
{
    if (BossActor
        && BossActor->GetClass()->ImplementsInterface(UHHBossPresentationInterface::StaticClass()))
    {
        IHHBossPresentationInterface::Execute_HH_BossIntroBeat(BossActor, BossId, Beat);
    }
}

void AHHBossIntroDirector::DispatchBossEnd()
{
    if (BossActor
        && BossActor->GetClass()->ImplementsInterface(UHHBossPresentationInterface::StaticClass()))
    {
        IHHBossPresentationInterface::Execute_HH_BossIntroEnd(BossActor, BossId);
    }
}
