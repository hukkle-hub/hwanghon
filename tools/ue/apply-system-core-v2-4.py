#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path.cwd()

def P(path):
    return ROOT / path

def read(path):
    return P(path).read_text(encoding='utf-8')

def write(path, text):
    P(path).write_text(text, encoding='utf-8')

def replace_once(path, old, new, label):
    s = read(path)
    if new in s:
        print('OK', label)
        return
    if old not in s:
        raise SystemExit(f'context changed: {label} ({path})')
    write(path, s.replace(old, new, 1))
    print('APPLY', label)

# -----------------------------------------------------------------------------
# 1) Character identity data: actual sheet stats, not cosmetic-only classes.
# -----------------------------------------------------------------------------
path='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWSystemTypes.h'
s=read(path)
if 'float BaseHealth = 24450.f;' not in s:
    anchor='''    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n    EHWSystemRole Role = EHWSystemRole::Damage;\n'''
    extra='''\n    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n    float BaseHealth = 24450.f;\n\n    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n    float BaseAttack = 2980.f;\n\n    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n    float BaseDefense = 1780.f;\n\n    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n    float CritChancePercent = 18.2f;\n\n    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n    float CritDamagePercent = 142.6f;\n\n    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n    float AttackSpeedPercent = 112.5f;\n\n    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n    float MoveSpeedPercent = 105.f;\n'''
    if anchor not in s: raise SystemExit('character profile role anchor changed')
    s=s.replace(anchor,anchor+extra,1)
    write(path,s); print('APPLY character base stat fields')

path='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWSystemRulesLibrary.cpp'
s=read(path)
profiles={
'ain':'''        P.BaseHealth = 24450.f;\n        P.BaseAttack = 2980.f;\n        P.BaseDefense = 1780.f;\n        P.CritChancePercent = 18.2f;\n        P.CritDamagePercent = 142.6f;\n        P.AttackSpeedPercent = 112.5f;\n        P.MoveSpeedPercent = 105.f;\n''',
'kain':'''        P.BaseHealth = 38200.f;\n        P.BaseAttack = 3410.f;\n        P.BaseDefense = 2960.f;\n        P.CritChancePercent = 9.4f;\n        P.CritDamagePercent = 118.f;\n        P.AttackSpeedPercent = 96.f;\n        P.MoveSpeedPercent = 98.f;\n''',
'ryu':'''        P.BaseHealth = 21800.f;\n        P.BaseAttack = 2640.f;\n        P.BaseDefense = 1520.f;\n        P.CritChancePercent = 22.6f;\n        P.CritDamagePercent = 151.f;\n        P.AttackSpeedPercent = 124.f;\n        P.MoveSpeedPercent = 112.f;\n''',
'sera':'''        P.BaseHealth = 19600.f;\n        P.BaseAttack = 1480.f;\n        P.BaseDefense = 1610.f;\n        P.CritChancePercent = 6.f;\n        P.CritDamagePercent = 110.f;\n        P.AttackSpeedPercent = 100.f;\n        P.MoveSpeedPercent = 104.f;\n''',
}
roles={'ain':'Damage','kain':'Bruiser','ryu':'Breaker','sera':'Support'}
for cid,block in profiles.items():
    if block.strip() in s: continue
    needle=f'        P.Role = EHWSystemRole::{roles[cid]};\n'
    # Restrict replacement to the correct character block.
    start=s.find(f'CharacterId == TEXT("{cid}")')
    if start<0: raise SystemExit(f'profile block missing: {cid}')
    pos=s.find(needle,start)
    if pos<0: raise SystemExit(f'role line missing: {cid}')
    pos += len(needle)
    s=s[:pos]+block+s[pos:]
write(path,s); print('APPLY character sheet values')

# -----------------------------------------------------------------------------
# 2) Combat component: per-character HP/ATK/DEF/crit/ASPD and isolated tuning.
# -----------------------------------------------------------------------------
path='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Combat/HWCombatComponent.h'
s=read(path)
if 'void ConfigureCharacterStats(' not in s:
    anchor='''    UFUNCTION(BlueprintCallable)\n    bool RequestSystemDodge(float StaminaCost);'''
    extra='''\n\n    UFUNCTION(BlueprintCallable)\n    void ConfigureCharacterStats(\n        float NewMaxHealth,\n        float NewBaseAttack,\n        float NewDefense,\n        float NewCritChancePercent,\n        float NewCritDamagePercent,\n        float NewAttackSpeedPercent);\n\n    UFUNCTION(BlueprintCallable)\n    void ArmGuaranteedCritical() { bGuaranteedCritical = true; }\n\n    UFUNCTION(BlueprintCallable)\n    float ResolveOutgoingDamage(float BaseDamage);\n\n    UFUNCTION(BlueprintPure)\n    float GetBaseAttack() const { return BaseAttack; }\n\n    UFUNCTION(BlueprintPure)\n    float GetDefense() const { return Defense; }\n\n    UFUNCTION(BlueprintPure)\n    float GetAttackSpeedMultiplier() const { return AttackSpeedMultiplier; }'''
    if anchor not in s: raise SystemExit('combat RequestSystemDodge declaration changed')
    s=s.replace(anchor,anchor+extra,1)
if 'float BaseAttack = 2980.f;' not in s:
    anchor='''    float DamageReductionRemaining = 0.f;\n    float DamageReductionFraction = 0.f;'''
    extra='''\n    float BaseAttack = 2980.f;\n    float Defense = 1780.f;\n    float CritChance = 0.182f;\n    float CritDamageMultiplier = 1.426f;\n    float AttackSpeedMultiplier = 1.f;\n    bool bGuaranteedCritical = false;'''
    if anchor not in s: raise SystemExit('combat private stat anchor changed')
    s=s.replace(anchor,anchor+extra,1)
write(path,s); print('APPLY combat character-stat API')

path='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Combat/HWCombatComponent.cpp'
s=read(path)
if 'DuplicateObject<UHWCombatTuningAsset>(Tuning, this)' not in s:
    old='''    if (!Tuning)\n    {\n        Tuning = NewObject<UHWCombatTuningAsset>(this, TEXT("RuntimeCombatTuning"));\n    }\n\n    Health = Tuning->MaxHealth;'''
    new='''    if (Tuning)\n    {\n        // Each pawn owns a runtime copy; per-character damage/HP edits must not leak.\n        Tuning = DuplicateObject<UHWCombatTuningAsset>(Tuning, this);\n    }\n    else\n    {\n        Tuning = NewObject<UHWCombatTuningAsset>(this, TEXT("RuntimeCombatTuning"));\n    }\n\n    Health = Tuning->MaxHealth;'''
    if old not in s: raise SystemExit('combat BeginPlay tuning block changed')
    s=s.replace(old,new,1)
if 'const float ActionClockScale =' not in s:
    old='    ActionElapsed += DeltaTime;'
    new='''    const float ActionClockScale =\n        (IsAttackAction(CurrentAction)\n            || CurrentAction == EHWActionType::Smash\n            || CurrentAction == EHWActionType::Counter)\n        ? AttackSpeedMultiplier : 1.f;\n    ActionElapsed += DeltaTime * ActionClockScale;'''
    if old not in s: raise SystemExit('combat ActionElapsed context changed')
    s=s.replace(old,new,1)
if 'ResolveOutgoingDamage(Spec.Damage)' not in s:
    old='        OnContact.Broadcast(CurrentAction, Spec.Tier, Spec.Damage);'
    new='''        const float OutgoingDamage = ResolveOutgoingDamage(Spec.Damage);\n        OnContact.Broadcast(CurrentAction, Spec.Tier, OutgoingDamage);'''
    if old not in s: raise SystemExit('combat contact broadcast changed')
    s=s.replace(old,new,1)
if 'const float DefenseReduction =' not in s:
    old='''    const float AppliedDamage = FMath::Max(0.f, Damage) * (1.f - FMath::Clamp(DamageReductionFraction, 0.f, 0.90f));'''
    new='''    const float DefenseReduction = FMath::Min(\n        0.25f,\n        Defense / FMath::Max(1.f, Defense + 5000.f));\n    const float AppliedDamage =\n        FMath::Max(0.f, Damage)\n        * (1.f - DefenseReduction)\n        * (1.f - FMath::Clamp(DamageReductionFraction, 0.f, 0.90f));'''
    if old not in s: raise SystemExit('combat incoming damage formula changed')
    s=s.replace(old,new,1)
if 'float UHWCombatComponent::ResolveOutgoingDamage(' not in s:
    marker='void UHWCombatComponent::ApplyHitStop(float Seconds)\n{'
    impl='''float UHWCombatComponent::ResolveOutgoingDamage(float BaseDamage)\n{\n    const bool bCritical =\n        bGuaranteedCritical\n        || FMath::FRand() < FMath::Clamp(CritChance, 0.f, 1.f);\n    bGuaranteedCritical = false;\n    return FMath::Max(0.f, BaseDamage)\n        * (bCritical ? CritDamageMultiplier : 1.f);\n}\n\nvoid UHWCombatComponent::ConfigureCharacterStats(\n    float NewMaxHealth,\n    float NewBaseAttack,\n    float NewDefense,\n    float NewCritChancePercent,\n    float NewCritDamagePercent,\n    float NewAttackSpeedPercent)\n{\n    if (!Tuning || bDead) return;\n\n    BaseAttack = FMath::Max(1.f, NewBaseAttack);\n    Defense = FMath::Max(0.f, NewDefense);\n    CritChance = FMath::Clamp(NewCritChancePercent / 100.f, 0.f, 1.f);\n    CritDamageMultiplier = FMath::Max(1.f, NewCritDamagePercent / 100.f);\n    AttackSpeedMultiplier =\n        FMath::Clamp(NewAttackSpeedPercent / 100.f, 0.70f, 1.40f);\n\n    Tuning->MaxHealth = FMath::Max(1.f, NewMaxHealth);\n    Health = Tuning->MaxHealth;\n\n    // Existing Ain graybox ratios, scaled from each character's sheet ATK.\n    Tuning->Attack1.Damage = BaseAttack * 0.386f;\n    Tuning->Attack2.Damage = BaseAttack * 0.419f;\n    Tuning->Attack3.Damage = BaseAttack * 0.537f;\n    Tuning->Smash.Damage = BaseAttack * 0.872f;\n}\n\n'''
    if marker not in s: raise SystemExit('combat ApplyHitStop definition changed')
    s=s.replace(marker,impl+marker,1)
write(path,s); print('APPLY combat runtime character identity')

# -----------------------------------------------------------------------------
# 3) Character kit: apply stats + server-like delayed/multi-hit skill contacts.
# -----------------------------------------------------------------------------
path='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWCharacterKitComponent.h'
s=read(path)
if 'struct FHWPendingAbilityHit' not in s:
    insert='''\nstruct FHWPendingAbilityHit\n{\n    float AtSeconds = 0.f;\n    float DamageMultiplier = 1.f;\n    EHWAttackTier Tier = EHWAttackTier::Finisher;\n    bool bAoe = false;\n    float PartDamageMultiplier = 1.f;\n    float ExtraPosture = 0.f;\n};\n\n'''
    pos=s.find('UCLASS(ClassGroup=(Hwanghon)')
    if pos<0: raise SystemExit('character kit class marker changed')
    s=s[:pos]+insert+s[pos:]
if 'void QueueAbilityHits(' not in s:
    old='''    bool Activate(EHWAbilitySlot Slot);\n    void GrantCombatGauge(EHWAttackTier Tier);\n    float ResolveBaseDamage() const;\n    void BroadcastGauge();'''
    new='''    bool Activate(EHWAbilitySlot Slot);\n    void QueueAbilityHits(\n        EHWAbilitySlot Slot,\n        const FHWCharacterSystemProfile& Profile,\n        float AbilityMultiplier,\n        EHWAttackTier DefaultTier);\n    void QueueHit(\n        float SourceAtSeconds,\n        float DamageMultiplier,\n        EHWAttackTier Tier,\n        bool bAoe = false,\n        float PartDamageMultiplier = 1.f,\n        float ExtraPosture = 0.f);\n    void TickPendingHits(float DeltaTime);\n    void ResolvePendingHit(const FHWPendingAbilityHit& Hit);\n    bool ApplyHitToTarget(AActor* Target, const FHWPendingAbilityHit& Hit);\n    void GrantCombatGauge(EHWAttackTier Tier);\n    float ResolveBaseDamage() const;\n    void BroadcastGauge();'''
    if old not in s: raise SystemExit('character kit private methods changed')
    s=s.replace(old,new,1)
if 'TArray<FHWPendingAbilityHit> PendingHits;' not in s:
    old='    float UltimateCooldownRemaining = 0.f;'
    new='''    float UltimateCooldownRemaining = 0.f;\n    float PendingAbilityElapsed = 0.f;\n    TArray<FHWPendingAbilityHit> PendingHits;'''
    if old not in s: raise SystemExit('character kit cooldown tail changed')
    s=s.replace(old,new,1)
write(path,s); print('APPLY character kit pending-hit contract')

path='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWCharacterKitComponent.cpp'
s=read(path)
for inc in [
    '#include "System/HWBossPartTarget.h"',
    '#include "System/HWBossSystemComponent.h"',
    '#include "Kismet/GameplayStatics.h"',
    '#include "GameFramework/CharacterMovementComponent.h"',
]:
    if inc not in s:
        s=s.replace('#include "Engine/GameInstance.h"','#include "Engine/GameInstance.h"\n'+inc,1)
if 'TickPendingHits(DeltaTime);' not in s:
    old='    UltimateCooldownRemaining = FMath::Max(0.f, UltimateCooldownRemaining - DeltaTime);'
    if old not in s: raise SystemExit('character kit cooldown tick changed')
    s=s.replace(old,old+'\n    TickPendingHits(DeltaTime);',1)
if 'Combat->ConfigureCharacterStats(' not in s:
    old='''    UltimateCooldownRemaining = 0.f;\n    BroadcastGauge();'''
    new='''    UltimateCooldownRemaining = 0.f;\n    PendingAbilityElapsed = 0.f;\n    PendingHits.Reset();\n\n    const FHWCharacterSystemProfile Profile =\n        UHWSystemRulesLibrary::CharacterProfile(CharacterId);\n\n    if (Combat)\n    {\n        Combat->ConfigureCharacterStats(\n            Profile.BaseHealth,\n            Profile.BaseAttack,\n            Profile.BaseDefense,\n            Profile.CritChancePercent,\n            Profile.CritDamagePercent,\n            Profile.AttackSpeedPercent);\n    }\n\n    if (OwnerCharacter && OwnerCharacter->GetCharacterMovement())\n    {\n        constexpr float BaseWalkSpeed = 520.f;\n        OwnerCharacter->GetCharacterMovement()->MaxWalkSpeed =\n            BaseWalkSpeed * FMath::Clamp(Profile.MoveSpeedPercent / 100.f, 0.75f, 1.35f);\n    }\n\n    BroadcastGauge();'''
    if old not in s: raise SystemExit('character ConfigureCharacter tail changed')
    s=s.replace(old,new,1)
if 'return Combat ? FMath::Max(1.f, Combat->GetBaseAttack())' not in s:
    old='''float UHWCharacterKitComponent::ResolveBaseDamage() const\n{\n    if (!Combat || !Combat->Tuning) return 1000.f;\n    return FMath::Max(1.f, Combat->Tuning->Attack1.Damage);\n}'''
    new='''float UHWCharacterKitComponent::ResolveBaseDamage() const\n{\n    return Combat ? FMath::Max(1.f, Combat->GetBaseAttack()) : 1000.f;\n}'''
    if old not in s: raise SystemExit('character ResolveBaseDamage changed')
    s=s.replace(old,new,1)
# Dodge skills grant next guaranteed crit, matching server critNext.
old='''                if (!Combat->RequestSystemDodge(Profile.Skill2Stamina)) return false;\n                Skill2CooldownRemaining = Profile.Skill2Cooldown;\n                OnAbilityActivated.Broadcast(CharacterId, Slot, 0.f);'''
new='''                if (!Combat->RequestSystemDodge(Profile.Skill2Stamina)) return false;\n                Skill2CooldownRemaining = Profile.Skill2Cooldown;\n                Combat->ArmGuaranteedCritical();\n                OnAbilityActivated.Broadcast(CharacterId, Slot, 0.f);'''
if old in s and new not in s: s=s.replace(old,new,1)
# Sera local support affects nearby living party members.
old='''            else if (CharacterId == TEXT("sera"))\n            {\n                Combat->Heal(Combat->GetMaxHealth() * 0.15f);\n                Combat->ApplyDamageReduction(0.50f, 3.f);\n            }'''
new='''            else if (CharacterId == TEXT("sera"))\n            {\n                constexpr float SupportRadiusCm = 520.f;\n                bool bApplied = false;\n                if (UWorld* World = GetWorld())\n                {\n                    if (UHWCoopCombatSubsystem* Coop =\n                        World->GetSubsystem<UHWCoopCombatSubsystem>())\n                    {\n                        for (const FHWCoopCombatantView& View : Coop->GetCombatants())\n                        {\n                            AHWAinCharacter* Ally = View.Character;\n                            if (!Ally || !View.bAlive || !Ally->GetCombat()) continue;\n                            if (FVector::DistSquared2D(\n                                    OwnerCharacter->GetActorLocation(),\n                                    Ally->GetActorLocation())\n                                > FMath::Square(SupportRadiusCm)) continue;\n\n                            UHWCombatComponent* AllyCombat = Ally->GetCombat();\n                            AllyCombat->Heal(AllyCombat->GetMaxHealth() * 0.15f);\n                            AllyCombat->ApplyDamageReduction(0.50f, 3.f);\n                            bApplied = true;\n                        }\n                    }\n                }\n                if (!bApplied)\n                {\n                    Combat->Heal(Combat->GetMaxHealth() * 0.15f);\n                    Combat->ApplyDamageReduction(0.50f, 3.f);\n                }\n            }'''
if old in s and new not in s: s=s.replace(old,new,1)
# Replace immediate single hit with queued server-like contacts.
old='''    if (OwnerCharacter->GetLockOn())\n    {\n        AActor* Target = OwnerCharacter->GetLockOn()->GetTarget();\n        if (Target && Target->GetClass()->ImplementsInterface(UHWCombatTargetInterface::StaticClass()))\n        {\n            const float Damage = ResolveBaseDamage() * Multiplier;\n            IHWCombatTargetInterface::Execute_ReceiveSystemHit(\n                Target,\n                Damage,\n                Tier,\n                OwnerCharacter->GetActorLocation(),\n                OwnerCharacter);\n\n            if (UWorld* World = GetWorld())\n            {\n                if (UHWCoopCombatSubsystem* Coop =\n                    World->GetSubsystem<UHWCoopCombatSubsystem>())\n                {\n                    const float ThreatMultiplier =\n                        CharacterId == TEXT("kain") ? 1.25f : 1.f;\n                    Coop->AddThreatFromDamage(\n                        OwnerCharacter,\n                        Damage,\n                        ThreatMultiplier);\n                }\n            }\n        }\n    }\n\n    OnAbilityActivated.Broadcast(CharacterId, Slot, Multiplier);'''
new='''    QueueAbilityHits(Slot, Profile, Multiplier, Tier);\n\n    OnAbilityActivated.Broadcast(CharacterId, Slot, Multiplier);'''
if old in s:
    s=s.replace(old,new,1)
elif 'QueueAbilityHits(Slot, Profile, Multiplier, Tier);' not in s:
    raise SystemExit('character Activate damage tail changed')
if 'void UHWCharacterKitComponent::QueueHit(' not in s:
    marker='void UHWCharacterKitComponent::HandleContact('
    if marker not in s: raise SystemExit('character HandleContact marker changed')
    helpers=r'''void UHWCharacterKitComponent::QueueHit(
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

'''
    s=s.replace(marker,helpers+marker,1)
write(path,s); print('APPLY character skill contact parity')

# -----------------------------------------------------------------------------
# 4) Local boss part/posture hooks used by Kain's system skills.
# -----------------------------------------------------------------------------
path='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWBossPartTarget.h'
s=read(path)
if 'GetBossCharacter() const' not in s:
    s=s.replace('''    UFUNCTION(BlueprintPure)\n    FName GetPartId() const { return PartId; }''','''    UFUNCTION(BlueprintPure)\n    FName GetPartId() const { return PartId; }\n\n    UFUNCTION(BlueprintPure)\n    class AHWBossCharacter* GetBossCharacter() const { return Boss; }''',1)
if 'ReceiveWeightedSystemHit(' not in s:
    anchor='''    UFUNCTION(BlueprintCallable)\n    void SetAuthoritativeBroken(bool bInBroken);'''
    extra='''\n\n    UFUNCTION(BlueprintCallable)\n    bool ReceiveWeightedSystemHit(\n        float Damage,\n        EHWAttackTier Tier,\n        FVector SourceLocation,\n        AActor* InstigatorActor,\n        float PartDamageMultiplier);'''
    if anchor not in s: raise SystemExit('boss part authoritative marker changed')
    s=s.replace(anchor,anchor+extra,1)
write(path,s)

path='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWBossPartTarget.cpp'
s=read(path)
if 'ReceiveWeightedSystemHit(' not in s:
    start=s.find('bool AHWBossPartTarget::ReceiveSystemHit_Implementation(')
    if start<0: raise SystemExit('boss part ReceiveSystemHit missing')
    end=s.find('\n}\n',start)
    if end<0: raise SystemExit('boss part ReceiveSystemHit end missing')
    end+=3
    new=r'''bool AHWBossPartTarget::ReceiveSystemHit_Implementation(
    float Damage,
    EHWAttackTier Tier,
    FVector SourceLocation,
    AActor* InstigatorActor)
{
    return ReceiveWeightedSystemHit(
        Damage, Tier, SourceLocation, InstigatorActor, 1.f);
}

bool AHWBossPartTarget::ReceiveWeightedSystemHit(
    float Damage,
    EHWAttackTier Tier,
    FVector SourceLocation,
    AActor* InstigatorActor,
    float PartDamageMultiplier)
{
    if (bBroken || !Boss || Boss->IsDead() || Damage <= 0.f) return false;

    if (UHWBossSystemComponent* System = Boss->GetBossSystem())
    {
        const bool bJustBroken = System->DamagePart(
            PartId,
            Damage * FMath::Max(0.f, PartDamageMultiplier));
        if (bJustBroken)
        {
            bBroken = true;
            Tags.Remove(TEXT("LockOnTarget"));
            SetActorEnableCollision(false);
        }
    }

    Boss->ReceivePlayerHit(Damage * DamageToBossScale, Tier, SourceLocation);
    return true;
}
'''
    s=s[:start]+new+s[end:]
write(path,s)

path='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWBossSystemComponent.h'
s=read(path)
if 'void AddExternalPosture(' not in s:
    anchor='''    UFUNCTION(BlueprintCallable)\n    bool DamagePart(FName PartId, float Damage);'''
    extra='''\n\n    UFUNCTION(BlueprintCallable)\n    void AddExternalPosture(float Amount, FVector SourceLocation);'''
    if anchor not in s: raise SystemExit('boss system DamagePart declaration changed')
    s=s.replace(anchor,anchor+extra,1)
write(path,s)

path='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWBossSystemComponent.cpp'
s=read(path)
if 'void UHWBossSystemComponent::AddExternalPosture(' not in s:
    marker='float UHWBossSystemComponent::TierPosture'
    impl='''void UHWBossSystemComponent::AddExternalPosture(\n    float Amount,\n    FVector SourceLocation)\n{\n    AddPosture(FMath::Max(0.f, Amount), SourceLocation);\n}\n\n'''
    if marker not in s: raise SystemExit('boss system TierPosture marker changed')
    s=s.replace(marker,impl+marker,1)
write(path,s); print('APPLY local boss part/posture hooks')

# -----------------------------------------------------------------------------
# 5) Server authority: base DEF/crit/MSPD, Kain threat, Sera party ward.
# -----------------------------------------------------------------------------
path='server/store.cjs'
s=read(path)
old=" stats(p){if(typeof p==='string')p=this.get(p);const level=1+Math.floor(p.xp/1200),base=(C.characters[p.character]||C.character).stats;let hp=base.hp+(level-1)*150,defense=0;for(const id of Object.values(p.equipment||{})){const item=C.equipment.find(i=>i.id===id);if(item&&item.type!=='weapon'){hp+=item.stats.hp||0;defense+=item.stats.def||0;}}return {hp,atk:base.atk+(level-1)*15,aspd:base.aspd,defense};}"
new=" stats(p){if(typeof p==='string')p=this.get(p);const level=1+Math.floor(p.xp/1200),base=(C.characters[p.character]||C.character).stats;let hp=base.hp+(level-1)*150,defense=base.def||0;for(const id of Object.values(p.equipment||{})){const item=C.equipment.find(i=>i.id===id);if(item&&item.type!=='weapon'){hp+=item.stats.hp||0;defense+=item.stats.def||0;}}return {hp,atk:base.atk+(level-1)*15,aspd:base.aspd,mspd:base.mspd,defense,critChance:(base.crit||0)/100,critDamage:(base.critDmg||100)/100,moveMult:(base.mspd||100)/100,threatMult:p.character==='kain'?1.25:1};}"
if new not in s:
    if old not in s: raise SystemExit('server store.stats context changed')
    s=s.replace(old,new,1)
write(path,s); print('APPLY authoritative character stats')

path='server/raid.cjs'
s=read(path)
old='p.damage+=amount;p.threat+=amount;this.event(\'hit\''
new='p.damage+=amount;p.threat+=amount*(p.stats.threatMult||1);this.event(\'hit\''
if new not in s:
    if old not in s: raise SystemExit('server threat context changed')
    s=s.replace(old,new,1)
old="else if(k.buff){p.buffT=k.buff.dur;p.buffReduce=k.buff.reduce;if(k.ev?.type==='heal'){const h=Math.max(0,Math.min(p.maxHp-p.hp,Math.round(p.maxHp*k.ev.frac)));p.hp+=h;this.event('heal',{player:id,amount:h});}}"
new="else if(k.buff){const targets=p.character==='sera'&&k.ev?.type==='heal'?[...this.players.values()].filter(q=>this.alive(q)&&q.connected&&(q===p||this.world.dist(p.x,p.y,q.x,q.y)<=this.L.player.reach*2)&&this.world.lineOfSight(p.x,p.y,q.x,q.y)):[p];for(const q of targets){q.buffT=Math.max(q.buffT||0,k.buff.dur);q.buffReduce=Math.max(q.buffReduce||0,k.buff.reduce);if(k.ev?.type==='heal'){const h=Math.max(0,Math.min(q.maxHp-q.hp,Math.round(q.maxHp*k.ev.frac)));q.hp+=h;this.event('heal',{player:q.id,by:id,amount:h});}}}"
if new not in s:
    if old not in s: raise SystemExit('server Sera buff/heal context changed')
    s=s.replace(old,new,1)
write(path,s); print('APPLY Kain threat + Sera party support')

# -----------------------------------------------------------------------------
# 6) Online boss snapshot: max HP/posture/pattern/counterability/progress.
# -----------------------------------------------------------------------------
path='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Network/HWRaidNetworkSubsystem.h'
s=read(path)
if 'float TelegraphProgress = 0.f;' not in s:
    old='''    UPROPERTY(BlueprintReadOnly) float Windup = 0.f;\n    UPROPERTY(BlueprintReadOnly) bool bPatternCounterable = false;'''
    new='''    // `windup` from the server is normalized telegraph progress, not seconds.\n    UPROPERTY(BlueprintReadOnly) float TelegraphProgress = 0.f;\n    UPROPERTY(BlueprintReadOnly) float RecoveryRemaining = 0.f;\n    UPROPERTY(BlueprintReadOnly) float RecoveryDuration = 0.f;\n    UPROPERTY(BlueprintReadOnly) float LinkRemaining = 0.f;\n    UPROPERTY(BlueprintReadOnly) bool bPatternCounterable = false;'''
    if old not in s: raise SystemExit('raid boss windup field changed')
    s=s.replace(old,new,1)
write(path,s)

path='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Network/HWRaidNetworkSubsystem.cpp'
s=read(path)
old='Raid.Boss.State=Name(B,TEXT("state"));Raid.Boss.Windup=(float)ReadNumber(B,TEXT("windup"));Raid.Boss.bExecutable=ReadBool(B,TEXT("executable"));'
new='''Raid.Boss.State=Name(B,TEXT("state"));\n            Raid.Boss.TelegraphProgress=(float)ReadNumber(B,TEXT("windup"));\n            Raid.Boss.RecoveryRemaining=(float)ReadNumber(B,TEXT("recovery"));\n            Raid.Boss.RecoveryDuration=(float)ReadNumber(B,TEXT("recoveryDur"));\n            Raid.Boss.LinkRemaining=(float)ReadNumber(B,TEXT("linkT"));\n            Raid.Boss.bExecutable=ReadBool(B,TEXT("executable"));'''
if new not in s:
    if old not in s: raise SystemExit('raid boss parser context changed')
    s=s.replace(old,new,1)
write(path,s)

path='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Boss/HWBossCharacter.h'
s=read(path)
if 'AuthoritativeMaxHealth' not in s:
    old='''    UFUNCTION(BlueprintCallable)\n    void ApplyAuthoritativeSnapshot(float NewHealth, float NewMaxHealth, float NewPosture, FName StateName, bool bRaidClear);'''
    new='''    UFUNCTION(BlueprintCallable)\n    void ApplyAuthoritativeSnapshot(\n        float NewHealth,\n        float NewMaxHealth,\n        float NewPosture,\n        FName StateName,\n        FName PatternId,\n        bool bPatternCounterable,\n        float StateProgress,\n        bool bRaidClear);\n\n    UFUNCTION(BlueprintPure)\n    float GetMaxHealth() const\n    {\n        return bNetworkAuthoritative ? AuthoritativeMaxHealth : 280000.f;\n    }\n\n    UFUNCTION(BlueprintPure)\n    float GetPosture() const { return AuthoritativePosture; }\n\n    UFUNCTION(BlueprintPure)\n    bool IsCurrentPatternCounterable() const\n    {\n        return bNetworkAuthoritative\n            ? bAuthoritativePatternCounterable\n            : CurrentPattern.bCounterable;\n    }'''
    if old not in s: raise SystemExit('boss authoritative snapshot declaration changed')
    s=s.replace(old,new,1)
    s=s.replace('''    float SystemBreakDuration = 1.45f;\n    bool bNetworkAuthoritative = false;''','''    float SystemBreakDuration = 1.45f;\n    bool bNetworkAuthoritative = false;\n    float AuthoritativeMaxHealth = 280000.f;\n    float AuthoritativePosture = 0.f;\n    float AuthoritativeStateProgress = 0.f;\n    bool bAuthoritativePatternCounterable = false;''',1)
write(path,s)

path='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Boss/HWBossCharacter.cpp'
s=read(path)
old='''void AHWBossCharacter::ApplyAuthoritativeSnapshot(float NewHealth,float NewMaxHealth,float NewPosture,FName StateName,bool bRaidClear)\n{\n    bNetworkAuthoritative=true;\n    Health=FMath::Max(0.f,NewHealth);\n    EHWBossState NewState=State;'''
new='''void AHWBossCharacter::ApplyAuthoritativeSnapshot(\n    float NewHealth,\n    float NewMaxHealth,\n    float NewPosture,\n    FName StateName,\n    FName PatternId,\n    bool bPatternCounterable,\n    float StateProgress,\n    bool bRaidClear)\n{\n    bNetworkAuthoritative = true;\n    Health = FMath::Max(0.f, NewHealth);\n    AuthoritativeMaxHealth = FMath::Max(1.f, NewMaxHealth);\n    AuthoritativePosture = FMath::Max(0.f, NewPosture);\n    AuthoritativeStateProgress = FMath::Clamp(StateProgress, 0.f, 1.f);\n    bAuthoritativePatternCounterable = bPatternCounterable;\n    const FName PreviousPattern = CurrentPattern.Id;\n    CurrentPattern.Id = PatternId;\n    CurrentPattern.bCounterable = bPatternCounterable;\n    EHWBossState NewState=State;'''
if old not in s and new not in s: raise SystemExit('boss authoritative implementation prefix changed')
if old in s: s=s.replace(old,new,1)
# State change also fires when server pattern changes.
s=s.replace('''    if (NewState!=State)\n    {''','''    if (NewState != State || PreviousPattern != PatternId)\n    {''',1)
if 'return FMath::Clamp(AuthoritativeStateProgress' not in s:
    old='''float AHWBossCharacter::GetBossStateNormalized() const\n{\n    float Duration = 1.f;'''
    new='''float AHWBossCharacter::GetBossStateNormalized() const\n{\n    if (bNetworkAuthoritative)\n    {\n        return FMath::Clamp(AuthoritativeStateProgress, 0.f, 1.f);\n    }\n\n    float Duration = 1.f;'''
    if old not in s: raise SystemExit('boss normalized-state context changed')
    s=s.replace(old,new,1)
write(path,s)

path='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Network/HWRaidWorldBridge.cpp'
s=read(path)
old='BossActor->ApplyAuthoritativeSnapshot(B.Hp,B.MaxHp,B.Posture,B.State,RaidState==TEXT("clear"));'
new='''float StateProgress = 0.f;\n    if (B.State == TEXT("telegraph"))\n    {\n        StateProgress = FMath::Clamp(B.TelegraphProgress, 0.f, 1.f);\n    }\n    else if (B.State == TEXT("recover") && B.RecoveryDuration > KINDA_SMALL_NUMBER)\n    {\n        StateProgress = FMath::Clamp(\n            1.f - B.RecoveryRemaining / B.RecoveryDuration, 0.f, 1.f);\n    }\n    else if (B.State == TEXT("link"))\n    {\n        StateProgress = 0.5f;\n    }\n\n    BossActor->ApplyAuthoritativeSnapshot(\n        B.Hp, B.MaxHp, B.Posture, B.State,\n        FName(*B.PatternName), B.bPatternCounterable, StateProgress,\n        RaidState == TEXT("clear"));'''
if new not in s:
    if old not in s: raise SystemExit('world bridge boss snapshot call changed')
    s=s.replace(old,new,1)
write(path,s)

path='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/UI/HWCombatHUD.cpp'
s=read(path)
if 'BossMaxHealth = FMath::Max(1.f, Boss->GetMaxHealth());' not in s:
    s=s.replace('BossMaxHealth = FMath::Max(1.f, Boss->GetHealth());','BossMaxHealth = FMath::Max(1.f, Boss->GetMaxHealth());',1)
old='''    if (Boss.IsValid() && BossBar)\n    {\n        BossBar->SetPercent(Boss->GetHealth() / FMath::Max(1.f, BossMaxHealth));'''
new='''    if (Boss.IsValid() && BossBar)\n    {\n        BossMaxHealth = FMath::Max(1.f, Boss->GetMaxHealth());\n        BossBar->SetPercent(Boss->GetHealth() / BossMaxHealth);'''
if new not in s:
    if old not in s: raise SystemExit('HUD boss bar tick changed')
    s=s.replace(old,new,1)
write(path,s); print('APPLY online boss snapshot/HUD parity')

print('SYSTEM CORE v2.4 DELTA applied')
