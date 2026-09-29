#include "HHOnlineFlowSubsystem.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"

#include "Dom/JsonObject.h"
#include "Engine/GameInstance.h"
#include "GameFramework/PlayerController.h"
#include "HAL/FileManager.h"
#include "HttpModule.h"
#include "Interfaces/IHttpResponse.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/FileHelper.h"
#include "Misc/Guid.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

static FString HHCharacterToLower(FName Id)
{
    return Id.ToString().ToLower();
}

void UHHOnlineFlowSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    ClientAccountId = LoadOrCreateClientAccountId();
}

FString UHHOnlineFlowSubsystem::LoadOrCreateClientAccountId()
{
    const FString Dir = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("Hwanghon"));
    // HwanghonCombatUE: -HHClientProfile=<name> keeps one id per profile, so two clients on one PC are two accounts
    FString Profile;
    FParse::Value(FCommandLine::Get(), TEXT("HHClientProfile="), Profile);
    const FString Path = FPaths::Combine(Dir, Profile.IsEmpty() ? FString(TEXT("client_id.txt")) : FString::Printf(TEXT("client_id_%s.txt"), *Profile));

    FString Existing;
    if (FFileHelper::LoadFileToString(Existing, *Path))
    {
        Existing.TrimStartAndEndInline();
        if (!Existing.IsEmpty())
        {
            return Existing;
        }
    }

    IFileManager::Get().MakeDirectory(*Dir, true);
    const FString Created = FGuid::NewGuid().ToString(EGuidFormats::DigitsWithHyphensLower);
    FFileHelper::SaveStringToFile(Created, *Path);
    return Created;
}

bool UHHOnlineFlowSubsystem::IsValidCharacter(FName CharacterId) const
{
    const FString Id = HHCharacterToLower(CharacterId);
    return Id == TEXT("ain") || Id == TEXT("kain") || Id == TEXT("ryu") || Id == TEXT("sera");
}

void UHHOnlineFlowSubsystem::SelectCharacter(FName CharacterId)
{
    if (!IsValidCharacter(CharacterId))
    {
        UE_LOG(LogTemp, Warning, TEXT("[Hwanghon] invalid character id: %s"), *CharacterId.ToString());
        return;
    }

    SelectedCharacterId = FName(*HHCharacterToLower(CharacterId));
    OnCharacterSelectionChanged.Broadcast(SelectedCharacterId);
}

void UHHOnlineFlowSubsystem::GoToCharacterSelect()
{
    if (UWorld* World = GetWorld())
    {
        UGameplayStatics::OpenLevel(World, CharacterSelectMap);
    }
}

FString UHHOnlineFlowSubsystem::BuildTravelUrl(const FString& Address, const FString& JoinToken) const
{
    const FString Character = SelectedCharacterId.IsNone() ? TEXT("ain") : HHCharacterToLower(SelectedCharacterId);
    return FString::Printf(
        TEXT("%s?Character=%s?AccountId=%s?JoinToken=%s"),
        *Address,
        *Character,
        *ClientAccountId,
        *JoinToken
    );
}

void UHHOnlineFlowSubsystem::TravelDirectToShelter(
    APlayerController* PlayerController,
    const FString& Address,
    const FString& JoinToken)
{
    if (!PlayerController)
    {
        OnMatchmakingFailed.Broadcast(TEXT("PlayerController가 없습니다."));
        return;
    }

    PlayerController->ClientTravel(BuildTravelUrl(Address, JoinToken), TRAVEL_Absolute);
}


void UHHOnlineFlowSubsystem::SetTravelDeferred(bool bDeferred)
{
    bDeferTravel = bDeferred;
    if (!bDeferred)
    {
        ReleaseDeferredTravel();
    }
}

void UHHOnlineFlowSubsystem::ReleaseDeferredTravel()
{
    bDeferTravel = false;

    if (!PendingTravelPlayer.IsValid()
        || PendingTravelAddress.IsEmpty()
        || PendingTravelToken.IsEmpty())
    {
        return;
    }

    APlayerController* PC = PendingTravelPlayer.Get();
    const FString Address = PendingTravelAddress;
    const FString Token = PendingTravelToken;

    PendingTravelPlayer.Reset();
    PendingTravelAddress.Empty();
    PendingTravelToken.Empty();

    TravelDirectToShelter(PC, Address, Token);
}

void UHHOnlineFlowSubsystem::RequestShelterAndTravel(APlayerController* PlayerController)
{
    if (bMatchmaking || !PlayerController) return;

    if (SelectedCharacterId.IsNone())
    {
        OnMatchmakingFailed.Broadcast(TEXT("캐릭터를 먼저 선택하세요."));
        return;
    }

    bMatchmaking = true;
    OnMatchmakingStarted.Broadcast();

    TSharedRef<FJsonObject> Body = MakeShared<FJsonObject>();
    Body->SetStringField(TEXT("character"), HHCharacterToLower(SelectedCharacterId));
    Body->SetStringField(TEXT("accountId"), ClientAccountId);

    FString JsonBody;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&JsonBody);
    FJsonSerializer::Serialize(Body, Writer);

    ActiveRequest = FHttpModule::Get().CreateRequest();
    ActiveRequest->SetURL(MatchmakerUrl);
    ActiveRequest->SetVerb(TEXT("POST"));
    ActiveRequest->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
    ActiveRequest->SetContentAsString(JsonBody);

    TWeakObjectPtr<APlayerController> WeakPC(PlayerController);
    ActiveRequest->OnProcessRequestComplete().BindUObject(
        this,
        &UHHOnlineFlowSubsystem::HandleMatchResponse,
        WeakPC
    );

    if (!ActiveRequest->ProcessRequest())
    {
        bMatchmaking = false;
        OnMatchmakingFailed.Broadcast(TEXT("매치메이커 요청을 시작하지 못했습니다."));
    }
}

void UHHOnlineFlowSubsystem::HandleMatchResponse(
    FHttpRequestPtr Request,
    FHttpResponsePtr Response,
    bool bSucceeded,
    TWeakObjectPtr<APlayerController> PlayerController)
{
    bMatchmaking = false;
    ActiveRequest.Reset();

    if (!PlayerController.IsValid())
    {
        OnMatchmakingFailed.Broadcast(TEXT("플레이어 연결이 사라졌습니다."));
        return;
    }

    if (!bSucceeded || !Response.IsValid())
    {
        OnMatchmakingFailed.Broadcast(TEXT("쉘터 매치메이커에 연결하지 못했습니다."));
        return;
    }

    if (Response->GetResponseCode() < 200 || Response->GetResponseCode() >= 300)
    {
        OnMatchmakingFailed.Broadcast(FString::Printf(
            TEXT("쉘터 서버를 배정하지 못했습니다. HTTP %d"),
            Response->GetResponseCode()
        ));
        return;
    }

    TSharedPtr<FJsonObject> Root;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response->GetContentAsString());
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
    {
        OnMatchmakingFailed.Broadcast(TEXT("매치메이커 응답 형식이 잘못되었습니다."));
        return;
    }

    FString Address;
    FString JoinToken;
    if (!Root->TryGetStringField(TEXT("address"), Address) || Address.IsEmpty()
        || !Root->TryGetStringField(TEXT("joinToken"), JoinToken) || JoinToken.IsEmpty())
    {
        OnMatchmakingFailed.Broadcast(TEXT("서버 주소 또는 입장권이 없습니다."));
        return;
    }

    if (bDeferTravel)
    {
        PendingTravelPlayer = PlayerController.Get();
        PendingTravelAddress = Address;
        PendingTravelToken = JoinToken;
        return;
    }

    TravelDirectToShelter(PlayerController.Get(), Address, JoinToken);
}
