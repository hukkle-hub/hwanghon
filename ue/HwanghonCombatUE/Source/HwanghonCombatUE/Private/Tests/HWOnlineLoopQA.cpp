// -HWQA=onlineloop (docs/design/154): one real client of the online v6 loop. Run two (leader + member) against a
// matchmaker (tools/online/gateway.mjs), a shelter server and a dungeon server (Scripts/run_online_loop.ps1).
//
//   L_Loading        touch the «쉘터» card (role story: the «스토리 모드» card -> EP01 opens, done)
//   L_CharacterSelect touch the hero card (-HWQASelect=kain), then «쉘터 입장» -> shelter ticket -> travel
//   shelter (1st)    spawned at HH_TownStart, sees the other player; party (leader creates + invites the other,
//                    member accepts), both ready, both walk into the deployment gate volume, leader starts
//   dungeon          both admitted on the same party; the leader completes the run (server -AllowDevComplete)
//   shelter (2nd)    spawned at HH_ManpowerOffice_Return with Matteo in view, same party and leader restored
//
// Every step is a gate in the report; any fail makes the run fail. Touches go through APlayerController::InputTouch,
// the phone's path to the HUD hit boxes.
#include "Tests/HWSystemQASubsystem.h"

#include "Camera/PlayerCameraManager.h"
#include "Engine/GameInstance.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/GameStateBase.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerStart.h"
#include "GenericPlatform/GenericPlatformInputDeviceMapper.h"
#include "HHDeploymentGate.h"
#include "HHOnlineFlowSubsystem.h"
#include "HHShelterNPC.h"
#include "HHShelterOnlinePlayerController.h"
#include "HHShelterOnlinePlayerState.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"

namespace
{
    FString QAParam(const TCHAR* Key)
    {
        FString V;
        FParse::Value(FCommandLine::Get(), Key, V);
        return V;
    }

    const TCHAR* Heroes[] = {TEXT("ain"), TEXT("kain"), TEXT("ryu"), TEXT("sera")};

    APlayerStart* StartTagged(UWorld* World, FName Tag)
    {
        for (TActorIterator<APlayerStart> It(World); It; ++It)
        {
            if (It->PlayerStartTag == Tag) return *It;
        }
        return nullptr;
    }

    // players the server has admitted and given a body - found from the bodies: on a client another player's
    // PlayerState does not always point back at its pawn
    TArray<AHHShelterOnlinePlayerState*> Admitted(UWorld* World)
    {
        TArray<AHHShelterOnlinePlayerState*> Out;
        for (TActorIterator<APawn> It(World); It; ++It)
        {
            // bAdmissionValidated replicates to its owner only; the server gives a body only after the ticket, so
            // another player's body is its admission
            AHHShelterOnlinePlayerState* PS = It->GetPlayerState<AHHShelterOnlinePlayerState>();
            if (PS && (PS->bAdmissionValidated || !It->IsLocallyControlled())) Out.AddUnique(PS);
        }
        return Out;
    }

    APawn* BodyOf(UWorld* World, const APlayerState* PS)
    {
        for (TActorIterator<APawn> It(World); It; ++It) if (It->GetPlayerState() == PS) return *It;
        return nullptr;
    }

    FString Census(UWorld* World)
    {
        int32 States = 0, Validated = 0, Pawns = 0, Owned = 0;
        if (AGameStateBase* GS = World->GetGameState())
            for (APlayerState* P : GS->PlayerArray) { ++States; if (const AHHShelterOnlinePlayerState* H = Cast<AHHShelterOnlinePlayerState>(P)) Validated += H->bAdmissionValidated; }
        for (TActorIterator<APawn> It(World); It; ++It) { ++Pawns; Owned += It->GetPlayerState() != nullptr; }
        return FString::Printf(TEXT("player states %d (admitted %d), pawns %d (with a player state %d)"), States, Validated, Pawns, Owned);
    }
}

void UHWSystemQASubsystem::OnlineTouch(int32 Type, const FVector2D& At)
{
    if (APlayerController* PC = GetPC())
    {
        const FTouchId Finger(IPlatformInputDeviceMapper::Get().GetDefaultInputDevice(), ETouchIndex::Touch1);
        PC->InputTouch(Finger, static_cast<ETouchType::Type>(Type), At, 1.f, FPlatformTime::Cycles64());
    }
}

void UHWSystemQASubsystem::TickOnlineLoop(float Dt)
{
    UWorld* World = GetGameInstance() ? GetGameInstance()->GetWorld() : nullptr;
    APlayerController* PC = GetPC();
    if (!World || !PC) return;
    if (ShotDir.IsEmpty()) ShotDir = QAParam(TEXT("HWQAShots="));
    const bool bLeader = Role != TEXT("member");
    const FString Map = World->GetMapName();

    if (Map != OnlineWorld)
    {
        OnlineWorld = Map;
        OnlinePhase = 0;
        OnlineTime = 0.f;
        bOnlineSent = false;
        if (Map.Contains(TEXT("GangnamBunker"))) ++OnlineShelterVisits;
        Note(FString::Printf(TEXT("online: world %s (shelter visit %d)"), *Map, OnlineShelterVisits));
    }
    OnlineTime += Dt;
    auto Fail = [&](const FString& Name, const FString& Why) { Gate(Name, false, Why); ++OnlineFails; Finish(false, Name + TEXT(": ") + Why); };
    auto Timeout = [&](float Limit, const TCHAR* What) { if (OnlineTime > Limit) { Shot(FString(TEXT("fail_")) + What, true); Fail(What, FString::Printf(TEXT("timed out in %s after %.0f s"), *Map, OnlineTime)); return true; } return false; };

    int32 W = 0, H = 0;
    PC->GetViewportSize(W, H);
    AHHShelterOnlinePlayerState* Me = PC->GetPlayerState<AHHShelterOnlinePlayerState>();
    APawn* Body = PC->GetPawn();

    // ---------------------------------------------------------------- the first screen: story or shelter
    if (Map == TEXT("L_Loading"))
    {
        const float S = H / 1080.f, CW = 620 * S, CH = 360 * S, Gap = 60 * S;
        const float X0 = (W - 2 * CW - Gap) / 2, Y0 = (H - CH) / 2 + 40 * S;
        const bool bStory = Role == TEXT("story");
        const FVector2D Card(bStory ? X0 + CW / 2 : X0 + CW + Gap + CW / 2, Y0 + CH / 2);
        if (OnlinePhase == 0 && OnlineTime > 1.5f) { Shot(TEXT("01_loading"), true); OnlineTouch(ETouchType::Began, Card); OnlinePhase = 1; }
        else if (OnlinePhase == 1 && OnlineTime > 1.6f) { OnlineTouch(ETouchType::Ended, Card); OnlinePhase = 2; }
        Timeout(20.f, TEXT("loading_choice"));
        return;
    }
    if (Role == TEXT("story"))
    {
        const bool bOk = Map.Contains(TEXT("EP01"));
        Gate(TEXT("story_opened"), bOk, Map);
        Shot(TEXT("02_story"), true);
        Finish(bOk, TEXT("loading -> story"));
        return;
    }

    // ---------------------------------------------------------------- character select
    if (Map == TEXT("L_CharacterSelect"))
    {
        FString Want = QAParam(TEXT("HWQASelect="));
        if (Want.IsEmpty()) Want = bLeader ? TEXT("ain") : TEXT("kain");
        int32 Slot = 0;
        for (int32 i = 0; i < 4; ++i) if (Want == Heroes[i]) Slot = i;
        const float S = FMath::Min(W / 1920.f, H / 1080.f), CW = 400 * S, CH = 520 * S, Gap = 24 * S;
        const float StartX = (W - (4 * CW + 3 * Gap)) * 0.5f, Y0 = 255 * S;
        const FVector2D Card(StartX + Slot * (CW + Gap) + CW / 2, Y0 + CH / 2);
        const float BW = 410 * S, BH = 76 * S;
        const FVector2D Confirm(W - BW - 86 * S + BW / 2, H - BH - 60 * S + BH / 2);
        UHHOnlineFlowSubsystem* Flow = GetGameInstance()->GetSubsystem<UHHOnlineFlowSubsystem>();
        switch (OnlinePhase)
        {
        case 0: if (OnlineTime > 1.5f) { OnlineTouch(ETouchType::Began, Card); OnlinePhase = 1; } break;
        case 1: OnlineTouch(ETouchType::Ended, Card); OnlinePhase = 2; OnlineMark = OnlineTime; break;
        case 2:
            if (OnlineTime - OnlineMark < 0.4f) break;
            {
                const bool bOk = Flow && Flow->SelectedCharacterId == FName(*Want);
                Gate(TEXT("select_touch"), bOk, FString::Printf(TEXT("touched %s -> selected %s"), *Want, Flow ? *Flow->SelectedCharacterId.ToString() : TEXT("-")));
                if (!bOk) { Finish(false, TEXT("character card touch")); return; }
            }
            Shot(TEXT("02_select"), true);
            OnlineTouch(ETouchType::Began, Confirm);
            OnlinePhase = 3;
            break;
        case 3: OnlineTouch(ETouchType::Ended, Confirm); OnlinePhase = 4; break;
        default: break;
        }
        Timeout(40.f, TEXT("shelter_travel"));
        return;
    }

    // ---------------------------------------------------------------- the shelter (starting town)
    if (Map.Contains(TEXT("GangnamBunker")))
    {
        const bool bReturn = OnlineShelterVisits >= 2;
        if (OnlinePhase == 0)
        {
            if (!(Body && Me && Me->bAdmissionValidated)) { Timeout(40.f, bReturn ? TEXT("return_admission") : TEXT("shelter_admission")); return; }
            if (OnlineTime < 1.5f) return;   // let the camera settle
            const FName Tag = bReturn ? FName(TEXT("HH_ManpowerOffice_Return")) : FName(TEXT("HH_TownStart"));
            APlayerStart* Start = StartTagged(World, Tag);
            const float D = Start ? FVector::Dist2D(Start->GetActorLocation(), Body->GetActorLocation()) : -1.f;
            const bool bAt = Start && D < 250.f;
            Gate(bReturn ? TEXT("return_spawn_manpower_office") : TEXT("first_spawn_town_start"), bAt,
                FString::Printf(TEXT("%s at %.0f cm, spawn point %s, instance %s"), *Tag.ToString(), D, *Me->ShelterSpawnPoint.ToString(), *Me->OriginShelterInstanceId));
            if (!bAt) ++OnlineFails;
            Shot(bReturn ? TEXT("07_return_manpower_office") : TEXT("03_town_start"), true);
            if (bReturn)
            {
                const bool bParty = Me->PartyId == OnlinePartyId && Me->bPartyLeader == bOnlineWasLeader;
                Gate(TEXT("return_party_restored"), bParty, FString::Printf(TEXT("party %s (was %s), leader %d (was %d)"), *Me->PartyId, *OnlinePartyId, Me->bPartyLeader, bOnlineWasLeader));
                if (!bParty) ++OnlineFails;
                const bool bSpawnPoint = Me->ShelterSpawnPoint == TEXT("ManpowerOfficeReturn");
                Gate(TEXT("return_spawn_point"), bSpawnPoint, Me->ShelterSpawnPoint.ToString());
                if (!bSpawnPoint) ++OnlineFails;
                // Matteo in front of the camera and nothing in between
                AHHShelterNPC* Matteo = nullptr;
                for (TActorIterator<AHHShelterNPC> It(World); It; ++It) if (It->NPCId == TEXT("Matteo")) Matteo = *It;
                bool bSee = false;
                FString Why = TEXT("no Matteo");
                if (Matteo && PC->PlayerCameraManager)
                {
                    const FVector Eye = PC->PlayerCameraManager->GetCameraLocation();
                    const FVector Target = Matteo->GetActorLocation() + FVector(0, 0, 120);
                    const float Angle = FMath::RadiansToDegrees(FMath::Acos(FVector::DotProduct(PC->PlayerCameraManager->GetCameraRotation().Vector(), (Target - Eye).GetSafeNormal())));
                    FHitResult Hit;
                    FCollisionQueryParams Q(TEXT("HWQAMatteo"), false, Body);
                    Q.AddIgnoredActor(Matteo);
                    const bool bBlocked = World->LineTraceSingleByChannel(Hit, Eye, Target, ECC_Visibility, Q);
                    bSee = Angle < 45.f && !bBlocked;
                    Why = FString::Printf(TEXT("%.0f deg off the view, %.0f cm, %s"), Angle, FVector::Dist(Eye, Target), bBlocked ? *FString::Printf(TEXT("blocked by %s"), *GetNameSafe(Hit.GetActor())) : TEXT("clear"));
                }
                Gate(TEXT("return_matteo_in_view"), bSee, Why);
                if (!bSee) ++OnlineFails;
                Finish(OnlineFails == 0, FString::Printf(TEXT("online loop done, %d fails"), OnlineFails));
                return;
            }
            OnlinePhase = 1;
            OnlineTime = 0.f;
            return;
        }
        TArray<AHHShelterOnlinePlayerState*> Here = Admitted(World);
        AHHShelterOnlinePlayerState* Other = nullptr;
        for (AHHShelterOnlinePlayerState* P : Here) if (P != Me) Other = P;
        AHHShelterOnlinePlayerController* OPC = Cast<AHHShelterOnlinePlayerController>(PC);
        if (!OPC) { Fail(TEXT("shelter_controller"), TEXT("not the online player controller")); return; }
        switch (OnlinePhase)
        {
        case 1:   // see each other
            if (Other && BodyOf(World, Other))
            {
                Gate(TEXT("sees_other_player"), true, FString::Printf(TEXT("%s (%s) at %.0f cm"), *Other->GetPlayerName(), *Other->SelectedCharacterId.ToString(), FVector::Dist(BodyOf(World, Other)->GetActorLocation(), Body->GetActorLocation())));
                Shot(TEXT("04_two_players"), true);
                OnlinePhase = 2; OnlineTime = 0.f; bOnlineSent = false;
            }
            else if (OnlineTime > 60.f) { Fail(TEXT("sees_other_player"), Census(World)); return; }
            break;
        case 2:   // party: leader creates and invites, member accepts
            if (bLeader)
            {
                if (!bOnlineSent) { OPC->ServerCreateParty(); bOnlineSent = true; OnlineMark = OnlineTime; }
                else if (!Me->PartyId.IsEmpty() && Other && Other->PartyId.IsEmpty() && OnlineTime - OnlineMark > 1.f)
                {
                    OPC->ServerInviteToParty(Other);
                    OnlineMark = OnlineTime;
                }
            }
            else if (Me->HasPendingInvite() && Me->PartyId.IsEmpty() && OnlineTime - OnlineMark > 0.5f)
            {
                OPC->ServerAcceptPartyInvite();
                OnlineMark = OnlineTime;
            }
            if (!Me->PartyId.IsEmpty() && Other && Other->PartyId == Me->PartyId)
            {
                OnlinePartyId = Me->PartyId;
                bOnlineWasLeader = Me->bPartyLeader;
                Gate(TEXT("party_formed"), Me->bPartyLeader == bLeader, FString::Printf(TEXT("party %s, leader %d"), *Me->PartyId, Me->bPartyLeader));
                OPC->ServerSetPartyReady(true);
                OnlinePhase = 3; OnlineTime = 0.f; OnlineMark = 0.f;
            }
            else Timeout(40.f, TEXT("party_formed"));
            break;
        case 3:   // both walk into the deployment gate's party volume (x -120 / +120 so they do not shove)
        {
            AHHDeploymentGate* GateActor = nullptr;
            for (TActorIterator<AHHDeploymentGate> It(World); It; ++It) GateActor = *It;
            if (!GateActor) { Fail(TEXT("gate_exists"), TEXT("no AHHDeploymentGate in the shelter")); return; }
            const FVector Volume = GateActor->GetActorTransform().TransformPosition(FVector(bLeader ? -120.f : 120.f, 440.f, 0.f));
            const FVector To = Volume - Body->GetActorLocation();
            const FVector Pending = Body->GetPendingMovementInputVector();
            if (To.Size2D() > 60.f) Body->AddMovementInput(To.GetSafeNormal2D(), 1.f);
            if (OnlineTime - OnlineMark > 3.f)
            {
                OnlineMark = OnlineTime;
                const FVector L = Body->GetActorLocation();
                const ACharacter* C = Cast<ACharacter>(Body);
                const UCharacterMovementComponent* M = C ? C->GetCharacterMovement() : nullptr;
                Note(FString::Printf(TEXT("online: body role %d, move ignored %d, controller %s, movement %s mode %d active %d speed max %.0f, pending before %.2f, after %.2f"),
                    (int32)Body->GetLocalRole(), Body->IsMoveInputIgnored(), *GetNameSafe(Body->GetController()), *GetNameSafe(M),
                    M ? (int32)M->MovementMode.GetValue() : -1, M && M->IsActive(), M ? M->GetMaxSpeed() : 0.f, Pending.Size(), Body->GetPendingMovementInputVector().Size()));
                Note(FString::Printf(TEXT("online: walking at (%.0f, %.0f, %.0f) speed %.0f, %.0f cm to go, ready %d, other %s"),
                    L.X, L.Y, L.Z, Body->GetVelocity().Size2D(), To.Size2D(), Me->bPartyReady,
                    Other && BodyOf(World, Other) ? *BodyOf(World, Other)->GetActorLocation().ToCompactString() : TEXT("-")));
            }
            const FVector Center = GateActor->GetActorTransform().TransformPosition(FVector(0, 440.f, 0));
            auto Inside = [&](APawn* P) { const FVector L = P->GetActorLocation() - Center; return FMath::Abs(L.X) < 290.f && FMath::Abs(L.Y) < 340.f; };
            if (Me->bPartyReady && Inside(Body) && Other && BodyOf(World, Other) && Inside(BodyOf(World, Other)) && Other->bPartyReady)
            {
                Gate(TEXT("both_at_gate"), true, FString::Printf(TEXT("walked %.0f s"), OnlineTime));
                Shot(TEXT("05_at_gate"), true);
                OnlinePhase = 4; OnlineTime = 0.f; bOnlineSent = false; OnlineMark = 0.f;
            }
            else Timeout(60.f, TEXT("both_at_gate"));
            break;
        }
        case 4:   // leader starts; the gate opens; everyone travels
            if (bLeader && !bOnlineSent && OnlineTime > 1.f)
            {
                OPC->ServerStartDungeon(TEXT("GangnamStation_B2"));
                bOnlineSent = true;
                OnlineMark = OnlineTime;
            }
            if (bOnlineSent && OnlineTime - OnlineMark > 1.2f && OnlineMark >= 0.f)
            {
                Shot(TEXT("06_gate_opening"), true);
                OnlineMark = -1000.f;
            }
            Timeout(60.f, TEXT("dungeon_travel"));
            break;
        default: break;
        }
        return;
    }

    // ---------------------------------------------------------------- the dungeon server
    if (!(Body && Me && Me->bAdmissionValidated)) { Timeout(40.f, TEXT("dungeon_admission")); return; }
    TArray<AHHShelterOnlinePlayerState*> Here = Admitted(World);
    switch (OnlinePhase)
    {
    case 0:
        if (OnlineTime < 1.5f) break;
        {
            const bool bSame = Me->PartyId == OnlinePartyId && !OnlinePartyId.IsEmpty();
            Gate(TEXT("dungeon_admitted"), bSame, FString::Printf(TEXT("%s, party %s (shelter %s), hero %s"), *Map, *Me->PartyId, *OnlinePartyId, *Me->SelectedCharacterId.ToString()));
            if (!bSame) ++OnlineFails;
        }
        Shot(TEXT("06_dungeon"), true);
        OnlinePhase = 1; OnlineTime = 0.f;
        break;
    case 1:
        if (Here.Num() >= 2)
        {
            Gate(TEXT("dungeon_both_players"), true, FString::Printf(TEXT("%d admitted"), Here.Num()));
            OnlinePhase = 2; OnlineTime = 0.f; bOnlineSent = false;
        }
        else if (OnlineTime > 40.f) { Fail(TEXT("dungeon_both_players"), Census(World)); return; }
        break;
    case 2:
        // -HWQACompleteAfter=<s>: hold the run (the fallback test closes the first shelter meanwhile)
        if (bLeader && !bOnlineSent && OnlineTime > FMath::Max(3.f, (float)FCString::Atof(*QAParam(TEXT("HWQACompleteAfter=")))))
        {
            if (AHHShelterOnlinePlayerController* OPC = Cast<AHHShelterOnlinePlayerController>(PC)) OPC->ServerDevCompleteDungeon();
            bOnlineSent = true;
            Note(TEXT("online: leader completes the run"));
        }
        Timeout(60.f, TEXT("return_travel"));
        break;
    default: break;
    }
}
