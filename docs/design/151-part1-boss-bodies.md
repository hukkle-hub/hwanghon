# 151 — 제1부 보스 몸: 턴어라운드 → Hi3D → 리깅 → 스토리 전투 (2026-09-29)

문서 150 의 34전투는 전부 같은 대역 몸으로 돈다. 이 문서는 원문 보스 9체의 몸을 넣는 길을 만든다.
길은 끝까지 확인했다(§4). 남은 것은 Hi3D 크레딧으로 몸을 뽑는 일뿐이다.

## 1. 입력 — `tools/3d/split_turnaround.py`

디자인 시트(`docs/story/source/design/bosses/turnaround/`)를 정면·옆·뒤로 잘라 1024 정사각(시트 배경색 여백)으로 만든다.
뷰가 붙어 있는 시트는 3등분 근처의 가장 빈 열에서 자른다. 결과 `art/3d/src/part1_views/`.

| 보스 | 나오는 화 | 뷰 | 몸 종류 | 키(원문) |
|---|---|---|---|---|
| 클레이브 | EP02·03·10·11 | 정·옆·뒤 (셔터 포함) | 사람 뼈대 | 2.5 m (L1774) |
| 에이지스-07 | EP06·07 | 정·옆·뒤 (디자인 시트 판에서) | 정적 | 4 m (L7097) |
| 레비아탄 | EP08·09 | 정·옆 | 정적 | TBD_CANON |
| 셀레스티얼 | EP04·17 | 정·옆·뒤 | 정적 | 4 m 활공체 (L11001-L11024) |
| 실험체 09호 | EP14·15 | 정·옆·뒤 | 사람 뼈대 | TBD_CANON |
| 섀도우 팽 | EP16·17 | 정·옆·뒤 | 사람 뼈대 | TBD_CANON |
| 아스널 오버로드 | EP21·22 | 정·옆·뒤 | 정적 | 코어 높이 7 m (L13171-L13189) |
| 발사대 탑 | EP28 | 정·옆·뒤 | 정적 | TBD_CANON |
| 정 장관 | EP26 | 정·옆·뒤 | 사람 뼈대 | TBD_CANON |

- 클레이브 셔터는 몸과 열이 겹쳐 따로 자를 수 없다. 같이 넣고 생성된 메시에서 섬(따로 떨어진 조각)으로 떼어 소품으로 쓴다.
- 클레이브 디자인 시트의 신장 223 cm 는 원문 2.5 m 와 다르다 → 원문을 따른다.

## 2. 리깅 — `tools/3d/rig_boss_template.py` (Blender 5.2)

```
blender -b -P tools/3d/rig_boss_template.py -- <hi3d.glb> <키 m> art/3d/part1/<id>.glb
blender -b -P tools/3d/rig_boss_template.py -- <hi3d.glb> <키 m> art/3d/part1/<id>_static.glb --static
```

- 허수아비 보스(`art/3d/boss_anim.glb`)의 mixamorig 23뼈·클립 18개를 새 몸에 입힌다. 키에 맞춰 뼈대를 균일 확대하고 골반 이동 키도 같은 배율.
- 무게는 뼈 선분까지의 거리로 가장 가까운 두 뼈에 나눈다(1/d⁴). Hi3D 메시는 구멍·겹침이 많아 자동 무게(bone heat)가 자주 실패한다 — 이 방식은 표면 모양과 무관하다.
- 사람 뼈대가 맞지 않는 몸(거미·뱀·날개·포탑·탑)은 `--static` 으로 크기·자리만 맞춘다.
- 확인: `tools/3d/render_boss_poses.py` 가 클립 가운데 프레임을 찍는다.

![템플릿 뼈대를 입힌 예전 Hi3D 몸 — 내려찍기·회전·사망·피격·대기·걷기](../img/151-rig-template-poses.png)

## 3. UE — `Scripts/ue_boss_part1_setup.py`

- `art/3d/part1/*.glb` 를 `/Game/Bosses/Part1/<id>` 로 가져온다. 뼈대가 있으면 `DA_Boss_<id>` 를 만든다
  (`ue_boss_training_setup.build` — 허수아비의 패턴 표를 이 몸의 클립으로. 클립이 바닥에서 뜨는 높이도 다시 잰다).
- `DefaultGame.ini` 에 `boss_<id>` 몸(MeshScale 1, MeshYaw -90)을 등록하고, `story_episodes.json` 전투에 `"body": "boss_<id>"`
  또는 `"body_static": "<정적 메시 경로>"` 를 준다.
- 감독: 보스를 낳은 뒤 `WearBody` / `WearStaticBody`. 몸은 실제 키로 만들어졌으므로 전투 배율(캡슐·사거리)을 몸에서 되돌린다.
  정적 몸은 대역 뼈대를 숨기고 시계(패턴 타이밍)만 쓴다.
- 생성된 에셋은 커밋하지 않는다. 스크립트로 다시 만든다.

## 4. 끝까지 확인 (시험 몸)

예전 Hi3D 보스(`hb_ward`)를 2.5 m 로 리깅 → UE 가져오기 → `DA_Boss_trialward` → EP02 클레이브 전투에 임시로 입혀 storyshow 를 돌렸다:
FINISH ok=1. 핸드오프·걷기·패턴 클립이 새 몸에서 돈다. 시험 설정은 되돌렸다.

![시험 몸으로 돈 EP02](../img/151-body-pipeline-trial.png)

## 5. 크레딧

Hi3D 고품질 멀티뷰 1체 65. 2026-09-29 02:27 UTC 월 갱신 전 잔액 25(이벤트). Higgsfield 0.
갱신 뒤 여러 화에 나오는 순서(클레이브 → 에이지스 → 레비아탄 → 셀레스티얼 → 09호 → 섀도우 팽 → 아스널)로 뽑는다.
