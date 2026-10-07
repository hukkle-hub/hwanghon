#include "Node/HWBossCoreComponent.h"

#include "Boss/HWBossCharacter.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "System/HWBossSystemComponent.h"

UHWBossCoreComponent::UHWBossCoreComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UHWBossCoreComponent::BeginPlay()
{
    Super::BeginPlay();
    Boss = Cast<AHWBossCharacter>(GetOwner());
    if (!Boss) return;
    Boss->OnBossCounterGraded.AddUniqueDynamic(this, &UHWBossCoreComponent::HandleCounterGraded);
    if (UHWBossSystemComponent* System = Boss->GetBossSystem())
    {
        System->OnPhaseChanged.AddUniqueDynamic(this, &UHWBossCoreComponent::HandlePhaseChanged);   // the core lights up in phase 2
    }

    // stand-in core: a small red sphere on the left forearm (final VFX later - docs/design/200 §6)
    UStaticMesh* Sphere = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    USkeletalMeshComponent* Body = Boss->GetMesh();
    if (Sphere && Body)
    {
        Marker = NewObject<UStaticMeshComponent>(Boss, TEXT("ArmCore"));
        Marker->SetStaticMesh(Sphere);
        Marker->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        Marker->SetCastShadow(false);
        const bool bHasBone = Body->GetBoneIndex(CoreBone) != INDEX_NONE;
        Marker->SetupAttachment(Body, bHasBone ? CoreBone : NAME_None);
        // a human body's forearm, or (no such bone) the left side at elbow height
        Marker->SetRelativeLocation(bHasBone ? FVector::ZeroVector : FVector(0.f, -45.f, 120.f));
        Marker->SetAbsolute(false, false, true);
        Marker->SetWorldScale3D(FVector(0.16f));
        Marker->RegisterComponent();
        if (UMaterialInterface* Base = Marker->GetMaterial(0))
        {
            UMaterialInstanceDynamic* Mat = UMaterialInstanceDynamic::Create(Base, this);
            Mat->SetVectorParameterValue(TEXT("Color"), FLinearColor(1.f, 0.08f, 0.04f));
            Marker->SetMaterial(0, Mat);
        }
    }
    RefreshMarker();
}

bool UHWBossCoreComponent::IsCoreLive() const
{
    return Boss && !Boss->IsDead() && Boss->GetBossSystem() && Boss->GetBossSystem()->GetPhase() >= CoreActiveFromPhase;
}

bool UHWBossCoreComponent::CanFinish() const
{
    return Boss && !Boss->IsDead() && HWNodeRules::CanFinish(Core, Boss->GetHealth() / FMath::Max(1.f, Boss->GetMaxHealth()));
}

void UHWBossCoreComponent::HandlePhaseChanged(int32 NewPhase)
{
    RefreshMarker();
}

void UHWBossCoreComponent::HandleCounterGraded(bool bPerfect)
{
    if (!IsCoreLive()) return;   // phase 1 is a human fight: counters stagger, the core is not lit yet
    const bool bBrokeNow = Core.ApplyCounter(bPerfect ? HWNodeRules::ECounterGrade::Perfect : HWNodeRules::ECounterGrade::Normal);
    RefreshMarker();
    if (!bBrokeNow) return;

    // the forearm armour breaks through the boss's own part system, then groggy
    if (UHWBossSystemComponent* System = Boss->GetBossSystem())
    {
        for (const FHWBossPartRuntime& Part : System->GetParts())
        {
            if (Part.Id == TEXT("limb") && !Part.bBroken) System->DamagePart(Part.Id, Part.Health + 1.f);
        }
    }
    Boss->EnterSystemBreak(ExposedBreakSeconds, Boss->GetActorLocation());
    OnCoreExposed.Broadcast();
}

bool UHWBossCoreComponent::TryBeginExtraction(AHWAinCharacter* Player)
{
    if (!Player || !Player->GetCombat() || Player->GetCombat()->IsDead() || !Boss) return false;
    if (FVector::Dist2D(Player->GetActorLocation(), Boss->GetActorLocation()) > 320.f) return false;
    if (!Extraction.Begin(Core, Boss->GetHealth() / FMath::Max(1.f, Boss->GetMaxHealth()))) return false;
    Extractor = Player;
    Player->GetCombat()->OnDamaged.AddUniqueDynamic(this, &UHWBossCoreComponent::HandleExtractorDamaged);
    // the boss stays down while the player holds it
    Boss->EnterSystemBreak(Extraction.Duration + 0.5f, Player->GetActorLocation());
    return true;
}

void UHWBossCoreComponent::HandleExtractorDamaged(float Damage, EHWAttackTier Tier)
{
    if (Extraction.State != HWNodeRules::EExtraction::Channeling) return;
    Extraction.Interrupt();
    if (Extractor && Extractor->GetCombat()) Extractor->GetCombat()->OnDamaged.RemoveDynamic(this, &UHWBossCoreComponent::HandleExtractorDamaged);
    OnExtractionInterrupted.Broadcast();
}

void UHWBossCoreComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    if (!Boss || Extraction.State != HWNodeRules::EExtraction::Channeling) return;

    // walking away breaks the hold as surely as a hit does
    if (!Extractor || FVector::Dist2D(Extractor->GetActorLocation(), Boss->GetActorLocation()) > 360.f)
    {
        HandleExtractorDamaged(0.f, EHWAttackTier::Light);
        return;
    }
    if (!Extraction.Tick(DeltaTime)) return;

    if (Extractor && Extractor->GetCombat()) Extractor->GetCombat()->OnDamaged.RemoveDynamic(this, &UHWBossCoreComponent::HandleExtractorDamaged);
    if (Marker) Marker->SetVisibility(false);   // the core is out
    OnCoreExtracted.Broadcast();
    Boss->ReceivePlayerHit(Boss->GetHealth() + 1.f, EHWAttackTier::Break, Extractor ? Extractor->GetActorLocation() : Boss->GetActorLocation());
}

void UHWBossCoreComponent::RefreshMarker()
{
    if (!Marker) return;
    // dark until phase 2, then brighter and bigger as the armour over it is stripped; full size once exposed
    const float Open = 1.f - Core.Fraction();
    Marker->SetVisibility(IsCoreLive() || Core.bExposed);
    Marker->SetWorldScale3D(FVector(Core.bExposed ? 0.26f : 0.12f + 0.08f * Open));
}
