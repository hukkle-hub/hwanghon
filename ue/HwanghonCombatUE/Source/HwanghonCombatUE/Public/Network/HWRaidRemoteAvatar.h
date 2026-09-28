#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "HWRaidRemoteAvatar.generated.h"
class UStaticMeshComponent;

UCLASS()
class HWANGHONCOMBATUE_API AHWRaidRemoteAvatar : public ACharacter
{
    GENERATED_BODY()
public:
    AHWRaidRemoteAvatar();
    UFUNCTION(BlueprintCallable)
    void ApplySnapshot(FString InPlayerId,FName InCharacterId,FVector WorldLocation,float AimRadians,float InHealth,float InMaxHealth,bool bInDead,float DeltaSeconds);
    UFUNCTION(BlueprintPure) FString GetPlayerId()const{return PlayerId;}
    UFUNCTION(BlueprintPure) FName GetCharacterId()const{return CharacterId;}
private:
    UPROPERTY(VisibleAnywhere) TObjectPtr<UStaticMeshComponent> Visual;
    FString PlayerId;
    FName CharacterId=TEXT("ain");
    float Health=0.f,MaxHealth=0.f;
    bool bDead=false;
};
