#include "HwBossGraybox.h"
#include "HwCombatCharacter.h"
#include "HwCombatAudit.h"
#include "HwanghonCombat.h"
#include "Components/CapsuleComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimMontage.h"
#include "Kismet/GameplayStatics.h"
#include "UObject/ConstructorHelpers.h"

static const float CM = 100.f;

AHwBossGraybox::AHwBossGraybox()
{
	PrimaryActorTick.bCanEverTick = true;
	Capsule = CreateDefaultSubobject<UCapsuleComponent>(TEXT("Capsule"));
	Capsule->InitCapsuleSize(BodyRadius * CM, 1.7f * Scale * CM * 0.5f);
	RootComponent = Capsule;
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Sphere(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	Body = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Body"));
	Body->SetupAttachment(RootComponent);
	if (Cube.Succeeded()) Body->SetStaticMesh(Cube.Object);
	Body->SetRelativeScale3D(FVector(0.9f, 1.4f, 3.2f) * Scale * 0.55f);
	Body->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Core = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Core"));
	Core->SetupAttachment(RootComponent);
	if (Sphere.Succeeded()) Core->SetStaticMesh(Sphere.Object);
	Core->SetRelativeLocation(FVector(BodyRadius * CM * 0.9f, 0.f, 0.35f * Scale * CM));
	Core->SetRelativeScale3D(FVector(0.32f * Scale));
	Core->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Mesh = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("Mesh"));
	Mesh->SetupAttachment(RootComponent);
}

const FHwBossStage* AHwBossGraybox::Stage() const
{
	return Rules && Rules->boss.stages.IsValidIndex(StageIndex) ? &Rules->boss.stages[StageIndex] : nullptr;
}

void AHwBossGraybox::BeginPlay()
{
	Super::BeginPlay();
	Rules = UHwCombatRulesAsset::Get();
	if (const FHwBossStage* S = Stage()) { HP = S->hp; GapT = S->patternGap > 0.f ? S->patternGap : 1.2f; }
	Player = Cast<AHwCombatCharacter>(UGameplayStatics::GetPlayerPawn(GetWorld(), 0));
}

FString AHwBossGraybox::StateName() const
{
	switch (State) { case EHwBossState::Idle: return TEXT("idle"); case EHwBossState::Telegraph: return TEXT("telegraph"); case EHwBossState::Strike: return TEXT("attack");
		case EHwBossState::Recover: return TEXT("recover"); case EHwBossState::Stagger: return TEXT("stagger"); case EHwBossState::Downed: return TEXT("downed"); default: return TEXT("dead"); }
}

float AHwBossGraybox::CounterWindow() const
{
	const FHwBossStage* S = Stage();
	return (S && S->counterWindow > 0.f) ? S->counterWindow : (Rules ? Rules->counter.window : 0.25f);
}

void AHwBossGraybox::PlayClip(const FString& Clip, float Rate)
{
	UAnimMontage* const* M = Montages.Find(Clip);
	UAnimInstance* AI = Mesh ? Mesh->GetAnimInstance() : nullptr;
	if (M && *M && AI) AI->Montage_Play(*M, Rate);
}

void AHwBossGraybox::BeginPattern()
{
	const FHwBossStage* S = Stage();
	if (!S || S->patterns.Num() == 0) return;
	Pattern = S->patterns[PatternCursor % S->patterns.Num()]; PatternCursor++;
	State = EHwBossState::Telegraph; Tele = Pattern.tele; bContactDone = false;
	if (Player) { FVector D = Player->GetActorLocation() - GetActorLocation(); D.Z = 0.f; if (!D.IsNearlyZero()) SetActorRotation(D.Rotation()); }
	// tell 몽타주는 tele 길이에 맞춰 재생 (compression 은 몽타주 안의 마지막 30 %)
	if (UAnimMontage* const* M = Montages.Find(Pattern.name + TEXT(":tell"))) if (*M) PlayClip(Pattern.name + TEXT(":tell"), (*M)->GetPlayLength() / FMath::Max(0.05f, Pattern.tele));
	UHwCombatAudit::BossEvent(this, TEXT("telegraph"), Pattern.name, Tele);
}

void AHwBossGraybox::DoContact()
{
	bContactDone = true;
	if (!Player) return;
	const float Gap = (Player->GetActorLocation() - GetActorLocation()).Size2D() / CM - BodyRadius - 0.34f;
	const bool bInReach = Pattern.lunge ? true : Gap <= ReachM;   // 관통 돌진은 경로가 곧 판정
	if (bInReach)
	{
		const bool bHit = Player->ReceiveBossHit(Pattern.dmg, Pattern.jumpOnly, Pattern.name);
		UHwCombatAudit::BossEvent(this, bHit ? TEXT("bosshit") : TEXT("bossmiss"), Pattern.name, Gap);
	}
}

void AHwBossGraybox::ReceiveHit(float Damage, float PostureAdd, EHwReactTier Tier, const FVector& From)
{
	if (State == EHwBossState::Dead) return;
	HP = FMath::Max(0.f, HP - Damage * (State == EHwBossState::Downed && Rules ? Rules->posture.downMult : 1.f));
	Posture = FMath::Clamp(Posture + PostureAdd, 0.f, Rules ? Rules->posture.max : 100.f);
	// additive 반동 — 위계별 세기(m). 공격 몽타주는 끊지 않는다. 값은 문서 116 P0(hit .42/.20 ·좌우) 근처, 근거 없음
	const float Amp = Tier == EHwReactTier::Light ? 0.06f : Tier == EHwReactTier::Finisher ? 0.11f : Tier == EHwReactTier::Smash ? 0.16f : 0.22f;
	FVector Dir = GetActorLocation() - From; Dir.Z = 0.f; Dir = Dir.GetSafeNormal();
	const FVector Side = FVector::CrossProduct(FVector::UpVector, Dir) * ((PatternCursor & 1) ? 1.f : -1.f);
	ReactVel += (Dir * 0.7f + Side * 0.3f) * Amp * CM * 18.f;
	UHwCombatAudit::BossEvent(this, TEXT("bossreact"), StateName(), Amp);
	if (Posture >= (Rules ? Rules->posture.max : 100.f) && State != EHwBossState::Downed)
	{
		State = EHwBossState::Downed; DownT = Rules ? Rules->posture.downDur : 5.f; Posture = 0.f; Tele = 0.f;
		UHwCombatAudit::BossEvent(this, TEXT("down"), TEXT(""), DownT);
	}
	if (HP <= 0.f) { State = EHwBossState::Dead; UHwCombatAudit::BossEvent(this, TEXT("dead"), TEXT(""), 0.f); }
}

void AHwBossGraybox::Countered(int32 Tier, const FHwBossPattern& P)
{
	const float TP = Tier == 2 ? 1.5f : Tier == 1 ? 1.0f : 0.47f;   // tierPosture clash/repel/deflect (JSON counter.tierPosture)
	Posture = FMath::Clamp(Posture + (P.posture > 0.f ? P.posture : (Rules ? Rules->counter.posture : 30.f)) * TP, 0.f, Rules ? Rules->posture.max : 100.f);
	State = EHwBossState::Stagger; StagT = Tier == 2 ? 1.0f : Tier == 1 ? 0.8f : 0.55f; Tele = 0.f;
	ReactVel += -GetActorForwardVector() * (Tier == 2 ? 0.5f : 0.3f) * CM * 18.f;
	UHwCombatAudit::BossEvent(this, TEXT("countered"), P.name, (float)Tier);
	if (Posture >= (Rules ? Rules->posture.max : 100.f)) { State = EHwBossState::Downed; DownT = Rules ? Rules->posture.downDur : 5.f; Posture = 0.f; }
}

void AHwBossGraybox::Tick(float Dt)
{
	Super::Tick(Dt);
	// additive 반동은 히트스톱과 무관하게 스프링으로 돌아온다 (그레이박스: 메시 오프셋)
	ReactVel += (-React * 220.f - ReactVel * 18.f) * Dt; React += ReactVel * Dt;
	Body->SetRelativeLocation(React + FVector(0.f, 0.f, 0.f));
	if (Hitstop > 0.f) { Hitstop -= Dt; return; }
	if (!Rules || State == EHwBossState::Dead) return;
	switch (State)
	{
	case EHwBossState::Idle:
		GapT -= Dt; if (GapT <= 0.f) BeginPattern(); break;
	case EHwBossState::Telegraph:
		Tele -= Dt;
		if (Tele <= 0.f)
		{
			State = EHwBossState::Strike; StrikeT = 0.f;
			StrikeFrom = GetActorLocation();
			StrikeTo = StrikeFrom + GetActorForwardVector() * Pattern.motion.distanceM * CM;
			if (Pattern.motion.distanceM > 0.f && Player) { const float Stop = Pattern.motion.stopM * CM; const FVector ToP = Player->GetActorLocation() - StrikeFrom; if (!Pattern.lunge && ToP.Size2D() - Stop < Pattern.motion.distanceM * CM) StrikeTo = StrikeFrom + ToP.GetSafeNormal2D() * FMath::Max(0.f, ToP.Size2D() - Stop); }
			PlayClip(Pattern.name + TEXT(":strike"));
			UHwCombatAudit::BossEvent(this, TEXT("strike"), Pattern.name, Pattern.window);
		}
		break;
	case EHwBossState::Strike:
	{
		StrikeT += Dt;
		const float U = FMath::Clamp(StrikeT / FMath::Max(0.05f, Pattern.window), 0.f, 1.f);
		if (Pattern.motion.distanceM > 0.f) { const float M = Pattern.lunge ? U : FMath::Min(1.f, U / FMath::Max(0.05f, Pattern.motion.at)); SetActorLocation(FMath::Lerp(StrikeFrom, StrikeTo, FMath::InterpEaseOut(0.f, 1.f, M, 2.f)), true); }
		if (!bContactDone && U + 1e-6f >= Pattern.motion.at) DoContact();
		if (Pattern.lunge && !bContactDone) { if (Player && (Player->GetActorLocation() - GetActorLocation()).Size2D() / CM < BodyRadius + 0.34f) DoContact(); }
		if (U >= 1.f) { if (!bContactDone) DoContact(); State = EHwBossState::Recover; RecoverT = RecoveryDur; PlayClip(Pattern.name + TEXT(":recover")); }
		break;
	}
	case EHwBossState::Recover:
		RecoverT -= Dt; if (RecoverT <= 0.f) { State = EHwBossState::Idle; GapT = Stage() && Stage()->patternGap > 0.f ? Stage()->patternGap : 1.2f; } break;   // idle «자세» 는 없다: recover 끝 자세에서 다음 tell 로 (몽타주가 그렇게 이어야 함)
	case EHwBossState::Stagger:
		StagT -= Dt; if (StagT <= 0.f) { State = EHwBossState::Recover; RecoverT = 0.3f; } break;
	case EHwBossState::Downed:
		DownT -= Dt; if (DownT <= 0.f) { State = EHwBossState::Recover; RecoverT = 0.6f; } break;
	default: break;
	}
}
