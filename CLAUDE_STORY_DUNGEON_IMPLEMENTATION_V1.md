# Claude Code 전달용 — 황혼 Story Dungeon Implementation v1

## 최상위 원칙

황혼의 소설 전체가 게임과 애니메이션의 Source of Truth다.
던전은 일반 MMORPG 던전이 아니다.

- 소설의 장소/사건/감정선/보스 등장 이유를 그대로 구현한다.
- 황혼 본편 던전에서는 잡몹 방을 기본 진행으로 만들지 않는다.
- 기본 구조는 `Story -> Boss Entry -> Boss Arena -> Boss Battle -> Boss Result -> Story`.
- 소설에 없는 전투/퍼즐/길찾기 구간을 임의로 추가하지 않는다.
- 시스템이 소설을 요구하면 소설을 바꾸는 것이 아니라 시스템을 바꾼다.
- Game/Animation은 같은 정사 Scene, Environment, Character, Animation, VFX를 공유한다.

## 1. 먼저 소설 원문 확보

저장소/Project에서 황혼 소설 원문 전체를 찾는다.
예: `황혼_1부_소설판`, 에피소드별 txt/md/doc, 마감본.

찾지 못한 화는 임의 생성 금지. `TBD_CANON`으로 보고한다.

먼저 생성:
- `docs/story/HWANGHON_NOVEL_TO_GAME_MASTER.md`
- `Content/Data/novel_game_master.json`
- 전체 Episode Index
- 전체 Scene Index
- 전체 Location Index
- 전체 Boss Index
- 전체 Environment/Animation Asset Requirements

Scene ID 규칙:
`EP01_SC001`, `EP01_SC002` ...

## 2. Scene -> Game/Animation 번역

각 Scene 필드:
- EpisodeId / SceneId / NovelSource / NovelSummary
- Location / TimeOfDay / Characters / Equipment / Costume
- StoryBeat / PlayerGoal / Interaction
- GameMode
- BossId / BossPhase
- EnvironmentState / Props / VFX / SFX / Music
- GameplayEntry / GameplayExit
- CinematicRequired / AnimationRequired
- SaveFlags / Prerequisites / NextScene
- RequiredAssets / CanonStatus

GameMode:
- STORY_CINEMATIC
- STORY_WALK
- STORY_DIALOGUE
- INVESTIGATION
- TRANSITION
- BOSS_ENTRY
- BOSS_BATTLE
- BOSS_RESULT
- FLASHBACK

## 3. 보스 던전 정의

본편 보스 던전은 보스 한 마리를 위한 고밀도 스테이지다.

금지 기본형:
`Combat Room -> Elite Room -> Objective Room -> Boss`

기본형:
`Story -> Boss Entry -> Boss Arena -> Boss Battle -> Boss Result -> Story`

기믹은 던전 진행용 filler가 아니라 보스전/소설 사건을 강화하는 용도로만 사용.

예:
- 전력 차단
- 구조물 붕괴
- 오염 확산
- 특정 부위 파괴
- 엄폐/안전지대
- 장치 활성화
- 조명/환경 변화

## 4. 무료 샘플/에셋 활용

샘플 자체를 복사하는 것이 아니라 부품/기법 창고로 사용.

우선 조사/설치:
1. Derelict Corridor Megascans Sample
2. Dark Ruins Megascans Sample
3. Electric Dreams Environment
4. Valley of the Ancient
5. Content Examples

사용법:
- Derelict Corridor: 벙커/폐쇄시설/병원/연구시설/지하복도 베이스
- Dark Ruins: 큰 보스 아레나, 붕괴 구조, 극적 조명 참고
- Electric Dreams: PCG set dressing, Soundscape, puddle/fluid, procedural clutter
- Valley of the Ancient: 보스 중심 흐름, Data Layers, Chaos, Control Rig, Motion Warping
- Content Examples: Chaos/Niagara/Control Rig/Blueprint 기능 샘플

한국/황혼 고유 요소는 직접 제작:
- 한글 경고문/표지판
- 기관 로고
- 한국형 전기함/소화전/안내판
- 병원/시설 표기
- CCTV/비상벨/방호문

## 5. Arena Data Layer 규칙

보스 맵 하나를 여러 Phase 상태로 재사용.

권장:
- `DL_Arena_Base`
- `DL_Story_PreBattle`
- `DL_Phase1`
- `DL_Phase2_Damaged`
- `DL_Phase3_Critical`
- `DL_Aftermath`
- `DL_Cinematic`

Data Layers는 소설에서 실제로 변하는 환경만 바꾼다.
장식용 변화 남발 금지.

## 6. Chaos 규칙

실시간 파괴를 남발하지 않는다.

사용:
- Phase 전환 시 특정 벽/기둥/천장 붕괴
- 보스 패턴에 반응하는 핵심 구조물
- 소설에서 실제 파괴되는 오브젝트

모바일/성능 고려:
- 큰 파괴는 Chaos Cache/Sequencer 재생 우선
- 작은 파편만 실시간
- Geometry Collection 수 제한

## 7. PCG 규칙

PCG는 전투 레이아웃을 결정하지 않는다.

PCG 사용:
- rubble
- trash
- cables 주변 clutter
- vegetation
- 작은 debris

수동 배치:
- Player spawn
- Boss spawn
- Charge lane
- Dodge space
- Camera readability
- Safe zone
- Break/Part target position
- Phase destruction
- Cinematic staging

## 8. Sequencer / 애니메이션 공유

같은 Scene에서:
- Gameplay Version
- Cinematic Version

공유:
- Environment
- Character/Rig
- Animation
- VFX
- Audio
- Props

필수 Sequence:
- BossEntry
- PhaseTransition(s)
- BossDeath
- PostBattle

Game과 Animation을 별도 세트로 처음부터 다시 만들지 않는다.

## 9. Dungeon Spec

각 보스:
`docs/dungeons/<BossId>_DUNGEON_SPEC.md`

필드:
- EpisodeId / SceneRange / NovelReasonForBattle
- ArenaLocation
- ArenaBeforeBattle / P1 / P2 / P3 / AfterBattle
- PhasePatterns
- BreakRules / CounterRules / PartBreakRules
- StoryMechanics / EnvironmentalMechanics
- Entry / Transition / Death cinematic
- PostBattleScene
- Required assets / animations / VFX / audio
- RequiredStoryFlags

## 10. 첫 구현 순서

소설 순서 기준.

1. 전체 Novel Scene Index
2. Boss Index
3. Location Index
4. Asset Requirement Index
5. EP01 Game+Animation Plan
6. EP01에서 첫 보스 Scene 식별
7. 첫 보스 Arena Graybox
8. 소설 Canon QA
9. 무료 샘플/에셋 매핑
10. Phase Data Layers
11. Entry/Transition/Death Sequencer
12. 최종 Environment polish

EP01이 완성되기 전에 후반부 보스를 예쁘게 만드는 작업은 금지.

## 11. 자동 감사 도구

패키지의:
- `dungeon_research_sources.json`
- `setup_story_dungeon_workspace.py`
- `dungeon_asset_audit.py`

을 사용해 설치된 샘플/에셋을 스캔하고 후보를 보고한다.

자동 매칭은 최종 선택이 아니다.
소설 원문과 한국 배경 적합성을 사람이 확인한다.

## 12. 완료 보고

- 소설 파일 목록
- Episode / Scene / Location / Boss 수
- EP01 Plan 생성 여부
- 첫 Boss Scene
- 선택한 무료 Sample/Asset source
- Arena Graybox screenshot/capture
- Data Layer 구성
- Sequencer 구성
- Chaos 사용처
- PCG 사용처
- Canon 불명확 항목
- 남은 blocker

UI polish는 하지 않는다.
