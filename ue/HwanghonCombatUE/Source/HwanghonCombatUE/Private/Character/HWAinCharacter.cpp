#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Camera/HWLockOnComponent.h"
#include "Animation/HWPlayerPresentationComponent.h"
#include "Boss/HWBossCharacter.h"
#include "Audit/HWCombatAuditActor.h"
#include "Kismet/GameplayStatics.h"
#include "Graphics/HWGraphicsQualitySubsystem.h"
#include "Engine/GameInstance.h"
#include "Engine/Engine.h"

#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/SpringArmComponent.h"

AHWAinCharacter::AHWAinCharacter()
{
    PrimaryActorTick.bCanEverTick = true;

    GetCapsuleComponent()->InitCapsuleSize(42.f, 92.f);

    bUseControllerRotationPitch = false;
    bUseControllerRotationRoll = false;
    bUseControllerRotationYaw = false;

    GetCharacterMovement()->bOrientRotationToMovement = true;
    GetCharacterMovement()->RotationRate = FRotator(0.f, 720.f, 0.f);
    GetCharacterMovement()->MaxWalkSpeed = 520.f;
    GetCharacterMovement()->JumpZVelocity = 560.f;
    GetCharacterMovement()->AirControl = 0.25f;

    CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
    CameraBoom->SetupAttachment(RootComponent);
    CameraBoom->TargetArmLength = 420.f;
    CameraBoom->SocketOffset = FVector(0.f, 65.f, 70.f);
    CameraBoom->bUsePawnControlRotation = true;
    CameraBoom->bEnableCameraLag = true;
    CameraBoom->CameraLagSpeed = 12.f;

    FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
    FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
    FollowCamera->bUsePawnControlRotation = false;
    FollowCamera->FieldOfView = 52.f;

    Combat = CreateDefaultSubobject<UHWCombatComponent>(TEXT("Combat"));
    LockOn = CreateDefaultSubobject<UHWLockOnComponent>(TEXT("LockOn"));
    Presentation = CreateDefaultSubobject<UHWPlayerPresentationComponent>(TEXT("Presentation"));
}

void AHWAinCharacter::BeginPlay()
{
    Super::BeginPlay();

    Combat->OnActionStarted.AddDynamic(this, &AHWAinCharacter::HandleActionStarted);
    Combat->OnActionEnded.AddDynamic(this, &AHWAinCharacter::HandleActionEnded);
    Combat->OnContact.AddDynamic(this, &AHWAinCharacter::HandleContact);
}

void AHWAinCharacter::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (LockOn->IsLocked() && LockOn->GetTarget())
    {
        GetCharacterMovement()->bOrientRotationToMovement = false;
        const FVector ToTarget = LockOn->GetTarget()->GetActorLocation() - GetActorLocation();
        FRotator Desired = ToTarget.Rotation();
        Desired.Pitch = 0.f;
        Desired.Roll = 0.f;
        SetActorRotation(FMath::RInterpTo(GetActorRotation(), Desired, DeltaSeconds, 14.f));
    }
    else
    {
        GetCharacterMovement()->bOrientRotationToMovement = true;
    }
}

void AHWAinCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    PlayerInputComponent->BindAxis(TEXT("MoveForward"), this, &AHWAinCharacter::MoveForward);
    PlayerInputComponent->BindAxis(TEXT("MoveRight"), this, &AHWAinCharacter::MoveRight);

    PlayerInputComponent->BindAction(TEXT("Attack"), IE_Pressed, this, &AHWAinCharacter::AttackPressed);
    PlayerInputComponent->BindAction(TEXT("Smash"), IE_Pressed, this, &AHWAinCharacter::SmashPressed);
    PlayerInputComponent->BindAction(TEXT("Dodge"), IE_Pressed, this, &AHWAinCharacter::DodgePressed);
    PlayerInputComponent->BindAction(TEXT("CombatJump"), IE_Pressed, this, &AHWAinCharacter::CombatJumpPressed);
    PlayerInputComponent->BindAction(TEXT("Counter"), IE_Pressed, this, &AHWAinCharacter::CounterPressed);
    PlayerInputComponent->BindAction(TEXT("LockOn"), IE_Pressed, this, &AHWAinCharacter::LockOnPressed);
    PlayerInputComponent->BindAction(TEXT("SaveAudit"), IE_Pressed, this, &AHWAinCharacter::SaveAuditPressed);
    PlayerInputComponent->BindAction(TEXT("GraphicsLow"), IE_Pressed, this, &AHWAinCharacter::GraphicsLowPressed);
    PlayerInputComponent->BindAction(TEXT("GraphicsMid"), IE_Pressed, this, &AHWAinCharacter::GraphicsMidPressed);
    PlayerInputComponent->BindAction(TEXT("GraphicsHigh"), IE_Pressed, this, &AHWAinCharacter::GraphicsHighPressed);
    PlayerInputComponent->BindAction(TEXT("PerfCapture"), IE_Pressed, this, &AHWAinCharacter::PerfCapturePressed);
}

void AHWAinCharacter::MoveForward(float Value)
{
    if (Controller && !FMath::IsNearlyZero(Value))
    {
        const FRotator YawRotation(0.f, Controller->GetControlRotation().Yaw, 0.f);
        AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X), Value);
    }
}

void AHWAinCharacter::MoveRight(float Value)
{
    if (Controller && !FMath::IsNearlyZero(Value))
    {
        const FRotator YawRotation(0.f, Controller->GetControlRotation().Yaw, 0.f);
        AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y), Value);
    }
}

void AHWAinCharacter::AttackPressed()
{
    Combat->RequestAttack();
}

void AHWAinCharacter::SmashPressed()
{
    Combat->RequestSmash();
}

void AHWAinCharacter::DodgePressed()
{
    Combat->RequestDodge();
}

void AHWAinCharacter::CombatJumpPressed()
{
    Combat->RequestJump();
}

void AHWAinCharacter::CounterPressed()
{
    Combat->RequestCounter();
}

void AHWAinCharacter::LockOnPressed()
{
    LockOn->ToggleLockOn();
}

void AHWAinCharacter::HandleActionStarted(EHWActionType Action)
{
    if (Action == EHWActionType::Dodge)
    {
        LaunchCharacter(GetActorForwardVector() * 780.f, false, false);
    }
    else if (Action == EHWActionType::Jump)
    {
        Jump();
    }

    BP_OnCombatActionStarted(Action);
}

void AHWAinCharacter::HandleActionEnded(EHWActionType Action)
{
    if (Action == EHWActionType::Jump)
    {
        StopJumping();
    }

    BP_OnCombatActionEnded(Action);
}

void AHWAinCharacter::HandleContact(EHWActionType Action, EHWAttackTier Tier, float Damage)
{
    BP_OnPlayerContact(Action, Tier);

    AActor* Target = LockOn->GetTarget();
    AHWBossCharacter* Boss = Cast<AHWBossCharacter>(Target);
    if (!Boss)
    {
        return;
    }

    const float Distance = FVector::Dist2D(GetActorLocation(), Boss->GetActorLocation());
    const float Range = Action == EHWActionType::Smash ? 300.f : 260.f;
    if (Distance <= Range)
    {
        Boss->ReceivePlayerHit(Damage, Tier, GetActorLocation());
        const float HitStop =
            Tier == EHWAttackTier::Smash ? 0.21f :
            Tier == EHWAttackTier::Finisher ? 0.13f : 0.09f;
        Combat->ApplyHitStop(HitStop);
        Boss->ApplyHitStop(HitStop);
    }
}


void AHWAinCharacter::SaveAuditPressed()
{
    if (AHWCombatAuditActor* Audit = Cast<AHWCombatAuditActor>(
        UGameplayStatics::GetActorOfClass(this, AHWCombatAuditActor::StaticClass())))
    {
        Audit->SaveNow();
    }
}


void AHWAinCharacter::GraphicsLowPressed()
{
    if (UGameInstance* GI = GetGameInstance())
    {
        if (UHWGraphicsQualitySubsystem* Graphics = GI->GetSubsystem<UHWGraphicsQualitySubsystem>())
        {
            Graphics->ApplyTier(EHWGraphicsTier::Low, false);
        }
    }
}

void AHWAinCharacter::GraphicsMidPressed()
{
    if (UGameInstance* GI = GetGameInstance())
    {
        if (UHWGraphicsQualitySubsystem* Graphics = GI->GetSubsystem<UHWGraphicsQualitySubsystem>())
        {
            Graphics->ApplyTier(EHWGraphicsTier::Mid, false);
        }
    }
}

void AHWAinCharacter::GraphicsHighPressed()
{
    if (UGameInstance* GI = GetGameInstance())
    {
        if (UHWGraphicsQualitySubsystem* Graphics = GI->GetSubsystem<UHWGraphicsQualitySubsystem>())
        {
            Graphics->ApplyTier(EHWGraphicsTier::High, false);
        }
    }
}


void AHWAinCharacter::PerfCapturePressed()
{
#if !UE_BUILD_SHIPPING
    if (GEngine && GetWorld())
    {
        // 1800 frames ≈ 30 seconds at 60 fps. UE writes to Saved/Profiling/CSV.
        GEngine->Exec(GetWorld(), TEXT("csvprofile frames=1800"));
    }
#endif
}
