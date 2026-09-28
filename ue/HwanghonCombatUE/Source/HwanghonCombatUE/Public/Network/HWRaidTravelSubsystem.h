#pragma once
#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Network/HWRaidNetworkSubsystem.h"
#include "HWRaidTravelSubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWRaidTravelErrorSignature,FString,Error);

UCLASS()
class HWANGHONCOMBATUE_API UHWRaidTravelSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
public:
    virtual void Initialize(FSubsystemCollectionBase& Collection)override;
    virtual void Deinitialize()override;
    UPROPERTY(BlueprintAssignable) FHWRaidTravelErrorSignature OnTravelError;
    UPROPERTY(EditAnywhere,BlueprintReadWrite,Category="Hwanghon|Network") FString OnlineRaidMapPackage=TEXT("/Game/Maps/Hwanghon_OnlineRaid");
    UPROPERTY(EditAnywhere,BlueprintReadWrite,Category="Hwanghon|Network") FString ReturnMapPackage;
    UPROPERTY(EditAnywhere,BlueprintReadWrite,Category="Hwanghon|Network") bool bAutoTravelToRaid=true;
    UPROPERTY(EditAnywhere,BlueprintReadWrite,Category="Hwanghon|Network") bool bAutoReturnWhenRaidRemoved=false;
private:
    UFUNCTION() void HandleRoomState(FHWPartyNetSnapshot Room);
    bool TravelToPackage(const FString& Package);
    bool IsCurrentPackage(const FString& Package)const;
    UPROPERTY(Transient) TObjectPtr<UHWRaidNetworkSubsystem> Network;
    bool bLastHadRaid=false;
};
