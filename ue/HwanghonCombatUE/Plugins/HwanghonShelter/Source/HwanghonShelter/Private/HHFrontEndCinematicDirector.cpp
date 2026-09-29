#include "HHFrontEndCinematicDirector.h"

#include "Camera/CameraComponent.h"
#include "Components/SceneComponent.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/KismetMaterialLibrary.h"
#include "Materials/MaterialParameterCollection.h"

void AHHFrontEndCinematicDirector::SetSetParam(FName Name, float Value) const
{
    if (UMaterialParameterCollection* Params = SetParams.LoadSynchronous())
    {
        UKismetMaterialLibrary::SetScalarParameterValue(const_cast<AHHFrontEndCinematicDirector*>(this), Params, Name, Value);
    }
}

AHHFrontEndCinematicDirector::AHHFrontEndCinematicDirector()
{
    PrimaryActorTick.bCanEverTick = true;

    Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    SetRootComponent(Root);

    Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
    Camera->SetupAttachment(Root);
}

void AHHFrontEndCinematicDirector::BeginPlay()
{
    Super::BeginPlay();

    ResetToTitle();

    if (APlayerController* PC = GetWorld() ? GetWorld()->GetFirstPlayerController() : nullptr)
    {
        PC->SetViewTarget(this);
    }
}

void AHHFrontEndCinematicDirector::ResetToTitle()
{
    Stage = EHHFrontEndCameraStage::Title;
    Camera->SetRelativeLocation(TitleLocation);
    Camera->SetRelativeRotation(TitleRotation);
    Camera->SetFieldOfView(TitleFOV);
    Elapsed = 0.f;
    SetSetParam(TEXT("HH_Reveal"), 0.f);
    SetSetParam(TEXT("HH_Route"), 0.f);
}


void AHHFrontEndCinematicDirector::ResetToSelection()
{
    Stage = EHHFrontEndCameraStage::Selection;
    Camera->SetRelativeLocation(SelectionLocation);
    Camera->SetRelativeRotation(SelectionRotation);
    Camera->SetFieldOfView(SelectionFOV);
    Elapsed = 0.f;
    SetSetParam(TEXT("HH_Reveal"), 1.f);
    SetSetParam(TEXT("HH_Route"), 0.f);
}

void AHHFrontEndCinematicDirector::StartMove(
    EHHFrontEndCameraStage NewStage,
    const FVector& TargetLocation,
    const FRotator& TargetRotation,
    float TargetFOV,
    float Duration)
{
    FromLocation = Camera->GetRelativeLocation();
    FromRotation = Camera->GetRelativeRotation();
    FromFOV = Camera->FieldOfView;

    ToLocation = TargetLocation;
    ToRotation = TargetRotation;
    ToFOV = TargetFOV;

    ActiveDuration = FMath::Max(0.05f, Duration);
    Elapsed = 0.f;
    Stage = NewStage;
}

void AHHFrontEndCinematicDirector::PlayReveal()
{
    if (Stage != EHHFrontEndCameraStage::Title) return;

    StartMove(
        EHHFrontEndCameraStage::Revealing,
        SelectionLocation,
        SelectionRotation,
        SelectionFOV,
        RevealDuration
    );
}

void AHHFrontEndCinematicDirector::PlayConnect()
{
    if (Stage != EHHFrontEndCameraStage::Selection) return;

    StartMove(
        EHHFrontEndCameraStage::Connecting,
        ConnectLocation,
        ConnectRotation,
        ConnectFOV,
        ConnectDuration
    );
}

void AHHFrontEndCinematicDirector::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (Stage != EHHFrontEndCameraStage::Revealing
        && Stage != EHHFrontEndCameraStage::Connecting)
    {
        return;
    }

    Elapsed += DeltaSeconds;
    const float T = FMath::Clamp(Elapsed / ActiveDuration, 0.f, 1.f);
    const float Ease = T * T * (3.f - 2.f * T); // smoothstep

    Camera->SetRelativeLocation(FMath::Lerp(FromLocation, ToLocation, Ease));
    Camera->SetRelativeRotation(FMath::Lerp(FromRotation, ToRotation, Ease));
    Camera->SetFieldOfView(FMath::Lerp(FromFOV, ToFOV, Ease));

    const FVector2D& Window = Stage == EHHFrontEndCameraStage::Revealing ? RevealDrawWindow : RouteDrawWindow;
    const float Draw = FMath::Clamp((T - Window.X) / FMath::Max(0.01f, Window.Y - Window.X), 0.f, 1.f);
    SetSetParam(Stage == EHHFrontEndCameraStage::Revealing ? FName(TEXT("HH_Reveal")) : FName(TEXT("HH_Route")), Draw);

    if (T >= 1.f)
    {
        FinishMove();
    }
}

void AHHFrontEndCinematicDirector::FinishMove()
{
    Camera->SetRelativeLocation(ToLocation);
    Camera->SetRelativeRotation(ToRotation);
    Camera->SetFieldOfView(ToFOV);

    if (Stage == EHHFrontEndCameraStage::Revealing)
    {
        Stage = EHHFrontEndCameraStage::Selection;
        OnRevealFinished.Broadcast();
    }
    else if (Stage == EHHFrontEndCameraStage::Connecting)
    {
        Stage = EHHFrontEndCameraStage::Hold;
        OnConnectFinished.Broadcast();
    }
}
