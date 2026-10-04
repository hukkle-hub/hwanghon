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

## 5. 태블릿 머리

- 첫 태블릿 빌드에서 메타휴먼 아인은 의상까지 나왔지만 **대머리**였다(`art/concept/metahuman/tablet_mh_r1.jpg`).
  - 안드로이드는 가닥 머리를 그리지 않는다(`r.HairStrands.Strands 0`).
  - 실험 프로젝트의 태블릿 측정(문서 177 §5) 때는 메타휴먼 기본 머리(카드)여서 보였다.
- `tools/metahuman/groom_to_mesh.py`
  - 그룸과 **같은 가닥**(Alembic)에서 3,000가닥을 골라 얇은 띠로 만든다.
  - 띠 폭은 뿌리 7 mm에서 끝 20 %까지 줄고, 가닥 방향과 머리 중심에서 바깥 방향에 수직으로 눕는다.
  - 삼각형 수: 아인 16,500, 세라 97,300(긴 머리).
- `Scripts/ue_hair_mobile.py`: `/Game/HairMobile/<Name>`로 가져오고 양면 머리색 재질(아인 검정, 세라 은색)을 입힌다.
  - 그룸과 같은 자리에 오는지 범위로 확인했다(중심 차이 약 2 cm).
- `hero_metahumans.json` `hair_mobile`: 안드로이드와 iOS에서는 이 메시를 그룸 대신 머리 뼈에 붙인다.
  - PC에서 미리 보기: `-HWMobileHair`. 휴대폰에서 가닥을 시험하려면 `-HWStrandHair`.
- PC 미리 보기: `art/concept/metahuman/mobile_hair_pc_preview.jpg`.

## 6. 무기, 영웅 고르기, 프레임 기록

- 무기
  - 처음에는 숨은 전투 몸의 손 소켓에 붙어 있었다. 몸이 더 커서 손잡이가 메타휴먼 손에서 떨어져 보였다.
  - 지금은 입힌 지 3프레임 뒤(두 몸이 같은 자세일 때) 메타휴먼의 같은 쪽 `hand_r`/`hand_l`로 옮긴다. 방향과 손에서 떨어진 거리는 그대로 둔다.
  - 메타휴먼을 벗기면 원래 손으로 돌아간다.
  - 결과: `art/concept/metahuman/game_mh_grip.jpg`.
- 첫 화면(L_Loading)에 **영웅 고르기 줄**(아인, 세라, 카인, 류)을 더했다. 저장된 선택이 바뀌고 보스전 시험과 이야기에 그 영웅이 나온다. 태블릿에서 바로 바꿔 볼 수 있다.
- `UHWPerfLogSubsystem`(배포 빌드 제외)
  - 5초마다 로그에 남긴다: `[HWPerf] 맵 fps frame(worst) game render gpu`.
  - 태블릿은 실행 옵션을 못 받으므로(Android 16) 게임 안에 넣었다. `adb logcat -s UE`에서 HWPerf를 찾는다.
- PC: 메타휴먼 아인 + 섀도우 팽 112 fps(8.9 ms, GPU 3.2 ms).
- 태블릿(Galaxy Tab S11 Ultra, 세라 + 섀도우 팽 던전, `HWPerf`): **60 fps 고정, GPU 15.1 ms**, 게임 스레드 3–8 ms, 렌더 스레드 2–5 ms.
  - 한도 16.7 ms에 여유가 1.5 ms뿐이다. 실험 프로젝트에서 잰 4인 파티 9.4 ms보다 무겁다(보스, 이펙트, 세라 리본 머리 97k 삼각형).
  - 줄일 후보: 세라 리본 수 절반, 휴대폰에서 메타휴먼 LOD 한 단계 낮추기.
- 전투 화면 왼쪽 위 영웅 이름이 늘 «아인»이었다. 실제로 하는 영웅 이름이 나오게 고쳤다.
- 태블릿 화면: `art/concept/metahuman/tablet_sera.jpg`(첫 화면에서 세라 선택 → 보스 던전의 메타휴먼 세라).

## 7. 태블릿 GPU: 의상 50만 삼각형

- 같은 섀도우 팽 던전에서 비교했다(`HWPerf`, 60 fps 고정).
  - 카인(메타휴먼 없음): GPU 10 ms.
  - 아인·세라: 15 ms.
- 먼저 시도한 두 가지는 효과가 없었다.
  - 세라 리본을 1,500가닥으로 줄여도 15.1에서 14.8 ms였다. 머리만 듬성해져 3,000가닥으로 되돌렸다.
  - 휴대폰 `LODSync MinLOD 1`도 변화가 없었다.
- `LogRenderCost`: 입힌 지 120프레임 뒤 메타휴먼 부품마다 그려지는 단계, 삼각형, 구획을 로그에 남긴다.
  - 태블릿 값: 몸 LOD1 15k, 얼굴 LOD1 6.9k, 리본 머리 16.5k, **의상 LOD0 506k(단계 하나뿐)**.
  - 실험실에서 가져온 의상에 축소 단계가 없었다.
- `Scripts/ue_outfit_lods.py`
  - `LODS_HeroOutfit`(100 / 12 / 6 / 3 %)를 붙이고, 엔진 축소로 LOD1–3을 만든다.
  - 의상은 리더 포즈라 몸의 단계를 따르고, 휴대폰은 LOD1(60.7k)부터 그린다.
  - PC에서도 영웅 카메라 거리에서는 LOD1이다.
  - 비교 화면 `art/concept/metahuman/outfit_lod_compare.jpg`: 망토 주름, 팔토시, 벨트가 그대로다.
- `-HWMobileHair`는 이제 PC에서 휴대폰 모습 전체(리본 머리 + 최소 LOD1)를 미리 보여 준다.
- 결과(태블릿): 아인 GPU **8.5 ms**, 세라 **9–12 ms**. 메타휴먼이 없는 카인보다 같거나 가볍다.
  - 화면: `art/concept/metahuman/tablet_outfit_lod1.jpg`.
- 남은 것: 세라 리본 머리(97k)의 밝기와 뭉침. 재질 문제다.
