#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HWShelterTouchInput.generated.h"

// The hub on a phone (docs/design/152 §5 - the director plays on Android). Moving is the engine's virtual joysticks;
// the plugin's hub listens to keys (F talk/next, E station, Escape close), so touches become those keys:
//   short tap          -> F    (talk to the NPC in front / next line / open the station in front)
//   press 0.5 s        -> E    (the station of the NPC being talked to)
//   tap the top-right  -> Escape (close)
// Touches the joysticks take never reach here.
UCLASS()
class HWANGHONCOMBATUE_API AHWShelterTouchInput : public AActor
{
    GENERATED_BODY()

public:
    AHWShelterTouchInput();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    UPROPERTY(EditAnywhere, Category="Hwanghon|Shelter") float LongPressSeconds = 0.5f;
    UPROPERTY(EditAnywhere, Category="Hwanghon|Shelter") float TapSlopPx = 30.f;
    // top-right close corner, fraction of the screen
    UPROPERTY(EditAnywhere, Category="Hwanghon|Shelter") FVector2D CloseCorner = FVector2D(0.85f, 0.15f);

    // Last gesture, for QA ("tap", "long", "close").
    FName GetLastGesture() const { return LastGesture; }

private:
    void OnPressed(ETouchIndex::Type Finger, FVector Location);
    void OnReleased(ETouchIndex::Type Finger, FVector Location);
    void Send(const FKey& Key, FName Gesture);

    bool bDown = false;
    bool bLongSent = false;
    float DownTime = 0.f;
    FVector2D DownAt = FVector2D::ZeroVector;
    ETouchIndex::Type DownFinger = ETouchIndex::Touch1;
    FName LastGesture;
};
