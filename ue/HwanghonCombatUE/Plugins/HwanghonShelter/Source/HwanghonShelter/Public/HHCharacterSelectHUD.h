#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "HHCharacterSelectHUD.generated.h"

class AHHFrontEndCinematicDirector;
class AHHCharacterSelectStand;

UENUM()
enum class EHHFrontEndScreen : uint8
{
    Title,
    RevealTransition,
    CharacterSelect,
    Connecting
};

UCLASS()
class HWANGHONSHELTER_API AHHCharacterSelectHUD : public AHUD
{
    GENERATED_BODY()

public:
    virtual void BeginPlay() override;
    virtual void DrawHUD() override;
    virtual void NotifyHitBoxClick(FName BoxName) override;

private:
    EHHFrontEndScreen Screen = EHHFrontEndScreen::Title;

    UPROPERTY(Transient)
    TObjectPtr<AHHFrontEndCinematicDirector> Director;

    UPROPERTY(Transient)
    TObjectPtr<AHHCharacterSelectStand> CharacterStand;

    void DrawTitle(float S);
    void DrawCharacterSelect(float S);
    void DrawConnecting(float S);

    void StartEntryReveal();
    void ConfirmSelection();
    void SelectRelative(int32 Delta);
    void SyncStandFromFlow();

    UPROPERTY(Transient)
    TObjectPtr<class UTexture2D> Logo;

    UFUNCTION()
    void HandleRevealFinished();

    UFUNCTION()
    void HandleConnectFinished();

    UFUNCTION()
    void HandleMatchmakingFailed(const FString& Reason);
};
