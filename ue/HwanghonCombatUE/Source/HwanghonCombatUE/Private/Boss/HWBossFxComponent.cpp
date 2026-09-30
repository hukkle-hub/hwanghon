#include "Boss/HWBossFxComponent.h"

#include "Boss/HWBossCharacter.h"
#include "Boss/HWBossCanonRules.h"
#include "System/HWBossSystemComponent.h"
#include "Character/HWAinCharacter.h"
#include "Components/CapsuleComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "GameFramework/Character.h"
#include "Kismet/GameplayStatics.h"
#include "EngineUtils.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Particles/ParticleSystem.h"
#include "Particles/ParticleSystemComponent.h"

namespace
{
    // Picked from pictures (-HWQA=fxgallery on the EP01 room floor, docs/design/167 §2), not from names.
    const TCHAR* const GruxFx = TEXT("/Game/ParagonGrux/FX/Particles");
    struct FFxEntry { const TCHAR* Key; const TCHAR* Path; };
    const FFxEntry Entries[] = {
        { TEXT("hand_trail"),  TEXT("Skins/Grux_Beetle_Magma/P_Grux_Magma_StampedTrail.P_Grux_Magma_StampedTrail") },           // 19: embers shed by a moving hand
        { TEXT("spin_ring"),   TEXT("Skins/Grux_Beetle_Magma/P_GruxUlt_MagmaGroundInteraction.P_GruxUlt_MagmaGroundInteraction") }, // 17: fire ring on the floor
        { TEXT("spin_hit"),    TEXT("Skins/Grux_Beetle_Magma/P_Grux_Magma_Whirlwind_Impact.P_Grux_Magma_Whirlwind_Impact") },    // 01
        { TEXT("residue"),     TEXT("Skins/Grux_Beetle_Magma/P_Grux_Magma_StampedLegcyFire.P_Grux_Magma_StampedLegcyFire") },   // 18: small fires that burn out late
        { TEXT("feet_set"),    TEXT("Abilities/RipplingSmash/FX/P_RipplingSmash_Aligned_Initial.P_RipplingSmash_Aligned_Initial") }, // 23: embers kicked up where it plants
        { TEXT("dust"),        TEXT("Abilities/Ultimate/FX/Rework/P_GruxUlt_GroundInteraction.P_GruxUlt_GroundInteraction") },    // 16: dust ring
        { TEXT("elbow_hit"),   TEXT("Skins/Grux_Beetle_Magma/P_Grux_Magma_Melee_Impact.P_Grux_Magma_Melee_Impact") },            // 11
        { TEXT("deflect"),     TEXT("Abilities/Ultimate/FX/P_Execute_WeaponClangV2.P_Execute_WeaponClangV2") },                  // 13: «틱—»
        { TEXT("rebound"),     TEXT("Abilities/Ultimate/FX/P_Execute_WeaponClang.P_Execute_WeaponClang") },                      // 12: the dome on Kain's blade
        { TEXT("rubble"),      TEXT("Abilities/Stampede/FX/P_Stampede_Intro.P_Stampede_Intro") },                                // 05: concrete chips
        { TEXT("slam_dust"),   TEXT("Abilities/HardKnocks/FX/P_Hardknocks_AOE.P_Hardknocks_AOE") },                              // 14
    };
    const FName Chest(TEXT("mixamorig_Spine2"));
    const FName HandL(TEXT("mixamorig_LeftHand"));
    const FName HandR(TEXT("mixamorig_RightHand"));
    const FName ElbowR(TEXT("mixamorig_RightForeArm"));
    const FName FootBones[2] = { TEXT("mixamorig_LeftFoot"), TEXT("mixamorig_RightFoot") };
    const FLinearColor GlyphRed(1.f, 0.16f, 0.08f);
    const FLinearColor SeamOrange(1.f, 0.5f, 0.12f);
}

UHWBossFxComponent::UHWBossFxComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UHWBossFxComponent::Bind(AHWBossCharacter* InBoss, UHWBossCanonRules* Rules)
{
    Boss = InBoss;
    if (!InBoss) return;
    for (const FFxEntry& E : Entries)
    {
        if (UParticleSystem* PS = LoadObject<UParticleSystem>(nullptr, *FString::Printf(TEXT("%s/%s"), GruxFx, E.Path)))
        {
            Systems.Add(E.Key, PS);
        }
        else
        {
            UE_LOG(LogTemp, Warning, TEXT("[HWFx] missing %s"), E.Path);
        }
    }
    USkeletalMeshComponent* Mesh = InBoss->GetMesh();
    auto MakeLight = [&](const TCHAR* Name, FName Socket, const FLinearColor& Color, float Radius)
    {
        UPointLightComponent* L = NewObject<UPointLightComponent>(InBoss, Name);
        L->SetupAttachment(Mesh, Socket);
        L->SetLightColor(Color);
        L->SetIntensity(0.f);
        L->SetAttenuationRadius(Radius);
        L->SetCastShadows(false);
        L->RegisterComponent();
        return L;
    };
    if (UMaterialInterface* Overlay = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/Hwanghon/VFX/M_HW_GlyphOverlay.M_HW_GlyphOverlay")))
    {
        // the glow drawn over the body itself: a light alone vanished in the white EP01 room
        Skin = UMaterialInstanceDynamic::Create(Overlay, this);
        Skin->SetScalarParameterValue(TEXT("Glow"), 0.f);
        Mesh->SetOverlayMaterial(Skin);
    }
    Glyph = MakeLight(TEXT("HWFxGlyph"), Chest, GlyphRed, 420.f);
    Seam = MakeLight(TEXT("HWFxSeam"), ElbowR, SeamOrange, 160.f);
    InBoss->OnBossStateChanged.AddUniqueDynamic(this, &UHWBossFxComponent::HandleState);
    if (Rules) Rules->OnCanonBeat.AddUniqueDynamic(this, &UHWBossFxComponent::HandleCanonBeat);
    if (UHWBossSystemComponent* System = InBoss->GetBossSystem())
    {
        System->OnPartBroken.AddUniqueDynamic(this, &UHWBossFxComponent::HandlePartBroken);
    }
    for (int32 I = 0; I < 2; ++I) PrevFootZ[I] = Bone(FootBones[I]).Z;
}

void UHWBossFxComponent::EndPlay(const EEndPlayReason::Type Reason)
{
    ClearTrails();
    Super::EndPlay(Reason);
}

UParticleSystemComponent* UHWBossFxComponent::Fire(const TCHAR* Key, const FVector& At, float Scale)
{
    const TObjectPtr<UParticleSystem>* PS = Systems.Find(Key);
    if (!PS || !*PS || !GetWorld()) return nullptr;
    return UGameplayStatics::SpawnEmitterAtLocation(GetWorld(), *PS, At, FRotator::ZeroRotator, FVector(Scale), true);
}

UParticleSystemComponent* UHWBossFxComponent::FireAttached(const TCHAR* Key, FName BoneName, float Scale)
{
    const TObjectPtr<UParticleSystem>* PS = Systems.Find(Key);
    if (!PS || !*PS || !Boss.IsValid()) return nullptr;
    UParticleSystemComponent* C = UGameplayStatics::SpawnEmitterAttached(*PS, Boss->GetMesh(), BoneName, FVector::ZeroVector,
        FRotator::ZeroRotator, EAttachLocation::SnapToTarget, false);
    if (C) C->SetWorldScale3D(FVector(Scale));
    return C;
}

FVector UHWBossFxComponent::Bone(FName Name) const
{
    if (!Boss.IsValid()) return FVector::ZeroVector;
    USkeletalMeshComponent* Mesh = Boss->GetMesh();
    return Mesh && Mesh->GetBoneIndex(Name) != INDEX_NONE ? Mesh->GetBoneLocation(Name) : Boss->GetActorLocation();
}

FVector UHWBossFxComponent::Feet() const
{
    if (!Boss.IsValid()) return FVector::ZeroVector;
    const UCapsuleComponent* Cap = Boss->GetCapsuleComponent();
    return Boss->GetActorLocation() - FVector(0.f, 0.f, Cap ? Cap->GetScaledCapsuleHalfHeight() : 0.f);
}

FVector UHWBossFxComponent::TowardPlayer(float Cm, float Z) const
{
    const FVector F = Feet();
    const ACharacter* P = UGameplayStatics::GetPlayerCharacter(this, 0);
    const FVector Dir = P ? (P->GetActorLocation() - F).GetSafeNormal2D() : (Boss.IsValid() ? Boss->GetActorForwardVector() : FVector::ForwardVector);
    return F + Dir * Cm + FVector(0.f, 0.f, Z);
}

void UHWBossFxComponent::ClearTrails()
{
    for (UParticleSystemComponent* T : Trails)
    {
        if (T) T->DeactivateSystem();   // let the shed embers fall instead of vanishing
    }
    Trails.Reset();
}

void UHWBossFxComponent::HandleState(EHWBossState NewState, FName PatternId)
{
    const EHWBossState Was = State;
    State = NewState;
    Pattern = PatternId;
    StateTime = 0.f;
    NextBeat = 0;
    if (NewState == EHWBossState::Tell)
    {
        bFeetSet = false;
        bBreath = false;
    }
    if (NewState == EHWBossState::Strike && PatternId == TEXT("Spin"))
    {
        // «부우웅»: both hands shed embers for the whole unwind; the floor ring shows the reach at the first turn
        Trails.Add(FireAttached(TEXT("hand_trail"), HandL, 0.5f));
        Trails.Add(FireAttached(TEXT("hand_trail"), HandR, 0.5f));
    }
    if (Was == EHWBossState::Strike && NewState != EHWBossState::Strike)
    {
        ClearTrails();
        if (PatternId == TEXT("Spin") || Pattern == TEXT("Spin"))
        {
            // MH Wilds Arkveld: what the heavy move drew on the floor goes off after it, one fire at a time
            const FVector F = Feet();
            const FVector Fwd = Boss.IsValid() ? Boss->GetActorForwardVector().GetSafeNormal2D() : FVector::ForwardVector;
            for (int32 I = 0; I < 5; ++I)
            {
                const FVector Dir = Fwd.RotateAngleAxis(-100.f + 50.f * I, FVector::UpVector);
                Pending.Add({ Clock + 0.15f + 0.12f * I, TEXT("residue"), F + Dir * 230.f + FVector(0, 0, 4), 0.9f });
            }
        }
    }
    if (NewState == EHWBossState::Break)
    {
        // the body is thrown back and stops: dust where it lands, concrete chips from the slide
        Fire(TEXT("dust"), Feet() + FVector(0, 0, 4), 0.8f);
        Fire(TEXT("rubble"), Feet() + FVector(0, 0, 4), 0.8f);
    }
    if (NewState == EHWBossState::Dead)
    {
        ClearTrails();
        Pending.Add({ Clock + 0.7f, TEXT("slam_dust"), Feet() + FVector(0, 0, 4), 1.f });   // the fall (ragdoll) lands
    }
}

void UHWBossFxComponent::HandleCanonBeat(FName Beat)
{
    if (Beat == TEXT("deflect"))
    {
        Fire(TEXT("deflect"), TowardPlayer(95.f, 170.f), 0.7f);   // «틱—» inside the guard: one small spray, no fire
    }
    else if (Beat == TEXT("rebound"))
    {
        // on Kain's blade (L513), not on Ain: the nearest other hero to the body
        FVector At = TowardPlayer(175.f, 0.f);
        float Best = TNumericLimits<float>::Max();
        const APawn* Player = UGameplayStatics::GetPlayerPawn(this, 0);
        for (TActorIterator<AHWAinCharacter> It(GetWorld()); It; ++It)
        {
            const float D = Boss.IsValid() ? FVector::Dist2D(It->GetActorLocation(), Boss->GetActorLocation()) : 0.f;
            if (*It != Player && D < Best) { Best = D; At = It->GetActorLocation(); At.Z = Feet().Z; }
        }
        Fire(TEXT("rebound"), At + FVector(0, 0, 120.f), 0.75f);
        Fire(TEXT("rubble"), At + FVector(0, 0, 4.f), 0.7f);
    }
    else if (Beat == TEXT("sever"))
    {
        Fire(TEXT("elbow_hit"), Bone(ElbowR), 0.8f);
        Fire(TEXT("deflect"), Bone(ElbowR), 1.f);
    }
}

namespace
{
    // where each breakable part sits on the Mixamo body (head sack, chest plate, the left leg's straw)
    FName PartBone(FName PartId)
    {
        if (PartId == TEXT("head")) return TEXT("mixamorig_Head");
        if (PartId == TEXT("armor")) return TEXT("mixamorig_Spine2");
        return TEXT("mixamorig_LeftLeg");
    }
}

void UHWBossFxComponent::HandlePartBroken(FName PartId)
{
    // MH: a broken part shows it - the moment is loud (chips, a fiery crack), then the part stays visibly wrecked
    const FVector At = Bone(PartBone(PartId));
    Fire(TEXT("elbow_hit"), At, 0.7f);
    Fire(TEXT("rubble"), At, 0.5f);
    Fire(TEXT("deflect"), At, 0.9f);
    Broken.Add(PartId);
}

void UHWBossFxComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    if (!Boss.IsValid()) return;
    AHWBossCharacter* B = Boss.Get();
    Clock += DeltaTime;
    StateTime += DeltaTime;

    const FHWBossPatternSpec& P = B->GetCurrentPattern();
    // ---- glyph: builds through the tell, flares at the breath, holds through the strike, cools in recovery
    float Glow = 0.f;
    if (State == EHWBossState::Tell && P.TellDuration > 0.f)
    {
        const float U = FMath::Clamp(StateTime / P.TellDuration, 0.f, 1.f);
        const float Breath = P.bBig ? 0.25f / P.TellDuration : 0.f;   // the last half beat of a big move (EP01 L469)
        Glow = P.bBig ? FMath::Lerp(4.f, 60.f, U) : 90.f * U;
        if (P.bBig && U > 1.f - Breath)
        {
            Glow = 110.f + 40.f * FMath::Sin(Clock * 40.f);
            if (!bBreath)
            {
                bBreath = true;
            }
        }
        if (Pattern == TEXT("Spin") && !bFeetSet && StateTime >= 0.8f)
        {
            bFeetSet = true;   // «발 고정»: the feet bite into the mat
            Fire(TEXT("feet_set"), Feet() + FVector(0, 0, 4), 0.9f);
            Fire(TEXT("dust"), Feet() + FVector(0, 0, 4), 0.55f);
        }
    }
    else if (State == EHWBossState::Strike)
    {
        Glow = 90.f;
    }
    else if (State == EHWBossState::Recover)
    {
        Glow = FMath::Max(0.f, 90.f * (1.f - StateTime / 0.6f));
    }
    if (Skin)
    {
        // posture broken: the glyph is out (docs/design/166 §3) and only the joints glow orange
        Skin->SetVectorParameterValue(TEXT("Color"), State == EHWBossState::Break ? FLinearColor(1.f, 0.45f, 0.08f) : FLinearColor(1.f, 0.14f, 0.05f));
        if (State == EHWBossState::Break) Glow = 12.f + 8.f * FMath::Sin(Clock * 9.f);
    }
    if (Glyph)
    {
        // a small tell (elbow) lights the joint, not the chest
        const bool bLocal = !P.bBig || Pattern == TEXT("Elbow");
        Glyph->SetIntensity(bLocal ? 0.f : Glow);
        if (Skin) Skin->SetScalarParameterValue(TEXT("Glow"), (bLocal ? Glow * 0.35f : Glow) / 75.f);
        if (Seam) Seam->SetIntensity(State == EHWBossState::Break ? 25.f + 20.f * FMath::Sin(Clock * 9.f) : (bLocal ? Glow * 0.6f : 0.f));
    }

    // ---- beats: at the pattern's own beat times
    if (State == EHWBossState::Strike)
    {
        while (P.Beats.IsValidIndex(NextBeat) && StateTime >= P.Beats[NextBeat].At)
        {
            if (Pattern == TEXT("Spin"))
            {
                if (NextBeat == 0) Fire(TEXT("spin_ring"), Feet() + FVector(0, 0, 4), 0.7f);   // the reach, on the floor - low, the body stays readable
                const FName Hand = NextBeat % 2 ? HandR : HandL;
                Fire(TEXT("spin_hit"), Bone(Hand), 0.55f);
            }
            else if (Pattern == TEXT("Elbow"))
            {
                Fire(TEXT("elbow_hit"), Bone(ElbowR), 1.1f);
                Fire(TEXT("dust"), TowardPlayer(150.f, 4.f), 0.4f);
            }
            ++NextBeat;
        }
    }

    // ---- broken parts keep leaking (docs/design/166 tabs 5-7)
    LeakClock += DeltaTime;
    if (Broken.Num() > 0 && LeakClock >= 0.8f && !B->IsDead())
    {
        LeakClock = 0.f;
        for (const FName& Part : Broken)
        {
            Fire(TEXT("feet_set"), Bone(PartBone(Part)), Part == TEXT("armor") ? 0.35f : 0.25f);
        }
    }
    if (Glyph && Broken.Contains(TEXT("armor")) && Glyph->Intensity < 20.f)
    {
        Glyph->SetIntensity(20.f + 10.f * FMath::Sin(Clock * TWO_PI * 0.5f));   // the exposed core breathes
    }

    // ---- residue that burns out late
    for (int32 I = Pending.Num() - 1; I >= 0; --I)
    {
        if (Clock >= Pending[I].At)
        {
            Fire(*Pending[I].Key.ToString(), Pending[I].Where, Pending[I].Scale);
            Pending.RemoveAt(I);
        }
    }

    // ---- footfalls: 3 m of straw and wire lands with dust (MH: every step of a big monster reads)
    const float FloorZ = Feet().Z;
    if (!B->IsDead() && B->GetVelocity().Size2D() > 40.f)
    {
        for (int32 I = 0; I < 2; ++I)
        {
            StepCooldown[I] -= DeltaTime;
            const FVector Foot = Bone(FootBones[I]);
            const float H = Foot.Z - FloorZ;
            if (H < 22.f && PrevFootZ[I] - FloorZ >= 22.f && StepCooldown[I] <= 0.f)
            {
                Fire(TEXT("dust"), FVector(Foot.X, Foot.Y, FloorZ + 3.f), 0.3f);
                StepCooldown[I] = 0.3f;
            }
            PrevFootZ[I] = Foot.Z;
        }
    }
}

FString UHWBossFxComponent::Describe() const
{
    float G = 0.f;
    if (Skin) Skin->GetScalarParameterValue(TEXT("Glow"), G);
    return FString::Printf(TEXT("skin=%.2f glyph=%.0f seam=%.0f trails=%d pending=%d"), G,
        Glyph ? Glyph->Intensity : 0.f, Seam ? Seam->Intensity : 0.f, Trails.Num(), Pending.Num());
}
