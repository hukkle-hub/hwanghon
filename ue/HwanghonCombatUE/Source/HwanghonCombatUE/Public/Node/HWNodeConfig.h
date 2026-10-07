#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "HWNodeConfig.generated.h"

// Outpost (node) data (docs/design/200). Namsan N-01 is the first data set, not a special case: Yongsan, Seoul
// Station and the Han river nodes are new configs on the same classes. The rules live in Node/HWNodeRules.h.

// Same order as HWNodeRules::EFacility / EEnemyRole / ENodeState (checked by static_assert in HWNodeConfig.cpp).
UENUM(BlueprintType)
enum class EHWNodeFacilityKind : uint8
{
    Gate,
    Generator,
    Comms
};

UENUM(BlueprintType)
enum class EHWNodeEnemyRole : uint8
{
    Normal,
    Runner,
    Breaker,
    Stalker,
    ArmoredElite
};

UENUM(BlueprintType)
enum class EHWNodeState : uint8
{
    Stable,
    Uneasy,
    Alert,
    Invasion,
    Recovering,
    Fallen,
    Retakeable,
    Retaking
};

// A graybox cube: centre, half size (cm), yaw and pitch (degrees). Top of a floor block = Center.Z + HalfExtent.Z.
USTRUCT(BlueprintType)
struct FHWNodeBlock
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FVector Center = FVector::ZeroVector;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FVector HalfExtent = FVector(100.f);

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Yaw = 0.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float Pitch = 0.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FLinearColor Color = FLinearColor(0.32f, 0.32f, 0.34f);
};

USTRUCT(BlueprintType)
struct FHWNodeFacilityDef
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    EHWNodeFacilityKind Kind = EHWNodeFacilityKind::Gate;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FName Id = NAME_None;

    // Centre on the floor (Z = floor top).
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FVector Location = FVector::ZeroVector;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FVector HalfExtent = FVector(300.f, 60.f, 350.f);

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    float MaxHealth = 30000.f;
};

UCLASS(BlueprintType)
class HWANGHONCOMBATUE_API UHWNodeConfig : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node")
    FName NodeId = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node")
    FString DisplayName;

    // Named reference points (cm, +X east, +Y north, plaza = origin).
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node")
    TMap<FName, FVector> Anchors;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Graybox")
    TArray<FHWNodeBlock> Blocks;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Facilities")
    TArray<FHWNodeFacilityDef> Facilities;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Play")
    FVector PlayerStart = FVector::ZeroVector;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Play")
    FVector TechnicianStart = FVector::ZeroVector;

    // Where the boss of the node stands when the last wave falls (Z = floor top).
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Play")
    FVector BossStart = FVector::ZeroVector;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Waves")
    TArray<FVector> SpawnPoints;

    // Waypoint routes (floor tops). The graybox is pads joined by ramps, so enemies walk these, not straight lines.
    // Main/West/East run from the checkpoint to the plaza; runners take a flank route round the gate wall.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Waves")
    TArray<FVector> MainRoute;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Waves")
    TArray<FVector> WestRoute;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Waves")
    TArray<FVector> EastRoute;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Waves")
    TArray<FVector> GeneratorRoute;  // plaza -> generator

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Waves")
    TArray<FVector> CommsRoute;      // plaza -> comms centre

    // Enemies inside this radius of the comms centre count as holding it (HWNodeRules CommsHoldToFall).
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Rules")
    float CommsHoldRadius = 700.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Rules")
    float CommsHoldToFall = 20.f;

    // Below this Z the player has fallen off the graybox and is put back at PlayerStart.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Play")
    float FallZ = -3200.f;

    // Content/Data/node_<id>.json -> config (docs/design/200). The same file drives the host-side walkability test
    // (tests/ue-node-config.test.cjs) and the preview page (tools/ue/node-graybox.html), so the three never drift.
    // Pads, ramps and walls become Blocks here with the same maths as tools/ue/node-graybox.js. Null if unreadable.
    static UHWNodeConfig* LoadFromJson(FName Id, UObject* Outer);

    FVector Anchor(FName Name) const
    {
        const FVector* Found = Anchors.Find(Name);
        return Found ? *Found : FVector::ZeroVector;
    }

    const FHWNodeFacilityDef* FindFacility(EHWNodeFacilityKind Kind) const
    {
        return Facilities.FindByPredicate([Kind](const FHWNodeFacilityDef& D) { return D.Kind == Kind; });
    }
};
