#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HWRaidHazardProxy.generated.h"
class UStaticMeshComponent;
UCLASS()
class HWANGHONCOMBATUE_API AHWRaidHazardProxy : public AActor
{
    GENERATED_BODY()
public:
    AHWRaidHazardProxy();
    UFUNCTION(BlueprintCallable) void ApplyHazard(FName InId,FName InPhase,FVector WorldLocation,float RadiusCm,bool bArenaHazard);
    UFUNCTION(BlueprintPure) FName GetHazardId()const{return HazardId;}
private:
    UPROPERTY(VisibleAnywhere) TObjectPtr<UStaticMeshComponent> Visual;
    FName HazardId=NAME_None,Phase=NAME_None;bool bArena=false;
};
