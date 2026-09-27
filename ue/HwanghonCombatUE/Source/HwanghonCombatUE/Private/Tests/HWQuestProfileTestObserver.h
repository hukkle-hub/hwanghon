#pragma once

#include "CoreMinimal.h"
#include "Progression/HWProfileSubsystem.h"
#include "HWQuestProfileTestObserver.generated.h"

// Reflected receiver used only by automation to exercise Blueprint-style callbacks.
UCLASS(Transient)
class UHWQuestProfileTestObserver : public UObject
{
    GENERATED_BODY()

public:
    UPROPERTY()
    TObjectPtr<UHWProfileSubsystem> Profile;

    int32 ErrorCount = 0;
    int32 ClaimCount = 0;
    bool bAllClaimsCommitted = true;

    UFUNCTION()
    void RetryOnError(FString Message)
    {
        ++ErrorCount;
        if (Profile) Profile->RetryPendingSave();
    }

    UFUNCTION()
    void OnClaim(FName QuestId)
    {
        ++ClaimCount;
        bAllClaimsCommitted &= Profile && Profile->GetQuestState(QuestId) == EHWQuestState::Claimed;
    }
};
