// -HWQA=sheltertour (docs/design/155): the shelter map's HW_View camera spots, one screenshot each, HUD off and the
// player's body hidden. The spots are TargetPoints placed by Scripts/ue_shelter_b1.py (tag View_<name>).
#include "Tests/HWSystemQASubsystem.h"

#include "Game/HWLampFlicker.h"

#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Camera/PlayerCameraManager.h"
#include "Engine/GameInstance.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/TargetPoint.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/HUD.h"
#include "GameFramework/PlayerController.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"

void UHWSystemQASubsystem::TickShelterTour(float Dt)
{
    UWorld* World = GetGameInstance() ? GetGameInstance()->GetWorld() : nullptr;
    APlayerController* PC = GetPC();
    if (!World || !PC) return;
    if (ShotDir.IsEmpty()) FParse::Value(FCommandLine::Get(), TEXT("HWQAShots="), ShotDir);
    TourTime += Dt;
    if (TourStep < 0)
    {
        if (TourTime < 2.f || !PC->GetPawn()) return;
        TArray<ATargetPoint*> Spots;
        for (TActorIterator<ATargetPoint> It(World); It; ++It) if (It->Tags.Contains(TEXT("HW_View"))) Spots.Add(*It);
        auto NameOf = [](const AActor* A) { for (const FName& T : A->Tags) if (T.ToString().StartsWith(TEXT("View_"))) return T.ToString(); return FString(); };
        Spots.Sort([&](const ATargetPoint& A, const ATargetPoint& B) { return NameOf(&A) < NameOf(&B); });
        for (ATargetPoint* S : Spots) TourSpots.Add(S);
        Note(FString::Printf(TEXT("shelter tour: %d spots"), TourSpots.Num()));
        if (TourSpots.IsEmpty()) { Finish(false, TEXT("no HW_View spots in this map")); return; }
        PC->GetPawn()->SetActorHiddenInGame(true);
        if (AHUD* H = PC->GetHUD()) H->bShowHUD = false;
        TourStep = 0;
        TourTime = 0.f;
    }
    UHWLampFlickerSubsystem* Flicker = World->GetSubsystem<UHWLampFlickerSubsystem>();
    const int32 NumLamps = Flicker ? Flicker->NumLamps() : 0;
    if (Flicker && Flicker->QAHoldCycle < 0.f)
    {
        FlickerSamples += NumLamps;
        FlickerDimmed += Flicker->NumDimmed();
    }
    if (TourStep >= TourSpots.Num())
    {
        // 통합본 L253 «조명이 일정 간격으로 명멸했다»: at the way in, every flicker lamp held steady, then held in its first dip
        static const float Holds[] = {1.f, 0.05f};
        static const TCHAR* Names[] = {TEXT("flicker_steady"), TEXT("flicker_dip")};
        if (FlickerStep == 0)
        {
            const double Share = FlickerSamples ? double(FlickerDimmed) / double(FlickerSamples) : 0.0;
            Note(FString::Printf(TEXT("flicker: %d lamps, dimmed %.2f%% of %lld lamp-samples (a blink is %.2f s of every %.1f s)"),
                NumLamps, Share * 100.0, FlickerSamples, Flicker ? Flicker->BlinkTime : 0.f, Flicker ? Flicker->Interval : 0.f));
            // real time: at least one dip seen, and dim well under a tenth of the time - a flicker, not a dead lamp
            if (NumLamps == 0 || FlickerDimmed == 0 || Share > 0.1) { Finish(false, TEXT("lamp flicker missing or wrong")); return; }
            for (const TWeakObjectPtr<AActor>& S : TourSpots)
                if (S.IsValid() && S->Tags.Contains(TEXT("View_02_External_Inward")))
                    if (APlayerCameraManager* M = PC->PlayerCameraManager) if (AActor* V = M->GetViewTarget())
                        V->SetActorLocationAndRotation(S->GetActorLocation(), S->GetActorRotation());
            for (TActorIterator<AStaticMeshActor> It(World); It; ++It) It->SetActorHiddenInGame(false);   // the lid is back on
            FlickerStep = 1;
            TourTime = 0.f;
        }
        const int32 K = FlickerStep - 1;
        if (K >= 2) { Finish(true, FString::Printf(TEXT("shelter tour done, %d shots + flicker pair"), TourSpots.Num())); return; }
        Flicker->QAHoldCycle = Holds[K];
        // steady: let the eye settle; dip: shoot at once - a real dip lasts a tenth of a second, the eye never adapts to it
        if (TourTime > (K == 0 ? 2.5f : 0.15f))
        {
            Note(FString::Printf(TEXT("%s: %d of %d lamps dimmed"), Names[K], Flicker->NumDimmed(), NumLamps));
            Shot(Names[K], false);
            ++FlickerStep;
            TourTime = 0.f;
        }
        return;
    }
    AActor* Spot = TourSpots[TourStep].Get();
    static TWeakObjectPtr<ACameraActor> Cam;
    if (TourTime == Dt || !Cam.IsValid())   // first tick on this spot
    {
        if (!Cam.IsValid())
        {
            Cam = World->SpawnActor<ACameraActor>();
            Cam->GetCameraComponent()->SetFieldOfView(90.f);
            Cam->GetCameraComponent()->bConstrainAspectRatio = false;
        }
        Cam->SetActorLocationAndRotation(Spot->GetActorLocation(), Spot->GetActorRotation());
        PC->SetViewTarget(Cam.Get());
        // overview spots: lift the lid - hide what hangs above 3.3 m (ceilings, girders, pipes, lamps); show it again after
        const bool bTop = Spot->Tags.Contains(TEXT("HW_ViewTop"));
        for (TActorIterator<AStaticMeshActor> It(World); It; ++It)
        {
            FVector O, E;
            It->GetActorBounds(false, O, E);
            if (O.Z - E.Z > 330.f) It->SetActorHiddenInGame(bTop);
        }
    }
    if (TourTime > 2.5f)   // eye adaptation settles
    {
        FString Name;
        for (const FName& T : Spot->Tags) if (T.ToString().StartsWith(TEXT("View_"))) Name = T.ToString().RightChop(5);
        Shot(TEXT("tour_") + Name, false);
        ++TourStep;
        TourTime = 0.f;
    }
}
