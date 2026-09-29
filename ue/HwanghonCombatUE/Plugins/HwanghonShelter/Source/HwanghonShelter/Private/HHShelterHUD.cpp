#include "HHShelterHUD.h"
#include "HHHubSubsystem.h"
#include "HHShelterNPC.h"
#include "HHShelterOnlinePlayerState.h"
#include "HHShelterStation.h"

#include "CanvasItem.h"
#include "Engine/Canvas.h"
#include "GameFramework/GameStateBase.h"
#include "GameFramework/PlayerController.h"

void AHHShelterHUD::DrawPanel(float X, float Y, float W, float H, const FLinearColor& Color) const
{
    if (!Canvas) return;
    FCanvasTileItem Tile(FVector2D(X,Y), FVector2D(W,H), Color);
    Tile.BlendMode = SE_BLEND_Translucent;
    Canvas->DrawItem(Tile);
}

void AHHShelterHUD::DrawBar(float X, float Y, float W, float H, float Ratio, const FLinearColor& Fill, const FLinearColor& Back) const
{
    DrawPanel(X,Y,W,H,Back);
    DrawPanel(X,Y,W*FMath::Clamp(Ratio,0.f,1.f),H,Fill);
}

void AHHShelterHUD::DrawHUD()
{
    Super::DrawHUD();
    if (!Canvas || Canvas->SizeX <= 0 || Canvas->SizeY <= 0) return;

    const float S = FMath::Min(Canvas->SizeX/1920.f, Canvas->SizeY/1080.f);

    // Shelter = starting town. Do not show combat skill bar, quest rail or permanent minimap.
    DrawMinimalStatus(S);
    DrawReturnHint(S);
    DrawPartyCompact(S);

    UHHHubSubsystem* Hub = GetWorld() ? GetWorld()->GetSubsystem<UHHHubSubsystem>() : nullptr;
    if (!Hub) return;

    if (AHHShelterNPC* ActiveNPC = Hub->GetActiveNPC())
    {
        DrawNPCDialogue(ActiveNPC,S);
        return;
    }

    if (AHHShelterStation* ActiveStation = Hub->GetActiveStation())
    {
        DrawStationMenu(ActiveStation,S);
        return;
    }

    if (AHHShelterNPC* NPC = Hub->GetFocusedNPC())
    {
        DrawNPCPrompt(NPC,S);
    }
    else if (AHHShelterStation* Station = Hub->GetFocusedStation())
    {
        DrawStationPrompt(Station,S);
    }
}

void AHHShelterHUD::DrawMinimalStatus(float S)
{
    // Two quiet hairline bars. No portrait/name/level block in town.
    const float X=28*S;
    const float Y=26*S;
    const float W=136*S;

    if (HealthRatio < 0.999f)
    {
        DrawBar(X,Y,W,3*S,HealthRatio,
            FLinearColor(0.56f,0.10f,0.08f,0.90f),
            FLinearColor(0.08f,0.05f,0.05f,0.58f));
    }

    if (ResourceRatio < 0.999f)
    {
        DrawBar(X,Y+8*S,W,2*S,ResourceRatio,
            FLinearColor(0.20f,0.35f,0.48f,0.75f),
            FLinearColor(0.04f,0.055f,0.07f,0.50f));
    }
}

void AHHShelterHUD::DrawReturnHint(float S)
{
    APlayerController* PC = GetOwningPlayerController();
    AHHShelterOnlinePlayerState* PS = PC ? PC->GetPlayerState<AHHShelterOnlinePlayerState>() : nullptr;
    if (!PS || PS->ShelterSpawnPoint != TEXT("ManpowerOfficeReturn"))
    {
        return;
    }

    // One-line return objective only. No checklist.
    const float W=190*S;
    const float X=Canvas->SizeX-W-28*S;
    const float Y=30*S;

    DrawPanel(X,Y,W,34*S,FLinearColor(0.01f,0.012f,0.015f,0.52f));
    DrawPanel(X,Y,3*S,34*S,FLinearColor(0.68f,0.38f,0.15f,0.90f));
    DrawText(TEXT("마태오 · 귀환 보고"),
        FLinearColor(0.80f,0.78f,0.73f,0.94f),
        X+14*S,Y+8*S,nullptr,0.54f*S,false);
}

void AHHShelterHUD::DrawPartyCompact(float S)
{
    APlayerController* PC = GetOwningPlayerController();
    AHHShelterOnlinePlayerState* LocalPS = PC ? PC->GetPlayerState<AHHShelterOnlinePlayerState>() : nullptr;
    AGameStateBase* GS = GetWorld() ? GetWorld()->GetGameState() : nullptr;
    if (!LocalPS || !GS) return;

    if (LocalPS->PartyId.IsEmpty())
    {
        // Only show something when an invite actually exists.
        if (!LocalPS->HasPendingInvite()) return;

        const float W=220*S;
        const float X=28*S;
        const float Y=56*S;

        DrawPanel(X,Y,W,42*S,FLinearColor(0.01f,0.012f,0.015f,0.72f));
        DrawText(LocalPS->PendingInviteLeaderName,
            FLinearColor(0.89f,0.86f,0.79f,1),
            X+12*S,Y+7*S,nullptr,0.58f*S,false);
        DrawText(TEXT("Y / N"),
            FLinearColor(0.55f,0.56f,0.58f,1),
            X+W-58*S,Y+8*S,nullptr,0.50f*S,false);
        return;
    }

    TArray<AHHShelterOnlinePlayerState*> Members;
    for (APlayerState* BasePS : GS->PlayerArray)
    {
        if (AHHShelterOnlinePlayerState* PS = Cast<AHHShelterOnlinePlayerState>(BasePS))
        {
            if (PS->PartyId == LocalPS->PartyId)
            {
                Members.Add(PS);
            }
        }
    }

    if (Members.IsEmpty()) return;

    const float X=28*S;
    const float Y=56*S;
    const float W=176*S;
    const float Row=26*S;
    const float H=(12.f + Members.Num()*26.f)*S;

    DrawPanel(X,Y,W,H,FLinearColor(0.008f,0.01f,0.013f,0.46f));

    float CY=Y+7*S;
    for (AHHShelterOnlinePlayerState* PS : Members)
    {
        const FLinearColor Dot = PS->bPartyReady
            ? FLinearColor(0.40f,0.70f,0.43f,0.92f)
            : FLinearColor(0.34f,0.35f,0.36f,0.78f);

        DrawPanel(X+10*S,CY+7*S,4*S,4*S,Dot);

        const FString Prefix = PS->bPartyLeader ? TEXT("◇ ") : TEXT("");
        DrawText(Prefix+PS->GetPlayerName(),
            FLinearColor(0.77f,0.78f,0.77f,0.95f),
            X+22*S,CY,nullptr,0.51f*S,false);

        CY += Row;
    }
}

void AHHShelterHUD::DrawNPCPrompt(AHHShelterNPC* NPC,float S)
{
    if (!NPC) return;

    const float CX=Canvas->SizeX*0.5f;
    const float Y=Canvas->SizeY*0.69f;

    // Tiny interaction glyph + name only.
    DrawPanel(CX-31*S,Y,30*S,30*S,FLinearColor(0.015f,0.018f,0.021f,0.78f));
    DrawText(TEXT("F"),
        FLinearColor(0.90f,0.89f,0.85f,1),
        CX-22*S,Y+5*S,nullptr,0.60f*S,false);

    DrawText(NPC->DisplayName.ToString(),
        FLinearColor(0.83f,0.83f,0.80f,0.96f),
        CX+8*S,Y+6*S,nullptr,0.58f*S,false);
}

void AHHShelterHUD::DrawStationPrompt(AHHShelterStation* Station,float S)
{
    if (!Station) return;

    const float CX=Canvas->SizeX*0.5f;
    const float Y=Canvas->SizeY*0.69f;

    DrawPanel(CX-31*S,Y,30*S,30*S,FLinearColor(0.015f,0.018f,0.021f,0.78f));
    DrawText(TEXT("F"),
        FLinearColor(0.90f,0.89f,0.85f,1),
        CX-22*S,Y+5*S,nullptr,0.60f*S,false);

    DrawText(Station->GetMenuTitle().ToString(),
        FLinearColor(0.78f,0.79f,0.78f,0.94f),
        CX+8*S,Y+6*S,nullptr,0.56f*S,false);
}

void AHHShelterHUD::DrawNPCDialogue(AHHShelterNPC* NPC,float S)
{
    if (!NPC) return;

    // Subtitle treatment, not a full dialogue window.
    const float W=760*S;
    const float H=104*S;
    const float X=(Canvas->SizeX-W)*0.5f;
    const float Y=Canvas->SizeY-H-52*S;

    DrawPanel(X,Y,W,H,FLinearColor(0.006f,0.008f,0.011f,0.72f));
    DrawPanel(X,Y,3*S,H,FLinearColor(NPC->AccentColor.R,NPC->AccentColor.G,NPC->AccentColor.B,0.78f));

    DrawText(NPC->DisplayName.ToString(),
        NPC->AccentColor,
        X+20*S,Y+14*S,nullptr,0.58f*S,false);

    DrawText(NPC->GetCurrentDialogueText().ToString(),
        FLinearColor(0.93f,0.92f,0.89f,1),
        X+20*S,Y+45*S,nullptr,0.78f*S,false);

    // Only two tiny action hints.
    DrawText(TEXT("F"),
        FLinearColor(0.47f,0.49f,0.51f,0.9f),
        X+W-58*S,Y+18*S,nullptr,0.48f*S,false);

    DrawText(TEXT("E"),
        FLinearColor(0.47f,0.49f,0.51f,0.9f),
        X+W-58*S,Y+56*S,nullptr,0.48f*S,false);
}

void AHHShelterHUD::DrawStationMenu(AHHShelterStation* Station,float S)
{
    if (!Station) return;

    // Slim side rail so the room remains visible.
    const float W=330*S;
    const float X=Canvas->SizeX-W-36*S;
    const float Y=Canvas->SizeY*0.22f;
    const TArray<FText> Items=Station->GetMenuItems();
    const float H=(86.f + Items.Num()*42.f)*S;

    DrawPanel(X,Y,W,H,FLinearColor(0.006f,0.008f,0.011f,0.84f));
    DrawPanel(X,Y,3*S,H,FLinearColor(Station->AccentColor.R,Station->AccentColor.G,Station->AccentColor.B,0.82f));

    DrawText(Station->GetMenuTitle().ToString(),
        FLinearColor(0.93f,0.92f,0.89f,1),
        X+22*S,Y+18*S,nullptr,0.80f*S,false);

    float CY=Y+58*S;
    for (int32 i=0;i<Items.Num();++i)
    {
        DrawText(Items[i].ToString(),
            FLinearColor(0.72f,0.73f,0.73f,0.96f),
            X+24*S,CY,nullptr,0.62f*S,false);
        CY += 42*S;
    }

    DrawText(TEXT("ESC"),
        FLinearColor(0.35f,0.36f,0.38f,0.86f),
        X+W-55*S,Y+18*S,nullptr,0.43f*S,false);
}
