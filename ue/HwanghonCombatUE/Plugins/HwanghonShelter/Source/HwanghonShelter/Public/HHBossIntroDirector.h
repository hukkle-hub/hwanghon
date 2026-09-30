#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HHBossIntroTypes.h"
#include "HHBossIntroDirector.generated.h"

class AHHBossIntroAnchor;
class APlayerController;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHHBossIntroStarted, FName, BossId, bool, bShortVersion);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHHBossIntroFinished, FName, BossId);

UCLASS(BlueprintType)
class HWANGHONSHELTER_API AHHBossIntroDirector : public AActor
{
    GENERATED_BODY()

public:
    AHHBossIntroDirector();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|BossIntro")
    FName BossId = TEXT("TUTORIAL_SCARECROW");

    // Assign the actual boss actor/BP in the level.
    UPROPERTY(EditInstanceOnly, BlueprintReadWrite, Replicated, Category="Hwanghon|BossIntro")
    TObjectPtr<AActor> BossActor;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|BossIntro")
    bool bHideHUDDuringIntro = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|BossIntro")
    bool bLockPlayerInput = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|BossIntro")
    float ReturnToPlayerBlend = 0.18f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|BossIntro")
    bool bAutoDiscoverAnchors = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Hwanghon|BossIntro")
    TArray<TObjectPtr<AHHBossIntroAnchor>> ExplicitAnchors;

    UPROPERTY(BlueprintAssignable, Category="Hwanghon|BossIntro")
    FHHBossIntroStarted OnIntroStarted;

    UPROPERTY(BlueprintAssignable, Category="Hwanghon|BossIntro")
    FHHBossIntroFinished OnIntroFinished;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|BossIntro")
    bool bIntroPlaying = false;

    UPROPERTY(BlueprintReadOnly, Category="Hwanghon|BossIntro")
    EHHBossIntroBeat CurrentBeat = EHHBossIntroBeat::PlayerEntry;

    UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category="Hwanghon|BossIntro")
    void StartBossIntro(bool bShortVersion = false);

    UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category="Hwanghon|BossIntro")
    void ForceFinishBossIntro();

    UFUNCTION(BlueprintPure, Category="Hwanghon|BossIntro")
    FHHBossIntroTimingProfile GetResolvedTimingProfile() const;

    // Hwanghon (docs/design/162): seconds left in the current beat (QA shoots each beat's last frame).
    float GetBeatRemaining() const { return bIntroPlaying ? BeatHold - BeatElapsed : 0.f; }

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

protected:
    UFUNCTION(NetMulticast, Reliable)
    void MulticastStartBossIntro(FName InBossId, bool bShortVersion);

    UFUNCTION(NetMulticast, Reliable)
    void MulticastForceFinishBossIntro(FName InBossId);

private:
    TArray<TWeakObjectPtr<AHHBossIntroAnchor>> LocalSequence;
    FHHBossIntroTimingProfile LocalProfile;
    bool bLocalShortVersion = false;

    int32 CurrentIndex = INDEX_NONE;
    float BeatElapsed = 0.f;
    float BeatHold = 0.f;

    TWeakObjectPtr<APlayerController> LocalPlayerController;
    bool bSavedShowHUD = true;

    void DiscoverLocalAnchors();
    void BeginLocalIntro(FName InBossId, bool bShortVersion);
    void EnterBeat(int32 Index);
    void AdvanceBeat();
    void FinishLocalIntro();

    float ResolveBeatHold(const AHHBossIntroAnchor* Anchor) const;
    float ResolveBlendTime(const AHHBossIntroAnchor* Anchor) const;

    void SetLocalCinematicState(bool bEnabled);
    void DispatchBossBegin();
    void DispatchBossBeat(EHHBossIntroBeat Beat);
    void DispatchBossEnd();
};
