#include "Network/HWRaidWorldBridge.h"
#include "Network/HWRaidRemoteAvatar.h"
#include "Network/HWRaidHazardProxy.h"
#include "Network/HWRaidExpeditionProxy.h"
#include "Character/HWAinCharacter.h"
#include "Boss/HWBossCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "System/HWBossPartTarget.h"
#include "Kismet/GameplayStatics.h"
#include "EngineUtils.h"

AHWRaidWorldBridge::AHWRaidWorldBridge(){PrimaryActorTick.bCanEverTick=true;}
void AHWRaidWorldBridge::BeginPlay()
{
    Super::BeginPlay();Network=GetGameInstance()?GetGameInstance()->GetSubsystem<UHWRaidNetworkSubsystem>():nullptr;
    if(Network){Network->OnRaidSnapshot.AddDynamic(this,&AHWRaidWorldBridge::HandleRaidSnapshot);Network->OnConnectionChanged.AddDynamic(this,&AHWRaidWorldBridge::HandleConnectionChanged);if(Network->GetRoom().bHasRaid){Latest=Network->GetRoom().Raid;bHasSnapshot=true;}}
    ResolveActors();
}
void AHWRaidWorldBridge::EndPlay(const EEndPlayReason::Type R)
{
    for(auto& P:RemotePlayers)if(IsValid(P.Value))P.Value->Destroy();RemotePlayers.Reset();
    for(auto& P:HazardProxies)if(IsValid(P.Value))P.Value->Destroy();HazardProxies.Reset();
    for(auto& P:ExpeditionNodeProxies)if(IsValid(P.Value))P.Value->Destroy();ExpeditionNodeProxies.Reset();
    if(IsValid(GateProxy))GateProxy->Destroy();GateProxy=nullptr;Super::EndPlay(R);
}
void AHWRaidWorldBridge::HandleRaidSnapshot(FHWRaidNetSnapshot S){Latest=MoveTemp(S);bHasSnapshot=true;}
void AHWRaidWorldBridge::HandleConnectionChanged(bool b){if(!b){bHasSnapshot=false;bOriginCalibrated=false;WorldOriginOffset=FVector::ZeroVector;}}
void AHWRaidWorldBridge::ResolveActors()
{
    if(!LocalPlayer)LocalPlayer=Cast<AHWAinCharacter>(UGameplayStatics::GetPlayerCharacter(this,0));
    if(!BossActor)BossActor=Cast<AHWBossCharacter>(UGameplayStatics::GetActorOfClass(this,AHWBossCharacter::StaticClass()));
}
FVector AHWRaidWorldBridge::ServerToWorld(float X,float Y,float Z)const{return FVector(X*ServerUnitToCentimeters,Y*ServerUnitToCentimeters,Z)+WorldOriginOffset;}
const FHWRaidNetPlayer* AHWRaidWorldBridge::FindLocal()const
{
    if(!Network)return nullptr;const FString Id=Network->GetPlayerId();
    return Latest.Players.FindByPredicate([&Id](const FHWRaidNetPlayer& P){return P.Id==Id;});
}
void AHWRaidWorldBridge::Tick(float Dt)
{
    Super::Tick(Dt);if(!Network||!Network->IsRaidActive()||!bHasSnapshot)return;ResolveActors();
    if(const auto* P=FindLocal())ReconcileLocal(*P,Dt);
    ReconcileBoss(Latest.Boss,Latest.State,Dt);ReconcilePresentation();ReconcileRemote(Dt);
}
void AHWRaidWorldBridge::ReconcileLocal(const FHWRaidNetPlayer& P,float Dt)
{
    if(!LocalPlayer||!LocalPlayer->GetCombat())return;
    if(!bOriginCalibrated)
    {
        const FVector Raw(P.X*ServerUnitToCentimeters,P.Y*ServerUnitToCentimeters,LocalPlayer->GetActorLocation().Z);
        WorldOriginOffset=LocalPlayer->GetActorLocation()-Raw;WorldOriginOffset.Z=0.f;bOriginCalibrated=true;
    }
    const FVector T=ServerToWorld(P.X,P.Y,LocalPlayer->GetActorLocation().Z),C=LocalPlayer->GetActorLocation();
    LocalPlayer->SetActorLocation(FVector::Dist2D(C,T)>LocalSnapDistanceCm?T:FMath::VInterpTo(C,T,Dt,9.f),false);
    LocalPlayer->SetSystemCharacterId(P.Character);
    LocalPlayer->GetCombat()->ApplyAuthoritativeVitals(P.Hp,P.MaxHp,P.Stamina,P.bDead||P.DownTime>0.f);
}
void AHWRaidWorldBridge::ReconcileBoss(const FHWRaidNetBoss& B,FName RaidState,float Dt)
{
    if(!BossActor)return;BossActor->SetNetworkAuthoritative(true);
    const FVector T=ServerToWorld(B.X,B.Y,BossActor->GetActorLocation().Z),C=BossActor->GetActorLocation();
    BossActor->SetActorLocation(FVector::Dist2D(C,T)>450.f?T:FMath::VInterpTo(C,T,Dt,10.f),false);
    BossActor->SetActorRotation(FMath::RInterpTo(BossActor->GetActorRotation(),FRotator(0.f,FMath::RadiansToDegrees(B.Aim),0.f),Dt,12.f));
    BossActor->ApplyAuthoritativeSnapshot(B.Hp,B.MaxHp,B.Posture,B.State,RaidState==TEXT("clear"));

    TSet<FName> Seen;
    for(TActorIterator<AHWBossPartTarget> It(GetWorld());It;++It)
    {
        AHWBossPartTarget* A=*It;if(!A)continue;const FName Id=A->GetPartId();
        const auto* S=B.Parts.FindByPredicate([Id](const FHWRaidNetBossPart& P){return P.Id==Id;});
        if(S){Seen.Add(Id);A->SetAuthoritativeBroken(S->bBroken);NetworkBossParts.Add(Id,A);}
        else{A->SetActorHiddenInGame(true);A->SetActorEnableCollision(false);}
    }
    int32 I=0;
    for(const auto& P:B.Parts)
    {
        if(Seen.Contains(P.Id)){++I;continue;}
        FVector O(0,0,90);if(P.Id==TEXT("head"))O=FVector(0,0,160);else if(P.Id==TEXT("core"))O=FVector(0,0,110);else if(P.Id==TEXT("back"))O=FVector(-35,0,115);else if(P.Id==TEXT("legf"))O=FVector(45,55,30);else if(P.Id==TEXT("tail"))O=FVector(-90,0,45);else O+=FVector(0,(I%2?1.f:-1.f)*55.f,I*8.f);
        auto* A=GetWorld()->SpawnActor<AHWBossPartTarget>(AHWBossPartTarget::StaticClass(),BossActor->GetActorLocation(),BossActor->GetActorRotation());
        if(A){A->ConfigurePart(BossActor,P.Id,O,0.f);A->SetAuthoritativeBroken(P.bBroken);NetworkBossParts.Add(P.Id,A);}++I;
    }
}
void AHWRaidWorldBridge::ReconcilePresentation()
{
    TSet<FName> HSeen;
    for(const auto& H:Latest.Hazards)
    {
        const FName K(*((H.bArenaHazard?TEXT("arena_"):TEXT("expedition_"))+H.Id.ToString()));HSeen.Add(K);
        AHWRaidHazardProxy* P=HazardProxies.FindRef(K);if(!IsValid(P)){P=GetWorld()->SpawnActor<AHWRaidHazardProxy>(AHWRaidHazardProxy::StaticClass(),ServerToWorld(H.X,H.Y,4.f),FRotator::ZeroRotator);if(P)HazardProxies.Add(K,P);}
        if(P)P->ApplyHazard(H.Id,H.Phase,ServerToWorld(H.X,H.Y,4.f),H.Radius*ServerUnitToCentimeters,H.bArenaHazard);
    }
    TArray<FName> HR;for(const auto& P:HazardProxies)if(!HSeen.Contains(P.Key)){if(IsValid(P.Value))P.Value->Destroy();HR.Add(P.Key);}for(FName K:HR)HazardProxies.Remove(K);

    TSet<FName> NSeen;
    for(const auto& N:Latest.Expedition.Nodes)
    {
        NSeen.Add(N.Id);AHWRaidExpeditionNodeProxy* P=ExpeditionNodeProxies.FindRef(N.Id);
        if(!IsValid(P)){P=GetWorld()->SpawnActor<AHWRaidExpeditionNodeProxy>(AHWRaidExpeditionNodeProxy::StaticClass(),ServerToWorld(N.X,N.Y,45.f),FRotator::ZeroRotator);if(P)ExpeditionNodeProxies.Add(N.Id,P);}
        if(P)P->ApplyNode(N.Id,N.Kind,N.Name,ServerToWorld(N.X,N.Y,45.f),N.Range*ServerUnitToCentimeters,N.bEnabled,N.bDone,N.bDiscovered);
    }
    TArray<FName> NR;for(const auto& P:ExpeditionNodeProxies)if(!NSeen.Contains(P.Key)){if(IsValid(P.Value))P.Value->Destroy();NR.Add(P.Key);}for(FName K:NR)ExpeditionNodeProxies.Remove(K);

    if(Latest.Gate.bValid)
    {
        if(!IsValid(GateProxy))GateProxy=GetWorld()->SpawnActor<AHWRaidGateProxy>(AHWRaidGateProxy::StaticClass(),ServerToWorld(Latest.Gate.X,Latest.Gate.Y,120.f),FRotator::ZeroRotator);
        if(GateProxy)GateProxy->ApplyGate(ServerToWorld(Latest.Gate.X,Latest.Gate.Y,120.f),Latest.Gate.bOpen);
    }
}
void AHWRaidWorldBridge::ReconcileRemote(float Dt)
{
    if(!GetWorld()||!Network)return;const FString LocalId=Network->GetPlayerId();TSet<FString> Seen;
    for(const auto& P:Latest.Players)
    {
        if(P.Id.IsEmpty()||P.Id==LocalId)continue;Seen.Add(P.Id);AHWRaidRemoteAvatar* A=RemotePlayers.FindRef(P.Id);
        if(!IsValid(A)){A=GetWorld()->SpawnActor<AHWRaidRemoteAvatar>(AHWRaidRemoteAvatar::StaticClass(),ServerToWorld(P.X,P.Y),FRotator::ZeroRotator);if(A)RemotePlayers.Add(P.Id,A);}
        if(A)A->ApplySnapshot(P.Id,P.Character,ServerToWorld(P.X,P.Y,A->GetActorLocation().Z),P.Aim,P.Hp,P.MaxHp,P.bDead,Dt);
    }
    TArray<FString> R;for(const auto& P:RemotePlayers)if(!Seen.Contains(P.Key)){if(IsValid(P.Value))P.Value->Destroy();R.Add(P.Key);}for(const FString& Id:R)RemotePlayers.Remove(Id);
}
