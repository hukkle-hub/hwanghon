# 124 — UE 로 «영화 같은» 전투 애니메이션: 자료 조사와 시험 계획 (2026-09-27)

디렉터: «유튜브 보니 이걸로 애니메이션을 영화처럼 만들던데, 자료 수집해서 한번 해 보자.»

문서 122 의 결론은 «원본 동작부터 바꾼다» 였다. 이 문서는 UE 쪽에서 그 원본과 연출을 어디서 얻고 어떻게 시험할지 정리한다.

## 1. 쓸 수 있는 자료

| 자료 | 내용 | 라이선스 | 황혼에서 |
|---|---|---|---|
| [Game Animation Sample Project](https://www.unrealengine.com/blog/game-animation-sample) ([Fab](https://www.fab.com/listings/880e319a-a59e-4ed2-b268-b32dac7fa016), [5.8 갱신](https://www.unrealengine.com/tech-blog/download-the-latest-game-animation-sample-project-now-updated-for-ue-5-8)) | AAA 모캡 500+(이동·정지·회전·점프·착지), Motion Matching 완성 예제, UE5 Manny 골격 | **UE 전용**, 상업 사용 가능 | 네 캐릭터 **이동·회피·대기** 원본. 달리기 미끄러짐·출발/정지 문제를 한 번에 푼다. |
| [Paragon: Kwang](https://www.fab.com/listings/f4c67e92-b976-4b5b-ab9f-4c25b010f6f3) · [Greystone](https://www.unrealengine.com/marketplace/en-US/product/paragon-greystone) 등 19 명 ([공지](https://www.awn.com/news/epic-games-releases-final-set-free-paragon-hero-assets)) | 영웅별 공격·스킬·피격·사망 애니 + AnimBP + FX | **UE 전용**, 무료. «PARAGON» 상표만 금지 | Kwang(대검) → **카인**, Greystone(대검) → 카인 대안 |
| [Paragon 애니 → Manny 리타깃본](https://www.fab.com/listings/e6de87b1-b755-478d-9228-a9eb89ff4411?lang=en), [커뮤니티 5500+ 리타깃 묶음](https://dev.epicgames.com/community/learning/tutorials/qB07/unreal-engine-5500-free-retargeted-animations-for-ue5-paragon-infinity-blade-effects-2gb-pack) | Paragon 전 영웅 애니를 UE5 골격으로 옮겨 둔 것 | Paragon 조건 따름 | 리타깃 수고를 던다. 아인(낫)·류(쌍검)·세라(마법)는 여기서 가장 가까운 무기군을 고른다. |
| 영상 → 모캡 AI ([비교 1](https://uthana.com/resources/best-ai-motion-capture-tools), [비교 2](https://tato.studio/blog/best-ai-video-to-mocap)): DeepMotion, QuickMagic, Rokoko Vision(무료 등급), Move One | 휴대폰 영상 한 대로 FBX/BVH. DeepMotion 은 UE5 Manny 로 바로 뽑는다. | 도구별 약관 (유료 등급 다수) | **낫처럼 맞는 원본이 없는 동작**: 사람이 막대로 휘두르는 영상을 찍어 떠낸다. |
| Sequencer + Control Rig ([입문](https://www.strayspark.studio/blog/ue5-sequencer-tutorial-beginners-2026), [Control Rig 강좌](https://www.udemy.com/course/unreal-engine-control-rig-for-cinematics-and-game-animation/)) | 카메라·조명·키프레임 연출, 에디터 안에서 뼈를 잡고 다듬기 | UE 내장 | 보스 등장·처형 컷신, 원본 동작의 손·무기 각도 수정 |

**웹(three.js) 쪽 주의:** Game Animation Sample·Paragon 은 UE 전용 라이선스다. 웹 게임 GLB 로 옮겨 쓰면 안 된다. 웹은 Mixamo 나 자체 모캡을 쓴다(문서 122 §4).

## 2. 시험 — «20 초 컷» 하나로 품질을 판단한다

**목표:** 카인이 d01 허수아비와 싸우는 20 초. 게임 속 전투 1 회 + 보스 등장 컷신 1 개. 문서 119 의 20~30 초 전투 캡처와 같은 틀이다.

1. **준비(PC, UE 5.5)**
   - Fab 에서 Game Animation Sample, Paragon: Kwang 을 받아 `HwanghonCombatUE` 에 추가한다.
2. **몸**
   - 카인 GLB(`art/3d/kain_anim.glb`)를 FBX 로 옮긴다.
   - IK Retargeter 로 Manny ↔ 카인 골격을 잇는다.
   - 문서 121 §6 의 어깨 깊이 문제는 여기서 **리타깃 체인 오프셋**으로 먼저 본다.
3. **기본 동작**
   - 이동·대기·회피는 Game Animation Sample(Motion Matching)을 쓴다.
   - 평1~3·스매시·카운터는 Kwang 을 쓴다.
   - 몽타주마다 접점 노티파이를 단다. 판정 시각 0.24 / 0.48 s 는 `combat_rules.json` 을 따른다.
4. **연출**
   - Sequencer 로 보스 등장 6~8 초를 만든다: 카메라 2~3 컷, 사슬이 풀리며 포효.
   - 처형 한 컷을 만든다.
5. **판정**
   - 같은 20 초를 웹 버전과 나란히 놓는다.
   - 기준은 문서 122 의 결함 목록이다(팔 사라짐·검 들기·세라 비공격 동작).
   - 이미지·영상으로 디렉터가 본다.

**통과하면:** 아인·류·세라로 넓힌다. 낫처럼 맞는 원본이 없으면 영상 → 모캡으로 만든다.

**통과 못 하면:** 원인이 원본 동작인지, 몸(리깅)인지, 연출인지 가른다.

## 3. 누가 무엇을

- **PC 세션(UE 에디터):** §2 의 1~5. 에디터를 보며 만지는 작업이라 클라우드 세션은 못 한다.
- **클라우드 세션:**
  - 판정 시각·규칙 데이터 대조(`tools/ue/check-ue-tuning.mjs`)
  - 웹 버전 쪽 비교 영상(`tools/fight-overlap.mjs`)
  - 문서
