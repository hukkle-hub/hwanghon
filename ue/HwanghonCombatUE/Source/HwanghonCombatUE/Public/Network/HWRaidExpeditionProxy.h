#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HWRaidExpeditionProxy.generated.h"
class UStaticMeshComponent;

UCLASS()
class HWANGHONCOMBATUE_API AHWRaidExpeditionNodeProxy : public AActor
{
    GENERATED_BODY()
public:
    AHWRaidExpeditionNodeProxy();
    UFUNCTION(BlueprintCallable) void ApplyNode(FName InId,FName InKind,const FString& InName,FVector WorldLocation,float RangeCm,bool bEnabled,bool bDone,bool bDiscovered);
    UFUNCTION(BlueprintPure) FName GetNodeId()const{return NodeId;}
private:
    UPROPERTY(VisibleAnywhere) TObjectPtr<UStaticMeshComponent> Visual;
    FName NodeId=NAME_None,Kind=NAME_None;
};
UCLASS()
class HWANGHONCOMBATUE_API AHWRaidGateProxy : public AActor
{
    GENERATED_BODY()
public:
    AHWRaidGateProxy();
    UFUNCTION(BlueprintCallable) void ApplyGate(FVector WorldLocation,bool bOpen);
private:
    UPROPERTY(VisibleAnywhere) TObjectPtr<UStaticMeshComponent> Visual;
};
