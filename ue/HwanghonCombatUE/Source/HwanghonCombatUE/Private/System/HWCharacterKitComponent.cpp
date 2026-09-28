#include "System/HWCharacterKitComponent.h"

#include "System/HWSystemRulesLibrary.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Combat/HWCombatTuningAsset.h"
#include "Camera/HWLockOnComponent.h"
#include "Boss/HWBossCharacter.h"
#include "System/HWCombatTargetInterface.h"
#include "System/HWCoopCombatSubsystem.h"
#include "Network/HWRaidNetworkSubsystem.h"
#include "Engine/World.h"
#include "Engine/GameInstance.h"

UHWCharacterKitComponent::UHWCharacterKitComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UHWCharacterKitComponent::BeginPlay()
{
    Super::BeginPlay();

    OwnerCharacter = Cast<AHWAinCharacter>(GetOwner());
    Combat = OwnerCharacter ? OwnerCharacter->GetCombat() : nullptr;

    if (Combat)
    {
        Combat->OnContact.AddDynamic(this, &UHWCharacterKitComponent::HandleContact);
    }

    ConfigureCharacter(CharacterId);
}

void UHWCharacterKitComponent::TickComponent(
    float DeltaTime,
    ELevelTick TickType,
    FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    Skill1CooldownRemaining = FMath::Max(0.f, Skill1CooldownRemaining - DeltaTime);
    Skill2CooldownRemaining = FMath::Max(0.f, Skill2CooldownRemaining - DeltaTime);
    Skill3CooldownRemaining = FMath::Max(0.f, Skill3CooldownRemaining - DeltaTime);
    Skill4CooldownRemaining = FMath::Max(0.f, Skill4CooldownRemaining - DeltaTime);
    UltimateCooldownRemaining = FMath::Max(0.f, UltimateCooldownRemaining - DeltaTime);
}

void UHWCharacterKitComponent::ConfigureCharacter(FName InCharacterId)
{
    if (InCharacterId != TEXT("ain")
        && InCharacterId != TEXT("kain")
        && InCharacterId != TEXT("ryu")
        && InCharacterId != TEXT("sera"))
    {
        InCharacterId = TEXT("ain");
    }

    CharacterId = InCharacterId;
    UniqueGauge = 0.f;
    UltimateGauge = 0.f;
    Skill1CooldownRemaining = 0.f;
    Skill2CooldownRemaining = 0.f;
    Skill3CooldownRemaining = 0.f;
    Skill4CooldownRemaining = 0.f;
    UltimateCooldownRemaining = 0.f;
    BroadcastGauge();
}

bool UHWCharacterKitComponent::RequestSkill1()
{
    return Activate(EHWAbilitySlot::Skill1);
}

bool UHWCharacterKitComponent::RequestSkill2()
{
    return Activate(EHWAbilitySlot::Skill2);
}

bool UHWCharacterKitComponent::RequestSkill3()
{
    return Activate(EHWAbilitySlot::Skill3);
}

bool UHWCharacterKitComponent::RequestSkill4()
{
    return Activate(EHWAbilitySlot::Skill4);
}

bool UHWCharacterKitComponent::RequestUltimate()
{
    return Activate(EHWAbilitySlot::Ultimate);
}

float UHWCharacterKitComponent::ResolveBaseDamage() const
{
    if (!Combat || !Combat->Tuning) return 1000.f;
    return FMath::Max(1.f, Combat->Tuning->Attack1.Damage);
}

bool UHWCharacterKitComponent::Activate(EHWAbilitySlot Slot)
{
    if (!OwnerCharacter || !Combat || Combat->IsDead()
        || Combat->GetCurrentAction() != EHWActionType::None)
    {
        return false;
    }

    const FHWCharacterSystemProfile Profile =
        UHWSystemRulesLibrary::CharacterProfile(CharacterId);

    float Multiplier = 1.f;
    EHWAttackTier Tier = EHWAttackTier::Finisher;

    switch (Slot)
    {
        case EHWAbilitySlot::Skill1:
            if (Skill1CooldownRemaining > 0.f
                || !Combat->TrySpendStamina(Profile.Skill1Stamina)) return false;
            Skill1CooldownRemaining = Profile.Skill1Cooldown;
            Multiplier = Profile.Skill1Multiplier;
            break;

        case EHWAbilitySlot::Skill2:
            if (Skill2CooldownRemaining > 0.f) return false;

            if (CharacterId == TEXT("ain")
                || CharacterId == TEXT("ryu")
                || CharacterId == TEXT("sera"))
            {
                if (!Combat->RequestSystemDodge(Profile.Skill2Stamina)) return false;
                Skill2CooldownRemaining = Profile.Skill2Cooldown;
                OnAbilityActivated.Broadcast(CharacterId, Slot, 0.f);
                return true;
            }

            if (CharacterId == TEXT("kain"))
            {
                if (!Combat->TrySpendStamina(Profile.Skill2Stamina)) return false;
                Skill2CooldownRemaining = Profile.Skill2Cooldown;
                Combat->ApplyDamageReduction(0.60f, 3.f);
                OnAbilityActivated.Broadcast(CharacterId, Slot, 0.f);
                return true;
            }
            break;

        case EHWAbilitySlot::Skill3:
            if (Skill3CooldownRemaining > 0.f
                || !Combat->TrySpendStamina(Profile.Skill3Stamina)) return false;
            Skill3CooldownRemaining = Profile.Skill3Cooldown;
            Multiplier = Profile.Skill3Multiplier;
            Tier = CharacterId == TEXT("kain")
                ? EHWAttackTier::Stagger
                : EHWAttackTier::Finisher;
            break;

        case EHWAbilitySlot::Skill4:
            if (Skill4CooldownRemaining > 0.f
                || !Combat->TrySpendStamina(Profile.Skill4Stamina)) return false;
            Skill4CooldownRemaining = Profile.Skill4Cooldown;

            if (CharacterId == TEXT("ain"))
                Combat->ApplyDamageReduction(0.50f, 2.f);
            else if (CharacterId == TEXT("ryu"))
                Combat->ApplyDamageReduction(0.40f, 2.f);
            else if (CharacterId == TEXT("sera"))
            {
                Combat->Heal(Combat->GetMaxHealth() * 0.15f);
                Combat->ApplyDamageReduction(0.50f, 3.f);
            }
            else if (CharacterId == TEXT("kain"))
            {
                Multiplier = Profile.Skill4Multiplier;
                Tier = EHWAttackTier::Stagger;
                break;
            }

            OnAbilityActivated.Broadcast(CharacterId, Slot, 0.f);
            return true;

        case EHWAbilitySlot::Ultimate:
            if (UltimateCooldownRemaining > 0.f
                || UltimateGauge < Profile.UltimateGaugeCost) return false;
            UltimateCooldownRemaining = 18.f;
            UltimateGauge -= Profile.UltimateGaugeCost;
            Multiplier = Profile.UltimateMultiplier;
            Tier = EHWAttackTier::Smash;
            break;

        default:
            return false;
    }

    if (OwnerCharacter->GetLockOn())
    {
        AActor* Target = OwnerCharacter->GetLockOn()->GetTarget();
        if (Target && Target->GetClass()->ImplementsInterface(UHWCombatTargetInterface::StaticClass()))
        {
            const float Damage = ResolveBaseDamage() * Multiplier;
            IHWCombatTargetInterface::Execute_ReceiveSystemHit(
                Target,
                Damage,
                Tier,
                OwnerCharacter->GetActorLocation(),
                OwnerCharacter);

            if (UWorld* World = GetWorld())
            {
                if (UHWCoopCombatSubsystem* Coop =
                    World->GetSubsystem<UHWCoopCombatSubsystem>())
                {
                    const float ThreatMultiplier =
                        CharacterId == TEXT("kain") ? 1.25f : 1.f;
                    Coop->AddThreatFromDamage(
                        OwnerCharacter,
                        Damage,
                        ThreatMultiplier);
                }
            }
        }
    }

    OnAbilityActivated.Broadcast(CharacterId, Slot, Multiplier);
    BroadcastGauge();
    return true;
}

void UHWCharacterKitComponent::HandleContact(
    EHWActionType Action,
    EHWAttackTier Tier,
    float Damage)
{
    if (GetWorld() && GetWorld()->GetGameInstance())
    {
        if (UHWRaidNetworkSubsystem* Network =
            GetWorld()->GetGameInstance()->GetSubsystem<UHWRaidNetworkSubsystem>())
        {
            if (Network->IsRaidActive())
            {
                return;
            }
        }
    }
    GrantCombatGauge(Tier);
}

void UHWCharacterKitComponent::GrantCombatGauge(EHWAttackTier Tier)
{
    const FHWCharacterSystemProfile Profile =
        UHWSystemRulesLibrary::CharacterProfile(CharacterId);

    float UniqueGain = Profile.UniqueGainOnHit;
    float UltimateGain = Profile.UltimateGainOnHit;

    if (Tier == EHWAttackTier::Finisher)
    {
        UniqueGain *= 1.25f;
        UltimateGain *= 1.35f;
    }
    else if (Tier == EHWAttackTier::Smash || Tier == EHWAttackTier::Counter)
    {
        UniqueGain *= 1.5f;
        UltimateGain *= 1.6f;
    }

    UniqueGauge = FMath::Min(Profile.MaxUniqueGauge, UniqueGauge + UniqueGain);
    UltimateGauge = FMath::Min(Profile.UltimateGaugeCost, UltimateGauge + UltimateGain);
    BroadcastGauge();
}

void UHWCharacterKitComponent::BroadcastGauge()
{
    OnGaugeChanged.Broadcast(CharacterId, UniqueGauge, UltimateGauge);
}
