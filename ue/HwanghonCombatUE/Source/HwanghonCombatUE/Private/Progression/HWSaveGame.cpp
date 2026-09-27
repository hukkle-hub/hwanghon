#include "Progression/HWSaveGame.h"

void UHWSaveGame::Serialize(FArchive& Ar)
{
    Super::Serialize(Ar);
    if (Ar.IsLoading())
    {
        bDeserializationFailed = Ar.IsError();
    }
}

bool UHWSaveGame::IsValidProfile() const
{
    if (bDeserializationFailed || Version != CurrentVersion)
    {
        return false;
    }
    TSet<FGuid> Seen;
    for (const FHWClearReceipt& Clear : Clears)
    {
        if (!Clear.RunId.IsValid() || Clear.EncounterId.IsNone() || Seen.Contains(Clear.RunId))
        {
            return false;
        }
        Seen.Add(Clear.RunId);
    }
    return true;
}

bool UHWSaveGame::RecordClear(const FGuid& RunId, FName EncounterId)
{
    if (!RunId.IsValid() || EncounterId.IsNone() || !IsValidProfile())
    {
        return false;
    }
    for (const FHWClearReceipt& Clear : Clears)
    {
        if (Clear.RunId == RunId)
        {
            return Clear.EncounterId == EncounterId;
        }
    }
    FHWClearReceipt Clear;
    Clear.RunId = RunId;
    Clear.EncounterId = EncounterId;
    Clears.Add(Clear);
    return true;
}

int32 UHWSaveGame::GetClearCount(FName EncounterId) const
{
    int32 Count = 0;
    for (const FHWClearReceipt& Clear : Clears)
    {
        Count += Clear.EncounterId == EncounterId ? 1 : 0;
    }
    return Count;
}
