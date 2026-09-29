#include "HHShelterHUD.h"
#include "HHHubSubsystem.h"
#include "HHShelterStation.h"
#include "HHShelterNPC.h"

#include "Engine/Canvas.h"
#include "CanvasItem.h"
#include "Engine/Engine.h"
#include "Engine/Texture2D.h"

void AHHShelterHUD::DrawPanel(float X, float Y, float W, float H, const FLinearColor& Color) const
{
    if (!Canvas) return;
    FCanvasTileItem Tile(FVector2D(X, Y), FVector2D(W, H), Color);
    Tile.BlendMode = SE_BLEND_Translucent;
    Canvas->DrawItem(Tile);
}

void AHHShelterHUD::DrawBar(float X, float Y, float W, float H, float Ratio, const FLinearColor& Fill, const FLinearColor& Back) const
{
    DrawPanel(X, Y, W, H, Back);
    DrawPanel(X + 1, Y + 1, FMath::Max(0.f, (W - 2) * FMath::Clamp(Ratio, 0.f, 1.f)), H - 2, Fill);
}

void AHHShelterHUD::DrawHUD()
{
    Super::DrawHUD();
    if (!Canvas || Canvas->SizeX <= 0 || Canvas->SizeY <= 0) return;

    const float Scale = Canvas->SizeX / 1920.f;
    DrawPlayerSummary(Scale);
    DrawQuestRail(Scale);
    DrawSkillBar(Scale);
    DrawMiniMap(Scale);

    UHHHubSubsystem* Hub = GetWorld() ? GetWorld()->GetSubsystem<UHHHubSubsystem>() : nullptr;
    if (!Hub) return;

    if (AHHShelterNPC* ActiveNPC = Hub->GetActiveNPC())
    {
        DrawNPCDialogue(ActiveNPC, Scale);
        return;
    }

    if (AHHShelterStation* ActiveStation = Hub->GetActiveStation())
    {
        DrawStationMenu(ActiveStation, Scale);
        return;
    }

    if (AHHShelterNPC* FocusedNPC = Hub->GetFocusedNPC())
    {
        DrawNPCPrompt(FocusedNPC, Scale);
    }
    else if (AHHShelterStation* FocusedStation = Hub->GetFocusedStation())
    {
        DrawStationPrompt(FocusedStation, Scale);
    }
}

void AHHShelterHUD::DrawPlayerSummary(float S)
{
    const float X=24*S, Y=22*S, W=270*S, H=88*S;
    DrawPanel(X,Y,W,H,FLinearColor(0.01f,0.012f,0.015f,0.78f));
    DrawText(FString::Printf(TEXT("LV.%d   %s"), PlayerLevel, *PlayerName), FLinearColor::White, X+18*S,Y+12*S,nullptr,1.0f*S,false);
    DrawBar(X+18*S,Y+44*S,220*S,12*S,HealthRatio,FLinearColor(0.55f,0.06f,0.05f,0.95f),FLinearColor(0.08f,0.02f,0.02f,0.9f));
    DrawBar(X+18*S,Y+62*S,220*S,9*S,ResourceRatio,FLinearColor(0.08f,0.36f,0.65f,0.95f),FLinearColor(0.02f,0.04f,0.08f,0.9f));
}

void AHHShelterHUD::DrawQuestRail(float S)
{
    const float W=360*S,H=170*S,X=Canvas->SizeX-W-26*S,Y=128*S;
    DrawPanel(X,Y,W,H,FLinearColor(0.008f,0.01f,0.012f,0.76f));
    DrawText(TEXT("◆  다시, 지하에서"),FLinearColor(0.94f,0.48f,0.12f,1),X+18*S,Y+15*S,nullptr,0.95f*S,false);
    DrawText(TEXT("□ 거점 NPC와 대화하기"),FLinearColor(0.86f,0.86f,0.83f,1),X+20*S,Y+55*S,nullptr,0.72f*S,false);
    DrawText(TEXT("□ 등급측정소에서 상태 확인"),FLinearColor(0.86f,0.86f,0.83f,1),X+20*S,Y+84*S,nullptr,0.72f*S,false);
    DrawText(TEXT("□ 의뢰소에서 새 의뢰 확인"),FLinearColor(0.86f,0.86f,0.83f,1),X+20*S,Y+113*S,nullptr,0.72f*S,false);
}

void AHHShelterHUD::DrawSkillBar(float S)
{
    const int32 Count=8;
    const float Cell=54*S, Gap=8*S;
    const float W=Count*Cell+(Count-1)*Gap;
    const float X=(Canvas->SizeX-W)*0.5f, Y=Canvas->SizeY-92*S;
    for(int32 i=0;i<Count;i++)
    {
        const float CX=X+i*(Cell+Gap);
        DrawPanel(CX,Y,Cell,Cell,FLinearColor(0.015f,0.018f,0.022f,0.86f));
        DrawPanel(CX+3*S,Y+3*S,Cell-6*S,Cell-6*S,i<6?FLinearColor(0.14f+0.02f*i,0.14f,0.12f,0.75f):FLinearColor(0.05f,0.05f,0.05f,0.65f));
        DrawText(FString::FromInt(i+1),FLinearColor(0.9f,0.9f,0.9f,1),CX+5*S,Y+35*S,nullptr,0.62f*S,false);
    }
}

void AHHShelterHUD::DrawMiniMap(float S)
{
    const float W=188*S,H=150*S,X=24*S,Y=Canvas->SizeY-H-34*S;
    DrawPanel(X,Y,W,H,FLinearColor(0.01f,0.012f,0.015f,0.78f));
    DrawText(TEXT("강남 벙커 B-1"),FLinearColor(0.85f,0.85f,0.82f,1),X+10*S,Y+9*S,nullptr,0.62f*S,false);

    // Dungeon-like central core + seven branches.
    DrawPanel(X+82*S,Y+62*S,24*S,24*S,FLinearColor(0.25f,0.25f,0.24f,0.9f));
    const TCHAR* Labels[7]={TEXT("01"),TEXT("02"),TEXT("03"),TEXT("04"),TEXT("05"),TEXT("06"),TEXT("07")};
    const FVector2D P[7]={{78,28},{23,49},{133,49},{21,94},{135,94},{36,120},{121,120}};
    for(int32 i=0;i<7;i++)
    {
        DrawPanel(X+P[i].X*S,Y+P[i].Y*S,30*S,19*S,FLinearColor(0.11f,0.12f,0.13f,0.9f));
        DrawText(Labels[i],FLinearColor::White,X+(P[i].X+5)*S,Y+(P[i].Y+1)*S,nullptr,0.48f*S,false);
    }
}

void AHHShelterHUD::DrawStationPrompt(AHHShelterStation* Station,float S)
{
    if(!Station) return;
    const float W=430*S,H=54*S,X=(Canvas->SizeX-W)*0.5f,Y=Canvas->SizeY*0.61f;
    DrawPanel(X,Y,W,H,FLinearColor(0.005f,0.007f,0.01f,0.84f));
    DrawText(Station->GetPromptText().ToString(),FLinearColor(0.95f,0.95f,0.92f,1),X+18*S,Y+14*S,nullptr,0.78f*S,false);
}

void AHHShelterHUD::DrawNPCPrompt(AHHShelterNPC* NPC,float S)
{
    if(!NPC) return;
    const float W=500*S,H=58*S,X=(Canvas->SizeX-W)*0.5f,Y=Canvas->SizeY*0.61f;
    DrawPanel(X,Y,W,H,FLinearColor(0.005f,0.007f,0.01f,0.87f));
    DrawPanel(X,Y,5*S,H,NPC->AccentColor);
    DrawText(NPC->GetPromptText().ToString(),FLinearColor(0.96f,0.96f,0.93f,1),X+22*S,Y+15*S,nullptr,0.80f*S,false);
}

void AHHShelterHUD::DrawNPCDialogue(AHHShelterNPC* NPC,float S)
{
    if(!NPC) return;

    const float W=960*S,H=220*S,X=(Canvas->SizeX-W)*0.5f,Y=Canvas->SizeY-H-118*S;
    DrawPanel(X,Y,W,H,FLinearColor(0.006f,0.008f,0.012f,0.96f));
    DrawPanel(X,Y,7*S,H,NPC->AccentColor);

    float TextX = X + 38*S;
    const float PortraitSize = 160*S;

    if (UTexture2D* Portrait = NPC->LoadPortraitTexture())
    {
        if (Portrait->GetResource())
        {
            FCanvasTileItem PortraitTile(
                FVector2D(X+24*S,Y+24*S),
                Portrait->GetResource(),
                FVector2D(PortraitSize,PortraitSize),
                FLinearColor::White
            );
            PortraitTile.BlendMode = SE_BLEND_Translucent;
            Canvas->DrawItem(PortraitTile);
            TextX = X + 210*S;
        }
    }

    DrawText(NPC->DisplayName.ToString(),FLinearColor::White,TextX,Y+24*S,nullptr,1.15f*S,false);
    DrawText(NPC->RoleName.ToString(),NPC->AccentColor,TextX,Y+59*S,nullptr,0.67f*S,false);
    DrawText(NPC->GetCurrentDialogueText().ToString(),FLinearColor(0.94f,0.94f,0.91f,1),TextX,Y+104*S,nullptr,0.92f*S,false);

    DrawText(
        FString::Printf(TEXT("F / ENTER  다음     E  %s     ESC  닫기"), *NPC->StationUseLabel.ToString()),
        FLinearColor(0.56f,0.59f,0.62f,1),
        TextX,Y+174*S,nullptr,0.60f*S,false
    );
}

void AHHShelterHUD::DrawStationMenu(AHHShelterStation* Station,float S)
{
    if(!Station) return;
    const float W=520*S,H=360*S,X=(Canvas->SizeX-W)*0.5f,Y=(Canvas->SizeY-H)*0.5f;
    DrawPanel(X,Y,W,H,FLinearColor(0.008f,0.009f,0.012f,0.94f));
    DrawPanel(X,Y,W,5*S,Station->AccentColor);
    DrawText(Station->GetMenuTitle().ToString(),FLinearColor::White,X+28*S,Y+28*S,nullptr,1.1f*S,false);
    DrawText(Station->InteractionLabel.ToString(),FLinearColor(0.66f,0.68f,0.70f,1),X+28*S,Y+66*S,nullptr,0.72f*S,false);

    const TArray<FText> Items=Station->GetMenuItems();
    float IY=Y+112*S;
    for(int32 i=0;i<Items.Num();++i)
    {
        DrawPanel(X+28*S,IY,W-56*S,44*S,FLinearColor(0.07f,0.075f,0.08f,0.88f));
        DrawText(FString::Printf(TEXT("%d   %s"),i+1,*Items[i].ToString()),FLinearColor(0.92f,0.92f,0.9f,1),X+45*S,IY+11*S,nullptr,0.76f*S,false);
        IY+=52*S;
    }
    DrawText(TEXT("ESC  닫기"),FLinearColor(0.55f,0.57f,0.59f,1),X+W-110*S,Y+H-30*S,nullptr,0.6f*S,false);
}
