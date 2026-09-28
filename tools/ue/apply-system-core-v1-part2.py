#!/usr/bin/env python3
from pathlib import Path

ROOT=Path.cwd()
def path(p): return ROOT/p
def read(p): return path(p).read_text(encoding='utf-8')
def write(p,s): path(p).write_text(s,encoding='utf-8')

# ---- Boss: target interface + boss phase/break/aggro ----
boss_h='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Boss/HWBossCharacter.h'
bs=read(boss_h)
if '#include "System/HWCombatTargetInterface.h"' not in bs:
    bs=bs.replace('#include "Combat/HWCombatTypes.h"','#include "Combat/HWCombatTypes.h"\n#include "System/HWCombatTargetInterface.h"',1)
if 'class UHWBossSystemComponent;' not in bs:
    bs=bs.replace('class UHWBossPresentationComponent;','class UHWBossPresentationComponent;\nclass UHWBossSystemComponent;',1)
if 'public IHWCombatTargetInterface' not in bs:
    bs=bs.replace('class HWANGHONCOMBATUE_API AHWBossCharacter : public ACharacter',
        'class HWANGHONCOMBATUE_API AHWBossCharacter : public ACharacter, public IHWCombatTargetInterface',1)
if 'GetBossSystem()' not in bs:
    anchor='''    UFUNCTION(BlueprintPure)
    float GetHealth() const { return Health; }'''
    extra='''    UFUNCTION(BlueprintPure)
    UHWBossSystemComponent* GetBossSystem() const { return BossSystem; }

    UFUNCTION(BlueprintCallable)
    void ConfigureSystemHealth(float NewMaxHealth);

    UFUNCTION(BlueprintCallable)
    void EnterSystemBreak(float Duration, FVector SourceLocation);

    virtual bool ReceiveSystemHit_Implementation(
        float Damage,
        EHWAttackTier Tier,
        FVector SourceLocation,
        AActor* InstigatorActor) override;

    virtual bool IsSystemTargetDead_Implementation() const override
    {
        return IsDead();
    }'''
    if anchor not in bs: raise SystemExit('boss public anchor changed')
    bs=bs.replace(anchor,anchor+'\n\n'+extra,1)
if 'TObjectPtr<UHWBossSystemComponent> BossSystem;' not in bs:
    anchor='''    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UHWBossPresentationComponent> Presentation;'''
    extra='''    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UHWBossSystemComponent> BossSystem;'''
    if anchor not in bs: raise SystemExit('boss presentation anchor changed')
    bs=bs.replace(anchor,anchor+'\n\n'+extra,1)
if 'float SystemBreakDuration' not in bs:
    bs=bs.replace('    float HitStopRemaining = 0.f;',
        '    float HitStopRemaining = 0.f;\n    float SystemBreakDuration = 1.45f;',1)
write(boss_h,bs); print('APPLY boss system declarations')

boss_cpp='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Boss/HWBossCharacter.cpp'
bs=read(boss_cpp)
for inc in [
    '#include "System/HWBossSystemComponent.h"',
    '#include "System/HWCoopCombatSubsystem.h"'
]:
    if inc not in bs:
        bs=bs.replace('#include "Combat/HWCombatTuningAsset.h"',
            '#include "Combat/HWCombatTuningAsset.h"\n'+inc,1)

if 'BossSystem = CreateDefaultSubobject<UHWBossSystemComponent>' not in bs:
    old='    Presentation = CreateDefaultSubobject<UHWBossPresentationComponent>(TEXT("Presentation"));'
    new=old+'\n    BossSystem = CreateDefaultSubobject<UHWBossSystemComponent>(TEXT("BossSystem"));'
    if old not in bs: raise SystemExit('boss ctor presentation changed')
    bs=bs.replace(old,new,1)

if 'BossSystem->InitializeBoss(Health);' not in bs:
    old='    TargetPlayer = Cast<AHWAinCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0));'
    new=old+'\n    if (BossSystem) BossSystem->InitializeBoss(Health);'
    if old not in bs: raise SystemExit('boss BeginPlay target changed')
    bs=bs.replace(old,new,1)

old_target='''    if (!TargetPlayer)
    {
        TargetPlayer = Cast<AHWAinCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0));
        return;
    }
'''
new_target='''    if (UHWCoopCombatSubsystem* Coop =
        GetWorld() ? GetWorld()->GetSubsystem<UHWCoopCombatSubsystem>() : nullptr)
    {
        AHWAinCharacter* ThreatTarget = Coop->SelectHighestThreatTarget();
        if (!ThreatTarget)
        {
            ThreatTarget = Coop->SelectClosestLivingTarget(GetActorLocation());
        }
        if (ThreatTarget)
        {
            TargetPlayer = ThreatTarget;
        }
    }

    if (!TargetPlayer || !TargetPlayer->GetCombat() || TargetPlayer->GetCombat()->IsDead())
    {
        TargetPlayer = Cast<AHWAinCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0));
        if (!TargetPlayer || !TargetPlayer->GetCombat() || TargetPlayer->GetCombat()->IsDead())
        {
            return;
        }
    }
'''
if old_target in bs:
    bs=bs.replace(old_target,new_target,1)
elif new_target not in bs:
    raise SystemExit('boss target selection context changed')

if 'const float SystemSpeed =' not in bs:
    old='    StateElapsed += DeltaSeconds;'
    new='''    const float SystemSpeed =
        BossSystem && (State == EHWBossState::Tell
            || State == EHWBossState::Strike
            || State == EHWBossState::Recover)
        ? BossSystem->GetPatternSpeedScale()
        : 1.f;
    StateElapsed += DeltaSeconds * SystemSpeed;'''
    if old not in bs: raise SystemExit('boss StateElapsed context changed')
    bs=bs.replace(old,new,1)

bs=bs.replace('if (StateElapsed >= 1.45f)','if (StateElapsed >= SystemBreakDuration)',1)

if 'BossSystem->NotifyHit(Damage, Tier, SourceLocation);' not in bs:
    old='''    if (Health <= 0.f)
    {
        Die();
        return;
    }

    FVector ReactionDirection'''
    new='''    if (Health <= 0.f)
    {
        Die();
        return;
    }

    if (BossSystem)
    {
        BossSystem->NotifyHit(Damage, Tier, SourceLocation);
        if (State == EHWBossState::Break && Tier != EHWAttackTier::Break)
        {
            return;
        }
    }

    FVector ReactionDirection'''
    if old not in bs: raise SystemExit('boss hit posture anchor changed')
    bs=bs.replace(old,new,1)

old_damage='PlayerCombat->ApplyIncomingDamage(Beat.Damage, CurrentPattern.bBig ? EHWAttackTier::Smash : EHWAttackTier::Light);'
new_damage='PlayerCombat->ApplyIncomingDamage(Beat.Damage * (BossSystem ? BossSystem->GetOutgoingDamageScale() : 1.f), CurrentPattern.bBig ? EHWAttackTier::Smash : EHWAttackTier::Light);'
if old_damage in bs:
    bs=bs.replace(old_damage,new_damage,1)

if 'const int32 SystemPhase = BossSystem ? BossSystem->GetPhase() : 1;' not in bs:
    old='''        const FHWBossPatternSpec& Pattern = RuntimeTuning->BossPatterns[Index];

        if (Pattern.Id == "Charge"'''
    new='''        const FHWBossPatternSpec& Pattern = RuntimeTuning->BossPatterns[Index];
        const int32 SystemPhase = BossSystem ? BossSystem->GetPhase() : 1;

        if (SystemPhase == 1 && Pattern.Id == "GroundWave")
        {
            continue;
        }

        if (Pattern.Id == "Charge"'''
    if old not in bs: raise SystemExit('boss pattern loop anchor changed')
    bs=bs.replace(old,new,1)

if 'bool AHWBossCharacter::ReceiveSystemHit_Implementation' not in bs:
    bs += '''

bool AHWBossCharacter::ReceiveSystemHit_Implementation(
    float Damage,
    EHWAttackTier Tier,
    FVector SourceLocation,
    AActor* InstigatorActor)
{
    if (IsDead()) return false;
    ReceivePlayerHit(Damage, Tier, SourceLocation);
    return true;
}

void AHWBossCharacter::ConfigureSystemHealth(float NewMaxHealth)
{
    if (IsDead()) return;
    Health = FMath::Max(1.f, NewMaxHealth);
}

void AHWBossCharacter::EnterSystemBreak(float Duration, FVector SourceLocation)
{
    if (IsDead()) return;

    CancelPendingAttack();
    State = EHWBossState::Break;
    StateElapsed = 0.f;
    SystemBreakDuration = FMath::Max(0.5f, Duration);

    FVector ReactionDirection = GetActorLocation() - SourceLocation;
    ReactionDirection.Z = 0.f;
    ReactionDirection.Normalize();

    LastReactionTier = EHWAttackTier::Break;
    LastReactionWorldTime = GetWorld()->GetTimeSeconds();

    OnBossReaction.Broadcast(EHWAttackTier::Break, ReactionDirection);
    BP_OnBossReaction(EHWAttackTier::Break, ReactionDirection);
    OnBossStateChanged.Broadcast(State, CurrentPattern.Id);
    BP_OnBossStateChanged(State, CurrentPattern.Id);
}
'''
write(boss_cpp,bs); print('APPLY boss phase/break/aggro system')

# ---- Dungeon lifecycle into GameMode ----
gm_h='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Game/HWCombatGameMode.h'
gs=read(gm_h)
if 'class AHWDungeonDirector;' not in gs:
    gs=gs.replace('class UHWQuestRunSubsystem;','class UHWQuestRunSubsystem;\nclass AHWDungeonDirector;',1)
if 'HandleDungeonCompleted' not in gs:
    anchor='''    UFUNCTION()
    void HandlePlayerDied();'''
    extra='''    UFUNCTION()
    void HandleDungeonCompleted();

    UFUNCTION()
    void HandleDungeonFailed(FString Reason);'''
    if anchor not in gs: raise SystemExit('game mode player-died declaration changed')
    gs=gs.replace(anchor,anchor+'\n\n'+extra,1)
if 'TObjectPtr<AHWDungeonDirector> EncounterDungeon;' not in gs:
    anchor='''    UPROPERTY(Transient)
    TObjectPtr<UHWQuestRunSubsystem> QuestRuns;'''
    extra='''    UPROPERTY(Transient)
    TObjectPtr<AHWDungeonDirector> EncounterDungeon;'''
    if anchor not in gs: raise SystemExit('game mode QuestRuns property changed')
    gs=gs.replace(anchor,anchor+'\n\n'+extra,1)
write(gm_h,gs); print('APPLY dungeon game-mode declarations')

gm_cpp='ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Game/HWCombatGameMode.cpp'
gs=read(gm_cpp)
for inc in [
    '#include "System/HWDungeonDirector.h"',
    '#include "System/HWCoopCombatSubsystem.h"',
    '#include "System/HWSystemTypes.h"'
]:
    if inc not in gs:
        gs=gs.replace('#include "Combat/HWCombatComponent.h"',
            '#include "Combat/HWCombatComponent.h"\n'+inc,1)

if 'EncounterDungeon = GetWorld()->SpawnActor<AHWDungeonDirector>' not in gs:
    marker='''    if (!UGameplayStatics::GetActorOfClass(this, AHWGrayboxArena::StaticClass()))
'''
    hook='''    if (!DungeonId.IsNone())
    {
        EncounterDungeon = Cast<AHWDungeonDirector>(
            UGameplayStatics::GetActorOfClass(this, AHWDungeonDirector::StaticClass()));

        if (!EncounterDungeon)
        {
            EncounterDungeon = GetWorld()->SpawnActor<AHWDungeonDirector>(
                AHWDungeonDirector::StaticClass(),
                FVector::ZeroVector,
                FRotator::ZeroRotator);
        }

        if (EncounterDungeon)
        {
            EncounterDungeon->ConfigureDungeon(DungeonId, EHWSystemDifficulty::Normal);
            EncounterDungeon->OnDungeonCompleted.AddUniqueDynamic(
                this,
                &AHWCombatGameMode::HandleDungeonCompleted);
            EncounterDungeon->OnDungeonFailed.AddUniqueDynamic(
                this,
                &AHWCombatGameMode::HandleDungeonFailed);
            EncounterDungeon->StartDungeon();
        }
    }

'''
    if marker not in gs: raise SystemExit('game mode arena spawn marker changed')
    gs=gs.replace(marker,hook+marker,1)

old_boss_spawn='''    if (!Boss)
    {
        Boss = GetWorld()->SpawnActor<AHWBossCharacter>(
            AHWBossCharacter::StaticClass(),
            FVector(450.f, 0.f, 115.f),
            FRotator(0.f, 180.f, 0.f));
    }
'''
new_boss_spawn='''    if (!Boss && !EncounterDungeon)
    {
        Boss = GetWorld()->SpawnActor<AHWBossCharacter>(
            AHWBossCharacter::StaticClass(),
            FVector(450.f, 0.f, 115.f),
            FRotator(0.f, 180.f, 0.f));
    }
'''
if old_boss_spawn in gs:
    gs=gs.replace(old_boss_spawn,new_boss_spawn,1)

if 'Coop->GetAliveCount() > 0' not in gs:
    old='''void AHWCombatGameMode::HandlePlayerDied()
{
    if (bOutcomeResolved)
    {
        return;
    }
    bOutcomeResolved = true;
'''
    new='''void AHWCombatGameMode::HandlePlayerDied()
{
    if (bOutcomeResolved)
    {
        return;
    }

    if (UHWCoopCombatSubsystem* Coop =
        GetWorld() ? GetWorld()->GetSubsystem<UHWCoopCombatSubsystem>() : nullptr)
    {
        if (Coop->GetPartySize() > 1 && Coop->GetAliveCount() > 0)
        {
            // One player is down. The other players may revive them.
            return;
        }
    }

    if (EncounterDungeon)
    {
        EncounterDungeon->ReportPartyWipe();
        return;
    }

    bOutcomeResolved = true;
'''
    if old not in gs: raise SystemExit('game mode HandlePlayerDied context changed')
    gs=gs.replace(old,new,1)

if 'void AHWCombatGameMode::HandleDungeonCompleted()' not in gs:
    gs += '''

void AHWCombatGameMode::HandleDungeonCompleted()
{
    if (bOutcomeResolved)
    {
        return;
    }

    bOutcomeResolved = true;
    if (!bCanRecordVictory)
    {
        return;
    }

    if (bQuestRun)
    {
        if (QuestRuns)
        {
            QuestRuns->CompleteEncounter(GetWorld(), RunId);
        }
        return;
    }

    if (GetGameInstance())
    {
        if (UHWProfileSubsystem* Profile =
            GetGameInstance()->GetSubsystem<UHWProfileSubsystem>())
        {
            Profile->RecordVictory(RunId, EncounterId);
        }
    }
}

void AHWCombatGameMode::HandleDungeonFailed(FString Reason)
{
    if (bOutcomeResolved)
    {
        return;
    }

    bOutcomeResolved = true;
    if (bQuestRun && QuestRuns)
    {
        QuestRuns->FailEncounter(GetWorld(), RunId);
    }
}
'''
write(gm_cpp,gs); print('APPLY authored dungeon lifecycle integration')

print('SYSTEM CORE V1 part2 applied')
