#include "HHShelterStation.h"
#include "HHHubSubsystem.h"

#include "Components/BoxComponent.h"
#include "Components/TextRenderComponent.h"
#include "Components/PointLightComponent.h"
#include "GameFramework/PlayerController.h"

AHHShelterStation::AHHShelterStation()
{
    PrimaryActorTick.bCanEverTick = false;

    Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    SetRootComponent(Root);

    InteractionVolume = CreateDefaultSubobject<UBoxComponent>(TEXT("InteractionVolume"));
    InteractionVolume->SetupAttachment(Root);
    InteractionVolume->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
    InteractionVolume->SetCollisionObjectType(ECC_WorldDynamic);
    InteractionVolume->SetCollisionResponseToAllChannels(ECR_Ignore);
    InteractionVolume->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);

    NumberText = CreateDefaultSubobject<UTextRenderComponent>(TEXT("NumberText"));
    NumberText->SetupAttachment(Root);
    NumberText->SetHorizontalAlignment(EHTA_Left);
    NumberText->SetWorldSize(46.f);
    NumberText->SetRelativeLocation(FVector(0, -180, 220));

    NameText = CreateDefaultSubobject<UTextRenderComponent>(TEXT("NameText"));
    NameText->SetupAttachment(Root);
    NameText->SetHorizontalAlignment(EHTA_Left);
    NameText->SetWorldSize(36.f);
    NameText->SetRelativeLocation(FVector(0, -75, 220));

    AccentLight = CreateDefaultSubobject<UPointLightComponent>(TEXT("AccentLight"));
    AccentLight->SetupAttachment(Root);
    AccentLight->SetIntensity(800.f);
    AccentLight->SetAttenuationRadius(520.f);
    AccentLight->SetRelativeLocation(FVector(60, 0, 180));
}

void AHHShelterStation::ApplyDefaultsFromId()
{
    const auto SetIfEmpty = [](FText& Target, const FText& Value)
    {
        if (Target.IsEmpty()) Target = Value;
    };

    if (StationId == TEXT("PartyOffice"))
    {
        SetIfEmpty(DisplayName, FText::FromString(TEXT("인력사무소")));
        SetIfEmpty(EnglishName, FText::FromString(TEXT("PARTY OFFICE")));
        SetIfEmpty(InteractionLabel, FText::FromString(TEXT("파티 구성 / 던전 입장")));
    }
    else if (StationId == TEXT("RankAssessment"))
    {
        SetIfEmpty(DisplayName, FText::FromString(TEXT("등급측정소")));
        SetIfEmpty(EnglishName, FText::FromString(TEXT("RANK ASSESSMENT")));
        SetIfEmpty(InteractionLabel, FText::FromString(TEXT("등급 측정 / 스킬 재배치")));
        AccentColor = FLinearColor(0.25f, 0.55f, 0.90f, 1.f);
    }
    else if (StationId == TEXT("Crafting"))
    {
        SetIfEmpty(DisplayName, FText::FromString(TEXT("장인 공방")));
        SetIfEmpty(EnglishName, FText::FromString(TEXT("CRAFT / UPGRADE")));
        SetIfEmpty(InteractionLabel, FText::FromString(TEXT("수리 / 제작 / 강화")));
        AccentColor = FLinearColor(0.95f, 0.43f, 0.08f, 1.f);
    }
    else if (StationId == TEXT("Training"))
    {
        SetIfEmpty(DisplayName, FText::FromString(TEXT("훈련소")));
        SetIfEmpty(EnglishName, FText::FromString(TEXT("TRAINING HALL")));
        SetIfEmpty(InteractionLabel, FText::FromString(TEXT("허수아비 / 스킬 / 카운터 훈련")));
    }
    else if (StationId == TEXT("RequestBoard"))
    {
        SetIfEmpty(DisplayName, FText::FromString(TEXT("의뢰소")));
        SetIfEmpty(EnglishName, FText::FromString(TEXT("REQUEST BOARD")));
        SetIfEmpty(InteractionLabel, FText::FromString(TEXT("미션 정보 / 보상 확인")));
    }
    else if (StationId == TEXT("MedicalBay"))
    {
        SetIfEmpty(DisplayName, FText::FromString(TEXT("치료실")));
        SetIfEmpty(EnglishName, FText::FromString(TEXT("MEDICAL BAY")));
        SetIfEmpty(InteractionLabel, FText::FromString(TEXT("치료 / 회복약 / 억제제")));
        AccentColor = FLinearColor(0.18f, 0.68f, 0.65f, 1.f);
    }
    else if (StationId == TEXT("RationKitchen"))
    {
        SetIfEmpty(DisplayName, FText::FromString(TEXT("배급소")));
        SetIfEmpty(EnglishName, FText::FromString(TEXT("RATION / KITCHEN")));
        SetIfEmpty(InteractionLabel, FText::FromString(TEXT("음식 제작 / 버프 음식 판매")));
        AccentColor = FLinearColor(0.88f, 0.63f, 0.22f, 1.f);
    }
}

void AHHShelterStation::OnConstruction(const FTransform& Transform)
{
    Super::OnConstruction(Transform);
    ApplyDefaultsFromId();

    InteractionVolume->SetBoxExtent(InteractionExtent);
    NumberText->SetText(FText::AsNumber(StationNumber));
    NameText->SetText(FText::Format(FText::FromString(TEXT("{0}\n{1}")), DisplayName, EnglishName));
    NumberText->SetTextRenderColor(AccentColor.ToFColor(true));
    NameText->SetTextRenderColor(FColor(225, 225, 220));
    AccentLight->SetLightColor(AccentColor);
}

void AHHShelterStation::BeginPlay()
{
    Super::BeginPlay();
    ApplyDefaultsFromId();
    if (UHHHubSubsystem* Hub = GetWorld()->GetSubsystem<UHHHubSubsystem>())
    {
        Hub->RegisterStation(this);
    }
}

void AHHShelterStation::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (GetWorld())
    {
        if (UHHHubSubsystem* Hub = GetWorld()->GetSubsystem<UHHHubSubsystem>())
        {
            Hub->UnregisterStation(this);
        }
    }
    Super::EndPlay(EndPlayReason);
}

void AHHShelterStation::Interact(APlayerController* PlayerController)
{
    OnInteracted.Broadcast(StationId, PlayerController);
    if (UHHHubSubsystem* Hub = GetWorld()->GetSubsystem<UHHHubSubsystem>())
    {
        Hub->OpenStation(this);
    }
}

FText AHHShelterStation::GetPromptText() const
{
    return FText::Format(FText::FromString(TEXT("F  {0}  ·  {1}")), DisplayName, InteractionLabel);
}

FText AHHShelterStation::GetMenuTitle() const
{
    return FText::Format(FText::FromString(TEXT("{0}  /  {1}")), DisplayName, EnglishName);
}

TArray<FText> AHHShelterStation::GetMenuItems() const
{
    TArray<FText> Items;
    if (StationId == TEXT("PartyOffice"))
    {
        Items = { FText::FromString(TEXT("파티 구성")), FText::FromString(TEXT("파티원 교체")), FText::FromString(TEXT("던전 출정")) };
    }
    else if (StationId == TEXT("RankAssessment"))
    {
        Items = { FText::FromString(TEXT("현재 등급 측정")), FText::FromString(TEXT("스킬 재배치")), FText::FromString(TEXT("스킬 프리셋")) };
    }
    else if (StationId == TEXT("Crafting"))
    {
        Items = { FText::FromString(TEXT("무기 수리")), FText::FromString(TEXT("무기 제작")), FText::FromString(TEXT("장비 강화")) };
    }
    else if (StationId == TEXT("Training"))
    {
        Items = { FText::FromString(TEXT("기본 공격 훈련")), FText::FromString(TEXT("회피 훈련")), FText::FromString(TEXT("카운터 훈련")), FText::FromString(TEXT("스킬 시험")) };
    }
    else if (StationId == TEXT("RequestBoard"))
    {
        Items = { FText::FromString(TEXT("스토리 의뢰")), FText::FromString(TEXT("지역 의뢰")), FText::FromString(TEXT("보상 / 위험도")) };
    }
    else if (StationId == TEXT("MedicalBay"))
    {
        Items = { FText::FromString(TEXT("치료")), FText::FromString(TEXT("회복약 구입")), FText::FromString(TEXT("억제제 / 의약품")) };
    }
    else if (StationId == TEXT("RationKitchen"))
    {
        Items = { FText::FromString(TEXT("버프 음식 제작")), FText::FromString(TEXT("식량 구입")), FText::FromString(TEXT("오늘의 식단")) };
    }
    return Items;
}
