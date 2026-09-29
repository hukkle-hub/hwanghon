#include "HHShelterNPC.h"
#include "HHHubSubsystem.h"

#include "Components/SceneComponent.h"
#include "Components/SphereComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/Texture2D.h"
#include "Engine/StaticMesh.h"
#include "GameFramework/PlayerController.h"
#include "UObject/ConstructorHelpers.h"

AHHShelterNPC::AHHShelterNPC()
{
    PrimaryActorTick.bCanEverTick = false;

    Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    SetRootComponent(Root);

    InteractionVolume = CreateDefaultSubobject<USphereComponent>(TEXT("InteractionVolume"));
    InteractionVolume->SetupAttachment(Root);
    InteractionVolume->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
    InteractionVolume->SetCollisionObjectType(ECC_WorldDynamic);
    InteractionVolume->SetCollisionResponseToAllChannels(ECR_Ignore);
    InteractionVolume->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);

    ProxyMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("ProxyMesh"));
    ProxyMesh->SetupAttachment(Root);
    ProxyMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    ProxyMesh->SetRelativeLocation(FVector(0.f, 0.f, 90.f));
    ProxyMesh->SetRelativeScale3D(FVector(0.42f, 0.42f, 1.75f));

    static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderFinder(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    if (CylinderFinder.Succeeded())
    {
        ProxyMesh->SetStaticMesh(CylinderFinder.Object);
    }

    NamePlate = CreateDefaultSubobject<UTextRenderComponent>(TEXT("NamePlate"));
    NamePlate->SetupAttachment(Root);
    NamePlate->SetRelativeLocation(FVector(0.f, 0.f, 205.f));
    NamePlate->SetHorizontalAlignment(EHTA_Center);
    NamePlate->SetWorldSize(24.f);
}

void AHHShelterNPC::ApplyProfileDefaults()
{
    auto SetTextIfEmpty = [](FText& Target, const TCHAR* Text)
    {
        if (Target.IsEmpty()) Target = FText::FromString(Text);
    };

    if (NPCId == TEXT("Matteo"))
    {
        SetTextIfEmpty(DisplayName, TEXT("마태오"));
        SetTextIfEmpty(RoleName, TEXT("인력사무소 소장"));
        SetTextIfEmpty(StationUseLabel, TEXT("파티 구성 / 출정"));
        if (DialogueLines.IsEmpty())
        {
            DialogueLines = {
                FText::FromString(TEXT("왔으면 앉아. 서류는 도망 안 가.")),
                FText::FromString(TEXT("파티는 네가 정해. 대신 살아서 돌아와. 기록은 내가 할 테니까.")),
                FText::FromString(TEXT("강남역 의뢰가 하나 있다. 돈보다 먼저 조건부터 읽어."))
            };
        }
        AccentColor = FLinearColor(0.75f, 0.34f, 0.12f, 1.f);
    }
    else if (NPCId == TEXT("Yujin"))
    {
        SetTextIfEmpty(DisplayName, TEXT("유진"));
        SetTextIfEmpty(RoleName, TEXT("각인 평가원"));
        SetTextIfEmpty(StationUseLabel, TEXT("등급 측정 / 스킬 재배치"));
        if (DialogueLines.IsEmpty())
        {
            DialogueLines = {
                FText::FromString(TEXT("…무등록이시네요.")),
                FText::FromString(TEXT("손 올려두세요. 움직이지 말고.")),
                FText::FromString(TEXT("수치는 기록할게요. 의미까지 안다고는 안 했어요."))
            };
        }
        AccentColor = FLinearColor(0.28f, 0.60f, 0.92f, 1.f);
    }
    else if (NPCId == TEXT("HanJangin"))
    {
        SetTextIfEmpty(DisplayName, TEXT("한 장인"));
        SetTextIfEmpty(RoleName, TEXT("무기 장인"));
        SetTextIfEmpty(StationUseLabel, TEXT("수리 / 제작 / 강화"));
        if (DialogueLines.IsEmpty())
        {
            DialogueLines = {
                FText::FromString(TEXT("놔.")),
                FText::FromString(TEXT("금 간 곳부터 본다.")),
                FText::FromString(TEXT("강화는 세게 만드는 게 아니다. 버틸 곳을 정하는 거다."))
            };
        }
        AccentColor = FLinearColor(0.96f, 0.43f, 0.08f, 1.f);
    }
    else if (NPCId == TEXT("OJeonggil"))
    {
        SetTextIfEmpty(DisplayName, TEXT("오정길"));
        SetTextIfEmpty(RoleName, TEXT("경비 · 길잡이 / 훈련 보조"));
        SetTextIfEmpty(StationUseLabel, TEXT("허수아비 / 카운터 훈련"));
        if (DialogueLines.IsEmpty())
        {
            DialogueLines = {
                FText::FromString(TEXT("허수아비라고 얕보지 마.")),
                FText::FromString(TEXT("무기 끝 말고 어깨랑 발을 봐. 먼저 움직이는 쪽이 있다.")),
                FText::FromString(TEXT("카운터는 빠른 손이 아니라, 늦지 않는 눈이다."))
            };
        }
    }
    else if (NPCId == TEXT("Duho"))
    {
        SetTextIfEmpty(DisplayName, TEXT("두호"));
        SetTextIfEmpty(RoleName, TEXT("현장 심부름꾼 · 정보 회수"));
        SetTextIfEmpty(StationUseLabel, TEXT("의뢰 / 지역 정보"));
        if (DialogueLines.IsEmpty())
        {
            DialogueLines = {
                FText::FromString(TEXT("밖에서 주운 지도 있어요. 공짜는 아니고.")),
                FText::FromString(TEXT("빨간 표시 있는 길은 가지 마요. 어제까진 길이었는데 오늘은 아니에요.")),
                FText::FromString(TEXT("의뢰 고르면 위치까지 찍어줄게요."))
            };
        }
        AccentColor = FLinearColor(0.70f, 0.70f, 0.50f, 1.f);
    }
    else if (NPCId == TEXT("DrJin"))
    {
        SetTextIfEmpty(DisplayName, TEXT("닥터 진"));
        SetTextIfEmpty(RoleName, TEXT("의무관"));
        SetTextIfEmpty(StationUseLabel, TEXT("치료 / 회복약 / 억제제"));
        if (DialogueLines.IsEmpty())
        {
            DialogueLines = {
                FText::FromString(TEXT("앉아. 상처부터 본다.")),
                FText::FromString(TEXT("회복됐다고 끝난 게 아니야. 코어 수치도 같이 본다.")),
                FText::FromString(TEXT("이건 치료제가 아니야. 성숙을 늦추는 것뿐이지."))
            };
        }
        AccentColor = FLinearColor(0.18f, 0.68f, 0.65f, 1.f);
    }
    else if (NPCId == TEXT("Suhui"))
    {
        SetTextIfEmpty(DisplayName, TEXT("수희"));
        SetTextIfEmpty(RoleName, TEXT("배급 총괄"));
        SetTextIfEmpty(StationUseLabel, TEXT("음식 제작 / 버프 음식"));
        if (DialogueLines.IsEmpty())
        {
            DialogueLines = {
                FText::FromString(TEXT("한 사람당 두 통! 더는 없어요!")),
                FText::FromString(TEXT("오늘 나갈 거면 이쪽. 오래 버티는 건 맛보다 칼로리야.")),
                FText::FromString(TEXT("버프 음식은 출정 전에 먹어. 돌아와서 먹으면 그냥 밥이야."))
            };
        }
        AccentColor = FLinearColor(0.88f, 0.63f, 0.22f, 1.f);
    }
}

void AHHShelterNPC::RefreshEditorVisuals()
{
    InteractionVolume->SetSphereRadius(InteractionRadius);
    NamePlate->SetText(FText::Format(FText::FromString(TEXT("{0}\n{1}")), DisplayName, RoleName));
    NamePlate->SetTextRenderColor(AccentColor.ToFColor(true));
}

void AHHShelterNPC::OnConstruction(const FTransform& Transform)
{
    Super::OnConstruction(Transform);
    ApplyProfileDefaults();
    RefreshEditorVisuals();
}

void AHHShelterNPC::SpawnConfiguredVisual()
{
    if (VisualActorClass.IsNull() || !GetWorld())
    {
        ProxyMesh->SetVisibility(true);
        return;
    }

    UClass* LoadedClass = VisualActorClass.LoadSynchronous();
    if (!LoadedClass)
    {
        ProxyMesh->SetVisibility(true);
        return;
    }

    FActorSpawnParameters Params;
    Params.Owner = this;
    Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

    SpawnedVisualActor = GetWorld()->SpawnActor<AActor>(LoadedClass, GetActorTransform(), Params);
    if (SpawnedVisualActor)
    {
        SpawnedVisualActor->SetActorEnableCollision(false);
        SpawnedVisualActor->AttachToActor(this, FAttachmentTransformRules::KeepWorldTransform);
        ProxyMesh->SetVisibility(false);
    }
}

void AHHShelterNPC::BeginPlay()
{
    Super::BeginPlay();
    ApplyProfileDefaults();
    RefreshEditorVisuals();
    SpawnConfiguredVisual();

    if (UHHHubSubsystem* Hub = GetWorld()->GetSubsystem<UHHHubSubsystem>())
    {
        Hub->RegisterNPC(this);
    }
}

void AHHShelterNPC::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (GetWorld())
    {
        if (UHHHubSubsystem* Hub = GetWorld()->GetSubsystem<UHHHubSubsystem>())
        {
            Hub->UnregisterNPC(this);
        }
    }

    if (SpawnedVisualActor)
    {
        SpawnedVisualActor->Destroy();
        SpawnedVisualActor = nullptr;
    }

    Super::EndPlay(EndPlayReason);
}

void AHHShelterNPC::Interact(APlayerController* PlayerController)
{
    OnInteracted.Broadcast(NPCId, PlayerController);
    if (UHHHubSubsystem* Hub = GetWorld()->GetSubsystem<UHHHubSubsystem>())
    {
        Hub->OpenNPC(this);
    }
}

void AHHShelterNPC::StartDialogue()
{
    CurrentDialogueIndex = 0;
}

bool AHHShelterNPC::AdvanceDialogue()
{
    if (DialogueLines.IsEmpty())
    {
        return false;
    }

    ++CurrentDialogueIndex;
    return DialogueLines.IsValidIndex(CurrentDialogueIndex);
}

FText AHHShelterNPC::GetCurrentDialogueText() const
{
    if (DialogueLines.IsValidIndex(CurrentDialogueIndex))
    {
        return DialogueLines[CurrentDialogueIndex];
    }
    return FText::GetEmpty();
}

FText AHHShelterNPC::GetPromptText() const
{
    return FText::Format(
        FText::FromString(TEXT("F  대화하기  ·  {0}  /  {1}")),
        DisplayName,
        RoleName
    );
}

UTexture2D* AHHShelterNPC::LoadPortraitTexture() const
{
    return PortraitTexture.IsNull() ? nullptr : PortraitTexture.LoadSynchronous();
}
