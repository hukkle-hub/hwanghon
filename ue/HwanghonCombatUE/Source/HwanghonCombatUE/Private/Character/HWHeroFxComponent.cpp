#include "Character/HWHeroFxComponent.h"

#include "Camera/HWLockOnComponent.h"
#include "Character/HWAinCharacter.h"
#include "Components/CapsuleComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "GameFramework/Character.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Particles/ParticleSystem.h"
#include "Particles/ParticleEmitter.h"
#include "Particles/ParticleLODLevel.h"
#include "Particles/ParticleModuleRequired.h"
#include "Particles/ParticleSystemComponent.h"
#include "System/HWCharacterKitComponent.h"

namespace
{
    // Picked from pictures (-HWQA=fxgallery, docs/design/171 §1), not from names.
    struct FFxEntry { const TCHAR* Key; const TCHAR* Path; };
    const FFxEntry Entries[] = {
        { TEXT("trail"),  TEXT("/Game/ParagonCountess/FX/Particles/p_CountessMeleeTrail.p_CountessMeleeTrail") },                         // anim trail between two sockets
        { TEXT("glint"),  TEXT("/Game/ParagonCountess/FX/Particles/Abilities/BlinkStrike/FX/p_Countess_BlinkStrikeFlash.p_Countess_BlinkStrikeFlash") }, // 05: sparks
        { TEXT("impact"), TEXT("/Game/ParagonCountess/FX/Particles/Abilities/Primary/FX/p_CountessImpact.p_CountessImpact") },             // 10: star flash
        { TEXT("xslash"), TEXT("/Game/ParagonCountess/FX/Particles/Abilities/BlinkStrike/FX/p_Countess_XSlash.p_Countess_XSlash") },       // 09: crossed arcs
        { TEXT("burst"),  TEXT("/Game/ParagonCountess/FX/Particles/Abilities/RollingDark/FX/p_RollingDark_ImpactFX.p_RollingDark_ImpactFX") }, // 13: column of embers
        { TEXT("blink"),  TEXT("/Game/ParagonCountess/FX/Particles/Abilities/BlinkStrike/FX/P_Countess_TeleportBegin.P_Countess_TeleportBegin") }, // 08: where a dodge left
        { TEXT("clone"),  TEXT("/Game/ParagonCountess/FX/Particles/Abilities/BlinkStrike/FX/p_Countess_ShadowCloneBurst.p_Countess_ShadowCloneBurst") }, // 06
        { TEXT("ring"),   TEXT("/Game/ParagonGrux/FX/Particles/Skins/Grux_Beetle_Magma/P_GruxUlt_MagmaGroundInteraction.P_GruxUlt_MagmaGroundInteraction") }, // boss 17: ring on the floor
        { TEXT("dust"),   TEXT("/Game/ParagonGrux/FX/Particles/Abilities/Ultimate/FX/Rework/P_GruxUlt_GroundInteraction.P_GruxUlt_GroundInteraction") }, // boss 16: dust ring
    };
    const FName TipR(TEXT("FX_WeaponTip_R"));
    const FName BaseR(TEXT("FX_WeaponBase_R"));
    const FName TipL(TEXT("FX_WeaponTip_L"));
    const FName BaseL(TEXT("FX_WeaponBase_L"));
    const FName HandR(TEXT("Muzzle_01"));
    constexpr int32 LightPool = 3;
}

UHWHeroFxComponent::UHWHeroFxComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UHWHeroFxComponent::Bind(AHWAinCharacter* InHero, UHWCharacterKitComponent* Kit)
{
    Hero = InHero;
    if (!InHero || !Kit || !GetWorld() || GetWorld()->GetNetMode() == NM_DedicatedServer) return;
    for (const FFxEntry& E : Entries)
    {
        if (UParticleSystem* PS = LoadObject<UParticleSystem>(nullptr, E.Path)) Systems.Add(E.Key, PS);
        else UE_LOG(LogTemp, Warning, TEXT("[HWHeroFx] missing %s"), E.Path);
    }
    if (UMaterialInterface* M = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/Hwanghon/VFX/M_HW_TrailAdditive.M_HW_TrailAdditive")))
    {
        TrailMat = UMaterialInstanceDynamic::Create(M, this);
    }
    if (UMaterialInterface* M = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/Hwanghon/VFX/M_HW_GlyphOverlay.M_HW_GlyphOverlay")))
    {
        Skin = UMaterialInstanceDynamic::Create(M, this);
    }
    TintBase = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/Hwanghon/VFX/M_HW_ParticleTint.M_HW_ParticleTint"));
    USkeletalMeshComponent* Mesh = InHero->GetMesh();
    Tip = NewObject<UPointLightComponent>(InHero, TEXT("HWHeroFxTip"));
    Tip->SetupAttachment(Mesh, TipR);
    Tip->SetIntensity(0.f);
    Tip->SetAttenuationRadius(160.f);
    Tip->SetCastShadows(false);
    Tip->SetIndirectLightingIntensity(0.f);   // Lumen GI lags ~1 s: a flash fed to it left a pool on the floor
    Tip->RegisterComponent();
    for (int32 I = 0; I < LightPool; ++I)
    {
        UPointLightComponent* L = NewObject<UPointLightComponent>(InHero, *FString::Printf(TEXT("HWHeroFxHit%d"), I));
        L->SetupAttachment(InHero->GetRootComponent());
        L->SetUsingAbsoluteLocation(true);
        L->SetIntensity(0.f);
        L->SetCastShadows(false);
        L->SetIndirectLightingIntensity(0.f);
        L->RegisterComponent();
        Lights.Add(L);
    }
    Kit->OnAbilityActivated.AddUniqueDynamic(this, &UHWHeroFxComponent::HandleAbility);
    Kit->OnAbilityHitResolved.AddUObject(this, &UHWHeroFxComponent::HandleHit);
}

void UHWHeroFxComponent::EndPlay(const EEndPlayReason::Type Reason)
{
    for (UParticleSystemComponent* T : Trails) if (T) T->DestroyComponent();
    Trails.Reset();
    for (FOrb& O : Orbs)
    {
        if (O.Mesh) O.Mesh->DestroyComponent();
        if (O.Light) O.Light->DestroyComponent();
    }
    Orbs.Reset();
    Super::EndPlay(Reason);
}

float UHWHeroFxComponent::WorldTime() const
{
    return GetWorld() ? GetWorld()->GetTimeSeconds() : 0.f;
}

FLinearColor UHWHeroFxComponent::HeroColor() const
{
    if (Id == TEXT("kain")) return FLinearColor(0.32f, 0.5f, 1.f);    // steel blue: (0.55, 0.72, 1) burnt out to white
    if (Id == TEXT("ryu")) return FLinearColor(1.f, 0.07f, 0.05f);     // red
    if (Id == TEXT("sera")) return FLinearColor(0.12f, 0.45f, 1.f);   // blue
    return FLinearColor(1.f, 0.45f, 0.08f);                           // Ain: dusk orange
}

bool UHWHeroFxComponent::IsSlotBuff(EHWAbilitySlot Slot) const
{
    if (Slot == EHWAbilitySlot::Skill2) return Id == TEXT("kain");
    return Slot == EHWAbilitySlot::Skill4 && Id != TEXT("kain");
}

bool UHWHeroFxComponent::IsSlotDodge(EHWAbilitySlot Slot) const
{
    return Slot == EHWAbilitySlot::Skill2 && Id != TEXT("kain");
}

FVector UHWHeroFxComponent::Socket(FName Name) const
{
    if (!Hero.IsValid()) return FVector::ZeroVector;
    USkeletalMeshComponent* Mesh = Hero->GetMesh();
    return Mesh && Mesh->DoesSocketExist(Name) ? Mesh->GetSocketLocation(Name) : Hero->GetActorLocation();
}

FVector UHWHeroFxComponent::AimPoint(float Forward) const
{
    // the lock-on target's near side, else straight ahead; on the floor
    const FVector From = Hero->GetActorLocation();
    FVector To = From + Hero->GetActorForwardVector() * Forward;
    if (UHWLockOnComponent* Lock = Hero->GetLockOn())
    {
        if (AActor* T = Lock->GetTarget()) To = T->GetActorLocation();
    }
    const float FloorZ = From.Z - Hero->GetCapsuleComponent()->GetScaledCapsuleHalfHeight();
    return FVector(To.X, To.Y, FloorZ);
}

bool UHWHeroFxComponent::ShouldTint(FName Key) const
{
    if (Id == TEXT("ryu")) return false;                                   // the Countess red is Ryu's own
    if (Id == TEXT("ain")) return Key != TEXT("ring") && Key != TEXT("dust");   // Grux fire is already dusk orange
    return true;
}

void UHWHeroFxComponent::Tint(UParticleSystemComponent* C, UParticleSystem* PS)
{
    if (!C || !PS || !TintBase) return;
    FHWHeroFxTints* Set = Tints.Find(PS);
    if (!Set)
    {
        // each emitter keeps its own texture (the shape); the hue becomes the hero's
        Set = &Tints.Add(PS);
        for (UParticleEmitter* E : PS->Emitters)
        {
            UMaterialInstanceDynamic* M = nullptr;
            UParticleLODLevel* LOD = E ? E->GetLODLevel(0) : nullptr;
            UMaterialInterface* Src = LOD && LOD->RequiredModule ? LOD->RequiredModule->Material.Get() : nullptr;
            // only light-emitting (additive) layers take the hue; smoke made additive filled the whole frame
            // the Flare sprites (T_blue_sharp) blew up into full-screen starbursts once recoloured: off
            const bool bFlare = E && E->GetEmitterName().ToString().StartsWith(TEXT("Flare"));
            if (Src && !bFlare && Src->GetBlendMode() == BLEND_Additive)
            {
                TArray<UTexture*> Used;
                Src->GetUsedTextures(Used);
                UTexture* Pick = nullptr;
                for (UTexture* T : Used)
                {
                    const FString N = T ? T->GetName() : FString();
                    if (!T || N.Contains(TEXT("Normal")) || N.Contains(TEXT("Distort")) || N.Contains(TEXT("Noise")) || N.EndsWith(TEXT("_N"))) continue;
                    Pick = T;
                    break;
                }
                if (Pick)
                {
                    M = UMaterialInstanceDynamic::Create(TintBase, this);
                    M->SetTextureParameterValue(TEXT("Tex"), Pick);
                    M->SetVectorParameterValue(TEXT("Color"), HeroColor());
                    const FLinearColor C = HeroColor();
                    M->SetScalarParameterValue(TEXT("Glow"), 0.33f / FMath::Max(0.5f, C.R + C.G + C.B));   // the pack's particle colours are HDR (x5-x20)
                }
            }
            Set->Emitters.Add(M);
            if (!M && E) Set->Off.Add(E->GetEmitterName());
            UE_LOG(LogTemp, Display, TEXT("[HWHeroFx] tint %s/%s %s"), *PS->GetName(), E ? *E->GetEmitterName().ToString() : TEXT("-"),
                M ? TEXT("recoloured") : TEXT("off"));
        }
    }
    for (int32 I = 0; I < Set->Emitters.Num(); ++I)
    {
        if (Set->Emitters[I]) C->SetMaterial(I, Set->Emitters[I]);
    }
    for (const FName& N : Set->Off) C->SetEmitterEnable(N, false);
}

UParticleSystemComponent* UHWHeroFxComponent::Fire(FName Key, const FVector& At, float Scale, const FRotator& Rot)
{
    const TObjectPtr<UParticleSystem>* PS = Systems.Find(Key);
    if (!PS || !*PS || !GetWorld()) return nullptr;
    UParticleSystemComponent* C = UGameplayStatics::SpawnEmitterAtLocation(GetWorld(), *PS, At, Rot, FVector(Scale), true);
    if (ShouldTint(Key)) Tint(C, *PS);
    return C;
}

void UHWHeroFxComponent::Flash(const FVector& At, float Peak, float Seconds, float Radius)
{
    if (Lights.IsEmpty()) return;
    const int32 I = NextLight++ % Lights.Num();
    Fades.RemoveAll([I](const FLightFade& F) { return F.Index == I; });
    UPointLightComponent* L = Lights[I];
    L->SetWorldLocation(At);
    L->SetLightColor(HeroColor());
    L->SetAttenuationRadius(Radius);
    L->SetIntensity(Peak);
    Fades.Add({ I, 0.f, Seconds, Peak });
}

void UHWHeroFxComponent::StartTrails(float MaxSeconds)
{
    const TObjectPtr<UParticleSystem>* PS = Systems.Find(TEXT("trail"));
    if (!PS || !*PS || !Hero.IsValid()) return;
    for (UParticleSystemComponent* T : Trails) if (T) { T->EndTrails(); T->bAutoDestroy = true; }
    Trails.Reset();
    const bool bBoth = Id == TEXT("ryu");
    for (int32 Side = 0; Side < (bBoth ? 2 : 1); ++Side)
    {
        UParticleSystemComponent* C = UGameplayStatics::SpawnEmitterAttached(*PS, Hero->GetMesh(), NAME_None,
            FVector::ZeroVector, FRotator::ZeroRotator, EAttachLocation::KeepRelativeOffset, false);
        if (!C) continue;
        if (TrailMat)
        {
            // the pack's trail is Countess red; the hero's arc is drawn in the hero's colour
            for (int32 E = 0; E < FMath::Max(1, (*PS)->Emitters.Num()); ++E) C->SetMaterial(E, TrailMat);
        }
        C->BeginTrails(Side == 0 ? BaseR : BaseL, Side == 0 ? TipR : TipL, ETrailWidthMode_FromCentre, 1.f);
        Trails.Add(C);
    }
    TrailEndAt = WorldTime() + MaxSeconds;
    ++Counts[1];
}

void UHWHeroFxComponent::EndTrails(float After)
{
    if (TrailEndAt < 0.f) return;
    TrailEndAt = FMath::Min(TrailEndAt, WorldTime() + After);
}

void UHWHeroFxComponent::Launch(const FVector& To, float Flight, float Arc, bool bAoe)
{
    if (!Hero.IsValid()) return;
    FOrb O;
    O.From = Socket(HandR);
    O.To = To + FVector(0.f, 0.f, bAoe ? 10.f : 95.f);   // AoE lands on the floor, a single throw at the chest
    O.Flight = FMath::Max(0.05f, Flight);
    O.Arc = Arc;
    O.bAoe = bAoe;
    UStaticMeshComponent* M = NewObject<UStaticMeshComponent>(Hero.Get());
    M->SetStaticMesh(LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Sphere.Sphere")));
    M->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    M->SetCastShadow(false);
    M->SetUsingAbsoluteLocation(true);
    M->SetWorldScale3D(FVector(0.16f));
    if (TrailMat)
    {
        UMaterialInstanceDynamic* Mat = UMaterialInstanceDynamic::Create(TrailMat->Parent, this);
        Mat->SetVectorParameterValue(TEXT("Color"), HeroColor());
        Mat->SetScalarParameterValue(TEXT("Glow"), 9.f);
        Mat->SetScalarParameterValue(TEXT("EdgeMix"), 0.f);
        M->SetMaterial(0, Mat);
    }
    M->SetWorldLocation(O.From);
    M->RegisterComponent();
    UPointLightComponent* L = NewObject<UPointLightComponent>(Hero.Get());
    L->SetUsingAbsoluteLocation(true);
    L->SetLightColor(HeroColor());
    L->SetIntensity(5000.f);
    L->SetAttenuationRadius(260.f);
    L->SetCastShadows(false);
    L->SetIndirectLightingIntensity(0.f);
    L->SetWorldLocation(O.From);
    L->RegisterComponent();
    O.Mesh = M;
    O.Light = L;
    OrbParts.Add(M);
    OrbParts.Add(L);
    Orbs.Add(O);
    ++Counts[4];
}

void UHWHeroFxComponent::Buff(float Seconds)
{
    if (!Skin || !Hero.IsValid()) return;
    Skin->SetVectorParameterValue(TEXT("Color"), HeroColor());
    Hero->GetMesh()->SetOverlayMaterial(Skin);
    BuffLeft = BuffTotal = Seconds;
}

void UHWHeroFxComponent::HandleAbility(FName CharacterId, EHWAbilitySlot Slot, float Multiplier)
{
    if (!Hero.IsValid() || Systems.IsEmpty()) return;
    Id = CharacterId;
    const FVector Feet = Hero->GetActorLocation() - FVector(0.f, 0.f, Hero->GetCapsuleComponent()->GetScaledCapsuleHalfHeight());
    if (TrailMat)
    {
        TrailMat->SetVectorParameterValue(TEXT("Color"), HeroColor());
        // the same brightness for every hue: a pale colour (Kain) at the same glow burnt out to white
        const FLinearColor C = HeroColor();
        const float Norm = 1.5f / FMath::Max(0.5f, C.R + C.G + C.B);
        TrailMat->SetScalarParameterValue(TEXT("Glow"), (Slot == EHWAbilitySlot::Ultimate ? 7.f : 4.5f) * Norm);
    }
    if (IsSlotDodge(Slot))
    {
        // where the hero left: a burst and a dim flash (Ryu leaves a shadow)
        Fire(Id == TEXT("ryu") ? TEXT("clone") : TEXT("blink"), Feet + FVector(0, 0, 90.f));
        Flash(Feet + FVector(0, 0, 100.f), 3000.f, 0.25f, 300.f);
        return;
    }
    if (IsSlotBuff(Slot))
    {
        const float Seconds = (Id == TEXT("ain") || Id == TEXT("ryu")) ? 2.f : 3.f;   // the kit's reduction length
        Buff(Seconds);
        Fire(TEXT("dust"), Feet, 0.45f);
        Flash(Feet + FVector(0, 0, 110.f), 5000.f, 0.5f, 360.f);
        return;
    }
    if (Multiplier <= 0.f) return;

    // tell: the glint on the blade tip as the skill starts (the read before the hit, MH style)
    TipAge = 0.f;
    Tip->SetLightColor(HeroColor());
    Fire(TEXT("glint"), Socket(Id == TEXT("sera") ? HandR : TipR), 0.3f);   // 0.7 covered the whole body
    ++Counts[0];

    if (Id == TEXT("sera"))
    {
        // the throw: release on the clip's frame, the orb lands on the hit time (the kit's release + flight)
        const UHWCharacterKitComponent::FAbilityClock Clock = UHWCharacterKitComponent::AbilityClock(Id, Slot);
        auto T = [&Clock](float F) { return UHWCharacterKitComponent::AbilityTimeOf(F, Clock); };
        const float Now = WorldTime();
        if (Slot == EHWAbilitySlot::Skill1) Launches.Add({ Now + T(0.29f), AimPoint(700.f), 0.28f, 25.f, false });
        else if (Slot == EHWAbilitySlot::Skill3)
        {
            Launches.Add({ Now + T(0.20f), AimPoint(500.f), 0.26f, 120.f, true });
            Launches.Add({ Now + T(0.20f) + 0.2f, AimPoint(500.f) + Hero->GetActorRightVector() * 90.f, 0.26f, 120.f, true });
        }
        else if (Slot == EHWAbilitySlot::Ultimate) Launches.Add({ Now + T(0.22f), AimPoint(600.f), 0.36f, 220.f, true });
        return;
    }
    StartTrails(Slot == EHWAbilitySlot::Ultimate ? 3.f : 2.2f);
}

void UHWHeroFxComponent::HandleHit(const FHWPendingAbilityHit& Hit, AActor* Landed, EHWAbilitySlot Slot)
{
    if (!Hero.IsValid() || Systems.IsEmpty()) return;
    const FVector Me = Hero->GetActorLocation();
    const FVector Feet = Me - FVector(0.f, 0.f, Hero->GetCapsuleComponent()->GetScaledCapsuleHalfHeight());
    const bool bBig = Hit.Tier == EHWAttackTier::Smash || Slot == EHWAbilitySlot::Ultimate;
    if (Landed)
    {
        // on the target's near side, at the blade's height
        const FVector T = Landed->GetActorLocation();
        FVector Dir = (Me - T).GetSafeNormal2D();
        float Radius = 40.f;
        if (const ACharacter* C = Cast<ACharacter>(Landed)) Radius = C->GetCapsuleComponent()->GetScaledCapsuleRadius();
        FVector At = T + Dir * Radius * 0.8f;
        At.Z = Id == TEXT("sera") ? T.Z : FMath::Clamp(Socket(TipR).Z, Feet.Z + 40.f, Feet.Z + 220.f);
        Fire(TEXT("impact"), At, bBig ? 1.8f : 1.1f);
        if (bBig || Hit.Tier == EHWAttackTier::Finisher) Fire(TEXT("xslash"), At, bBig ? 1.3f : 0.8f, Dir.Rotation());
        Flash(At, bBig ? 16000.f : 7000.f, bBig ? 0.3f : 0.16f, bBig ? 600.f : 360.f);
        ++Counts[2];
    }
    if (Hit.bAoe && Id != TEXT("sera"))
    {
        // a spin rings the floor around the hero whether it caught anything or not
        Fire(TEXT("ring"), Feet + FVector(0, 0, 4.f), bBig ? 0.9f : 0.6f);
        if (bBig) Fire(TEXT("burst"), Feet + Hero->GetActorForwardVector() * 120.f, 1.2f);
        Flash(Feet + FVector(0, 0, 60.f), 7000.f, 0.25f, 480.f);
        ++Counts[3];
    }
    else if (bBig && Id != TEXT("sera") && Hit.bLast)
    {
        Fire(TEXT("burst"), Feet + Hero->GetActorForwardVector() * 140.f, 1.2f);
        Fire(TEXT("dust"), Feet + Hero->GetActorForwardVector() * 140.f, 0.5f);
    }
    if (Hit.bLast) EndTrails(0.18f);
}

void UHWHeroFxComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    if (!Hero.IsValid() || Systems.IsEmpty()) return;
    const float Now = WorldTime();

    // the tell's glint: up in 0.05 s, gone by 0.3 s
    TipAge += DeltaTime;
    const float TipK = TipAge < 0.05f ? TipAge / 0.05f : FMath::Max(0.f, 1.f - (TipAge - 0.05f) / 0.25f);
    Tip->SetIntensity(TipK * 8000.f);

    for (int32 I = Fades.Num() - 1; I >= 0; --I)
    {
        FLightFade& F = Fades[I];
        F.Age += DeltaTime;
        const float K = FMath::Clamp(1.f - F.Age / F.Seconds, 0.f, 1.f);
        Lights[F.Index]->SetIntensity(F.Peak * K * K);
        if (K <= 0.f) Fades.RemoveAt(I);
    }

    if (TrailEndAt >= 0.f && Now >= TrailEndAt)
    {
        for (UParticleSystemComponent* T : Trails) if (T) { T->EndTrails(); T->bAutoDestroy = true; T->Deactivate(); }
        Trails.Reset();
        TrailEndAt = -1.f;
    }

    for (int32 I = Launches.Num() - 1; I >= 0; --I)
    {
        if (Now < Launches[I].At) continue;
        const FLaunch L = Launches[I];
        Launches.RemoveAt(I);
        Launch(L.To, L.Flight, L.Arc, L.bAoe);
    }
    for (int32 I = Orbs.Num() - 1; I >= 0; --I)
    {
        FOrb& O = Orbs[I];
        O.Age += DeltaTime;
        const float A = FMath::Clamp(O.Age / O.Flight, 0.f, 1.f);
        const FVector P = FMath::Lerp(O.From, O.To, A) + FVector(0, 0, O.Arc * 4.f * A * (1.f - A));
        if (O.Mesh) O.Mesh->SetWorldLocation(P);
        if (O.Light) O.Light->SetWorldLocation(P);
        if (A >= 1.f)
        {
            // the vial breaks: a burst where it lands (a pool on the floor for the AoE ones)
            Fire(TEXT("burst"), O.To, O.bAoe ? 1.3f : 0.8f);
            if (O.bAoe) Fire(TEXT("dust"), O.To - FVector(0, 0, 6.f), 0.45f);
            Flash(O.To + FVector(0, 0, 40.f), O.bAoe ? 12000.f : 7000.f, 0.35f, O.bAoe ? 600.f : 380.f);
            if (O.Mesh) { OrbParts.Remove(O.Mesh); O.Mesh->DestroyComponent(); }
            if (O.Light) { OrbParts.Remove(O.Light); O.Light->DestroyComponent(); }
            Orbs.RemoveAt(I);
        }
    }

    if (BuffLeft > 0.f)
    {
        BuffLeft -= DeltaTime;
        // breathes while it lasts, fades in the last 0.4 s
        const float Fade = FMath::Clamp(BuffLeft / 0.4f, 0.f, 1.f);
        const float Breath = 0.75f + 0.25f * FMath::Sin((BuffTotal - BuffLeft) * 9.f);
        Skin->SetScalarParameterValue(TEXT("Glow"), 0.2f * Fade * Breath);   // 2.2 painted the body solid white
        if (BuffLeft <= 0.f) Hero->GetMesh()->SetOverlayMaterial(nullptr);
    }
}

FString UHWHeroFxComponent::Describe() const
{
    FString L;
    for (const UPointLightComponent* P : Lights) L += FString::Printf(TEXT("%s%.0f"), L.IsEmpty() ? TEXT("") : TEXT("/"), P ? P->Intensity : -1.f);
    return FString::Printf(TEXT("hero=%s tell=%d trail=%d hit=%d ring=%d orb=%d live_trails=%d orbs=%d buff=%.2f tip=%.0f lights=%s fades=%d"),
        *Id.ToString(), Counts[0], Counts[1], Counts[2], Counts[3], Counts[4], Trails.Num(), Orbs.Num(), BuffLeft,
        Tip ? Tip->Intensity : 0.f, *L, Fades.Num());
}
