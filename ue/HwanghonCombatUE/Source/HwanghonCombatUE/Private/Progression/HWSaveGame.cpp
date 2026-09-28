#include "Progression/HWSaveGame.h"

namespace
{
    bool ValidClears(const TArray<FHWClearReceipt>& Clears)
    {
        TSet<FGuid> Seen;
        for (const FHWClearReceipt& Clear : Clears)
        {
            if (!Clear.RunId.IsValid() || Clear.EncounterId.IsNone() || Seen.Contains(Clear.RunId)) return false;
            Seen.Add(Clear.RunId);
        }
        return true;
    }

    bool ValidRewardIdentity(FName Id, EHWClaimRewardKind Kind)
    {
        switch (Kind)
        {
        case EHWClaimRewardKind::Currency: return Id == FName(TEXT("gold"));
        case EHWClaimRewardKind::Experience: return Id == FName(TEXT("exp"));
        case EHWClaimRewardKind::Item: return !Id.IsNone() && Id != FName(TEXT("gold")) && Id != FName(TEXT("exp"));
        default: return false;
        }
    }

    bool ValidQuest(const FHWQuestDefinition& Quest)
    {
        if (Quest.Id.IsNone() || Quest.ArenaId.IsNone() || Quest.ClaimFlag != FName(*(TEXT("claim_") + Quest.Id.ToString())) ||
            Quest.ClaimRewards.IsEmpty()) return false;
        TSet<FName> SeenPrerequisites, SeenRewards;
        for (FName Prerequisite : Quest.PrerequisiteArenaIds)
        {
            if (Prerequisite.IsNone() || Prerequisite == Quest.ArenaId || SeenPrerequisites.Contains(Prerequisite)) return false;
            SeenPrerequisites.Add(Prerequisite);
        }
        for (const FHWQuestClaimReward& Reward : Quest.ClaimRewards)
        {
            if (!ValidRewardIdentity(Reward.Id, Reward.Kind) || Reward.Min < 0 || Reward.Max < Reward.Min || SeenRewards.Contains(Reward.Id)) return false;
            SeenRewards.Add(Reward.Id);
        }
        return true;
    }

    bool AddNonNegative(int64& Total, int64 Amount)
    {
        if (Total < 0 || Amount < 0 || Total > MAX_int64 - Amount) return false;
        Total += Amount;
        return true;
    }

    bool AddReward(const FHWResolvedClaimReward& Reward, int64& Gold, int64& Experience, TMap<FName, int64>& Inventory)
    {
        if (!ValidRewardIdentity(Reward.Id, Reward.Kind) || Reward.Amount < 0) return false;
        switch (Reward.Kind)
        {
        case EHWClaimRewardKind::Currency: return AddNonNegative(Gold, Reward.Amount);
        case EHWClaimRewardKind::Experience: return AddNonNegative(Experience, Reward.Amount);
        case EHWClaimRewardKind::Item:
            // A zero reward is receipted, but does not create an empty inventory row.
            return Reward.Amount == 0 || AddNonNegative(Inventory.FindOrAdd(Reward.Id), Reward.Amount);
        default: return false;
        }
    }

    bool ReceiptMatchesQuest(const FHWQuestClaimReceipt& Claim, const FHWQuestDefinition& Quest)
    {
        if (Claim.QuestId != Quest.Id || Claim.ArenaId != Quest.ArenaId || Claim.ClaimFlag != Quest.ClaimFlag ||
            Claim.Rewards.Num() != Quest.ClaimRewards.Num()) return false;
        for (const FHWQuestClaimReward& Definition : Quest.ClaimRewards)
        {
            const FHWResolvedClaimReward* Resolved = Claim.Rewards.FindByPredicate(
                [&Definition](const FHWResolvedClaimReward& Reward) { return Reward.Id == Definition.Id; });
            if (!Resolved || Resolved->Kind != Definition.Kind || Resolved->Amount < Definition.Min || Resolved->Amount > Definition.Max) return false;
        }
        return true;
    }

    int64 RollInclusive(int32 Min, int32 Max, FRandomStream& Random)
    {
        if (Min == Max) return Min;
        // uint32 rejection sampling supports [0, MAX_int32] without signed overflow.
        const uint32 Width = static_cast<uint32>(static_cast<int64>(Max) - Min + 1);
        const uint32 Threshold = (0u - Width) % Width;
        uint32 Value;
        do { Value = Random.GetUnsignedInt(); } while (Value < Threshold);
        return static_cast<int64>(Min) + Value % Width;
    }
}

void UHWSaveGame::Serialize(FArchive& Ar)
{
    Super::Serialize(Ar);
    if (Ar.IsLoading()) bDeserializationFailed = Ar.IsError();
}

bool UHWSaveGame::IsValidProfile() const
{
    const bool bValidCharacter =
        SelectedCharacter == TEXT("ain") || SelectedCharacter == TEXT("kain")
        || SelectedCharacter == TEXT("ryu") || SelectedCharacter == TEXT("sera");
    if (bDeserializationFailed || Version != CurrentVersion || !bValidCharacter
        || !ValidClears(Clears) || Gold < 0 || Experience < 0) return false;
    int64 ExpectedGold = 0, ExpectedExperience = 0;
    TMap<FName, int64> ExpectedInventory;
    TSet<FName> SeenQuests, SeenFlags;
    for (const FHWQuestClaimReceipt& Claim : Claims)
    {
        if (Claim.QuestId.IsNone() || Claim.ArenaId.IsNone() || Claim.ClaimFlag != FName(*(TEXT("claim_") + Claim.QuestId.ToString())) ||
            SeenQuests.Contains(Claim.QuestId) || SeenFlags.Contains(Claim.ClaimFlag) || GetClearCount(Claim.ArenaId) == 0 || Claim.Rewards.IsEmpty()) return false;
        SeenQuests.Add(Claim.QuestId);
        SeenFlags.Add(Claim.ClaimFlag);
        TSet<FName> SeenRewards;
        for (const FHWResolvedClaimReward& Reward : Claim.Rewards)
        {
            if (SeenRewards.Contains(Reward.Id) || !AddReward(Reward, ExpectedGold, ExpectedExperience, ExpectedInventory)) return false;
            SeenRewards.Add(Reward.Id);
        }
    }
    if (Gold != ExpectedGold || Experience != ExpectedExperience || Inventory.Num() != ExpectedInventory.Num()) return false;
    for (const auto& Pair : Inventory)
    {
        const int64* Expected = ExpectedInventory.Find(Pair.Key);
        if (Pair.Key.IsNone() || Pair.Value <= 0 || !Expected || *Expected != Pair.Value) return false;
    }
    return true;
}

bool UHWSaveGame::MigrateToCurrentVersion()
{
    if (Version == CurrentVersion) return IsValidProfile();
    if (bDeserializationFailed) return false;

    if (Version == 1)
    {
        // v1 contained only clear receipts. Do not silently discard unexpected data.
        if (!ValidClears(Clears) || Gold != 0 || Experience != 0
            || !Inventory.IsEmpty() || !Claims.IsEmpty()) return false;
        SelectedCharacter = TEXT("ain");
        Version = CurrentVersion;
        return IsValidProfile();
    }

    if (Version == 2)
    {
        // v2 already validates clears/rewards through IsValidProfile after the version lift.
        SelectedCharacter = TEXT("ain");
        Version = CurrentVersion;
        return IsValidProfile();
    }

    return false;
}

bool UHWSaveGame::ValidateAgainstCatalog(const TArray<FHWQuestDefinition>& Quests) const
{
    if (!IsValidProfile() || Quests.IsEmpty()) return false;
    TSet<FName> Seen;
    for (const FHWQuestDefinition& Quest : Quests)
    {
        if (!ValidQuest(Quest) || Seen.Contains(Quest.Id)) return false;
        Seen.Add(Quest.Id);
    }
    for (const FHWQuestClaimReceipt& Claim : Claims)
    {
        const FHWQuestDefinition* Quest = Quests.FindByPredicate([&Claim](const FHWQuestDefinition& Row) { return Row.Id == Claim.QuestId; });
        if (!Quest || !ReceiptMatchesQuest(Claim, *Quest)) return false;
    }
    return true;
}

bool UHWSaveGame::RecordClear(const FGuid& RunId, FName EncounterId)
{
    if (!RunId.IsValid() || EncounterId.IsNone() || !IsValidProfile()) return false;
    for (const FHWClearReceipt& Clear : Clears)
    {
        if (Clear.RunId == RunId) return Clear.EncounterId == EncounterId;
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
    for (const FHWClearReceipt& Clear : Clears) Count += Clear.EncounterId == EncounterId ? 1 : 0;
    return Count;
}

bool UHWSaveGame::HasClear(const FGuid& RunId, FName EncounterId) const
{
    return RunId.IsValid() && !EncounterId.IsNone() && Clears.ContainsByPredicate(
        [&RunId, EncounterId](const FHWClearReceipt& Receipt) { return Receipt.RunId == RunId && Receipt.EncounterId == EncounterId; });
}

EHWQuestState UHWSaveGame::GetQuestState(const FHWQuestDefinition& Quest) const
{
    if (!IsValidProfile() || !ValidQuest(Quest)) return EHWQuestState::Unavailable;
    const FHWQuestClaimReceipt* Claim = Claims.FindByPredicate([&Quest](const FHWQuestClaimReceipt& Row) { return Row.QuestId == Quest.Id; });
    if (Claim) return ReceiptMatchesQuest(*Claim, Quest) ? EHWQuestState::Claimed : EHWQuestState::Unavailable;
    // Preserve story.js precedence. Recommended level is presentation only.
    if (GetClearCount(Quest.ArenaId) > 0) return EHWQuestState::Cleared;
    for (FName Prerequisite : Quest.PrerequisiteArenaIds)
    {
        if (GetClearCount(Prerequisite) == 0) return EHWQuestState::Locked;
    }
    return EHWQuestState::Available;
}

bool UHWSaveGame::ClaimQuest(const FHWQuestDefinition& Quest, FRandomStream& Random)
{
    if (GetQuestState(Quest) != EHWQuestState::Cleared) return false;
    int64 NewGold = Gold, NewExperience = Experience;
    TMap<FName, int64> NewInventory = Inventory;
    FRandomStream CandidateRandom = Random;
    FHWQuestClaimReceipt Claim;
    Claim.QuestId = Quest.Id;
    Claim.ArenaId = Quest.ArenaId;
    Claim.ClaimFlag = Quest.ClaimFlag;
    for (const FHWQuestClaimReward& Definition : Quest.ClaimRewards)
    {
        FHWResolvedClaimReward Reward;
        Reward.Id = Definition.Id;
        Reward.Kind = Definition.Kind;
        Reward.Amount = RollInclusive(Definition.Min, Definition.Max, CandidateRandom);
        if (!AddReward(Reward, NewGold, NewExperience, NewInventory)) return false;
        Claim.Rewards.Add(Reward);
    }
    // Publish only once every reward has passed validation and overflow checks.
    Gold = NewGold;
    Experience = NewExperience;
    Inventory = MoveTemp(NewInventory);
    Claims.Add(MoveTemp(Claim));
    Random = CandidateRandom;
    return true;
}
