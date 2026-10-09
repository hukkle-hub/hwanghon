# 황혼 MMORPG — Claude 방향 수정 및 Monster System 구현 지시 v0.9

## 0. 가장 중요한 방향 수정

황혼은 **대한민국 전체를 실제 세계 기반으로 재구성한 3D 액션 MMORPG**다.

남산 거점 방어와 웨이브는 MMORPG 안의 **다이내믹 월드/길드 콘텐츠 중 하나**일 뿐이다.
게임 전체를 디펜스 또는 거점전 중심으로 설계하지 않는다.

잘못된 의존:
`Monster -> Wave -> Node Defense`

올바른 의존:
`Monster Catalog -> Open World / Dungeon / Party / Raid / Guild Mission / Node Invasion / Recapture / Dynamic Event / Story`

따라서:
- WaveDirector가 Monster System의 부모가 되어서는 안 된다.
- Node 전용 행동을 Monster Base에 하드코딩하지 않는다.
- `Grade`와 `CombatRole`을 분리한다.
- 동일 MonsterId가 필드/던전/길드/거점 이벤트에서 재사용 가능해야 한다.

## 1. 감염체 등급 캐논

총 63종:
- 5급 20종
- 4급 15종
- 3급 10종
- 2급 10종
- 1급 5종
- 특급 3종

등급 상승은 HP 스펀지화가 아니라:
1. 판단력
2. 전술 역할
3. 협력
4. 카운터/회피 이해
5. 플레이어 행동 적응
6. 지역/군집 영향력
순으로 상승한다.

등급이 높을수록 오히려 더 인간적이고 정돈되고 아름답고 위험해지는 방향을 유지한다.

금지:
- 썩은 좀비
- 무조건 거대화
- 과도한 촉수/골격 괴수
- 같은 얼굴 반복
- 상위 등급 = 단순 HP 증가

## 2. MMORPG SpawnContext

공통 SpawnContext:
- OpenWorld
- OpenWorldRare
- Dungeon
- PartyDungeon
- Raid
- WorldBoss
- GuildMission
- NodeInvasion
- NodeRecapture
- DynamicEvent
- StoryInstance
- HiddenArea
- NightEvent

한 Monster가 여러 Context를 가질 수 있다.

예:
`3급 무영`
- OpenWorldRare
- Dungeon
- NightEvent
- GuildMission

`5급 파쇄자`
- OpenWorld
- Dungeon
- GuildMission
- NodeInvasion
- NodeRecapture

## 3. Monster Catalog의 필수 데이터

각 Monster에 최소:
- MonsterId
- Grade
- Name
- Archetype
- CombatRole
- RegionAffinity[]
- SpawnContext[]
- Faction
- AIProfile
- Skills[]
- CounterRules[]
- PartBreak[]
- MovementProfile
- TargetPriority
- GroupBehavior
- AggroBehavior
- RespawnPolicy
- DropTable
- CraftMaterials
- ThreatCost
- PartyRecommendation
- CodexData
- Lore
- VisualReference
- AudioProfile
- AnimationProfile

## 4. 지역 생태계

대한민국 전체에서 같은 몬스터가 같은 비율로 나오면 안 된다.

서울 도심:
추적/공진/교란/인간형 비중 증가.

용산:
파쇄/시설/장비 계열 증가.

한강:
기동/도약/포획 계열 증가.

산악:
잠복/감시/추적 증가.

항만:
운반/군집/대형 개체 증가.

지하철/지하시설:
잠복/공진/장막 계열 증가.

## 5. 거점 시스템 위치

World
- Monster Catalog
- Open World
- Dungeon
- Party
- Raid
- Guild
- Economy
- Crafting
- PvP
- Story
- Dynamic World Event
  - Node System
    - Invasion
    - Defense
    - Recapture

기존 남산 구현은 삭제하지 않는다.
다만 Node/Wave는 공통 Monster Catalog의 ID를 **참조**하도록 바꾼다.

## 6. Claude 실제 작업 순서

1. 기존 `WaveMonster`, `Node`, `Encounter`, Enemy Base 구조 READ-ONLY 감사.
2. 일반 Monster 기능 중 Node 종속 코드를 표시.
3. 공통 `MonsterCatalog` / `MonsterArchetype` 계층 추가 또는 기존 시스템에 병합.
4. 기존 5급 6종을 공통 Catalog로 이동/연결.
5. 전체 63종 데이터를 같은 구조로 로드 가능하게 함.
6. `Grade`와 `CombatRole` 분리.
7. `SpawnContext`, `RegionAffinity` 추가.
8. Node/WaveDirector는 MonsterId만 요청.
9. OpenWorld Spawner도 동일 MonsterId 사용.
10. Dungeon Encounter도 동일 MonsterId 사용.
11. 기존 카운터/부분파괴/Boss 시스템 재사용.
12. 현재 최종 3D 모델이 없는 개체는 더미 Mesh로 Gameplay 검증 지속.

## 7. 최우선 원칙

**황혼은 디펜스 게임이 아니다.**

황혼은 대한민국을 무대로 한 3D 액션 MMORPG이며,
거점 방어는 살아있는 월드에서 일어나는 여러 콘텐츠 중 하나다.

향후 판단 순서:
`MMORPG 월드 -> 캐릭터/전투 -> 몬스터 생태계 -> 필드/던전 -> 파티/길드 -> 지역 콘텐츠 -> 거점전`
