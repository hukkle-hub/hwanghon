#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HHShelterStation.generated.h"

class UBoxComponent;
class UTextRenderComponent;
class UPointLightComponent;
class APlayerController;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHHStationInteracted, FName, StationId, APlayerController*, PlayerController);

UCLASS(BlueprintType)
class HWANGHONSHELTER_API AHHShelterStation : public AActor
{
    GENERATED_BODY()

public:
    AHHShelterStation();

    virtual void OnConstruction(const FTransform& Transform) override;
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Shelter")
    FName StationId = TEXT("PartyOffice");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Shelter")
    int32 StationNumber = 1;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Shelter")
    FText DisplayName;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Shelter")
    FText EnglishName;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Shelter")
    FText InteractionLabel;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Shelter")
    FLinearColor AccentColor = FLinearColor(0.72f, 0.38f, 0.10f, 1.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|Shelter")
    FVector InteractionExtent = FVector(360.0, 260.0, 220.0);

    UPROPERTY(BlueprintAssignable, Category="Hwanghon|Shelter")
    FHHStationInteracted OnInteracted;

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Shelter")
    void Interact(APlayerController* PlayerController);

    UFUNCTION(BlueprintPure, Category="Hwanghon|Shelter")
    FText GetPromptText() const;

    UFUNCTION(BlueprintPure, Category="Hwanghon|Shelter")
    FText GetMenuTitle() const;

    UFUNCTION(BlueprintPure, Category="Hwanghon|Shelter")
    TArray<FText> GetMenuItems() const;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<USceneComponent> Root;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<UBoxComponent> InteractionVolume;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<UTextRenderComponent> NumberText;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<UTextRenderComponent> NameText;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<UPointLightComponent> AccentLight;

private:
    void ApplyDefaultsFromId();
};
