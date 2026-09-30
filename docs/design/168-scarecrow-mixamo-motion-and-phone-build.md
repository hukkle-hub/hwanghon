# 168 — 허수아비 동작을 Mixamo로 교체하고 태블릿 빌드를 만들다 (2026-10-01)

디렉터: «업데이트가 안되서 모바일로는 확인이 안되네. 로그인은 직접해서 진행하고 나머지도 진행해»

## 1. 태블릿 빌드 (UE 판)

- 태블릿(Galaxy Tab S11 Ultra, USB)에는 웹판 앱(`com.hwanghon.twilight`)만 있었고, UE판은 한 번도 설치된 적이 없었다.
- `Scripts/package_android_phone.ps1 -Install`로 APK 120 MB와 OBB 1.08 GB를 만들었다. 쿡까지 45분 걸렸다.
  - 스크립트는 APK만 설치한다. OBB는 `adb push`로 `/sdcard/Android/obb/com.YourCompany.HwanghonCombatUE/`에 넣는다.
  - Git Bash에서는 `/sdcard/...` 경로가 `C:/Program Files/Git/...`로 바뀐다. PowerShell에서 실행한다.
- 안드로이드 clang은 PC보다 엄격하다. 이번에 고친 것:
  - `for (TActorIterator…) { X = *It; break; }` 형태는 `-Wunreachable-code-loop-increment` 오류가 난다 → `if (TActorIterator<T> It(W); It)`로 바꿨다(6곳).
  - `RerunConstructionScripts`는 에디터 전용이다 → `OnConstruction(GetActorTransform())`
  - `HWStoryDirector.h`에 `AStaticMeshActor` 전방 선언이 빠져 있었다.
- 코드가 경로로 불러오는 에셋은 `DefaultGame.ini`의 `DirectoriesToAlwaysCook`에 넣었다.
  - 이펙트: Paragon Grux 폴더 5개, `/Game/Hwanghon/VFX`
  - Mixamo 클립
- 확인: 태블릿에서 앱 실행 → 스토리 모드 → 소설 카드 → EP01 전투까지 들어간다. 예고 발광과 회전 잔불도 태블릿 화면에 나온다(adb screencap).
- 남은 것: 메뉴 화면에도 가상 조이스틱이 보인다.

## 2. Mixamo 로그인과 다운로드

- 크롬에 이미 로그인된 디렉터 구글 계정으로 Adobe에 로그인했다. 비밀번호는 입력하지 않았다.
- 사이트 자체 API(`/api/v1/products`, `/animations/export`, `/characters/{id}/monitor`)로 X Bot 기준 FBX를 뽑았다(스킨 없음, 30 fps).
- 크롬은 한 탭에서 스크립트가 시작한 다운로드를 **첫 번째만** 허용한다. 그래서 동작마다 새 탭을 썼다.
  - 백그라운드 탭은 타이머가 늦어진다. 받는 데 한 개에 1분 남짓 걸렸다.
- 받은 13개(`art/anim/mixamo_scarecrow`)
  - 거구: Mutant Breathing Idle / Walking / Roaring / Swiping / Punch
  - 공격: Standing Melee Attack 360 High
  - 쓰러짐: Knocked Down, Getting Up, Stunned
  - 부상: Injured Walk, Injured Idle
  - 반응: Shoved Reaction With Spin, Standing React Large From Front
- X Bot 몸은 `_XBot_TPose_skin.fbx`로 따로 받았다.

## 3. 허수아비로 리타깃 — 네 번 틀린 것

`Scripts/ue_import_mixamo_scarecrow.py`는 두 번에 나눠 실행한다: `HW_STEP=mesh`, 그다음 `HW_STEP=clips`.

1. **UE 5.8은 FBX를 Interchange로 가져온다.** Interchange는 `FbxImportUI`를 무시해서 «임포트할 항목이 없다»고만 한다.
   - 해결: `Interchange.FeatureFlags.Import.FBX False`
2. **뼈 이름**: FBX는 `mixamorig:Hips`, 허수아비는 `mixamorig_Hips`다.
   - 같은 길이라서 바이너리에서 `:`를 `_`로 바꿨다.
3. **이름이 같아도 뼈대가 다르다.**
   - 허수아비 뼈는 +Z 방향, X Bot 뼈는 −Y 방향으로 뻗는다. 길이도 다르다(골반 155 cm 대 104 cm).
   - 그대로 입히면 몸이 1.8 m로 줄고 관절이 꼬인다 → IK 리타깃(X Bot IK 리그 자동 생성 → 기존 `IK_TrainingBoss`)을 쓴다.
4. **리타깃 결과가 전부 기준 자세였다.**
   - X Bot 몸과 클립을 한 세션에서 가져오면 클립이 뼈대 없이 저장된다 → 세션을 둘로 나눴다.
   - UE 5.8 리타깃터는 연산(op) 스택이 비어 있으면 체인 매핑도 비어 있다 → `add_default_ops()`를 부르고, 같은 이름의 체인 11개를 직접 매핑했다(퍼지 자동 매핑은 전부 None이었다).
   - «Run IK Rig» 연산은 끄고 FK만 쓴다.
   - 골반 비율(1.486)을 강제로 넣었더니 발끝이 골반 높이까지 올라갔다 → 되돌렸다.

측정: `ue_boss_clip_bones.py` + `clip_bone_sheet.py`, 61 샘플.

| 동작 | 머리 높이 | 판정 |
|---|---|---|
| 걷기 | 245 cm | 예전 대기 244 cm와 같다 |
| 대기 | 220 cm | 돌연변이식 구부정한 자세 |
| 넉다운 | — | 바닥에 평평하게 눕는다. 예전 down은 60 cm 뜬 판자에 팔을 쳐들었다 |

- 누운 몸의 골반은 바닥 아래 30 cm까지 내려간다. 원인은 X Bot 골반의 기준점이다.
  - `GroundBody`의 누운 자세 보정이 전에는 내리기만 했다. 이제 올리기도 한다(최저 뼈를 바닥 + 12 cm에 맞춤).

## 4. 허수아비 전용 세트

- `DA_Boss_Scarecrow`(`Scripts/ue_boss_scarecrow_set.py`)는 `DA_Boss_Training`을 복제해서 만든다. 다른 보스의 기본 세트는 그대로 둔다.
  - 대기: Mutant Breathing Idle / 걷기: Mutant Walking
  - 회전(Spin): 360 High. 타격 시점 0.33 / 0.52 / 0.60은 손이 골반 앞으로 가장 멀리 나간 순간을 잰 값이다.
  - 팔꿈치: Mutant Punch 0.27
  - 붕괴(카인 되받아치기): Knocked Down. 큰 피격·경직: React Large
- 연결: `DefaultGame.ini`의 `boss_scarecrow` 비주얼 → `story_episodes.json` EP01 전투 `"body": "boss_scarecrow"`
- EP01 스토리 QA `ok=1`. 캡처:
  - 대기는 구부정한 거구다.
  - 회전 예고에서 몸을 비틀어 감고, 팔꿈치는 펀치로 나간다.
  - 되받아치기에 뒤로 넘어지고, 절단 때는 매트 위에 누워 있다.

## 5. 다음

- 부상 걷기·대기를 부위파괴(다리)와 연결한다. 세트에 필드를 추가하고 presentation에서 전환한다.
- 각성 포효(Mutant Roaring)를 등장 비트에 넣는다.
- 360 High의 앞부분(도약 준비)이 3 m 몸에 가볍게 보이는지 태블릿으로 판정받는다.
- 그 뒤 4인 캐릭터 스킬로 넘어간다(디렉터 순서).
