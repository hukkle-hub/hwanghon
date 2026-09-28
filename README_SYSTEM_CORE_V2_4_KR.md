# 황혼 SYSTEM CORE v2.4 — Character Identity / 1~4 Authority

UI/그래픽이 아니라 캐릭터·보스·던전 시스템 패스.

## v2.4 핵심

### 캐릭터 원본 수치 실제 적용
`js/world.js` 디자인 시트 값:

- Ain: HP 24450 / ATK 2980 / DEF 1780 / ASPD 112.5 / MSPD 105
- Kain: HP 38200 / ATK 3410 / DEF 2960 / ASPD 96 / MSPD 98
- Ryu: HP 21800 / ATK 2640 / DEF 1520 / ASPD 124 / MSPD 112
- Sera: HP 19600 / ATK 1480 / DEF 1610 / ASPD 100 / MSPD 104

UE local:
- HP -> 실제 MaxHealth
- ATK -> 평1/평2/평3/Smash 피해
- DEF -> Raid와 같은 방어 감소식(최대 25%)
- ASPD -> 실제 공격 판정/캔슬/애니메이션 combat clock
- MSPD -> 실제 CharacterMovement MaxWalkSpeed

`HWPlayerPresentationComponent`는 combat clock을 매 프레임 scrub하므로
ASPD 변경 시 판정만 빨라지고 애니메이션이 뒤처지는 구조가 아니다.

### 런타임 Tuning 격리
캐릭터별 수치 변경이 같은 DataAsset을 공유하는 다른 Pawn에 번지지 않도록
`UHWCombatTuningAsset`을 각 CombatComponent owner로 Duplicate한다.

### 서버 캐릭터 스탯 결함 수정
기존 `server/store.cjs stats()`가 누락하던:
- base DEF
- critChance
- critDamage
- MSPD / moveMult
를 authoritative Raid stats에 전달.

### 1~4인 동일 Authority
의뢰 데이터는 1~4명인데 서버는 2명부터 start 가능했던 불일치를 수정.
서버 Raid 시작을 1~4명으로 통일한다.

따라서 production에서는:
- 1P
- 2P
- 3P
- 4P

모두 같은 Raid authority를 사용할 수 있다.

### 역할 정체성
Kain:
- local threat ×1.25 기존 규칙 유지
- server threat도 `threatMult=1.25`로 동일하게 연결

Sera:
- 회복 결계 Skill4
- 자기 자신만 회복하던 server/local fallback을 수정
- 근거리 살아있는 파티원에게 HP 15% 회복 + 3초 50% 피해감소
- 서버가 온라인 효과 authority

## 변경하지 않은 계약

- 한 플레이어 = 한 캐릭터
- 전투 중 캐릭터 교대 없음
- 온라인 damage / boss / part / reward authority = `server/raid.cjs`
- 기존 CommitDeath / OnDied / OnBossDied / QuestRun lifecycle 보존

## 정적 검증

패키지 단독:
- 44 tests
- 37 PASS
- 0 FAIL
- 7 SKIP (실제 server runtime이 있어야 실행)
- SYSTEM CORE V1 verifier PASS
- SYSTEM CORE V2 verifier PASS
- apply/preflight AST PASS

다음 실제 게이트:
UE 5.8.1 compile -> 1P server Raid -> 2P -> 4P -> role QA -> boss/dungeon QA.
