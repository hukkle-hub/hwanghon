#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Network/HWRaidNetworkSubsystem.h"
#include "HWRaidWorldBridge.generated.h"

UCLASS()
class HWANGHONCOMBATUE_API AHWRaidWorldBridge : public AActor
{
    GENERATED_BODY()
public:
    AHWRaidWorldBridge();
    virtual void BeginPlay()override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason)override;
    virtual void Tick(float DeltaSeconds)override;

    UPROPERTY(EditAnywhere,BlueprintReadWrite,Category="Hwanghon|Network")
    float ServerUnitToCentimeters=2.f;
    UPROPERTY(EditAnywhere,BlueprintReadWrite,Category="Hwanghon|Network")
    float LocalSnapDistanceCm=350.f;

private:
    UFUNCTION() void HandleRaidSnapshot(FHWRaidNetSnapshot Snapshot);
    UFUNCTION() void HandleConnectionChanged(bool bConnected);
    void ResolveActors();
    void ReconcileLocal(const FHWRaidNetPlayer& P,float Dt);
    void ReconcileBoss(const FHWRaidNetBoss& B,FName RaidState,float Dt);
    void ReconcileRemote(float Dt);
    void ReconcilePresentation();
    FVector ServerToWorld(float X,float Y,float Z=96.f)const;
    const FHWRaidNetPlayer* FindLocal()const;

    UPROPERTY(Transient) TObjectPtr<UHWRaidNetworkSubsystem> Network;
    UPROPERTY(Transient) TObjectPtr<class AHWAinCharacter> LocalPlayer;
    UPROPERTY(Transient) TObjectPtr<class AHWBossCharacter> BossActor;
    UPROPERTY(Transient) TMap<FString,TObjectPtr<class AHWRaidRemoteAvatar>> RemotePlayers;
    UPROPERTY(Transient) TMap<FName,TObjectPtr<class AHWBossPartTarget>> NetworkBossParts;
    UPROPERTY(Transient) TMap<FName,TObjectPtr<class AHWRaidHazardProxy>> HazardProxies;
    UPROPERTY(Transient) TMap<FName,TObjectPtr<class AHWRaidExpeditionNodeProxy>> ExpeditionNodeProxies;
    UPROPERTY(Transient) TObjectPtr<class AHWRaidGateProxy> GateProxy;

    FHWRaidNetSnapshot Latest;
    bool bHasSnapshot=false;
    bool bOriginCalibrated=false;
    FVector WorldOriginOffset=FVector::ZeroVector;
};
