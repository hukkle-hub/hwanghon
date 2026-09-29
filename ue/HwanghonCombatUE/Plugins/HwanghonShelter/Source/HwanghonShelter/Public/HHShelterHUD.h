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

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|HUD")
    FString PlayerName = TEXT("아인");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|HUD")
    int32 PlayerLevel = 32;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|HUD")
    float HealthRatio = 0.86f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|HUD")
    float ResourceRatio = 0.80f;

private:
    void DrawPanel(float X, float Y, float W, float H, const FLinearColor& Color) const;
    void DrawBar(float X, float Y, float W, float H, float Ratio, const FLinearColor& Fill, const FLinearColor& Back) const;
    void DrawPlayerSummary(float Scale);
    void DrawQuestRail(float Scale);
    void DrawSkillBar(float Scale);
    void DrawMiniMap(float Scale);
    void DrawPartyPanel(float Scale);
    void DrawStationPrompt(AHHShelterStation* Station, float Scale);
    void DrawStationMenu(AHHShelterStation* Station, float Scale);
    void DrawNPCPrompt(AHHShelterNPC* NPC, float Scale);
    void DrawNPCDialogue(AHHShelterNPC* NPC, float Scale);
};
