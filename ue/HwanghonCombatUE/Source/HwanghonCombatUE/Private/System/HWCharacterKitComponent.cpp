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
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/GameplayStatics.h"
#include "System/HWBossSystemComponent.h"
#include "System/HWBossPartTarget.h"

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
    TickPendingHits(DeltaTime);
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
    PendingAbilityElapsed = 0.f;
    PendingHits.Reset();

    const FHWCharacterSystemProfile Profile =
        UHWSystemRulesLibrary::CharacterProfile(CharacterId);

    if (Combat)
    {
        Combat->ConfigureCharacterStats(
            Profile.BaseHealth,
            Profile.BaseAttack,
            Profile.BaseDefense,
            Profile.CritChancePercent,
            Profile.CritDamagePercent,
            Profile.AttackSpeedPercent);
    }

    if (OwnerCharacter && OwnerCharacter->GetCharacterMovement())
    {
        constexpr float BaseWalkSpeed = 520.f;
        OwnerCharacter->GetCharacterMovement()->MaxWalkSpeed =
            BaseWalkSpeed * FMath::Clamp(Profile.MoveSpeedPercent / 100.f, 0.75f, 1.35f);
    }

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
    if (!Combat) return 1000.f;
    if (Combat->GetBaseAttack() > 0.f) return Combat->GetBaseAttack();
    return Combat->Tuning ? FMath::Max(1.f, Combat->Tuning->Attack1.Damage) : 1000.f;   // sheet not applied
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
                Combat->ArmGuaranteedCritical();
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
                constexpr float SupportRadiusCm = 520.f;
                bool bApplied = false;
                if (UWorld* World = GetWorld())
                {
                    if (UHWCoopCombatSubsystem* Coop =
                        World->GetSubsystem<UHWCoopCombatSubsystem>())
                    {
                        for (const FHWCoopCombatantView& View : Coop->GetCombatants())
                        {
                            AHWAinCharacter* Ally = View.Character;
                            if (!Ally || !View.bAlive || !Ally->GetCombat()) continue;
                            if (FVector::DistSquared2D(
                                    OwnerCharacter->GetActorLocation(),
                                    Ally->GetActorLocation())
                                > FMath::Square(SupportRadiusCm)) continue;

                            UHWCombatComponent* AllyCombat = Ally->GetCombat();
                            AllyCombat->Heal(AllyCombat->GetMaxHealth() * 0.15f);
                            AllyCombat->ApplyDamageReduction(0.50f, 3.f);
                            bApplied = true;
                        }
                    }
                }
                if (!bApplied)
                {
                    Combat->Heal(Combat->GetMaxHealth() * 0.15f);
                    Combat->ApplyDamageReduction(0.50f, 3.f);
                }
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

    QueueAbilityHits(Slot, Profile, Multiplier, Tier);

    OnAbilityActivated.Broadcast(CharacterId, Slot, Multiplier);
    BroadcastGauge();
    return true;
}

void UHWCharacterKitComponent::QueueHit(
    float SourceAtSeconds,
    float DamageMultiplier,
    EHWAttackTier Tier,
    bool bAoe,
    float PartDamageMultiplier,
    float ExtraPosture)
{
    if (!Combat || DamageMultiplier <= 0.f) return;
    FHWPendingAbilityHit Hit;
    Hit.AtSeconds = FMath::Max(0.f, SourceAtSeconds)
        / FMath::Max(0.01f, Combat->GetAttackSpeedMultiplier());
    Hit.DamageMultiplier = DamageMultiplier;
    Hit.Tier = Tier;
    Hit.bAoe = bAoe;
    Hit.PartDamageMultiplier = FMath::Max(0.f, PartDamageMultiplier);
    Hit.ExtraPosture = FMath::Max(0.f, ExtraPosture);
    PendingHits.Add(Hit);
    PendingHits.Sort([](const FHWPendingAbilityHit& A, const FHWPendingAbilityHit& B)
    { return A.AtSeconds < B.AtSeconds; });
}

void UHWCharacterKitComponent::QueueAbilityHits(
    EHWAbilitySlot Slot,
    const FHWCharacterSystemProfile& Profile,
    float AbilityMultiplier,
    EHWAttackTier DefaultTier)
{
    if (AbilityMultiplier <= 0.f) return;
    if (PendingHits.IsEmpty()) PendingAbilityElapsed = 0.f;

    if (Slot == EHWAbilitySlot::Skill1)
    {
        if (CharacterId == TEXT("ain")) QueueHit(0.24f, AbilityMultiplier, DefaultTier);
        else if (CharacterId == TEXT("kain")) QueueHit(0.73f, AbilityMultiplier, EHWAttackTier::Smash, false, 1.5f);
        else if (CharacterId == TEXT("ryu"))
        {
            QueueHit(0.37f, AbilityMultiplier * 0.30f, DefaultTier);
            QueueHit(0.47f, AbilityMultiplier * 0.30f, DefaultTier);
            QueueHit(0.65f, AbilityMultiplier * 0.40f, DefaultTier);
        }
        else if (CharacterId == TEXT("sera")) QueueHit(0.57f, AbilityMultiplier, DefaultTier);
        return;
    }

    if (Slot == EHWAbilitySlot::Skill3)
    {
        if (CharacterId == TEXT("ain"))
        {
            QueueHit(0.55f, AbilityMultiplier * 0.55f, DefaultTier, true);
            QueueHit(0.80f, AbilityMultiplier * 0.45f, DefaultTier, true);
        }
        else if (CharacterId == TEXT("kain"))
        {
            QueueHit(0.38f, AbilityMultiplier * 0.55f, DefaultTier, true);
            QueueHit(0.60f, AbilityMultiplier * 0.45f, DefaultTier, true);
        }
        else if (CharacterId == TEXT("ryu"))
        {
            QueueHit(0.41f, AbilityMultiplier * 0.30f, DefaultTier, true);
            QueueHit(0.61f, AbilityMultiplier * 0.35f, DefaultTier, true);
            QueueHit(0.74f, AbilityMultiplier * 0.35f, DefaultTier, true);
        }
        else if (CharacterId == TEXT("sera"))
        {
            QueueHit(0.46f, AbilityMultiplier * 0.50f, DefaultTier, true);
            QueueHit(0.66f, AbilityMultiplier * 0.50f, DefaultTier, true);
        }
        return;
    }

    if (Slot == EHWAbilitySlot::Skill4 && CharacterId == TEXT("kain"))
    {
        QueueHit(0.33f, AbilityMultiplier, EHWAttackTier::Light, false, 1.f, 24.f);
        return;
    }

    if (Slot == EHWAbilitySlot::Ultimate)
    {
        if (CharacterId == TEXT("ain")) QueueHit(0.22f, AbilityMultiplier, EHWAttackTier::Smash);
        else if (CharacterId == TEXT("kain"))
        {
            QueueHit(0.22f, AbilityMultiplier * 0.35f, EHWAttackTier::Smash);
            QueueHit(0.89f, AbilityMultiplier * 0.65f, EHWAttackTier::Smash);
        }
        else if (CharacterId == TEXT("ryu"))
        {
            QueueHit(0.30f, AbilityMultiplier * 0.15f, EHWAttackTier::Finisher);
            QueueHit(0.38f, AbilityMultiplier * 0.15f, EHWAttackTier::Finisher);
            QueueHit(0.46f, AbilityMultiplier * 0.20f, EHWAttackTier::Finisher);
            QueueHit(0.57f, AbilityMultiplier * 0.20f, EHWAttackTier::Finisher);
            QueueHit(0.68f, AbilityMultiplier * 0.30f, EHWAttackTier::Smash);
        }
        else if (CharacterId == TEXT("sera")) QueueHit(0.58f, AbilityMultiplier, EHWAttackTier::Smash, true);
    }
}

void UHWCharacterKitComponent::TickPendingHits(float DeltaTime)
{
    if (PendingHits.IsEmpty()) { PendingAbilityElapsed = 0.f; return; }
    PendingAbilityElapsed += FMath::Max(0.f, DeltaTime);
    while (!PendingHits.IsEmpty()
        && PendingHits[0].AtSeconds <= PendingAbilityElapsed + KINDA_SMALL_NUMBER)
    {
        const FHWPendingAbilityHit Hit = PendingHits[0];
        PendingHits.RemoveAt(0);
        ResolvePendingHit(Hit);
    }
    if (PendingHits.IsEmpty()) PendingAbilityElapsed = 0.f;
}

bool UHWCharacterKitComponent::ApplyHitToTarget(AActor* Target, const FHWPendingAbilityHit& Hit)
{
    if (!Target || !OwnerCharacter
        || !Target->GetClass()->ImplementsInterface(UHWCombatTargetInterface::StaticClass())) return false;

    const float Damage = Combat->ResolveOutgoingDamage(
        ResolveBaseDamage() * Hit.DamageMultiplier);
    bool bApplied = false;

    if (AHWBossPartTarget* Part = Cast<AHWBossPartTarget>(Target))
    {
        bApplied = Part->ReceiveWeightedSystemHit(
            Damage, Hit.Tier, OwnerCharacter->GetActorLocation(), OwnerCharacter,
            Hit.PartDamageMultiplier);
        if (bApplied && Hit.ExtraPosture > 0.f)
        {
            if (AHWBossCharacter* Boss = Part->GetBossCharacter())
                if (UHWBossSystemComponent* System = Boss->GetBossSystem())
                    System->AddExternalPosture(Hit.ExtraPosture, OwnerCharacter->GetActorLocation());
        }
    }
    else
    {
        bApplied = IHWCombatTargetInterface::Execute_ReceiveSystemHit(
            Target, Damage, Hit.Tier, OwnerCharacter->GetActorLocation(), OwnerCharacter);
        if (bApplied && Hit.ExtraPosture > 0.f)
            if (AHWBossCharacter* Boss = Cast<AHWBossCharacter>(Target))
                if (UHWBossSystemComponent* System = Boss->GetBossSystem())
                    System->AddExternalPosture(Hit.ExtraPosture, OwnerCharacter->GetActorLocation());
    }

    if (bApplied)
        if (UWorld* World = GetWorld())
            if (UHWCoopCombatSubsystem* Coop = World->GetSubsystem<UHWCoopCombatSubsystem>())
                Coop->AddThreatFromDamage(
                    OwnerCharacter, Damage, CharacterId == TEXT("kain") ? 1.25f : 1.f);
    return bApplied;
}

void UHWCharacterKitComponent::ResolvePendingHit(const FHWPendingAbilityHit& Hit)
{
    if (!OwnerCharacter || !Combat || Combat->IsDead()) return;

    AActor* Locked = OwnerCharacter->GetLockOn()
        ? OwnerCharacter->GetLockOn()->GetTarget() : nullptr;

    if (!Hit.bAoe)
    {
        ApplyHitToTarget(Locked, Hit);
        return;
    }

    TSet<AHWBossCharacter*> DamagedBosses;
    if (Locked)
    {
        if (ApplyHitToTarget(Locked, Hit))
        {
            if (AHWBossPartTarget* Part = Cast<AHWBossPartTarget>(Locked))
                if (AHWBossCharacter* Boss = Part->GetBossCharacter()) DamagedBosses.Add(Boss);
            if (AHWBossCharacter* Boss = Cast<AHWBossCharacter>(Locked)) DamagedBosses.Add(Boss);
        }
    }

    TArray<AActor*> Candidates;
    UGameplayStatics::GetAllActorsWithTag(this, TEXT("LockOnTarget"), Candidates);
    constexpr float AoeRadiusCm = 650.f;

    for (AActor* Actor : Candidates)
    {
        if (!Actor || Actor == OwnerCharacter || Actor == Locked) continue;
        if (FVector::DistSquared2D(OwnerCharacter->GetActorLocation(), Actor->GetActorLocation())
            > FMath::Square(AoeRadiusCm)) continue;

        AHWBossCharacter* BossOwner = nullptr;
        if (AHWBossPartTarget* Part = Cast<AHWBossPartTarget>(Actor)) BossOwner = Part->GetBossCharacter();
        else BossOwner = Cast<AHWBossCharacter>(Actor);
        if (BossOwner && DamagedBosses.Contains(BossOwner)) continue;

        if (ApplyHitToTarget(Actor, Hit) && BossOwner) DamagedBosses.Add(BossOwner);
    }
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
