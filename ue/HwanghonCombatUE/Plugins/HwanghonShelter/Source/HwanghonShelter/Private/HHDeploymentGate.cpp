#include "HHDeploymentGate.h"
#include "HHShelterOnlinePlayerState.h"

#include "Components/BoxComponent.h"
#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "GameFramework/Pawn.h"
#include "Net/UnrealNetwork.h"
#include "UObject/ConstructorHelpers.h"

AHHDeploymentGate::AHHDeploymentGate()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;
    SetReplicateMovement(false);

    Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    SetRootComponent(Root);

    PartyVolume = CreateDefaultSubobject<UBoxComponent>(TEXT("PartyVolume"));
    PartyVolume->SetupAttachment(Root);
    PartyVolume->SetBoxExtent(FVector(310.f, 360.f, 130.f));
    PartyVolume->SetRelativeLocation(FVector(0.f, 440.f, 120.f));
    PartyVolume->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
    PartyVolume->SetCollisionResponseToAllChannels(ECR_Ignore);
    PartyVolume->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);

    Shutter = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Shutter"));
    Shutter->SetupAttachment(Root);
    Shutter->SetRelativeLocation(FVector(0.f, 0.f, 145.f));
    Shutter->SetRelativeScale3D(FVector(6.5f, 0.34f, 2.9f));
    Shutter->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);

    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
    if (Cube.Succeeded()) Shutter->SetStaticMesh(Cube.Object);

    StatusText = CreateDefaultSubobject<UTextRenderComponent>(TEXT("StatusText"));
    StatusText->SetupAttachment(Root);
    StatusText->SetRelativeLocation(FVector(0.f, 290.f, 220.f));
    StatusText->SetHorizontalAlignment(EHTA_Center);
    StatusText->SetWorldSize(28.f);

    PartyVolume->OnComponentBeginOverlap.AddDynamic(this, &AHHDeploymentGate::OnPartyVolumeBegin);
    PartyVolume->OnComponentEndOverlap.AddDynamic(this, &AHHDeploymentGate::OnPartyVolumeEnd);
}

void AHHDeploymentGate::BeginPlay()
{
    Super::BeginPlay();
    ClosedZ = Shutter->GetRelativeLocation().Z;
    RefreshStatusText();
}

void AHHDeploymentGate::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    const bool bShouldOpen = GateState == EHHDeploymentGateState::Opening || GateState == EHHDeploymentGateState::Open;
    const float TargetZ = bShouldOpen ? ClosedZ + OpenHeight : ClosedZ;

    FVector Rel = Shutter->GetRelativeLocation();
    Rel.Z = FMath::FInterpConstantTo(Rel.Z, TargetZ, DeltaSeconds, OpenSpeed);
    Shutter->SetRelativeLocation(Rel);

    if (HasAuthority() && GateState == EHHDeploymentGateState::Opening && FMath::IsNearlyEqual(Rel.Z, TargetZ, 1.f))
    {
        GateState = EHHDeploymentGateState::Open;
        OnRep_GateState();
        ForceNetUpdate();
    }
}

void AHHDeploymentGate::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(AHHDeploymentGate, GateState);
}

void AHHDeploymentGate::OnPartyVolumeBegin(
    UPrimitiveComponent* OverlappedComponent,
    AActor* OtherActor,
    UPrimitiveComponent* OtherComp,
    int32 OtherBodyIndex,
    bool bFromSweep,
    const FHitResult& SweepResult)
{
    if (APawn* Pawn = Cast<APawn>(OtherActor))
    {
        OverlappingPawns.Add(Pawn);
    }
}

void AHHDeploymentGate::OnPartyVolumeEnd(
    UPrimitiveComponent* OverlappedComponent,
    AActor* OtherActor,
    UPrimitiveComponent* OtherComp,
    int32 OtherBodyIndex)
{
    if (APawn* Pawn = Cast<APawn>(OtherActor))
    {
        OverlappingPawns.Remove(Pawn);
    }
}

bool AHHDeploymentGate::CanDeployParty(const TArray<AHHShelterOnlinePlayerState*>& Members) const
{
    if (Members.IsEmpty()) return false;

    for (AHHShelterOnlinePlayerState* PS : Members)
    {
        if (!PS || !PS->GetPawn() || !OverlappingPawns.Contains(PS->GetPawn()))
        {
            return false;
        }
    }
    return true;
}

void AHHDeploymentGate::SetReady()
{
    if (!HasAuthority()) return;
    GateState = EHHDeploymentGateState::Ready;
    OnRep_GateState();
    ForceNetUpdate();
}

void AHHDeploymentGate::SetAllocating()
{
    if (!HasAuthority()) return;
    GateState = EHHDeploymentGateState::Allocating;
    OnRep_GateState();
    ForceNetUpdate();
}

void AHHDeploymentGate::OpenGate()
{
    if (!HasAuthority()) return;
    GateState = EHHDeploymentGateState::Opening;
    OnRep_GateState();
    ForceNetUpdate();
}

void AHHDeploymentGate::CloseGate()
{
    if (!HasAuthority()) return;
    GateState = EHHDeploymentGateState::Closed;
    OnRep_GateState();
    ForceNetUpdate();
}

void AHHDeploymentGate::OnRep_GateState()
{
    RefreshStatusText();
}

void AHHDeploymentGate::RefreshStatusText()
{
    FText Text = FText::FromString(TEXT("출격 대기"));
    switch (GateState)
    {
        case EHHDeploymentGateState::Closed: Text = FText::FromString(TEXT("출격문 · 파티 대기")); break;
        case EHHDeploymentGateState::Ready: Text = FText::FromString(TEXT("파티 확인 · 출정 가능")); break;
        case EHHDeploymentGateState::Allocating: Text = FText::FromString(TEXT("던전 서버 연결 중")); break;
        case EHHDeploymentGateState::Opening: Text = FText::FromString(TEXT("방폭 셔터 개방")); break;
        case EHHDeploymentGateState::Open: Text = FText::FromString(TEXT("출격")); break;
    }
    if (StatusText)   // HwanghonCombatUE: text/light components are not loaded on a dedicated server (null -> crash)
    {
        StatusText->SetText(Text);
    }
}
