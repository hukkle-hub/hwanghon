#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "HHShelterHUD.generated.h"

class AHHShelterStation;
class AHHShelterNPC;

UCLASS()
class HWANGHONSHELTER_API AHHShelterHUD : public AHUD
{
    GENERATED_BODY()

public:
    virtual void DrawHUD() override;

    // Prototype values. Replace with real character ViewModel/state in project integration.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|HUD")
    float HealthRatio = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|HUD")
    float ResourceRatio = 1.0f;

private:
    void DrawPanel(float X, float Y, float W, float H, const FLinearColor& Color) const;
    void DrawBar(float X, float Y, float W, float H, float Ratio, const FLinearColor& Fill, const FLinearColor& Back) const;

    void DrawMinimalStatus(float Scale);
    void DrawReturnHint(float Scale);
    void DrawPartyCompact(float Scale);

    void DrawStationPrompt(AHHShelterStation* Station, float Scale);
    void DrawStationMenu(AHHShelterStation* Station, float Scale);
    void DrawNPCPrompt(AHHShelterNPC* NPC, float Scale);
    void DrawNPCDialogue(AHHShelterNPC* NPC, float Scale);
};
