#include "HHCharacterSelectStand.h"
#include "HHCharacterPresentationInterface.h"

#include "Animation/AnimSequenceBase.h"
#include "Animation/SkeletalMeshActor.h"
#include "Components/SceneComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/World.h"

AHHCharacterSelectStand::AHHCharacterSelectStand()
{
    PrimaryActorTick.bCanEverTick = true;

    Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    SetRootComponent(Root);

    VisualAnchor = CreateDefaultSubobject<USceneComponent>(TEXT("VisualAnchor"));
    VisualAnchor->SetupAttachment(Root);
}

void AHHCharacterSelectStand::BeginPlay()
{
    Super::BeginPlay();

    BaseAnchorLocation = VisualAnchor->GetRelativeLocation();
    BaseAnchorRotation = VisualAnchor->GetRelativeRotation();

    RefreshVisual();
    SetSelectionVisible(false);
}

void AHHCharacterSelectStand::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (!bSelectionVisible)
    {
        return;
    }

    ApplyFallbackMotion(DeltaSeconds);
}

void AHHCharacterSelectStand::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (SpawnedVisual)
    {
        SpawnedVisual->Destroy();
        SpawnedVisual = nullptr;
    }

    Super::EndPlay(EndPlayReason);
}

int32 AHHCharacterSelectStand::CharacterIndex(FName CharacterId) const
{
    const FString Id = CharacterId.ToString().ToLower();

    if (Id == TEXT("ain")) return 0;
    if (Id == TEXT("kain")) return 1;
    if (Id == TEXT("ryu")) return 2;
    if (Id == TEXT("sera")) return 3;

    return 0;
}

FName AHHCharacterSelectStand::CharacterAt(int32 Index) const
{
    static const FName Ids[] = {
        TEXT("ain"),
        TEXT("kain"),
        TEXT("ryu"),
        TEXT("sera")
    };

    const int32 Safe = (Index % 4 + 4) % 4;
    return Ids[Safe];
}

TSoftClassPtr<AActor> AHHCharacterSelectStand::GetVisualClass(FName CharacterId) const
{
    switch (CharacterIndex(CharacterId))
    {
        case 0: return AinVisualClass;
        case 1: return KainVisualClass;
        case 2: return RyuVisualClass;
        case 3: return SeraVisualClass;
        default: return AinVisualClass;
    }
}

const FHHSelectionBody& AHHCharacterSelectStand::GetBody(FName CharacterId) const
{
    switch (CharacterIndex(CharacterId))
    {
        case 1: return KainBody;
        case 2: return RyuBody;
        case 3: return SeraBody;
        default: return AinBody;
    }
}

bool AHHCharacterSelectStand::PlayBodyClip(EHHSelectionPresentationState ForState)
{
    ASkeletalMeshActor* Body = Cast<ASkeletalMeshActor>(SpawnedVisual);
    if (!Body || !Body->GetSkeletalMeshComponent()) return false;
    const FHHSelectionBody& B = GetBody(SelectedCharacterId);
    const TSoftObjectPtr<UAnimSequenceBase>& Soft = ForState == EHHSelectionPresentationState::Intro ? B.Intro
        : ForState == EHHSelectionPresentationState::Confirm ? B.Confirm : B.Idle;
    const float Rate = ForState == EHHSelectionPresentationState::Intro ? B.IntroRate
        : ForState == EHHSelectionPresentationState::Confirm ? B.ConfirmRate : B.IdleRate;
    UAnimSequenceBase* Clip = Soft.LoadSynchronous();
    if (!Clip) return false;
    USkeletalMeshComponent* Mesh = Body->GetSkeletalMeshComponent();
    Mesh->PlayAnimation(Clip, ForState == EHHSelectionPresentationState::Idle);
    Mesh->SetPlayRate(FMath::Max(0.05f, Rate));
    BodyBeatLength = Clip->GetPlayLength() / FMath::Max(0.05f, Rate);
    return true;
}

AHHCharacterSelectStand::FHHMotionProfile AHHCharacterSelectStand::GetMotionProfile(FName CharacterId) const
{
    FHHMotionProfile P;

    switch (CharacterIndex(CharacterId))
    {
        // Ain: controlled, precise, scythe-oriented.
        case 0:
            P.IntroYaw = 12.f;
            P.IntroBack = 20.f;
            P.IdleYawAmplitude = 0.45f;
            P.IdleZAmplitude = 0.55f;
            P.IdleFrequency = 0.42f;
            P.ConfirmForward = 14.f;
            P.ConfirmYaw = 1.8f;
            break;

        // Kain: heavy and grounded.
        case 1:
            P.IntroYaw = 7.f;
            P.IntroBack = 12.f;
            P.IdleYawAmplitude = 0.20f;
            P.IdleZAmplitude = 0.22f;
            P.IdleFrequency = 0.28f;
            P.ConfirmForward = 8.f;
            P.ConfirmYaw = 0.8f;
            break;

        // Ryu: quickest visual response.
        case 2:
            P.IntroYaw = 16.f;
            P.IntroBack = 25.f;
            P.IdleYawAmplitude = 0.70f;
            P.IdleZAmplitude = 0.65f;
            P.IdleFrequency = 0.60f;
            P.ConfirmForward = 18.f;
            P.ConfirmYaw = 2.4f;
            break;

        // Sera: stable, restrained and precise.
        case 3:
            P.IntroYaw = 9.f;
            P.IntroBack = 15.f;
            P.IdleYawAmplitude = 0.28f;
            P.IdleZAmplitude = 0.35f;
            P.IdleFrequency = 0.36f;
            P.ConfirmForward = 10.f;
            P.ConfirmYaw = 1.1f;
            break;
    }

    return P;
}

void AHHCharacterSelectStand::SetSelectedCharacter(FName CharacterId)
{
    const FName Normalized = CharacterAt(CharacterIndex(CharacterId));

    if (SelectedCharacterId == Normalized && SpawnedVisual)
    {
        if (bSelectionVisible)
        {
            PlayIntroPresentation();
        }
        return;
    }

    SelectedCharacterId = Normalized;
    RefreshVisual();

    if (bSelectionVisible)
    {
        PlayIntroPresentation();
    }
}

void AHHCharacterSelectStand::SetSelectionVisible(bool bVisible)
{
    bSelectionVisible = bVisible;

    if (SpawnedVisual)
    {
        SpawnedVisual->SetActorHiddenInGame(!bVisible);
    }

    if (bVisible)
    {
        PlayIntroPresentation();
    }
    else
    {
        PresentationState = EHHSelectionPresentationState::Hidden;
        PresentationTime = 0.f;
        VisualAnchor->SetRelativeLocation(BaseAnchorLocation);
        VisualAnchor->SetRelativeRotation(BaseAnchorRotation);
    }
}

void AHHCharacterSelectStand::NextCharacter()
{
    SetSelectedCharacter(CharacterAt(CharacterIndex(SelectedCharacterId) + 1));
}

void AHHCharacterSelectStand::PreviousCharacter()
{
    SetSelectedCharacter(CharacterAt(CharacterIndex(SelectedCharacterId) - 1));
}

void AHHCharacterSelectStand::PlayIntroPresentation()
{
    if (!bSelectionVisible)
    {
        return;
    }

    SetPresentationState(EHHSelectionPresentationState::Intro);
}

void AHHCharacterSelectStand::PlayConfirmPresentation()
{
    if (!bSelectionVisible)
    {
        return;
    }

    SetPresentationState(EHHSelectionPresentationState::Confirm);
}

void AHHCharacterSelectStand::SetPresentationState(EHHSelectionPresentationState NewState)
{
    PresentationState = NewState;
    PresentationTime = 0.f;
    BodyBeatLength = 0.f;
    if (NewState != EHHSelectionPresentationState::Hidden)
    {
        PlayBodyClip(NewState);
    }

    switch (NewState)
    {
        case EHHSelectionPresentationState::Intro:
            DispatchIntroHook();
            break;

        case EHHSelectionPresentationState::Idle:
            DispatchIdleHook();
            break;

        case EHHSelectionPresentationState::Confirm:
            DispatchConfirmHook();
            break;

        default:
            break;
    }
}

void AHHCharacterSelectStand::ApplyFallbackMotion(float DeltaSeconds)
{
    PresentationTime += DeltaSeconds;

    if (!bUseFallbackAnchorMotion)
    {
        if (PresentationState == EHHSelectionPresentationState::Intro
            && PresentationTime >= (BodyBeatLength > 0.f ? BodyBeatLength : IntroDuration))
        {
            SetPresentationState(EHHSelectionPresentationState::Idle);
        }
        return;
    }

    const FHHMotionProfile P = GetMotionProfile(SelectedCharacterId);

    if (PresentationState == EHHSelectionPresentationState::Intro)
    {
        const float T = FMath::Clamp(PresentationTime / FMath::Max(0.05f, IntroDuration), 0.f, 1.f);
        if (BodyBeatLength > 0.f && PresentationTime < BodyBeatLength)
        {
            // the body's own entrance clip is still playing: the anchor eases in over IntroDuration, the beat ends with the clip
            const float E0 = 1.f - FMath::Pow(1.f - T, 3.f);
            VisualAnchor->SetRelativeLocation(FMath::Lerp(BaseAnchorLocation + FVector(-P.IntroBack, 0.f, 0.f), BaseAnchorLocation, E0));
            VisualAnchor->SetRelativeRotation(FMath::Lerp(BaseAnchorRotation + FRotator(0.f, -P.IntroYaw, 0.f), BaseAnchorRotation, E0));
            return;
        }
        const float E = 1.f - FMath::Pow(1.f - T, 3.f);

        const FVector StartLocation = BaseAnchorLocation + FVector(-P.IntroBack, 0.f, 0.f);
        const FRotator StartRotation = BaseAnchorRotation + FRotator(0.f, -P.IntroYaw, 0.f);

        VisualAnchor->SetRelativeLocation(FMath::Lerp(StartLocation, BaseAnchorLocation, E));
        VisualAnchor->SetRelativeRotation(FMath::Lerp(StartRotation, BaseAnchorRotation, E));

        if (T >= 1.f)
        {
            SetPresentationState(EHHSelectionPresentationState::Idle);
        }
        return;
    }

    if (PresentationState == EHHSelectionPresentationState::Idle)
    {
        const float Phase = PresentationTime * PI * 2.f * P.IdleFrequency;
        const float Z = FMath::Sin(Phase) * P.IdleZAmplitude;
        const float Yaw = FMath::Sin(Phase * 0.72f) * P.IdleYawAmplitude;

        VisualAnchor->SetRelativeLocation(BaseAnchorLocation + FVector(0.f,0.f,Z));
        VisualAnchor->SetRelativeRotation(BaseAnchorRotation + FRotator(0.f,Yaw,0.f));
        return;
    }

    if (PresentationState == EHHSelectionPresentationState::Confirm)
    {
        const float Len = BodyBeatLength > 0.f ? BodyBeatLength : ConfirmDuration;
        const float T = FMath::Clamp(PresentationTime / FMath::Max(0.05f, Len), 0.f, 1.f);
        const float E = T * T * (3.f - 2.f * T);

        VisualAnchor->SetRelativeLocation(
            BaseAnchorLocation + FVector(P.ConfirmForward * E, 0.f, 0.f));

        VisualAnchor->SetRelativeRotation(
            BaseAnchorRotation + FRotator(0.f, P.ConfirmYaw * E, 0.f));

        if (T >= 1.f)
        {
            SetPresentationState(EHHSelectionPresentationState::Idle);
        }
        return;
    }
}

void AHHCharacterSelectStand::DispatchIntroHook()
{
    if (SpawnedVisual
        && SpawnedVisual->GetClass()->ImplementsInterface(UHHCharacterPresentationInterface::StaticClass()))
    {
        IHHCharacterPresentationInterface::Execute_HH_PlaySelectionIntro(
            SpawnedVisual,
            SelectedCharacterId);
    }
}

void AHHCharacterSelectStand::DispatchIdleHook()
{
    if (SpawnedVisual
        && SpawnedVisual->GetClass()->ImplementsInterface(UHHCharacterPresentationInterface::StaticClass()))
    {
        IHHCharacterPresentationInterface::Execute_HH_PlaySelectionIdle(
            SpawnedVisual,
            SelectedCharacterId);
    }
}

void AHHCharacterSelectStand::DispatchConfirmHook()
{
    if (SpawnedVisual
        && SpawnedVisual->GetClass()->ImplementsInterface(UHHCharacterPresentationInterface::StaticClass()))
    {
        IHHCharacterPresentationInterface::Execute_HH_PlaySelectionConfirm(
            SpawnedVisual,
            SelectedCharacterId);
    }
}

FText AHHCharacterSelectStand::GetSelectedDisplayName() const
{
    switch (CharacterIndex(SelectedCharacterId))
    {
        case 0: return FText::FromString(TEXT("아인"));
        case 1: return FText::FromString(TEXT("카인"));
        case 2: return FText::FromString(TEXT("류"));
        case 3: return FText::FromString(TEXT("세라"));
        default: return FText::FromString(TEXT("아인"));
    }
}

FText AHHCharacterSelectStand::GetSelectedRoleText() const
{
    switch (CharacterIndex(SelectedCharacterId))
    {
        case 0: return FText::FromString(TEXT("파괴 · 카운터"));
        case 1: return FText::FromString(TEXT("고정 · 방어"));
        case 2: return FText::FromString(TEXT("동시 · 속공"));
        case 3: return FText::FromString(TEXT("봉쇄 · 지원"));
        default: return FText::FromString(TEXT("파괴 · 카운터"));
    }
}

FText AHHCharacterSelectStand::GetSelectedDescriptionText() const
{
    switch (CharacterIndex(SelectedCharacterId))
    {
        case 0:
            return FText::FromString(TEXT("거리를 재고, 들어오는 한 번을 끊는다."));
        case 1:
            return FText::FromString(TEXT("피하지 않고 받아, 적의 움직임을 고정한다."));
        case 2:
            return FText::FromString(TEXT("두 지점을 한 박자에 열어 전투의 틈을 만든다."));
        case 3:
            return FText::FromString(TEXT("막고 봉쇄해, 위험한 구간을 통제한다."));
        default:
            return FText::GetEmpty();
    }
}

void AHHCharacterSelectStand::RefreshVisual()
{
    if (SpawnedVisual)
    {
        SpawnedVisual->Destroy();
        SpawnedVisual = nullptr;
    }

    VisualAnchor->SetRelativeLocation(BaseAnchorLocation);
    VisualAnchor->SetRelativeRotation(BaseAnchorRotation);

    if (!GetWorld())
    {
        return;
    }

    const TSoftClassPtr<AActor> Soft = GetVisualClass(SelectedCharacterId);
    UClass* VisualClass = Soft.IsNull() ? nullptr : Soft.LoadSynchronous();
    USkeletalMesh* BodyMesh = nullptr;
    if (!VisualClass)
    {
        BodyMesh = GetBody(SelectedCharacterId).Mesh.LoadSynchronous();
        if (!BodyMesh) return;
        VisualClass = ASkeletalMeshActor::StaticClass();
    }

    FActorSpawnParameters Params;
    Params.Owner = this;
    Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

    const FTransform AnchorTransform = VisualAnchor->GetComponentTransform();

    SpawnedVisual = GetWorld()->SpawnActor<AActor>(
        VisualClass,
        AnchorTransform,
        Params);

    if (!SpawnedVisual)
    {
        return;
    }

    SpawnedVisual->SetActorEnableCollision(false);
    if (BodyMesh)
    {
        if (USkeletalMeshComponent* Mesh = Cast<ASkeletalMeshActor>(SpawnedVisual)->GetSkeletalMeshComponent())
        {
            Mesh->SetMobility(EComponentMobility::Movable);
            Mesh->SetSkeletalMeshAsset(BodyMesh);
            Mesh->SetAnimationMode(EAnimationMode::AnimationSingleNode);
            Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        }
    }

    SpawnedVisual->AttachToComponent(
        VisualAnchor,
        FAttachmentTransformRules::KeepRelativeTransform);

    if (USceneComponent* SpawnedRoot = SpawnedVisual->GetRootComponent())
    {
        SpawnedRoot->SetRelativeLocation(VisualOffset);
        SpawnedRoot->SetRelativeRotation(VisualRotation);
        SpawnedRoot->SetRelativeScale3D(VisualScale);
    }

    SpawnedVisual->SetActorHiddenInGame(!bSelectionVisible);
}
