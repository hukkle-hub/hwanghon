#include "Character/HWAinCharacter.h"
#include "GameFramework/PlayerInput.h"
#include "GameFramework/PlayerController.h"
#include "Character/HWHeadSteadyMeshComponent.h"
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
    : Super(FObjectInitializer::Get().SetDefaultSubobjectClass<UHWHeadSteadyMeshComponent>(ACharacter::MeshComponentName))
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

    // Bodies never pull the camera in: with Kain half a step behind her, the arm collapsed into her back (doc 138).
    GetCapsuleComponent()->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);
    GetMesh()->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);

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
    if (APlayerController* PC = Cast<APlayerController>(GetController()))
    {
        if (PC->PlayerInput)
        {
            PC->PlayerInput->AddAxisMapping(FInputAxisKeyMapping(TEXT("HWLookYaw"), EKeys::MouseX, 1.f));
            PC->PlayerInput->AddAxisMapping(FInputAxisKeyMapping(TEXT("HWLookYaw"), EKeys::Gamepad_RightX, 2.5f));
            PC->PlayerInput->AddAxisMapping(FInputAxisKeyMapping(TEXT("HWLookPitch"), EKeys::MouseY, -1.f));
            PC->PlayerInput->AddAxisMapping(FInputAxisKeyMapping(TEXT("HWLookPitch"), EKeys::Gamepad_RightY, -2.5f));
        }
        if (PC->PlayerCameraManager)
        {
            PC->PlayerCameraManager->ViewPitchMin = -70.f;   // look up at a 16 m tower, down over a ledge
            PC->PlayerCameraManager->ViewPitchMax = 55.f;
        }
    }
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
    float WantSize = 1.f;
    if (bLocked)
    {
        FVector Origin, Extent;
        LockOn->GetTarget()->GetActorBounds(true, Origin, Extent);
        WantSize = FMath::Clamp(Extent.Z * 2.f / FramingReferenceHeightCm, 1.f, 4.f);
    }
    TargetSize = FMath::FInterpTo(TargetSize, WantSize, DeltaSeconds, FramingBlendSpeed * 0.5f);
    const float Big = (TargetSize - 1.f) * LockFraming;
    CameraBoom->TargetArmLength = FMath::Lerp(FreeArmLength, LockedArmLength, LockFraming) + BigTargetArmPerSize * Big;
    CameraBoom->SocketOffset = FMath::Lerp(FreeSocketOffset, LockedSocketOffset, LockFraming) + FVector(0.f, 0.f, BigTargetRisePerSize * Big);
    FollowCamera->SetRelativeRotation(FRotator(0.f, LockedCameraYaw * LockFraming, 0.f));

    // The whole boss in frame (docs/design/165): QA saw the 2.5 m Clave whole in only 11 % of a fight - the arm was
    // 2 m behind Ain. The distance that fits the body's height (with a 30 % margin) in the vertical field of view;
    // if the camera is closer than that, the arm grows by the difference.
    static const bool bNoFraming = FParse::Param(FCommandLine::Get(), TEXT("HWNoFraming"));   // before/after QA
    float WantFit = 0.f;
    if (bLocked && !bNoFraming)
    {
        FVector O, E;
        LockOn->GetTarget()->GetActorBounds(true, O, E);
        const float VFov = 2.f * FMath::Atan(FMath::Tan(FMath::DegreesToRadians(FollowCamera->FieldOfView * 0.5f)) * 9.f / 16.f);
        const float Need = 2.f * E.Z * 1.3f / (2.f * FMath::Tan(VFov * 0.5f));
        const float Have = FVector::Dist2D(GetActorLocation(), O) + CameraBoom->TargetArmLength;
        WantFit = FMath::Clamp(Need - Have, 0.f, 650.f);
    }
    FitExtraArm = FMath::FInterpTo(FitExtraArm, WantFit, DeltaSeconds, 3.f);
    CameraBoom->TargetArmLength += FitExtraArm * LockFraming;

    // Ain herself in front of the boss (close fights: EP16's shadow fang behind her back): slide the camera further
    // over her shoulder until the line to the boss's centre clears her body.
    float WantSide = 0.f;
    if (bLocked && !bNoFraming)
    {
        FVector O, E;
        LockOn->GetTarget()->GetActorBounds(true, O, E);
        // on screen, not by a trace against her mesh (that never hit): Ain's column overlapping the boss's centre
        bool bSelfBlocks = false;
        if (const APlayerController* PC = Cast<APlayerController>(GetController()))
        {
            int32 W = 0, H = 0;
            PC->GetViewportSize(W, H);
            FVector2D Me, It;
            if (W > 0 && PC->ProjectWorldLocationToScreen(GetActorLocation(), Me, true)
                && PC->ProjectWorldLocationToScreen(O, It, true))
            {
                bSelfBlocks = FMath::Abs(Me.X - It.X) < W * (SideShift > 1.f ? SelfOcclusionScreenFrac * 1.7f : SelfOcclusionScreenFrac);   // hysteresis
            }
        }
        WantSide = bSelfBlocks ? SelfOcclusionSideCm : 0.f;
    }
    SideShift = FMath::FInterpTo(SideShift, WantSide, DeltaSeconds, WantSide > SideShift ? 6.f : 1.5f);
    CameraBoom->SocketOffset.Y += SideShift * LockFraming;

    // Allies between the camera and the boss step out of the picture while they block it (then come back 0.3 s after).
    const float Now = GetWorld()->GetTimeSeconds();
    if (bLocked && !bNoFraming)
    {
        AActor* T = LockOn->GetTarget();
        FVector O, E;
        T->GetActorBounds(true, O, E);
        const FVector Cam = FollowCamera->GetComponentLocation();
        FCollisionObjectQueryParams Obj(ECC_Pawn);
        FCollisionQueryParams Q(TEXT("HWAllyOcclusion"), false, this);
        Q.AddIgnoredActor(T);
        for (const FVector& Aim : { O, O + FVector(0, 0, E.Z * 0.7f), O - FVector(0, 0, E.Z * 0.7f) })
        {
            TArray<FHitResult> Hits;
            GetWorld()->LineTraceMultiByObjectType(Hits, Cam, Aim, Obj, Q);
            for (const FHitResult& H : Hits)
            {
                AActor* A = H.GetActor();
                if (A && A != this && A != T && !A->IsAttachedTo(T) && Cast<APawn>(A))
                {
                    OccludingAllies.FindOrAdd(A) = Now;
                }
            }
        }
    }
    for (auto It = OccludingAllies.CreateIterator(); It; ++It)
    {
        AActor* A = It.Key().Get();
        const bool bBlocking = A && Now - It.Value() < 0.3f;
        if (A) A->SetActorHiddenInGame(bBlocking);
        if (!bBlocking) It.RemoveCurrent();
    }
}

void AHWAinCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    PlayerInputComponent->BindAxis(TEXT("MoveForward"), this, &AHWAinCharacter::MoveForward);
    PlayerInputComponent->BindAxis(TEXT("MoveRight"), this, &AHWAinCharacter::MoveRight);
    // Free camera, Blade & Soul style (docs/design/165): yaw and pitch under the player's hand, lock-on only assists.
    PlayerInputComponent->BindAxis(TEXT("HWLookYaw"), this, &AHWAinCharacter::LookYaw);
    PlayerInputComponent->BindAxis(TEXT("HWLookPitch"), this, &AHWAinCharacter::LookPitch);
    PlayerInputComponent->BindTouch(IE_Pressed, this, &AHWAinCharacter::LookTouchPressed);
    PlayerInputComponent->BindTouch(IE_Repeat, this, &AHWAinCharacter::LookTouchMoved);
    PlayerInputComponent->BindTouch(IE_Released, this, &AHWAinCharacter::LookTouchReleased);

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
void AHWAinCharacter::InteractPressed(){ if (NetworkBridge) NetworkBridge->SendInteract(); OnLocalInteract.Broadcast(); }
void AHWAinCharacter::GuardPressed(){ if (NetworkBridge) NetworkBridge->SetGuard(true); }
void AHWAinCharacter::GuardReleased(){ if (NetworkBridge) NetworkBridge->SetGuard(false); }
void AHWAinCharacter::OpeningPressed(){ if (NetworkBridge) NetworkBridge->SendOpening(); }
void AHWAinCharacter::ExecutePressed(){ if (NetworkBridge) NetworkBridge->SendExecute(); }


// ------------------------------------------------------------------ free camera (docs/design/165)
static bool HWMouseLooking(const APlayerController* PC)
{
    // with the cursor shown the mouse also clicks the HUD: turn the view while the right button is held
    return !PC || !PC->bShowMouseCursor || PC->IsInputKeyDown(EKeys::RightMouseButton);
}

void AHWAinCharacter::LookYaw(float Value)
{
    if (Value == 0.f) return;
    const APlayerController* PC = Cast<APlayerController>(GetController());
    if (!HWMouseLooking(PC) && !PC->IsInputKeyDown(EKeys::Gamepad_RightX)) return;
    AddControllerYawInput(Value);
    LastManualLook = GetWorld()->GetTimeSeconds();
}

void AHWAinCharacter::LookPitch(float Value)
{
    if (Value == 0.f) return;
    const APlayerController* PC = Cast<APlayerController>(GetController());
    if (!HWMouseLooking(PC) && !PC->IsInputKeyDown(EKeys::Gamepad_RightY)) return;
    AddControllerPitchInput(Value);
    LastManualLook = GetWorld()->GetTimeSeconds();
}

bool AHWAinCharacter::IsLookZone(const FVector& Screen) const
{
    // the phone's thumbs: the move stick lives bottom-left, the action buttons bottom-right - drags elsewhere turn it
    int32 W = 0, H = 0;
    if (const APlayerController* PC = Cast<APlayerController>(GetController())) PC->GetViewportSize(W, H);
    if (W <= 0 || H <= 0) return false;
    const float X = Screen.X / W, Y = Screen.Y / H;
    if (X < 0.35f && Y > 0.45f) return false;
    if (X > 0.62f && Y > 0.42f) return false;
    return Y > 0.08f;   // not the top bars
}

void AHWAinCharacter::LookTouchPressed(ETouchIndex::Type Finger, FVector Location)
{
    if (LookFinger == -1 && IsLookZone(Location))
    {
        LookFinger = (int32)Finger;
        LookTouchLast = FVector2D(Location);
    }
}

void AHWAinCharacter::LookTouchMoved(ETouchIndex::Type Finger, FVector Location)
{
    if ((int32)Finger != LookFinger) return;
    const FVector2D D = FVector2D(Location) - LookTouchLast;
    LookTouchLast = FVector2D(Location);
    AddControllerYawInput(D.X * TouchLookDegPerPx);
    AddControllerPitchInput(-D.Y * TouchLookDegPerPx);
    LastManualLook = GetWorld()->GetTimeSeconds();
}

void AHWAinCharacter::LookTouchReleased(ETouchIndex::Type Finger, FVector Location)
{
    if ((int32)Finger == LookFinger) LookFinger = -1;
}

float AHWAinCharacter::SecondsSinceManualLook() const
{
    return GetWorld() ? GetWorld()->GetTimeSeconds() - LastManualLook : 1e9f;
}
