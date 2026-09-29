#include "HHShelterOnlineGameMode.h"
#include "HHDeploymentGate.h"
#include "HHShelterHUD.h"
#include "HHShelterOnlinePlayerController.h"
#include "HHShelterOnlinePlayerState.h"

#include "Dom/JsonObject.h"
#include "GameFramework/GameSession.h"   // UE 5.8 path (HwanghonCombatUE)
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerStart.h"
#include "HttpModule.h"
#include "Interfaces/IHttpResponse.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/CommandLine.h"
#include "Misc/Guid.h"
#include "Misc/Parse.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "TimerManager.h"
#include "EngineUtils.h"

AHHShelterOnlineGameMode::AHHShelterOnlineGameMode()
{
    PlayerControllerClass = AHHShelterOnlinePlayerController::StaticClass();
    PlayerStateClass = AHHShelterOnlinePlayerState::StaticClass();
    HUDClass = AHHShelterHUD::StaticClass();

    // Admission ticket must be validated before a gameplay pawn is spawned.
    bStartPlayersAsSpectators = true;
}

bool AHHShelterOnlineGameMode::IsAllowedCharacter(FName Id) const
{
    const FString S = Id.ToString().ToLower();
    return S == TEXT("ain") || S == TEXT("kain") || S == TEXT("ryu") || S == TEXT("sera");
}

FString AHHShelterOnlineGameMode::NewPartyId() const
{
    return FGuid::NewGuid().ToString(EGuidFormats::DigitsWithHyphensLower);
}

void AHHShelterOnlineGameMode::BeginPlay()
{
    Super::BeginPlay();

    if (GameSession) GameSession->MaxPlayers = ShelterCapacity;

    bAllowDevAdmission = FParse::Param(FCommandLine::Get(), TEXT("AllowDevAdmission"));

    if (GetNetMode() == NM_DedicatedServer)
    {
        StartHeartbeat();
    }
}

FString AHHShelterOnlineGameMode::InitNewPlayer(
    APlayerController* NewPlayerController,
    const FUniqueNetIdRepl& UniqueId,
    const FString& Options,
    const FString& Portal)
{
    const FString Error = Super::InitNewPlayer(NewPlayerController, UniqueId, Options, Portal);
    if (!Error.IsEmpty()) return Error;

    const FString Character = UGameplayStatics::ParseOption(Options, TEXT("Character")).ToLower();
    const FString AccountId = UGameplayStatics::ParseOption(Options, TEXT("AccountId"));
    const FString JoinToken = UGameplayStatics::ParseOption(Options, TEXT("JoinToken"));

    if (AHHShelterOnlinePlayerState* PS = NewPlayerController ? NewPlayerController->GetPlayerState<AHHShelterOnlinePlayerState>() : nullptr)
    {
        PS->SelectedCharacterId = IsAllowedCharacter(FName(*Character)) ? FName(*Character) : FName(TEXT("ain"));
        PS->AccountId = AccountId;
        PS->bAdmissionValidated = false;
        PS->ForceNetUpdate();
    }

    PendingAdmissionTokens.Add(NewPlayerController, JoinToken);
    return FString();
}

void AHHShelterOnlineGameMode::PostLogin(APlayerController* NewPlayer)
{
    Super::PostLogin(NewPlayer);

    if (!NewPlayer) return;
    NewPlayer->SetNetSpeed(40000);

    FString Token;
    if (FString* Found = PendingAdmissionTokens.Find(NewPlayer))
    {
        Token = *Found;
        PendingAdmissionTokens.Remove(NewPlayer);
    }

    if (bAllowDevAdmission && Token == TEXT("DEV"))
    {
        if (AHHShelterOnlinePlayerState* PS = NewPlayer->GetPlayerState<AHHShelterOnlinePlayerState>())
        {
            PS->ShelterSpawnPoint = TEXT("TownStart");
            PS->OriginShelterInstanceId = InstanceId;
            PS->AdmissionSource = TEXT("dev");
            PS->bAdmissionValidated = true;
            PS->ForceNetUpdate();
        }
        RestartPlayer(NewPlayer);
        return;
    }

    ValidateShelterAdmission(NewPlayer, Token);
}

void AHHShelterOnlineGameMode::ValidateShelterAdmission(APlayerController* PC, const FString& Token)
{
    if (!PC || Token.IsEmpty())
    {
        if (GameSession) GameSession->KickPlayer(PC, FText::FromString(TEXT("쉘터 입장권이 없습니다.")));
        return;
    }

    TSharedRef<FJsonObject> Root = MakeShared<FJsonObject>();
    Root->SetStringField(TEXT("token"), Token);
    Root->SetStringField(TEXT("instanceId"), InstanceId);

    FString Json;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Json);
    FJsonSerializer::Serialize(Root, Writer);

    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Req = FHttpModule::Get().CreateRequest();
    Req->SetURL(MatchmakerBaseUrl / TEXT("internal/shelter-tickets/consume"));
    Req->SetVerb(TEXT("POST"));
    Req->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
    Req->SetHeader(TEXT("X-Instance-Secret"), InstanceSecret);
    Req->SetContentAsString(Json);

    TWeakObjectPtr<APlayerController> WeakPC(PC);
    Req->OnProcessRequestComplete().BindUObject(
        this,
        &AHHShelterOnlineGameMode::HandleShelterAdmissionResponse,
        WeakPC
    );
    Req->ProcessRequest();
}

void AHHShelterOnlineGameMode::HandleShelterAdmissionResponse(
    FHttpRequestPtr Request,
    FHttpResponsePtr Response,
    bool bSucceeded,
    TWeakObjectPtr<APlayerController> PlayerController)
{
    if (!PlayerController.IsValid()) return;

    const bool bValid = bSucceeded && Response.IsValid()
        && Response->GetResponseCode() >= 200
        && Response->GetResponseCode() < 300;

    if (!bValid)
    {
        if (GameSession) GameSession->KickPlayer(PlayerController.Get(), FText::FromString(TEXT("유효하지 않거나 만료된 쉘터 입장권입니다.")));
        return;
    }

    TSharedPtr<FJsonObject> Root;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response->GetContentAsString());
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
    {
        if (GameSession) GameSession->KickPlayer(PlayerController.Get(), FText::FromString(TEXT("쉘터 입장 검증 응답 오류")));
        return;
    }

    AHHShelterOnlinePlayerState* PS = PlayerController->GetPlayerState<AHHShelterOnlinePlayerState>();
    if (!PS) return;

    FString AccountId;
    FString Character;
    FString PartyId;
    FString LeaderAccountId;
    FString SpawnPoint;
    FString OriginShelterInstanceId;
    FString AdmissionSource;
    bool bLeader = false;

    Root->TryGetStringField(TEXT("accountId"), AccountId);
    Root->TryGetStringField(TEXT("character"), Character);
    Root->TryGetStringField(TEXT("partyId"), PartyId);
    Root->TryGetStringField(TEXT("leaderAccountId"), LeaderAccountId);
    Root->TryGetStringField(TEXT("spawnPoint"), SpawnPoint);
    Root->TryGetStringField(TEXT("originShelterInstanceId"), OriginShelterInstanceId);
    Root->TryGetStringField(TEXT("source"), AdmissionSource);
    Root->TryGetBoolField(TEXT("partyLeader"), bLeader);

    if (!AccountId.IsEmpty()) PS->AccountId = AccountId;
    if (IsAllowedCharacter(FName(*Character))) PS->SelectedCharacterId = FName(*Character);

    PS->PartyId = PartyId;
    PS->bPartyLeader = bLeader;
    PS->bPartyReady = false;
    PS->ShelterSpawnPoint = SpawnPoint.IsEmpty() ? FName(TEXT("TownStart")) : FName(*SpawnPoint);
    PS->OriginShelterInstanceId = OriginShelterInstanceId.IsEmpty() ? InstanceId : OriginShelterInstanceId;
    PS->AdmissionSource = AdmissionSource;
    PS->bAdmissionValidated = true;
    PS->ForceNetUpdate();

    if (!PartyId.IsEmpty())
    {
        RestorePartyFromAdmission(PS, LeaderAccountId);
    }

    RestartPlayer(PlayerController.Get());
}

void AHHShelterOnlineGameMode::RestorePartyFromAdmission(AHHShelterOnlinePlayerState* PS, const FString& LeaderAccountId)
{
    if (!PS || PS->PartyId.IsEmpty()) return;

    FHHPartyRuntime* Party = Parties.Find(PS->PartyId);
    if (!Party)
    {
        FHHPartyRuntime NewParty;
        NewParty.PartyId = PS->PartyId;
        NewParty.LeaderAccountId = LeaderAccountId;
        NewParty.Members.Add(PS);
        Parties.Add(NewParty.PartyId, NewParty);
        Party = Parties.Find(PS->PartyId);
    }
    else
    {
        Party->Members.AddUnique(PS);
        if (Party->LeaderAccountId.IsEmpty()) Party->LeaderAccountId = LeaderAccountId;
    }

    NormalizeParty(*Party);
}


AActor* AHHShelterOnlineGameMode::ChoosePlayerStart_Implementation(AController* Player)
{
    const AHHShelterOnlinePlayerState* PS = Player ? Player->GetPlayerState<AHHShelterOnlinePlayerState>() : nullptr;
    const FName DesiredTag = (PS && PS->ShelterSpawnPoint == TEXT("ManpowerOfficeReturn"))
        ? FName(TEXT("HH_ManpowerOffice_Return"))
        : FName(TEXT("HH_TownStart"));

    APlayerStart* FallbackStart = nullptr;

    for (TActorIterator<APlayerStart> It(GetWorld()); It; ++It)
    {
        APlayerStart* Start = *It;
        if (!FallbackStart) FallbackStart = Start;

        if (Start->PlayerStartTag == DesiredTag)
        {
            return Start;
        }
    }

    return FallbackStart ? FallbackStart : Super::ChoosePlayerStart_Implementation(Player);
}

void AHHShelterOnlineGameMode::RestartPlayer(AController* NewPlayer)
{
    AHHShelterOnlinePlayerState* PS = NewPlayer ? NewPlayer->GetPlayerState<AHHShelterOnlinePlayerState>() : nullptr;
    if (!PS || !PS->bAdmissionValidated) return;

    Super::RestartPlayer(NewPlayer);

    if (APawn* Pawn = NewPlayer->GetPawn())
    {
        // HwanghonCombatUE: no SetReplicates(true) here - APawn::PossessedBy already made it replicate and gave the
        // owning client AutonomousProxy; UE 5.8 SetReplicates(true) resets RemoteRole to SimulatedProxy, and no
        // remote player could move (engine Actor.cpp AActor::SetReplicates, measured: client pawn role 1)
        Pawn->SetReplicateMovement(true);
        Pawn->SetNetUpdateFrequency(20.f);
        Pawn->SetMinNetUpdateFrequency(5.f);
        Pawn->SetNetCullDistanceSquared(FMath::Square(5000.f));
    }
}

void AHHShelterOnlineGameMode::Logout(AController* Exiting)
{
    if (AHHShelterOnlinePlayerController* PC = Cast<AHHShelterOnlinePlayerController>(Exiting))
    {
        LeaveParty(PC);
    }
    Super::Logout(Exiting);
}

UClass* AHHShelterOnlineGameMode::GetDefaultPawnClassForController_Implementation(AController* InController)
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

AHHShelterOnlinePlayerController* AHHShelterOnlineGameMode::ControllerFor(AHHShelterOnlinePlayerState* PS) const
{
    return PS ? Cast<AHHShelterOnlinePlayerController>(PS->GetOwner()) : nullptr;
}

FHHPartyRuntime* AHHShelterOnlineGameMode::FindPartyFor(AHHShelterOnlinePlayerState* PS)
{
    if (!PS || PS->PartyId.IsEmpty()) return nullptr;
    return Parties.Find(PS->PartyId);
}

void AHHShelterOnlineGameMode::ResetInvite(AHHShelterOnlinePlayerState* PS)
{
    if (!PS) return;
    PS->PendingInvitePartyId.Reset();
    PS->PendingInviteLeaderName.Reset();
}

void AHHShelterOnlineGameMode::NormalizeParty(FHHPartyRuntime& Party)
{
    Party.Members.RemoveAll([](const TWeakObjectPtr<AHHShelterOnlinePlayerState>& P){ return !P.IsValid(); });

    Party.Leader.Reset();

    if (!Party.LeaderAccountId.IsEmpty())
    {
        for (const TWeakObjectPtr<AHHShelterOnlinePlayerState>& Weak : Party.Members)
        {
            AHHShelterOnlinePlayerState* PS = Weak.Get();
            if (PS && PS->AccountId == Party.LeaderAccountId)
            {
                Party.Leader = PS;
                break;
            }
        }
    }

    if (!Party.Leader.IsValid() && Party.LeaderAccountId.IsEmpty() && Party.Members.Num() > 0)
    {
        Party.Leader = Party.Members[0];
        if (AHHShelterOnlinePlayerState* LeaderPS = Party.Leader.Get())
        {
            Party.LeaderAccountId = LeaderPS->AccountId;
        }
    }

    for (const TWeakObjectPtr<AHHShelterOnlinePlayerState>& Weak : Party.Members)
    {
        if (AHHShelterOnlinePlayerState* PS = Weak.Get())
        {
            PS->PartyId = Party.PartyId;
            PS->bPartyLeader = (PS == Party.Leader.Get());
            PS->ForceNetUpdate();
        }
    }
}

void AHHShelterOnlineGameMode::RemovePartyIfEmpty(const FString& PartyId)
{
    FHHPartyRuntime* Party = Parties.Find(PartyId);
    if (!Party) return;
    NormalizeParty(*Party);
    if (Party->Members.IsEmpty()) Parties.Remove(PartyId);
}

void AHHShelterOnlineGameMode::CreateParty(AHHShelterOnlinePlayerController* Requester)
{
    AHHShelterOnlinePlayerState* PS = Requester ? Requester->GetPlayerState<AHHShelterOnlinePlayerState>() : nullptr;
    if (!PS) return;

    if (!PS->PartyId.IsEmpty())
    {
        Requester->ClientPartyMessage(TEXT("이미 파티에 들어가 있습니다."));
        return;
    }

    FHHPartyRuntime Party;
    Party.PartyId = NewPartyId();
    Party.LeaderAccountId = PS->AccountId;
    Party.Leader = PS;
    Party.Members.Add(PS);

    PS->PartyId = Party.PartyId;
    PS->bPartyLeader = true;
    PS->bPartyReady = true;
    PS->ForceNetUpdate();

    Parties.Add(Party.PartyId, Party);
    Requester->ClientPartyMessage(TEXT("파티 생성 · 출격문 앞에서 파티를 모으세요."));
}

void AHHShelterOnlineGameMode::InviteToParty(AHHShelterOnlinePlayerController* Requester, AHHShelterOnlinePlayerState* Target)
{
    AHHShelterOnlinePlayerState* LeaderPS = Requester ? Requester->GetPlayerState<AHHShelterOnlinePlayerState>() : nullptr;
    if (!LeaderPS || !Target || LeaderPS == Target) return;

    if (LeaderPS->PartyId.IsEmpty()) CreateParty(Requester);

    FHHPartyRuntime* Party = FindPartyFor(LeaderPS);
    if (!Party || Party->Leader.Get() != LeaderPS)
    {
        Requester->ClientPartyMessage(TEXT("파티장만 초대할 수 있습니다."));
        return;
    }

    NormalizeParty(*Party);
    if (Party->Members.Num() >= PartyCapacity)
    {
        Requester->ClientPartyMessage(TEXT("파티가 가득 찼습니다."));
        return;
    }

    if (!Target->PartyId.IsEmpty())
    {
        Requester->ClientPartyMessage(TEXT("대상은 이미 다른 파티에 있습니다."));
        return;
    }

    Target->PendingInvitePartyId = Party->PartyId;
    Target->PendingInviteLeaderName = LeaderPS->GetPlayerName();
    Target->ForceNetUpdate();

    if (AHHShelterOnlinePlayerController* TargetPC = ControllerFor(Target))
    {
        TargetPC->ClientPartyMessage(FString::Printf(TEXT("%s의 파티 초대 — Y 수락 / N 거절"), *LeaderPS->GetPlayerName()));
    }
}

void AHHShelterOnlineGameMode::AcceptPartyInvite(AHHShelterOnlinePlayerController* Requester)
{
    AHHShelterOnlinePlayerState* PS = Requester ? Requester->GetPlayerState<AHHShelterOnlinePlayerState>() : nullptr;
    if (!PS || PS->PendingInvitePartyId.IsEmpty() || !PS->PartyId.IsEmpty()) return;

    FHHPartyRuntime* Party = Parties.Find(PS->PendingInvitePartyId);
    if (!Party)
    {
        ResetInvite(PS);
        Requester->ClientPartyMessage(TEXT("초대가 만료되었습니다."));
        return;
    }

    NormalizeParty(*Party);
    if (Party->Members.Num() >= PartyCapacity)
    {
        ResetInvite(PS);
        Requester->ClientPartyMessage(TEXT("파티가 가득 찼습니다."));
        return;
    }

    Party->Members.AddUnique(PS);
    PS->PartyId = Party->PartyId;
    PS->bPartyLeader = false;
    PS->bPartyReady = false;
    ResetInvite(PS);
    NormalizeParty(*Party);
    Requester->ClientPartyMessage(TEXT("파티 합류 · 준비되면 R."));
}

void AHHShelterOnlineGameMode::DeclinePartyInvite(AHHShelterOnlinePlayerController* Requester)
{
    AHHShelterOnlinePlayerState* PS = Requester ? Requester->GetPlayerState<AHHShelterOnlinePlayerState>() : nullptr;
    if (!PS) return;
    ResetInvite(PS);
    PS->ForceNetUpdate();
}

void AHHShelterOnlineGameMode::LeaveParty(AHHShelterOnlinePlayerController* Requester)
{
    AHHShelterOnlinePlayerState* PS = Requester ? Requester->GetPlayerState<AHHShelterOnlinePlayerState>() : nullptr;
    if (!PS || PS->PartyId.IsEmpty()) return;

    const FString OldPartyId = PS->PartyId;
    FHHPartyRuntime* Party = Parties.Find(OldPartyId);

    if (Party)
    {
        Party->Members.Remove(PS);

        if (Party->LeaderAccountId == PS->AccountId)
        {
            Party->LeaderAccountId.Empty();
            if (Party->Members.Num() > 0 && Party->Members[0].IsValid())
            {
                Party->LeaderAccountId = Party->Members[0]->AccountId;
            }
        }

        NormalizeParty(*Party);
    }

    PS->PartyId.Reset();
    PS->bPartyLeader = false;
    PS->bPartyReady = false;
    PS->ForceNetUpdate();

    RemovePartyIfEmpty(OldPartyId);
}

void AHHShelterOnlineGameMode::SetPartyReady(AHHShelterOnlinePlayerController* Requester, bool bReady)
{
    AHHShelterOnlinePlayerState* PS = Requester ? Requester->GetPlayerState<AHHShelterOnlinePlayerState>() : nullptr;
    if (!PS || PS->PartyId.IsEmpty()) return;
    PS->bPartyReady = bReady;
    PS->ForceNetUpdate();
}

bool AHHShelterOnlineGameMode::CollectPartyMembers(FHHPartyRuntime& Party, TArray<AHHShelterOnlinePlayerState*>& OutMembers)
{
    NormalizeParty(Party);
    OutMembers.Reset();
    for (const TWeakObjectPtr<AHHShelterOnlinePlayerState>& Weak : Party.Members)
    {
        if (AHHShelterOnlinePlayerState* PS = Weak.Get()) OutMembers.Add(PS);
    }
    return !OutMembers.IsEmpty();
}

AHHDeploymentGate* AHHShelterOnlineGameMode::FindDeploymentGate() const
{
    if (!GetWorld()) return nullptr;
    for (TActorIterator<AHHDeploymentGate> It(GetWorld()); It; ++It)
    {
        return *It;
    }
    return nullptr;
}

void AHHShelterOnlineGameMode::RequestDungeonForParty(AHHShelterOnlinePlayerController* Requester, FName MissionId)
{
    AHHShelterOnlinePlayerState* LeaderPS = Requester ? Requester->GetPlayerState<AHHShelterOnlinePlayerState>() : nullptr;
    FHHPartyRuntime* Party = FindPartyFor(LeaderPS);

    if (!LeaderPS || !Party || Party->Leader.Get() != LeaderPS)
    {
        if (Requester) Requester->ClientPartyMessage(TEXT("파티장만 출정할 수 있습니다."));
        return;
    }

    if (Party->bAllocatingDungeon) return;

    TArray<AHHShelterOnlinePlayerState*> Members;
    if (!CollectPartyMembers(*Party, Members) || Members.Num() > PartyCapacity)
    {
        Requester->ClientPartyMessage(TEXT("파티 구성이 잘못되었습니다."));
        return;
    }

    for (AHHShelterOnlinePlayerState* PS : Members)
    {
        if (!PS || !PS->bPartyReady)
        {
            Requester->ClientPartyMessage(TEXT("아직 준비하지 않은 파티원이 있습니다."));
            return;
        }
    }

    AHHDeploymentGate* Gate = FindDeploymentGate();
    if (!Gate || !Gate->CanDeployParty(Members))
    {
        Requester->ClientPartyMessage(TEXT("파티원 전원이 출격 셔터 앞 대기구역에 있어야 합니다."));
        return;
    }

    Gate->SetAllocating();
    Party->bAllocatingDungeon = true;
    Party->MissionId = MissionId;

    TSharedRef<FJsonObject> Root = MakeShared<FJsonObject>();
    Root->SetStringField(TEXT("partyId"), Party->PartyId);
    Root->SetStringField(TEXT("missionId"), MissionId.ToString());
    Root->SetStringField(TEXT("leaderAccountId"), Party->LeaderAccountId);
    Root->SetStringField(TEXT("originShelterInstanceId"), InstanceId);

    TArray<TSharedPtr<FJsonValue>> MembersJson;
    for (AHHShelterOnlinePlayerState* PS : Members)
    {
        TSharedRef<FJsonObject> M = MakeShared<FJsonObject>();
        M->SetStringField(TEXT("accountId"), PS->AccountId);
        M->SetStringField(TEXT("character"), PS->SelectedCharacterId.ToString().ToLower());
        M->SetBoolField(TEXT("leader"), PS->bPartyLeader);
        MembersJson.Add(MakeShared<FJsonValueObject>(M));
    }
    Root->SetArrayField(TEXT("members"), MembersJson);

    FString Json;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Json);
    FJsonSerializer::Serialize(Root, Writer);

    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Req = FHttpModule::Get().CreateRequest();
    Req->SetURL(MatchmakerBaseUrl / TEXT("v1/match/dungeon"));
    Req->SetVerb(TEXT("POST"));
    Req->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
    Req->SetHeader(TEXT("X-Instance-Secret"), InstanceSecret);   // server-to-server only (HwanghonCombatUE)
    Req->SetContentAsString(Json);

    const FString PartyIdCopy = Party->PartyId;
    Req->OnProcessRequestComplete().BindUObject(
        this,
        &AHHShelterOnlineGameMode::HandleDungeonAllocation,
        PartyIdCopy
    );
    Req->ProcessRequest();

    Requester->ClientPartyMessage(TEXT("출격 셔터 잠금 해제 · 던전 서버 배정 중"));
}

void AHHShelterOnlineGameMode::HandleDungeonAllocation(
    FHttpRequestPtr Request,
    FHttpResponsePtr Response,
    bool bSucceeded,
    FString PartyId)
{
    FHHPartyRuntime* Party = Parties.Find(PartyId);
    if (!Party) return;

    Party->bAllocatingDungeon = false;

    AHHDeploymentGate* Gate = FindDeploymentGate();

    if (!bSucceeded || !Response.IsValid() || Response->GetResponseCode() < 200 || Response->GetResponseCode() >= 300)
    {
        if (Gate) Gate->SetReady();
        if (AHHShelterOnlinePlayerController* LeaderPC = ControllerFor(Party->Leader.Get()))
        {
            LeaderPC->ClientPartyMessage(TEXT("사용 가능한 던전 서버가 없습니다."));
        }
        return;
    }

    TSharedPtr<FJsonObject> Root;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response->GetContentAsString());
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
    {
        if (Gate) Gate->SetReady();
        return;
    }

    FString Address;
    if (!Root->TryGetStringField(TEXT("address"), Address) || Address.IsEmpty())
    {
        if (Gate) Gate->SetReady();
        return;
    }

    const TSharedPtr<FJsonObject>* TicketsPtr = nullptr;
    if (!Root->TryGetObjectField(TEXT("tickets"), TicketsPtr) || !TicketsPtr || !TicketsPtr->IsValid())
    {
        if (Gate) Gate->SetReady();
        return;
    }

    TMap<FString, FString> Tickets;
    for (const auto& Pair : (*TicketsPtr)->Values)
    {
        FString Token;
        if (Pair.Value.IsValid() && Pair.Value->TryGetString(Token))
        {
            Tickets.Add(FString(Pair.Key), Token);   // UE 5.8: JSON keys are not FString (HwanghonCombatUE)
        }
    }

    if (Gate) Gate->OpenGate();

    FTimerHandle TravelTimer;
    GetWorldTimerManager().SetTimer(
        TravelTimer,
        FTimerDelegate::CreateUObject(
            this,
            &AHHShelterOnlineGameMode::DispatchDungeonTravel,
            PartyId,
            Address,
            Tickets),
        1.35f,
        false
    );
}

void AHHShelterOnlineGameMode::DispatchDungeonTravel(
    FString PartyId,
    FString Address,
    TMap<FString, FString> TicketsByAccount)
{
    FHHPartyRuntime* Party = Parties.Find(PartyId);
    if (!Party) return;

    NormalizeParty(*Party);

    for (const TWeakObjectPtr<AHHShelterOnlinePlayerState>& Weak : Party->Members)
    {
        AHHShelterOnlinePlayerState* PS = Weak.Get();
        AHHShelterOnlinePlayerController* PC = ControllerFor(PS);
        if (!PS || !PC) continue;

        const FString* Token = TicketsByAccount.Find(PS->AccountId);
        if (!Token)
        {
            PC->ClientPartyMessage(TEXT("던전 입장권을 받지 못했습니다."));
            continue;
        }

        PC->ClientTravelToDungeon(Address, *Token);
    }
}

void AHHShelterOnlineGameMode::StartHeartbeat()
{
    InstanceId = TEXT("shelter-dev-01");
    AdvertisedAddress = TEXT("127.0.0.1:7777");
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

    SendHeartbeat();
    GetWorldTimerManager().SetTimer(HeartbeatTimer, this, &AHHShelterOnlineGameMode::SendHeartbeat, 5.f, true);
}

void AHHShelterOnlineGameMode::SendHeartbeat()
{
    TSharedRef<FJsonObject> Root = MakeShared<FJsonObject>();
    Root->SetStringField(TEXT("instanceId"), InstanceId);
    Root->SetStringField(TEXT("address"), AdvertisedAddress);
    Root->SetStringField(TEXT("kind"), TEXT("shelter"));
    Root->SetStringField(TEXT("map"), TEXT("shelter"));
    Root->SetNumberField(TEXT("players"), GetNumPlayers());
    Root->SetNumberField(TEXT("capacity"), ShelterCapacity);

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
