#include "Character/HWHeroMetaHumanComponent.h"

#include "Animation/HWRetargetAnimInstance.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/LODSyncComponent.h"
#include "Engine/StaticMesh.h"
#include "Components/StaticMeshComponent.h"
#include "Dom/JsonObject.h"
#include "Engine/SkeletalMesh.h"
#include "StaticMeshResources.h"
#include "Rendering/SkeletalMeshRenderData.h"
#include "Engine/World.h"
#include "GameFramework/Character.h"
#include "GroomAsset.h"
#include "GroomComponent.h"
#include "Materials/MaterialInterface.h"
#include "Misc/CommandLine.h"
#include "Misc/FileHelper.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "Retargeter/IKRetargeter.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

namespace
{
    TSharedPtr<FJsonObject> HeroEntry(FName CharacterId)
    {
        FString Text;
        TSharedPtr<FJsonObject> Root;
        if (!FFileHelper::LoadFileToString(Text, *FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Data/hero_metahumans.json")))
            || !FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), Root) || !Root)
        {
            return nullptr;
        }
        const TSharedPtr<FJsonObject>* Entry = nullptr;
        return Root->TryGetObjectField(CharacterId.ToString(), Entry) ? *Entry : nullptr;
    }

    USkeletalMeshComponent* NamedMesh(AActor* Actor, const TCHAR* Name)
    {
        TArray<USkeletalMeshComponent*> All;
        Actor->GetComponents(All);
        for (USkeletalMeshComponent* C : All)
        {
            if (C && C->GetName() == Name) return C;
        }
        return nullptr;
    }
}

UHWHeroMetaHumanComponent::UHWHeroMetaHumanComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.bStartWithTickEnabled = false;
    PrimaryComponentTick.TickGroup = TG_PostUpdateWork;
}

bool UHWHeroMetaHumanComponent::Wear(FName CharacterId)
{
    if (FParse::Param(FCommandLine::Get(), TEXT("HWNoMetaHuman"))) return false;
    if (Worn.IsValid() && WornId == CharacterId) return true;
    TakeOff();

    ACharacter* Hero = Cast<ACharacter>(GetOwner());
    USkeletalMeshComponent* CombatBody = Hero ? Hero->GetMesh() : nullptr;
    const TSharedPtr<FJsonObject> E = HeroEntry(CharacterId);
    if (!CombatBody || !E) return false;

    FString BlueprintPath, OutfitPath, GroomPath, GroomMatPath, RetargeterPath, HairMobilePath;
    E->TryGetStringField(TEXT("blueprint"), BlueprintPath);
    E->TryGetStringField(TEXT("outfit"), OutfitPath);
    E->TryGetStringField(TEXT("groom"), GroomPath);
    E->TryGetStringField(TEXT("groom_material"), GroomMatPath);
    E->TryGetStringField(TEXT("retargeter"), RetargeterPath);
    E->TryGetStringField(TEXT("hair_mobile"), HairMobilePath);
    // phones draw no hair strands (r.HairStrands.Strands 0): the same curves as ribbons (tools/metahuman/groom_to_mesh.py)
    // the phone look (ribbon hair, outfit/body/face from LOD1): phones always; -HWMobileHair previews it on PC
#if PLATFORM_ANDROID || PLATFORM_IOS
    const bool bPhoneLook = true;
    const bool bStrands = FParse::Param(FCommandLine::Get(), TEXT("HWStrandHair"));
#else
    const bool bPhoneLook = FParse::Param(FCommandLine::Get(), TEXT("HWMobileHair"));
    const bool bStrands = !bPhoneLook;
#endif
    UClass* BP = LoadClass<AActor>(nullptr, *BlueprintPath);
    UIKRetargeter* Retargeter = LoadObject<UIKRetargeter>(nullptr, *RetargeterPath);
    if (!BP || !Retargeter)
    {
        UE_LOG(LogTemp, Warning, TEXT("[HWMetaHuman] %s: blueprint %s / retargeter %s missing"), *CharacterId.ToString(), *BlueprintPath, *RetargeterPath);
        return false;
    }

    FActorSpawnParameters P;
    P.Owner = Hero;
    P.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    AActor* MH = GetWorld()->SpawnActor<AActor>(BP, CombatBody->GetComponentTransform(), P);
    if (!MH) return false;
    MH->AttachToComponent(CombatBody, FAttachmentTransformRules::SnapToTargetNotIncludingScale);
    MH->SetActorEnableCollision(false);

    USkeletalMeshComponent* Body = NamedMesh(MH, TEXT("Body"));
    USkeletalMeshComponent* Face = NamedMesh(MH, TEXT("Face"));
    if (!Body)
    {
        MH->Destroy();
        return false;
    }

    // the strand hair first, while the face is still in its reference pose: authored in the character's space, it is
    // carried by the head bone from where it sits now (lab_build.py does the same in the editor)
    UStaticMesh* HairMesh = (!bStrands && !HairMobilePath.IsEmpty()) ? LoadObject<UStaticMesh>(nullptr, *HairMobilePath) : nullptr;
    if (HairMesh)
    {
        UStaticMeshComponent* Hair = NewObject<UStaticMeshComponent>(MH, TEXT("DesignHairMesh"));
        Hair->SetupAttachment(MH->GetRootComponent());
        Hair->SetStaticMesh(HairMesh);
        Hair->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        Hair->RegisterComponent();
        if (Face)
        {
            Face->RefreshBoneTransforms();
            Hair->AttachToComponent(Face, FAttachmentTransformRules::KeepWorldTransform, TEXT("head"));
        }
    }
    else if (UGroomAsset* Groom = GroomPath.IsEmpty() ? nullptr : LoadObject<UGroomAsset>(nullptr, *GroomPath))
    {
        UGroomComponent* Hair = NewObject<UGroomComponent>(MH, TEXT("DesignHair"));
        Hair->SetupAttachment(MH->GetRootComponent());
        Hair->SetGroomAsset(Groom);
        if (UMaterialInterface* M = GroomMatPath.IsEmpty() ? nullptr : LoadObject<UMaterialInterface>(nullptr, *GroomMatPath))
        {
            Hair->SetMaterial(0, M);
        }
        Hair->RegisterComponent();
        if (Face)
        {
            Face->RefreshBoneTransforms();
            Hair->AttachToComponent(Face, FAttachmentTransformRules::KeepWorldTransform, TEXT("head"));
        }
    }
    const TArray<TSharedPtr<FJsonValue>>* Hide = nullptr;
    if (E->TryGetArrayField(TEXT("hide_grooms"), Hide))
    {
        TArray<UGroomComponent*> Grooms;
        MH->GetComponents(Grooms);
        for (UGroomComponent* G : Grooms)
        {
            for (const TSharedPtr<FJsonValue>& V : *Hide)
            {
                if (G && G->GetName() == V->AsString()) G->SetVisibility(false);
            }
        }
    }

    if (USkeletalMesh* Outfit = OutfitPath.IsEmpty() ? nullptr : LoadObject<USkeletalMesh>(nullptr, *OutfitPath))
    {
        USkeletalMeshComponent* O = NewObject<USkeletalMeshComponent>(MH, TEXT("Outfit"));
        O->SetupAttachment(Body);
        O->SetSkeletalMeshAsset(Outfit);
        O->RegisterComponent();
        O->SetLeaderPoseComponent(Body);
    }

    // the MetaHuman body copies the combat body's pose; the combat body keeps animating, unseen
    Body->SetAnimInstanceClass(UHWRetargetAnimInstance::StaticClass());
    if (UHWRetargetAnimInstance* R = Cast<UHWRetargetAnimInstance>(Body->GetAnimInstance()))
    {
        R->SetSource(CombatBody, Retargeter);
    }
    Body->VisibilityBasedAnimTickOption = EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;
    CombatBody->VisibilityBasedAnimTickOption = EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;
    CombatBody->SetVisibility(false, false);   // its children (the weapon) stay
    Body->AddTickPrerequisiteComponent(CombatBody);

    // phones: never the densest LOD (face 19k verts at LOD0, doc 177 §4; outfit 506k triangles at LOD0, doc 184 §7)
    ULODSyncComponent* Sync = bPhoneLook ? MH->FindComponentByClass<ULODSyncComponent>() : nullptr;
    if (Sync)
    {
        double MinLod = 1.0;
        E->TryGetNumberField(TEXT("mobile_min_lod"), MinLod);
        Sync->MinLOD = static_cast<int32>(MinLod);
    }
    Worn = MH;
    WornId = CharacterId;
    RegripIn = 3;
    DiagIn = 120;
    SetComponentTickEnabled(true);
    UE_LOG(LogTemp, Display, TEXT("[HWMetaHuman] %s wears %s"), *CharacterId.ToString(), *MH->GetName());
    return true;
}

void UHWHeroMetaHumanComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    // what the MetaHuman costs, once, two seconds in (LODs settled): per mesh the drawn LOD, its triangles, sections
    if (DiagIn > 0 && --DiagIn == 0) LogRenderCost();
    if (RegripIn < 0 || --RegripIn > 0)
    {
        if (DiagIn <= 0 && RegripIn < 0) SetComponentTickEnabled(false);
        return;
    }
    RegripIn = -1;
    if (DiagIn <= 0) SetComponentTickEnabled(false);
    // The weapons hang on the hidden combat body's hands (HWCharacterVisualSettings::ApplyWeapons). Move each onto the
    // MetaHuman's hand of the same side: same orientation, same offset from the hand, now that both bodies hold the
    // same retargeted pose - otherwise the grip sits where the (bigger) combat body's hand is.
    ACharacter* Hero = Cast<ACharacter>(GetOwner());
    USkeletalMeshComponent* CombatBody = Hero ? Hero->GetMesh() : nullptr;
    USkeletalMeshComponent* Body = Worn.IsValid() ? NamedMesh(Worn.Get(), TEXT("Body")) : nullptr;
    if (!CombatBody || !Body) return;
    TArray<USceneComponent*> Children = CombatBody->GetAttachChildren();
    for (USceneComponent* C : Children)
    {
        if (!C) continue;
        const FName N = C->GetFName();
        const bool bRight = N == TEXT("HWWeaponR"), bLeft = N == TEXT("HWWeaponL");
        if (!bRight && !bLeft) continue;
        const FName Hand = bRight ? TEXT("hand_r") : TEXT("hand_l");
        if (Body->GetBoneIndex(Hand) == INDEX_NONE || CombatBody->GetBoneIndex(Hand) == INDEX_NONE) continue;
        FTransform W = C->GetComponentTransform();
        W.AddToTranslation(Body->GetBoneLocation(Hand) - CombatBody->GetBoneLocation(Hand));
        C->AttachToComponent(Body, FAttachmentTransformRules::KeepWorldTransform, Hand);
        C->SetWorldTransform(W);
    }
}

void UHWHeroMetaHumanComponent::LogRenderCost() const
{
    AActor* MH = Worn.Get();
    if (!MH) return;
    TArray<UMeshComponent*> Meshes;
    MH->GetComponents(Meshes);
    int32 Total = 0;
    for (UMeshComponent* M : Meshes)
    {
        if (!M || !M->IsVisible()) continue;
        int32 Tris = 0, Sections = 0, Lod = -1;
        if (USkinnedMeshComponent* Sk = Cast<USkinnedMeshComponent>(M))
        {
            const FSkeletalMeshRenderData* RD = Sk->GetSkinnedAsset() ? Sk->GetSkinnedAsset()->GetResourceForRendering() : nullptr;
            Lod = Sk->GetPredictedLODLevel();
            if (RD && RD->LODRenderData.IsValidIndex(Lod))
            {
                Tris = RD->LODRenderData[Lod].GetTotalFaces();
                Sections = RD->LODRenderData[Lod].RenderSections.Num();
            }
        }
        else if (UStaticMeshComponent* St = Cast<UStaticMeshComponent>(M))
        {
            if (St->GetStaticMesh() && St->GetStaticMesh()->GetRenderData())
            {
                Lod = 0;
                Tris = St->GetStaticMesh()->GetRenderData()->LODResources[0].GetNumTriangles();
                Sections = St->GetStaticMesh()->GetRenderData()->LODResources[0].Sections.Num();
            }
        }
        else continue;
        Total += Tris;
        UE_LOG(LogTemp, Display, TEXT("[HWMetaHuman] cost %s %s lod %d tris %d sections %d mat %s"), *WornId.ToString(), *M->GetName(),
            Lod, Tris, Sections, M->GetMaterial(0) ? *M->GetMaterial(0)->GetName() : TEXT("-"));
    }
    UE_LOG(LogTemp, Display, TEXT("[HWMetaHuman] cost %s total tris %d"), *WornId.ToString(), Total);
}

void UHWHeroMetaHumanComponent::TakeOff()
{
    // the weapons back onto the combat body's hands before the MetaHuman goes (ApplyWeapons finds them there again)
    if (ACharacter* Owner = Cast<ACharacter>(GetOwner()))
    {
        TArray<UStaticMeshComponent*> Statics;
        Owner->GetComponents(Statics);
        for (UStaticMeshComponent* C : Statics)
        {
            const bool bRight = C && C->GetFName() == TEXT("HWWeaponR");
            if (C && Owner->GetMesh() && (bRight || C->GetFName() == TEXT("HWWeaponL")) && C->GetAttachParent() != Owner->GetMesh())
            {
                C->AttachToComponent(Owner->GetMesh(), FAttachmentTransformRules::KeepWorldTransform, bRight ? TEXT("hand_r") : TEXT("hand_l"));
            }
        }
    }
    if (AActor* MH = Worn.Get())
    {
        MH->Destroy();
    }
    Worn.Reset();
    WornId = NAME_None;
    if (ACharacter* Hero = Cast<ACharacter>(GetOwner()))
    {
        if (Hero->GetMesh()) Hero->GetMesh()->SetVisibility(true, false);
    }
}

void UHWHeroMetaHumanComponent::EndPlay(const EEndPlayReason::Type Reason)
{
    if (AActor* MH = Worn.Get()) MH->Destroy();
    Worn.Reset();
    Super::EndPlay(Reason);
}
