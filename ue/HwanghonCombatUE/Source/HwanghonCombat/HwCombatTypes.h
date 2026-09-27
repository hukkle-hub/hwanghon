// 전투 이벤트·행동 상태 — three.js combat.js 의 P.action / E.state 와 같은 뜻의 이름을 쓴다 (검수 도구 호환).
#pragma once
#include "CoreMinimal.h"
#include "HwCombatTypes.generated.h"

UENUM(BlueprintType)
enum class EHwBossState : uint8 { Idle, Telegraph, Strike, Recover, Stagger, Downed, Dead };

/** 피격 반응 위계 — light < finisher(3타) < smash < counter < stagger < break/down (docs/design/118 §12) */
UENUM(BlueprintType)
enum class EHwReactTier : uint8 { Light, Finisher, Smash, Counter, Stagger, Break };

USTRUCT(BlueprintType)
struct FHwAction
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly) FString clip;      // attack1/2/3, smash, counter, dodge, jump
	UPROPERTY(BlueprintReadOnly) FString kind;      // attack / smash / counter
	UPROPERTY(BlueprintReadOnly) float elapsed = 0.f;
	UPROPERTY(BlueprintReadOnly) float hitAt = 0.f;
	UPROPERTY(BlueprintReadOnly) float activeEnd = 0.f;
	UPROPERTY(BlueprintReadOnly) float duration = 0.f;
	UPROPERTY(BlueprintReadOnly) float cancelAt = 0.f;
	UPROPERTY(BlueprintReadOnly) float defCancelAt = 0.f;
	UPROPERTY(BlueprintReadOnly) float mult = 1.f;
	UPROPERTY(BlueprintReadOnly) int32 combo = 0;
	UPROPERTY(BlueprintReadOnly) int32 tier = 0;      // smash 타수 tier / counter tier(0 deflect,1 repel,2 clash)
	UPROPERTY(BlueprintReadOnly) bool resolved = false;
	UPROPERTY(BlueprintReadOnly) bool retimed = false; // 접점 뒤 두 번째 재생 속도 적용했는가
	UPROPERTY(BlueprintReadOnly) int32 id = 0;
	bool IsValid() const { return !clip.IsEmpty(); }
};

/** 검수 로그 한 줄 — tools/combat-audit-report.mjs 가 읽는 P6 감사 JSON 과 같은 키 */
USTRUCT()
struct FHwAuditEvent
{
	GENERATED_BODY()
	UPROPERTY() FString type;   // actionstart / actionend / hit / bossreact / playerhit / counter / dodge / jump
	UPROPERTY() float t = 0.f;
	UPROPERTY() FString clip;
	UPROPERTY() float hitAt = 0.f;
	UPROPERTY() float elapsed = 0.f;
	UPROPERTY() int32 id = 0;
	UPROPERTY() FString bossState;
	UPROPERTY() FString detail;
};

USTRUCT()
struct FHwAuditSample
{
	GENERATED_BODY()
	UPROPERTY() float t = 0.f;
	UPROPERTY() FString clip;
	UPROPERTY() float elapsed = 0.f;
	UPROPERTY() FString bossState;
	UPROPERTY() float gapM = 0.f;
	UPROPERTY() float bodyRadiusM = 0.f;
	UPROPERTY() float penetrationM = 0.f;
	UPROPERTY() bool bossLunge = false;
	UPROPERTY() float plantError = 0.f;
	UPROPERTY() float plantWeight = 0.f;
	UPROPERTY() float frameMs = 0.f;
};
