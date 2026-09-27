// d01 보스 그레이박스 — 패턴은 JSON(boss.stages[].patterns). 모든 공격: tell → compression → strike → contact → follow → recovery.
// 공격 사이 idle 로 리셋하지 않는다(recover 자세에서 다음 tell 로). 피격 반응은 additive(공격을 끊지 않음).
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "HwCombatTypes.h"
#include "HwCombatRules.h"
#include "HwBossGraybox.generated.h"

class UCapsuleComponent; class UStaticMeshComponent; class USkeletalMeshComponent; class UAnimMontage; class AHwCombatCharacter;

UCLASS()
class HWANGHONCOMBAT_API AHwBossGraybox : public APawn
{
	GENERATED_BODY()
public:
	AHwBossGraybox();
	virtual void BeginPlay() override;
	virtual void Tick(float Dt) override;

	UPROPERTY(EditAnywhere, Category="Hwanghon") int32 StageIndex = 2;          // 0 dormant · 1 chained · 2 awake(전 패턴)
	UPROPERTY(EditAnywhere, Category="Hwanghon") float RecoveryDur = 0.7f;       // 패턴 뒤 회복(punish window) — 원본에 없음, 근거 없음
	UPROPERTY(EditAnywhere, Category="Hwanghon") float ReachM = 1.9f;            // 판정 도달(중심 간격 − 반지름 합)
	UPROPERTY(EditAnywhere, Category="Hwanghon") float BodyRadius = 0.92f;       // m — three.js Bs.r 근처
	UPROPERTY(EditAnywhere, Category="Hwanghon") float Scale = 1.9f;             // 아인 대비 키 (BOSS_SCALE)
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Anim") TMap<FString, UAnimMontage*> Montages;   // tell/strike 별 몽타주(비면 그레이박스)

	UFUNCTION(BlueprintPure, Category="Hwanghon") EHwBossState GetState() const { return State; }
	UFUNCTION(BlueprintPure, Category="Hwanghon") FString StateName() const;
	UFUNCTION(BlueprintPure, Category="Hwanghon") float TeleLeft() const { return Tele; }
	UFUNCTION(BlueprintPure, Category="Hwanghon") float CounterWindow() const;
	UFUNCTION(BlueprintPure, Category="Hwanghon") float BodyRadiusM() const { return BodyRadius; }
	UFUNCTION(BlueprintPure, Category="Hwanghon") bool IsLunging() const { return State == EHwBossState::Strike && Pattern.lunge; }
	UFUNCTION(BlueprintPure, Category="Hwanghon") float GetHP() const { return HP; }
	UFUNCTION(BlueprintPure, Category="Hwanghon") float GetPosture() const { return Posture; }
	const FHwBossPattern* CurrentPattern() const { return State == EHwBossState::Telegraph || State == EHwBossState::Strike ? &Pattern : nullptr; }

	/** 플레이어 판정 → 피해·자세·additive 반응. 공격 중이어도 공격은 계속된다(경직은 counter/break 만). */
	UFUNCTION(BlueprintCallable, Category="Hwanghon") void ReceiveHit(float Damage, float PostureAdd, EHwReactTier Tier, const FVector& From);
	/** 카운터 성공: tier 0 deflect / 1 repel / 2 clash → stagger 시간·자세 */
	UFUNCTION(BlueprintCallable, Category="Hwanghon") void Countered(int32 Tier, const FHwBossPattern& P);
	UFUNCTION(BlueprintCallable, Category="Hwanghon") void SetHitstop(float S) { Hitstop = FMath::Max(Hitstop, S); }

	/** 검수용: 이번 프레임 additive 반동 오프셋(cm) — 그레이박스 메시에 그대로 더한다 */
	UFUNCTION(BlueprintPure, Category="Hwanghon") FVector ReactOffset() const { return React; }

protected:
	UPROPERTY(VisibleAnywhere) UCapsuleComponent* Capsule;
	UPROPERTY(VisibleAnywhere) UStaticMeshComponent* Body;      // 그레이박스 몸통
	UPROPERTY(VisibleAnywhere) UStaticMeshComponent* Core;      // 가슴 핵 (약점 표식)
	UPROPERTY(VisibleAnywhere) USkeletalMeshComponent* Mesh;    // 진짜 리그가 들어오면 여기에

	UPROPERTY() UHwCombatRulesAsset* Rules = nullptr;
	UPROPERTY() AHwCombatCharacter* Player = nullptr;
	EHwBossState State = EHwBossState::Idle;
	FHwBossPattern Pattern; int32 PatternCursor = 0;
	float Tele = 0.f, StrikeT = 0.f, RecoverT = 0.f, StagT = 0.f, DownT = 0.f, GapT = 1.0f, Hitstop = 0.f;
	float HP = 380000.f, Posture = 0.f; bool bContactDone = false;
	FVector React = FVector::ZeroVector, ReactVel = FVector::ZeroVector; FVector StrikeFrom, StrikeTo;

	void BeginPattern();
	void DoContact();
	void PlayClip(const FString& Clip, float Rate = 1.f);
	const FHwBossStage* Stage() const;
};
