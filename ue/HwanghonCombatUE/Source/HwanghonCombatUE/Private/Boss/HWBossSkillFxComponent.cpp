#include "Boss/HWBossSkillFxComponent.h"

#include "Animation/HWBossPresentationComponent.h"
#include "Boss/HWBossCharacter.h"
#include "Camera/CameraComponent.h"
#include "Camera/PlayerCameraManager.h"
#include "Character/HWImpactFx.h"
#include "Components/CapsuleComponent.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"

namespace
{
    const FLinearColor SparkWhite(1.f, 0.86f, 0.58f);   // warm white core, gold edge (motion study tab 1)
    const FLinearColor Danger(1.f, 0.35f, 0.12f);       // red-orange: cannot be parried (tab 4)
    const FLinearColor Blood(0.95f, 0.16f, 0.1f);       // the riposte (tab 3)
    const FLinearColor Dust(0.12f, 0.1f, 0.15f);        // Shadow Fang's black dust (tab 2)
}

UHWBossSkillFxComponent::UHWBossSkillFxComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PostUpdateWork;   // after the player's camera framing of this frame
}

void UHWBossSkillFxComponent::BeginPlay()
{
    Super::BeginPlay();
    Boss = Cast<AHWBossCharacter>(GetOwner());
    if (!Boss) return;
    Boss->OnBossParried.AddUniqueDynamic(this, &UHWBossSkillFxComponent::HandleParried);
    Boss->OnBossRiposte.AddUniqueDynamic(this, &UHWBossSkillFxComponent::HandleRiposte);
    Boss->OnBossStateChanged.AddUniqueDynamic(this, &UHWBossSkillFxComponent::HandleState);
    Boss->OnBossBeat.AddUniqueDynamic(this, &UHWBossSkillFxComponent::HandleBeat);
}

float UHWBossSkillFxComponent::FloorZ() const
{
    const UCapsuleComponent* C = Boss ? Boss->GetCapsuleComponent() : nullptr;
    return Boss ? Boss->GetActorLocation().Z - (C ? C->GetScaledCapsuleHalfHeight() : 0.f) : 0.f;
}

FVector UHWBossSkillFxComponent::ChestPoint() const
{
    const UHWBossPresentationComponent* P = Boss->FindComponentByClass<UHWBossPresentationComponent>();
    const float Lift = P ? P->GetShownLiftCm() : 0.f;
    return FVector(Boss->GetActorLocation().X, Boss->GetActorLocation().Y, FloorZ() + Lift + 170.f);
}

void UHWBossSkillFxComponent::HandleParried(FName PatternId, int32 BeatIndex)
{
    AHWImpactFx* Fx = AHWImpactFx::Get(GetWorld());
    APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
    if (!Fx || !Pawn || !Boss) return;
    const double Now = GetWorld()->GetTimeSeconds();
    Streak = Now - LastParryAt < 0.6 ? Streak + 1 : 1;
    LastParryAt = Now;
    ++NParry;
    // where blade meets tendril: just in front of the player, at chest height, sides alternating with the streak
    const FVector ToBoss = (Boss->GetActorLocation() - Pawn->GetActorLocation()).GetSafeNormal2D();
    const FVector Side = FVector::CrossProduct(ToBoss, FVector::UpVector) * ((Streak % 2) ? 18.f : -18.f);
    const FVector At = Pawn->GetActorLocation() + ToBoss * 75.f + Side + FVector(0.f, 0.f, 45.f);
    const float Scale = FMath::Min(1.4f, 1.f + 0.05f * (Streak - 1));
    Fx->Sparks(At, (-ToBoss + FVector(0.f, 0.f, 0.6f)).GetSafeNormal(), FMath::RoundToInt(14 * Scale), SparkWhite, 950.f * Scale, 75.f, 0.2f, 500.f, 2.2f);
    Fx->Needles(At, FMath::RoundToInt(8 * Scale), SparkWhite, 700.f * Scale, 0.14f);
    if (Streak >= 3) Fx->LensStreak(At, SparkWhite, 260.f * Scale);
    Shake(0.08f, 3.f);
}

void UHWBossSkillFxComponent::HandleRiposte(float Damage)
{
    AHWImpactFx* Fx = AHWImpactFx::Get(GetWorld());
    if (!Fx || !Boss) return;
    ++NRiposte;
    const FVector At(Boss->GetActorLocation().X, Boss->GetActorLocation().Y, FloorZ() + 60.f);
    Fx->LensStreak(At, Blood, 900.f);
    Fx->Sparks(At, FVector::UpVector, 30, Blood, 1300.f, 70.f, 0.35f, 900.f, 2.6f);
    Fx->Needles(At, 16, FLinearColor(1.f, 0.75f, 0.3f), 900.f, 0.2f);
    ScreenFlash(Blood, 0.3f, 0.06f);
    Shake(0.3f, 10.f);
    ZoomLeft = 1.2f;   // in 0.25 s, held, out over the last 0.4 s
}

void UHWBossSkillFxComponent::HandleState(EHWBossState NewState, FName PatternId)
{
    if (NewState == EHWBossState::Tell)
    {
        DangerPattern = PatternId;
        DangerFired.Reset();
    }
    if (NewState != EHWBossState::Break || !Boss) return;
    AHWImpactFx* Fx = AHWImpactFx::Get(GetWorld());
    if (!Fx) return;
    ++NBreak;
    const FVector At = ChestPoint();
    Fx->LensStreak(At, FLinearColor::White, 1100.f);
    Fx->Needles(At, 24, FLinearColor(1.f, 0.95f, 0.85f), 1000.f, 0.22f);
    ScreenFlash(FLinearColor::White, 0.4f, 0.08f);
    Shake(0.25f, 9.f);
    const UHWBossPresentationComponent* P = Boss->FindComponentByClass<UHWBossPresentationComponent>();
    bWatchLanding = P && P->GetShownLiftCm() > 50.f;   // broken in the air: it will hit the floor
}

void UHWBossSkillFxComponent::HandleBeat(FName PatternId, int32 BeatIndex)
{
    // a beat that reaches out from an inner edge is a blast on the ground out in front (the Clave's chain): draw it
    // where it lands, at the middle of its band (animatic clave_shut: orange blasts 0.12 s apart, walking out)
    const FHWBossPatternSpec& S = Boss->GetCurrentPattern();
    if (!S.Beats.IsValidIndex(BeatIndex)) return;
    const FHWBossBeatSpec& B = S.Beats[BeatIndex];
    AHWImpactFx* Fx = AHWImpactFx::Get(GetWorld());
    if (!Fx) return;
    const FLinearColor Fire(1.f, 0.48f, 0.14f);
    if (B.MinRangeCm > 0.f)
    {
        ++NBlast;
        const FVector C = Boss->GetActorLocation() + Boss->GetActorForwardVector() * (0.5f * (B.MinRangeCm + B.RangeCm));
        const FVector At(C.X, C.Y, FloorZ() + 20.f);
        Fx->Puff(At, 6, Fire, 90.f, 0.45f, 70.f, 120.f);
        Fx->Sparks(At, FVector::UpVector, 16, Fire, 900.f, 55.f, 0.35f, 980.f, 2.4f);
        Fx->Debris(At, 6, 500.f, false, FloorZ());
        Fx->Crack(At, 110.f, 1.6f);
        Shake(0.1f, 4.f);
    }
    else if (B.bBig && !S.bCounterable)
    {
        // a heavy shut blow on the ground in front: the crash
        const FVector C = Boss->GetActorLocation() + Boss->GetActorForwardVector() * (0.5f * B.RangeCm);
        const FVector At(C.X, C.Y, FloorZ() + 10.f);
        Fx->Needles(At, 18, Fire, 900.f, 0.18f, 0.1f);
        Fx->Puff(At, 8, Dust, 110.f, 0.7f, 120.f, 40.f);
        Fx->Crack(At, 160.f, 2.f);
        Shake(0.2f, 8.f);
    }
}

void UHWBossSkillFxComponent::Shake(float Seconds, float AmplitudeCm)
{
    if (AmplitudeCm >= ShakeAmp * (ShakeLeft / FMath::Max(0.001f, ShakeTotal)))
    {
        ShakeLeft = ShakeTotal = Seconds;
        ShakeAmp = AmplitudeCm;
    }
}

void UHWBossSkillFxComponent::ScreenFlash(const FLinearColor& Color, float Alpha, float Seconds)
{
    if (APlayerCameraManager* M = UGameplayStatics::GetPlayerCameraManager(this, 0))
    {
        M->StartCameraFade(Alpha, 0.f, Seconds, Color, false, false);
    }
}

void UHWBossSkillFxComponent::TickDanger()
{
    // red-orange cues for the beats that cannot be parried (motion study tab 4): a move that says so (danger_cue),
    // or the shut beats inside a parriable move (Shadow Fang's dive)
    const FHWBossPatternSpec& S = Boss->GetCurrentPattern();
    const float T = Boss->GetPatternTime();
    if (T < 0.f || S.Id != DangerPattern) return;
    AHWImpactFx* Fx = AHWImpactFx::Get(GetWorld());
    if (!Fx) return;
    for (int32 K = 0; K < S.Beats.Num(); ++K)
    {
        const FHWBossBeatSpec& B = S.Beats[K];
        const bool bShut = !B.bCounterable || !S.bCounterable;
        if (!bShut || !(S.bDangerCue || S.bCounterable)) continue;
        if (K > 0 && !(S.Beats[K - 1].bCounterable && S.bCounterable)) continue;   // one cue per run of shut beats
        const float Hit = S.TellDuration + B.At;
        const float Cues[3] = { Hit - 0.85f, Hit - 0.63f, Hit - 0.5f };
        for (int32 C = 0; C < 3; ++C)
        {
            if (T < Cues[C] || DangerFired.Contains(K * 4 + C)) continue;
            DangerFired.Add(K * 4 + C);
            if (C < 2)
            {
                const FVector Chest = ChestPoint();
                Fx->LensStreak(Chest, Danger, 520.f);
                Fx->Sparks(Chest, FVector::UpVector, 24, Danger, 420.f, 180.f, 0.12f, 0.f, 4.f);
                Fx->Needles(Chest, 16, Danger, 600.f, 0.12f, 0.f);
            }
            else
            {
                ++NDanger;
                // where it lands: under the boss (a dive) or a step in front (a crash), radius = the beat's reach
                const bool bDive = Boss->GetPatternLiftCm() > 50.f;
                const FVector Centre = Boss->GetActorLocation() + (bDive ? FVector::ZeroVector : Boss->GetActorForwardVector() * B.RangeCm * 0.5f);
                const float R = bDive ? B.RangeCm : B.RangeCm * 0.5f;
                // the turning ring arcs around the boss at the reach (readable from any camera), embers on the edge
                Fx->Rings(Boss, Danger, bDive ? B.RangeCm : B.RangeCm, Hit - T + 0.1f, FloorZ() + 4.f);
                for (int32 I = 0; I < 28; ++I)
                {
                    const float A = 2.f * PI * I / 28.f;
                    const FVector P(Centre.X + R * FMath::Cos(A), Centre.Y + R * FMath::Sin(A), FloorZ() + 2.f);
                    Fx->Embers(P, 3, Danger, 24.f, Hit - T + 0.15f);
                }
            }
        }
    }
}

void UHWBossSkillFxComponent::TickCamera(float DeltaTime)
{
    APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
    UCameraComponent* Cam = Pawn ? Pawn->FindComponentByClass<UCameraComponent>() : nullptr;
    if (Cam != Camera.Get())
    {
        Camera = Cam;
        BaseFov = Cam ? Cam->FieldOfView : -1.f;
        CameraBase = Cam ? Cam->GetRelativeLocation() : FVector::ZeroVector;
    }
    if (!Cam) return;
    // shake: a decaying jitter on the camera's own offset (no shake asset needed)
    if (ShakeLeft > 0.f)
    {
        ShakeLeft = FMath::Max(0.f, ShakeLeft - DeltaTime);
        const float K = ShakeAmp * (ShakeLeft / FMath::Max(0.001f, ShakeTotal));
        const float Tm = GetWorld()->GetRealTimeSeconds();
        Cam->SetRelativeLocation(CameraBase + FVector(0.f, FMath::Sin(Tm * 173.f) * K, FMath::Cos(Tm * 151.f) * K * 0.7f));
    }
    else if (!Cam->GetRelativeLocation().Equals(CameraBase, 0.1f))
    {
        Cam->SetRelativeLocation(CameraBase);
    }
    // riposte close-up: field of view x0.72, in over 0.25 s, out over the last 0.4 s
    if (ZoomLeft > 0.f)
    {
        ZoomLeft = FMath::Max(0.f, ZoomLeft - DeltaTime);
        const float Into = FMath::Clamp((1.2f - ZoomLeft) / 0.25f, 0.f, 1.f);
        const float Out = FMath::Clamp(ZoomLeft / 0.4f, 0.f, 1.f);
        ZoomAmount = FMath::Min(Into, Out);
    }
    else
    {
        ZoomAmount = 0.f;
    }
    if (BaseFov > 0.f)
    {
        Cam->SetFieldOfView(BaseFov * (1.f - 0.28f * FMath::SmoothStep(0.f, 1.f, ZoomAmount)));
    }
}

void UHWBossSkillFxComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    if (!Boss || Boss->IsDead()) return;
    TickDanger();
    TickCamera(DeltaTime);
    // a blink: smoke where the body leaves and where it comes back (animatic clave_shut: 0.3 s / 0.5 s)
    const bool bHidden = Boss->IsBlinkHidden();
    if (bHidden != bWasBlinkHidden)
    {
        bWasBlinkHidden = bHidden;
        if (AHWImpactFx* Fx = AHWImpactFx::Get(GetWorld()))
        {
            ++NSmoke;
            const FVector At(Boss->GetActorLocation().X, Boss->GetActorLocation().Y, FloorZ() + 120.f);
            Fx->Puff(At, 14, FLinearColor(0.2f, 0.17f, 0.15f), 140.f, 0.6f, 90.f, 60.f);
            Fx->Needles(At, 10, FLinearColor(0.9f, 0.6f, 0.3f), 500.f, 0.12f, 0.2f);
        }
    }
    if (bWatchLanding)
    {
        const UHWBossPresentationComponent* P = Boss->FindComponentByClass<UHWBossPresentationComponent>();
        const float Lift = P ? P->GetShownLiftCm() : 0.f;
        if (Lift < 5.f)
        {
            bWatchLanding = false;
            ++NLand;
            if (AHWImpactFx* Fx = AHWImpactFx::Get(GetWorld()))
            {
                const FVector At(Boss->GetActorLocation().X, Boss->GetActorLocation().Y, FloorZ() + 10.f);
                Fx->Puff(At, 14, Dust, 120.f, 0.9f, 200.f, 20.f);
                Fx->Debris(At, 10, 600.f, false, FloorZ());
                Fx->Crack(At, 180.f, 2.f);
                Shake(0.15f, 7.f);
            }
        }
    }
}

FString UHWBossSkillFxComponent::Describe() const
{
    return FString::Printf(TEXT("skillfx parry %d break %d land %d riposte %d danger %d blast %d smoke %d"), NParry, NBreak, NLand, NRiposte, NDanger, NBlast, NSmoke);
}
