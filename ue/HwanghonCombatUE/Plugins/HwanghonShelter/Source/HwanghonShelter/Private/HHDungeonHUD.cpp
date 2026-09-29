#include "HHDungeonHUD.h"
#include "HHShelterOnlinePlayerState.h"

#include "CanvasItem.h"
#include "Engine/Canvas.h"
#include "GameFramework/GameStateBase.h"
#include "GameFramework/PlayerController.h"

void AHHDungeonHUD::DrawPanel(float X,float Y,float W,float H,const FLinearColor& Color) const
{
    if(!Canvas) return;
    FCanvasTileItem Tile(FVector2D(X,Y),FVector2D(W,H),Color);
    Tile.BlendMode=SE_BLEND_Translucent;
    Canvas->DrawItem(Tile);
}

void AHHDungeonHUD::DrawBar(float X,float Y,float W,float H,float Ratio,const FLinearColor& Fill,const FLinearColor& Back) const
{
    DrawPanel(X,Y,W,H,Back);
    DrawPanel(X,Y,W*FMath::Clamp(Ratio,0.f,1.f),H,Fill);
}

void AHHDungeonHUD::DrawHUD()
{
    Super::DrawHUD();
    if(!Canvas) return;

    const float S=FMath::Min(Canvas->SizeX/1920.f,Canvas->SizeY/1080.f);
    DrawPlayerCombatState(S);
    DrawSkillBar(S);
    DrawPartyCompact(S);
}

void AHHDungeonHUD::DrawPlayerCombatState(float S)
{
    const float X=28*S;
    const float Y=26*S;
    const float W=210*S;

    DrawBar(X,Y,W,5*S,HealthRatio,
        FLinearColor(0.61f,0.10f,0.08f,0.95f),
        FLinearColor(0.06f,0.03f,0.03f,0.70f));

    DrawBar(X,Y+10*S,W*0.78f,3*S,ResourceRatio,
        FLinearColor(0.18f,0.37f,0.57f,0.92f),
        FLinearColor(0.025f,0.05f,0.08f,0.62f));
}

void AHHDungeonHUD::DrawSkillBar(float S)
{
    // Combat only. Shelter HUD intentionally does not draw this.
    const int32 Count=6;
    const float Cell=50*S;
    const float Gap=9*S;
    const float Total=Count*Cell+(Count-1)*Gap;
    const float X=(Canvas->SizeX-Total)*0.5f;
    const float Y=Canvas->SizeY-76*S;

    for(int32 i=0;i<Count;i++)
    {
        const float CX=X+i*(Cell+Gap);
        DrawPanel(CX,Y,Cell,Cell,FLinearColor(0.008f,0.011f,0.015f,0.66f));
        DrawPanel(CX+2*S,Y+2*S,Cell-4*S,Cell-4*S,
            FLinearColor(0.10f,0.105f,0.11f,0.72f));

        DrawText(FString::FromInt(i+1),
            FLinearColor(0.52f,0.54f,0.56f,0.92f),
            CX+5*S,Y+33*S,nullptr,0.48f*S,false);
    }
}

void AHHDungeonHUD::DrawPartyCompact(float S)
{
    APlayerController* PC=GetOwningPlayerController();
    AHHShelterOnlinePlayerState* LocalPS=PC?PC->GetPlayerState<AHHShelterOnlinePlayerState>():nullptr;
    AGameStateBase* GS=GetWorld()?GetWorld()->GetGameState():nullptr;
    if(!LocalPS||!GS||LocalPS->PartyId.IsEmpty()) return;

    TArray<AHHShelterOnlinePlayerState*> Members;
    for(APlayerState* BasePS:GS->PlayerArray)
    {
        if(AHHShelterOnlinePlayerState* PS=Cast<AHHShelterOnlinePlayerState>(BasePS))
        {
            if(PS->PartyId==LocalPS->PartyId) Members.Add(PS);
        }
    }

    if(Members.Num()<=1) return;

    const float X=28*S;
    const float Y=54*S;
    const float W=156*S;
    const float Row=24*S;

    float CY=Y;
    for(AHHShelterOnlinePlayerState* PS:Members)
    {
        if(PS==LocalPS) continue;

        DrawText(PS->GetPlayerName(),
            FLinearColor(0.72f,0.73f,0.73f,0.92f),
            X,CY,nullptr,0.47f*S,false);

        // Do not fake teammate HP. Connect the real replicated health component/ViewModel later.
        CY+=Row;
    }
}
