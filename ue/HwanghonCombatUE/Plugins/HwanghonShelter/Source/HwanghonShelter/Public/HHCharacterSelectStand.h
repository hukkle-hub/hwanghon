#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "UObject/SoftObjectPtr.h"
#include "HHCharacterSelectStand.generated.h"

class USceneComponent;
class USkeletalMesh;
class UAnimSequenceBase;

// HwanghonCombatUE (doc 159): the project has no per-hero Blueprints - its bodies are a mesh + animations
// (Config/DefaultGame.ini Characters). A body here spawns a plain SkeletalMeshActor and plays the project's own clips
// for the three presentation beats; a VisualClass, when set, still wins (v9 BP + UHHCharacterPresentationInterface).
USTRUCT(BlueprintType)
struct FHHSelectionBody
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite) TSoftObjectPtr<USkeletalMesh> Mesh;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) TSoftObjectPtr<UAnimSequenceBase> Intro;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) TSoftObjectPtr<UAnimSequenceBase> Idle;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) TSoftObjectPtr<UAnimSequenceBase> Confirm;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float IntroRate = 1.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float IdleRate = 1.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) float ConfirmRate = 1.f;
};

UENUM(BlueprintType)
enum class EHHSelectionPresentationState : uint8
{
    Hidden,
    Intro,
    Idle,
    Confirm
};

UCLASS(BlueprintType)
class HWANGHONSHELTER_API AHHCharacterSelectStand : public AActor
{
    GENERATED_BODY()

public:
    AHHCharacterSelectStand();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<USceneComponent> Root;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<USceneComponent> VisualAnchor;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|CharacterSelect")
    TSoftClassPtr<AActor> AinVisualClass;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|CharacterSelect")
    TSoftClassPtr<AActor> KainVisualClass;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|CharacterSelect")
    TSoftClassPtr<AActor> RyuVisualClass;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|CharacterSelect")
    TSoftClassPtr<AActor> SeraVisualClass;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|CharacterSelect|Body")
    FHHSelectionBody AinBody;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|CharacterSelect|Body")
    FHHSelectionBody KainBody;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|CharacterSelect|Body")
    FHHSelectionBody RyuBody;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|CharacterSelect|Body")
    FHHSelectionBody SeraBody;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|CharacterSelect")
    FVector VisualOffset = FVector::ZeroVector;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|CharacterSelect")
    FRotator VisualRotation = FRotator(0.f, -90.f, 0.f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|CharacterSelect")
    FVector VisualScale = FVector(1.f,1.f,1.f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|CharacterSelect|Motion")
    bool bUseFallbackAnchorMotion = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|CharacterSelect|Motion")
    float IntroDuration = 0.62f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|CharacterSelect|Motion")
    float ConfirmDuration = 0.72f;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|CharacterSelect")
    FName SelectedCharacterId = TEXT("ain");

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|CharacterSelect")
    bool bSelectionVisible = false;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|CharacterSelect")
    EHHSelectionPresentationState PresentationState = EHHSelectionPresentationState::Hidden;

    UFUNCTION(BlueprintCallable, Category="Hwanghon|CharacterSelect")
    void SetSelectedCharacter(FName CharacterId);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|CharacterSelect")
    void SetSelectionVisible(bool bVisible);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|CharacterSelect")
    void NextCharacter();

    UFUNCTION(BlueprintCallable, Category="Hwanghon|CharacterSelect")
    void PreviousCharacter();

    UFUNCTION(BlueprintCallable, Category="Hwanghon|CharacterSelect|Motion")
    void PlayIntroPresentation();

    UFUNCTION(BlueprintCallable, Category="Hwanghon|CharacterSelect|Motion")
    void PlayConfirmPresentation();

    UFUNCTION(BlueprintPure, Category="Hwanghon|CharacterSelect")
    FText GetSelectedDisplayName() const;

    UFUNCTION(BlueprintPure, Category="Hwanghon|CharacterSelect")
    FText GetSelectedRoleText() const;

    UFUNCTION(BlueprintPure, Category="Hwanghon|CharacterSelect")
    FText GetSelectedDescriptionText() const;

private:
    UPROPERTY(Transient)
    TObjectPtr<AActor> SpawnedVisual;

    float PresentationTime = 0.f;
    FVector BaseAnchorLocation = FVector::ZeroVector;
    FRotator BaseAnchorRotation = FRotator::ZeroRotator;

    struct FHHMotionProfile
    {
        float IntroYaw = 10.f;
        float IntroBack = 18.f;
        float IdleYawAmplitude = 0.4f;
        float IdleZAmplitude = 0.5f;
        float IdleFrequency = 0.45f;
        float ConfirmForward = 10.f;
        float ConfirmYaw = 1.5f;
    };

    int32 CharacterIndex(FName CharacterId) const;
    FName CharacterAt(int32 Index) const;
    TSoftClassPtr<AActor> GetVisualClass(FName CharacterId) const;
    const FHHSelectionBody& GetBody(FName CharacterId) const;
    bool PlayBodyClip(EHHSelectionPresentationState ForState);   // true when a body clip now plays that beat
    float BodyBeatLength = 0.f;                                   // the clip's length / rate for Intro and Confirm
    FHHMotionProfile GetMotionProfile(FName CharacterId) const;

    void RefreshVisual();
    void SetPresentationState(EHHSelectionPresentationState NewState);
    void ApplyFallbackMotion(float DeltaSeconds);
    void DispatchIntroHook();
    void DispatchIdleHook();
    void DispatchConfirmHook();
};
