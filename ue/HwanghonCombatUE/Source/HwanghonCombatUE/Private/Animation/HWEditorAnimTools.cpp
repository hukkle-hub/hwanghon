#include "Animation/HWEditorAnimTools.h"

#if WITH_EDITOR
#include "Animation/AnimBlueprint.h"
#include "AnimGraphNode_Root.h"
#include "AnimGraphNode_Slot.h"
#include "EdGraph/EdGraph.h"
#include "EdGraph/EdGraphPin.h"
#include "EdGraphSchema_K2.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "Kismet2/KismetEditorUtilities.h"
#endif

bool UHWEditorAnimTools::InsertOutputSlot(UObject* AnimBlueprint, FName SlotName, FString& OutMessage)
{
#if WITH_EDITOR
    UAnimBlueprint* BP = Cast<UAnimBlueprint>(AnimBlueprint);
    if (!BP) { OutMessage = TEXT("not an AnimBlueprint"); return false; }
    UEdGraph* AnimGraph = nullptr;
    for (UEdGraph* G : BP->FunctionGraphs)
    {
        if (G && G->GetFName() == UEdGraphSchema_K2::GN_AnimGraph) { AnimGraph = G; break; }
    }
    if (!AnimGraph) { OutMessage = TEXT("no AnimGraph"); return false; }
    UAnimGraphNode_Root* Root = nullptr;
    for (UEdGraphNode* N : AnimGraph->Nodes)
    {
        if (UAnimGraphNode_Root* R = Cast<UAnimGraphNode_Root>(N)) { Root = R; break; }
    }
    if (!Root) { OutMessage = TEXT("no output node"); return false; }
    UEdGraphPin* RootIn = nullptr;
    for (UEdGraphPin* P : Root->Pins)
    {
        if (P && P->Direction == EGPD_Input) { RootIn = P; break; }
    }
    if (!RootIn || RootIn->LinkedTo.Num() == 0) { OutMessage = TEXT("output pose not connected"); return false; }
    UEdGraphPin* Source = RootIn->LinkedTo[0];
    if (UAnimGraphNode_Slot* Already = Cast<UAnimGraphNode_Slot>(Source->GetOwningNode()))
    {
        if (Already->Node.SlotName == SlotName) { OutMessage = TEXT("already there"); return true; }
    }

    UAnimGraphNode_Slot* Slot = NewObject<UAnimGraphNode_Slot>(AnimGraph);
    Slot->CreateNewGuid();
    Slot->PostPlacedNewNode();
    Slot->AllocateDefaultPins();
    Slot->Node.SlotName = SlotName;
    Slot->NodePosX = Root->NodePosX - 260;
    Slot->NodePosY = Root->NodePosY;
    AnimGraph->AddNode(Slot, false, false);

    UEdGraphPin* SlotIn = nullptr;
    UEdGraphPin* SlotOut = nullptr;
    for (UEdGraphPin* P : Slot->Pins)
    {
        if (!P || P->PinType.PinCategory != UEdGraphSchema_K2::PC_Struct) continue;
        if (P->Direction == EGPD_Input && !SlotIn) SlotIn = P;
        if (P->Direction == EGPD_Output && !SlotOut) SlotOut = P;
    }
    if (!SlotIn || !SlotOut) { OutMessage = TEXT("slot pins missing"); return false; }
    RootIn->BreakLinkTo(Source);
    Source->MakeLinkTo(SlotIn);
    SlotOut->MakeLinkTo(RootIn);
    FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(BP);
    FKismetEditorUtilities::CompileBlueprint(BP);
    OutMessage = FString::Printf(TEXT("inserted %s; status %d"), *SlotName.ToString(), (int32)BP->Status);
    return BP->Status != BS_Error;
#else
    OutMessage = TEXT("editor only");
    return false;
#endif
}
