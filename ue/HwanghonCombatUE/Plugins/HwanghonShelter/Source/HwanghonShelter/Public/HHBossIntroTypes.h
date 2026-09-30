#pragma once

#include "CoreMinimal.h"
#include "HHBossIntroTypes.generated.h"

UENUM(BlueprintType)
enum class EHHBossIntroBeat : uint8
{
    PlayerEntry      UMETA(DisplayName="Player Entry"),
    Silhouette       UMETA(DisplayName="Silhouette"),
    ScaleReveal      UMETA(DisplayName="Scale Reveal"),
    SignatureMotion  UMETA(DisplayName="Signature Motion"),
    Handback         UMETA(DisplayName="Handback")
};

USTRUCT(BlueprintType)
struct HWANGHONSHELTER_API FHHBossIntroTimingProfile
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float PlayerEntryHold = 0.35f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float SilhouetteHold = 0.65f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float ScaleRevealHold = 0.75f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float SignatureHold = 1.00f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float HandbackHold = 0.35f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float DefaultBlend = 0.22f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float ShortVersionMultiplier = 0.55f;

    float GetHold(EHHBossIntroBeat Beat) const
    {
        switch (Beat)
        {
            case EHHBossIntroBeat::PlayerEntry: return PlayerEntryHold;
            case EHHBossIntroBeat::Silhouette: return SilhouetteHold;
            case EHHBossIntroBeat::ScaleReveal: return ScaleRevealHold;
            case EHHBossIntroBeat::SignatureMotion: return SignatureHold;
            case EHHBossIntroBeat::Handback: return HandbackHold;
            default: return 0.4f;
        }
    }
};

namespace HHBossIntroProfiles
{
    HWANGHONSHELTER_API FHHBossIntroTimingProfile Resolve(FName BossId);
}
