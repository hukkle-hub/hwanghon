#include "Network/HWNetworkCombatBridgeComponent.h"
#include "Network/HWRaidNetworkSubsystem.h"
#include "Character/HWAinCharacter.h"
#include "Camera/HWLockOnComponent.h"
#include "System/HWBossPartTarget.h"
#include "Engine/World.h"
#include "Engine/GameInstance.h"
#include "GameFramework/Controller.h"

UHWNetworkCombatBridgeComponent::UHWNetworkCombatBridgeComponent(){PrimaryComponentTick.bCanEverTick=true;}
void UHWNetworkCombatBridgeComponent::BeginPlay()
{
    Super::BeginPlay();OwnerCharacter=Cast<AHWAinCharacter>(GetOwner());
    Network=GetWorld()&&GetWorld()->GetGameInstance()?GetWorld()->GetGameInstance()->GetSubsystem<UHWRaidNetworkSubsystem>():nullptr;
}
void UHWNetworkCombatBridgeComponent::TickComponent(float Dt,ELevelTick TickType,FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(Dt,TickType,ThisTickFunction);
    if(!IsAuthoritativeRaid()||!Network)return;
    MoveSendAccumulator+=Dt;const float Interval=MoveSendHz>0.f?1.f/MoveSendHz:.05f;
    if(MoveSendAccumulator>=Interval)
    {
        MoveSendAccumulator=FMath::Fmod(MoveSendAccumulator,Interval);
        // The stick is camera-relative; the server takes world axes (server x/y = UE X/Y, AHWRaidWorldBridge::ServerToWorld).
        const float Yaw=OwnerCharacter&&OwnerCharacter->GetController()?OwnerCharacter->GetController()->GetControlRotation().Yaw:0.f;
        const FRotationMatrix Basis(FRotator(0.f,Yaw,0.f));
        const FVector Dir=Basis.GetUnitAxis(EAxis::X)*MoveForward+Basis.GetUnitAxis(EAxis::Y)*MoveRight;
        Network->SendMove(Dir.X,Dir.Y);
    }
}
bool UHWNetworkCombatBridgeComponent::IsAuthoritativeRaid()const{return Network&&Network->IsRaidActive();}
void UHWNetworkCombatBridgeComponent::SyncTarget()
{
    if(!Network||!OwnerCharacter||!OwnerCharacter->GetLockOn())return;
    AActor* T=OwnerCharacter->GetLockOn()->GetTarget();
    if(AHWBossPartTarget* P=Cast<AHWBossPartTarget>(T))Network->SendTarget(P->GetPartId());
}
bool UHWNetworkCombatBridgeComponent::SendAttack(){if(!IsAuthoritativeRaid())return false;SyncTarget();return Network->SendAttack();}
bool UHWNetworkCombatBridgeComponent::SendSmash(){if(!IsAuthoritativeRaid())return false;SyncTarget();return Network->SendSmash();}
bool UHWNetworkCombatBridgeComponent::SendDodge(){return IsAuthoritativeRaid()?Network->SendDodge():false;}
bool UHWNetworkCombatBridgeComponent::SendJump(){return IsAuthoritativeRaid()?Network->SendJump():false;}
bool UHWNetworkCombatBridgeComponent::SendCounter(){if(!IsAuthoritativeRaid())return false;SyncTarget();return Network->SendCounter();}
bool UHWNetworkCombatBridgeComponent::SendSkill1(){if(!IsAuthoritativeRaid())return false;SyncTarget();return Network->SendSkill(0);}
bool UHWNetworkCombatBridgeComponent::SendSkill2(){if(!IsAuthoritativeRaid())return false;SyncTarget();return Network->SendSkill(1);}
bool UHWNetworkCombatBridgeComponent::SendSkill3(){if(!IsAuthoritativeRaid())return false;SyncTarget();return Network->SendSkill(2);}
bool UHWNetworkCombatBridgeComponent::SendSkill4(){if(!IsAuthoritativeRaid())return false;SyncTarget();return Network->SendSkill(3);}
bool UHWNetworkCombatBridgeComponent::SendUltimate(){if(!IsAuthoritativeRaid())return false;SyncTarget();return Network->SendUltimate();}
bool UHWNetworkCombatBridgeComponent::SendInteract(){return IsAuthoritativeRaid()?Network->SendInteract():false;}
bool UHWNetworkCombatBridgeComponent::SetGuard(bool b){return IsAuthoritativeRaid()?Network->SendGuard(b):false;}
bool UHWNetworkCombatBridgeComponent::SendOpening(){if(!IsAuthoritativeRaid())return false;SyncTarget();return Network->SendOpening();}
bool UHWNetworkCombatBridgeComponent::SendExecute(){if(!IsAuthoritativeRaid())return false;SyncTarget();return Network->SendExecute();}
bool UHWNetworkCombatBridgeComponent::BeginRevive(){return IsAuthoritativeRaid()?Network->SendRevive(true):false;}
bool UHWNetworkCombatBridgeComponent::EndRevive(){return IsAuthoritativeRaid()?Network->SendRevive(false):false;}
void UHWNetworkCombatBridgeComponent::SetMoveForward(float V){MoveForward=FMath::Clamp(V,-1.f,1.f);}
void UHWNetworkCombatBridgeComponent::SetMoveRight(float V){MoveRight=FMath::Clamp(V,-1.f,1.f);}
