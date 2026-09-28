#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "HWRaidRemoteAvatar.generated.h"
class UStaticMeshComponent;

/** Movement of a remote player: never simulates, only carries the snapshot motion the body's AnimBP reads
    (Paragon AnimBPs switch to jog on acceleration, not on velocity). */
UCLASS()
class HWANGHONCOMBATUE_API UHWRemoteAvatarMovement : public UCharacterMovementComponent
{
    GENERATED_BODY()
public:
    void SetSnapshotMotion(const FVector& InVelocity)
    {
        Velocity=InVelocity;
        Acceleration=InVelocity.SizeSquared2D()>25.f?InVelocity.GetSafeNormal2D()*GetMaxAcceleration():FVector::ZeroVector;
    }
};

UCLASS()
class HWANGHONCOMBATUE_API AHWRaidRemoteAvatar : public ACharacter
{
    GENERATED_BODY()
public:
    AHWRaidRemoteAvatar(const FObjectInitializer& ObjectInitializer);
    UFUNCTION(BlueprintCallable)
    void ApplySnapshot(FString InPlayerId,FName InCharacterId,FVector WorldLocation,float AimRadians,float InHealth,float InMaxHealth,bool bInDead,float DeltaSeconds);
    /** Server action of this player (presentation only): plays the matching clip once per new action. */
    UFUNCTION(BlueprintCallable)
    void ApplyAction(FName Clip,float Elapsed,float Duration,bool bDowned);
    UFUNCTION(BlueprintPure) bool HasBody()const{return bBodyApplied;}
    UFUNCTION(BlueprintPure) FString GetPlayerId()const{return PlayerId;}
    UFUNCTION(BlueprintPure) FName GetCharacterId()const{return CharacterId;}
private:
    UPROPERTY(VisibleAnywhere) TObjectPtr<UStaticMeshComponent> Visual;
    void ApplyBody();
    UPROPERTY(Transient) TObjectPtr<class UHWAnimationSetAsset> AnimationSet;
    UPROPERTY(Transient) TObjectPtr<class UAnimMontage> ActionMontage;
    UPROPERTY(Transient) TObjectPtr<class UAnimMontage> DownMontage;
    FName LastClip=NAME_None;
    float LastElapsed=0.f;
    int32 ComboCount=0;
    bool bBodyApplied=false;
    bool bRagdoll=false;
    bool bDownedNow=false;
    FTransform SavedMeshRelative;
    FTimerHandle CollapseTimer;
    void Collapse();
    FString PlayerId;
    FName CharacterId=TEXT("ain");
    float Health=0.f,MaxHealth=0.f;
    bool bDead=false;
};
