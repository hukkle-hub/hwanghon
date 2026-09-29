#include "Game/HWShelterCanon.h"

#include "Dom/JsonObject.h"
#include "Engine/GameInstance.h"
#include "Engine/Texture2D.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "HHShelterNPC.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Progression/HWProfileSubsystem.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

int32 HWShelterCanon::Apply(UWorld* World)
{
    FString Raw;
    TSharedPtr<FJsonObject> Root;
    const FString Path = FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Data/shelter_npcs.json"));
    if (!FFileHelper::LoadFileToString(Raw, *Path) || !FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Raw), Root) || !Root)
    {
        UE_LOG(LogTemp, Warning, TEXT("[HWShelter] %s missing: the plugin's own NPC lines stay"), *Path);
        return 0;
    }
    const TSharedPtr<FJsonObject>* Npcs = nullptr;
    if (!Root->TryGetObjectField(TEXT("npcs"), Npcs)) return 0;
    int32 CanonNPCs = 0;
    const UHWProfileSubsystem* Profile = World && World->GetGameInstance() ? World->GetGameInstance()->GetSubsystem<UHWProfileSubsystem>() : nullptr;

    for (TActorIterator<AHHShelterNPC> It(World); It; ++It)
    {
        AHHShelterNPC* Npc = *It;
        const TSharedPtr<FJsonObject>* Canon = nullptr;
        if (!(*Npcs)->TryGetObjectField(Npc->NPCId.ToString(), Canon)) continue;
        const TSharedPtr<FJsonObject> C = *Canon;

        FString AliveFlag;
        if (Profile && C->TryGetStringField(TEXT("alive_flag"), AliveFlag) && Profile->GetStoryFlag(FName(*AliveFlag)) == TEXT("false"))
        {
            // the story took them (EP18: Han the smith) - the room stays, the person does not
            Npc->SetActorHiddenInGame(true);
            Npc->SetActorEnableCollision(false);
            Npc->DialogueLines.Reset();
            UE_LOG(LogTemp, Display, TEXT("[HWShelter] %s absent (%s=false)"), *Npc->NPCId.ToString(), *AliveFlag);
            continue;
        }
        Npc->DisplayName = FText::FromString(C->GetStringField(TEXT("name")));
        Npc->RoleName = FText::FromString(C->GetStringField(TEXT("role")));
        Npc->DialogueLines.Reset();
        for (const TSharedPtr<FJsonValue>& L : C->GetArrayField(TEXT("lines")))
        {
            Npc->DialogueLines.Add(FText::FromString(L->AsObject()->GetStringField(TEXT("text"))));
        }
        FString Portrait;
        if (C->TryGetStringField(TEXT("portrait"), Portrait) && !Portrait.IsEmpty())
        {
            Npc->PortraitTexture = TSoftObjectPtr<UTexture2D>(FSoftObjectPath(
                FString::Printf(TEXT("/Game/Hwanghon/UI/NPC/T_%s_Portrait.T_%s_Portrait"), *Npc->NPCId.ToString(), *Npc->NPCId.ToString())));
        }
        Npc->RerunConstructionScripts();   // name plate
        ++CanonNPCs;
    }
    UE_LOG(LogTemp, Display, TEXT("[HWShelter] %d NPCs speak the novel's lines"), CanonNPCs);
    return CanonNPCs;
}
