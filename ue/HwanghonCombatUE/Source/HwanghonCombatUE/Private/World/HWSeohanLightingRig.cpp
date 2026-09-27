#include "World/HWSeohanLightingRig.h"

#include "Boss/HWBossCharacter.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Graphics/HWGraphicsQualitySubsystem.h"

#include "Components/PointLightComponent.h"
#include "Components/SceneComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/SpotLightComponent.h"
#include "Engine/GameInstance.h"
#include "Kismet/GameplayStatics.h"

AHWSeohanLightingRig::AHWSeohanLightingRig()
{
    PrimaryActorTick.bCanEverTick = true;

    SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    RootComponent = SceneRoot;

    // Neutral/cool ambient keeps black materials readable without flattening the scene.
    FillSky = CreateDefaultSubobject<USkyLightComponent>(TEXT("FillSky"));
    FillSky->SetupAttachment(SceneRoot);
    FillSky->SetMobility(EComponentMobility::Movable);
    FillSky->SetIntensity(0.55f);
    FillSky->LightColor = FColor(150, 172, 198);

    // Warm key: separates face/torso and wet-floor highlights.
    WarmKey = CreateDefaultSubobject<USpotLightComponent>(TEXT("WarmKey"));
    WarmKey->SetupAttachment(SceneRoot);
    WarmKey->SetRelativeLocation(FVector(-450.f, -350.f, 620.f));
    WarmKey->SetRelativeRotation(FRotator(-42.f, 32.f, 0.f));
    WarmKey->SetIntensity(9000.f);
    WarmKey->SetAttenuationRadius(1800.f);
    WarmKey->SetInnerConeAngle(24.f);
    WarmKey->SetOuterConeAngle(52.f);
    WarmKey->SetLightColor(FLinearColor(1.f, 0.73f, 0.55f));

    // Cool rim: keeps player/boss silhouette separate from dark industrial walls.
    CoolRim = CreateDefaultSubobject<USpotLightComponent>(TEXT("CoolRim"));
    CoolRim->SetupAttachment(SceneRoot);
    CoolRim->SetRelativeLocation(FVector(420.f, 420.f, 500.f));
    CoolRim->SetRelativeRotation(FRotator(-32.f, -142.f, 0.f));
    CoolRim->SetIntensity(5200.f);
    CoolRim->SetAttenuationRadius(1500.f);
    CoolRim->SetInnerConeAngle(20.f);
    CoolRim->SetOuterConeAngle(48.f);
    CoolRim->SetLightColor(FLinearColor(0.42f, 0.62f, 1.f));

    // Red is an accent, not the scene's ambient color.
    RedAccent = CreateDefaultSubobject<UPointLightComponent>(TEXT("RedAccent"));
    RedAccent->SetupAttachment(SceneRoot);
    RedAccent->SetRelativeLocation(FVector(520.f, -420.f, 260.f));
    RedAccent->SetIntensity(1600.f);
    RedAccent->SetAttenuationRadius(900.f);
    RedAccent->SetLightColor(FLinearColor(0.92f, 0.08f, 0.025f));

    // One short hero contact light. Disabled on Low through graphics tier.
    ContactLight = CreateDefaultSubobject<UPointLightComponent>(TEXT("ContactLight"));
    ContactLight->SetupAttachment(SceneRoot);
    ContactLight->SetIntensity(0.f);
    ContactLight->SetAttenuationRadius(420.f);
    ContactLight->SetCastShadows(false);
    ContactLight->SetLightColor(FLinearColor(1.f, 0.78f, 0.52f));
}

void AHWSeohanLightingRig::BeginPlay()
{
    Super::BeginPlay();
    ResolveCombatActors();
}

void AHWSeohanLightingRig::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (!bBoundContact)
    {
        ResolveCombatActors();
    }

    if (ContactLightRemaining > 0.f)
    {
        ContactLightRemaining = FMath::Max(0.f, ContactLightRemaining - DeltaSeconds);
        const float U = ContactLightDuration > 0.f
            ? ContactLightRemaining / ContactLightDuration
            : 0.f;

        // Fast attack, slightly longer tail: impact reads as one event.
        const float Intensity = ContactLightPeak * U * U;
        ContactLight->SetIntensity(Intensity);

        if (Player && Boss)
        {
            ContactLight->SetWorldLocation(
                FMath::Lerp(Player->GetActorLocation(), Boss->GetActorLocation(), 0.58f)
                + FVector(0.f, 0.f, 105.f));
        }
    }
    else if (ContactLight->Intensity > 0.f)
    {
        ContactLight->SetIntensity(0.f);
    }
}

void AHWSeohanLightingRig::ResolveCombatActors()
{
    if (!Player)
    {
        Player = Cast<AHWAinCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0));
    }

    if (!Boss)
    {
        Boss = Cast<AHWBossCharacter>(
            UGameplayStatics::GetActorOfClass(this, AHWBossCharacter::StaticClass()));
    }

    if (!bBoundContact && Player && Player->GetCombat())
    {
        Player->GetCombat()->OnContact.AddDynamic(
            this,
            &AHWSeohanLightingRig::HandlePlayerContact);
        bBoundContact = true;
    }
}

void AHWSeohanLightingRig::HandlePlayerContact(
    EHWActionType Action,
    EHWAttackTier Tier,
    float Damage)
{
    TriggerContactLight(Tier);
}

void AHWSeohanLightingRig::TriggerContactLight(EHWAttackTier Tier)
{
    float QualityScale = 1.f;

    if (UGameInstance* GI = GetGameInstance())
    {
        if (UHWGraphicsQualitySubsystem* Graphics =
            GI->GetSubsystem<UHWGraphicsQualitySubsystem>())
        {
            QualityScale = Graphics->GetContactLightScale();
        }
    }

    if (QualityScale <= 0.f)
    {
        return;
    }

    switch (Tier)
    {
        case EHWAttackTier::Light:
            ContactLightPeak = 2800.f;
            ContactLightDuration = 0.055f;
            ContactLight->SetLightColor(FLinearColor(1.f, 0.62f, 0.36f));
            break;

        case EHWAttackTier::Finisher:
            ContactLightPeak = 4800.f;
            ContactLightDuration = 0.070f;
            ContactLight->SetLightColor(FLinearColor(1.f, 0.76f, 0.52f));
            break;

        case EHWAttackTier::Smash:
            ContactLightPeak = 6800.f;
            ContactLightDuration = 0.090f;
            ContactLight->SetLightColor(FLinearColor(1.f, 0.88f, 0.70f));
            break;

        case EHWAttackTier::Counter:
        case EHWAttackTier::Stagger:
        case EHWAttackTier::Break:
            ContactLightPeak = 8200.f;
            ContactLightDuration = 0.095f;
            ContactLight->SetLightColor(FLinearColor(0.82f, 0.92f, 1.f));
            break;

        default:
            ContactLightPeak = 2800.f;
            ContactLightDuration = 0.055f;
            break;
    }

    ContactLightPeak *= QualityScale;
    ContactLightRemaining = ContactLightDuration;
}
