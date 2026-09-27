#pragma once

#include "CoreMinimal.h"
#include "Game/HWQuestRunSubsystem.h"
#include "Boss/HWBossCharacter.h"
#include "HWQuestRunTestObserver.generated.h"

UCLASS()
class UHWQuestRunTestObserver : public UObject
{
    GENERATED_BODY()
public:
    UPROPERTY()
    TObjectPtr<UHWQuestRunSubsystem> Runs;

    int32 Calls = 0;
    bool bNestedRetry = false;
    bool bNestedReset = false;

    UPROPERTY()
    TObjectPtr<AHWBossCharacter> Boss;

    UFUNCTION()
    void KillBossFromDamage(float Damage, EHWAttackTier Tier)
    {
        Boss->ReceivePlayerHit(Boss->GetHealth(), EHWAttackTier::Light, FVector::ZeroVector);
    }

    UFUNCTION()
    void OnSaved(FName EncounterId, int32 ClearCount)
    {
        ++Calls;
        bNestedRetry = Runs->RetryVictorySave();
        bNestedReset = Runs->ResetRun();
    }
};
