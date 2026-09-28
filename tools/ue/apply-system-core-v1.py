#!/usr/bin/env python3
from pathlib import Path

ROOT=Path.cwd()
def path(p): return ROOT/p
def read(p): return path(p).read_text(encoding='utf-8')
def write(p,s): path(p).write_text(s,encoding='utf-8')
def replace_once(p,old,new,label):
    s=read(p)
    if new in s: print('OK',label); return
    if old not in s: raise SystemExit(f'context changed: {label} ({p})')
    write(p,s.replace(old,new,1)); print('APPLY',label)

combat_h='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Combat/HWCombatComponent.h'
replace_once(combat_h,
    '    UFUNCTION(BlueprintCallable)\n    void ApplyHitStop(float Seconds);',
    '    UFUNCTION(BlueprintCallable)\n    void ApplyHitStop(float Seconds);\n\n    UFUNCTION(BlueprintCallable)\n    void Heal(float Amount);\n\n    UFUNCTION(BlueprintCallable)\n    bool Revive(float HealthFraction = 0.35f);',
    'combat Heal/Revive declarations')

combat_cpp='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Combat/HWCombatComponent.cpp'
s=read(combat_cpp)
if 'bool UHWCombatComponent::Revive(' not in s:
    marker='void UHWCombatComponent::ApplyHitStop(float Seconds)\n{'
    impl='''void UHWCombatComponent::Heal(float Amount)
{
    if (bDead || !Tuning || Amount <= 0.f) return;
    Health = FMath::Min(Tuning->MaxHealth, Health + Amount);
}

bool UHWCombatComponent::Revive(float HealthFraction)
{
    if (!bDead || !Tuning) return false;
    bDead = false;
    Health = FMath::Max(1.f, Tuning->MaxHealth * FMath::Clamp(HealthFraction, 0.05f, 1.f));
    Stamina = FMath::Max(Stamina, Tuning->MaxStamina * 0.35f);
    CurrentAction = EHWActionType::None;
    QueuedAction = EHWActionType::None;
    ActionElapsed = 0.f;
    bContactFired = false;
    HitStopRemaining = 0.f;
    SetComponentTickEnabled(true);
    if (ACharacter* Character = Cast<ACharacter>(GetOwner()))
    {
        Character->SetActorEnableCollision(true);
        if (UCharacterMovementComponent* Movement = Character->GetCharacterMovement())
        {
            Movement->SetMovementMode(MOVE_Walking);
        }
    }
    return true;
}

'''
    if marker not in s: raise SystemExit('combat ApplyHitStop marker changed')
    write(combat_cpp,s.replace(marker,impl+marker,1)); print('APPLY combat Heal/Revive implementations')

char_h='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Character/HWAinCharacter.h'
s=read(char_h)
if 'class UHWCharacterKitComponent;' not in s:
    s=s.replace('class UHWPlayerPresentationComponent;','class UHWPlayerPresentationComponent;\nclass UHWCharacterKitComponent;\nclass UHWCoopLifeComponent;')
if 'virtual void EndPlay' not in s:
    s=s.replace('    virtual void BeginPlay() override;','    virtual void BeginPlay() override;\n    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;')
if 'GetCharacterKit()' not in s:
    anchor='''    UFUNCTION(BlueprintPure)\n    UHWPlayerPresentationComponent* GetPresentation() const { return Presentation; }'''
    extra='''    UFUNCTION(BlueprintPure)\n    UHWCharacterKitComponent* GetCharacterKit() const { return CharacterKit; }\n\n    UFUNCTION(BlueprintPure)\n    UHWCoopLifeComponent* GetCoopLife() const { return CoopLife; }\n\n    UFUNCTION(BlueprintPure)\n    FName GetSystemCharacterId() const { return SystemCharacterId; }\n\n    UFUNCTION(BlueprintCallable)\n    void SetSystemCharacterId(FName CharacterId);'''
    if anchor not in s: raise SystemExit('character getter anchor changed')
    s=s.replace(anchor,anchor+'\n\n'+extra,1)
if 'Skill1Pressed();' not in s:
    s=s.replace('    void PerfCapturePressed();','    void PerfCapturePressed();\n    void Skill1Pressed();\n    void Skill2Pressed();\n    void UltimatePressed();\n    void RevivePressed();')
if 'TObjectPtr<UHWCharacterKitComponent> CharacterKit;' not in s:
    anchor='''    UPROPERTY(VisibleAnywhere)\n    TObjectPtr<UHWPlayerPresentationComponent> Presentation;'''
    extra='''    UPROPERTY(VisibleAnywhere)\n    TObjectPtr<UHWCharacterKitComponent> CharacterKit;\n\n    UPROPERTY(VisibleAnywhere)\n    TObjectPtr<UHWCoopLifeComponent> CoopLife;\n\n    UPROPERTY(EditAnywhere, Category="Hwanghon|Character")\n    FName SystemCharacterId = TEXT("ain");'''
    if anchor not in s: raise SystemExit('character property anchor changed')
    s=s.replace(anchor,anchor+'\n\n'+extra,1)
write(char_h,s); print('APPLY character system declarations')

char_cpp='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Character/HWAinCharacter.cpp'
s=read(char_cpp)
for inc in ['#include "System/HWCharacterKitComponent.h"','#include "System/HWCoopLifeComponent.h"','#include "System/HWCoopCombatSubsystem.h"','#include "System/HWCombatTargetInterface.h"']:
    if inc not in s: s=s.replace('#include "Animation/HWPlayerPresentationComponent.h"','#include "Animation/HWPlayerPresentationComponent.h"\n'+inc)
if 'CharacterKit = CreateDefaultSubobject<UHWCharacterKitComponent>' not in s:
    old='    Presentation = CreateDefaultSubobject<UHWPlayerPresentationComponent>(TEXT("Presentation"));'
    new=old+'\n    CharacterKit = CreateDefaultSubobject<UHWCharacterKitComponent>(TEXT("CharacterKit"));\n    CoopLife = CreateDefaultSubobject<UHWCoopLifeComponent>(TEXT("CoopLife"));'
    if old not in s: raise SystemExit('character constructor anchor changed')
    s=s.replace(old,new,1)
if 'CharacterKit->ConfigureCharacter(SystemCharacterId);' not in s:
    old='    Combat->OnContact.AddDynamic(this, &AHWAinCharacter::HandleContact);'
    new=old+'\n    CharacterKit->ConfigureCharacter(SystemCharacterId);\n    if (UHWCoopCombatSubsystem* Coop = GetWorld()->GetSubsystem<UHWCoopCombatSubsystem>())\n    {\n        Coop->RegisterCombatant(this, SystemCharacterId);\n    }'
    if old not in s: raise SystemExit('character BeginPlay anchor changed')
    s=s.replace(old,new,1)
if 'void AHWAinCharacter::EndPlay(' not in s:
    marker='void AHWAinCharacter::Tick(float DeltaSeconds)'
    impl='''void AHWAinCharacter::EndPlay(const EEndPlayReason::Type EndPlayReason)\n{\n    if (UWorld* World = GetWorld())\n    {\n        if (UHWCoopCombatSubsystem* Coop = World->GetSubsystem<UHWCoopCombatSubsystem>())\n        {\n            Coop->UnregisterCombatant(this);\n        }\n    }\n    Super::EndPlay(EndPlayReason);\n}\n\n'''
    if marker not in s: raise SystemExit('character Tick marker changed')
    s=s.replace(marker,impl+marker,1)
if 'BindAction(TEXT("Skill1")' not in s:
    marker='    PlayerInputComponent->BindAction(TEXT("PerfCapture"), IE_Pressed, this, &AHWAinCharacter::PerfCapturePressed);'
    extra='''\n    PlayerInputComponent->BindAction(TEXT("Skill1"), IE_Pressed, this, &AHWAinCharacter::Skill1Pressed);\n    PlayerInputComponent->BindAction(TEXT("Skill2"), IE_Pressed, this, &AHWAinCharacter::Skill2Pressed);\n    PlayerInputComponent->BindAction(TEXT("Ultimate"), IE_Pressed, this, &AHWAinCharacter::UltimatePressed);\n    PlayerInputComponent->BindAction(TEXT("Revive"), IE_Pressed, this, &AHWAinCharacter::RevivePressed);'''
    if marker not in s: raise SystemExit('character input marker changed')
    s=s.replace(marker,marker+extra,1)
old='''    AActor* Target = LockOn->GetTarget();\n    AHWBossCharacter* Boss = Cast<AHWBossCharacter>(Target);\n    if (!Boss)\n    {\n        return;\n    }\n\n    const float Distance = FVector::Dist2D(GetActorLocation(), Boss->GetActorLocation());\n    const float Range = Action == EHWActionType::Smash ? 300.f : 260.f;\n    if (Distance <= Range)\n    {\n        Boss->ReceivePlayerHit(Damage, Tier, GetActorLocation());\n        const float HitStop =\n            Tier == EHWAttackTier::Smash ? 0.21f :\n            Tier == EHWAttackTier::Finisher ? 0.13f : 0.09f;\n        Combat->ApplyHitStop(HitStop);\n        Boss->ApplyHitStop(HitStop);\n    }'''
new='''    AActor* Target = LockOn->GetTarget();\n    if (!Target || !Target->GetClass()->ImplementsInterface(UHWCombatTargetInterface::StaticClass()))\n    {\n        return;\n    }\n\n    const float Distance = FVector::Dist2D(GetActorLocation(), Target->GetActorLocation());\n    const float Range = Action == EHWActionType::Smash ? 300.f : 260.f;\n    if (Distance <= Range)\n    {\n        const bool bHit = IHWCombatTargetInterface::Execute_ReceiveSystemHit(\n            Target, Damage, Tier, GetActorLocation(), this);\n        if (!bHit) return;\n\n        const float HitStop =\n            Tier == EHWAttackTier::Smash ? 0.21f :\n            Tier == EHWAttackTier::Finisher ? 0.13f : 0.09f;\n        Combat->ApplyHitStop(HitStop);\n        if (AHWBossCharacter* Boss = Cast<AHWBossCharacter>(Target))\n        {\n            Boss->ApplyHitStop(HitStop);\n        }\n        if (UHWCoopCombatSubsystem* Coop = GetWorld()->GetSubsystem<UHWCoopCombatSubsystem>())\n        {\n            const float ThreatMultiplier = SystemCharacterId == TEXT("kain") ? 1.25f : 1.f;\n            Coop->AddThreatFromDamage(this, Damage, ThreatMultiplier);\n        }\n    }'''
if old in s: s=s.replace(old,new,1); print('APPLY generic combat target hit')
elif new not in s: raise SystemExit('character HandleContact context changed')
if 'void AHWAinCharacter::Skill1Pressed()' not in s:
    s+='''\n\nvoid AHWAinCharacter::SetSystemCharacterId(FName CharacterId)\n{\n    SystemCharacterId = CharacterId.IsNone() ? TEXT("ain") : CharacterId;\n    if (CharacterKit) CharacterKit->ConfigureCharacter(SystemCharacterId);\n}\n\nvoid AHWAinCharacter::Skill1Pressed()\n{\n    if (CharacterKit) CharacterKit->RequestSkill1();\n}\n\nvoid AHWAinCharacter::Skill2Pressed()\n{\n    if (CharacterKit) CharacterKit->RequestSkill2();\n}\n\nvoid AHWAinCharacter::UltimatePressed()\n{\n    if (CharacterKit) CharacterKit->RequestUltimate();\n}\n\nvoid AHWAinCharacter::RevivePressed()\n{\n    UHWCoopCombatSubsystem* Coop = GetWorld() ? GetWorld()->GetSubsystem<UHWCoopCombatSubsystem>() : nullptr;\n    if (!Coop) return;\n\n    AHWAinCharacter* Best = nullptr;\n    float BestDistanceSq = TNumericLimits<float>::Max();\n    for (const FHWCoopCombatantView& View : Coop->GetCombatants())\n    {\n        AHWAinCharacter* Candidate = View.Character;\n        if (!Candidate || Candidate == this) continue;\n        UHWCoopLifeComponent* Life = Candidate->GetCoopLife();\n        if (!Life || !Life->IsDowned()) continue;\n        const float DistanceSq = FVector::DistSquared2D(GetActorLocation(), Candidate->GetActorLocation());\n        if (DistanceSq < BestDistanceSq)\n        {\n            BestDistanceSq = DistanceSq;\n            Best = Candidate;\n        }\n    }\n    if (Best && Best->GetCoopLife())\n    {\n        Best->GetCoopLife()->StartRevive(this);\n    }\n}\n'''
write(char_cpp,s); print('APPLY character kit/coop runtime')

input_ini='ue/HwanghonCombatUE/Config/DefaultInput.ini'
s=read(input_ini)
for line in [
    '+ActionMappings=(ActionName="Skill1",Key=Q)',
    '+ActionMappings=(ActionName="Skill2",Key=E)',
    '+ActionMappings=(ActionName="Ultimate",Key=R)',
    '+ActionMappings=(ActionName="Revive",Key=F)'
]:
    if line not in s: s+='\n'+line
write(input_ini,s); print('APPLY system inputs')

