#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Camera/HWLockOnComponent.h"
#include "Animation/HWPlayerPresentationComponent.h"
#include "Animation/HWCharacterVisualSettings.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "System/HWCombatTargetInterface.h"
#include "Network/HWNetworkCombatBridgeComponent.h"
#include "System/HWCoopCombatSubsystem.h"
#include "System/HWCoopLifeComponent.h"
#include "System/HWCharacterKitComponent.h"
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
    // Free framing; Tick blends to the locked-on framing (see the header, docs/design/137).
    CameraBoom->TargetArmLength = FreeArmLength;
    CameraBoom->SocketOffset = FreeSocketOffset;
    CameraBoom->bUsePawnControlRotation = true;
    CameraBoom->bEnableCameraLag = true;
    CameraBoom->CameraLagSpeed = 12.f;

    FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
    FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
    FollowCamera->bUsePawnControlRotation = false;
    FollowCamera->FieldOfView = 70.f;

    Combat = CreateDefaultSubobject<UHWCombatComponent>(TEXT("Combat"));
    LockOn = CreateDefaultSubobject<UHWLockOnComponent>(TEXT("LockOn"));
    Presentation = CreateDefaultSubobject<UHWPlayerPresentationComponent>(TEXT("Presentation"));
    CharacterKit = CreateDefaultSubobject<UHWCharacterKitComponent>(TEXT("CharacterKit"));
    CoopLife = CreateDefaultSubobject<UHWCoopLifeComponent>(TEXT("CoopLife"));
    NetworkBridge = CreateDefaultSubobject<UHWNetworkCombatBridgeComponent>(TEXT("NetworkBridge"));
}

void AHWAinCharacter::BeginPlay()
{
    // A pawn spawned from code (GameMode sortie, online raid) has no body yet: wear the configured
    // one before the components (presentation reads the anim instance) begin play.
    if (GetMesh() && !GetMesh()->GetSkeletalMeshAsset())
    {
        UHWAnimationSetAsset* Set = UHWCharacterVisualSettings::ApplyTo(
            SystemCharacterId, GetMesh(), GetCapsuleComponent()->GetUnscaledCapsuleHalfHeight());
        if (Set && Presentation && !Presentation->AnimationSet)
        {
            Presentation->AnimationSet = Set;
        }
    }
    Super::BeginPlay();

    Combat->OnActionStarted.AddDynamic(this, &AHWAinCharacter::HandleActionStarted);
    Combat->OnActionEnded.AddDynamic(this, &AHWAinCharacter::HandleActionEnded);
    Combat->OnContact.AddDynamic(this, &AHWAinCharacter::HandleContact);
    CharacterKit->ConfigureCharacter(SystemCharacterId);
    if (UHWCoopCombatSubsystem* Coop = GetWorld()->GetSubsystem<UHWCoopCombatSubsystem>())
    {
        Coop->RegisterCombatant(this, SystemCharacterId);
    }
}

void AHWAinCharacter::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (UWorld* World = GetWorld())
    {
        if (UHWCoopCombatSubsystem* Coop = World->GetSubsystem<UHWCoopCombatSubsystem>())
        {
            Coop->UnregisterCombatant(this);
        }
    }
    Super::EndPlay(EndPlayReason);
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

    const bool bLocked = LockOn->IsLocked() && LockOn->GetTarget();
    LockFraming = FMath::FInterpTo(LockFraming, bLocked ? 1.f : 0.f, DeltaSeconds, FramingBlendSpeed);
    CameraBoom->TargetArmLength = FMath::Lerp(FreeArmLength, LockedArmLength, LockFraming);
    CameraBoom->SocketOffset = FMath::Lerp(FreeSocketOffset, LockedSocketOffset, LockFraming);
    FollowCamera->SetRelativeRotation(FRotator(0.f, LockedCameraYaw * LockFraming, 0.f));
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
    PlayerInputComponent->BindAction(TEXT("CycleTarget"), IE_Pressed, this, &AHWAinCharacter::CycleTargetPressed);
    PlayerInputComponent->BindAction(TEXT("SaveAudit"), IE_Pressed, this, &AHWAinCharacter::SaveAuditPressed);
    PlayerInputComponent->BindAction(TEXT("GraphicsLow"), IE_Pressed, this, &AHWAinCharacter::GraphicsLowPressed);
    PlayerInputComponent->BindAction(TEXT("GraphicsMid"), IE_Pressed, this, &AHWAinCharacter::GraphicsMidPressed);
    PlayerInputComponent->BindAction(TEXT("GraphicsHigh"), IE_Pressed, this, &AHWAinCharacter::GraphicsHighPressed);
    PlayerInputComponent->BindAction(TEXT("PerfCapture"), IE_Pressed, this, &AHWAinCharacter::PerfCapturePressed);
    PlayerInputComponent->BindAction(TEXT("Skill1"), IE_Pressed, this, &AHWAinCharacter::Skill1Pressed);
    PlayerInputComponent->BindAction(TEXT("Skill2"), IE_Pressed, this, &AHWAinCharacter::Skill2Pressed);
    PlayerInputComponent->BindAction(TEXT("Skill3"), IE_Pressed, this, &AHWAinCharacter::Skill3Pressed);
    PlayerInputComponent->BindAction(TEXT("Skill4"), IE_Pressed, this, &AHWAinCharacter::Skill4Pressed);
    PlayerInputComponent->BindAction(TEXT("Ultimate"), IE_Pressed, this, &AHWAinCharacter::UltimatePressed);
    PlayerInputComponent->BindAction(TEXT("Revive"), IE_Pressed, this, &AHWAinCharacter::RevivePressed);
    PlayerInputComponent->BindAction(TEXT("Revive"), IE_Released, this, &AHWAinCharacter::ReviveReleased);
    PlayerInputComponent->BindAction(TEXT("Interact"), IE_Pressed, this, &AHWAinCharacter::InteractPressed);
    PlayerInputComponent->BindAction(TEXT("Guard"), IE_Pressed, this, &AHWAinCharacter::GuardPressed);
    PlayerInputComponent->BindAction(TEXT("Guard"), IE_Released, this, &AHWAinCharacter::GuardReleased);
    PlayerInputComponent->BindAction(TEXT("Opening"), IE_Pressed, this, &AHWAinCharacter::OpeningPressed);
    PlayerInputComponent->BindAction(TEXT("Execute"), IE_Pressed, this, &AHWAinCharacter::ExecutePressed);
}

void AHWAinCharacter::MoveForward(float Value)
{
    if (NetworkBridge) NetworkBridge->SetMoveForward(Value);
    if (Controller && !FMath::IsNearlyZero(Value))
    {
        const FRotator YawRotation(0.f, Controller->GetControlRotation().Yaw, 0.f);
        AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X), Value);
    }
}

void AHWAinCharacter::MoveRight(float Value)
{
    if (NetworkBridge) NetworkBridge->SetMoveRight(Value);
    if (Controller && !FMath::IsNearlyZero(Value))
    {
        const FRotator YawRotation(0.f, Controller->GetControlRotation().Yaw, 0.f);
        AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y), Value);
    }
}

void AHWAinCharacter::AttackPressed()
{
    if (NetworkBridge) NetworkBridge->SendAttack();
    Combat->RequestAttack();
}

void AHWAinCharacter::SmashPressed()
{
    if (NetworkBridge) NetworkBridge->SendSmash();
    Combat->RequestSmash();
}

void AHWAinCharacter::DodgePressed()
{
    if (NetworkBridge) NetworkBridge->SendDodge();
    Combat->RequestDodge();
}

void AHWAinCharacter::CombatJumpPressed()
{
    if (NetworkBridge) NetworkBridge->SendJump();
    Combat->RequestJump();
}

void AHWAinCharacter::CounterPressed()
{
    if (NetworkBridge) NetworkBridge->SendCounter();
    Combat->RequestCounter();
}

void AHWAinCharacter::LockOnPressed()
{
    LockOn->ToggleLockOn();
}

void AHWAinCharacter::CycleTargetPressed()
{
    LockOn->CycleTarget();
}

void AHWAinCharacter::HandleActionStarted(EHWActionType Action)
{
    if (Combat->IsDead())
    {
        return;
    }
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
    if (Combat->IsDead())
    {
        return;
    }
    BP_OnPlayerContact(Action, Tier);
    if (Combat->IsDead())
    {
        return;
    }

    if (NetworkBridge && NetworkBridge->IsAuthoritativeRaid()) return;

    AActor* Target = LockOn->GetTarget();
    if (!Target || !Target->GetClass()->ImplementsInterface(UHWCombatTargetInterface::StaticClass()))
    {
        return;
    }

    const float Distance = FVector::Dist2D(GetActorLocation(), Target->GetActorLocation());
    const float Range = Action == EHWActionType::Smash ? 300.f : 260.f;
    if (Distance <= Range)
    {
        const bool bHit = IHWCombatTargetInterface::Execute_ReceiveSystemHit(
            Target, Damage, Tier, GetActorLocation(), this);
        if (!bHit) return;

        const float HitStop =
            Tier == EHWAttackTier::Smash ? 0.21f :
            Tier == EHWAttackTier::Finisher ? 0.13f : 0.09f;
        Combat->ApplyHitStop(HitStop);
        if (AHWBossCharacter* Boss = Cast<AHWBossCharacter>(Target))
        {
            Boss->ApplyHitStop(HitStop);
        }
        if (UHWCoopCombatSubsystem* Coop = GetWorld()->GetSubsystem<UHWCoopCombatSubsystem>())
        {
            const float ThreatMultiplier = SystemCharacterId == TEXT("kain") ? 1.25f : 1.f;
            Coop->AddThreatFromDamage(this, Damage, ThreatMultiplier);
        }
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


void AHWAinCharacter::SetSystemCharacterId(FName CharacterId)
{
    const FName Safe =
        (CharacterId == TEXT("ain") || CharacterId == TEXT("kain")
        || CharacterId == TEXT("ryu") || CharacterId == TEXT("sera"))
        ? CharacterId : FName(TEXT("ain"));
    if (SystemCharacterId == Safe) return;
    SystemCharacterId = Safe;
    if (CharacterKit) CharacterKit->ConfigureCharacter(SystemCharacterId);
}

void AHWAinCharacter::Skill1Pressed()
{
    if (NetworkBridge && NetworkBridge->SendSkill1()) return;
    if (CharacterKit) CharacterKit->RequestSkill1();
}

void AHWAinCharacter::Skill2Pressed()
{
    if (NetworkBridge && NetworkBridge->SendSkill2()) return;
    if (CharacterKit) CharacterKit->RequestSkill2();
}

void AHWAinCharacter::Skill3Pressed()
{
    if (NetworkBridge && NetworkBridge->SendSkill3()) return;
    if (CharacterKit) CharacterKit->RequestSkill3();
}

void AHWAinCharacter::Skill4Pressed()
{
    if (NetworkBridge && NetworkBridge->SendSkill4()) return;
    if (CharacterKit) CharacterKit->RequestSkill4();
}

void AHWAinCharacter::UltimatePressed()
{
    if (NetworkBridge && NetworkBridge->SendUltimate()) return;
    if (CharacterKit) CharacterKit->RequestUltimate();
}

void AHWAinCharacter::RevivePressed()
{
    if (NetworkBridge && NetworkBridge->BeginRevive()) return;
    UHWCoopCombatSubsystem* Coop = GetWorld() ? GetWorld()->GetSubsystem<UHWCoopCombatSubsystem>() : nullptr;
    if (!Coop) return;

    AHWAinCharacter* Best = nullptr;
    float BestDistanceSq = TNumericLimits<float>::Max();
    for (const FHWCoopCombatantView& View : Coop->GetCombatants())
    {
        AHWAinCharacter* Candidate = View.Character;
        if (!Candidate || Candidate == this) continue;
        UHWCoopLifeComponent* Life = Candidate->GetCoopLife();
        if (!Life || !Life->IsDowned()) continue;
        const float DistanceSq = FVector::DistSquared2D(GetActorLocation(), Candidate->GetActorLocation());
        if (DistanceSq < BestDistanceSq)
        {
            BestDistanceSq = DistanceSq;
            Best = Candidate;
        }
    }
    if (Best && Best->GetCoopLife())
    {
        Best->GetCoopLife()->StartRevive(this);
    }
}


void AHWAinCharacter::ReviveReleased(){ if (NetworkBridge) NetworkBridge->EndRevive(); }
void AHWAinCharacter::InteractPressed(){ if (NetworkBridge) NetworkBridge->SendInteract(); }
void AHWAinCharacter::GuardPressed(){ if (NetworkBridge) NetworkBridge->SetGuard(true); }
void AHWAinCharacter::GuardReleased(){ if (NetworkBridge) NetworkBridge->SetGuard(false); }
void AHWAinCharacter::OpeningPressed(){ if (NetworkBridge) NetworkBridge->SendOpening(); }
void AHWAinCharacter::ExecutePressed(){ if (NetworkBridge) NetworkBridge->SendExecute(); }
