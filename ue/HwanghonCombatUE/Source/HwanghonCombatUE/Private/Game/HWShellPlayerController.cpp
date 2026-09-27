#include "Game/HWShellPlayerController.h"
#include "Game/HWShellGameMode.h"
#include "Game/HWQuestRunSubsystem.h"
#include "Progression/HWProfileSubsystem.h"
#include "Content/HWGameContentSubsystem.h"
#include "Character/HWAinCharacter.h"
#include "Boss/HWBossCharacter.h"
#include "Combat/HWCombatComponent.h"
#include "Camera/HWLockOnComponent.h"
#include "Engine/GameInstance.h"
#include "Engine/GameViewportClient.h"
#include "Kismet/GameplayStatics.h"
#include "Widgets/SWidget.h"

TSharedRef<SWidget> HWCreateShellView(AHWShellPlayerController* Controller);
#if !UE_BUILD_SHIPPING
void HWTickShellQA(AHWShellPlayerController& Controller);
#endif

AHWShellPlayerController::AHWShellPlayerController()
{
    PrimaryActorTick.bCanEverTick = true;
    bShowMouseCursor = true;
    bEnableClickEvents = true;
    bEnableTouchEvents = true;
}

void AHWShellPlayerController::BeginPlay()
{
    Super::BeginPlay();
    if (!IsLocalController() || !GetGameInstance() || !GetGameInstance()->GetGameViewportClient()) { return; }
    ShellView = HWCreateShellView(this);
    GetGameInstance()->GetGameViewportClient()->AddViewportWidgetContent(ShellView.ToSharedRef(), 20);
    FInputModeGameAndUI Mode;
    Mode.SetHideCursorDuringCapture(false);
    Mode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
    SetInputMode(Mode);
    if (!IsLobby()) { SetControlRotation(FRotator(-12.f, 0.f, 0.f)); }
}

void AHWShellPlayerController::EndPlay(const EEndPlayReason::Type Reason)
{
    if (ShellView && GetGameInstance() && GetGameInstance()->GetGameViewportClient())
    {
        GetGameInstance()->GetGameViewportClient()->RemoveViewportWidgetContent(ShellView.ToSharedRef());
    }
    ShellView.Reset();
    Super::EndPlay(Reason);
}

void AHWShellPlayerController::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (IsCombatActive() && !bLeaveConfirmation && GetPawn())
    {
        const FRotator Yaw(0.f, GetControlRotation().Yaw, 0.f);
        GetPawn()->AddMovementInput(FRotationMatrix(Yaw).GetUnitAxis(EAxis::X), float(HeldDirections[0]) - float(HeldDirections[1]));
        GetPawn()->AddMovementInput(FRotationMatrix(Yaw).GetUnitAxis(EAxis::Y), float(HeldDirections[3]) - float(HeldDirections[2]));
    }
    else
    {
        for (bool& Held : HeldDirections) { Held = false; }
    }
#if !UE_BUILD_SHIPPING
    HWTickShellQA(*this);
#endif
}

UHWQuestRunSubsystem* AHWShellPlayerController::Runs() const { return GetGameInstance() ? GetGameInstance()->GetSubsystem<UHWQuestRunSubsystem>() : nullptr; }
UHWProfileSubsystem* AHWShellPlayerController::Profile() const { return GetGameInstance() ? GetGameInstance()->GetSubsystem<UHWProfileSubsystem>() : nullptr; }
UHWGameContentSubsystem* AHWShellPlayerController::Content() const { return GetGameInstance() ? GetGameInstance()->GetSubsystem<UHWGameContentSubsystem>() : nullptr; }
AHWBossCharacter* AHWShellPlayerController::Boss() const { return Cast<AHWBossCharacter>(UGameplayStatics::GetActorOfClass(this, AHWBossCharacter::StaticClass())); }
bool AHWShellPlayerController::IsLobby() const { return GetWorld() && Cast<AHWShellGameMode>(GetWorld()->GetAuthGameMode()) != nullptr; }
bool AHWShellPlayerController::IsCombatActive() const { return Runs() && Runs()->GetRunState() == EHWQuestRunState::InCombat; }
bool AHWShellPlayerController::IsPortrait() const { int32 X = 0, Y = 0; GetViewportSize(X, Y); return X < Y; }

bool AHWShellPlayerController::StartSelection(FName QuestId)
{
    UIError = FText::GetEmpty();
    UHWQuestRunSubsystem* Flow = Runs();
    if (Flow && (QuestId.IsNone() ? Flow->PrepareTraining() : Flow->PrepareQuest(QuestId)) && Flow->OpenPreparedEncounter()) { return true; }
    UIError = FText::FromString(TEXT("출격할 수 없습니다. 저장 상태와 훈련장 준비 상태를 확인해 주세요."));
    return false;
}

bool AHWShellPlayerController::ClaimSelection(FName QuestId)
{
    UIError = FText::GetEmpty();
    if (Profile() && Profile()->ClaimQuest(QuestId)) { return true; }
    UIError = FText::FromString(TEXT("보수를 저장하지 못했습니다. 저장 재시도를 눌러 주세요."));
    return false;
}

bool AHWShellPlayerController::RetrySave()
{
    UIError = FText::GetEmpty();
    bool bSaved = false;
    if (Runs() && Runs()->GetRunState() == EHWQuestRunState::VictoryPendingSave) { bSaved = Runs()->RetryVictorySave(); }
    else if (Profile()) { bSaved = Profile()->RetryPendingSave(); }
    if (!bSaved) { UIError = FText::FromString(TEXT("저장하지 못했습니다. 저장 공간을 확인하고 다시 시도해 주세요.")); }
    return bSaved;
}

bool AHWShellPlayerController::RetryEncounter()
{
    UIError = FText::GetEmpty();
    if (Runs() && Runs()->RetryEncounter()) { return true; }
    UIError = FText::FromString(TEXT("재도전할 수 없습니다. 저장을 마친 뒤 다시 시도해 주세요."));
    return false;
}

bool AHWShellPlayerController::ReturnToLobby(bool bAbandon)
{
    UIError = FText::GetEmpty();
    if (Runs() && Runs()->ReturnToLobby(bAbandon)) { SetLeaveConfirmation(false); return true; }
    UIError = FText::FromString(TEXT("복귀하지 못했습니다. 저장을 마친 뒤 다시 시도해 주세요."));
    return false;
}

void AHWShellPlayerController::SetLeaveConfirmation(bool bOpen)
{
    if (bOpen && !IsCombatActive()) { return; }
    if (bOpen) { UIError = FText::GetEmpty(); }
    bLeaveConfirmation = bOpen;
    SetPause(bOpen);
    for (bool& Held : HeldDirections) { Held = false; }
}

void AHWShellPlayerController::SetMoveHeld(int32 Direction, bool bHeld)
{
    if (Direction >= 0 && Direction < 4) { HeldDirections[Direction] = bHeld && IsCombatActive() && !bLeaveConfirmation; }
}

void AHWShellPlayerController::CombatAction(FName Action)
{
    AHWAinCharacter* Ain = Cast<AHWAinCharacter>(GetPawn());
    if (!IsCombatActive() || bLeaveConfirmation || !Ain || Ain->GetCombat()->IsDead()) { return; }
    UHWCombatComponent* Combat = Ain->GetCombat();
    if (Action == TEXT("Attack")) { Combat->RequestAttack(); }
    else if (Action == TEXT("Smash")) { Combat->RequestSmash(); }
    else if (Action == TEXT("Dodge")) { Combat->RequestDodge(); }
    else if (Action == TEXT("Jump")) { Combat->RequestJump(); }
    else if (Action == TEXT("Counter")) { Combat->RequestCounter(); }
    else if (Action == TEXT("Lock")) { Ain->GetLockOn()->ToggleLockOn(); }
}
