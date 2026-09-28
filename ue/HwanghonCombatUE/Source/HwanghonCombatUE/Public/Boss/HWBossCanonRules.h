#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Combat/HWCombatTypes.h"
#include "HWBossCanonRules.generated.h"

class AHWBossCharacter;
class AHWAinCharacter;

// What a player hit does to a boss that follows its novel (docs/design/138).
enum class EHWCanonHit : uint8
{
    Normal,      // the generic boss rules (posture, phases, reactions)
    DamageOnly,  // health and a flinch only — no posture/phase/break from it
    Swallow      // nothing lands
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHWCanonBeatSignature, FName, Beat);

// A boss's rules taken from the novel, attached to that boss only (the generic training/raid bosses have none).
// The boss asks it for the next pattern, lets it judge every player hit and lets it intercept a beat.
UCLASS(Abstract)
class HWANGHONCOMBATUE_API UHWBossCanonRules : public UActorComponent
{
    GENERATED_BODY()

public:
    // false: no pattern now (stay idle; the rules may be walking the boss).
    virtual bool ChoosePattern(AHWBossCharacter& Boss, FHWBossPatternSpec& Out) { return false; }
    virtual EHWCanonHit FilterPlayerHit(AHWBossCharacter& Boss, float& Damage, EHWAttackTier& Tier, const FVector& Source) { return EHWCanonHit::Normal; }
    // true: the beat is taken by the story (e.g. a rebound) and does not hit.
    virtual bool InterceptBeat(AHWBossCharacter& Boss, const FHWBossBeatSpec& Beat) { return false; }

    // Who is in the fight (the story director spawns them from Content/Data/story_episodes.json).
    virtual void SetupCast(AHWAinCharacter* InAin, const TMap<FName, AActor*>& InCast);

    // QA (-HWQA=storyshow): play the canonical player actions of this fight. Notes are logged, Shots are captured.
    virtual void QAStep(AHWBossCharacter& Boss, AHWAinCharacter& Player, float Dt, TArray<FString>& Notes, TArray<FString>& Shots) {}

    // Novel beats as they happen in play ("deflect", "elbow", "rebound", "sever", "too_far"...).
    // "battle_end" ends a fight the novel does not end with a death (a retreat, a containment).
    UPROPERTY(BlueprintAssignable)
    FHWCanonBeatSignature OnCanonBeat;

protected:
    void Beat(FName Name);
    AActor* Member(FName Id) const { const TWeakObjectPtr<AActor>* A = CastMembers.Find(Id); return A ? A->Get() : nullptr; }
    // Move a companion or NPC toward a point (AI-controlled pawns; no-op otherwise).
    static void Steer(AActor* Who, const FVector& Goal, float AcceptCm = 25.f);
    static void Face(AActor* Who, const FVector& Target);

    TWeakObjectPtr<AHWAinCharacter> CastAin;
    TMap<FName, TWeakObjectPtr<AActor>> CastMembers;
    float Elapsed = 0.f;
};

// EP01 훈련용 짚단 허수아비 (마감본 L461-L566, docs/dungeons/boss_training_heosuabi_DUNGEON_SPEC.md).
//  - 회전: 양팔을 벌리고 어깨가 감기고 허리가 비틀리고 발이 자리 잡은 뒤 숨을 들이켠다 (Tell) → 회전.
//  - 팔꿈치: 품 안에 들어온 상대에게. 너무 붙은 낫이 튕기면 곧바로 돌아온다.
//  - 낫은 원이다: 아인의 공격은 띠 안에서만 든다. 너무 가까우면 튕기고(틱—), 너무 멀면 닿지 않는다.
//  - 되돌림: 회전이 풀리는 순간 카인이 대검을 세워 받아 되돌리면 자세가 무너진다 — 숨 한 번 (Break).
//  - 끊기: 그 숨 한 번 안에, 낫 하나 길이에서 들어간 낫이 이음매를 끊는다. 그것 말고는 쓰러지지 않는다.
UCLASS()
class HWANGHONCOMBATUE_API UHWHeosuabiRules : public UHWBossCanonRules
{
    GENERATED_BODY()

public:
    UHWHeosuabiRules();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
    virtual bool ChoosePattern(AHWBossCharacter& Boss, FHWBossPatternSpec& Out) override;
    virtual EHWCanonHit FilterPlayerHit(AHWBossCharacter& Boss, float& Damage, EHWAttackTier& Tier, const FVector& Source) override;
    virtual bool InterceptBeat(AHWBossCharacter& Boss, const FHWBossBeatSpec& Beat) override;

    void SetCast(AHWAinCharacter* InAin, AHWAinCharacter* InKain) { Ain = InAin; Kain = InKain; }
    virtual void SetupCast(AHWAinCharacter* InAin, const TMap<FName, AActor*>& InCast) override;
    virtual void QAStep(AHWBossCharacter& Boss, AHWAinCharacter& Player, float Dt, TArray<FString>& Notes, TArray<FString>& Shots) override;

    enum class EBand : uint8 { TooClose, Band, TooFar };
    // Centre-to-centre distance, the same the arena rings mark (doc 136: 1.5 m / 2.3 m).
    static EBand Classify(float DistanceCm);
    // Spin from the band and beyond (up to where it still reaches), elbow inside, nothing when far.
    static FName PatternFor(float DistanceCm);
    static FHWBossPatternSpec Spin();
    static FHWBossPatternSpec Elbow();

    static constexpr float TooCloseCm = 150.f;
    static constexpr float BandOuterCm = 240.f;        // ring 230 + the half step the eye allows
    static constexpr float SpinReachCm = 260.f;
    static constexpr float EngageCm = 420.f;           // beyond this the body walks in
    static constexpr float BreathWindowSeconds = 2.0f; // "길어야 숨 한 번"

    // Kain is where the rebound can happen: in front of the boss, between it and Ain.
    bool IsKainInPosition(const AHWBossCharacter& Boss) const;

private:
    void TickKain(AHWBossCharacter& Boss, float DeltaTime);

    TWeakObjectPtr<AHWAinCharacter> Ain;
    TWeakObjectPtr<AHWAinCharacter> Kain;
    bool bElbowAnswer = false;
    bool bInterceptCalled = false;
    int32 QAStage = 0;
    float QATime = 0.f;
    bool bQASpinShot = false;
};
