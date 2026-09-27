// 아인 (첫 플레이어) — 규칙은 UHwCombatRulesAsset(JSON), 모션은 몽타주 + «접점 리타임» 한 가지 보정만.
// three.js combat.js 의 플레이어 쪽 상태기계를 같은 이름(action/buffer/combo/comboT/dodgeT/lockT)으로 옮겼다. 렌더/VFX 코드는 옮기지 않는다.
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "HwCombatTypes.h"
#include "HwCombatCharacter.generated.h"

class UInputAction; class UInputMappingContext; class USpringArmComponent; class UCameraComponent; class UAnimMontage;
class AHwBossGraybox; class UHwCombatRulesAsset;

UCLASS()
class HWANGHONCOMBAT_API AHwCombatCharacter : public ACharacter
{
	GENERATED_BODY()
public:
	AHwCombatCharacter();
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

	/* ---- 입력 (combat.js B.input 과 같은 이름) ---- */
	UFUNCTION(BlueprintCallable, Category="Hwanghon|Input") void InputAttack();
	UFUNCTION(BlueprintCallable, Category="Hwanghon|Input") void InputSmash();
	UFUNCTION(BlueprintCallable, Category="Hwanghon|Input") void InputDodge();
	UFUNCTION(BlueprintCallable, Category="Hwanghon|Input") void InputJump();
	UFUNCTION(BlueprintCallable, Category="Hwanghon|Input") void InputCounter();
	UFUNCTION(BlueprintCallable, Category="Hwanghon|Input") void InputLockOn();

	/* ---- 보스 → 플레이어 ---- */
	/** 보스 판정. 회피 무적(dodgeT)·jumpOnly 점프 중이면 false(맞지 않음). */
	UFUNCTION(BlueprintCallable, Category="Hwanghon") bool ReceiveBossHit(float Damage, bool bJumpOnly, const FString& PatternName);

	/* ---- 상태 읽기 (HUD·검수) ---- */
	UFUNCTION(BlueprintPure, Category="Hwanghon") const FHwAction& GetAction() const { return Action; }
	UFUNCTION(BlueprintPure, Category="Hwanghon") float GetStamina() const { return St; }
	UFUNCTION(BlueprintPure, Category="Hwanghon") float GetHP() const { return HP; }
	UFUNCTION(BlueprintPure, Category="Hwanghon") AHwBossGraybox* GetTarget() const { return Target; }
	UFUNCTION(BlueprintPure, Category="Hwanghon") bool IsDodging() const { return DodgeT > 0.f; }
	UFUNCTION(BlueprintPure, Category="Hwanghon") float GetHitstop() const { return Hitstop; }

	/** 몽타주 — 편집기에서 클립 이름별로 지정. 비어 있으면 그레이박스(몽타주 없이 시간표만 돈다). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Anim") TMap<FString, UAnimMontage*> Montages;
	/** 클립의 «접점 시각 비율»(0~1, 원본 clipContacts). 재생 속도를 접점 앞/뒤 두 구간으로 나눠 hitAt 에 맞춘다 — 유일한 런타임 모션 보정. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Anim") TMap<FString, float> ClipContactFrac;
	UPROPERTY(EditAnywhere, Category="Hwanghon|Camera") float CameraDistance = 360.f;   // cm — 전신 + 낫 호가 읽히는 거리 (근거 없음, 영상으로 조정)
	UPROPERTY(EditAnywhere, Category="Hwanghon|Camera") float CameraFOV = 60.f;
	UPROPERTY(EditAnywhere, Category="Hwanghon|Camera") float LockOnYawLag = 6.f;
	UPROPERTY(EditAnywhere, Category="Hwanghon") float ReachM = 1.6f;       // 평타 닿는 거리(중심 간격 − 반지름 합) — three.js 75 px = 1.5 m 근처
	UPROPERTY(EditAnywhere, Category="Hwanghon") float MaxHP = 24000.f;
	UPROPERTY(EditAnywhere, Category="Hwanghon") float AttackSpeed = 100.f; // aspd — speed = clamp(aspd/100, .7, 1.6) / rhythm(1.0)

protected:
	UPROPERTY(VisibleAnywhere) USpringArmComponent* Boom;
	UPROPERTY(VisibleAnywhere) UCameraComponent* Camera;
	UPROPERTY() UInputMappingContext* Mapping;
	UPROPERTY() UInputAction* IA_Move; UPROPERTY() UInputAction* IA_Attack; UPROPERTY() UInputAction* IA_Smash;
	UPROPERTY() UInputAction* IA_Dodge; UPROPERTY() UInputAction* IA_Jump; UPROPERTY() UInputAction* IA_Counter; UPROPERTY() UInputAction* IA_LockOn;

	UPROPERTY() UHwCombatRulesAsset* Rules = nullptr;
	UPROPERTY() AHwBossGraybox* Target = nullptr;
	FHwAction Action; int32 Serial = 0;
	FString BufferType; float BufferTTL = 0.f;
	int32 Combo = 0; float ComboT = 0.f;
	float DodgeT = 0.f, DodgeCd = 0.f, JumpT = 0.f, JumpCd = 0.f, LockT = 0.f, StDelay = 0.f, Hitstop = 0.f, RiposteT = 0.f;
	float St = 120.f, HP = 24000.f;
	FVector2D MoveInput = FVector2D::ZeroVector; FVector DodgeDir = FVector::ZeroVector;
	bool bLockOn = true;

	void StartAction(const FString& Kind, const FString& Clip, float Mult, int32 Tier);
	void CancelAction(const FString& Reason);
	bool CanCancel(bool bDefensive) const;
	void Queue(const FString& Type);
	void Consume();
	void Contact();
	void PlayClip(const FString& Clip);
	void RetimeAtContact();
	void TickCamera(float Dt);
	void OnMove(const struct FInputActionValue& V);
	float Speed() const;
	bool InputCounterInternal();
};
