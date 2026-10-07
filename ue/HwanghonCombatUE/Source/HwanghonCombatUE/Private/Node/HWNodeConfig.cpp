#include "Node/HWNodeConfig.h"
#include "Node/HWNodeRules.h"

#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

static_assert(static_cast<int>(EHWNodeFacilityKind::Comms) == static_cast<int>(HWNodeRules::EFacility::Comms), "facility order");
static_assert(static_cast<int>(EHWNodeEnemyRole::ArmoredElite) == static_cast<int>(HWNodeRules::EEnemyRole::ArmoredElite), "role order");
static_assert(static_cast<int>(EHWNodeState::Retaking) == static_cast<int>(HWNodeRules::ENodeState::Retaking), "state order");

// Same maths as tools/ue/node-graybox.js (checked there against every route). A named namespace, not an anonymous
// one: unity builds paste .cpp files together and anonymous helpers of two files would collide.
namespace HWNodeConfigLocal
{
    const FLinearColor GroundColor(0.30f, 0.30f, 0.32f);
    const FLinearColor RoadColor(0.22f, 0.22f, 0.24f);
    const FLinearColor FlankColor(0.24f, 0.27f, 0.22f);
    const FLinearColor WallColor(0.46f, 0.44f, 0.40f);
    constexpr float SlabThick = 40.f;

    bool ReadVector(const TSharedPtr<FJsonValue>& Value, FVector& Out)
    {
        const TArray<TSharedPtr<FJsonValue>>* Arr = nullptr;
        if (!Value.IsValid() || !Value->TryGetArray(Arr) || Arr->Num() < 3) return false;
        Out = FVector((*Arr)[0]->AsNumber(), (*Arr)[1]->AsNumber(), (*Arr)[2]->AsNumber());
        return true;
    }

    // "at": an anchor name or an [x, y, z] point
    bool ReadPoint(const TSharedPtr<FJsonObject>& Obj, const TCHAR* Field, const TMap<FName, FVector>& Anchors, FVector& Out)
    {
        FString Name;
        if (Obj->TryGetStringField(Field, Name))
        {
            const FVector* Found = Anchors.Find(FName(*Name));
            if (!Found) return false;
            Out = *Found;
            return true;
        }
        return ReadVector(Obj->TryGetField(Field), Out);
    }

    void ReadPoints(const TSharedPtr<FJsonObject>& Obj, const TCHAR* Field, TArray<FVector>& Out)
    {
        const TArray<TSharedPtr<FJsonValue>>* Arr = nullptr;
        if (!Obj.IsValid() || !Obj->TryGetArrayField(Field, Arr)) return;
        for (const TSharedPtr<FJsonValue>& V : *Arr)
        {
            FVector P;
            if (ReadVector(V, P)) Out.Add(P);
        }
    }

    FHWNodeBlock Pad(const FVector& Top, float HalfX, float HalfY)
    {
        FHWNodeBlock B;
        B.Center = FVector(Top.X, Top.Y, Top.Z - SlabThick * 0.5f);
        B.HalfExtent = FVector(HalfX, HalfY, SlabThick * 0.5f);
        B.Color = GroundColor;
        return B;
    }

    // Sloped slab whose top line runs from A to B (floor tops).
    FHWNodeBlock Ramp(const FVector& A, const FVector& B, float HalfWidth, bool bFlank)
    {
        const FVector D = B - A;
        const float Run = FVector(D.X, D.Y, 0.f).Size();
        const FRotator Rot(FMath::RadiansToDegrees(FMath::Atan2(D.Z, Run)), FMath::RadiansToDegrees(FMath::Atan2(D.Y, D.X)), 0.f);
        FHWNodeBlock R;
        R.Center = (A + B) * 0.5f - Rot.RotateVector(FVector::UpVector) * (SlabThick * 0.5f);
        R.HalfExtent = FVector(D.Size() * 0.5f + 40.f, HalfWidth, SlabThick * 0.5f);
        R.Yaw = Rot.Yaw;
        R.Pitch = Rot.Pitch;
        R.Color = bFlank ? FlankColor : RoadColor;
        return R;
    }

    bool FacilityKind(const FString& Name, EHWNodeFacilityKind& Out)
    {
        if (Name == TEXT("gate")) { Out = EHWNodeFacilityKind::Gate; return true; }
        if (Name == TEXT("generator")) { Out = EHWNodeFacilityKind::Generator; return true; }
        if (Name == TEXT("comms")) { Out = EHWNodeFacilityKind::Comms; return true; }
        return false;
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

    UHWNodeConfig* C = NewObject<UHWNodeConfig>(Outer ? Outer : GetTransientPackage());
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

    const TArray<TSharedPtr<FJsonValue>>* Arr = nullptr;
    if (Root->TryGetArrayField(TEXT("pads"), Arr))
    {
        for (const TSharedPtr<FJsonValue>& V : *Arr)
        {
            const TSharedPtr<FJsonObject> O = V->AsObject();
            FVector At;
            const TArray<TSharedPtr<FJsonValue>>* Half = nullptr;
            if (O.IsValid() && ReadPoint(O, TEXT("at"), C->Anchors, At) && O->TryGetArrayField(TEXT("half"), Half) && Half->Num() >= 2)
            {
                C->Blocks.Add(Pad(At, (*Half)[0]->AsNumber(), (*Half)[1]->AsNumber()));
            }
        }
    }
    if (Root->TryGetArrayField(TEXT("roads"), Arr))
    {
        for (const TSharedPtr<FJsonValue>& V : *Arr)
        {
            const TSharedPtr<FJsonObject> O = V->AsObject();
            FVector A, B;
            FString Kind;
            if (O.IsValid() && ReadVector(O->TryGetField(TEXT("from")), A) && ReadVector(O->TryGetField(TEXT("to")), B))
            {
                O->TryGetStringField(TEXT("kind"), Kind);
                C->Blocks.Add(Ramp(A, B, O->GetNumberField(TEXT("half_width")), Kind == TEXT("flank")));
            }
        }
    }
    if (Root->TryGetArrayField(TEXT("walls"), Arr))
    {
        for (const TSharedPtr<FJsonValue>& V : *Arr)
        {
            const TSharedPtr<FJsonObject> O = V->AsObject();
            if (!O.IsValid()) continue;
            const float X0 = O->GetNumberField(TEXT("x0")), X1 = O->GetNumberField(TEXT("x1"));
            const float Height = O->GetNumberField(TEXT("height"));
            double HalfDepth = 50.0;
            O->TryGetNumberField(TEXT("half_depth"), HalfDepth);
            FHWNodeBlock W;
            W.Center = FVector((X0 + X1) * 0.5f, O->GetNumberField(TEXT("y")), O->GetNumberField(TEXT("floor")) + Height * 0.5f);
            W.HalfExtent = FVector(FMath::Abs(X1 - X0) * 0.5f, HalfDepth, Height * 0.5f);
            W.Color = WallColor;
            C->Blocks.Add(W);
        }
    }
    if (Root->TryGetArrayField(TEXT("facilities"), Arr))
    {
        for (const TSharedPtr<FJsonValue>& V : *Arr)
        {
            const TSharedPtr<FJsonObject> O = V->AsObject();
            FHWNodeFacilityDef F;
            const TArray<TSharedPtr<FJsonValue>>* Half = nullptr;
            if (!O.IsValid() || !FacilityKind(O->GetStringField(TEXT("kind")), F.Kind) || !ReadPoint(O, TEXT("at"), C->Anchors, F.Location)) continue;
            F.Id = FName(*O->GetStringField(TEXT("id")));
            if (O->TryGetArrayField(TEXT("half"), Half) && Half->Num() >= 3)
            {
                F.HalfExtent = FVector((*Half)[0]->AsNumber(), (*Half)[1]->AsNumber(), (*Half)[2]->AsNumber());
            }
            F.MaxHealth = O->GetNumberField(TEXT("hp"));
            C->Facilities.Add(F);
        }
    }

    ReadVector(Root->TryGetField(TEXT("player_start")), C->PlayerStart);
    ReadVector(Root->TryGetField(TEXT("technician_start")), C->TechnicianStart);
    ReadVector(Root->TryGetField(TEXT("boss_start")), C->BossStart);
    ReadPoints(Root, TEXT("spawns"), C->SpawnPoints);
    const TSharedPtr<FJsonObject>* RoutesJson = nullptr;
    if (Root->TryGetObjectField(TEXT("routes"), RoutesJson))
    {
        ReadPoints(*RoutesJson, TEXT("main"), C->MainRoute);
        ReadPoints(*RoutesJson, TEXT("west"), C->WestRoute);
        ReadPoints(*RoutesJson, TEXT("east"), C->EastRoute);
        ReadPoints(*RoutesJson, TEXT("generator"), C->GeneratorRoute);
        ReadPoints(*RoutesJson, TEXT("comms"), C->CommsRoute);
    }
    double Number = 0.0;
    if (Root->TryGetNumberField(TEXT("comms_hold_radius"), Number)) C->CommsHoldRadius = Number;
    if (Root->TryGetNumberField(TEXT("comms_hold_to_fall"), Number)) C->CommsHoldToFall = Number;
    if (Root->TryGetNumberField(TEXT("fall_z"), Number)) C->FallZ = Number;

    if (C->Facilities.Num() == 0 || C->SpawnPoints.Num() == 0 || C->MainRoute.Num() == 0)
    {
        UE_LOG(LogTemp, Warning, TEXT("[HWNode] %s has no facilities, spawns or main route"), *Path);
        return nullptr;
    }
    UE_LOG(LogTemp, Display, TEXT("[HWNode] %s: %d blocks, %d facilities, %d spawns"), *Id.ToString(), C->Blocks.Num(), C->Facilities.Num(), C->SpawnPoints.Num());
    return C;
}
