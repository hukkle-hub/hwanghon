#include "Network/HWRaidNetworkSubsystem.h"

#include "WebSocketsModule.h"
#include "IWebSocket.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "Modules/ModuleManager.h"
#include "Containers/Ticker.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"

namespace
{
    TSharedPtr<FJsonObject> Obj(const TSharedPtr<FJsonObject>& O,const TCHAR* K)
    {
        if(!O.IsValid()) return nullptr;
        const TSharedPtr<FJsonValue>* V=O->Values.Find(K);
        return V&&V->IsValid()&&(*V)->Type==EJson::Object?(*V)->AsObject():nullptr;
    }
    const TArray<TSharedPtr<FJsonValue>>* Arr(const TSharedPtr<FJsonObject>& O,const TCHAR* K)
    {
        if(!O.IsValid()) return nullptr;
        const TSharedPtr<FJsonValue>* V=O->Values.Find(K);
        return V&&V->IsValid()&&(*V)->Type==EJson::Array?&(*V)->AsArray():nullptr;
    }
    FName Name(const TSharedPtr<FJsonObject>& O,const TCHAR* K)
    {
        FString S; return O.IsValid()&&O->TryGetStringField(K,S)?FName(*S):NAME_None;
    }
}

void UHWRaidNetworkSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    FString Server,AutoToken,AutoName,AutoCharacter,AutoCharacterName;
    FParse::Value(FCommandLine::Get(),TEXT("HWServer="),Server);
    FParse::Value(FCommandLine::Get(),TEXT("HWToken="),AutoToken);
    FParse::Value(FCommandLine::Get(),TEXT("HWName="),AutoName);
    FParse::Value(FCommandLine::Get(),TEXT("HWCharacter="),AutoCharacter);
    FParse::Value(FCommandLine::Get(),TEXT("HWCharacterName="),AutoCharacterName);
    if(!AutoCharacter.IsEmpty()) PendingCharacterId=FName(*AutoCharacter);
    PendingCharacterName=AutoCharacterName;
    if(!Server.IsEmpty()) Connect(Server,AutoToken,AutoName);
}

void UHWRaidNetworkSubsystem::Deinitialize(){ Disconnect(); Super::Deinitialize(); }

bool UHWRaidNetworkSubsystem::Connect(const FString& ServerBaseUrl,const FString& SessionToken,const FString& InDisplayName)
{
    if(Socket.IsValid()) Disconnect();
    bManualDisconnect=false;
    Endpoint=ServerBaseUrl.TrimStartAndEnd();
    Token=SessionToken.TrimStartAndEnd();
    DisplayName=InDisplayName.TrimStartAndEnd();
    if(Endpoint.IsEmpty()){OnNetworkError.Broadcast(TEXT("Server URL is empty."));return false;}
    if(!Endpoint.StartsWith(TEXT("ws://"))&&!Endpoint.StartsWith(TEXT("wss://")))
    {
        if(Endpoint.StartsWith(TEXT("https://"))){Endpoint.RemoveFromStart(TEXT("https://"));Endpoint=TEXT("wss://")+Endpoint;}
        else if(Endpoint.StartsWith(TEXT("http://"))){Endpoint.RemoveFromStart(TEXT("http://"));Endpoint=TEXT("ws://")+Endpoint;}
        else Endpoint=TEXT("ws://")+Endpoint;
    }
    while(Endpoint.EndsWith(TEXT("/"))) Endpoint.LeftChopInline(1);
    if(!Endpoint.EndsWith(TEXT("/party-socket"))) Endpoint+=TEXT("/party-socket");

    if(!FModuleManager::Get().IsModuleLoaded(TEXT("WebSockets")))
        FModuleManager::Get().LoadModuleChecked<FWebSocketsModule>(TEXT("WebSockets"));
    Socket=FWebSocketsModule::Get().CreateWebSocket(Endpoint);
    if(!Socket.IsValid()){OnNetworkError.Broadcast(TEXT("Could not create WebSocket."));return false;}
    Socket->OnConnected().AddUObject(this,&UHWRaidNetworkSubsystem::HandleConnected);
    Socket->OnConnectionError().AddUObject(this,&UHWRaidNetworkSubsystem::HandleConnectionError);
    Socket->OnClosed().AddUObject(this,&UHWRaidNetworkSubsystem::HandleClosed);
    Socket->OnMessage().AddUObject(this,&UHWRaidNetworkSubsystem::HandleMessage);
    Socket->Connect();
    return true;
}

void UHWRaidNetworkSubsystem::Disconnect()
{
    bManualDisconnect=true;
    if(ReconnectTickerHandle.IsValid()){FTSTicker::GetCoreTicker().RemoveTicker(ReconnectTickerHandle);ReconnectTickerHandle.Reset();}
    if(Socket.IsValid()){Socket->Close(1000,TEXT("Client disconnect"));Socket.Reset();}
    bConnected=false;WireState.Reset();Room=FHWPartyNetSnapshot();Sequence=0;ReconnectAttempts=0;
    OnConnectionChanged.Broadcast(false);
}

void UHWRaidNetworkSubsystem::HandleConnected()
{
    bConnected=true;bManualDisconnect=false;Sequence=0;ReconnectAttempts=0;
    if(ReconnectTickerHandle.IsValid()){FTSTicker::GetCoreTicker().RemoveTicker(ReconnectTickerHandle);ReconnectTickerHandle.Reset();}
    OnConnectionChanged.Broadcast(true);SendHello();
}
void UHWRaidNetworkSubsystem::HandleConnectionError(const FString& E)
{
    bConnected=false;Socket.Reset();OnConnectionChanged.Broadcast(false);OnNetworkError.Broadcast(E);
    if(!bManualDisconnect&&bAutoReconnect&&!Token.IsEmpty())ScheduleReconnect();
}
void UHWRaidNetworkSubsystem::HandleClosed(int32 Status,const FString& Reason,bool bClean)
{
    bConnected=false;Socket.Reset();OnConnectionChanged.Broadcast(false);
    if(!bClean)OnNetworkError.Broadcast(FString::Printf(TEXT("WebSocket closed %d: %s"),Status,*Reason));
    if(!bManualDisconnect&&bAutoReconnect&&!Token.IsEmpty())ScheduleReconnect();
}
void UHWRaidNetworkSubsystem::ScheduleReconnect()
{
    if(ReconnectTickerHandle.IsValid()||ReconnectAttempts>=MaxReconnectAttempts)return;
    const float Delay=FMath::Min(8.f,ReconnectDelay*FMath::Pow(1.5f,ReconnectAttempts));
    ReconnectTickerHandle=FTSTicker::GetCoreTicker().AddTicker(
        FTickerDelegate::CreateUObject(this,&UHWRaidNetworkSubsystem::TickReconnect),Delay);
}
bool UHWRaidNetworkSubsystem::TickReconnect(float)
{
    ReconnectTickerHandle.Reset();
    if(bConnected||bManualDisconnect||!bAutoReconnect)return false;
    if(ReconnectAttempts>=MaxReconnectAttempts){OnNetworkError.Broadcast(TEXT("Reconnect attempts exhausted."));return false;}
    ++ReconnectAttempts;Connect(Endpoint,Token,DisplayName);return false;
}

bool UHWRaidNetworkSubsystem::SendObject(const TSharedRef<FJsonObject>& O)
{
    if(!Socket.IsValid()||!bConnected||!Socket->IsConnected())return false;
    FString Payload;auto W=TJsonWriterFactory<>::Create(&Payload);
    if(!FJsonSerializer::Serialize(O,W))return false;
    Socket->Send(Payload);return true;
}
void UHWRaidNetworkSubsystem::SendHello()
{
    auto O=MakeShared<FJsonObject>();O->SetStringField(TEXT("type"),TEXT("hello"));
    if(!Token.IsEmpty())O->SetStringField(TEXT("token"),Token);
    if(!DisplayName.IsEmpty())O->SetStringField(TEXT("name"),DisplayName);SendObject(O);
}
bool UHWRaidNetworkSubsystem::SendSimple(const TCHAR* T){auto O=MakeShared<FJsonObject>();O->SetStringField(TEXT("type"),T);return SendObject(O);}
bool UHWRaidNetworkSubsystem::SendIntent(const TCHAR* T){if(!IsRaidActive())return false;auto O=MakeShared<FJsonObject>();O->SetStringField(TEXT("type"),T);O->SetNumberField(TEXT("seq"),++Sequence);return SendObject(O);}

void UHWRaidNetworkSubsystem::SetPendingCharacterCreation(
    const FString& CharacterName,
    FName CharacterId)
{
    const bool bAllowed =
        CharacterId == TEXT("ain") || CharacterId == TEXT("kain")
        || CharacterId == TEXT("ryu") || CharacterId == TEXT("sera");

    PendingCharacterName = CharacterName.TrimStartAndEnd();
    PendingCharacterId = bAllowed ? CharacterId : NAME_None;
}

bool UHWRaidNetworkSubsystem::CreateCharacter(const FString& CharacterName, FName CharacterId)
{
    if (!bConnected || Profile.bCharacterCreated) return false;
    if (CharacterId != TEXT("ain") && CharacterId != TEXT("kain")
        && CharacterId != TEXT("ryu") && CharacterId != TEXT("sera")) return false;
    const FString Clean = CharacterName.TrimStartAndEnd();
    if (Clean.Len() < 2 || Clean.Len() > 16) return false;
    auto O = MakeShared<FJsonObject>();
    O->SetStringField(TEXT("type"), TEXT("character"));
    O->SetStringField(TEXT("name"), Clean);
    O->SetStringField(TEXT("character"), CharacterId.ToString());
    return SendObject(O);
}

bool UHWRaidNetworkSubsystem::CreateRoom(FName L,bool bPublic,FString Purpose,int32 MinPower)
{auto O=MakeShared<FJsonObject>();O->SetStringField(TEXT("type"),TEXT("create"));O->SetStringField(TEXT("level"),L.ToString());O->SetBoolField(TEXT("public"),bPublic);O->SetStringField(TEXT("purpose"),Purpose);O->SetNumberField(TEXT("minPower"),FMath::Max(0,MinPower));return SendObject(O);}
bool UHWRaidNetworkSubsystem::JoinRoom(const FString& C){auto O=MakeShared<FJsonObject>();O->SetStringField(TEXT("type"),TEXT("join"));O->SetStringField(TEXT("code"),C.TrimStartAndEnd().ToUpper());return SendObject(O);}
bool UHWRaidNetworkSubsystem::LeaveRoom(){return SendSimple(TEXT("leave"));}
bool UHWRaidNetworkSubsystem::SetReady(bool b){auto O=MakeShared<FJsonObject>();O->SetStringField(TEXT("type"),TEXT("ready"));O->SetBoolField(TEXT("ready"),b);return SendObject(O);}
bool UHWRaidNetworkSubsystem::StartRaid(){return SendSimple(TEXT("start"));}
bool UHWRaidNetworkSubsystem::RetryRaid(){return SendSimple(TEXT("retry"));}
bool UHWRaidNetworkSubsystem::ReturnToLobby(){return SendSimple(TEXT("lobby"));}
bool UHWRaidNetworkSubsystem::SendAttack(){return SendIntent(TEXT("attack"));}
bool UHWRaidNetworkSubsystem::SendSmash(){return SendIntent(TEXT("smash"));}
bool UHWRaidNetworkSubsystem::SendDodge(){return SendIntent(TEXT("dodge"));}
bool UHWRaidNetworkSubsystem::SendJump(){return SendIntent(TEXT("jump"));}
bool UHWRaidNetworkSubsystem::SendCounter(){return SendIntent(TEXT("counter"));}
bool UHWRaidNetworkSubsystem::SendInteract(){return SendIntent(TEXT("interact"));}
bool UHWRaidNetworkSubsystem::SendUltimate(){return SendIntent(TEXT("ult"));}
bool UHWRaidNetworkSubsystem::SendExecute(){return SendIntent(TEXT("execute"));}
bool UHWRaidNetworkSubsystem::SendOpening(){return SendIntent(TEXT("opening"));}
bool UHWRaidNetworkSubsystem::SendMove(float X,float Y)
{if(!IsRaidActive())return false;auto O=MakeShared<FJsonObject>();O->SetStringField(TEXT("type"),TEXT("move"));O->SetNumberField(TEXT("seq"),++Sequence);O->SetNumberField(TEXT("x"),FMath::Clamp(X,-1.f,1.f));O->SetNumberField(TEXT("y"),FMath::Clamp(Y,-1.f,1.f));return SendObject(O);}
bool UHWRaidNetworkSubsystem::SendTarget(FName P){if(!IsRaidActive()||P.IsNone())return false;auto O=MakeShared<FJsonObject>();O->SetStringField(TEXT("type"),TEXT("target"));O->SetNumberField(TEXT("seq"),++Sequence);O->SetStringField(TEXT("part"),P.ToString());return SendObject(O);}
bool UHWRaidNetworkSubsystem::SendGuard(bool b){if(!IsRaidActive())return false;auto O=MakeShared<FJsonObject>();O->SetStringField(TEXT("type"),TEXT("guard"));O->SetNumberField(TEXT("seq"),++Sequence);O->SetBoolField(TEXT("on"),b);return SendObject(O);}
bool UHWRaidNetworkSubsystem::SendRevive(bool b){if(!IsRaidActive())return false;auto O=MakeShared<FJsonObject>();O->SetStringField(TEXT("type"),TEXT("revive"));O->SetNumberField(TEXT("seq"),++Sequence);O->SetBoolField(TEXT("on"),b);return SendObject(O);}
bool UHWRaidNetworkSubsystem::SendSkill(int32 I){if(!IsRaidActive()||I<0||I>3)return false;auto O=MakeShared<FJsonObject>();O->SetStringField(TEXT("type"),TEXT("skill"));O->SetNumberField(TEXT("seq"),++Sequence);O->SetNumberField(TEXT("index"),I);return SendObject(O);}
bool UHWRaidNetworkSubsystem::IsRaidActive()const{return Room.bHasRaid&&(Room.Raid.State==TEXT("explore")||Room.Raid.State==TEXT("fight")||Room.Raid.State==TEXT("transition"));}

double UHWRaidNetworkSubsystem::ReadNumber(const TSharedPtr<FJsonObject>& O,const TCHAR* K,double D){if(!O.IsValid())return D;double V=D;return O->TryGetNumberField(K,V)?V:D;}
bool UHWRaidNetworkSubsystem::ReadBool(const TSharedPtr<FJsonObject>& O,const TCHAR* K,bool D){if(!O.IsValid())return D;bool V=D;return O->TryGetBoolField(K,V)?V:D;}

void UHWRaidNetworkSubsystem::ParseProfile(const TSharedPtr<FJsonObject>& O)
{
    if (!O.IsValid()) return;
    O->TryGetStringField(TEXT("id"), Profile.Id);
    O->TryGetStringField(TEXT("name"), Profile.Name);
    FString Character;
    if (O->TryGetStringField(TEXT("character"), Character)) Profile.Character = FName(*Character);
    Profile.bCharacterCreated = ReadBool(O, TEXT("characterCreated"), false);
    Profile.Level = (int32)ReadNumber(O, TEXT("level"), 1);
    if (!Profile.Id.IsEmpty()) PlayerId = Profile.Id;
    OnProfileChanged.Broadcast(Profile);
}

void UHWRaidNetworkSubsystem::HandleMessage(const FString& M)
{
    TSharedPtr<FJsonObject> R;auto Reader=TJsonReaderFactory<>::Create(M);
    if(!FJsonSerializer::Deserialize(Reader,R)||!R.IsValid()){OnNetworkError.Broadcast(TEXT("Invalid server JSON."));return;}
    FString T;if(!R->TryGetStringField(TEXT("type"),T))return;
    if(T==TEXT("welcome")){R->TryGetStringField(TEXT("token"),Token);if(auto P=Obj(R,TEXT("profile")))ParseProfile(P);OnWelcome.Broadcast(PlayerId,Token);if(!Profile.bCharacterCreated&&!PendingCharacterName.IsEmpty()&&!PendingCharacterId.IsNone())CreateCharacter(PendingCharacterName,PendingCharacterId);return;}
    if(T==TEXT("profile")){if(auto P=Obj(R,TEXT("profile")))ParseProfile(P);return;}
    if(T==TEXT("state")){AcceptFullState(R);return;}
    if(T==TEXT("patch")){if(auto P=Obj(R,TEXT("patch")))AcceptPatch(P);return;}
    if(T==TEXT("left")){WireState.Reset();Room=FHWPartyNetSnapshot();OnRoomStateChanged.Broadcast(Room);return;}
    if(T==TEXT("error")){FString E;R->TryGetStringField(TEXT("message"),E);OnNetworkError.Broadcast(E);return;}
    if(T==TEXT("superseded")){OnNetworkError.Broadcast(TEXT("This account connected from another client."));Disconnect();}
}
void UHWRaidNetworkSubsystem::AcceptFullState(const TSharedPtr<FJsonObject>& R){WireState=R;ParseRoomState();}
void UHWRaidNetworkSubsystem::AcceptPatch(const TSharedPtr<FJsonObject>& P)
{
    if(!WireState.IsValid()){OnNetworkError.Broadcast(TEXT("Received a delta before a full state."));return;}
    auto Applied=ApplyPatchValue(MakeShared<FJsonValueObject>(WireState),MakeShared<FJsonValueObject>(P));
    if(!Applied.IsValid()||Applied->Type!=EJson::Object){OnNetworkError.Broadcast(TEXT("Could not apply raid state delta."));return;}
    WireState=Applied->AsObject();ParseRoomState();
}

TSharedPtr<FJsonValue> UHWRaidNetworkSubsystem::ApplyPatchValue(const TSharedPtr<FJsonValue>& Before,const TSharedPtr<FJsonValue>& Patch)
{
    if(!Patch.IsValid())return Before;
    if(Patch->Type!=EJson::Object)return Patch;
    auto P=Patch->AsObject();if(!P.IsValid())return Patch;
    bool bArray=false;P->TryGetBoolField(TEXT("$array"),bArray);
    if(bArray)
    {
        TArray<TSharedPtr<FJsonValue>> Out;
        if(Before.IsValid()&&Before->Type==EJson::Array)Out=Before->AsArray();
        for(const auto& KV:P->Values)
        {
            if(KV.Key==TEXT("$array"))continue;int32 I=INDEX_NONE;
            if(!LexTryParseString(I,*KV.Key)||I<0)continue;
            while(Out.Num()<=I)Out.Add(MakeShared<FJsonValueNull>());
            Out[I]=ApplyPatchValue(Out[I],KV.Value);
        }
        return MakeShared<FJsonValueArray>(Out);
    }
    auto Out=MakeShared<FJsonObject>();
    if(Before.IsValid()&&Before->Type==EJson::Object){auto B=Before->AsObject();if(B.IsValid())Out->Values=B->Values;}
    const TArray<TSharedPtr<FJsonValue>>* Unset=nullptr;
    if(P->TryGetArrayField(TEXT("$unset"),Unset)&&Unset)for(const auto& V:*Unset){FString K;if(V.IsValid()&&V->TryGetString(K))Out->RemoveField(K);}
    for(const auto& KV:P->Values)
    {
        if(KV.Key==TEXT("$unset")||KV.Key==TEXT("__proto__")||KV.Key==TEXT("constructor")||KV.Key==TEXT("prototype"))continue;
        const TSharedPtr<FJsonValue>* Existing=Out->Values.Find(KV.Key);
        Out->SetField(KV.Key,ApplyPatchValue(Existing?*Existing:nullptr,KV.Value));
    }
    return MakeShared<FJsonValueObject>(Out);
}

void UHWRaidNetworkSubsystem::ParseRoomState()
{
    if(!WireState.IsValid())return;
    FHWPartyNetSnapshot N;
    N.Protocol=(int32)ReadNumber(WireState,TEXT("protocol"),0);
    WireState->TryGetStringField(TEXT("code"),N.Code);
    WireState->TryGetStringField(TEXT("leader"),N.LeaderId);
    FString Level;if(WireState->TryGetStringField(TEXT("level"),Level))N.LevelId=FName(*Level);
    WireState->TryGetStringField(TEXT("purpose"),N.Purpose);
    N.bTraining=ReadBool(WireState,TEXT("training"),false);

    if(auto Members=Arr(WireState,TEXT("members")))for(const auto& V:*Members)
    {
        auto O=V.IsValid()&&V->Type==EJson::Object?V->AsObject():nullptr;if(!O.IsValid())continue;
        FHWRaidNetMember X;O->TryGetStringField(TEXT("id"),X.Id);O->TryGetStringField(TEXT("name"),X.Name);
        FString C;if(O->TryGetStringField(TEXT("character"),C))X.Character=FName(*C);
        X.bReady=ReadBool(O,TEXT("ready"),false);X.bConnected=ReadBool(O,TEXT("connected"),false);N.Members.Add(X);
    }

    auto RO=Obj(WireState,TEXT("raid"));N.bHasRaid=RO.IsValid();
    if(RO.IsValid())
    {
        auto& Raid=N.Raid;RO->TryGetStringField(TEXT("id"),Raid.RaidId);
        FString L,S;if(RO->TryGetStringField(TEXT("level"),L))Raid.LevelId=FName(*L);if(RO->TryGetStringField(TEXT("state"),S))Raid.State=FName(*S);
        Raid.Time=(float)ReadNumber(RO,TEXT("time"));Raid.Phase=(int32)ReadNumber(RO,TEXT("phase"));Raid.PhaseCount=(int32)ReadNumber(RO,TEXT("phases"));Raid.Reach=(float)ReadNumber(RO,TEXT("reach"));

        if(auto B=Obj(RO,TEXT("boss")))
        {
            Raid.Boss.X=(float)ReadNumber(B,TEXT("x"));Raid.Boss.Y=(float)ReadNumber(B,TEXT("y"));Raid.Boss.Aim=(float)ReadNumber(B,TEXT("aim"));
            Raid.Boss.Hp=(float)ReadNumber(B,TEXT("hp"));Raid.Boss.MaxHp=(float)ReadNumber(B,TEXT("maxHp"));Raid.Boss.Posture=(float)ReadNumber(B,TEXT("posture"));
            Raid.Boss.State=Name(B,TEXT("state"));
            Raid.Boss.TelegraphProgress=(float)ReadNumber(B,TEXT("windup"));
            Raid.Boss.RecoveryRemaining=(float)ReadNumber(B,TEXT("recovery"));
            Raid.Boss.RecoveryDuration=(float)ReadNumber(B,TEXT("recoveryDur"));
            Raid.Boss.LinkRemaining=(float)ReadNumber(B,TEXT("linkT"));
            Raid.Boss.bExecutable=ReadBool(B,TEXT("executable"));B->TryGetStringField(TEXT("name"),Raid.Boss.Name);
            if(auto Ptn=Obj(B,TEXT("pattern"))){Ptn->TryGetStringField(TEXT("name"),Raid.Boss.PatternName);Raid.Boss.bPatternCounterable=ReadBool(Ptn,TEXT("counterable"));}
            if(auto Parts=Arr(B,TEXT("parts")))for(const auto& V:*Parts)
            {
                auto O=V.IsValid()&&V->Type==EJson::Object?V->AsObject():nullptr;if(!O.IsValid())continue;
                FHWRaidNetBossPart P;P.Id=Name(O,TEXT("id"));O->TryGetStringField(TEXT("name"),P.Name);P.Hp=(float)ReadNumber(O,TEXT("hp"));P.MaxHp=(float)ReadNumber(O,TEXT("hpMax"));P.bBroken=ReadBool(O,TEXT("broken"));P.bBreakable=ReadBool(O,TEXT("breakable"));P.bWeak=ReadBool(O,TEXT("weak"));Raid.Boss.Parts.Add(P);
            }
        }

        if(auto Players=Arr(RO,TEXT("players")))for(const auto& V:*Players)
        {
            auto O=V.IsValid()&&V->Type==EJson::Object?V->AsObject():nullptr;if(!O.IsValid())continue;FHWRaidNetPlayer P;
            O->TryGetStringField(TEXT("id"),P.Id);O->TryGetStringField(TEXT("name"),P.Name);FString C;if(O->TryGetStringField(TEXT("character"),C))P.Character=FName(*C);
            P.X=(float)ReadNumber(O,TEXT("x"));P.Y=(float)ReadNumber(O,TEXT("y"));P.Aim=(float)ReadNumber(O,TEXT("aim"));P.Hp=(float)ReadNumber(O,TEXT("hp"));P.MaxHp=(float)ReadNumber(O,TEXT("maxHp"));
            P.Stamina=(float)ReadNumber(O,TEXT("st"));P.Ultimate=(float)ReadNumber(O,TEXT("ult"));P.DownTime=(float)ReadNumber(O,TEXT("downT"));P.ReviveProgress=(float)ReadNumber(O,TEXT("reviveProgress"));
            P.RiposteTime=(float)ReadNumber(O,TEXT("riposteT"));P.Threat=(float)ReadNumber(O,TEXT("threat"));P.DamageDone=(float)ReadNumber(O,TEXT("damage"));P.bGuarding=ReadBool(O,TEXT("guard"));P.bDead=ReadBool(O,TEXT("dead"));P.bConnected=ReadBool(O,TEXT("connected"));P.TargetPart=Name(O,TEXT("target"));
            TArray<double> Cds;if(auto A=Arr(O,TEXT("cds")))for(const auto& X:*A)Cds.Add(X.IsValid()&&X->Type==EJson::Number?X->AsNumber():0.0);
            if(auto Kit=Arr(O,TEXT("kit")))for(int32 I=0;I<Kit->Num();++I){auto X=(*Kit)[I];auto K=X.IsValid()&&X->Type==EJson::Object?X->AsObject():nullptr;if(!K.IsValid())continue;FHWRaidNetSkillState SS;K->TryGetStringField(TEXT("name"),SS.Name);SS.Level=(int32)ReadNumber(K,TEXT("lv"),1);K->TryGetStringField(TEXT("br"),SS.Branch);SS.StaminaCost=(float)ReadNumber(K,TEXT("st"));SS.CooldownRemaining=Cds.IsValidIndex(I)?(float)Cds[I]:0.f;P.Skills.Add(SS);}
            O->TryGetStringField(TEXT("ultName"),P.UltimateName);P.UltimateLevel=(int32)ReadNumber(O,TEXT("ultLv"),1);
            if(auto Op=Obj(O,TEXT("opening"))){P.OpeningKind=Name(Op,TEXT("kind"));P.OpeningClip=Name(Op,TEXT("clip"));P.OpeningRemaining=(float)ReadNumber(Op,TEXT("t"));Op->TryGetStringField(TEXT("from"),P.OpeningFrom);}
            if(auto A=Obj(O,TEXT("action"))){P.ActionKind=Name(A,TEXT("kind"));P.ActionClip=Name(A,TEXT("clip"));P.ActionElapsed=(float)ReadNumber(A,TEXT("elapsed"));P.ActionDuration=(float)ReadNumber(A,TEXT("duration"));}
            Raid.Players.Add(P);
        }

        if(auto E=Obj(RO,TEXT("expedition")))
        {
            Raid.Expedition.Version=(int32)ReadNumber(E,TEXT("version"));FString EL;if(E->TryGetStringField(TEXT("level"),EL))Raid.Expedition.LevelId=FName(*EL);E->TryGetStringField(TEXT("id"),Raid.Expedition.ExpeditionId);Raid.Expedition.bFinished=ReadBool(E,TEXT("finished"));
            if(auto D=Obj(E,TEXT("done")))for(const auto& KV:D->Values)if(KV.Value.IsValid()&&KV.Value->Type==EJson::Boolean&&KV.Value->AsBool())Raid.Expedition.Completed.Add(FName(*KV.Key));
            if(auto D=Obj(E,TEXT("discovered")))for(const auto& KV:D->Values)if(KV.Value.IsValid()&&KV.Value->Type==EJson::Boolean&&KV.Value->AsBool())Raid.Expedition.Discovered.Add(FName(*KV.Key));
            if(auto Nodes=Arr(E,TEXT("nodes")))for(const auto& V:*Nodes){auto O=V.IsValid()&&V->Type==EJson::Object?V->AsObject():nullptr;if(!O.IsValid())continue;FHWRaidNetExpeditionNode X;X.Id=Name(O,TEXT("id"));X.Kind=Name(O,TEXT("kind"));O->TryGetStringField(TEXT("name"),X.Name);X.X=(float)ReadNumber(O,TEXT("x"));X.Y=(float)ReadNumber(O,TEXT("y"));X.Range=(float)ReadNumber(O,TEXT("range"),110);X.Objective=Name(O,TEXT("objective"));X.bEnabled=ReadBool(O,TEXT("enabled"));X.bDone=ReadBool(O,TEXT("done"));X.bDiscovered=ReadBool(O,TEXT("discovered"));Raid.Expedition.Nodes.Add(X);}
            if(auto Ck=Obj(E,TEXT("checkpoint"))){Raid.Expedition.Checkpoint.bValid=true;Ck->TryGetStringField(TEXT("id"),Raid.Expedition.Checkpoint.Id);Raid.Expedition.Checkpoint.X=(float)ReadNumber(Ck,TEXT("x"));Raid.Expedition.Checkpoint.Y=(float)ReadNumber(Ck,TEXT("y"));}
        }
        if(auto G=Obj(RO,TEXT("gate"))){Raid.Gate.bValid=true;Raid.Gate.X=(float)ReadNumber(G,TEXT("x"));Raid.Gate.Y=(float)ReadNumber(G,TEXT("y"));Raid.Gate.bOpen=ReadBool(G,TEXT("open"));}

        auto ParseHaz=[&Raid](const TArray<TSharedPtr<FJsonValue>>* A,bool bArena){if(!A)return;for(const auto& V:*A){auto O=V.IsValid()&&V->Type==EJson::Object?V->AsObject():nullptr;if(!O.IsValid())continue;FHWRaidNetHazard H;H.Id=Name(O,TEXT("id"));if(H.Id.IsNone())H.Id=FName(*FString::Printf(TEXT("%s%d"),bArena?TEXT("arena"):TEXT("hazard"),Raid.Hazards.Num()));/* arena hazards carry no id: keep one proxy each */H.X=(float)UHWRaidNetworkSubsystem::ReadNumber(O,TEXT("x"));H.Y=(float)UHWRaidNetworkSubsystem::ReadNumber(O,TEXT("y"));H.Radius=(float)UHWRaidNetworkSubsystem::ReadNumber(O,TEXT("r"));H.Phase=Name(O,TEXT("phase"));H.bArenaHazard=bArena;Raid.Hazards.Add(H);}};
        ParseHaz(Arr(RO,TEXT("hazards")),false);if(auto A=Obj(RO,TEXT("arena")))ParseHaz(Arr(A,TEXT("hazards")),true);

        if(Raid.RaidId!=LastRaidId){LastRaidId=Raid.RaidId;LastEventId=0;}int64 MaxId=LastEventId;
        if(auto Events=Arr(RO,TEXT("events")))for(const auto& V:*Events){auto O=V.IsValid()&&V->Type==EJson::Object?V->AsObject():nullptr;if(!O.IsValid())continue;FHWRaidNetEvent E;E.Id=(int64)ReadNumber(O,TEXT("id"));E.Type=Name(O,TEXT("type"));E.Time=(float)ReadNumber(O,TEXT("time"));O->TryGetStringField(TEXT("player"),E.PlayerId);if(E.PlayerId.IsEmpty())O->TryGetStringField(TEXT("target"),E.PlayerId);E.PartId=Name(O,TEXT("part"));O->TryGetStringField(TEXT("name"),E.Name);O->TryGetStringField(TEXT("text"),E.Text);E.Duration=(float)ReadNumber(O,TEXT("dur"));Raid.Events.Add(E);if(LastEventId>0&&E.Id>LastEventId)OnRaidEvent.Broadcast(E);MaxId=FMath::Max(MaxId,E.Id);}LastEventId=MaxId;

        if(auto Result=Obj(RO,TEXT("result"))){Raid.bHasResult=true;Result->TryGetStringField(TEXT("rewardStatus"),Raid.RewardStatus);}
    }

    Room=N;OnRoomStateChanged.Broadcast(Room);if(Room.bHasRaid)OnRaidSnapshot.Broadcast(Room.Raid);
}
