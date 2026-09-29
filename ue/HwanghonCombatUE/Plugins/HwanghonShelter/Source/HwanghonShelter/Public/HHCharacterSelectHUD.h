#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "HHCharacterSelectHUD.generated.h"

class AHHFrontEndCinematicDirector;

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

    void DrawTitle(float S);
    void DrawCharacterSelect(float S);
    void DrawConnecting(float S);

    void DrawCharacterCard(
        const TCHAR* Id,
        const TCHAR* KoreanName,
        const TCHAR* RoleLabel,
        const FLinearColor& Accent,
        float X, float Y, float W, float H,
        bool bSelected);

    void StartEntryReveal();
    void UpdateHeroLights(FName Selected);

    UPROPERTY(Transient)
    TObjectPtr<class UTexture2D> Logo;

    FName LitHero = TEXT("__none__");
    float HeroLightOn = 400.f;   // candela
    float HeroLightOff = 25.f;
    void ConfirmSelection();

    UFUNCTION()
    void HandleRevealFinished();

    UFUNCTION()
    void HandleConnectFinished();

    UFUNCTION()
    void HandleMatchmakingFailed(const FString& Reason);
};
