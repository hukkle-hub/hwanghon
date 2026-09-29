// -HWQA=frontend (docs/design/158, 159): the title set (L_CharacterSelect) played through its own HUD - the title, the
// 입장 reveal (camera pulls back, the table plan draws), the character stand (each hero's intro -> idle, ‹ › to the next),
// the confirm beat with the connect camera over the plan. Shots follow the «자세히» timeline of the docs so each beat can
// be checked against the spec, not by feel (doc 157 §4).
#include "Tests/HWSystemQASubsystem.h"

#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/HUD.h"
#include "GameFramework/PlayerController.h"
#include "HHCharacterSelectStand.h"
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
    AHHCharacterSelectStand* Stand = nullptr;
    for (TActorIterator<AHHCharacterSelectStand> It(World); It; ++It) { Stand = *It; break; }
    FrontTime += Dt;
    static const TCHAR* Heroes[4] = { TEXT("ain"), TEXT("kain"), TEXT("ryu"), TEXT("sera") };
    // steps 5.. : per hero (k = 0..3) an intro shot, an idle shot, then › to the next
    const int32 HeroBase = 5, PerHero = 3, HeroEnd = HeroBase + 4 * PerHero;
    if (FrontStep >= HeroBase && FrontStep < HeroEnd)
    {
        const int32 K = (FrontStep - HeroBase) / PerHero, Beat = (FrontStep - HeroBase) % PerHero;
        if (Beat == 0)   // intro under way
        {
            if (FrontTime < 0.35f) return;
            Shot(FString::Printf(TEXT("fe_1%d_%s_intro"), K, Heroes[K]), true);
        }
        else if (Beat == 1)   // settled into idle
        {
            if (FrontTime < 2.4f) return;
            const bool bOk = Stand && Stand->SelectedCharacterId == FName(Heroes[K])
                && Stand->PresentationState == EHHSelectionPresentationState::Idle;
            Note(FString::Printf(TEXT("frontend: %s on the stand %s, state %d (Idle = %d)"), Heroes[K],
                Stand ? *Stand->SelectedCharacterId.ToString() : TEXT("-"), Stand ? (int32)Stand->PresentationState : -1,
                (int32)EHHSelectionPresentationState::Idle));
            if (!bOk) { Finish(false, FString::Printf(TEXT("frontend: %s did not settle on the stand"), Heroes[K])); return; }
            Shot(FString::Printf(TEXT("fe_1%d_%s_idle"), K, Heroes[K]), true);
        }
        else if (K < 3)   // › to the next hero
        {
            if (FrontTime < 0.2f) return;
            Hud->NotifyHitBoxClick(TEXT("CHAR_NEXT"));
        }
        ++FrontStep;
        FrontTime = 0.f;
        return;
    }
    switch (FrontStep)
    {
    case 0:   // the title: let textures stream and exposure settle
        if (FrontTime < 4.f) return;
        if (!Hud || !Director || !Stand) { Finish(false, TEXT("frontend: no HUD, AHHFrontEndCinematicDirector or AHHCharacterSelectStand in the map")); return; }
        Shot(TEXT("fe_00_title"), true);
        break;
    case 1:
        if (FrontTime < 0.3f) return;
        Hud->NotifyHitBoxClick(TEXT("TITLE_ENTER"));
        Note(FString::Printf(TEXT("frontend: 입장 -> stage %d"), (int32)Director->Stage));
        break;
    case 2: if (FrontTime < 0.45f) return; Shot(TEXT("fe_01_reveal_045"), true); break;
    case 3: if (FrontTime < 0.45f) return; Shot(TEXT("fe_02_reveal_090"), true); break;
    case 4:   // the reveal is 1.55 s: the stand shows ain when it ends
        if (FrontTime < 0.7f) return;
        Note(FString::Printf(TEXT("frontend: after reveal stage %d (Selection = %d)"), (int32)Director->Stage, (int32)EHHFrontEndCameraStage::Selection));
        if (Director->Stage != EHHFrontEndCameraStage::Selection) { Finish(false, TEXT("frontend: reveal did not reach Selection")); return; }
        break;
    default:
        if (FrontStep == HeroEnd)   // sera is on the stand: confirm beat + connect camera (the HUD's own confirm asks the matchmaker)
        {
            if (FrontTime < 0.3f) return;
            Stand->PlayConfirmPresentation();
            Director->PlayConnect();
        }
        else if (FrontStep == HeroEnd + 1) { if (FrontTime < 0.35f) return; Shot(TEXT("fe_20_confirm_035"), true); }
        else if (FrontStep == HeroEnd + 2) { if (FrontTime < 0.9f) return; Hud->bShowHUD = false; Shot(TEXT("fe_21_connect_end"), false); }
        else
        {
            if (FrontTime < 0.3f) return;
            Finish(Director->Stage == EHHFrontEndCameraStage::Hold,
                FString::Printf(TEXT("frontend done, director stage %d (Hold = %d)"), (int32)Director->Stage, (int32)EHHFrontEndCameraStage::Hold));
            return;
        }
        break;
    }
    ++FrontStep;
    FrontTime = 0.f;
}
