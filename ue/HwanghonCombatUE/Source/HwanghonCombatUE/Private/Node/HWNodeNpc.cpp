#include "Node/HWNodeNpc.h"

#include "Animation/HWCharacterVisualSettings.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/TextRenderComponent.h"

AHWNodeNpc::AHWNodeNpc()
{
    PrimaryActorTick.bCanEverTick = false;
    GetCapsuleComponent()->InitCapsuleSize(40.f, 88.f);
    AutoPossessAI = EAutoPossessAI::PlacedInWorldOrSpawned;

    Tag = CreateDefaultSubobject<UTextRenderComponent>(TEXT("Tag"));
    Tag->SetupAttachment(GetCapsuleComponent());
    Tag->SetRelativeLocation(FVector(0.f, 0.f, 130.f));
    Tag->SetRelativeRotation(FRotator(0.f, -90.f, 0.f));
    Tag->SetHorizontalAlignment(EHTA_Center);
    Tag->SetWorldSize(60.f);
}

void AHWNodeNpc::BeginPlay()
{
    if (GetMesh() && !GetMesh()->GetSkeletalMeshAsset())
    {
        UHWCharacterVisualSettings::ApplyTo(TEXT("enemy"), GetMesh(), GetCapsuleComponent()->GetUnscaledCapsuleHalfHeight());
    }
    Super::BeginPlay();
    Refresh();
}

void AHWNodeNpc::ApplyEnemyDamage(float Amount)
{
    if (!IsTargetable() || Amount <= 0.f) return;
    Health -= Amount;
    if (Health > 0.f)
    {
        Refresh();
        return;
    }
    if (State == HWNodeRules::ENpcState::Normal)
    {
        State = HWNodeRules::ENpcState::Injured;   // down but here: repairs at half speed
        Health = MaxHealth * 0.5f;
    }
    else
    {
        State = HWNodeRules::ENpcState::Missing;   // dragged off: advanced repairs stop until rescued
        Health = 0.f;
        SetActorHiddenInGame(true);
        SetActorEnableCollision(false);
    }
    Refresh();
}

bool AHWNodeNpc::Rescue()
{
    if (State != HWNodeRules::ENpcState::Missing) return false;
    State = HWNodeRules::ENpcState::Rescued;
    Health = MaxHealth * 0.5f;
    SetActorHiddenInGame(false);
    SetActorEnableCollision(true);
    Refresh();
    return true;
}

void AHWNodeNpc::Refresh()
{
    static const TCHAR* Names[] = { TEXT("TECH OK"), TEXT("TECH INJURED"), TEXT("TECH MISSING"), TEXT("TECH RESCUED") };
    Tag->SetText(FText::FromString(Names[static_cast<int32>(State)]));
    Tag->SetTextRenderColor(State == HWNodeRules::ENpcState::Normal ? FColor(120, 230, 150) : FColor(255, 170, 80));
}
