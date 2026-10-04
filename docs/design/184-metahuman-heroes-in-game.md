# 184 — 아인·세라 메타휴먼을 게임에 (2026-10-04)

디렉터: «아인세라 작업한 것도 적용해줘야지»

메타휴먼 실험 프로젝트(`C:/w/mhlab`, 문서 176–182)에서 만든 아인과 세라를 전투 게임(`ue/HwanghonCombatUE`)에 넣었다.

## 1. 방식: 숨은 전투 몸 + 실시간 리타깃

- 게임의 모든 영웅 동작은 Paragon 백작부인 뼈대에 있다.
  - 대상: 클립, 몽타주, AnimBP(`ABP_Hero_Countess`), 무기 소켓, 반격과 치명 일격 동작(문서 183).
- 이것을 메타휴먼 뼈대로 다시 만들지 않는다.
  - 백작부인 몸은 **보이지 않게 두고 계속 움직이게** 한다(`AlwaysTickPoseAndRefreshBones`).
  - 메타휴먼 몸이 매 프레임 그 자세를 **실시간 리타깃**으로 따라 한다.
- `UHWRetargetAnimInstance`
  - AnimBP 없이 C++ 프록시 하나가 `FAnimNode_RetargetPoseFromMesh` 노드만 돌린다.
  - 원본은 영웅 몸(`CustomSkeletalMeshComponent`), 리타깃은 `RTG_Countess_To_MH`다.
- `UHWHeroMetaHumanComponent`: 영웅 캐릭터에 붙는다. `BeginPlay`에서 `Content/Data/hero_metahumans.json`을 읽고 아래를 한다.
  - 빌드된 `BP_MH_<이름>`을 영웅 몸 자리에 붙인다.
  - 의상 스켈레탈 메시를 메타휴먼 몸에 리더 포즈로 붙인다.
  - 디자인 모양 가닥 머리(그룸)를 얼굴의 `head` 뼈에 붙인다. 붙이는 시점은 얼굴이 기준 자세일 때다. 실험 프로젝트의 `lab_build.py`와 같은 방식이다.
  - 메타휴먼 자체 머리(`Hair`)는 끈다.
- 무기는 숨은 전투 몸의 손 소켓에 그대로 붙어 있다. 리타깃된 메타휴먼 손과 거의 같은 자리에 온다.
- `-HWNoMetaHuman`을 주면 예전 몸으로 돌아간다(비교용).

## 2. 옮긴 것

- `tools/metahuman/export_heroes_to_game.py`(실험 프로젝트에서 실행)
  - 실험 프로젝트는 의상 재질을 맵 안에서 덮어썼다. 그래서 같은 규칙(안감, 부츠, 칼라, 합친 부품 `_001`–`_005`, 천)으로 의상 메시 에셋 자체에 재질을 써 넣는다.
  - 그다음 `BP_MH_Ain/Sera`, 의상 메시, 그룸과 머리 재질을 의존 에셋째 게임 `Content`로 옮긴다(`/Game` 경로 그대로, 메타휴먼 668 MB).
  - 게임 `Content`는 git 밖이다(`Content/Data`만 원본).
- 게임 프로젝트 플러그인: `HairStrands`, `RigLogic`, `IKRig`(`MetaHumanCharacter`는 이미 켜져 있었다). 이름이 `MetaHuman`인 플러그인은 얼굴 촬영용 MetaHuman Animator(PC 전용)라 켜면 안드로이드 빌드가 멈춘다.
- `Scripts/ue_metahuman_retarget.py`
  - `IK_MetaHuman`: 아인 몸 메시에 자동 리타깃 정의를 만든다.
  - `RTG_Countess_To_MH`: 기본 연산, 이름 기준 사슬 짝, 대상 정렬, 골반은 `pelvis`, 루트 모션 끔.
  - 함정 1: 자동 짝짓기가 메타휴먼 **손바닥 뼈(중수골) 사슬**에 백작부인 손가락 사슬을 붙였다. 짝을 비웠다.
  - 함정 2: 리타깃 설정이 IK 리그를 참조하고 있으면 에디터가 지우지 못한다. 있으면 다시 쓴다.

## 3. 확인

- PC(`-HWQA=bossskill -HWQAHero=ain|sera -HWQAHeroCam=1`, 새 근접 카메라)
  - 메타휴먼 아인(검은 웨이브 머리, 긴 코트)과 세라(은발, 코트)가 반격 자세, 낫 들기, 반격 불꽃까지 기존 동작대로 움직인다.
  - 그림: `art/concept/metahuman/game_mh_heroes_r1.jpg`.
- 태블릿: §4.

## 4. 남은 것

- 태블릿: 가닥 머리는 모바일 렌더러에서 안 보일 수 있다. 확인 뒤 카드나 메시 머리로 대신한다.
- 무기 손잡이를 메타휴먼 손에 맞추기(지금은 숨은 몸의 손 기준).
- 표정과 날카로운 눈매(문서 177 남은 것), 천 시뮬레이션.
- 카인과 류는 아직 메타휴먼이 없다.
