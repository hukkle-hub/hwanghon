#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Combat/HWCombatTypes.h"
#include "HWCombatAuditActor.generated.h"

UCLASS()
class HWANGHONCOMBATUE_API AHWCombatAuditActor : public AActor
{
    GENERATED_BODY()

public:
    AHWCombatAuditActor();

    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void Tick(float DeltaSeconds) override;

    UFUNCTION(BlueprintCallable)
    void SaveNow();

    UFUNCTION(BlueprintPure)
    FString GetLastSavedPath() const { return LastSavedPath; }

private:
    UFUNCTION()
    void HandlePlayerContact(EHWActionType Action, EHWAttackTier Tier, float Damage);

    UFUNCTION()
    void HandlePlayerDamaged(float Damage, EHWAttackTier Tier);

    UFUNCTION()
    void HandleVisualPlayerContact(EHWActionType Action, float SourceTimeSeconds);

    void ResolveActors();
    void AddSample(float DeltaSeconds);
    void AddEvent(const FString& Name, const FString& Detail);
    FString Escape(const FString& In) const;

    UPROPERTY(Transient)
    TObjectPtr<class AHWAinCharacter> Player;

    UPROPERTY(Transient)
    TObjectPtr<class AHWBossCharacter> Boss;

    float StartTime = 0.f;
    float SampleAccumulator = 0.f;
    float FlushAccumulator = 0.f;
    float LastFrameMs = 0.f;

    TArray<FString> Rows;
    FString LastSavedPath;
};
