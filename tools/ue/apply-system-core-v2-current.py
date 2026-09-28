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
    bool RequestSystemDodge(float StaminaCost);'''
    if anchor not in s: raise SystemExit('Combat Revive declaration context changed')
    s=s.replace(anchor,anchor+extra,1)
if 'DamageReductionRemaining' not in s:
    s=s.replace('    float StaminaRegenBlocked = 0.f;',
                '    float StaminaRegenBlocked = 0.f;\n    float DamageReductionRemaining = 0.f;\n    float DamageReductionFraction = 0.f;',1)
write(h,s); print('APPLY combat network declarations')

cpp='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Combat/HWCombatComponent.cpp'
s=read(cpp)
if 'DamageReductionRemaining = FMath::Max' not in s:
    marker='    TickStamina(DeltaTime);'
    if marker not in s: raise SystemExit('Combat tick context changed')
    s=s.replace(marker,marker+'\n    DamageReductionRemaining = FMath::Max(0.f, DamageReductionRemaining - DeltaTime);\n    if (DamageReductionRemaining <= 0.f) DamageReductionFraction = 0.f;',1)
if 'const float AppliedDamage =' not in s:
    old='    Health = FMath::Max(0.f, Health - FMath::Max(0.f, Damage));'
    new='    const float AppliedDamage = FMath::Max(0.f, Damage) * (1.f - FMath::Clamp(DamageReductionFraction, 0.f, 0.90f));\n    Health = FMath::Max(0.f, Health - AppliedDamage);'
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

# Server presentation-only snapshot extension.
raid='server/raid.cjs'
s=read(raid)
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
