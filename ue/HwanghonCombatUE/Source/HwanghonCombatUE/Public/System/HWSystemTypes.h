#pragma once

#include "CoreMinimal.h"
#include "HWSystemTypes.generated.h"

UENUM(BlueprintType)
enum class EHWSystemRole : uint8
{
    Damage,
    Breaker,
    Bruiser,
    Support
};

UENUM(BlueprintType)
enum class EHWAbilitySlot : uint8
{
    Skill1,
    Skill2,
    Skill3,
    Skill4,
    Ultimate
};

UENUM(BlueprintType)
enum class EHWSystemDungeonState : uint8
{
    Idle,
    RoomIntro,
    Combat,
    RoomClear,
    Boss,
    Complete,
    Failed
};

UENUM(BlueprintType)
enum class EHWRoomType : uint8
{
    Combat,
    Elite,
    Objective,
    Rest,
    Boss
};

UENUM(BlueprintType)
enum class EHWSystemDifficulty : uint8
{
    Normal,
    Hard,
    Nightmare
};

USTRUCT(BlueprintType)
struct FHWAbilityRuntime
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    float CooldownRemaining = 0.f;
};

USTRUCT(BlueprintType)
struct FHWCharacterRuntimeState
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FName CharacterId = NAME_None;

    UPROPERTY(BlueprintReadOnly)
    float UniqueGauge = 0.f;

    UPROPERTY(BlueprintReadOnly)
    FHWAbilityRuntime Skill1;

    UPROPERTY(BlueprintReadOnly)
    FHWAbilityRuntime Skill2;

    UPROPERTY(BlueprintReadOnly)
    FHWAbilityRuntime Skill3;

    UPROPERTY(BlueprintReadOnly)
    FHWAbilityRuntime Skill4;

    UPROPERTY(BlueprintReadOnly)
    FHWAbilityRuntime Ultimate;
};

USTRUCT(BlueprintType)
struct FHWCharacterSystemProfile
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FName CharacterId = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    EHWSystemRole Role = EHWSystemRole::Damage;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float BaseHealth = 24450.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float BaseAttack = 2980.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float BaseDefense = 1780.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float CritChancePercent = 18.2f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float CritDamagePercent = 142.6f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float AttackSpeedPercent = 112.5f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float MoveSpeedPercent = 105.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float MaxUniqueGauge = 100.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Skill1Cooldown = 6.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Skill1Stamina = 15.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Skill2Cooldown = 12.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Skill2Stamina = 0.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Skill3Cooldown = 11.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Skill3Stamina = 24.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Skill4Cooldown = 14.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Skill4Stamina = 0.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float UltimateGaugeCost = 100.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float UltimateGainOnHit = 8.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float UniqueGainOnHit = 7.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Skill1Multiplier = 1.6f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Skill2Multiplier = 0.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Skill3Multiplier = 1.4f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Skill4Multiplier = 0.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float UltimateMultiplier = 4.2f;

};

USTRUCT(BlueprintType)
struct FHWBossPartRuntime
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    FName Id = NAME_None;

    UPROPERTY(BlueprintReadOnly)
    float Health = 0.f;

    UPROPERTY(BlueprintReadOnly)
    float MaxHealth = 0.f;

    UPROPERTY(BlueprintReadOnly)
    bool bBroken = false;
};

USTRUCT(BlueprintType)
struct FHWSystemDungeonRoom
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FName Id = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    EHWRoomType Type = EHWRoomType::Combat;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    int32 EnemyCount = 0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    int32 EliteCount = 0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    bool bCheckpoint = false;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float TimeLimit = 0.f;
};

USTRUCT(BlueprintType)
struct FHWSystemDungeonDefinition
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FName DungeonId = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<FHWSystemDungeonRoom> Rooms;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    int32 ReviveTokens = 2;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float EnrageSeconds = 180.f;

    // The boss room's body (a HWCharacterVisualSettings id such as boss_shadow_fang): it brings its designed
    // skills (Content/Data/boss_skills.json, docs/design/181 §10). None = the stand-in training boss.
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FName BossBody = NAME_None;
};
