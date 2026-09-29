#include "HHDungeonOnlineGameMode.h"
#include "HHShelterHUD.h"
#include "HHShelterOnlinePlayerController.h"
#include "HHShelterOnlinePlayerState.h"

#include "Dom/JsonObject.h"
#include "GameFramework/GameSession.h"   // UE 5.8 path (HwanghonCombatUE)
#include "GameFramework/GameStateBase.h"
#include "HttpModule.h"
#include "Interfaces/IHttpResponse.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "TimerManager.h"

AHHDungeonOnlineGameMode::AHHDungeonOnlineGameMode()
{
    PlayerControllerClass = AHHShelterOnlinePlayerController::StaticClass();
    PlayerStateClass = AHHShelterOnlinePlayerState::StaticClass();
    HUDClass = AHHShelterHUD::StaticClass();

    bStartPlayersAsSpectators = true;
}

void AHHDungeonOnlineGameMode::BeginPlay()
{
    Super::BeginPlay();
    if (GameSession) GameSession->MaxPlayers = DungeonCapacity;
    if (GetNetMode() == NM_DedicatedServer) StartHeartbeat();
}

FString AHHDungeonOnlineGameMode::InitNewPlayer(
    APlayerController* NewPlayerController,
    const FUniqueNetIdRepl& UniqueId,
    const FString& Options,
    const FString& Portal)
{
    const FString Error = Super::InitNewPlayer(NewPlayerController, UniqueId, Options, Portal);
    if (!Error.IsEmpty()) return Error;

    const FString JoinToken = UGameplayStatics::ParseOption(Options, TEXT("JoinToken"));
    PendingJoinTokens.Add(NewPlayerController, JoinToken);
    return FString();
}

void AHHDungeonOnlineGameMode::PostLogin(APlayerController* NewPlayer)
{
    Super::PostLogin(NewPlayer);

    FString Token;
    if (FString* Found = PendingJoinTokens.Find(NewPlayer))
    {
        Token = *Found;
        PendingJoinTokens.Remove(NewPlayer);
    }
    ValidateTicket(NewPlayer, Token);
}

UClass* AHHDungeonOnlineGameMode::GetDefaultPawnClassForController_Implementation(AController* InController)
{
    const APlayerController* PC = Cast<APlayerController>(InController);
    const AHHShelterOnlinePlayerState* PS = PC ? PC->GetPlayerState<AHHShelterOnlinePlayerState>() : nullptr;

    if (PS)
    {
        if (const TSoftClassPtr<APawn>* SoftPawn = CharacterPawnClasses.Find(PS->SelectedCharacterId))
        {
            if (UClass* Loaded = SoftPawn->LoadSynchronous()) return Loaded;
        }
    }
    return Super::GetDefaultPawnClassForController_Implementation(InController);
}

void AHHDungeonOnlineGameMode::ValidateTicket(APlayerController* PC, const FString& Token)
{
    if (!PC || Token.IsEmpty())
    {
        if (GameSession) GameSession->KickPlayer(PC, FText::FromString(TEXT("던전 입장권이 없습니다.")));
        return;
    }

    TSharedRef<FJsonObject> Root = MakeShared<FJsonObject>();
    Root->SetStringField(TEXT("token"), Token);
    Root->SetStringField(TEXT("instanceId"), InstanceId);

    FString Json;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Json);
    FJsonSerializer::Serialize(Root, Writer);

    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Req = FHttpModule::Get().CreateRequest();
    Req->SetURL(MatchmakerBaseUrl / TEXT("internal/dungeon-tickets/consume"));
    Req->SetVerb(TEXT("POST"));
    Req->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
    Req->SetHeader(TEXT("X-Instance-Secret"), InstanceSecret);
    Req->SetContentAsString(Json);

    TWeakObjectPtr<APlayerController> WeakPC(PC);
    Req->OnProcessRequestComplete().BindUObject(
        this,
        &AHHDungeonOnlineGameMode::HandleTicketValidation,
        WeakPC
    );
    Req->ProcessRequest();
}

void AHHDungeonOnlineGameMode::HandleTicketValidation(
    FHttpRequestPtr Request,
    FHttpResponsePtr Response,
    bool bSucceeded,
    TWeakObjectPtr<APlayerController> PC)
{
    if (!PC.IsValid()) return;

    const bool bValid = bSucceeded && Response.IsValid()
        && Response->GetResponseCode() >= 200
        && Response->GetResponseCode() < 300;

    if (!bValid)
    {
        if (GameSession) GameSession->KickPlayer(PC.Get(), FText::FromString(TEXT("유효하지 않거나 만료된 던전 입장권입니다.")));
        return;
    }

    TSharedPtr<FJsonObject> Root;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response->GetContentAsString());
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
    {
        if (GameSession) GameSession->KickPlayer(PC.Get(), FText::FromString(TEXT("던전 입장 검증 응답 오류")));
        return;
    }

    AHHShelterOnlinePlayerState* PS = PC->GetPlayerState<AHHShelterOnlinePlayerState>();
    if (!PS) return;

    FString AccountId, Character, PartyId, MissionId, LeaderAccountId, OriginShelterInstanceId;
    bool bLeader = false;

    Root->TryGetStringField(TEXT("accountId"), AccountId);
    Root->TryGetStringField(TEXT("character"), Character);
    Root->TryGetStringField(TEXT("partyId"), PartyId);
    Root->TryGetStringField(TEXT("missionId"), MissionId);
    Root->TryGetStringField(TEXT("leaderAccountId"), LeaderAccountId);
    Root->TryGetStringField(TEXT("originShelterInstanceId"), OriginShelterInstanceId);
    Root->TryGetBoolField(TEXT("partyLeader"), bLeader);

    PS->AccountId = AccountId;
    PS->SelectedCharacterId = FName(*Character);
    PS->PartyId = PartyId;
    PS->bPartyLeader = bLeader;
    PS->bPartyReady = true;
    PS->SelectedMissionId = FName(*MissionId);
    PS->OriginShelterInstanceId = OriginShelterInstanceId;
    PS->bAdmissionValidated = true;
    PS->ForceNetUpdate();

    if (!MissionId.IsEmpty()) RuntimeMissionId = FName(*MissionId);
    if (!OriginShelterInstanceId.IsEmpty()) RuntimeOriginShelterInstanceId = OriginShelterInstanceId;

    RestartPlayer(PC.Get());
}

void AHHDungeonOnlineGameMode::CompleteDungeonRun()
{
    if (bReturnAllocationInFlight || !GetGameState<AGameStateBase>()) return;

    TArray<AHHShelterOnlinePlayerState*> Members;
    FString PartyId;
    FString LeaderAccountId;

    for (APlayerState* BasePS : GetGameState<AGameStateBase>()->PlayerArray)
    {
        AHHShelterOnlinePlayerState* PS = Cast<AHHShelterOnlinePlayerState>(BasePS);
        if (!PS || !PS->bAdmissionValidated) continue;

        Members.Add(PS);
        if (PartyId.IsEmpty()) PartyId = PS->PartyId;
        if (PS->bPartyLeader) LeaderAccountId = PS->AccountId;
    }

    if (Members.IsEmpty()) return;
    if (PartyId.IsEmpty()) PartyId = TEXT("solo-return");
    if (LeaderAccountId.IsEmpty()) LeaderAccountId = Members[0]->AccountId;

    TSharedRef<FJsonObject> Root = MakeShared<FJsonObject>();
    Root->SetStringField(TEXT("partyId"), PartyId);
    Root->SetStringField(TEXT("leaderAccountId"), LeaderAccountId);
    Root->SetStringField(TEXT("missionId"), RuntimeMissionId.ToString());
    Root->SetStringField(TEXT("preferredShelterInstanceId"), RuntimeOriginShelterInstanceId);

    TArray<TSharedPtr<FJsonValue>> MembersJson;
    for (AHHShelterOnlinePlayerState* PS : Members)
    {
        TSharedRef<FJsonObject> M = MakeShared<FJsonObject>();
        M->SetStringField(TEXT("accountId"), PS->AccountId);
        M->SetStringField(TEXT("character"), PS->SelectedCharacterId.ToString().ToLower());
        M->SetBoolField(TEXT("leader"), PS->AccountId == LeaderAccountId);
        MembersJson.Add(MakeShared<FJsonValueObject>(M));
    }
    Root->SetArrayField(TEXT("members"), MembersJson);

    FString Json;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Json);
    FJsonSerializer::Serialize(Root, Writer);

    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Req = FHttpModule::Get().CreateRequest();
    Req->SetURL(MatchmakerBaseUrl / TEXT("v1/match/return-shelter"));
    Req->SetVerb(TEXT("POST"));
    Req->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
    Req->SetHeader(TEXT("X-Instance-Secret"), InstanceSecret);   // server-to-server only (HwanghonCombatUE)
    Req->SetContentAsString(Json);
    Req->OnProcessRequestComplete().BindUObject(
        this,
        &AHHDungeonOnlineGameMode::HandleReturnShelterAllocation
    );

    bReturnAllocationInFlight = Req->ProcessRequest();

    for (AHHShelterOnlinePlayerState* PS : Members)
    {
        if (AHHShelterOnlinePlayerController* PC = Cast<AHHShelterOnlinePlayerController>(PS->GetOwner()))
        {
            PC->ClientPartyMessage(TEXT("던전 결과 확정 · 쉘터 귀환 준비"));
        }
    }
}

void AHHDungeonOnlineGameMode::HandleReturnShelterAllocation(
    FHttpRequestPtr Request,
    FHttpResponsePtr Response,
    bool bSucceeded)
{
    bReturnAllocationInFlight = false;

    if (!bSucceeded || !Response.IsValid() || Response->GetResponseCode() < 200 || Response->GetResponseCode() >= 300)
    {
        return;
    }

    TSharedPtr<FJsonObject> Root;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response->GetContentAsString());
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid()) return;

    FString Address;
    if (!Root->TryGetStringField(TEXT("address"), Address) || Address.IsEmpty()) return;

    const TSharedPtr<FJsonObject>* TicketsPtr = nullptr;
    if (!Root->TryGetObjectField(TEXT("tickets"), TicketsPtr) || !TicketsPtr || !TicketsPtr->IsValid()) return;

    TMap<FString, FString> Tickets;
    for (const auto& Pair : (*TicketsPtr)->Values)
    {
        FString Token;
        if (Pair.Value.IsValid() && Pair.Value->TryGetString(Token))
        {
            Tickets.Add(FString(Pair.Key), Token);   // UE 5.8: JSON keys are not FString (HwanghonCombatUE)
        }
    }

    if (!GetGameState<AGameStateBase>()) return;

    for (APlayerState* BasePS : GetGameState<AGameStateBase>()->PlayerArray)
    {
        AHHShelterOnlinePlayerState* PS = Cast<AHHShelterOnlinePlayerState>(BasePS);
        AHHShelterOnlinePlayerController* PC = PS ? Cast<AHHShelterOnlinePlayerController>(PS->GetOwner()) : nullptr;
        if (!PS || !PC) continue;

        if (const FString* Token = Tickets.Find(PS->AccountId))
        {
            PC->ClientTravelBackToShelter(Address, *Token, PS->SelectedCharacterId, PS->AccountId);
        }
    }
}

void AHHDungeonOnlineGameMode::StartHeartbeat()
{
    InstanceId = TEXT("dungeon-dev-01");
    AdvertisedAddress = TEXT("127.0.0.1:7780");
    InstanceSecret.Reset();   // HwanghonCombatUE: no built-in secret - a server without one never advertises itself

    FParse::Value(FCommandLine::Get(), TEXT("InstanceId="), InstanceId);
    FParse::Value(FCommandLine::Get(), TEXT("Advertise="), AdvertisedAddress);
    FParse::Value(FCommandLine::Get(), TEXT("Matchmaker="), MatchmakerBaseUrl);
    FParse::Value(FCommandLine::Get(), TEXT("InstanceSecret="), InstanceSecret);
    if (InstanceSecret.IsEmpty() || InstanceSecret == TEXT("change-me"))
    {
        UE_LOG(LogTemp, Error, TEXT("[HHOnline] -InstanceSecret= missing or the placeholder: not registering with the matchmaker"));
        return;
    }

    FString MissionArg;
    if (FParse::Value(FCommandLine::Get(), TEXT("Mission="), MissionArg) && !MissionArg.IsEmpty())
    {
        RuntimeMissionId = FName(*MissionArg);
    }

    SendHeartbeat();
    GetWorldTimerManager().SetTimer(HeartbeatTimer, this, &AHHDungeonOnlineGameMode::SendHeartbeat, 5.f, true);
}

void AHHDungeonOnlineGameMode::SendHeartbeat()
{
    TSharedRef<FJsonObject> Root = MakeShared<FJsonObject>();
    Root->SetStringField(TEXT("instanceId"), InstanceId);
    Root->SetStringField(TEXT("address"), AdvertisedAddress);
    Root->SetStringField(TEXT("kind"), TEXT("dungeon"));
    Root->SetStringField(TEXT("map"), TEXT("dungeon"));
    Root->SetStringField(TEXT("missionId"), RuntimeMissionId.ToString());
    Root->SetNumberField(TEXT("players"), GetNumPlayers());
    Root->SetNumberField(TEXT("capacity"), DungeonCapacity);

    FString Json;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Json);
    FJsonSerializer::Serialize(Root, Writer);

    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Req = FHttpModule::Get().CreateRequest();
    Req->SetURL(MatchmakerBaseUrl / TEXT("internal/instances/heartbeat"));
    Req->SetVerb(TEXT("POST"));
    Req->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
    Req->SetHeader(TEXT("X-Instance-Secret"), InstanceSecret);
    Req->SetContentAsString(Json);
    Req->ProcessRequest();
}
