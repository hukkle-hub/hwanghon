#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "HWNodeConfig.generated.h"

// Outpost (node) data (docs/design/200, 201). Namsan N-01 is the first data set, not a special case: Yongsan, Seoul
// Station and the Han river nodes are new Content/Data/node_<id>.json files on the same classes.
// The rules live in Node/HWNodeRules.h.

// Same order as HWNodeRules::EFacility / EEnemyRole / ENodeState / ENpcRole (static_assert in HWNodeConfig.cpp).
UENUM(BlueprintType)
enum class EHWNodeFacilityKind : uint8
{
    Gate,
    Generator,
    Comms,
    Turret,
    Barricade
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

UENUM(BlueprintType)
enum class EHWNodeNpcRole : uint8
{
    Technician,
    Medic,
    Scout,
    Operator,
    Guard
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

USTRUCT(BlueprintType)
struct FHWNodeNpcDef
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FName Id = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    EHWNodeNpcRole Role = EHWNodeNpcRole::Technician;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FVector Location = FVector::ZeroVector;

    // Route (in Routes) from the plaza to this NPC: how the enemies that hunt NPCs get there.
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FName Route = NAME_None;
};

// A waypoint list (floor tops). Wrapped because a UPROPERTY map cannot hold a TArray directly.
USTRUCT(BlueprintType)
struct FHWNodeRoute
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<FVector> Points;
};

USTRUCT(BlueprintType)
struct FHWNodeRouteChoice
{
    GENERATED_BODY()

    // One is picked per enemy, alternating (the runners split between the two flank trails).
    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    TArray<FName> Routes;
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

    // Gate, generator, comms centre and turrets.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Facilities")
    TArray<FHWNodeFacilityDef> Facilities;

    // Barricades are built here during preparation with supplies (kind Barricade).
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Facilities")
    TArray<FHWNodeFacilityDef> BarricadeSlots;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|NPC")
    TArray<FHWNodeNpcDef> Npcs;

    // Where a missing NPC is held - the player rescues them there.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|NPC")
    FVector HoldingSpot = FVector::ZeroVector;

    // The medic heals a player standing here.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|NPC")
    FVector MedicalBay = FVector::ZeroVector;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Play")
    FVector PlayerStart = FVector::ZeroVector;

    // Where the boss of the node stands when the last wave falls (Z = floor top).
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Play")
    FVector BossStart = FVector::ZeroVector;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Waves")
    TArray<FVector> SpawnPoints;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Waves")
    TArray<FVector> NorthSpawnPoints;

    // Waypoint routes by name: main/west/east/west_loop/east_forest/north run from the outside to the plaza or a
    // target; generator/comms/medical/comms_tower/gate run from the plaza to a facility or NPC.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Waves")
    TMap<FName, FHWNodeRoute> Routes;

    // Which route each role walks from its spawn.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Waves")
    TMap<EHWNodeEnemyRole, FHWNodeRouteChoice> RoleRoutes;

    // Supply points for the next defence when no guild has allocated any (?HWSupply= overrides).
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Rules")
    int32 DefaultSupply = 6;

    // Enemies inside this radius of the comms centre count as holding it (HWNodeRules CommsHoldToFall).
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Rules")
    float CommsHoldRadius = 700.f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Rules")
    float CommsHoldToFall = 20.f;

    // Below this Z the player has fallen off the graybox and is put back at PlayerStart.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Node|Play")
    float FallZ = -3200.f;

    // Content/Data/node_<id>.json -> config. The same file drives the host-side walkability test
    // (tests/ue-node-config.test.cjs) and the preview page (tools/ue/node-graybox.html), so the three never drift.
    // Pads, ramps and walls become Blocks with the same maths as tools/ue/node-graybox.js. Null if unreadable.
    static UHWNodeConfig* LoadFromJson(FName Id, UObject* Outer);

    FVector Anchor(FName Key) const
    {
        const FVector* Found = Anchors.Find(Key);
        return Found ? *Found : FVector::ZeroVector;
    }

    // Empty when the route does not exist.
    const TArray<FVector>& Route(FName Key) const
    {
        static const TArray<FVector> Empty;
        const FHWNodeRoute* Found = Routes.Find(Key);
        return Found ? Found->Points : Empty;
    }

    // The route a new enemy of this role walks; Serial alternates between choices.
    FName RouteForRole(EHWNodeEnemyRole EnemyRole, int32 Serial) const
    {
        const FHWNodeRouteChoice* Choice = RoleRoutes.Find(EnemyRole);
        if (!Choice || Choice->Routes.Num() == 0) return TEXT("main");
        return Choice->Routes[Serial % Choice->Routes.Num()];
    }

    const FHWNodeFacilityDef* FindFacility(EHWNodeFacilityKind Kind) const
    {
        return Facilities.FindByPredicate([Kind](const FHWNodeFacilityDef& D) { return D.Kind == Kind; });
    }

    // The route graph (docs/design/201 §9): every route point is a node, neighbouring points and the JSON "links" are
    // edges, and routes that share a point join there. An enemy that changes target walks this graph's shortest path
    // instead of a straight line through walls and over drops. Same maths as tools/ue/node-graph.js.
    void BuildGraph(const TArray<TPair<FVector, FVector>>& ExtraLinks);
    int32 NearestGraphNode(const FVector& At) const;

    // Points from the node nearest From to the node nearest To; empty when they are not connected.
    TArray<FVector> PathBetween(const FVector& From, const FVector& To) const;

    // Not reflected (nested arrays): rebuilt by LoadFromJson.
    TArray<FVector> GraphNodes;
    TArray<TArray<int32>> GraphEdges;
};
