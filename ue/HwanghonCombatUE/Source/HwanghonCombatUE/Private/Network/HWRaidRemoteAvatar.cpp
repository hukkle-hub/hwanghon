#include "Network/HWRaidRemoteAvatar.h"
#include "Components/CapsuleComponent.h"
#include "Components/StaticMeshComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "UObject/ConstructorHelpers.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimMontage.h"
#include "Animation/AnimSequenceBase.h"
#include "Animation/HWAnimationSetAsset.h"
#include "Animation/HWCharacterVisualSettings.h"
#include "Components/SkeletalMeshComponent.h"

AHWRaidRemoteAvatar::AHWRaidRemoteAvatar(const FObjectInitializer& ObjectInitializer)
    :Super(ObjectInitializer.SetDefaultSubobjectClass<UHWRemoteAvatarMovement>(ACharacter::CharacterMovementComponentName))
{
    PrimaryActorTick.bCanEverTick=false;GetCapsuleComponent()->InitCapsuleSize(42.f,92.f);GetCharacterMovement()->DisableMovement();
    Visual=CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Visual"));Visual->SetupAttachment(RootComponent);Visual->SetCollisionEnabled(ECollisionEnabled::NoCollision);Visual->SetRelativeScale3D(FVector(.45f,.32f,1.75f));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> M(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));if(M.Succeeded())Visual->SetStaticMesh(M.Object);
}
void AHWRaidRemoteAvatar::ApplySnapshot(FString Id,FName Char,FVector Target,float Aim,float Hp,float MaxHp,bool Dead,float Dt)
{
    PlayerId=MoveTemp(Id);CharacterId=Char;Health=Hp;MaxHealth=MaxHp;bDead=Dead;
    if(!bBodyApplied)ApplyBody();
    const FVector Cur=GetActorLocation();const FVector Next=FVector::Dist2D(Cur,Target)>350.f?Target:FMath::VInterpTo(Cur,Target,Dt,12.f);
    SetActorLocation(Next,false);
    // Locomotion comes from the body's AnimBP speed: feed it the replicated motion (movement itself is off).
    if(UHWRemoteAvatarMovement* Move=Cast<UHWRemoteAvatarMovement>(GetCharacterMovement()))
        Move->SetSnapshotMotion(Dt>KINDA_SMALL_NUMBER&&FVector::Dist2D(Cur,Next)<350.f?(Next-Cur)/Dt*FVector(1.f,1.f,0.f):FVector::ZeroVector);
    SetActorRotation(FMath::RInterpTo(GetActorRotation(),FRotator(0.f,FMath::RadiansToDegrees(Aim),0.f),Dt,14.f));
    SetActorHiddenInGame(bDead);SetActorEnableCollision(!bDead);
}

void AHWRaidRemoteAvatar::ApplyBody()
{
    bBodyApplied=true;
    AnimationSet=UHWCharacterVisualSettings::ApplyTo(CharacterId,GetMesh(),GetCapsuleComponent()->GetUnscaledCapsuleHalfHeight());
    // Snapshots own the motion; a ticking movement component (no controller) would zero the Velocity
    // the AnimBP reads for locomotion.
    GetCharacterMovement()->SetComponentTickEnabled(false);
    if(GetMesh()->GetSkeletalMeshAsset())Visual->SetVisibility(false);   // the capsule stand-in only when no body is installed
}

void AHWRaidRemoteAvatar::ApplyAction(FName Clip,float Elapsed,float Duration,bool bDowned)
{
    UAnimInstance* Anim=GetMesh()?GetMesh()->GetAnimInstance():nullptr;
    if(!Anim||!AnimationSet)return;
    if(bDowned!=(DownMontage!=nullptr))
    {
        const FHWSequenceBinding& Pose=AnimationSet->Downed.Sequence?AnimationSet->Downed:AnimationSet->Death;
        if(bDowned&&Pose.Sequence){DownMontage=Anim->PlaySlotAnimationAsDynamicMontage(Pose.Sequence,Pose.SlotName,Pose.BlendIn,Pose.BlendOut,1.f,Pose.bLoop?999:1,-1.f,0.f);if(DownMontage&&!Pose.bLoop)DownMontage->bEnableAutoBlendOut=false;}
        else if(!bDowned&&DownMontage){Anim->Montage_Stop(.25f,DownMontage);DownMontage=nullptr;}
    }
    if(bDowned)return;
    const bool bNew=!Clip.IsNone()&&(Clip!=LastClip||Elapsed+0.02f<LastElapsed);
    LastClip=Clip;LastElapsed=Elapsed;
    if(!bNew)return;
    const FHWSequenceBinding* B=AnimationSet->GetServerClipBinding(Clip,ComboCount++);
    if(!B||!B->Sequence)return;
    // Join the action where the server already is (snapshots arrive mid-action).
    const float Len=B->Sequence->GetPlayLength();
    const float Start=Duration>KINDA_SMALL_NUMBER?FMath::Clamp(Elapsed/Duration,0.f,0.95f)*Len:0.f;
    ActionMontage=Anim->PlaySlotAnimationAsDynamicMontage(B->Sequence,B->SlotName,B->BlendIn,B->BlendOut,Duration>KINDA_SMALL_NUMBER?Len/Duration:1.f,1,-1.f,Start);
}
