// 서한역 전투방 그레이박스 (Seohan_Combat_VS01) — 아트보다 카메라·이동·접점이 먼저.
// 엔진 기본 큐브로 전투방·레일·콘크리트 벽·강철 기둥·천장등·비상 적색 악센트·젖은 바닥 구역을 세운다. 값(m)은 docs/design/119 §2, 근거 없음(영상으로 조정).
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HwSeohanGraybox.generated.h"

class UStaticMesh; class UMaterialInterface; class UStaticMeshComponent;

UCLASS()
class HWANGHONCOMBAT_API AHwSeohanGraybox : public AActor
{
	GENERATED_BODY()
public:
	AHwSeohanGraybox();
	virtual void OnConstruction(const FTransform& T) override;

	UPROPERTY(EditAnywhere, Category="Hwanghon") FVector2D RoomM = FVector2D(24.f, 16.f);   // 전투방 바닥 (x 길이 · y 폭)
	UPROPERTY(EditAnywhere, Category="Hwanghon") float CeilingM = 4.2f;
	UPROPERTY(EditAnywhere, Category="Hwanghon") int32 Pillars = 6;
	UPROPERTY(EditAnywhere, Category="Hwanghon") int32 CeilingLights = 8;
	UPROPERTY(EditAnywhere, Category="Hwanghon") float KeyLightLux = 3000.f;      // 천장등 (warm key) — 근거 없음
	UPROPERTY(EditAnywhere, Category="Hwanghon") float RedAccentLux = 600.f;      // 비상등 (restrained red)
	UPROPERTY(EditAnywhere, Category="Hwanghon") bool bWetFloor = true;

private:
	UPROPERTY() TArray<UStaticMeshComponent*> Parts;
	UPROPERTY() UStaticMesh* Cube = nullptr;
	UPROPERTY() UMaterialInterface* GrayMat = nullptr;
	UStaticMeshComponent* Box(const FString& Name, const FVector& CenterM, const FVector& SizeM, const FLinearColor& Tint, float Roughness);
};
