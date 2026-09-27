#include "HwCombatAudit.h"
#include "HwCombatCharacter.h"
#include "HwBossGraybox.h"
#include "HwanghonCombat.h"
#include "Components/CapsuleComponent.h"
#include "JsonObjectConverter.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Kismet/GameplayStatics.h"
#include "EngineUtils.h"

static UHwCombatAudit* Find(UObject* Ctx) { UWorld* W = Ctx ? Ctx->GetWorld() : nullptr; return W ? W->GetSubsystem<UHwCombatAudit>() : nullptr; }

void UHwCombatAudit::Event(AHwCombatCharacter* Who, const FString& Type, const FHwAction& A, const FString& Detail)
{
	UHwCombatAudit* S = Find(Who); if (!S) return;
	FHwAuditEvent E; E.type = Type; E.t = S->T; E.clip = A.clip; E.hitAt = A.hitAt; E.elapsed = A.elapsed; E.id = A.id; E.detail = Detail;
	if (AHwBossGraybox* B = Who->GetTarget()) E.bossState = B->StateName();
	S->Events.Add(E);
}

void UHwCombatAudit::BossEvent(AHwBossGraybox* Who, const FString& Type, const FString& Name, float Value)
{
	UHwCombatAudit* S = Find(Who); if (!S) return;
	FHwAuditEvent E; E.type = Type; E.t = S->T; E.clip = Name; E.hitAt = Value; E.bossState = Who->StateName(); S->Events.Add(E);
}

void UHwCombatAudit::Tick(float Dt)
{
	T += Dt; FrameMs.Add(Dt * 1000.f);
	SampleT += Dt; if (SampleT < 0.05f) return; SampleT = 0.f;   // 50 ms 표본 (P6 와 같게)
	AHwCombatCharacter* P = Cast<AHwCombatCharacter>(UGameplayStatics::GetPlayerPawn(GetWorld(), 0)); if (!P) return;
	AHwBossGraybox* B = P->GetTarget(); if (!B) return;
	FHwAuditSample Smp; Smp.t = T; Smp.clip = P->GetAction().clip; Smp.elapsed = P->GetAction().elapsed; Smp.bossState = B->StateName();
	Smp.gapM = (B->GetActorLocation() - P->GetActorLocation()).Size2D() / 100.f;
	Smp.bodyRadiusM = B->BodyRadiusM() + P->GetCapsuleComponent()->GetScaledCapsuleRadius() / 100.f;
	Smp.penetrationM = FMath::Max(0.f, Smp.bodyRadiusM - Smp.gapM); Smp.bossLunge = B->IsLunging(); Smp.frameMs = Dt * 1000.f;
	Samples.Add(Smp);
}

void UHwCombatAudit::Save()
{
	TSharedRef<FJsonObject> Root = MakeShared<FJsonObject>();
	TArray<TSharedPtr<FJsonValue>> Ev, Sm;
	for (const FHwAuditEvent& E : Events) { TSharedRef<FJsonObject> O = MakeShared<FJsonObject>(); FJsonObjectConverter::UStructToJsonObject(FHwAuditEvent::StaticStruct(), &E, O, 0, 0); Ev.Add(MakeShared<FJsonValueObject>(O)); }
	for (const FHwAuditSample& S : Samples) { TSharedRef<FJsonObject> O = MakeShared<FJsonObject>(); FJsonObjectConverter::UStructToJsonObject(FHwAuditSample::StaticStruct(), &S, O, 0, 0); Sm.Add(MakeShared<FJsonValueObject>(O)); }
	Root->SetArrayField(TEXT("events"), Ev); Root->SetArrayField(TEXT("samples"), Sm);
	TArray<float> Sorted = FrameMs; Sorted.Sort();
	TSharedRef<FJsonObject> FM = MakeShared<FJsonObject>();
	auto Pct = [&](float P) { return Sorted.Num() ? Sorted[FMath::Clamp((int32)(P * (Sorted.Num() - 1)), 0, Sorted.Num() - 1)] : 0.f; };
	int32 Over = 0; float Sum = 0.f; for (float M : FrameMs) { Sum += M; if (M > 50.f) Over++; }
	FM->SetNumberField(TEXT("fps"), FrameMs.Num() ? 1000.f / (Sum / FrameMs.Num()) : 0.f); FM->SetNumberField(TEXT("p95Ms"), Pct(0.95f)); FM->SetNumberField(TEXT("p99Ms"), Pct(0.99f)); FM->SetNumberField(TEXT("over50Ms"), Over); FM->SetNumberField(TEXT("frames"), FrameMs.Num());
	Root->SetObjectField(TEXT("frameMetrics"), FM);
	FString Out; const TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Out); FJsonSerializer::Serialize(Root, W);
	const FString Path = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("HwAudit"), FString::Printf(TEXT("audit_%s.json"), *FDateTime::Now().ToString()));
	FFileHelper::SaveStringToFile(Out, *Path);
	UE_LOG(LogHwCombat, Log, TEXT("감사 JSON 저장: %s (이벤트 %d · 표본 %d)"), *Path, Events.Num(), Samples.Num());
}

void UHwCombatAudit::Deinitialize() { if (Events.Num()) Save(); Super::Deinitialize(); }
