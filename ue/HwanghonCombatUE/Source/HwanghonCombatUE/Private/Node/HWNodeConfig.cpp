#include "Node/HWNodeConfig.h"
#include "Node/HWNodeRules.h"

#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "UObject/Package.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

static_assert(static_cast<int>(EHWNodeFacilityKind::Comms) == static_cast<int>(HWNodeRules::EFacility::Comms), "facility order");
static_assert(static_cast<int>(EHWNodeFacilityKind::Barricade) == static_cast<int>(HWNodeRules::EFacility::Barricade), "facility order");
static_assert(static_cast<int>(EHWNodeEnemyRole::ArmoredElite) == static_cast<int>(HWNodeRules::EEnemyRole::ArmoredElite), "role order");
static_assert(static_cast<int>(EHWNodeState::Retaking) == static_cast<int>(HWNodeRules::ENodeState::Retaking), "state order");
static_assert(static_cast<int>(EHWNodeNpcRole::Guard) == static_cast<int>(HWNodeRules::ENpcRole::Guard), "npc role order");

// Same maths as tools/ue/node-graybox.js (checked there against every route). A named namespace, not an anonymous
// one: unity builds paste .cpp files together and anonymous helpers of two files would collide.
namespace HWNodeConfigLocal
{
    const FLinearColor GroundColor(0.30f, 0.30f, 0.32f);
    const FLinearColor RoadColor(0.22f, 0.22f, 0.24f);
    const FLinearColor TrailColor(0.24f, 0.27f, 0.22f);
    const FLinearColor WallColor(0.46f, 0.44f, 0.40f);
    const FLinearColor BuildingColor(0.40f, 0.38f, 0.46f);
    const FLinearColor CoverColor(0.62f, 0.55f, 0.38f);
    constexpr float SlabThick = 40.f;

    bool ReadVector(const TSharedPtr<FJsonValue>& Value, FVector& Out)
    {
        const TArray<TSharedPtr<FJsonValue>>* JsonArr = nullptr;
        if (!Value.IsValid() || !Value->TryGetArray(JsonArr) || JsonArr->Num() < 3) return false;
        Out = FVector((*JsonArr)[0]->AsNumber(), (*JsonArr)[1]->AsNumber(), (*JsonArr)[2]->AsNumber());
        return true;
    }

    // "at": an anchor name or an [x, y, z] point
    bool ReadPoint(const TSharedPtr<FJsonObject>& JsonObj, const TCHAR* FieldName, const TMap<FName, FVector>& Anchors, FVector& Out)
    {
        FString AnchorName;
        if (JsonObj->TryGetStringField(FieldName, AnchorName))
        {
            const FVector* Found = Anchors.Find(FName(*AnchorName));
            if (!Found) return false;
            Out = *Found;
            return true;
        }
        return ReadVector(JsonObj->TryGetField(FieldName), Out);
    }

    void ReadPointList(const TArray<TSharedPtr<FJsonValue>>& Values, TArray<FVector>& Out)
    {
        for (const TSharedPtr<FJsonValue>& V : Values)
        {
            FVector P;
            if (ReadVector(V, P)) Out.Add(P);
        }
    }

    void ReadPoints(const TSharedPtr<FJsonObject>& JsonObj, const TCHAR* FieldName, TArray<FVector>& Out)
    {
        const TArray<TSharedPtr<FJsonValue>>* JsonArr = nullptr;
        if (JsonObj.IsValid() && JsonObj->TryGetArrayField(FieldName, JsonArr)) ReadPointList(*JsonArr, Out);
    }

    FHWNodeBlock Pad(const FVector& Top, float HalfX, float HalfY, bool bTrail)
    {
        FHWNodeBlock B;
        B.Center = FVector(Top.X, Top.Y, Top.Z - SlabThick * 0.5f);
        B.HalfExtent = FVector(HalfX, HalfY, SlabThick * 0.5f);
        B.Color = bTrail ? TrailColor : GroundColor;
        return B;
    }

    // Sloped slab whose top line runs from A to B (floor tops).
    FHWNodeBlock Ramp(const FVector& A, const FVector& B, float HalfWidth, bool bTrail)
    {
        const FVector D = B - A;
        const float Run = FVector(D.X, D.Y, 0.f).Size();
        const FRotator Rot(FMath::RadiansToDegrees(FMath::Atan2(D.Z, Run)), FMath::RadiansToDegrees(FMath::Atan2(D.Y, D.X)), 0.f);
        FHWNodeBlock R;
        R.Center = (A + B) * 0.5f - Rot.RotateVector(FVector::UpVector) * (SlabThick * 0.5f);
        R.HalfExtent = FVector(D.Size() * 0.5f + 40.f, HalfWidth, SlabThick * 0.5f);
        R.Yaw = Rot.Yaw;
        R.Pitch = Rot.Pitch;
        R.Color = bTrail ? TrailColor : RoadColor;
        return R;
    }

    // x0..x1 at y (east-west) or y0..y1 at x (north-south); kind wall / building / cover sets the colour.
    bool Wall(const TSharedPtr<FJsonObject>& JsonObj, FHWNodeBlock& Out)
    {
        double HalfDepth = 50.0, Floor = 0.0, Height = 0.0, A0 = 0.0, A1 = 0.0, Along = 0.0;
        if (!JsonObj->TryGetNumberField(TEXT("floor"), Floor) || !JsonObj->TryGetNumberField(TEXT("height"), Height)) return false;
        JsonObj->TryGetNumberField(TEXT("half_depth"), HalfDepth);
        FString WallKind;
        JsonObj->TryGetStringField(TEXT("kind"), WallKind);
        if (JsonObj->TryGetNumberField(TEXT("y0"), A0) && JsonObj->TryGetNumberField(TEXT("y1"), A1) && JsonObj->TryGetNumberField(TEXT("x"), Along))
        {
            Out.Center = FVector(Along, (A0 + A1) * 0.5, Floor + Height * 0.5);
            Out.HalfExtent = FVector(HalfDepth, FMath::Abs(A1 - A0) * 0.5, Height * 0.5);
        }
        else if (JsonObj->TryGetNumberField(TEXT("x0"), A0) && JsonObj->TryGetNumberField(TEXT("x1"), A1) && JsonObj->TryGetNumberField(TEXT("y"), Along))
        {
            Out.Center = FVector((A0 + A1) * 0.5, Along, Floor + Height * 0.5);
            Out.HalfExtent = FVector(FMath::Abs(A1 - A0) * 0.5, HalfDepth, Height * 0.5);
        }
        else
        {
            return false;
        }
        Out.Color = WallKind == TEXT("building") ? BuildingColor : WallKind == TEXT("cover") ? CoverColor : WallColor;
        return true;
    }

    bool FacilityKind(const FString& Key, EHWNodeFacilityKind& Out)
    {
        if (Key == TEXT("gate")) { Out = EHWNodeFacilityKind::Gate; return true; }
        if (Key == TEXT("generator")) { Out = EHWNodeFacilityKind::Generator; return true; }
        if (Key == TEXT("comms")) { Out = EHWNodeFacilityKind::Comms; return true; }
        if (Key == TEXT("turret")) { Out = EHWNodeFacilityKind::Turret; return true; }
        if (Key == TEXT("barricade")) { Out = EHWNodeFacilityKind::Barricade; return true; }
        return false;
    }

    bool NpcRole(const FString& Key, EHWNodeNpcRole& Out)
    {
        if (Key == TEXT("technician")) { Out = EHWNodeNpcRole::Technician; return true; }
        if (Key == TEXT("medic")) { Out = EHWNodeNpcRole::Medic; return true; }
        if (Key == TEXT("scout")) { Out = EHWNodeNpcRole::Scout; return true; }
        if (Key == TEXT("operator")) { Out = EHWNodeNpcRole::Operator; return true; }
        if (Key == TEXT("guard")) { Out = EHWNodeNpcRole::Guard; return true; }
        return false;
    }

    bool EnemyRoleNamed(const FString& Key, EHWNodeEnemyRole& Out)
    {
        if (Key == TEXT("normal")) { Out = EHWNodeEnemyRole::Normal; return true; }
        if (Key == TEXT("runner")) { Out = EHWNodeEnemyRole::Runner; return true; }
        if (Key == TEXT("breaker")) { Out = EHWNodeEnemyRole::Breaker; return true; }
        if (Key == TEXT("stalker")) { Out = EHWNodeEnemyRole::Stalker; return true; }
        if (Key == TEXT("armored_elite")) { Out = EHWNodeEnemyRole::ArmoredElite; return true; }
        return false;
    }

    // kind (unless bBarricade), id, at, half [x, y, z], hp
    bool ReadFacility(const TSharedPtr<FJsonObject>& JsonObj, const TMap<FName, FVector>& Anchors, bool bBarricade, FHWNodeFacilityDef& Out)
    {
        if (!JsonObj.IsValid() || !ReadPoint(JsonObj, TEXT("at"), Anchors, Out.Location)) return false;
        if (bBarricade) Out.Kind = EHWNodeFacilityKind::Barricade;
        else if (!FacilityKind(JsonObj->GetStringField(TEXT("kind")), Out.Kind)) return false;
        Out.Id = FName(*JsonObj->GetStringField(TEXT("id")));
        const TArray<TSharedPtr<FJsonValue>>* Half = nullptr;
        if (JsonObj->TryGetArrayField(TEXT("half"), Half) && Half->Num() >= 3)
        {
            Out.HalfExtent = FVector((*Half)[0]->AsNumber(), (*Half)[1]->AsNumber(), (*Half)[2]->AsNumber());
        }
        double Hp = 0.0;
        if (!JsonObj->TryGetNumberField(TEXT("hp"), Hp) || Hp <= 0.0) return false;
        Out.MaxHealth = Hp;
        return true;
    }
}

UHWNodeConfig* UHWNodeConfig::LoadFromJson(FName Id, UObject* Outer)
{
    using namespace HWNodeConfigLocal;

    FString Raw;
    TSharedPtr<FJsonObject> Root;
    const FString Path = FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Data"), FString::Printf(TEXT("node_%s.json"), *Id.ToString()));
    if (!FFileHelper::LoadFileToString(Raw, *Path) || !FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Raw), Root) || !Root.IsValid())
    {
        UE_LOG(LogTemp, Warning, TEXT("[HWNode] %s missing or unreadable"), *Path);
        return nullptr;
    }

    UHWNodeConfig* C = NewObject<UHWNodeConfig>(Outer ? Outer : static_cast<UObject*>(GetTransientPackage()));
    C->NodeId = Id;
    Root->TryGetStringField(TEXT("name"), C->DisplayName);

    const TSharedPtr<FJsonObject>* AnchorsJson = nullptr;
    if (Root->TryGetObjectField(TEXT("anchors"), AnchorsJson))
    {
        for (const TPair<FString, TSharedPtr<FJsonValue>>& Pair : (*AnchorsJson)->Values)
        {
            FVector P;
            if (ReadVector(Pair.Value, P)) C->Anchors.Add(FName(*Pair.Key), P);
        }
    }

    const TArray<TSharedPtr<FJsonValue>>* JsonArr = nullptr;
    if (Root->TryGetArrayField(TEXT("pads"), JsonArr))
    {
        for (const TSharedPtr<FJsonValue>& V : *JsonArr)
        {
            const TSharedPtr<FJsonObject> O = V->AsObject();
            FVector At;
            const TArray<TSharedPtr<FJsonValue>>* Half = nullptr;
            if (!O.IsValid() || !ReadPoint(O, TEXT("at"), C->Anchors, At) || !O->TryGetArrayField(TEXT("half"), Half) || Half->Num() < 2) continue;
            FString PadKind;
            O->TryGetStringField(TEXT("kind"), PadKind);
            C->Blocks.Add(Pad(At, (*Half)[0]->AsNumber(), (*Half)[1]->AsNumber(), PadKind == TEXT("trail")));
        }
    }
    if (Root->TryGetArrayField(TEXT("roads"), JsonArr))
    {
        for (const TSharedPtr<FJsonValue>& V : *JsonArr)
        {
            const TSharedPtr<FJsonObject> O = V->AsObject();
            FVector A, B;
            if (!O.IsValid() || !ReadVector(O->TryGetField(TEXT("from")), A) || !ReadVector(O->TryGetField(TEXT("to")), B)) continue;
            FString RoadKind;
            O->TryGetStringField(TEXT("kind"), RoadKind);
            C->Blocks.Add(Ramp(A, B, O->GetNumberField(TEXT("half_width")), !RoadKind.IsEmpty() && RoadKind != TEXT("road")));
        }
    }
    if (Root->TryGetArrayField(TEXT("walls"), JsonArr))
    {
        for (const TSharedPtr<FJsonValue>& V : *JsonArr)
        {
            FHWNodeBlock W;
            if (V->AsObject().IsValid() && Wall(V->AsObject(), W)) C->Blocks.Add(W);
        }
    }
    if (Root->TryGetArrayField(TEXT("facilities"), JsonArr))
    {
        for (const TSharedPtr<FJsonValue>& V : *JsonArr)
        {
            FHWNodeFacilityDef F;
            if (ReadFacility(V->AsObject(), C->Anchors, false, F)) C->Facilities.Add(F);
        }
    }
    if (Root->TryGetArrayField(TEXT("barricade_slots"), JsonArr))
    {
        for (const TSharedPtr<FJsonValue>& V : *JsonArr)
        {
            FHWNodeFacilityDef F;
            if (ReadFacility(V->AsObject(), C->Anchors, true, F)) C->BarricadeSlots.Add(F);
        }
    }
    if (Root->TryGetArrayField(TEXT("npcs"), JsonArr))
    {
        for (const TSharedPtr<FJsonValue>& V : *JsonArr)
        {
            const TSharedPtr<FJsonObject> O = V->AsObject();
            FHWNodeNpcDef Npc;
            if (!O.IsValid() || !NpcRole(O->GetStringField(TEXT("role")), Npc.Role) || !ReadPoint(O, TEXT("at"), C->Anchors, Npc.Location)) continue;
            Npc.Id = FName(*O->GetStringField(TEXT("id")));
            FString RouteName;
            if (O->TryGetStringField(TEXT("route"), RouteName)) Npc.Route = FName(*RouteName);
            C->Npcs.Add(Npc);
        }
    }

    ReadVector(Root->TryGetField(TEXT("holding_spot")), C->HoldingSpot);
    ReadVector(Root->TryGetField(TEXT("medical_bay")), C->MedicalBay);
    ReadVector(Root->TryGetField(TEXT("player_start")), C->PlayerStart);
    ReadVector(Root->TryGetField(TEXT("boss_start")), C->BossStart);
    ReadPoints(Root, TEXT("spawns"), C->SpawnPoints);
    ReadPoints(Root, TEXT("north_spawns"), C->NorthSpawnPoints);

    const TSharedPtr<FJsonObject>* RoutesJson = nullptr;
    if (Root->TryGetObjectField(TEXT("routes"), RoutesJson))
    {
        for (const TPair<FString, TSharedPtr<FJsonValue>>& Pair : (*RoutesJson)->Values)
        {
            const TArray<TSharedPtr<FJsonValue>>* Points = nullptr;
            if (!Pair.Value.IsValid() || !Pair.Value->TryGetArray(Points)) continue;
            FHWNodeRoute R;
            ReadPointList(*Points, R.Points);
            if (R.Points.Num() > 0) C->Routes.Add(FName(*Pair.Key), R);
        }
    }
    const TSharedPtr<FJsonObject>* RoleRoutesJson = nullptr;
    if (Root->TryGetObjectField(TEXT("role_routes"), RoleRoutesJson))
    {
        for (const TPair<FString, TSharedPtr<FJsonValue>>& Pair : (*RoleRoutesJson)->Values)
        {
            EHWNodeEnemyRole EnemyRole = EHWNodeEnemyRole::Normal;
            if (!Pair.Value.IsValid() || !EnemyRoleNamed(Pair.Key, EnemyRole)) continue;
            FHWNodeRouteChoice Choice;
            FString Single;
            const TArray<TSharedPtr<FJsonValue>>* Many = nullptr;
            if (Pair.Value->TryGetString(Single))
            {
                Choice.Routes.Add(FName(*Single));
            }
            else if (Pair.Value->TryGetArray(Many))
            {
                for (const TSharedPtr<FJsonValue>& Entry : *Many) Choice.Routes.Add(FName(*Entry->AsString()));
            }
            if (Choice.Routes.Num() > 0) C->RoleRoutes.Add(EnemyRole, Choice);
        }
    }

    double NumberValue = 0.0;
    if (Root->TryGetNumberField(TEXT("comms_hold_radius"), NumberValue)) C->CommsHoldRadius = NumberValue;
    if (Root->TryGetNumberField(TEXT("comms_hold_to_fall"), NumberValue)) C->CommsHoldToFall = NumberValue;
    if (Root->TryGetNumberField(TEXT("fall_z"), NumberValue)) C->FallZ = NumberValue;
    if (Root->TryGetNumberField(TEXT("supply_default"), NumberValue)) C->DefaultSupply = FMath::RoundToInt(NumberValue);

    if (C->Facilities.Num() == 0 || C->SpawnPoints.Num() == 0 || C->Route(TEXT("main")).Num() == 0)
    {
        UE_LOG(LogTemp, Warning, TEXT("[HWNode] %s has no facilities, spawns or main route"), *Path);
        return nullptr;
    }
    UE_LOG(LogTemp, Display, TEXT("[HWNode] %s: %d blocks, %d facilities, %d NPCs, %d routes"), *Id.ToString(), C->Blocks.Num(), C->Facilities.Num(), C->Npcs.Num(), C->Routes.Num());
    return C;
}
