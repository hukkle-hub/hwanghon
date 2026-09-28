#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "HWStoryNpc.generated.h"

// A person of the novel who is in a fight but does not fight with a weapon (EP02-03 오정길, EP14 민경 ...).
// Mannequin stand-in body; the battle's canon rules move it (docs/design/150).
UCLASS()
class HWANGHONCOMBATUE_API AHWStoryNpc : public ACharacter
{
    GENERATED_BODY()

public:
    AHWStoryNpc();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Hwanghon|Story")
    FName NpcId;

    // Walk toward a point (the rules call this every tick while it matters).
    void WalkToward(const FVector& Goal, float AcceptCm = 30.f);
    bool IsNear(const FVector& Goal, float AcceptCm = 40.f) const;
};
