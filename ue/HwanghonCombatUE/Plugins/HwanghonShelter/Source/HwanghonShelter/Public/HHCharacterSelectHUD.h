#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "HHCharacterSelectHUD.generated.h"

UCLASS()
class HWANGHONSHELTER_API AHHCharacterSelectHUD : public AHUD
{
    GENERATED_BODY()

public:
    virtual void BeginPlay() override;
    virtual void DrawHUD() override;
    virtual void NotifyHitBoxClick(FName BoxName) override;

private:
    void DrawCharacterCard(
        const TCHAR* Id,
        const TCHAR* KoreanName,
        const TCHAR* RoleLabel,
        const TCHAR* Summary,
        const FLinearColor& Accent,
        float X, float Y, float W, float H,
        bool bSelected);

    void ConfirmSelection();
};
