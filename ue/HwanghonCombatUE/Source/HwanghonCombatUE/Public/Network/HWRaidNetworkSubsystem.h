#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Containers/Ticker.h"
#include "HWRaidNetworkSubsystem.generated.h"

class IWebSocket;
class FJsonObject;
class FJsonValue;


USTRUCT(BlueprintType)
struct FHWNetProfile
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) FString Id;
    UPROPERTY(BlueprintReadOnly) FString Name;
    UPROPERTY(BlueprintReadOnly) FName Character = TEXT("ain");
    UPROPERTY(BlueprintReadOnly) bool bCharacterCreated = false;
    UPROPERTY(BlueprintReadOnly) int32 Level = 1;
};

USTRUCT(BlueprintType)
struct FHWRaidNetMember
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) FString Id;
    UPROPERTY(BlueprintReadOnly) FString Name;
    UPROPERTY(BlueprintReadOnly) FName Character = TEXT("ain");
    UPROPERTY(BlueprintReadOnly) bool bReady = false;
    UPROPERTY(BlueprintReadOnly) bool bConnected = false;
};

USTRUCT(BlueprintType)
struct FHWRaidNetSkillState
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) FString Name;
    UPROPERTY(BlueprintReadOnly) int32 Level = 1;
    UPROPERTY(BlueprintReadOnly) FString Branch;
    UPROPERTY(BlueprintReadOnly) float StaminaCost = 0.f;
    UPROPERTY(BlueprintReadOnly) float CooldownRemaining = 0.f;
};

USTRUCT(BlueprintType)
struct FHWRaidNetPlayer
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) FString Id;
    UPROPERTY(BlueprintReadOnly) FString Name;
    UPROPERTY(BlueprintReadOnly) FName Character = TEXT("ain");
    UPROPERTY(BlueprintReadOnly) float X = 0.f;
    UPROPERTY(BlueprintReadOnly) float Y = 0.f;
    UPROPERTY(BlueprintReadOnly) float Aim = 0.f;
    UPROPERTY(BlueprintReadOnly) float Hp = 0.f;
    UPROPERTY(BlueprintReadOnly) float MaxHp = 0.f;
    UPROPERTY(BlueprintReadOnly) float Stamina = 0.f;
    UPROPERTY(BlueprintReadOnly) float Ultimate = 0.f;
    UPROPERTY(BlueprintReadOnly) float DownTime = 0.f;
    UPROPERTY(BlueprintReadOnly) float ReviveProgress = 0.f;
    UPROPERTY(BlueprintReadOnly) float RiposteTime = 0.f;
    UPROPERTY(BlueprintReadOnly) float Threat = 0.f;
    UPROPERTY(BlueprintReadOnly) float DamageDone = 0.f;
    UPROPERTY(BlueprintReadOnly) bool bGuarding = false;
    UPROPERTY(BlueprintReadOnly) bool bDead = false;
    UPROPERTY(BlueprintReadOnly) bool bConnected = false;
    UPROPERTY(BlueprintReadOnly) FName TargetPart = NAME_None;
    UPROPERTY(BlueprintReadOnly) FName ActionKind = NAME_None;
    UPROPERTY(BlueprintReadOnly) FName ActionClip = NAME_None;
    UPROPERTY(BlueprintReadOnly) float ActionElapsed = 0.f;
    UPROPERTY(BlueprintReadOnly) float ActionDuration = 0.f;
    UPROPERTY(BlueprintReadOnly) FName OpeningKind = NAME_None;
    UPROPERTY(BlueprintReadOnly) FName OpeningClip = NAME_None;
    UPROPERTY(BlueprintReadOnly) float OpeningRemaining = 0.f;
    UPROPERTY(BlueprintReadOnly) FString OpeningFrom;
    UPROPERTY(BlueprintReadOnly) TArray<FHWRaidNetSkillState> Skills;
    UPROPERTY(BlueprintReadOnly) FString UltimateName;
    UPROPERTY(BlueprintReadOnly) int32 UltimateLevel = 1;
};

USTRUCT(BlueprintType)
struct FHWRaidNetBossPart
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) FName Id = NAME_None;
    UPROPERTY(BlueprintReadOnly) FString Name;
    UPROPERTY(BlueprintReadOnly) float Hp = 0.f;
    UPROPERTY(BlueprintReadOnly) float MaxHp = 0.f;
    UPROPERTY(BlueprintReadOnly) bool bBroken = false;
    UPROPERTY(BlueprintReadOnly) bool bBreakable = false;
    UPROPERTY(BlueprintReadOnly) bool bWeak = false;
};

USTRUCT(BlueprintType)
struct FHWRaidNetBoss
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) float X = 0.f;
    UPROPERTY(BlueprintReadOnly) float Y = 0.f;
    UPROPERTY(BlueprintReadOnly) float Aim = 0.f;
    UPROPERTY(BlueprintReadOnly) float Hp = 0.f;
    UPROPERTY(BlueprintReadOnly) float MaxHp = 0.f;
    UPROPERTY(BlueprintReadOnly) float Posture = 0.f;
    UPROPERTY(BlueprintReadOnly) FName State = NAME_None;
    UPROPERTY(BlueprintReadOnly) FString Name;
    UPROPERTY(BlueprintReadOnly) FString PatternName;
    // `windup` from the server is normalized telegraph progress, not seconds.
    UPROPERTY(BlueprintReadOnly) float TelegraphProgress = 0.f;
    UPROPERTY(BlueprintReadOnly) float RecoveryRemaining = 0.f;
    UPROPERTY(BlueprintReadOnly) float RecoveryDuration = 0.f;
    UPROPERTY(BlueprintReadOnly) float LinkRemaining = 0.f;
    // Motion only (doc 132): the web clip key (hookL/slam/...) and the telegraph length in seconds.
    UPROPERTY(BlueprintReadOnly) FName PatternIcon = NAME_None;
    UPROPERTY(BlueprintReadOnly) float TeleDur = 0.f;
    UPROPERTY(BlueprintReadOnly) bool bPatternCounterable = false;
    UPROPERTY(BlueprintReadOnly) bool bExecutable = false;
    UPROPERTY(BlueprintReadOnly) TArray<FHWRaidNetBossPart> Parts;
};

USTRUCT(BlueprintType)
struct FHWRaidNetCheckpoint
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) FString Id;
    UPROPERTY(BlueprintReadOnly) float X = 0.f;
    UPROPERTY(BlueprintReadOnly) float Y = 0.f;
    UPROPERTY(BlueprintReadOnly) bool bValid = false;
};

USTRUCT(BlueprintType)
struct FHWRaidNetExpeditionNode
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) FName Id = NAME_None;
    UPROPERTY(BlueprintReadOnly) FName Kind = NAME_None;
    UPROPERTY(BlueprintReadOnly) FString Name;
    UPROPERTY(BlueprintReadOnly) float X = 0.f;
    UPROPERTY(BlueprintReadOnly) float Y = 0.f;
    UPROPERTY(BlueprintReadOnly) float Range = 110.f;
    UPROPERTY(BlueprintReadOnly) FName Objective = NAME_None;
    UPROPERTY(BlueprintReadOnly) bool bEnabled = false;
    UPROPERTY(BlueprintReadOnly) bool bDone = false;
    UPROPERTY(BlueprintReadOnly) bool bDiscovered = false;
};

USTRUCT(BlueprintType)
struct FHWRaidNetExpedition
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) int32 Version = 0;
    UPROPERTY(BlueprintReadOnly) FName LevelId = NAME_None;
    UPROPERTY(BlueprintReadOnly) FString ExpeditionId;
    UPROPERTY(BlueprintReadOnly) TArray<FName> Completed;
    UPROPERTY(BlueprintReadOnly) TArray<FName> Discovered;
    UPROPERTY(BlueprintReadOnly) TArray<FHWRaidNetExpeditionNode> Nodes;
    UPROPERTY(BlueprintReadOnly) FHWRaidNetCheckpoint Checkpoint;
    UPROPERTY(BlueprintReadOnly) bool bFinished = false;
};

USTRUCT(BlueprintType)
struct FHWRaidNetHazard
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) FName Id = NAME_None;
    UPROPERTY(BlueprintReadOnly) float X = 0.f;
    UPROPERTY(BlueprintReadOnly) float Y = 0.f;
    UPROPERTY(BlueprintReadOnly) float Radius = 0.f;
    UPROPERTY(BlueprintReadOnly) FName Phase = NAME_None;
    UPROPERTY(BlueprintReadOnly) bool bArenaHazard = false;
};

USTRUCT(BlueprintType)
struct FHWRaidNetGate
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) float X = 0.f;
    UPROPERTY(BlueprintReadOnly) float Y = 0.f;
    UPROPERTY(BlueprintReadOnly) bool bOpen = false;
    UPROPERTY(BlueprintReadOnly) bool bValid = false;
};

USTRUCT(BlueprintType)
struct FHWRaidNetEvent
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) int64 Id = 0;
    UPROPERTY(BlueprintReadOnly) FName Type = NAME_None;
    UPROPERTY(BlueprintReadOnly) float Time = 0.f;
    UPROPERTY(BlueprintReadOnly) FString PlayerId;
    UPROPERTY(BlueprintReadOnly) FName PartId = NAME_None;
    UPROPERTY(BlueprintReadOnly) FString Name;
    UPROPERTY(BlueprintReadOnly) FString Text;
    // Telegraph length in seconds ("dur"); telegraph events put the boss target in PlayerId.
    UPROPERTY(BlueprintReadOnly) float Duration = 0.f;
};

USTRUCT(BlueprintType)
struct FHWRaidNetSnapshot
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) FString RaidId;
    UPROPERTY(BlueprintReadOnly) FName LevelId = NAME_None;
    UPROPERTY(BlueprintReadOnly) FName State = NAME_None;
    UPROPERTY(BlueprintReadOnly) float Time = 0.f;
    UPROPERTY(BlueprintReadOnly) int32 Phase = 0;
    UPROPERTY(BlueprintReadOnly) int32 PhaseCount = 0;
    UPROPERTY(BlueprintReadOnly) float Reach = 0.f;
    UPROPERTY(BlueprintReadOnly) FHWRaidNetBoss Boss;
    UPROPERTY(BlueprintReadOnly) TArray<FHWRaidNetPlayer> Players;
    UPROPERTY(BlueprintReadOnly) FHWRaidNetExpedition Expedition;
    UPROPERTY(BlueprintReadOnly) TArray<FHWRaidNetHazard> Hazards;
    UPROPERTY(BlueprintReadOnly) FHWRaidNetGate Gate;
    UPROPERTY(BlueprintReadOnly) TArray<FHWRaidNetEvent> Events;
    UPROPERTY(BlueprintReadOnly) bool bHasResult = false;
    UPROPERTY(BlueprintReadOnly) FString RewardStatus;
};

USTRUCT(BlueprintType)
struct FHWPartyNetSnapshot
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) int32 Protocol = 0;
    UPROPERTY(BlueprintReadOnly) FString Code;
    UPROPERTY(BlueprintReadOnly) FString LeaderId;
    UPROPERTY(BlueprintReadOnly) FName LevelId = NAME_None;
    UPROPERTY(BlueprintReadOnly) FString Purpose;
    UPROPERTY(BlueprintReadOnly) bool bTraining = false;
    UPROPERTY(BlueprintReadOnly) TArray<FHWRaidNetMember> Members;
    UPROPERTY(BlueprintReadOnly) bool bHasRaid = false;
    UPROPERTY(BlueprintReadOnly) FHWRaidNetSnapshot Raid;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWNetConnectionSignature, bool, bConnected);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHWNetWelcomeSignature, FString, PlayerId, FString, SessionToken);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWNetProfileSignature, FHWNetProfile, Profile);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWNetRoomSignature, FHWPartyNetSnapshot, Room);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWNetRaidSignature, FHWRaidNetSnapshot, Raid);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWNetRaidEventSignature, FHWRaidNetEvent, Event);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWNetErrorSignature, FString, Error);

UCLASS()
class HWANGHONCOMBATUE_API UHWRaidNetworkSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

    UPROPERTY(BlueprintAssignable) FHWNetConnectionSignature OnConnectionChanged;
    UPROPERTY(BlueprintAssignable) FHWNetWelcomeSignature OnWelcome;
    UPROPERTY(BlueprintAssignable) FHWNetProfileSignature OnProfileChanged;
    UPROPERTY(BlueprintAssignable) FHWNetRoomSignature OnRoomStateChanged;
    UPROPERTY(BlueprintAssignable) FHWNetRaidSignature OnRaidSnapshot;
    UPROPERTY(BlueprintAssignable) FHWNetRaidEventSignature OnRaidEvent;
    UPROPERTY(BlueprintAssignable) FHWNetErrorSignature OnNetworkError;

    UFUNCTION(BlueprintCallable) bool Connect(const FString& ServerBaseUrl, const FString& SessionToken, const FString& DisplayName);
    UFUNCTION(BlueprintCallable) void Disconnect();
    UFUNCTION(BlueprintPure) bool IsConnected() const { return bConnected; }
    UFUNCTION(BlueprintPure) bool IsRaidActive() const;
    UFUNCTION(BlueprintPure) FString GetPlayerId() const { return PlayerId; }
    UFUNCTION(BlueprintPure) FString GetSessionToken() const { return Token; }
    UFUNCTION(BlueprintPure) FHWNetProfile GetProfile() const { return Profile; }
    UFUNCTION(BlueprintPure) FHWPartyNetSnapshot GetRoom() const { return Room; }
    UFUNCTION(BlueprintCallable) void SetAutoReconnect(bool bEnabled) { bAutoReconnect = bEnabled; }
    UFUNCTION(BlueprintPure) int32 GetReconnectAttempts() const { return ReconnectAttempts; }

    UFUNCTION(BlueprintCallable) void SetPendingCharacterCreation(const FString& CharacterName, FName CharacterId);
    UFUNCTION(BlueprintCallable) bool CreateCharacter(const FString& CharacterName, FName CharacterId);
    UFUNCTION(BlueprintCallable) bool CreateRoom(FName LevelId, bool bPublic = true, FString Purpose = TEXT("first"), int32 MinPower = 0);
    UFUNCTION(BlueprintCallable) bool JoinRoom(const FString& Code);
    UFUNCTION(BlueprintCallable) bool LeaveRoom();
    UFUNCTION(BlueprintCallable) bool SetReady(bool bReady);
    UFUNCTION(BlueprintCallable) bool StartRaid();
    UFUNCTION(BlueprintCallable) bool RetryRaid();
    UFUNCTION(BlueprintCallable) bool ReturnToLobby();

    UFUNCTION(BlueprintCallable) bool SendMove(float X, float Y);
    UFUNCTION(BlueprintCallable) bool SendTarget(FName PartId);
    UFUNCTION(BlueprintCallable) bool SendAttack();
    UFUNCTION(BlueprintCallable) bool SendSmash();
    UFUNCTION(BlueprintCallable) bool SendDodge();
    UFUNCTION(BlueprintCallable) bool SendJump();
    UFUNCTION(BlueprintCallable) bool SendCounter();
    UFUNCTION(BlueprintCallable) bool SendGuard(bool bOn);
    UFUNCTION(BlueprintCallable) bool SendRevive(bool bOn);
    UFUNCTION(BlueprintCallable) bool SendInteract();
    UFUNCTION(BlueprintCallable) bool SendSkill(int32 Index);
    UFUNCTION(BlueprintCallable) bool SendUltimate();
    UFUNCTION(BlueprintCallable) bool SendExecute();
    UFUNCTION(BlueprintCallable) bool SendOpening();

private:
    void HandleConnected();
    void HandleConnectionError(const FString& Error);
    void HandleClosed(int32 Status, const FString& Reason, bool bWasClean);
    void HandleMessage(const FString& Message);
    void ScheduleReconnect();
    bool TickReconnect(float DeltaSeconds);

    bool SendObject(const TSharedRef<FJsonObject>& Object);
    bool SendSimple(const TCHAR* Type);
    bool SendIntent(const TCHAR* Type);
    void SendHello();

    void AcceptFullState(const TSharedPtr<FJsonObject>& Root);
    void AcceptPatch(const TSharedPtr<FJsonObject>& Patch);
    void ParseRoomState();
    void ParseProfile(const TSharedPtr<FJsonObject>& Object);

    static TSharedPtr<FJsonValue> ApplyPatchValue(
        const TSharedPtr<FJsonValue>& Before,
        const TSharedPtr<FJsonValue>& Patch);

    static double ReadNumber(const TSharedPtr<FJsonObject>& O, const TCHAR* Key, double Default = 0.0);
    static bool ReadBool(const TSharedPtr<FJsonObject>& O, const TCHAR* Key, bool Default = false);

    TSharedPtr<IWebSocket> Socket;
    TSharedPtr<FJsonObject> WireState;

    FString Endpoint;
    FString Token;
    FString DisplayName;
    FString PlayerId;
    int64 Sequence = 0;
    bool bConnected = false;
    bool bManualDisconnect = false;
    bool bAutoReconnect = true;
    int32 ReconnectAttempts = 0;
    int32 MaxReconnectAttempts = 8;
    float ReconnectDelay = 1.5f;
    FTSTicker::FDelegateHandle ReconnectTickerHandle;

    FHWNetProfile Profile;
    FString PendingCharacterName;
    FName PendingCharacterId = NAME_None;
    FHWPartyNetSnapshot Room;
    FString LastRaidId;
    int64 LastEventId = 0;
};
