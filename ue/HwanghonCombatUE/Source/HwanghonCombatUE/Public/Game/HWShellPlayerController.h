#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "HWShellPlayerController.generated.h"

class SWidget;
class UHWQuestRunSubsystem;
class UHWProfileSubsystem;
class UHWGameContentSubsystem;
class AHWBossCharacter;

UCLASS()
class HWANGHONCOMBATUE_API AHWShellPlayerController : public APlayerController
{
    GENERATED_BODY()
public:
    AHWShellPlayerController();
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type Reason) override;
    virtual void Tick(float DeltaSeconds) override;

    bool IsLobby() const;
    bool IsCombatActive() const;
    bool IsPortrait() const;
    bool StartSelection(FName QuestId);
    bool ClaimSelection(FName QuestId);
    bool RetrySave();
    bool RetryEncounter();
    bool ReturnToLobby(bool bAbandon = false);
    void SetLeaveConfirmation(bool bOpen);
    void CombatAction(FName Action);
    void SetMoveHeld(int32 Direction, bool bHeld);

    UHWQuestRunSubsystem* Runs() const;
    UHWProfileSubsystem* Profile() const;
    UHWGameContentSubsystem* Content() const;
    AHWBossCharacter* Boss() const;
    FText GetUIError() const { return UIError; }
    TSharedPtr<SWidget> GetShellView() const { return ShellView; }

    bool bLeaveConfirmation = false;

private:
    TSharedPtr<SWidget> ShellView;
    FText UIError;
    bool HeldDirections[4] = {false, false, false, false};
};
