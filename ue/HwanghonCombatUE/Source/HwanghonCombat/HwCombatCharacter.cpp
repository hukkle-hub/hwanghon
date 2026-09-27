#include "HwCombatCharacter.h"
#include "HwCombatRules.h"
#include "HwBossGraybox.h"
#include "HwCombatAudit.h"
#include "HwanghonCombat.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Components/CapsuleComponent.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimMontage.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputAction.h"
#include "InputMappingContext.h"
#include "InputActionValue.h"
#include "Kismet/GameplayStatics.h"
#include "EngineUtils.h"

static const float CM = 100.f; // m → cm

AHwCombatCharacter::AHwCombatCharacter()
{
	PrimaryActorTick.bCanEverTick = true;
	GetCapsuleComponent()->InitCapsuleSize(34.f, 90.f);
	bUseControllerRotationYaw = false;
	GetCharacterMovement()->bOrientRotationToMovement = true;
	GetCharacterMovement()->RotationRate = FRotator(0.f, 720.f, 0.f);
	GetCharacterMovement()->MaxWalkSpeed = 420.f;   // 4.2 m/s (three.js 달리기 근처, 근거 없음)
	Boom = CreateDefaultSubobject<USpringArmComponent>(TEXT("Boom"));
	Boom->SetupAttachment(RootComponent);
	Boom->TargetArmLength = CameraDistance;
	Boom->SocketOffset = FVector(0.f, 55.f, 70.f);  // 어깨 너머, 아인이 화면 왼쪽 1/3
	Boom->bUsePawnControlRotation = false;
	Boom->bEnableCameraLag = true; Boom->CameraLagSpeed = 12.f;
	Boom->bEnableCameraRotationLag = true; Boom->CameraRotationLagSpeed = LockOnYawLag;
	Boom->bDoCollisionTest = true;
	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(Boom, USpringArmComponent::SocketName);
	Camera->FieldOfView = CameraFOV;

	// Enhanced Input 자산을 코드로 (텍스트 저장소에 .uasset 을 못 넣으므로)
	Mapping = CreateDefaultSubobject<UInputMappingContext>(TEXT("IMC_Combat"));
	IA_Move = CreateDefaultSubobject<UInputAction>(TEXT("IA_Move")); IA_Move->ValueType = EInputActionValueType::Axis2D;
	IA_Attack = CreateDefaultSubobject<UInputAction>(TEXT("IA_Attack"));
	IA_Smash = CreateDefaultSubobject<UInputAction>(TEXT("IA_Smash"));
	IA_Dodge = CreateDefaultSubobject<UInputAction>(TEXT("IA_Dodge"));
	IA_Jump = CreateDefaultSubobject<UInputAction>(TEXT("IA_Jump"));
	IA_Counter = CreateDefaultSubobject<UInputAction>(TEXT("IA_Counter"));
	IA_LockOn = CreateDefaultSubobject<UInputAction>(TEXT("IA_LockOn"));
	// 키보드 검수용 매핑 (모바일 패드는 UMG 버튼이 Input* 함수를 직접 부른다)
	Mapping->MapKey(IA_Move, EKeys::W); Mapping->MapKey(IA_Move, EKeys::S); Mapping->MapKey(IA_Move, EKeys::A); Mapping->MapKey(IA_Move, EKeys::D);
	Mapping->MapKey(IA_Attack, EKeys::J); Mapping->MapKey(IA_Attack, EKeys::LeftMouseButton);
	Mapping->MapKey(IA_Smash, EKeys::K); Mapping->MapKey(IA_Smash, EKeys::RightMouseButton);
	Mapping->MapKey(IA_Dodge, EKeys::LeftShift); Mapping->MapKey(IA_Jump, EKeys::SpaceBar);
	Mapping->MapKey(IA_Counter, EKeys::L); Mapping->MapKey(IA_LockOn, EKeys::Tab);

	// 원본 clipContacts (js/dungeons.js) — 몽타주가 바뀌면 해당 몽타주의 접점 비율로 갱신
	ClipContactFrac.Add(TEXT("attack1"), 0.38f); ClipContactFrac.Add(TEXT("attack2"), 0.52f); ClipContactFrac.Add(TEXT("attack3"), 0.48f);
	ClipContactFrac.Add(TEXT("smash"), 0.30f); ClipContactFrac.Add(TEXT("counter"), 0.44f);
}

void AHwCombatCharacter::BeginPlay()
{
	Super::BeginPlay();
	Rules = UHwCombatRulesAsset::Get();
	St = Rules->stamina.max; HP = MaxHP;
	Boom->TargetArmLength = CameraDistance; Camera->FieldOfView = CameraFOV; Boom->CameraRotationLagSpeed = LockOnYawLag;
	if (APlayerController* PC = Cast<APlayerController>(GetController()))
		if (UEnhancedInputLocalPlayerSubsystem* Sub = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
			Sub->AddMappingContext(Mapping, 0);
	for (TActorIterator<AHwBossGraybox> It(GetWorld()); It; ++It) { Target = *It; break; }
}

void AHwCombatCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	if (UEnhancedInputComponent* EIC = Cast<UEnhancedInputComponent>(PlayerInputComponent))
	{
		EIC->BindAction(IA_Move, ETriggerEvent::Triggered, this, &AHwCombatCharacter::OnMove);
		EIC->BindAction(IA_Move, ETriggerEvent::Completed, this, &AHwCombatCharacter::OnMove);
		EIC->BindAction(IA_Attack, ETriggerEvent::Started, this, &AHwCombatCharacter::InputAttack);
		EIC->BindAction(IA_Smash, ETriggerEvent::Started, this, &AHwCombatCharacter::InputSmash);
		EIC->BindAction(IA_Dodge, ETriggerEvent::Started, this, &AHwCombatCharacter::InputDodge);
		EIC->BindAction(IA_Jump, ETriggerEvent::Started, this, &AHwCombatCharacter::InputJump);
		EIC->BindAction(IA_Counter, ETriggerEvent::Started, this, &AHwCombatCharacter::InputCounter);
		EIC->BindAction(IA_LockOn, ETriggerEvent::Started, this, &AHwCombatCharacter::InputLockOn);
	}
}

void AHwCombatCharacter::OnMove(const FInputActionValue& V)
{
	const FVector2D Raw = V.Get<FVector2D>();
	// WASD 를 축으로: W/S 는 Y, A/D 는 X — MapKey 로는 modifier 를 못 붙였으므로 키 상태로 조합한다
	MoveInput = FVector2D::ZeroVector;
	if (const APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		MoveInput.Y = (PC->IsInputKeyDown(EKeys::W) ? 1.f : 0.f) - (PC->IsInputKeyDown(EKeys::S) ? 1.f : 0.f);
		MoveInput.X = (PC->IsInputKeyDown(EKeys::D) ? 1.f : 0.f) - (PC->IsInputKeyDown(EKeys::A) ? 1.f : 0.f);
	}
	if (MoveInput.IsNearlyZero() && !Raw.IsNearlyZero()) MoveInput = Raw;
}

float AHwCombatCharacter::Speed() const { return FMath::Clamp(AttackSpeed / 100.f, 0.7f, 1.6f); /* rhythm.ain.dur = 1.0 */ }

bool AHwCombatCharacter::CanCancel(bool bDefensive) const
{
	if (!Action.IsValid()) return true;
	return Action.elapsed >= (bDefensive ? Action.defCancelAt : Action.cancelAt);
}

void AHwCombatCharacter::Queue(const FString& Type)
{
	if (!Action.IsValid()) return;
	const bool bDef = (Type == TEXT("dodge") || Type == TEXT("jump") || Type == TEXT("counter"));
	const float Edge = bDef ? Action.defCancelAt : Action.duration;
	if (Edge - Action.elapsed <= Rules->inputBuffer) { BufferType = Type; BufferTTL = Rules->inputBuffer + 0.02f; }
}

void AHwCombatCharacter::StartAction(const FString& Kind, const FString& Clip, float Mult, int32 Tier)
{
	const FHwActionTiming T = Rules->GetTiming(Clip);
	const float Sp = Speed();
	Action = FHwAction();
	Action.id = ++Serial; Action.kind = Kind; Action.clip = Clip; Action.mult = Mult; Action.tier = Tier; Action.combo = Combo;
	Action.hitAt = T.hit / Sp; Action.activeEnd = (T.hit + T.active) / Sp; Action.duration = T.duration / Sp; Action.cancelAt = T.cancel / Sp;
	Action.defCancelAt = FMath::Min(T.cancel / Sp, (T.hit + T.active) / Sp + Rules->defCancel / Sp);
	if (Target && bLockOn) { FVector D = Target->GetActorLocation() - GetActorLocation(); D.Z = 0.f; if (!D.IsNearlyZero()) SetActorRotation(D.Rotation()); }
	PlayClip(Clip);
	UHwCombatAudit::Event(this, TEXT("actionstart"), Action, Target ? Target->StateName() : TEXT(""));
}

void AHwCombatCharacter::CancelAction(const FString& Reason)
{
	if (!Action.IsValid()) return;
	UHwCombatAudit::Event(this, TEXT("actioncancel"), Action, Reason);
	if (UAnimInstance* AI = GetMesh()->GetAnimInstance()) AI->Montage_Stop(0.05f);
	Action = FHwAction(); Combo = 0; ComboT = 0.f;
}

void AHwCombatCharacter::PlayClip(const FString& Clip)
{
	UAnimMontage* const* M = Montages.Find(Clip);
	UAnimInstance* AI = GetMesh() ? GetMesh()->GetAnimInstance() : nullptr;
	if (!M || !*M || !AI) return;   // 그레이박스: 몽타주 없이 시간표만
	// «접점 리타임» — 몽타주의 접점 순간(ClipContactFrac × 길이)이 정확히 hitAt 에 오도록 앞 구간 속도를 정한다.
	const float Len = (*M)->GetPlayLength();
	const float Frac = ClipContactFrac.Contains(Clip) ? ClipContactFrac[Clip] : 0.42f;
	const float Rate1 = FMath::Max(0.05f, (Frac * Len) / FMath::Max(0.01f, Action.hitAt));
	// 공격 blend in: 평타 .050 · smash .085 (문서 116 §9) — 몽타주 자체 blend 는 0 으로 두고 여기서 준다
	AI->Montage_Play(*M, Rate1, EMontagePlayReturnType::MontageLength, 0.f, true);
}

void AHwCombatCharacter::RetimeAtContact()
{
	if (Action.retimed) return; Action.retimed = true;
	UAnimMontage* const* M = Montages.Find(Action.clip);
	UAnimInstance* AI = GetMesh() ? GetMesh()->GetAnimInstance() : nullptr;
	if (!M || !*M || !AI) return;
	const float Len = (*M)->GetPlayLength();
	const float Frac = ClipContactFrac.Contains(Action.clip) ? ClipContactFrac[Action.clip] : 0.42f;
	const float Rate2 = FMath::Max(0.05f, ((1.f - Frac) * Len) / FMath::Max(0.01f, Action.duration - Action.hitAt));
	AI->Montage_SetPlayRate(*M, Rate2);
}

void AHwCombatCharacter::InputAttack()
{
	if (InputCounterInternal()) return;
	if (Action.IsValid()) { Queue(TEXT("attack")); return; }
	if (LockT > 0.f || DodgeT > 0.f || JumpT > 0.f) return;
	if (ComboT <= 0.f) Combo = 0;
	const int32 N = FMath::Max(1, Rules->combo.mults.Num());
	const int32 Index = Combo % N;
	const float Mult = Rules->combo.mults.IsValidIndex(Index) ? Rules->combo.mults[Index] : 1.f;
	StartAction(TEXT("attack"), FString::Printf(TEXT("attack%d"), (Index % 3) + 1), Mult, 0);
	Combo = Index + 1; ComboT = Action.duration + Rules->combo.gap;
}

void AHwCombatCharacter::InputSmash()
{
	if (Action.IsValid()) { Queue(TEXT("smash")); return; }
	if (LockT > 0.f || DodgeT > 0.f || JumpT > 0.f) return;
	const int32 Tier = ComboT > 0.f ? FMath::Max(0, Combo - 1) : 0;
	const float Cost = Rules->combo.smashSt.IsValidIndex(Tier) ? Rules->combo.smashSt[Tier] : 10.f;
	if (St < Cost) return;
	St -= Cost; StDelay = Rules->stamina.delay;
	const float Mult = Rules->combo.smash.IsValidIndex(Tier) ? Rules->combo.smash[Tier] : 1.6f;
	StartAction(TEXT("smash"), TEXT("smash"), Mult, Tier);
	Combo = 0; ComboT = 0.f;
}

void AHwCombatCharacter::InputDodge()
{
	if (Action.IsValid() && !CanCancel(true)) { Queue(TEXT("dodge")); return; }
	if (DodgeT > 0.f || DodgeCd > 0.f || LockT > 0.f || St < Rules->stamina.dodge) return;
	if (Action.IsValid()) CancelAction(TEXT("dodge"));
	St -= Rules->stamina.dodge; StDelay = Rules->stamina.delay;
	DodgeT = Rules->dodge.iframes; DodgeCd = Rules->dodge.cooldown;
	FVector Dir = FVector(MoveInput.Y, MoveInput.X, 0.f);
	if (Dir.IsNearlyZero()) Dir = -GetActorForwardVector(); else Dir = Camera->GetComponentRotation().Vector() * 0.f + FRotator(0.f, Camera->GetComponentRotation().Yaw, 0.f).RotateVector(Dir);
	DodgeDir = Dir.GetSafeNormal2D();
	UHwCombatAudit::Event(this, TEXT("dodge"), Action, Target ? Target->StateName() : TEXT(""));
	PlayClip(TEXT("dodge"));
}

void AHwCombatCharacter::InputJump()
{
	if (Action.IsValid() && !CanCancel(true)) { Queue(TEXT("jump")); return; }
	if (JumpT > 0.f || JumpCd > 0.f || LockT > 0.f || St < Rules->jump.st) return;
	if (Action.IsValid()) CancelAction(TEXT("jump"));
	St -= Rules->jump.st; StDelay = Rules->stamina.delay;
	JumpT = Rules->jump.dur; JumpCd = Rules->jump.cooldown;
	// 규칙: dur 안에 height 까지 올랐다 내려온다 — 물리 점프 대신 결정론 포물선 (판정은 JumpT 로만)
	LaunchCharacter(FVector(0.f, 0.f, 2.f * Rules->jump.height * CM / FMath::Max(0.1f, Rules->jump.dur)), false, true);
	UHwCombatAudit::Event(this, TEXT("jump"), Action, TEXT(""));
	PlayClip(TEXT("jump"));
}

bool AHwCombatCharacter::InputCounterInternal()
{
	if (!Target || Target->GetState() != EHwBossState::Telegraph) return false;
	const FHwBossPattern* P = Target->CurrentPattern();
	const float Tele = Target->TeleLeft();
	const float Win = Target->CounterWindow();
	if (!P || !P->counterable || Tele <= 0.f || Tele > Win || LockT > 0.f || DodgeT > 0.f || !CanCancel(true)) return false;
	CancelAction(TEXT("counter")); BufferType.Empty();
	// 3 단: tele ≤ perfect → clash(2) / ≤ mid → repel(1) / 그 밖 → deflect(0). 창이 넓어지면 경계도 같은 비율
	const float Scale = Win / FMath::Max(0.01f, Rules->counter.window);
	const int32 Tier = Tele <= Rules->counter.perfect * Scale ? 2 : (Tele <= Rules->counter.mid * Scale ? 1 : 0);
	Target->Countered(Tier, *P);
	StartAction(TEXT("counter"), TEXT("counter"), Tier == 2 ? Rules->counter.perfectMult : (Tier == 1 ? Rules->counter.mult : Rules->counter.deflectMult), Tier);
	UHwCombatAudit::Event(this, TEXT("counter"), Action, FString::Printf(TEXT("tier=%d tele=%.3f"), Tier, Tele));
	return true;
}

void AHwCombatCharacter::InputCounter() { InputCounterInternal(); }
void AHwCombatCharacter::InputLockOn() { bLockOn = !bLockOn; }

void AHwCombatCharacter::Consume()
{
	if (BufferType.IsEmpty()) return;
	const FString T = BufferType; BufferType.Empty(); BufferTTL = 0.f;
	if (T == TEXT("attack")) InputAttack(); else if (T == TEXT("smash")) InputSmash(); else if (T == TEXT("dodge")) InputDodge(); else if (T == TEXT("jump")) InputJump(); else if (T == TEXT("counter")) InputCounter();
}

void AHwCombatCharacter::Contact()
{
	Action.resolved = true;
	RetimeAtContact();
	if (!Target || Target->GetState() == EHwBossState::Dead) return;
	const float GapM = (Target->GetActorLocation() - GetActorLocation()).Size2D() / CM - Target->BodyRadiusM() - GetCapsuleComponent()->GetScaledCapsuleRadius() / CM;
	const bool bHit = GapM <= ReachM;
	UHwCombatAudit::Event(this, bHit ? TEXT("hit") : TEXT("whiff"), Action, Target->StateName());
	if (!bHit) return;
	EHwReactTier Tier = EHwReactTier::Light; float Stop = Rules->hitstop.light;
	if (Action.kind == TEXT("smash")) { Tier = EHwReactTier::Smash; Stop = Rules->hitstop.smash; }
	else if (Action.kind == TEXT("counter")) { Tier = EHwReactTier::Counter; Stop = Action.tier == 2 ? Rules->hitstop.perfect : Rules->hitstop.counter; }
	else if (Action.clip == TEXT("attack3")) { Tier = EHwReactTier::Finisher; Stop = Rules->hitstop.chain; }
	const float Posture = Action.kind == TEXT("smash") && Rules->combo.smashPosture.IsValidIndex(Action.tier) ? Rules->combo.smashPosture[Action.tier] : 0.f;
	Target->ReceiveHit(Action.mult * 1000.f /* 아인 기본 공격력 자리 — CHARS 스탯은 slice 밖 */, Posture, Tier, GetActorLocation());
	Hitstop = Stop; Target->SetHitstop(Stop);
}

bool AHwCombatCharacter::ReceiveBossHit(float Damage, bool bJumpOnly, const FString& PatternName)
{
	if (DodgeT > 0.f) return false;                 // 회피 무적 — 규칙 그대로
	if (bJumpOnly && JumpT > 0.f) return false;     // 바닥 광역은 점프로만
	HP = FMath::Max(0.f, HP - Damage);
	const bool bHeavy = Damage >= Rules->stagger.heavyAt * MaxHP;
	const FHwStaggerTier& S = bHeavy ? Rules->stagger.heavy : Rules->stagger.light;
	CancelAction(TEXT("hit"));
	LockT = FMath::Max(LockT, S.lock); Hitstop = Rules->hitstop.hurt;
	FVector Push = GetActorLocation() - (Target ? Target->GetActorLocation() : GetActorLocation()); Push.Z = 0.f;
	LaunchCharacter(Push.GetSafeNormal() * (S.push / Rules->worldScalePxPerM) * CM / FMath::Max(0.05f, S.dur), true, false);
	PlayClip(bHeavy ? TEXT("hit2") : TEXT("hit"));
	UHwCombatAudit::Event(this, TEXT("playerhit"), Action, PatternName);
	return true;
}

void AHwCombatCharacter::Tick(float Dt)
{
	Super::Tick(Dt);
	if (!Rules) return;
	// 히트스톱: 판정 시계는 멈추고 카메라·입력만 산다 (몽타주도 멈춘다)
	if (Hitstop > 0.f) { Hitstop -= Dt; if (UAnimInstance* AI = GetMesh()->GetAnimInstance()) AI->Montage_SetPlayRate(AI->GetCurrentActiveMontage(), Hitstop > 0.f ? 0.f : 1.f); if (Hitstop > 0.f) { TickCamera(Dt); return; } if (Action.IsValid()) { Action.retimed = false; RetimeAtContact(); } }
	for (float* T : { &DodgeCd, &JumpCd, &LockT, &StDelay, &ComboT, &RiposteT }) *T = FMath::Max(0.f, *T - Dt);
	if (DodgeT > 0.f) { DodgeT -= Dt; AddMovementInput(DodgeDir, 1.f); GetCharacterMovement()->MaxWalkSpeed = 3.4f * CM / FMath::Max(0.05f, Rules->dodge.iframes); }
	else GetCharacterMovement()->MaxWalkSpeed = 420.f;
	if (JumpT > 0.f) JumpT -= Dt;
	if (StDelay <= 0.f) St = FMath::Min(Rules->stamina.max, St + Rules->stamina.regen * Dt);
	if (BufferTTL > 0.f) { BufferTTL -= Dt; if (BufferTTL <= 0.f) BufferType.Empty(); }

	if (Action.IsValid())
	{
		Action.elapsed = FMath::Min(Action.duration, Action.elapsed + Dt);
		if (!Action.resolved && Action.elapsed + 1e-6f >= Action.hitAt) Contact();
		if (!BufferType.IsEmpty())
		{
			const bool bDef = (BufferType == TEXT("dodge") || BufferType == TEXT("jump") || BufferType == TEXT("counter"));
			if (bDef ? CanCancel(true) : Action.elapsed + 1e-6f >= Action.cancelAt) Consume();
		}
		if (Action.IsValid() && Action.elapsed + 1e-6f >= Action.duration)
		{
			UHwCombatAudit::Event(this, TEXT("actionend"), Action, Target ? Target->StateName() : TEXT(""));
			Action = FHwAction();
			Consume();   // P4 이음매: 같은 tick 에 다음 행동이 있으면 idle 을 거치지 않는다
		}
	}
	else if (DodgeT <= 0.f && LockT <= 0.f && !MoveInput.IsNearlyZero())
	{
		const FRotator Yaw(0.f, Camera->GetComponentRotation().Yaw, 0.f);
		AddMovementInput(Yaw.RotateVector(FVector(MoveInput.Y, MoveInput.X, 0.f)).GetSafeNormal2D(), 1.f);
	}
	TickCamera(Dt);
}

void AHwCombatCharacter::TickCamera(float Dt)
{
	// 락온: 카메라 요우만 표적을 향한다. 줌·흔들림·FOV 펌프 없음 (문서 118 §14). 큰 기술 임펄스는 뒤 단계.
	if (!Target || !bLockOn) return;
	FVector D = Target->GetActorLocation() - GetActorLocation(); D.Z = 0.f;
	if (D.IsNearlyZero()) return;
	const FRotator Want(-14.f, D.Rotation().Yaw, 0.f);
	Boom->SetWorldRotation(FMath::RInterpTo(Boom->GetComponentRotation(), Want, Dt, LockOnYawLag));
}
