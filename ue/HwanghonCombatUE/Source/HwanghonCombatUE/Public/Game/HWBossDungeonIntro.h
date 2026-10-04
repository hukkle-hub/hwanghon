#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HWBossDungeonIntro.generated.h"

class ACameraActor;
class AHWBossCharacter;

/**
 * The boss entrance of a boss dungeon (docs/design/181 §13; docs/dungeons/<id>_DUNGEON_SPEC.md: Story -> Boss Entry ->
 * Arena). The story fights' intro director flies placed camera anchors; the dungeon arena is built in code, so this
 * one frames from the two bodies:
 *   0.0-1.3 s  over the player's shoulder, the boss far in the middle of the frame
 *   1.3-2.9 s  low and close on the boss, a slow push in; its name and place on the screen
 *   2.9-4.0 s  the roar (its clip when the body has one): shake, chest burst
 *   then the player's camera back (0.4 s) and the fight
 * The boss is held and the player's hands are off for its length. A retry gets the name only.
 */
UCLASS(NotPlaceable)
class HWANGHONCOMBATUE_API AHWBossDungeonIntro : public AActor
{
    GENERATED_BODY()

public:
    AHWBossDungeonIntro();

    static AHWBossDungeonIntro* Play(AHWBossCharacter* Boss, const FText& Name, const FText& Place, bool bShort);

    virtual void Tick(float DeltaSeconds) override;

    bool IsPlaying() const { return bPlaying; }

private:
    void Begin(bool bShort);
    void Finish();
    void Frame(float T);

    UPROPERTY(Transient)
    TObjectPtr<AHWBossCharacter> Boss;

    UPROPERTY(Transient)
    TObjectPtr<ACameraActor> Camera;

    FText Name;
    FText Place;
    float Elapsed = 0.f;
    bool bPlaying = false;
    bool bNameShown = false;
    bool bRoared = false;

    static constexpr float WideEnd = 1.3f;
    static constexpr float CloseEnd = 2.9f;
    static constexpr float RoarEnd = 4.0f;
};
