#pragma once

#include "CoreMinimal.h"
#include "Camera/CameraActor.h"
#include "HHBossIntroTypes.h"
#include "HHBossIntroAnchor.generated.h"

UCLASS(BlueprintType)
class HWANGHONSHELTER_API AHHBossIntroAnchor : public ACameraActor
{
    GENERATED_BODY()

public:
    AHHBossIntroAnchor();

    // Must match the Director BossId.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|BossIntro")
    FName BossId = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|BossIntro")
    EHHBossIntroBeat Beat = EHHBossIntroBeat::PlayerEntry;

    // < 0 = use the built-in boss profile.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|BossIntro")
    float HoldOverride = -1.f;

    // < 0 = use the built-in boss profile.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|BossIntro")
    float BlendOverride = -1.f;
};
