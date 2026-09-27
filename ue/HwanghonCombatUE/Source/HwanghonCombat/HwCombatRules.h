// 황혼 전투 규칙 — «데이터 포팅». 값은 Content/Data/combat_rules.json (tools/ue/export-combat-rules.mjs 가 js/dungeons.js 에서 뽑음).
// 이 파일은 판정 수치를 하나도 갖지 않는다. 규칙을 바꾸려면 js/dungeons.js 를 바꾸고 다시 내보낸다.
#pragma once
#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "HwCombatRules.generated.h"

/** 행동 시간표 — combat.js action(): hitAt / activeEnd / duration / cancelAt (아인 rhythm 1.0 기준 초) */
USTRUCT(BlueprintType)
struct FHwActionTiming
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float hit = 0.24f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float active = 0.09f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float duration = 0.66f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float cancel = 0.48f;
};

USTRUCT(BlueprintType)
struct FHwComboRules
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float gap = 0.55f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) TArray<float> mults;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) TArray<float> smash;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) TArray<float> smashPosture;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) TArray<float> smashSt;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float smashHold = 0.2f;
};

USTRUCT(BlueprintType)
struct FHwDodgeRules
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float iframes = 0.30f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float cooldown = 0.45f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float perfect = 0.14f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float perfectRiposte = 0.35f;
};

USTRUCT(BlueprintType)
struct FHwJumpRules
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float dur = 0.45f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float cooldown = 0.8f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float st = 15.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float perfect = 0.14f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float height = 1.1f;
};

USTRUCT(BlueprintType)
struct FHwCounterRules
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float window = 0.25f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float perfect = 0.10f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float mid = 0.17f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float mult = 2.5f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float perfectMult = 3.0f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float deflectMult = 1.7f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float posture = 30.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float ult = 18.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float cone = 60.f;
};

USTRUCT(BlueprintType)
struct FHwStaminaRules
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float max = 120.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float regen = 18.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float delay = 0.6f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float dodge = 25.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float guardPerSec = 12.f;
};

USTRUCT(BlueprintType)
struct FHwHitstopRules
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float light = 0.09f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float chain = 0.13f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float smash = 0.21f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float counter = 0.21f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float perfect = 0.24f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float brk = 0.28f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float execute = 0.38f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float hurt = 0.11f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float guard = 0.06f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float hit = 0.10f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float deflect = 0.12f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float clash = 0.38f;
};

USTRUCT(BlueprintType)
struct FHwStaggerTier
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString clip;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float lock = 0.26f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float push = 22.f;   // 원본 px (÷50 = m)
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float dur = 0.18f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float shake = 0.01f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float vib = 60.f;
};

USTRUCT(BlueprintType)
struct FHwStaggerRules
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float heavyAt = 0.12f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FHwStaggerTier light;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FHwStaggerTier heavy;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FHwStaggerTier guard;
};

USTRUCT(BlueprintType)
struct FHwPostureRules
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float max = 100.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float onBreak = 40.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float onGuard = 10.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float downDur = 5.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float downMult = 1.5f;
};

/** 보스 공격 이동 — js/dungeon-content.js attackMotion (m 로 환산) */
USTRUCT(BlueprintType)
struct FHwPatternMotion
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float distanceM = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float stopM = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float at = 0.5f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString curve;
};

USTRUCT(BlueprintType)
struct FHwBossPattern
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString icon;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString name;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString rank;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float tele = 1.f;      // 예고(tell) 초
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float window = 0.4f;   // 판정 창
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float dmg = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float posture = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float guardCost = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool counterable = true;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool jumpOnly = false;  // 바닥 광역 — 점프로만 넘는다
	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool lunge = false;     // 관통 돌진
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FHwPatternMotion motion;
};

USTRUCT(BlueprintType)
struct FHwBossPart
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString id;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString name;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float hp = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool weak = false;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool breakable = false;
};

USTRUCT(BlueprintType)
struct FHwBossStage
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString id;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString name;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float hp = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float timeLimit = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float counterWindow = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float patternGap = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) TArray<FHwBossPart> parts;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) TArray<FHwBossPattern> patterns;
};

USTRUCT(BlueprintType)
struct FHwBossRules
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString id;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString name;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) TArray<FHwBossStage> stages;
};

/** 전투 규칙 묶음. JSON 을 읽어 채운다 — LoadFromJson(). 편집기에서 값을 고치면 «근거 없음» 이 된다: 원본은 js/dungeons.js. */
UCLASS(BlueprintType)
class HWANGHONCOMBAT_API UHwCombatRulesAsset : public UPrimaryDataAsset
{
	GENERATED_BODY()
public:
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Source") FString schema;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Source") FString source;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Source") float worldScalePxPerM = 50.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Player") TMap<FString, FHwActionTiming> actions;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Player") float inputBuffer = 0.16f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Player") float defCancel = 0.06f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Player") FHwComboRules combo;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Player") FHwDodgeRules dodge;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Player") FHwJumpRules jump;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Player") FHwCounterRules counter;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Player") FHwStaminaRules stamina;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Feel") FHwHitstopRules hitstop;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Feel") FHwStaggerRules stagger;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss") FHwPostureRules posture;
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Boss") FHwBossRules boss;

	/** Content/Data/combat_rules.json 을 읽는다. 실패하면 false — 기본값(위 헤더 값 = 같은 규칙) 로 남는다. */
	UFUNCTION(BlueprintCallable, Category="Hwanghon")
	bool LoadFromJson(const FString& RelativePath = TEXT("Data/combat_rules.json"));

	UFUNCTION(BlueprintPure, Category="Hwanghon")
	FHwActionTiming GetTiming(const FString& Clip) const;

	/** 프로젝트 전역 규칙 — 처음 부르면 JSON 을 읽는다 */
	static UHwCombatRulesAsset* Get();
};
