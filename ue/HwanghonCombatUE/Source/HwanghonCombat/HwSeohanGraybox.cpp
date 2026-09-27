#include "HwSeohanGraybox.h"
#include "Components/StaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/RectLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"

static const float CM = 100.f;

AHwSeohanGraybox::AHwSeohanGraybox()
{
	PrimaryActorTick.bCanEverTick = false;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeF(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> MatF(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	if (CubeF.Succeeded()) Cube = CubeF.Object;
	if (MatF.Succeeded()) GrayMat = MatF.Object;
	// 하늘광(cool ambient) — 실내지만 콘크리트 반사 대신. 안개는 깊이 층.
	USkyLightComponent* Sky = CreateDefaultSubobject<USkyLightComponent>(TEXT("Sky")); Sky->SetupAttachment(RootComponent);
	Sky->SetIntensity(0.35f); Sky->SetLightColor(FLinearColor(0.62f, 0.72f, 0.90f)); Sky->SourceType = ESkyLightSourceType::SLS_SpecifiedCubemap; Sky->bLowerHemisphereIsBlack = true;
	UExponentialHeightFogComponent* Fog = CreateDefaultSubobject<UExponentialHeightFogComponent>(TEXT("Fog")); Fog->SetupAttachment(RootComponent);
	Fog->SetFogDensity(0.02f); Fog->SetFogInscatteringColor(FLinearColor(0.10f, 0.11f, 0.13f)); Fog->SetStartDistance(600.f);
}

UStaticMeshComponent* AHwSeohanGraybox::Box(const FString& Name, const FVector& CenterM, const FVector& SizeM, const FLinearColor& Tint, float Roughness)
{
	UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(this, *Name);
	C->SetupAttachment(RootComponent);
	C->RegisterComponent();
	if (Cube) C->SetStaticMesh(Cube);
	C->SetRelativeLocation(CenterM * CM);
	C->SetRelativeScale3D(SizeM);   // 엔진 큐브 = 100 cm
	C->SetCollisionProfileName(TEXT("BlockAll"));
	C->SetCastShadow(false);        // 그림자 caster 는 hero 만 (docs/design/118 §18)
	if (GrayMat)
	{
		UMaterialInstanceDynamic* M = UMaterialInstanceDynamic::Create(GrayMat, this);
		M->SetVectorParameterValue(TEXT("Color"), Tint);
		C->SetMaterial(0, M);
	}
	Parts.Add(C);
	return C;
}

void AHwSeohanGraybox::OnConstruction(const FTransform& T)
{
	Super::OnConstruction(T);
	for (UStaticMeshComponent* P : Parts) if (P) P->DestroyComponent();
	Parts.Empty();
	TArray<USceneComponent*> Kids; RootComponent->GetChildrenComponents(false, Kids);
	for (USceneComponent* K : Kids) if (K && (K->IsA<UPointLightComponent>() || K->IsA<URectLightComponent>())) K->DestroyComponent();

	const float X = RoomM.X, Y = RoomM.Y, H = CeilingM;
	const FLinearColor Concrete(0.42f, 0.42f, 0.40f), Steel(0.30f, 0.32f, 0.35f), Wet(0.22f, 0.23f, 0.25f), Red(0.9f, 0.08f, 0.05f), Lamp(1.f, 0.95f, 0.85f);
	Box(TEXT("Floor"), FVector(0, 0, -0.1f), FVector(X, Y, 0.2f), Concrete, 0.9f);
	Box(TEXT("Ceiling"), FVector(0, 0, H + 0.1f), FVector(X, Y, 0.2f), Concrete, 0.9f);
	Box(TEXT("WallN"), FVector(0, Y / 2 + 0.15f, H / 2), FVector(X, 0.3f, H), Concrete, 0.9f);
	Box(TEXT("WallS"), FVector(0, -Y / 2 - 0.15f, H / 2), FVector(X, 0.3f, H), Concrete, 0.9f);
	Box(TEXT("WallE"), FVector(X / 2 + 0.15f, 0, H / 2), FVector(0.3f, Y, H), Concrete, 0.9f);
	Box(TEXT("WallW"), FVector(-X / 2 - 0.15f, 0, H / 2), FVector(0.3f, Y, H), Concrete, 0.9f);
	// 레일 2 줄 (플랫폼 가장자리 쪽, 전투 중심에서 벗어나게) + 침목
	for (int32 r = 0; r < 2; r++) { const float y = -Y / 2 + 1.6f + r * 1.435f; Box(FString::Printf(TEXT("Rail%d"), r), FVector(0, y, 0.08f), FVector(X - 1.f, 0.07f, 0.16f), Steel, 0.35f); }
	for (int32 s = 0; s < 12; s++) Box(FString::Printf(TEXT("Tie%d"), s), FVector(-X / 2 + 1.5f + s * (X - 3.f) / 11.f, -Y / 2 + 2.3f, 0.04f), FVector(0.25f, 2.6f, 0.08f), FLinearColor(0.25f, 0.20f, 0.16f), 0.95f);
	// 강철 기둥
	for (int32 p = 0; p < Pillars; p++) { const float x = -X / 2 + (p + 0.5f) * X / Pillars; Box(FString::Printf(TEXT("Pillar%d"), p), FVector(x, Y / 2 - 1.0f, H / 2), FVector(0.45f, 0.45f, H), Steel, 0.4f); }
	// 젖은 바닥 구역 (전투 중심 살짝 옆) — 재질 단계에서 roughness 0.15 로 갈아 끼움
	if (bWetFloor) Box(TEXT("WetFloor"), FVector(2.5f, 1.5f, 0.005f), FVector(7.f, 5.f, 0.01f), Wet, 0.15f);
	// 천장등: 판 + RectLight (warm key)
	for (int32 l = 0; l < CeilingLights; l++)
	{
		const float x = -X / 2 + (l % (CeilingLights / 2) + 0.5f) * X / (CeilingLights / 2), y = (l < CeilingLights / 2 ? -1 : 1) * Y * 0.22f;
		UStaticMeshComponent* Plate = Box(FString::Printf(TEXT("Lamp%d"), l), FVector(x, y, H - 0.05f), FVector(1.2f, 0.3f, 0.06f), Lamp, 0.3f);
		Plate->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		URectLightComponent* L = NewObject<URectLightComponent>(this, *FString::Printf(TEXT("KeyLight%d"), l)); L->SetupAttachment(RootComponent); L->RegisterComponent();
		L->SetRelativeLocation(FVector(x, y, H - 0.12f) * CM); L->SetRelativeRotation(FRotator(-90.f, 0.f, 0.f));
		L->SetIntensityUnits(ELightUnits::Lumens); L->SetIntensity(KeyLightLux); L->SetLightColor(FLinearColor(1.f, 0.88f, 0.72f)); L->SetSourceWidth(120.f); L->SetSourceHeight(30.f); L->SetAttenuationRadius(900.f);
		L->SetCastShadows(l == 1 || l == 5);   // hero shadow 는 두 등만
		L->SetMobility(EComponentMobility::Stationary);
	}
	// 비상 적색 악센트 — 절제: 벽 위쪽 두 곳, 낮은 강도
	for (int32 a = 0; a < 2; a++)
	{
		const float x = (a ? 1 : -1) * X * 0.38f;
		UStaticMeshComponent* Sign = Box(FString::Printf(TEXT("RedSign%d"), a), FVector(x, Y / 2 - 0.2f, H - 0.6f), FVector(0.6f, 0.08f, 0.25f), Red, 0.5f);
		Sign->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		UPointLightComponent* R = NewObject<UPointLightComponent>(this, *FString::Printf(TEXT("RedLight%d"), a)); R->SetupAttachment(RootComponent); R->RegisterComponent();
		R->SetRelativeLocation(FVector(x, Y / 2 - 0.6f, H - 0.7f) * CM); R->SetIntensityUnits(ELightUnits::Lumens); R->SetIntensity(RedAccentLux); R->SetLightColor(FLinearColor(1.f, 0.12f, 0.06f)); R->SetAttenuationRadius(700.f); R->SetCastShadows(false); R->SetMobility(EComponentMobility::Stationary);
	}
	// 바닥 파편·데칼·안개 층은 Phase E(재질·조명) 에서 — 그레이박스에는 넣지 않는다.
}
