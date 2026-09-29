#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "HHHubSubsystem.generated.h"

class AHHShelterStation;
class AHHShelterNPC;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHHFocusedStationChanged, AHHShelterStation*, Station);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHHActiveStationChanged, AHHShelterStation*, Station);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHHFocusedNPCChanged, AHHShelterNPC*, NPC);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHHActiveNPCChanged, AHHShelterNPC*, NPC);

UCLASS()
class HWANGHONSHELTER_API UHHHubSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintAssignable)
    FHHFocusedStationChanged OnFocusedStationChanged;

    UPROPERTY(BlueprintAssignable)
    FHHActiveStationChanged OnActiveStationChanged;

    UPROPERTY(BlueprintAssignable)
    FHHFocusedNPCChanged OnFocusedNPCChanged;

    UPROPERTY(BlueprintAssignable)
    FHHActiveNPCChanged OnActiveNPCChanged;

    UFUNCTION(BlueprintCallable)
    void RegisterStation(AHHShelterStation* Station);

    UFUNCTION(BlueprintCallable)
    void UnregisterStation(AHHShelterStation* Station);

    UFUNCTION(BlueprintCallable)
    void RegisterNPC(AHHShelterNPC* NPC);

    UFUNCTION(BlueprintCallable)
    void UnregisterNPC(AHHShelterNPC* NPC);

    UFUNCTION(BlueprintCallable)
    void SetFocusedStation(AHHShelterStation* Station);

    UFUNCTION(BlueprintCallable)
    void SetFocusedNPC(AHHShelterNPC* NPC);

    UFUNCTION(BlueprintPure)
    AHHShelterStation* GetFocusedStation() const { return FocusedStation.Get(); }

    UFUNCTION(BlueprintPure)
    AHHShelterNPC* GetFocusedNPC() const { return FocusedNPC.Get(); }

    UFUNCTION(BlueprintCallable)
    void OpenStation(AHHShelterStation* Station);

    UFUNCTION(BlueprintCallable)
    void CloseStation();

    UFUNCTION(BlueprintPure)
    AHHShelterStation* GetActiveStation() const { return ActiveStation.Get(); }

    UFUNCTION(BlueprintCallable)
    void OpenNPC(AHHShelterNPC* NPC);

    UFUNCTION(BlueprintCallable)
    void CloseNPC();

    UFUNCTION(BlueprintPure)
    AHHShelterNPC* GetActiveNPC() const { return ActiveNPC.Get(); }

    UFUNCTION(BlueprintCallable)
    void CloseAll();

    UFUNCTION(BlueprintPure)
    AHHShelterStation* FindStationById(FName StationId) const;

    AHHShelterStation* FindBestStation(const FVector& Origin, const FVector& Forward, float MaxDistance, float MinFacingDot) const;
    AHHShelterNPC* FindBestNPC(const FVector& Origin, const FVector& Forward, float MaxDistance, float MinFacingDot) const;

private:
    TArray<TWeakObjectPtr<AHHShelterStation>> Stations;
    TArray<TWeakObjectPtr<AHHShelterNPC>> NPCs;

    TWeakObjectPtr<AHHShelterStation> FocusedStation;
    TWeakObjectPtr<AHHShelterStation> ActiveStation;
    TWeakObjectPtr<AHHShelterNPC> FocusedNPC;
    TWeakObjectPtr<AHHShelterNPC> ActiveNPC;
};
