#include "Character/HWHeroMetaHumanComponent.h"

#include "Animation/HWRetargetAnimInstance.h"
#include "Components/SkeletalMeshComponent.h"
#include "Dom/JsonObject.h"
#include "Engine/SkeletalMesh.h"
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
    PrimaryComponentTick.bCanEverTick = false;
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

    FString BlueprintPath, OutfitPath, GroomPath, GroomMatPath, RetargeterPath;
    E->TryGetStringField(TEXT("blueprint"), BlueprintPath);
    E->TryGetStringField(TEXT("outfit"), OutfitPath);
    E->TryGetStringField(TEXT("groom"), GroomPath);
    E->TryGetStringField(TEXT("groom_material"), GroomMatPath);
    E->TryGetStringField(TEXT("retargeter"), RetargeterPath);
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
    if (UGroomAsset* Groom = GroomPath.IsEmpty() ? nullptr : LoadObject<UGroomAsset>(nullptr, *GroomPath))
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

    Worn = MH;
    WornId = CharacterId;
    UE_LOG(LogTemp, Display, TEXT("[HWMetaHuman] %s wears %s"), *CharacterId.ToString(), *MH->GetName());
    return true;
}

void UHWHeroMetaHumanComponent::TakeOff()
{
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
