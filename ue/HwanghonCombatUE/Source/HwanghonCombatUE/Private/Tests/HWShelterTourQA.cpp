// -HWQA=sheltertour (docs/design/155): the shelter map's HW_View camera spots, one screenshot each, HUD off and the
// player's body hidden. The spots are TargetPoints placed by Scripts/ue_shelter_b1.py (tag View_<name>).
#include "Tests/HWSystemQASubsystem.h"

#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Engine/GameInstance.h"
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
    if (TourStep >= TourSpots.Num()) { Finish(true, FString::Printf(TEXT("shelter tour done, %d shots"), TourSpots.Num())); return; }
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
