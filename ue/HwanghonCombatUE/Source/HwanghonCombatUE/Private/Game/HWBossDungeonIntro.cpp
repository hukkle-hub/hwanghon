#include "Game/HWBossDungeonIntro.h"

#include "Boss/HWBossCharacter.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Character/HWImpactFx.h"
#include "Components/CapsuleComponent.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Kismet/KismetMathLibrary.h"
#include "UI/HWCombatHUD.h"

AHWBossDungeonIntro::AHWBossDungeonIntro()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickGroup = TG_PostUpdateWork;
}

AHWBossDungeonIntro* AHWBossDungeonIntro::Play(AHWBossCharacter* InBoss, const FText& InName, const FText& InPlace, bool bShort)
{
    if (!InBoss || !InBoss->GetWorld()) return nullptr;
    FActorSpawnParameters P;
    P.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    AHWBossDungeonIntro* Intro = InBoss->GetWorld()->SpawnActor<AHWBossDungeonIntro>(AHWBossDungeonIntro::StaticClass(), FTransform::Identity, P);
    if (Intro)
    {
        Intro->Boss = InBoss;
        Intro->Name = InName;
        Intro->Place = InPlace;
        Intro->Begin(bShort);
    }
    return Intro;
}

static void HWIntroCallout(UObject* Ctx, const FString& Word)
{
    APlayerController* PC = UGameplayStatics::GetPlayerController(Ctx, 0);
    if (AHWCombatHUD* Hud = PC ? Cast<AHWCombatHUD>(PC->GetHUD()) : nullptr)
    {
        if (UHWCombatHUDWidget* W = Hud->GetHUDWidget()) W->ShowCallout(Word);
    }
}

void AHWBossDungeonIntro::Begin(bool bShort)
{
    APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0);
    APawn* Pawn = PC ? PC->GetPawn() : nullptr;
    const FString Card = Place.IsEmpty() ? Name.ToString() : Name.ToString() + TEXT("\n") + Place.ToString();
    if (bShort || !PC || !Pawn)
    {
        // a retry: the name, no camera
        HWIntroCallout(this, Card);
        Destroy();
        return;
    }
    bPlaying = true;
    Boss->SetIntroHold(true);
    Pawn->DisableInput(PC);
    FActorSpawnParameters P;
    P.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    Camera = GetWorld()->SpawnActor<ACameraActor>(ACameraActor::StaticClass(), Pawn->GetActorLocation(), FRotator::ZeroRotator, P);
    if (Camera)
    {
        Camera->GetCameraComponent()->SetFieldOfView(55.f);
        Camera->GetCameraComponent()->bConstrainAspectRatio = false;
        Frame(0.f);
        PC->SetViewTargetWithBlend(Camera, 0.f);
    }
}

void AHWBossDungeonIntro::Frame(float T)
{
    APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
    if (!Camera || !Boss || !Pawn) return;
    const UCapsuleComponent* Cap = Boss->GetCapsuleComponent();
    const float Floor = Boss->GetActorLocation().Z - (Cap ? Cap->GetScaledCapsuleHalfHeight() : 100.f);
    const FVector B(Boss->GetActorLocation().X, Boss->GetActorLocation().Y, Floor);
    const FVector A = Pawn->GetActorLocation();
    FVector ToBoss = B - A;
    ToBoss.Z = 0.f;
    const FVector Fwd = ToBoss.GetSafeNormal();
    const FVector Side = FVector::CrossProduct(Fwd, FVector::UpVector);
    FVector From, At;
    if (T < WideEnd)
    {
        // over the shoulder, drifting in a little
        const float U = T / WideEnd;
        From = A - Fwd * (380.f - 60.f * U) + Side * 110.f + FVector(0.f, 0.f, 120.f);
        At = B + FVector(0.f, 0.f, 160.f);
    }
    else
    {
        // low and close on the boss, pushing in; held for the roar
        const float U = FMath::Clamp((T - WideEnd) / (CloseEnd - WideEnd), 0.f, 1.f);
        const float Ease = 1.f - FMath::Pow(1.f - U, 2.f);
        From = B - Fwd * (520.f - 110.f * Ease) - Side * 140.f + FVector(0.f, 0.f, 70.f);
        At = B + FVector(0.f, 0.f, 210.f);
    }
    if (T >= CloseEnd)
    {
        const float K = FMath::Clamp(1.f - (T - CloseEnd) / (RoarEnd - CloseEnd), 0.f, 1.f) * 9.f;
        From += FVector(0.f, FMath::Sin(T * 160.f) * K, FMath::Cos(T * 140.f) * K * 0.7f);
    }
    Camera->SetActorLocationAndRotation(From, UKismetMathLibrary::FindLookAtRotation(From, At));
}

void AHWBossDungeonIntro::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!bPlaying) return;
    if (!IsValid(Boss) || Boss->IsDead())
    {
        Finish();
        return;
    }
    Elapsed += DeltaSeconds;
    Frame(Elapsed);
    if (!bNameShown && Elapsed >= WideEnd + 0.25f)
    {
        bNameShown = true;
        HWIntroCallout(this, Place.IsEmpty() ? Name.ToString() : Name.ToString() + TEXT("\n") + Place.ToString());
    }
    if (!bRoared && Elapsed >= CloseEnd)
    {
        bRoared = true;
        Boss->PlayRoar();
        if (AHWImpactFx* Fx = AHWImpactFx::Get(GetWorld()))
        {
            const UCapsuleComponent* Cap = Boss->GetCapsuleComponent();
            const FVector Chest = Boss->GetActorLocation() + FVector(0.f, 0.f, (Cap ? Cap->GetScaledCapsuleHalfHeight() : 100.f) * 0.6f);
            Fx->LensStreak(Chest, FLinearColor(0.9f, 0.45f, 0.2f), 1100.f);
            Fx->Needles(Chest, 28, FLinearColor(1.f, 0.8f, 0.6f), 1100.f, 0.3f, 0.1f);
        }
    }
    if (Elapsed >= RoarEnd)
    {
        Finish();
    }
}

void AHWBossDungeonIntro::Finish()
{
    bPlaying = false;
    APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0);
    if (PC && PC->GetPawn())
    {
        PC->SetViewTargetWithBlend(PC->GetPawn(), 0.4f);
        PC->GetPawn()->EnableInput(PC);
    }
    if (IsValid(Boss)) Boss->SetIntroHold(false);
    if (Camera) Camera->SetLifeSpan(1.f);
    SetLifeSpan(0.6f);
    SetActorTickEnabled(false);
}
