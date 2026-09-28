#!/usr/bin/env python3
from pathlib import Path

ROOT=Path.cwd()
def path(p): return ROOT/p
def read(p): return path(p).read_text(encoding='utf-8')
def write(p,s): path(p).write_text(s,encoding='utf-8')

# Build module
build='ue/HwanghonCombatUE/Source/HwanghonCombatUE/HwanghonCombatUE.Build.cs'
s=read(build)
if '"WebSockets"' not in s:
    old='PrivateDependencyModuleNames.Add("Json");'
    new='PrivateDependencyModuleNames.AddRange(new string[] { "Json", "WebSockets" });'
    if old not in s: raise SystemExit('Build.cs dependency context changed')
    write(build,s.replace(old,new,1)); print('APPLY WebSockets')

# Combat APIs after v1
h='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Combat/HWCombatComponent.h'
s=read(h)
s=s.replace('bool Revive(float HealthFraction = 0.35f);','bool Revive(float HealthFraction = 0.30f);')
if 'ApplyAuthoritativeVitals' not in s:
    anchor='''    UFUNCTION(BlueprintCallable)
    bool Revive(float HealthFraction = 0.30f);'''
    extra='''

    UFUNCTION(BlueprintCallable)
    void ApplyAuthoritativeVitals(float NewHealth, float NewMaxHealth, float NewStamina, bool bIncapacitated);

    UFUNCTION(BlueprintCallable)
    void ApplyDamageReduction(float Fraction, float Duration);

    UFUNCTION(BlueprintCallable)
    bool TrySpendStamina(float Cost);

    UFUNCTION(BlueprintCallable)
    bool RequestSystemDodge(float StaminaCost);

    UFUNCTION(BlueprintCallable)
    void ConfigureCharacterStats(
        float NewMaxHealth,
        float NewBaseAttack,
        float NewDefense,
        float NewAttackSpeedPercent);

    UFUNCTION(BlueprintPure)
    float GetBaseAttack() const { return BaseAttack; }

    UFUNCTION(BlueprintPure)
    float GetDefense() const { return Defense; }

    UFUNCTION(BlueprintPure)
    float GetAttackSpeedMultiplier() const { return AttackSpeedMultiplier; }'''
    if anchor not in s: raise SystemExit('Combat Revive declaration context changed')
    s=s.replace(anchor,anchor+extra,1)
if 'DamageReductionRemaining' not in s:
    s=s.replace('    float StaminaRegenBlocked = 0.f;',
                '    float StaminaRegenBlocked = 0.f;\n    float DamageReductionRemaining = 0.f;\n    float DamageReductionFraction = 0.f;',1)
if 'BaseAttack = 2980.f;' not in s:
    s=s.replace('    bool bDead = false;',
                '    float BaseAttack = 2980.f;\n    float Defense = 1780.f;\n    float AttackSpeedMultiplier = 1.f;\n    bool bDead = false;',1)
write(h,s); print('APPLY combat network/character-stat declarations')

cpp='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Combat/HWCombatComponent.cpp'
s=read(cpp)
if 'DuplicateObject<UHWCombatTuningAsset>(Tuning, this)' not in s:
    old='''    if (!Tuning)
    {
        Tuning = NewObject<UHWCombatTuningAsset>(this, TEXT("RuntimeCombatTuning"));
    }

    Health = Tuning->MaxHealth;'''
    new='''    if (Tuning)
    {
        Tuning = DuplicateObject<UHWCombatTuningAsset>(Tuning, this);
    }
    else
    {
        Tuning = NewObject<UHWCombatTuningAsset>(this, TEXT("RuntimeCombatTuning"));
    }

    Health = Tuning->MaxHealth;'''
    if old not in s: raise SystemExit('Combat BeginPlay tuning context changed')
    s=s.replace(old,new,1)
if 'const float ActionClockScale' not in s:
    old='    ActionElapsed += DeltaTime;'
    new='''    const float ActionClockScale =
        (IsAttackAction(CurrentAction)
            || CurrentAction == EHWActionType::Smash
            || CurrentAction == EHWActionType::Counter)
        ? AttackSpeedMultiplier : 1.f;
    ActionElapsed += DeltaTime * ActionClockScale;'''
    if old not in s: raise SystemExit('Combat ActionElapsed context changed')
    s=s.replace(old,new,1)

if 'DamageReductionRemaining = FMath::Max' not in s:
    marker='    TickStamina(DeltaTime);'
    if marker not in s: raise SystemExit('Combat tick context changed')
    s=s.replace(marker,marker+'\n    DamageReductionRemaining = FMath::Max(0.f, DamageReductionRemaining - DeltaTime);\n    if (DamageReductionRemaining <= 0.f) DamageReductionFraction = 0.f;',1)
if 'const float AppliedDamage =' not in s:
    old='    Health = FMath::Max(0.f, Health - FMath::Max(0.f, Damage));'
    new='    const float DefenseReduction = FMath::Min(0.25f, Defense / FMath::Max(1.f, Defense + 5000.f));\n    const float AppliedDamage = FMath::Max(0.f, Damage) * (1.f - DefenseReduction) * (1.f - FMath::Clamp(DamageReductionFraction, 0.f, 0.90f));\n    Health = FMath::Max(0.f, Health - AppliedDamage);'
    if old not in s: raise SystemExit('Combat damage line changed')
    s=s.replace(old,new,1)
    start=s.index('bool UHWCombatComponent::ApplyIncomingDamage')
    pos=s.find('OnDamaged.Broadcast(Damage, Tier);',start)
    if pos>=0:s=s[:pos]+s[pos:].replace('OnDamaged.Broadcast(Damage, Tier);','OnDamaged.Broadcast(AppliedDamage, Tier);',1)
if 'bool UHWCombatComponent::RequestSystemDodge' not in s:
    marker='void UHWCombatComponent::ApplyHitStop(float Seconds)\n{'
    if marker not in s: raise SystemExit('Combat ApplyHitStop context changed')
    impl='''void UHWCombatComponent::ApplyAuthoritativeVitals(
    float NewHealth, float NewMaxHealth, float NewStamina, bool bIncapacitated)
{
    if (!Tuning) return;
    Tuning->MaxHealth = FMath::Max(1.f, NewMaxHealth);
    Health = FMath::Clamp(NewHealth, 0.f, Tuning->MaxHealth);
    Stamina = FMath::Clamp(NewStamina, 0.f, Tuning->MaxStamina);
    bDead = bIncapacitated;
    if (bDead)
    {
        CurrentAction = EHWActionType::None;
        QueuedAction = EHWActionType::None;
        ActionElapsed = 0.f;
        bContactFired = true;
        if (ACharacter* Character = Cast<ACharacter>(GetOwner()))
        {
            Character->StopJumping();
            if (UCharacterMovementComponent* Movement = Character->GetCharacterMovement())
            {
                Movement->StopMovementImmediately();
                Movement->DisableMovement();
            }
        }
    }
    else
    {
        SetComponentTickEnabled(true);
        if (ACharacter* Character = Cast<ACharacter>(GetOwner()))
        {
            Character->SetActorEnableCollision(true);
            if (UCharacterMovementComponent* Movement = Character->GetCharacterMovement())
            {
                if (Movement->MovementMode == MOVE_None) Movement->SetMovementMode(MOVE_Walking);
            }
        }
    }
}

void UHWCombatComponent::ApplyDamageReduction(float Fraction, float Duration)
{
    DamageReductionFraction = FMath::Max(DamageReductionFraction,FMath::Clamp(Fraction,0.f,0.90f));
    DamageReductionRemaining = FMath::Max(DamageReductionRemaining,FMath::Max(0.f,Duration));
}

bool UHWCombatComponent::TrySpendStamina(float Cost)
{
    if (bDead || !Tuning || Cost < 0.f || Stamina + KINDA_SMALL_NUMBER < Cost) return false;
    Stamina -= Cost;
    if (Cost > 0.f) StaminaRegenBlocked = Tuning->StaminaRegenDelay;
    return true;
}

bool UHWCombatComponent::RequestSystemDodge(float StaminaCost)
{
    if (bDead || !Tuning || DodgeCooldownRemaining > 0.f
        || CurrentAction != EHWActionType::None || !TrySpendStamina(StaminaCost))
        return false;
    DodgeCooldownRemaining = Tuning->DodgeCooldown;
    QueuedAction = EHWActionType::None;
    CurrentAction = EHWActionType::Dodge;
    ActionElapsed = 0.f;
    bContactFired = true;
    OnActionStarted.Broadcast(CurrentAction);
    return true;
}

void UHWCombatComponent::ConfigureCharacterStats(
    float NewMaxHealth,
    float NewBaseAttack,
    float NewDefense,
    float NewAttackSpeedPercent)
{
    if (!Tuning || bDead) return;

    BaseAttack = FMath::Max(1.f, NewBaseAttack);
    Defense = FMath::Max(0.f, NewDefense);
    AttackSpeedMultiplier =
        FMath::Clamp(NewAttackSpeedPercent / 100.f, 0.70f, 1.40f);

    Tuning->MaxHealth = FMath::Max(1.f, NewMaxHealth);
    Health = Tuning->MaxHealth;

    // Preserve the established Ain graybox ratios while scaling from each
    // character's authoritative base ATK.
    Tuning->Attack1.Damage = BaseAttack * 0.386f;
    Tuning->Attack2.Damage = BaseAttack * 0.419f;
    Tuning->Attack3.Damage = BaseAttack * 0.537f;
    Tuning->Smash.Damage = BaseAttack * 0.872f;
}

'''
    s=s.replace(marker,impl+marker,1)
write(cpp,s); print('APPLY combat authoritative runtime')

# Character network additions
h='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Character/HWAinCharacter.h'
s=read(h)
if 'class UHWNetworkCombatBridgeComponent;' not in s:
    s=s.replace('class UHWCoopLifeComponent;','class UHWCoopLifeComponent;\nclass UHWNetworkCombatBridgeComponent;',1)
if 'GetNetworkBridge()' not in s:
    anchor='''    UFUNCTION(BlueprintPure)
    UHWCoopLifeComponent* GetCoopLife() const { return CoopLife; }'''
    if anchor not in s: raise SystemExit('Character CoopLife getter changed')
    s=s.replace(anchor,anchor+'''\n\n    UFUNCTION(BlueprintPure)\n    UHWNetworkCombatBridgeComponent* GetNetworkBridge() const { return NetworkBridge; }''',1)
if 'Skill3Pressed();' not in s:
    s=s.replace('    void Skill2Pressed();','    void Skill2Pressed();\n    void Skill3Pressed();\n    void Skill4Pressed();',1)
if 'ReviveReleased();' not in s:
    s=s.replace('    void RevivePressed();','    void RevivePressed();\n    void ReviveReleased();\n    void InteractPressed();\n    void GuardPressed();\n    void GuardReleased();\n    void OpeningPressed();\n    void ExecutePressed();',1)
if 'TObjectPtr<UHWNetworkCombatBridgeComponent> NetworkBridge;' not in s:
    anchor='''    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UHWCoopLifeComponent> CoopLife;'''
    if anchor not in s: raise SystemExit('Character CoopLife property changed')
    s=s.replace(anchor,anchor+'''\n\n    UPROPERTY(VisibleAnywhere)\n    TObjectPtr<UHWNetworkCombatBridgeComponent> NetworkBridge;''',1)
write(h,s); print('APPLY character network declarations')

cpp='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Character/HWAinCharacter.cpp'
s=read(cpp)
if '#include "Network/HWNetworkCombatBridgeComponent.h"' not in s:
    s=s.replace('#include "System/HWCombatTargetInterface.h"','#include "System/HWCombatTargetInterface.h"\n#include "Network/HWNetworkCombatBridgeComponent.h"',1)
if 'NetworkBridge = CreateDefaultSubobject' not in s:
    anchor='    CoopLife = CreateDefaultSubobject<UHWCoopLifeComponent>(TEXT("CoopLife"));'
    if anchor not in s: raise SystemExit('Character CoopLife construction changed')
    s=s.replace(anchor,anchor+'\n    NetworkBridge = CreateDefaultSubobject<UHWNetworkCombatBridgeComponent>(TEXT("NetworkBridge"));',1)
if 'BindAction(TEXT("Skill3")' not in s:
    marker='    PlayerInputComponent->BindAction(TEXT("Skill2"), IE_Pressed, this, &AHWAinCharacter::Skill2Pressed);'
    if marker not in s: raise SystemExit('Skill2 input binding missing')
    s=s.replace(marker,marker+'\n    PlayerInputComponent->BindAction(TEXT("Skill3"), IE_Pressed, this, &AHWAinCharacter::Skill3Pressed);\n    PlayerInputComponent->BindAction(TEXT("Skill4"), IE_Pressed, this, &AHWAinCharacter::Skill4Pressed);',1)
if 'BindAction(TEXT("Interact")' not in s:
    marker='    PlayerInputComponent->BindAction(TEXT("Revive"), IE_Pressed, this, &AHWAinCharacter::RevivePressed);'
    if marker not in s: raise SystemExit('Revive input binding missing')
    s=s.replace(marker,marker+'\n    PlayerInputComponent->BindAction(TEXT("Revive"), IE_Released, this, &AHWAinCharacter::ReviveReleased);\n    PlayerInputComponent->BindAction(TEXT("Interact"), IE_Pressed, this, &AHWAinCharacter::InteractPressed);\n    PlayerInputComponent->BindAction(TEXT("Guard"), IE_Pressed, this, &AHWAinCharacter::GuardPressed);\n    PlayerInputComponent->BindAction(TEXT("Guard"), IE_Released, this, &AHWAinCharacter::GuardReleased);\n    PlayerInputComponent->BindAction(TEXT("Opening"), IE_Pressed, this, &AHWAinCharacter::OpeningPressed);\n    PlayerInputComponent->BindAction(TEXT("Execute"), IE_Pressed, this, &AHWAinCharacter::ExecutePressed);',1)
if 'NetworkBridge->SetMoveForward(Value);' not in s:
    s=s.replace('void AHWAinCharacter::MoveForward(float Value)\n{','void AHWAinCharacter::MoveForward(float Value)\n{\n    if (NetworkBridge) NetworkBridge->SetMoveForward(Value);',1)
if 'NetworkBridge->SetMoveRight(Value);' not in s:
    s=s.replace('void AHWAinCharacter::MoveRight(float Value)\n{','void AHWAinCharacter::MoveRight(float Value)\n{\n    if (NetworkBridge) NetworkBridge->SetMoveRight(Value);',1)
for name,send,local in [
    ('AttackPressed','SendAttack','Combat->RequestAttack();'),
    ('SmashPressed','SendSmash','Combat->RequestSmash();'),
    ('DodgePressed','SendDodge','Combat->RequestDodge();'),
    ('CombatJumpPressed','SendJump','Combat->RequestJump();'),
    ('CounterPressed','SendCounter','Combat->RequestCounter();'),
]:
    old=f'void AHWAinCharacter::{name}()\n{{\n    {local}\n}}'
    new=f'void AHWAinCharacter::{name}()\n{{\n    if (NetworkBridge) NetworkBridge->{send}();\n    {local}\n}}'
    if old in s:s=s.replace(old,new,1)
if 'NetworkBridge && NetworkBridge->IsAuthoritativeRaid()' not in s:
    marker='    AActor* Target = LockOn->GetTarget();'
    if marker not in s: raise SystemExit('Generic HandleContact target marker missing')
    s=s.replace(marker,'    if (NetworkBridge && NetworkBridge->IsAuthoritativeRaid()) return;\n\n'+marker,1)
old='''void AHWAinCharacter::SetSystemCharacterId(FName CharacterId)
{
    SystemCharacterId = CharacterId.IsNone() ? TEXT("ain") : CharacterId;
    if (CharacterKit) CharacterKit->ConfigureCharacter(SystemCharacterId);
}'''
new='''void AHWAinCharacter::SetSystemCharacterId(FName CharacterId)
{
    const FName Safe =
        (CharacterId == TEXT("ain") || CharacterId == TEXT("kain")
        || CharacterId == TEXT("ryu") || CharacterId == TEXT("sera"))
        ? CharacterId : FName(TEXT("ain"));
    if (SystemCharacterId == Safe) return;
    SystemCharacterId = Safe;
    if (CharacterKit) CharacterKit->ConfigureCharacter(SystemCharacterId);
}'''
if old in s:s=s.replace(old,new,1)
s=s.replace('''void AHWAinCharacter::Skill1Pressed()
{
    if (CharacterKit) CharacterKit->RequestSkill1();
}''','''void AHWAinCharacter::Skill1Pressed()
{
    if (NetworkBridge && NetworkBridge->SendSkill1()) return;
    if (CharacterKit) CharacterKit->RequestSkill1();
}''')
s=s.replace('''void AHWAinCharacter::Skill2Pressed()
{
    if (CharacterKit) CharacterKit->RequestSkill2();
}''','''void AHWAinCharacter::Skill2Pressed()
{
    if (NetworkBridge && NetworkBridge->SendSkill2()) return;
    if (CharacterKit) CharacterKit->RequestSkill2();
}''')
if 'void AHWAinCharacter::Skill3Pressed()' not in s:
    marker='void AHWAinCharacter::UltimatePressed()'
    if marker not in s: raise SystemExit('UltimatePressed marker missing')
    s=s.replace(marker,'''void AHWAinCharacter::Skill3Pressed()
{
    if (NetworkBridge && NetworkBridge->SendSkill3()) return;
    if (CharacterKit) CharacterKit->RequestSkill3();
}

void AHWAinCharacter::Skill4Pressed()
{
    if (NetworkBridge && NetworkBridge->SendSkill4()) return;
    if (CharacterKit) CharacterKit->RequestSkill4();
}

'''+marker,1)
s=s.replace('''void AHWAinCharacter::UltimatePressed()
{
    if (CharacterKit) CharacterKit->RequestUltimate();
}''','''void AHWAinCharacter::UltimatePressed()
{
    if (NetworkBridge && NetworkBridge->SendUltimate()) return;
    if (CharacterKit) CharacterKit->RequestUltimate();
}''')
marker='void AHWAinCharacter::RevivePressed()\n{'
if marker in s and 'NetworkBridge && NetworkBridge->BeginRevive()' not in s:
    s=s.replace(marker,marker+'\n    if (NetworkBridge && NetworkBridge->BeginRevive()) return;',1)
if 'void AHWAinCharacter::ReviveReleased()' not in s:
    s+='''\n\nvoid AHWAinCharacter::ReviveReleased(){ if (NetworkBridge) NetworkBridge->EndRevive(); }
void AHWAinCharacter::InteractPressed(){ if (NetworkBridge) NetworkBridge->SendInteract(); }
void AHWAinCharacter::GuardPressed(){ if (NetworkBridge) NetworkBridge->SetGuard(true); }
void AHWAinCharacter::GuardReleased(){ if (NetworkBridge) NetworkBridge->SetGuard(false); }
void AHWAinCharacter::OpeningPressed(){ if (NetworkBridge) NetworkBridge->SendOpening(); }
void AHWAinCharacter::ExecutePressed(){ if (NetworkBridge) NetworkBridge->SendExecute(); }
'''
write(cpp,s); print('APPLY character authoritative intents')

ini='ue/HwanghonCombatUE/Config/DefaultInput.ini'
s=read(ini)
for line in [
    '+ActionMappings=(ActionName="Skill3",Key=Three)',
    '+ActionMappings=(ActionName="Skill4",Key=Four)',
    '+ActionMappings=(ActionName="Interact",Key=G)',
    '+ActionMappings=(ActionName="Guard",Key=LeftShift)',
    '+ActionMappings=(ActionName="Opening",Key=X)',
    '+ActionMappings=(ActionName="Execute",Key=V)',
]:
    if line not in s:s+='\n'+line
write(ini,s); print('APPLY network/system inputs')

# Boss snapshot authority after v1 part2.
h='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Boss/HWBossCharacter.h'
s=read(h)
if 'SetNetworkAuthoritative' not in s:
    anchor='''    UFUNCTION(BlueprintCallable)
    void EnterSystemBreak(float Duration, FVector SourceLocation);'''
    if anchor not in s: raise SystemExit('Boss EnterSystemBreak declaration missing')
    s=s.replace(anchor,anchor+'''\n\n    UFUNCTION(BlueprintCallable)\n    void SetNetworkAuthoritative(bool bEnabled);\n\n    UFUNCTION(BlueprintCallable)\n    void ApplyAuthoritativeSnapshot(float NewHealth, float NewMaxHealth, float NewPosture, FName StateName, bool bRaidClear);''',1)
if 'bNetworkAuthoritative' not in s:
    s=s.replace('    float SystemBreakDuration = 1.45f;','    float SystemBreakDuration = 1.45f;\n    bool bNetworkAuthoritative = false;',1)
write(h,s); print('APPLY boss network declarations')

cpp='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Boss/HWBossCharacter.cpp'
s=read(cpp)
if 'if (bNetworkAuthoritative) return;' not in s:
    start=s.index('void AHWBossCharacter::Tick')
    marker='    if (IsDead())\n    {\n        return;\n    }'
    pos=s.find(marker,start)
    if pos<0: raise SystemExit('Boss Tick death block missing')
    s=s[:pos]+s[pos:].replace(marker,marker+'\n\n    if (bNetworkAuthoritative) return;',1)
old='''void AHWBossCharacter::ReceivePlayerHit(float Damage, EHWAttackTier Tier, FVector SourceLocation)
{
    if (IsDead())
    {
        return;
    }'''
new='''void AHWBossCharacter::ReceivePlayerHit(float Damage, EHWAttackTier Tier, FVector SourceLocation)
{
    if (IsDead() || bNetworkAuthoritative)
    {
        return;
    }'''
if old in s:s=s.replace(old,new,1)
if 'void AHWBossCharacter::SetNetworkAuthoritative' not in s:
    s+='''\n\nvoid AHWBossCharacter::SetNetworkAuthoritative(bool bEnabled)\n{\n    bNetworkAuthoritative=bEnabled;\n    if (BossSystem) BossSystem->SetComponentTickEnabled(!bEnabled);\n}\n\nvoid AHWBossCharacter::ApplyAuthoritativeSnapshot(float NewHealth,float NewMaxHealth,float NewPosture,FName StateName,bool bRaidClear)\n{\n    bNetworkAuthoritative=true;\n    Health=FMath::Max(0.f,NewHealth);\n    EHWBossState NewState=State;\n    if (bRaidClear || Health<=0.f) NewState=EHWBossState::Dead;\n    else if (StateName==TEXT("idle")) NewState=EHWBossState::Idle;\n    else if (StateName==TEXT("telegraph")) NewState=EHWBossState::Tell;\n    else if (StateName==TEXT("attack") || StateName==TEXT("link")) NewState=EHWBossState::Strike;\n    else if (StateName==TEXT("recover")) NewState=EHWBossState::Recover;\n    else if (StateName==TEXT("stagger")) NewState=EHWBossState::Stagger;\n    else if (StateName==TEXT("downed")) NewState=EHWBossState::Break;\n    if (NewState!=State)\n    {\n        State=NewState;StateElapsed=0.f;\n        OnBossStateChanged.Broadcast(State,CurrentPattern.Id);\n        BP_OnBossStateChanged(State,CurrentPattern.Id);\n    }\n    if (State==EHWBossState::Dead)\n    {\n        Tags.Remove(TEXT("LockOnTarget"));\n        SetActorEnableCollision(false);\n    }\n}\n'''
write(cpp,s); print('APPLY boss authoritative snapshots')

# GameMode after v1 part2.
gm='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Game/HWCombatGameMode.cpp'
s=read(gm)
for inc in ['#include "Network/HWRaidNetworkSubsystem.h"','#include "Network/HWRaidWorldBridge.h"']:
    if inc not in s:s=s.replace('#include "System/HWSystemTypes.h"','#include "System/HWSystemTypes.h"\n'+inc,1)
if 'const bool bOnlineRaid =' not in s:
    marker='    RunId = FGuid::NewGuid();'
    if marker not in s: raise SystemExit('GameMode RunId marker missing')
    s=s.replace(marker,marker+'\n    const bool bOnlineRaid = GetGameInstance() && GetGameInstance()->GetSubsystem<UHWRaidNetworkSubsystem>() && GetGameInstance()->GetSubsystem<UHWRaidNetworkSubsystem>()->GetRoom().bHasRaid;',1)
s=s.replace('    if (!DungeonId.IsNone())\n    {','    if (!bOnlineRaid && !DungeonId.IsNone())\n    {',1)
s=s.replace('    if (!UGameplayStatics::GetActorOfClass(this, AHWGrayboxArena::StaticClass()))\n    {','    if (!bOnlineRaid && !UGameplayStatics::GetActorOfClass(this, AHWGrayboxArena::StaticClass()))\n    {',1)
if 'AHWRaidWorldBridge::StaticClass()' not in s:
    marker='    if (!UGameplayStatics::GetActorOfClass(this, AHWCombatAuditActor::StaticClass()))\n'
    if marker not in s: raise SystemExit('GameMode audit marker missing')
    hook='''    if (bOnlineRaid && !UGameplayStatics::GetActorOfClass(this, AHWRaidWorldBridge::StaticClass()))\n    {\n        GetWorld()->SpawnActor<AHWRaidWorldBridge>(AHWRaidWorldBridge::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator);\n    }\n\n'''
    s=s.replace(marker,hook+marker,1)
write(gm,s); print('APPLY online authority GameMode')

# Package online map.
game_ini='ue/HwanghonCombatUE/Config/DefaultGame.ini'
s=read(game_ini)
line='+MapsToCook=(FilePath="/Game/Maps/Hwanghon_OnlineRaid")'
if line not in s:
    if '[/Script/UnrealEd.ProjectPackagingSettings]' not in s:s+='\n[/Script/UnrealEd.ProjectPackagingSettings]\n'
    s+='\n'+line+'\n'
write(game_ini,s); print('APPLY online map packaging')

# Quests are authored as 1~4 players. Use the same authoritative Raid for solo too.
index='server/index.cjs'
ix=read(index)
old_start="""if(members.length<2||!members.every(m=>m.connected&&m.ready))throw Error('2명 이상이 연결되어 모두 준비해야 합니다.');"""
new_start="""if(members.length<1||!members.every(m=>m.connected&&m.ready))throw Error('1명 이상이 연결되어 모두 준비해야 합니다.');"""
if new_start not in ix:
    if old_start not in ix: raise SystemExit('server solo-start context changed')
    ix=ix.replace(old_start,new_start,1)
    write(index,ix); print('APPLY authoritative 1~4 player Raid start')

# Authoritative character stats: keep the design-sheet identity in online Raid.
# Previously store.stats() dropped base DEF/crit/critDamage/MSPD.
store='server/store.cjs'
ss=read(store)
old_stats=""" stats(p){if(typeof p==='string')p=this.get(p);const level=1+Math.floor(p.xp/1200),base=(C.characters[p.character]||C.character).stats;let hp=base.hp+(level-1)*150,defense=0;for(const id of Object.values(p.equipment||{})){const item=C.equipment.find(i=>i.id===id);if(item&&item.type!=='weapon'){hp+=item.stats.hp||0;defense+=item.stats.def||0;}}return {hp,atk:base.atk+(level-1)*15,aspd:base.aspd,defense};}"""
new_stats=""" stats(p){if(typeof p==='string')p=this.get(p);const level=1+Math.floor(p.xp/1200),base=(C.characters[p.character]||C.character).stats;let hp=base.hp+(level-1)*150,defense=base.def||0;for(const id of Object.values(p.equipment||{})){const item=C.equipment.find(i=>i.id===id);if(item&&item.type!=='weapon'){hp+=item.stats.hp||0;defense+=item.stats.def||0;}}return {hp,atk:base.atk+(level-1)*15,aspd:base.aspd,mspd:base.mspd,defense,critChance:(base.crit||0)/100,critDamage:(base.critDmg||100)/100,moveMult:(base.mspd||100)/100,threatMult:p.character==='kain'?1.25:1};}"""
if new_stats not in ss:
    if old_stats not in ss: raise SystemExit('server store.stats context changed')
    ss=ss.replace(old_stats,new_stats,1)
    write(store,ss); print('APPLY authoritative character DEF/crit/MSPD stats')

# Server presentation-only snapshot extension.
raid='server/raid.cjs'
s=read(raid)
# Role identity hooks already exist in Raid; wire them to the character definitions.
old_threat="p.damage+=amount;p.threat+=amount;this.event('hit'"
new_threat="p.damage+=amount;p.threat+=amount*(p.stats.threatMult||1);this.event('hit'"
if new_threat not in s:
    if old_threat not in s: raise SystemExit('Raid threat context changed')
    s=s.replace(old_threat,new_threat,1)

old_buff="""else if(k.buff){p.buffT=k.buff.dur;p.buffReduce=k.buff.reduce;if(k.ev?.type==='heal'){const h=Math.max(0,Math.min(p.maxHp-p.hp,Math.round(p.maxHp*k.ev.frac)));p.hp+=h;this.event('heal',{player:id,amount:h});}}"""
new_buff="""else if(k.buff){const targets=p.character==='sera'&&k.ev?.type==='heal'?[...this.players.values()].filter(q=>this.alive(q)&&q.connected&&(q===p||this.world.dist(p.x,p.y,q.x,q.y)<=this.L.player.reach*2)&&this.world.lineOfSight(p.x,p.y,q.x,q.y)):[p];for(const q of targets){q.buffT=Math.max(q.buffT||0,k.buff.dur);q.buffReduce=Math.max(q.buffReduce||0,k.buff.reduce);if(k.ev?.type==='heal'){const h=Math.max(0,Math.min(q.maxHp-q.hp,Math.round(q.maxHp*k.ev.frac)));q.hp+=h;this.event('heal',{player:q.id,by:id,amount:h});}}}"""
if new_buff not in s:
    if old_buff not in s: raise SystemExit('Raid buff/heal context changed')
    s=s.replace(old_buff,new_buff,1)
old='expedition:this.expedition.snapshot(),hazards:this.expedition.hazards.map'
new='''expedition:{...this.expedition.snapshot(),nodes:this.expedition.nodes.map(n=>({
   id:n.id,kind:n.kind||'',name:n.name||'',x:n.x,y:n.y,range:n.range||110,objective:n.objective||null,
   enabled:!this.expedition.completed(n.id)&&(n.requires||[]).every(k=>this.expedition.completed(k)),
   done:this.expedition.completed(n.id),discovered:this.expedition.discovered(n.id)
  }))},
  gate:{x:this.gate.x,y:this.gate.y,open:this.expedition.ready()},
  hazards:this.expedition.hazards.map'''
if new not in s:
    if old not in s: raise SystemExit('server raid snapshot context changed')
    s=s.replace(old,new,1)
write(raid,s); print('APPLY server node/gate snapshot')

print('SYSTEM CORE V2 CURRENT applied')
