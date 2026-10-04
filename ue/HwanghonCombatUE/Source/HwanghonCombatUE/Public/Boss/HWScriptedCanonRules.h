#pragma once

#include "CoreMinimal.h"
#include "Boss/HWBossCanonRules.h"
#include "HWScriptedCanonRules.generated.h"

class FJsonObject;

// One step of a fight as the novel stages it (docs/design/150).
struct FHWCanonStep
{
    FString Id;
    FString Callout;                 // shown when the step begins
    // Companions / NPCs and where they go: front (between boss and Ain), behind (half a step behind Ain),
    // back (behind the boss), side, grab (on the boss's arm), marker:<tag>.
    TArray<TPair<FName, FString>> Moves;
    TMap<FName, float> MoveDist;
    // The opening: "pattern:<Id>" (at that move's strike, if the opener is in place), "ready" (when the opener
    // reaches its spot), "after:<s>". It holds the boss down (Break) for OpenSeconds.
    FString OpenWhen;
    // "pattern:" only: the opening comes on this occurrence of the move (EP26 L14393: the fourth circle).
    int32 OpenOn = 1;
    FName Opener;
    float OpenSeconds = 2.f;
    FName OpenBeat;
    // Inside the opening: this many band hits -> DecisiveBeat, then kill / next / end.
    int32 Needs = 0;
    FName DecisiveBeat;
    FString Then = TEXT("kill");
    // Without a decisive hit: the step moves on by itself (a canon failure, a scripted beat).
    float AdvanceAfter = -1.f;
    FName AdvanceBeat;
    FString AdvanceThen = TEXT("next");
};

// A boss move from the script: the novel's name + the stand-in body clip + reach/timing (design values).
struct FHWCanonMove
{
    FHWBossPatternSpec Spec;
    float MinCm = 0.f;
    float MaxCm = 99999.f;
};

// Generic novel-driven fight (docs/design/150): the whole of Part 1 shares one grammar — someone (Kain, Ryu,
// Sera, an NPC, the place itself) opens a moment; Ain lands the decisive cut from one scythe length inside it.
// Every other hit either glances off (guarded) or cuts without ending anything. Loss battles end by the text's
// own condition (end_after_s / an advance with then=end).
UCLASS()
class HWANGHONCOMBATUE_API UHWScriptedCanonRules : public UHWBossCanonRules
{
    GENERATED_BODY()

public:
    UHWScriptedCanonRules();

    virtual void Configure(const TSharedPtr<FJsonObject>& Script) override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
    virtual bool ChoosePattern(AHWBossCharacter& Boss, FHWBossPatternSpec& Out) override;
    virtual EHWCanonHit FilterPlayerHit(AHWBossCharacter& Boss, float& Damage, EHWAttackTier& Tier, const FVector& Source) override;
    virtual bool InterceptBeat(AHWBossCharacter& Boss, const FHWBossBeatSpec& Beat) override;
    virtual void QAStep(AHWBossCharacter& Boss, AHWAinCharacter& Player, float Dt, TArray<FString>& Notes, TArray<FString>& Shots) override;

    // One "patterns" entry of a fight script (also Content/Data/boss_skills.json, docs/design/181 §8).
    static void ParseMove(const TSharedPtr<FJsonObject>& P, FHWCanonMove& M);

    int32 GetStepIndex() const { return StepIndex; }
    bool IsOpen() const { return OpenRemaining > 0.f; }
    int32 GetStepCount() const { return Steps.Num(); }

private:
    void EnterStep(int32 Index);
    void Open(AHWBossCharacter& Boss, AActor* By);
    void Conclude(const FString& Then, AHWBossCharacter* Boss);
    FVector GoalFor(const FString& Move, AActor* Who, const AHWBossCharacter& Boss, float Dist) const;
    bool OpenerInPlace(const AHWBossCharacter& Boss) const;
    const FHWCanonStep* Step() const { return Steps.IsValidIndex(StepIndex) ? &Steps[StepIndex] : nullptr; }

    TArray<FHWCanonMove> Moves;
    TArray<FHWCanonStep> Steps;
    float BandMin = 150.f;
    float BandMax = 240.f;
    float WalkInCm = 420.f;
    FString Guard = TEXT("deflect");   // what a hit outside an opening does: deflect | cut
    float EndAfter = -1.f;             // a loss battle ends here (seconds) by the text's condition

    int32 StepIndex = -1;
    float StepTime = 0.f;
    float OpenRemaining = 0.f;
    int32 Hits = 0;
    int32 PatternSeen = 0;
    bool bConcluded = false;
    bool bAfterFired = false;
    bool bForcingKill = false;   // the text's own kill (advance_then) is not a player hit

    // QA
    int32 QAPhase = 0;
    float QATime = 0.f;
    float QALastAttack = 0.f;
    int32 QAStepSeen = -1;
};
