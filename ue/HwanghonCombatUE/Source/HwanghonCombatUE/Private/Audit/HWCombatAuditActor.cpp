#include "Audit/HWCombatAuditActor.h"

#include "Boss/HWBossCharacter.h"
#include "Character/HWAinCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Animation/HWPlayerPresentationComponent.h"

#include "HAL/FileManager.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Components/CapsuleComponent.h"

AHWCombatAuditActor::AHWCombatAuditActor()
{
    PrimaryActorTick.bCanEverTick = true;
}

void AHWCombatAuditActor::BeginPlay()
{
    Super::BeginPlay();

    StartTime = GetWorld()->GetTimeSeconds();
    Rows.Add(TEXT("time,event,detail,frame_ms,player_action,player_phase,player_hp,player_stamina,boss_state,boss_pattern,boss_phase,gap_cm,penetration_cm,last_reaction,last_reaction_age_ms"));

    ResolveActors();

    if (Player && Player->GetCombat())
    {
        Player->GetCombat()->OnContact.AddDynamic(this, &AHWCombatAuditActor::HandlePlayerContact);
        Player->GetCombat()->OnDamaged.AddDynamic(this, &AHWCombatAuditActor::HandlePlayerDamaged);
    }

    if (Player && Player->GetPresentation())
    {
        Player->GetPresentation()->OnVisualContact.AddDynamic(
            this,
            &AHWCombatAuditActor::HandleVisualPlayerContact);
    }
}

void AHWCombatAuditActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    SaveNow();
    Super::EndPlay(EndPlayReason);
}

void AHWCombatAuditActor::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    LastFrameMs = DeltaSeconds * 1000.f;
    SampleAccumulator += DeltaSeconds;
    FlushAccumulator += DeltaSeconds;

    if (!Player || !Boss)
    {
        ResolveActors();
    }

    if (SampleAccumulator >= 0.05f)
    {
        AddSample(DeltaSeconds);
        SampleAccumulator = 0.f;
    }

    if (FlushAccumulator >= 10.f)
    {
        SaveNow();
        FlushAccumulator = 0.f;
    }
}

void AHWCombatAuditActor::ResolveActors()
{
    if (!Player)
    {
        Player = Cast<AHWAinCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0));
    }

    if (!Boss)
    {
        Boss = Cast<AHWBossCharacter>(UGameplayStatics::GetActorOfClass(this, AHWBossCharacter::StaticClass()));
    }
}

void AHWCombatAuditActor::AddSample(float DeltaSeconds)
{
    if (!Player || !Boss || !Player->GetCombat())
    {
        return;
    }

    const UHWCombatComponent* Combat = Player->GetCombat();
    const float T = GetWorld()->GetTimeSeconds() - StartTime;
    const float Gap = FVector::Dist2D(Player->GetActorLocation(), Boss->GetActorLocation());

    const float RadiusSum =
        Player->GetCapsuleComponent()->GetScaledCapsuleRadius()
        + Boss->GetCapsuleComponent()->GetScaledCapsuleRadius();

    const float Penetration = FMath::Max(0.f, RadiusSum - Gap);
    const float ReactionAgeMs = Boss->GetLastReactionAgeSeconds() * 1000.f;

    Rows.Add(FString::Printf(
        TEXT("%.3f,sample,,%.3f,%d,%.4f,%.1f,%.1f,%d,%s,%.4f,%.2f,%.2f,%d,%.2f"),
        T,
        LastFrameMs,
        static_cast<int32>(Combat->GetCurrentAction()),
        Combat->GetActionNormalized(),
        Combat->GetHealth(),
        Combat->GetStamina(),
        static_cast<int32>(Boss->GetBossState()),
        *Escape(Boss->GetCurrentPatternId().ToString()),
        Boss->GetBossStateNormalized(),
        Gap,
        Penetration,
        static_cast<int32>(Boss->GetLastReactionTier()),
        ReactionAgeMs));
}

void AHWCombatAuditActor::AddEvent(const FString& Name, const FString& Detail)
{
    const float T = GetWorld()->GetTimeSeconds() - StartTime;
    Rows.Add(FString::Printf(
        TEXT("%.3f,%s,%s,%.3f,,,,,,,,,,,"),
        T,
        *Escape(Name),
        *Escape(Detail),
        LastFrameMs));
}

void AHWCombatAuditActor::HandlePlayerContact(EHWActionType Action, EHWAttackTier Tier, float Damage)
{
    AddEvent(TEXT("player_contact"), FString::Printf(TEXT("action=%d tier=%d damage=%.1f"), static_cast<int32>(Action), static_cast<int32>(Tier), Damage));
}

void AHWCombatAuditActor::HandlePlayerDamaged(float Damage, EHWAttackTier Tier)
{
    AddEvent(TEXT("player_damaged"), FString::Printf(TEXT("tier=%d damage=%.1f"), static_cast<int32>(Tier), Damage));
}

void AHWCombatAuditActor::HandleVisualPlayerContact(EHWActionType Action, float SourceTimeSeconds)
{
    AddEvent(
        TEXT("visual_player_contact"),
        FString::Printf(TEXT("action=%d source_time=%.4f"), static_cast<int32>(Action), SourceTimeSeconds));
}

FString AHWCombatAuditActor::Escape(const FString& In) const
{
    FString Out = In;
    Out.ReplaceInline(TEXT("\""), TEXT("\"\""));
    return FString::Printf(TEXT("\"%s\""), *Out);
}

void AHWCombatAuditActor::SaveNow()
{
    if (Rows.IsEmpty())
    {
        return;
    }

    const FString Dir = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("CombatAudit"));
    IFileManager::Get().MakeDirectory(*Dir, true);

    const FString Filename = FString::Printf(TEXT("HwanghonAudit_%s.csv"), *FDateTime::Now().ToString(TEXT("%Y%m%d_%H%M%S")));
    LastSavedPath = FPaths::Combine(Dir, Filename);

    const FString Joined = FString::Join(Rows, TEXT("\n")) + TEXT("\n");
    FFileHelper::SaveStringToFile(Joined, *LastSavedPath, FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM);
}
