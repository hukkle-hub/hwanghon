#include "HHBossIntroTypes.h"

namespace
{
    FHHBossIntroTimingProfile Make(
        float Entry,
        float Silhouette,
        float Reveal,
        float Signature,
        float Handback,
        float Blend = 0.22f)
    {
        FHHBossIntroTimingProfile P;
        P.PlayerEntryHold = Entry;
        P.SilhouetteHold = Silhouette;
        P.ScaleRevealHold = Reveal;
        P.SignatureHold = Signature;
        P.HandbackHold = Handback;
        P.DefaultBlend = Blend;
        return P;
    }
}

FHHBossIntroTimingProfile HHBossIntroProfiles::Resolve(FName BossId)
{
    const FString Id = BossId.ToString();

    // 00. 튜토리얼 허수아비 — 강남 지하 훈련 구역
    if (Id == TEXT("TUTORIAL_SCARECROW"))
        return Make(0.22f,0.34f,0.42f,0.68f,0.24f,0.15f);

    // 01. 클레이브 — 강남역 지하상가 → 침수된 2호선 선로
    if (Id == TEXT("CLAVE_GANGNAM"))
        return Make(0.32f,0.58f,0.70f,1.02f,0.34f,0.21f);

    // 02. 셀레스티얼 — 남산 케이블카 권역
    if (Id == TEXT("CELESTIAL_NAMSAN"))
        return Make(0.38f,0.68f,0.88f,1.10f,0.36f,0.22f);

    // 03. 에이지스-07 — 수도방위사령부 지하
    if (Id == TEXT("AEGIS07_SDC"))
        return Make(0.35f,0.62f,0.82f,1.18f,0.38f,0.22f);

    // 04. 리바이어던 나노 — 한강 침수 터널
    if (Id == TEXT("LEVIATHAN_HANRIVER"))
        return Make(0.42f,0.72f,1.00f,1.24f,0.42f,0.24f);

    // 05. 실험체 09 — 판교 연구 복합체
    if (Id == TEXT("EXPERIMENT09_PANGYO"))
        return Make(0.34f,0.62f,0.74f,1.12f,0.36f,0.21f);

    // 06. 섀도우 팽 — 관악산 폐터널, 단독전
    if (Id == TEXT("SHADOWFANG_GWANAK"))
        return Make(0.34f,0.70f,0.66f,1.04f,0.34f,0.19f);

    // 07. 아스널 오버로드 — 계룡 군사 지하 시설
    if (Id == TEXT("ARSENAL_GYERYONG"))
        return Make(0.40f,0.70f,0.92f,1.26f,0.40f,0.23f);

    // 08. 감염된 박 준장 — 군 지휘 벙커
    if (Id == TEXT("PARK_GYERYONG"))
        return Make(0.30f,0.56f,0.62f,1.04f,0.34f,0.19f);

    // 09. 아이언 워든 — 여의도
    if (Id == TEXT("IRONWARDEN_YEOUIDO"))
        return Make(0.34f,0.60f,0.76f,1.10f,0.36f,0.20f);

    // 10. 감염된 이 중장 — 최종 방어선
    if (Id == TEXT("LEE_FINAL_LINE"))
        return Make(0.42f,0.72f,0.92f,1.28f,0.42f,0.23f);

    // 11. 정 장관 — 고흥 발사 시설·갱도 진입부
    if (Id == TEXT("MINISTERJEONG_GOHEUNG"))
        return Make(0.36f,0.66f,0.78f,1.14f,0.36f,0.21f);

    // 12. 나노-노바 코어 — 고흥 갱도·증폭 탑
    if (Id == TEXT("NANONOVA_GOHEUNG"))
        return Make(0.44f,0.74f,1.02f,1.34f,0.44f,0.24f);

    return FHHBossIntroTimingProfile();
}
