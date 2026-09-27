#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "HWSaveGame.generated.h"

// A completion receipt identifies one run, so retries cannot count a victory twice.
USTRUCT()
struct FHWClearReceipt
{
    GENERATED_BODY()

    UPROPERTY(SaveGame)
    FGuid RunId;

    UPROPERTY(SaveGame)
    FName EncounterId;
};

UCLASS()
class HWANGHONCOMBATUE_API UHWSaveGame : public USaveGame
{
    GENERATED_BODY()

public:
    static constexpr int32 CurrentVersion = 1;

    virtual void Serialize(FArchive& Ar) override;

    UPROPERTY(SaveGame)
    int32 Version = CurrentVersion;

    UPROPERTY(SaveGame)
    TArray<FHWClearReceipt> Clears;

    bool IsValidProfile() const;
    bool RecordClear(const FGuid& RunId, FName EncounterId);
    int32 GetClearCount(FName EncounterId) const;

private:
    // LoadGameFromMemory can return an object even when its archive was truncated.
    bool bDeserializationFailed = false;
};
