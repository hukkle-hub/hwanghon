// 전투 감사 — three.js P6(?combatAudit=1) 와 같은 JSON 을 Saved/HwAudit/*.json 으로 쓴다.
// tools/combat-audit-report.mjs 로 그대로 판독한다 (handoff·hit 오차·반응 지연·penetration·p95).
#pragma once
#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "HwCombatTypes.h"
#include "HwCombatAudit.generated.h"

class AHwCombatCharacter; class AHwBossGraybox;

UCLASS()
class HWANGHONCOMBAT_API UHwCombatAudit : public UTickableWorldSubsystem
{
	GENERATED_BODY()
public:
	virtual void Tick(float Dt) override;
	virtual TStatId GetStatId() const override { RETURN_QUICK_DECLARE_CYCLE_STAT(UHwCombatAudit, STATGROUP_Tickables); }
	virtual void Deinitialize() override;

	static void Event(AHwCombatCharacter* Who, const FString& Type, const FHwAction& A, const FString& Detail);
	static void BossEvent(AHwBossGraybox* Who, const FString& Type, const FString& Name, float Value);

	UFUNCTION(BlueprintCallable, Category="Hwanghon|Audit") void Save();
	UFUNCTION(BlueprintCallable, Category="Hwanghon|Audit") void Clear() { Events.Empty(); Samples.Empty(); FrameMs.Empty(); T = 0.f; }

private:
	float T = 0.f, SampleT = 0.f;
	TArray<FHwAuditEvent> Events; TArray<FHwAuditSample> Samples; TArray<float> FrameMs;
};
