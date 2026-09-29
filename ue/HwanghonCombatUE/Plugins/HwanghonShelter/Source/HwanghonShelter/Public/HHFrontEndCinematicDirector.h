#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HHFrontEndCinematicDirector.generated.h"

class UCameraComponent;
class USceneComponent;
class UMaterialParameterCollection;

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FHHFrontEndRevealFinished);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FHHFrontEndConnectFinished);

UENUM(BlueprintType)
enum class EHHFrontEndCameraStage : uint8
{
    Title,
    Revealing,
    Selection,
    Connecting,
    Hold
};

UCLASS(BlueprintType)
class HWANGHONSHELTER_API AHHFrontEndCinematicDirector : public AActor
{
    GENERATED_BODY()

public:
    AHHFrontEndCinematicDirector();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    UPROPERTY(BlueprintAssignable, Category="Hwanghon|FrontEnd")
    FHHFrontEndRevealFinished OnRevealFinished;

    UPROPERTY(BlueprintAssignable, Category="Hwanghon|FrontEnd")
    FHHFrontEndConnectFinished OnConnectFinished;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<USceneComponent> Root;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<UCameraComponent> Camera;

    // Relative transforms inside the small offline front-end bunker set.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|FrontEnd|Camera")
    FVector TitleLocation = FVector(0.f, 0.f, 155.f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|FrontEnd|Camera")
    FRotator TitleRotation = FRotator(0.f, 0.f, 0.f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|FrontEnd|Camera")
    float TitleFOV = 34.f;

    // "입장" click: dolly backward / zoom out and reveal more of the shelter.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|FrontEnd|Camera")
    FVector SelectionLocation = FVector(-620.f, 0.f, 190.f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|FrontEnd|Camera")
    FRotator SelectionRotation = FRotator(-2.f, 0.f, 0.f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|FrontEnd|Camera")
    float SelectionFOV = 58.f;

    // After character confirm: glide toward the B-1 route / blast door.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|FrontEnd|Camera")
    FVector ConnectLocation = FVector(700.f, 0.f, 165.f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|FrontEnd|Camera")
    FRotator ConnectRotation = FRotator(0.f, 0.f, 0.f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|FrontEnd|Camera")
    float ConnectFOV = 46.f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|FrontEnd|Timing")
    float RevealDuration = 1.55f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|FrontEnd|Timing")
    float ConnectDuration = 1.20f;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|FrontEnd")
    EHHFrontEndCameraStage Stage = EHHFrontEndCameraStage::Title;

    // HwanghonCombatUE (doc 158): the set's own 2D graphics follow the camera - the B-1 plan on the table draws its
    // lines from the core outward and lights the seven facility pins while the camera pulls back (HH_Reveal 0 -> 1),
    // and draws the route 외부 통로 -> 코어 -> 인력사무소 while the connect camera looks down on it (HH_Route 0 -> 1).
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|FrontEnd|Set")
    TSoftObjectPtr<UMaterialParameterCollection> SetParams =
        TSoftObjectPtr<UMaterialParameterCollection>(FSoftObjectPath(TEXT("/Game/Hwanghon/Frontend/MPC_HW_FrontEnd.MPC_HW_FrontEnd")));

    // Part of the reveal / connect over which the plan draws (0..1 of the move)
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|FrontEnd|Set")
    FVector2D RevealDrawWindow = FVector2D(0.10f, 0.85f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|FrontEnd|Set")
    FVector2D RouteDrawWindow = FVector2D(0.25f, 1.0f);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|FrontEnd")
    void ResetToTitle();

    UFUNCTION(BlueprintCallable, Category="Hwanghon|FrontEnd")
    void ResetToSelection();

    UFUNCTION(BlueprintCallable, Category="Hwanghon|FrontEnd")
    void PlayReveal();

    UFUNCTION(BlueprintCallable, Category="Hwanghon|FrontEnd")
    void PlayConnect();

private:
    FVector FromLocation;
    FVector ToLocation;
    FRotator FromRotation;
    FRotator ToRotation;
    float FromFOV = 34.f;
    float ToFOV = 34.f;
    float Elapsed = 0.f;
    float ActiveDuration = 1.f;

    void StartMove(
        EHHFrontEndCameraStage NewStage,
        const FVector& TargetLocation,
        const FRotator& TargetRotation,
        float TargetFOV,
        float Duration);

    void FinishMove();
    void SetSetParam(FName Name, float Value) const;
};
