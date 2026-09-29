// -HWQA=frontend (docs/design/158): the title set (L_CharacterSelect) played through its own HUD - the title, the 입장
// reveal (camera pulls back, the table plan draws), character select, the connect camera over the plan. Shots follow the
// «자세히» timeline of doc 158 §2 so each beat can be checked against the spec, not by feel (doc 157 §4).
#include "Tests/HWSystemQASubsystem.h"

#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/HUD.h"
#include "GameFramework/PlayerController.h"
#include "HHFrontEndCinematicDirector.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"

void UHWSystemQASubsystem::TickFrontEnd(float Dt)
{
    UWorld* World = GetGameInstance() ? GetGameInstance()->GetWorld() : nullptr;
    APlayerController* PC = GetPC();
    if (!World || !PC) return;
    if (ShotDir.IsEmpty()) FParse::Value(FCommandLine::Get(), TEXT("HWQAShots="), ShotDir);
    AHUD* Hud = PC->GetHUD();
    AHHFrontEndCinematicDirector* Director = nullptr;
    for (TActorIterator<AHHFrontEndCinematicDirector> It(World); It; ++It) { Director = *It; break; }
    FrontTime += Dt;
    // (time in this step, what to do). Steps advance when their time has passed.
    switch (FrontStep)
    {
    case 0:   // the title: let textures stream and exposure settle
        if (FrontTime < 4.f) return;
        if (!Hud || !Director) { Finish(false, TEXT("frontend: no HUD or no AHHFrontEndCinematicDirector in the map")); return; }
        Shot(TEXT("fe_00_title"), true);
        break;
    case 1:
        if (FrontTime < 0.3f) return;
        Hud->NotifyHitBoxClick(TEXT("TITLE_ENTER"));
        Note(FString::Printf(TEXT("frontend: 입장 -> stage %d"), (int32)Director->Stage));
        break;
    case 2: if (FrontTime < 0.45f) return; Shot(TEXT("fe_01_reveal_045"), true); break;
    case 3: if (FrontTime < 0.45f) return; Shot(TEXT("fe_02_reveal_090"), true); break;
    case 4:   // reveal is 1.55 s: 0.9 + 1.6 puts us well after it
        if (FrontTime < 1.6f) return;
        Note(FString::Printf(TEXT("frontend: after reveal stage %d (Selection = %d)"), (int32)Director->Stage, (int32)EHHFrontEndCameraStage::Selection));
        if (Director->Stage != EHHFrontEndCameraStage::Selection) { Finish(false, TEXT("frontend: reveal did not reach Selection")); return; }
        Shot(TEXT("fe_03_select"), true);
        break;
    case 5:
        if (FrontTime < 0.4f) return;
        Hud->NotifyHitBoxClick(TEXT("CHAR_ain"));
        break;
    case 6: if (FrontTime < 0.6f) return; Shot(TEXT("fe_04_select_ain"), true); break;
    case 7:   // the connect camera without a gateway: the HUD's own confirm would ask the matchmaker (tested by onlineloop)
        if (FrontTime < 0.3f) return;
        Hud->bShowHUD = false;
        Director->PlayConnect();
        break;
    case 8: if (FrontTime < 0.6f) return; Shot(TEXT("fe_05_connect_060"), false); break;
    case 9:
        if (FrontTime < 1.2f) return;
        Shot(TEXT("fe_06_connect_end"), false);
        break;
    default:
        Finish(Director && Director->Stage == EHHFrontEndCameraStage::Hold,
            FString::Printf(TEXT("frontend done, director stage %d (Hold = %d)"), (int32)Director->Stage, (int32)EHHFrontEndCameraStage::Hold));
        return;
    }
    ++FrontStep;
    FrontTime = 0.f;
}
