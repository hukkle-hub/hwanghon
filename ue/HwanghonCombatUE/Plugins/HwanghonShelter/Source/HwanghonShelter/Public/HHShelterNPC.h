#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "UObject/SoftObjectPtr.h"   // UE 5.8: Engine/SoftObjectPtr.h does not exist (HwanghonCombatUE doc 152)
#include "HHShelterNPC.generated.h"

class USceneComponent;
class USphereComponent;
class UStaticMeshComponent;
class UTextRenderComponent;
class UTexture2D;
class APlayerController;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHHNPCInteracted, FName, NPCId, APlayerController*, PlayerController);

UCLASS(BlueprintType)
class HWANGHONSHELTER_API AHHShelterNPC : public AActor
{
    GENERATED_BODY()

public:
    AHHShelterNPC();

    virtual void OnConstruction(const FTransform& Transform) override;
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|NPC")
    FName NPCId = TEXT("Matteo");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|NPC")
    FName BoundStationId = TEXT("PartyOffice");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|NPC")
    FText DisplayName;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|NPC")
    FText RoleName;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|NPC", meta=(MultiLine="true"))
    FText DesignAssetHint;

    // If a previously built NPC Blueprint exists, assign it here.
    // At runtime it is spawned as a collision-free child visual.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|NPC|Design")
    TSoftClassPtr<AActor> VisualActorClass;

    // Optional imported design-sheet / portrait texture for dialogue UI.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|NPC|Design")
    TSoftObjectPtr<UTexture2D> PortraitTexture;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|NPC|Dialogue", meta=(MultiLine="true"))
    TArray<FText> DialogueLines;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|NPC|Dialogue")
    FText StationUseLabel;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|NPC")
    FLinearColor AccentColor = FLinearColor(0.72f, 0.38f, 0.10f, 1.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|NPC")
    float InteractionRadius = 260.f;

    UPROPERTY(BlueprintAssignable, Category="Hwanghon|NPC")
    FHHNPCInteracted OnInteracted;

    UFUNCTION(BlueprintCallable, Category="Hwanghon|NPC")
    void Interact(APlayerController* PlayerController);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|NPC")
    void StartDialogue();

    // true = another line is available, false = dialogue finished
    UFUNCTION(BlueprintCallable, Category="Hwanghon|NPC")
    bool AdvanceDialogue();

    UFUNCTION(BlueprintPure, Category="Hwanghon|NPC")
    FText GetCurrentDialogueText() const;

    UFUNCTION(BlueprintPure, Category="Hwanghon|NPC")
    FText GetPromptText() const;

    UFUNCTION(BlueprintPure, Category="Hwanghon|NPC")
    int32 GetDialogueIndex() const { return CurrentDialogueIndex; }

    UFUNCTION(BlueprintPure, Category="Hwanghon|NPC")
    int32 GetDialogueCount() const { return DialogueLines.Num(); }

    UFUNCTION(BlueprintCallable, Category="Hwanghon|NPC")
    UTexture2D* LoadPortraitTexture() const;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<USceneComponent> Root;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<USphereComponent> InteractionVolume;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<UStaticMeshComponent> ProxyMesh;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<UTextRenderComponent> NamePlate;

private:
    UPROPERTY(Transient)
    TObjectPtr<AActor> SpawnedVisualActor;

    int32 CurrentDialogueIndex = 0;

    void ApplyProfileDefaults();
    void RefreshEditorVisuals();
    void SpawnConfiguredVisual();
};
