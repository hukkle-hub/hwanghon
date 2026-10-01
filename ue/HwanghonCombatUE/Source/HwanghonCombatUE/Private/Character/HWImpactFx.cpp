#include "Character/HWImpactFx.h"

#include "Camera/PlayerCameraManager.h"
#include "Components/DecalComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"

namespace
{
#if PLATFORM_ANDROID || PLATFORM_IOS
    constexpr int32 MaxParts = 220;   // phone budget: one ISM draw per colour group, CPU sim stays tiny
#else
    constexpr int32 MaxParts = 600;
#endif
    const TCHAR* PlanePath = TEXT("/Engine/BasicShapes/Plane.Plane");
    const TCHAR* CubePath = TEXT("/Engine/BasicShapes/Cube.Cube");
    const TCHAR* RockPath = TEXT("/Game/ParagonGrux/FX/Meshes/Debris/SM_Rock_Chunk_LowPoly.SM_Rock_Chunk_LowPoly");
    const TCHAR* ArcPath = TEXT("/Game/Hwanghon/VFX/SM_HW_RingArc.SM_HW_RingArc");
    const TCHAR* StreakPath = TEXT("/Game/Hwanghon/VFX/M_HW_Streak.M_HW_Streak");
    const TCHAR* PuffPath = TEXT("/Game/Hwanghon/VFX/M_HW_Puff.M_HW_Puff");
    const TCHAR* FlatPath = TEXT("/Game/Hwanghon/VFX/M_HW_Flat.M_HW_Flat");
    const TCHAR* CrackPath = TEXT("/Game/Hwanghon/VFX/M_HW_CrackDecal.M_HW_CrackDecal");

    uint32 ColorKey(const FLinearColor& C)
    {
        const FColor Q = C.ToFColor(false);
        return (uint32(Q.R) << 16) | (uint32(Q.G) << 8) | uint32(Q.B);
    }

    FVector RandomInCone(const FVector& Dir, float SpreadDeg)
    {
        return FMath::VRandCone(Dir.GetSafeNormal(), FMath::DegreesToRadians(SpreadDeg));
    }
}

AHWImpactFx::AHWImpactFx()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickGroup = TG_PostUpdateWork;   // after the camera moved: quads face this frame's view
    SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("Root")));
}

AHWImpactFx* AHWImpactFx::Get(UWorld* World)
{
    if (!World || World->GetNetMode() == NM_DedicatedServer) return nullptr;
    if (TActorIterator<AHWImpactFx> It(World); It) return *It;   // first-actor loops break the Android clang build
    FActorSpawnParameters P;
    P.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    AHWImpactFx* Fx = World->SpawnActor<AHWImpactFx>(AHWImpactFx::StaticClass(), FTransform::Identity, P);
    if (Fx)
    {
        Fx->CrackMat = LoadObject<UMaterialInterface>(nullptr, CrackPath);
        if (UStaticMesh* Rock = LoadObject<UStaticMesh>(nullptr, RockPath))
        {
            // chips about 7 cm across whatever size the pack mesh has
            Fx->RockScale = 7.f / FMath::Max(1.f, Rock->GetBounds().BoxExtent.GetMax() * 2.f);
        }
    }
    return Fx;
}

UInstancedStaticMeshComponent* AHWImpactFx::MakeIsm(UStaticMesh* Mesh, UMaterialInterface* Mat)
{
    UInstancedStaticMeshComponent* C = NewObject<UInstancedStaticMeshComponent>(this);
    C->SetupAttachment(GetRootComponent());
    C->SetStaticMesh(Mesh);
    if (Mat) C->SetMaterial(0, Mat);
    C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    C->SetCastShadow(false);
    C->SetUsingAbsoluteLocation(true);
    C->NumCustomDataFloats = 1;   // the instance's fade (M_HW_* read PerInstanceCustomData[0])
    C->SetMobility(EComponentMobility::Movable);
    C->RegisterComponent();
    return C;
}

int32 AHWImpactFx::GroupFor(EKind Kind, const FLinearColor& Color)
{
    const uint32 Key = (uint32(Kind) << 24) ^ ColorKey(Color);
    const int32 Found = GroupKeys.IndexOfByKey(Key);
    if (Found != INDEX_NONE) return Found;

    UStaticMesh* Mesh = LoadObject<UStaticMesh>(nullptr, Kind == EKind::Rock ? RockPath : Kind == EKind::Straw ? CubePath : PlanePath);
    UMaterialInterface* Mat = nullptr;
    if (Kind == EKind::Streak || Kind == EKind::Lens || Kind == EKind::Ember)
    {
        UMaterialInstanceDynamic* M = UMaterialInstanceDynamic::Create(LoadObject<UMaterialInterface>(nullptr, StreakPath), this);
        if (M)
        {
            M->SetVectorParameterValue(TEXT("Color"), Color);
            M->SetScalarParameterValue(TEXT("Glow"), Kind == EKind::Lens ? 14.f : Kind == EKind::Ember ? 5.f : 9.f);
            M->SetScalarParameterValue(TEXT("Sym"), Kind == EKind::Streak ? 0.f : 1.f);
        }
        Mat = M;
    }
    else if (Kind == EKind::Puff || Kind == EKind::Straw)
    {
        UMaterialInstanceDynamic* M = UMaterialInstanceDynamic::Create(LoadObject<UMaterialInterface>(nullptr, Kind == EKind::Puff ? PuffPath : FlatPath), this);
        // puffs are unlit: at full colour dust glowed as white lumps against the dark arena - a third of it reads as dust
        if (M) M->SetVectorParameterValue(TEXT("Color"), Kind == EKind::Puff ? Color * 0.35f : Color);
        Mat = M;
    }
    Groups.Add(MakeIsm(Mesh, Mat));
    GroupKinds.Add(Kind);
    GroupKeys.Add(Key);
    return Groups.Num() - 1;
}

bool AHWImpactFx::Room() const
{
    return Parts.Num() < MaxParts;
}

void AHWImpactFx::Sparks(const FVector& At, const FVector& Dir, int32 Count, const FLinearColor& Color, float Speed, float SpreadDeg,
    float Life, float Gravity, float Width)
{
    const int32 G = GroupFor(EKind::Streak, Color);
    for (int32 I = 0; I < Count && Room(); ++I)
    {
        FPart P;
        P.Kind = EKind::Streak;
        P.P = At;
        P.V = RandomInCone(Dir, SpreadDeg) * Speed * FMath::FRandRange(0.45f, 1.f);
        P.Life = Life * FMath::FRandRange(0.6f, 1.2f);
        P.Size = Width;
        P.Gravity = Gravity;
        P.Drag = 2.5f;
        P.Group = G;
        Parts.Add(P);
        ++Spawned;
    }
}

void AHWImpactFx::Needles(const FVector& At, int32 Count, const FLinearColor& Color, float Speed, float Life, float Up)
{
    const int32 G = GroupFor(EKind::Streak, Color);
    for (int32 I = 0; I < Count && Room(); ++I)
    {
        const float A = 2.f * PI * (I + FMath::FRand() * 0.6f) / Count;
        FPart P;
        P.Kind = EKind::Streak;
        P.P = At;
        P.V = FVector(FMath::Cos(A), FMath::Sin(A), FMath::FRandRange(-0.1f, Up)).GetSafeNormal() * Speed * FMath::FRandRange(0.7f, 1.f);
        P.Life = Life * FMath::FRandRange(0.7f, 1.1f);
        P.Size = 2.6f;
        P.Drag = 5.f;   // they shoot out and stop: the needle burst holds its ring shape
        P.Group = G;
        Parts.Add(P);
        ++Spawned;
    }
}

void AHWImpactFx::LensStreak(const FVector& At, const FLinearColor& Color, float Length)
{
    if (!Room()) return;
    FPart P;
    P.Kind = EKind::Lens;
    P.P = At;
    P.V = FVector::ZeroVector;
    P.Life = 0.07f;   // two frames at 30 fps
    P.Len = Length;
    P.Size = Length * 0.035f;
    P.Group = GroupFor(EKind::Lens, Color);
    Parts.Add(P);
    ++Spawned;
}

void AHWImpactFx::Debris(const FVector& At, int32 Count, float Speed, bool bChipsAreStraw, float FloorZ)
{
    const FLinearColor Straw(0.55f, 0.42f, 0.17f);
    const int32 G = bChipsAreStraw ? GroupFor(EKind::Straw, Straw) : GroupFor(EKind::Rock, FLinearColor::Gray);
    for (int32 I = 0; I < Count && Room(); ++I)
    {
        FPart P;
        P.Kind = bChipsAreStraw ? EKind::Straw : EKind::Rock;
        P.P = At + FMath::VRand() * 10.f;
        P.V = RandomInCone(FVector::UpVector, 55.f) * Speed * FMath::FRandRange(0.5f, 1.f);
        P.Life = FMath::FRandRange(0.9f, 1.4f);
        P.Size = bChipsAreStraw ? FMath::FRandRange(0.8f, 1.2f) : FMath::FRandRange(0.6f, 1.4f);
        P.Gravity = bChipsAreStraw ? 520.f : 1500.f;   // straw floats down, rock drops
        P.Drag = bChipsAreStraw ? 2.2f : 0.3f;
        P.FloorZ = FloorZ;
        P.Rot = FQuat(FMath::VRand(), FMath::FRand() * PI);
        P.Spin = FMath::VRand() * FMath::FRandRange(6.f, 16.f);
        P.Group = G;
        Parts.Add(P);
        ++Spawned;
    }
}

void AHWImpactFx::Puff(const FVector& At, int32 Count, const FLinearColor& Color, float Size, float Life, float Spread, float Rise)
{
    const int32 G = GroupFor(EKind::Puff, Color);
    for (int32 I = 0; I < Count && Room(); ++I)
    {
        FPart P;
        P.Kind = EKind::Puff;
        P.P = At + FVector(FMath::FRandRange(-1.f, 1.f), FMath::FRandRange(-1.f, 1.f), 0.f) * Spread * 0.3f;
        P.V = FVector(FMath::FRandRange(-1.f, 1.f), FMath::FRandRange(-1.f, 1.f), 0.f).GetSafeNormal() * Spread
            + FVector(0.f, 0.f, Rise);
        P.Life = Life * FMath::FRandRange(0.8f, 1.2f);
        P.Size = Size * FMath::FRandRange(0.7f, 1.2f);
        P.Drag = 2.f;
        P.Group = G;
        Parts.Add(P);
        ++Spawned;
    }
}

void AHWImpactFx::Embers(const FVector& At, int32 Count, const FLinearColor& Color, float Radius, float Life)
{
    const int32 G = GroupFor(EKind::Ember, Color);
    for (int32 I = 0; I < Count && Room(); ++I)
    {
        FPart P;
        P.Kind = EKind::Ember;
        const float A = FMath::FRand() * 2.f * PI;
        P.P = At + FVector(FMath::Cos(A), FMath::Sin(A), 0.f) * Radius * FMath::Sqrt(FMath::FRand()) + FVector(0.f, 0.f, 2.f);
        P.V = FVector(0.f, 0.f, FMath::FRandRange(4.f, 14.f));
        P.Life = Life * FMath::FRandRange(0.6f, 1.f);
        P.Size = FMath::FRandRange(2.f, 4.f);
        P.Group = G;
        Parts.Add(P);
        ++Spawned;
    }
}

void AHWImpactFx::Rings(AActor* Around, const FLinearColor& Color, float Radius, float Seconds, float FloorZ)
{
    if (!Around) return;
    // the arc mesh uses the streak material: one group per colour, separate from the line sparks
    const uint32 Key = (uint32(7) << 24) ^ ColorKey(Color);
    int32 G = GroupKeys.IndexOfByKey(Key);
    if (G == INDEX_NONE)
    {
        UMaterialInstanceDynamic* M = UMaterialInstanceDynamic::Create(LoadObject<UMaterialInterface>(nullptr, StreakPath), this);
        if (M)
        {
            M->SetVectorParameterValue(TEXT("Color"), Color);
            M->SetScalarParameterValue(TEXT("Glow"), 7.f);
            M->SetScalarParameterValue(TEXT("Tail"), 2.5f);
        }
        Groups.Add(MakeIsm(LoadObject<UStaticMesh>(nullptr, ArcPath), M));
        GroupKinds.Add(EKind::Lens);   // not simulated as a part; rebuilt from RingList
        GroupKeys.Add(Key);
        G = Groups.Num() - 1;
    }
    FRing R;
    R.Around = Around;
    R.Group = G;
    R.Seconds = Seconds;
    R.Radius = Radius;
    R.FloorZ = FloorZ;
    R.Yaw = FMath::FRand() * 360.f;
    RingList.Add(R);
}

void AHWImpactFx::Crack(const FVector& At, float Radius, float Seconds)
{
    if (!CrackMat || !GetWorld()) return;
    UDecalComponent* D = UGameplayStatics::SpawnDecalAtLocation(GetWorld(), CrackMat, FVector(60.f, Radius, Radius), At,
        FRotator(-90.f, FMath::FRand() * 360.f, 0.f), Seconds + 0.5f);
    if (D) D->SetFadeOut(Seconds * 0.6f, Seconds * 0.4f, false);
}

void AHWImpactFx::Tick(float Dt)
{
    Super::Tick(Dt);
    FVector Cam = FVector::ZeroVector;
    FVector CamRight = FVector::RightVector;
    if (APlayerCameraManager* PCM = UGameplayStatics::GetPlayerCameraManager(this, 0))
    {
        Cam = PCM->GetCameraLocation();
        CamRight = PCM->GetCameraRotation().Quaternion().GetRightVector();
    }

    TArray<TArray<FTransform>> Xf;
    TArray<TArray<float>> Fade;
    Xf.SetNum(Groups.Num());
    Fade.SetNum(Groups.Num());

    for (int32 I = Parts.Num() - 1; I >= 0; --I)
    {
        FPart& P = Parts[I];
        P.Age += Dt;
        if (P.Age >= P.Life) { Parts.RemoveAtSwap(I); continue; }
        P.V *= FMath::Max(0.f, 1.f - P.Drag * Dt);
        P.V.Z -= P.Gravity * Dt;
        P.P += P.V * Dt;
        if (P.P.Z < P.FloorZ)
        {
            P.P.Z = P.FloorZ;
            P.V = FVector(P.V.X * 0.5f, P.V.Y * 0.5f, -P.V.Z * 0.3f);
            P.Spin *= 0.5f;
        }
        const float K = P.Age / P.Life;
        const FVector ToCam = (Cam - P.P).GetSafeNormal();
        FTransform T;
        float F = 1.f;
        switch (P.Kind)
        {
        case EKind::Streak:
        {
            // the plane's X runs along the velocity (head at +X, u=1), its face turned to the camera
            const float Speed = P.V.Size();
            const FVector X = Speed > 1.f ? P.V / Speed : FVector::UpVector;
            const float Len = FMath::Clamp(Speed * 0.035f, 4.f, 70.f) * (1.f - 0.5f * K);
            const FVector Z = (ToCam - X * FVector::DotProduct(ToCam, X)).GetSafeNormal();
            const FVector Y = FVector::CrossProduct(Z, X);
            T = FTransform(FMatrix(X, Y, Z, FVector::ZeroVector).ToQuat(), P.P - X * Len * 0.5f, FVector(Len / 100.f, P.Size / 100.f, 1.f));
            F = 1.f - K * K;
            break;
        }
        case EKind::Lens:
        {
            const FVector X = CamRight;
            const FVector Z = ToCam;
            const FVector Y = FVector::CrossProduct(Z, X);
            T = FTransform(FMatrix(X, Y, Z, FVector::ZeroVector).ToQuat(), P.P + ToCam * 30.f, FVector(P.Len / 100.f, P.Size / 100.f, 1.f));
            F = 1.f - K;
            break;
        }
        case EKind::Ember:
        {
            const FVector X = CamRight;
            const FVector Y = FVector::CrossProduct(ToCam, X);
            const float Flick = 0.55f + 0.45f * FMath::Sin(P.Age * 23.f + P.P.X);
            T = FTransform(FMatrix(X, Y, ToCam, FVector::ZeroVector).ToQuat(), P.P, FVector(P.Size / 100.f, P.Size / 100.f, 1.f));
            F = Flick * (1.f - K);
            break;
        }
        case EKind::Puff:
        {
            const FVector X = CamRight;
            const FVector Y = FVector::CrossProduct(ToCam, X);
            const float S = P.Size * (0.5f + 0.9f * K);
            T = FTransform(FMatrix(X, Y, ToCam, FVector::ZeroVector).ToQuat(), P.P, FVector(S / 100.f, S / 100.f, 1.f));
            F = FMath::Min(1.f, K * 6.f) * (1.f - K);
            break;
        }
        case EKind::Rock:
        case EKind::Straw:
        {
            const float Ang = P.Spin.Size();
            if (Ang > KINDA_SMALL_NUMBER) P.Rot = FQuat(P.Spin / Ang, Ang * Dt) * P.Rot;
            const float Shrink = K > 0.8f ? (1.f - K) / 0.2f : 1.f;
            const FVector S = P.Kind == EKind::Straw
                ? FVector(0.16f, 0.012f, 0.012f) * P.Size * Shrink      // 16 cm stalks
                : FVector(RockScale * P.Size * Shrink);
            T = FTransform(P.Rot, P.P, S);
            break;
        }
        }
        if (Xf.IsValidIndex(P.Group))
        {
            Xf[P.Group].Add(T);
            Fade[P.Group].Add(F);
        }
    }

    for (int32 I = RingList.Num() - 1; I >= 0; --I)
    {
        FRing& R = RingList[I];
        R.Age += Dt;
        AActor* A = R.Around.Get();
        if (!A || R.Age >= R.Seconds) { RingList.RemoveAtSwap(I); continue; }
        const float In = FMath::Min(1.f, R.Age / 0.08f);
        const float Out = FMath::Min(1.f, (R.Seconds - R.Age) / 0.25f);
        const FVector C(A->GetActorLocation().X, A->GetActorLocation().Y, R.FloorZ);
        // three thin arcs at different heights and radii, turning fast (two turns a second), slightly tilted
        for (int32 K = 0; K < 3; ++K)
        {
            const float Yaw = R.Yaw + K * 120.f + R.Age * 720.f * (K == 1 ? -0.8f : 1.f);
            const FRotator Rot(K == 0 ? 3.f : K == 1 ? -4.f : 1.5f, Yaw, K == 2 ? 3.f : 0.f);
            const float Rad = R.Radius * (0.82f + 0.12f * K);
            Xf[R.Group].Add(FTransform(Rot, C + FVector(0.f, 0.f, 18.f + 22.f * K), FVector(Rad / 100.f, Rad / 100.f, 1.f)));
            Fade[R.Group].Add(In * Out);
        }
    }

    int32 Live = 0;
    for (int32 G = 0; G < Groups.Num(); ++G)
    {
        UInstancedStaticMeshComponent* C = Groups[G];
        if (!C) continue;
        C->ClearInstances();
        if (Xf[G].IsEmpty()) continue;
        C->AddInstances(Xf[G], false, true, false);
        for (int32 I = 0; I < Fade[G].Num(); ++I) C->SetCustomDataValue(I, 0, Fade[G][I], I == Fade[G].Num() - 1);
        Live += Xf[G].Num();
    }
    Peak = FMath::Max(Peak, Live);
}

FString AHWImpactFx::Describe() const
{
    return FString::Printf(TEXT("impact parts=%d rings=%d spawned=%d peak=%d groups=%d"), Parts.Num(), RingList.Num(), Spawned, Peak, Groups.Num());
}
