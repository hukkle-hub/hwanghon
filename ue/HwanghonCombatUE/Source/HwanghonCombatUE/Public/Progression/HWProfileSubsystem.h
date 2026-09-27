#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "HWProfileSubsystem.generated.h"

class UHWSaveGame;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHWClearSavedSignature, FName, EncounterId, int32, ClearCount);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWProfileErrorSignature, FString, Message);

UCLASS()
class HWANGHONCOMBATUE_API UHWProfileSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;

    // The game mode owns run identity; UI can inspect results and retry a failed save.
    bool RecordVictory(const FGuid& RunId, FName EncounterId);

    UFUNCTION(BlueprintCallable, Category="Hwanghon|Progression")
    bool RetryPendingSave();

    UFUNCTION(BlueprintPure, Category="Hwanghon|Progression")
    int32 GetClearCount(FName EncounterId) const;

    UFUNCTION(BlueprintPure, Category="Hwanghon|Progression")
    bool HasPendingSave() const { return PendingProfile != nullptr; }

    UFUNCTION(BlueprintPure, Category="Hwanghon|Progression")
    FString GetLastError() const { return LastError; }

    UPROPERTY(BlueprintAssignable)
    FHWClearSavedSignature OnClearSaved;

    UPROPERTY(BlueprintAssignable)
    FHWProfileErrorSignature OnProfileError;

private:
    bool Fail(const FString& Message);

    UPROPERTY(Transient)
    TObjectPtr<UHWSaveGame> Profile;

    UPROPERTY(Transient)
    TObjectPtr<UHWSaveGame> PendingProfile;

    TArray<TPair<FName, int32>> PendingNotifications;
    bool bDispatchingNotifications = false;
    FString LastError;
};
