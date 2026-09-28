#include "System/HWSystemRulesLibrary.h"

FHWCharacterSystemProfile UHWSystemRulesLibrary::CharacterProfile(FName CharacterId)
{
    FHWCharacterSystemProfile P;
    P.CharacterId = CharacterId;

    if (CharacterId == TEXT("ain"))
    {
        P.Role = EHWSystemRole::Damage;
        P.Skill1Cooldown = 6.f;
        P.Skill2Cooldown = 8.f;
        P.Skill3Cooldown = 12.f;
        P.Skill4Cooldown = 15.f;
        P.Skill1Stamina = 15.f;
        P.Skill2Stamina = 20.f;
        P.Skill3Stamina = 25.f;
        P.Skill4Stamina = 0.f;
        P.UniqueGainOnHit = 9.f;
        P.UltimateGainOnHit = 9.f;
        P.Skill1Multiplier = 2.2f;
        P.Skill2Multiplier = 0.f;
        P.Skill3Multiplier = 1.2f;
        P.Skill4Multiplier = 0.f;
        P.UltimateMultiplier = 6.0f;
    }
    else if (CharacterId == TEXT("kain"))
    {
        P.Role = EHWSystemRole::Bruiser;
        P.Skill1Cooldown = 7.f;
        P.Skill2Cooldown = 12.f;
        P.Skill3Cooldown = 13.f;
        P.Skill4Cooldown = 10.f;
        P.Skill1Stamina = 18.f;
        P.Skill2Stamina = 0.f;
        P.Skill3Stamina = 28.f;
        P.Skill4Stamina = 20.f;
        P.UniqueGainOnHit = 8.f;
        P.UltimateGainOnHit = 7.f;
        P.Skill1Multiplier = 2.6f;
        P.Skill2Multiplier = 0.f;
        P.Skill3Multiplier = 1.4f;
        P.Skill4Multiplier = 1.8f;
        P.UltimateMultiplier = 5.5f;
    }
    else if (CharacterId == TEXT("ryu"))
    {
        P.Role = EHWSystemRole::Breaker;
        P.Skill1Cooldown = 5.f;
        P.Skill2Cooldown = 7.f;
        P.Skill3Cooldown = 11.f;
        P.Skill4Cooldown = 14.f;
        P.Skill1Stamina = 14.f;
        P.Skill2Stamina = 18.f;
        P.Skill3Stamina = 24.f;
        P.Skill4Stamina = 0.f;
        P.UniqueGainOnHit = 10.f;
        P.UltimateGainOnHit = 10.f;
        P.Skill1Multiplier = 2.0f;
        P.Skill2Multiplier = 0.f;
        P.Skill3Multiplier = 1.1f;
        P.Skill4Multiplier = 0.f;
        P.UltimateMultiplier = 5.2f;
    }
    else if (CharacterId == TEXT("sera"))
    {
        P.Role = EHWSystemRole::Support;
        P.Skill1Cooldown = 6.f;
        P.Skill2Cooldown = 9.f;
        P.Skill3Cooldown = 12.f;
        P.Skill4Cooldown = 15.f;
        P.Skill1Stamina = 14.f;
        P.Skill2Stamina = 16.f;
        P.Skill3Stamina = 26.f;
        P.Skill4Stamina = 0.f;
        P.UniqueGainOnHit = 7.f;
        P.UltimateGainOnHit = 11.f;
        P.Skill1Multiplier = 1.9f;
        P.Skill2Multiplier = 0.f;
        P.Skill3Multiplier = 1.3f;
        P.Skill4Multiplier = 0.f;
        P.UltimateMultiplier = 5.0f;
    }
    return P;
}

FHWSystemDungeonDefinition UHWSystemRulesLibrary::DungeonDefinition(FName DungeonId)
{
    FHWSystemDungeonDefinition D;
    D.DungeonId = DungeonId;

    auto Add = [&D](const TCHAR* Id, EHWRoomType Type, int32 Enemies, int32 Elites, bool Checkpoint, float TimeLimit = 0.f)
    {
        FHWSystemDungeonRoom R;
        R.Id = Id;
        R.Type = Type;
        R.EnemyCount = Enemies;
        R.EliteCount = Elites;
        R.bCheckpoint = Checkpoint;
        R.TimeLimit = TimeLimit;
        D.Rooms.Add(R);
    };

    if (DungeonId == TEXT("d01") || DungeonId == TEXT("tutorial"))
    {
        D.ReviveTokens = 3;
        Add(TEXT("training"), EHWRoomType::Combat, 2, 0, true);
        Add(TEXT("boss"), EHWRoomType::Boss, 0, 0, true);
    }
    else if (DungeonId == TEXT("marsh"))
    {
        D.ReviveTokens = 2;
        Add(TEXT("approach"), EHWRoomType::Combat, 3, 0, false);
        Add(TEXT("stalker_pack"), EHWRoomType::Combat, 4, 0, true);
        Add(TEXT("elite"), EHWRoomType::Elite, 2, 1, true);
        Add(TEXT("morbus"), EHWRoomType::Boss, 0, 0, true);
    }
    else if (DungeonId == TEXT("sewage"))
    {
        D.ReviveTokens = 2;
        Add(TEXT("inlet"), EHWRoomType::Combat, 4, 0, false);
        Add(TEXT("valves"), EHWRoomType::Objective, 3, 0, true);
        Add(TEXT("purifier"), EHWRoomType::Elite, 2, 1, true);
        Add(TEXT("core"), EHWRoomType::Boss, 0, 0, true);
    }
    else if (DungeonId == TEXT("relay"))
    {
        D.ReviveTokens = 2;
        Add(TEXT("switchyard"), EHWRoomType::Combat, 4, 0, false);
        Add(TEXT("capacitors"), EHWRoomType::Objective, 4, 0, true);
        Add(TEXT("relay_elite"), EHWRoomType::Elite, 2, 1, true);
        Add(TEXT("relay_core"), EHWRoomType::Boss, 0, 0, true);
    }
    else
    {
        D.ReviveTokens = 2;
        Add(TEXT("room_1"), EHWRoomType::Combat, 3, 0, false);
        Add(TEXT("room_2"), EHWRoomType::Elite, 2, 1, true);
        Add(TEXT("boss"), EHWRoomType::Boss, 0, 0, true);
    }

    return D;
}

float UHWSystemRulesLibrary::DifficultyHealthScale(EHWSystemDifficulty Difficulty)
{
    switch (Difficulty)
    {
        case EHWSystemDifficulty::Hard: return 1.55f;
        case EHWSystemDifficulty::Nightmare: return 2.20f;
        default: return 1.f;
    }
}

float UHWSystemRulesLibrary::DifficultyDamageScale(EHWSystemDifficulty Difficulty)
{
    switch (Difficulty)
    {
        case EHWSystemDifficulty::Hard: return 1.30f;
        case EHWSystemDifficulty::Nightmare: return 1.70f;
        default: return 1.f;
    }
}
