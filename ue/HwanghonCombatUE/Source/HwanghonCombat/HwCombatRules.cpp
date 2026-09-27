#include "HwCombatRules.h"
#include "HwanghonCombat.h"
#include "JsonObjectConverter.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"

static UHwCombatRulesAsset* GHwRules = nullptr;

bool UHwCombatRulesAsset::LoadFromJson(const FString& RelativePath)
{
	const FString Path = FPaths::Combine(FPaths::ProjectContentDir(), RelativePath);
	FString Text;
	if (!FFileHelper::LoadFileToString(Text, *Path))
	{
		UE_LOG(LogHwCombat, Error, TEXT("combat_rules.json 없음: %s"), *Path);
		return false;
	}
	TSharedPtr<FJsonObject> Root;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Text);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		UE_LOG(LogHwCombat, Error, TEXT("combat_rules.json 파싱 실패"));
		return false;
	}
	// 최상위 스칼라·구조체 — 이름이 같은 UPROPERTY 로 그대로 (TMap<FString,FHwActionTiming> 도 JsonObjectConverter 가 처리)
	if (!FJsonObjectConverter::JsonObjectToUStruct(Root.ToSharedRef(), GetClass(), this, 0, 0))
	{
		UE_LOG(LogHwCombat, Warning, TEXT("combat_rules.json 일부 필드를 못 옮겼다 (JSON 에만 있는 키는 무시)"));
	}
	UE_LOG(LogHwCombat, Log, TEXT("전투 규칙 로드: %s · 행동 %d · 보스 단계 %d"), *schema, actions.Num(), boss.stages.Num());
	return true;
}

FHwActionTiming UHwCombatRulesAsset::GetTiming(const FString& Clip) const
{
	if (const FHwActionTiming* T = actions.Find(Clip)) return *T;
	if (Clip.StartsWith(TEXT("attack"))) { if (const FHwActionTiming* T = actions.Find(TEXT("attack1"))) return *T; }
	return FHwActionTiming();
}

UHwCombatRulesAsset* UHwCombatRulesAsset::Get()
{
	if (!GHwRules)
	{
		GHwRules = NewObject<UHwCombatRulesAsset>(GetTransientPackage(), TEXT("HwCombatRules"));
		GHwRules->AddToRoot();
		GHwRules->LoadFromJson();
	}
	return GHwRules;
}
