# 다음 진행 — Open World Monster Ecology Prototype v0.9

## 목표

남산 정문 웨이브가 아니라 **서울 필드를 걸어다니는 MMORPG**를 먼저 느끼게 한다.

첫 필드 검증 구간:
`서울역 외곽 -> 남산 하부 -> 남산 능선`

전투를 하지 않고 지나갈 수 있는 공간,
소규모 사냥,
희귀 정예 발견,
밤에 바뀌는 생태,
동적 사건,
던전 입구
가 한 흐름에 존재해야 한다.

## 필드에서 몬스터가 보이는 방식

일반 MMORPG식:
`고정 스폰 위치에서 20초마다 부활`
만 사용하지 않는다.

황혼:
- Nest: 소규모 군락
- Patrol: 이동 무리
- Lurker: 건물/골목 매복
- Rare: 필드 정예
- Migration: 지역 간 이동
- Dynamic Event: 상황 발생 시 구성 변경

## 플레이어 경험 예시

서울역을 출발한다.

평상시:
5급 보행자 3 + 감시자 1이 골목을 이동.

다른 길:
전투 없이 우회 가능.

폐건물:
잠복자/잔향자가 있을 가능성.

남산 접근:
질주자 + 등반자 비중 상승.

밤:
추적자와 4급 침묵자 등장 확률 상승.

희귀 사건:
3급 무영이 한 번 나타난다.
이것은 웨이브가 아니라 필드 Rare Encounter다.

## Dungeon 연결

서울 초기 Dungeon 후보:
1. `서울역 폐쇄 승강장`
   - Urban/Underground
   - 잠복/잔향/분열/장막 계열

2. `남산 관리터널`
   - Urban/Mountain/Underground
   - 추적/감시/무영

3. `용산 비상변전소`
   - Industrial
   - 파쇄/침투공/철화

Dungeon은 Monster Catalog ID를 참조한다.
Open World용 몬스터 클래스를 따로 복제하지 않는다.

## 다음 구현 목표

1. MonsterCatalogAsset
2. FieldPopulationCell
3. Nest/Patrol Spawn Source
4. OpenWorld Respawn Policy
5. Day/Night pool swap
6. Rare Encounter
7. 첫 Dungeon 입구
8. 남산 Node Event가 발생하면 평상시 필드 Pool 일부가 Invasion Context로 전환

마지막 8번이 중요하다.

거점전은 별도의 디펜스 미니게임이 아니라,
평소 돌아다니던 MMORPG 월드가 사건 때문에 **상태가 변한 것**처럼 보여야 한다.
