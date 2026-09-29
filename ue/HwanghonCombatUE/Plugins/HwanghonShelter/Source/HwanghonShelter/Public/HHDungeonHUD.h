#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "HHDungeonHUD.generated.h"

UCLASS()
class HWANGHONSHELTER_API AHHDungeonHUD : public AHUD
{
    GENERATED_BODY()

public:
    virtual void DrawHUD() override;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|HUD")
    float HealthRatio = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|HUD")
    float ResourceRatio = 1.0f;

private:
    void DrawPanel(float X,float Y,float W,float H,const FLinearColor& Color) const;
    void DrawBar(float X,float Y,float W,float H,float Ratio,const FLinearColor& Fill,const FLinearColor& Back) const;

    void DrawPlayerCombatState(float S);
    void DrawSkillBar(float S);
    void DrawPartyCompact(float S);
};
