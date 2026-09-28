# 125. 황혼 SYSTEM CORE v1 — 디자인 제외 / 캐릭터·보스·던전 전용

## 0. 절대 전제

황혼 멀티플레이는 **3인 캐릭터 편성/실시간 교대 게임이 아니다.**

- 플레이어 1명 = 출격 전에 고른 캐릭터 1명
- 던전 안에서 캐릭터 교체 없음
- 협동 파티 = 1~4명의 실제 플레이어
- 각 플레이어는 자신의 캐릭터 한 명을 조작
- 기존 `/party-socket` 서버의 `room.members.size >= 4` 규칙 유지

명조에서 참고하는 것은 **캐릭터별 고유 전투 자원/스킬 정체성**,
블소에서 참고하는 것은 **협동 보스/브레이크/던전 진행 구조**다.

---

# 1. 이번에 하지 않는 것

완전히 보류:

- UI 디자인
- 그래픽
- 조명
- Hero mesh
- 재질
- VFX polish
- 로비 디자인
- 상점/외형 UI
- 스토리 연출

시스템 Graybox 먼저.

---

# 2. 캐릭터 시스템

## 공통

모든 플레이어 캐릭터:

- 기본 3타
- Smash
- Dodge
- Jump
- Counter
- Skill 1
- Skill 2
- Skill 3
- Skill 4
- Ultimate
- Unique Gauge
- Ultimate Gauge
- Stamina
- Down / Revive

### 캐릭터 교체
없음.

### 최대 파티
4명.

## Ain

역할:
빠른 DPS / Counter.

초기 시스템 성격:
- hit당 고유 게이지 증가 높음
- 짧은 Skill1 CD
- Skill2 = 그림자 걸음 계열 회피
- Skill3 = 피의 회전 계열 공격
- Skill4 = 결의 계열 방어
- Ultimate = 고배율 burst

## Kain

역할:
Bruiser / 높은 threat / Break 보조.

- Skill damage 무거움
- Kain damage가 boss threat를 조금 더 생성
- 긴 CD 대신 높은 multiplier

## Ryu

역할:
Breaker / 빠른 gauge.

- Skill CD 짧음
- Break 계열 tier 활용
- 고유 게이지 회전 빠름

## Sera

역할:
Support.

- Skill2 = 회피/정제 계열
- Skill3 = 공격/연쇄 계열
- Skill4 = 회복/방어 계열
- 파티 시스템과 buff/heal 확장 가능

---

# 3. 멀티 협동 시스템

`UHWCoopCombatSubsystem`

- 살아있는 플레이어 등록
- 최대 4명
- 캐릭터 ID 별도 보유
- boss threat
- highest-threat target
- closest living target
- party-size scaling

초기 scaling:

Boss HP:
- 1P 1.00
- 2P 1.65
- 3P 2.30
- 4P 2.95

Boss posture threshold:
- 1P~4P 모두 100 (현재 authoritative server와 동일)

Mob count:
- 1P 1.00
- 2P 1.35
- 3P 1.65
- 4P 1.90

수치는 실전 QA에서 조정하되 구조는 유지.

---

# 4. Down / Revive

`UHWCoopLifeComponent`

협동에서 HP 0:

- 즉시 캐릭터 교체 없음
- Down 상태
- bleedout 20s
- 다른 플레이어가 220cm 이내에서 revive
- channel 3.0s
- revive HP 30%

전원 Down:
Dungeon Wipe.

Solo:
HP 0 = 즉시 defeat.

---

# 5. 공통 Combat Target

`IHWCombatTargetInterface`

플레이어 공격은 더 이상 Boss 클래스만 직접 때리지 않는다.

모두 동일 경로:

- Mob
- Elite
- Boss
- Boss Part

`ReceiveSystemHit(...)`

따라서 던전 전체 전투가 한 damage path를 사용한다.

---

# 6. 보스 시스템

`UHWBossSystemComponent`

## Phase

HP:
- Phase 1: >70%
- Phase 2: 40~70%
- Phase 3: <40%

P1에서는 일부 큰 패턴 제한.
P2/P3로 갈수록 패턴/속도/피해 확대.

## Posture / Break

공격별 posture:

- Light 6
- Finisher 12
- Smash 18
- Counter 28
- Stagger 22

파티 인원에 따라 max posture 증가.

Posture max:
- Break
- pending attack 취소
- break window 약 4s+
- break count 누적

## Parts

기본:
- head
- armor
- limb

각 part:
- 독립 HP
- Lock-on 가능
- 파괴 후 타깃 해제
- armor 파괴는 posture 30% 추가

최종 보스별 part table로 교체 가능.

## Enrage

기본 180s.

Enrage:
- outgoing damage 증가
- pattern speed 증가

## Threat

보스는:
1. highest threat 살아있는 플레이어
2. 없으면 closest living player

순서로 타깃.

Kain은 초기 threat multiplier 1.25.

---

# 7. Dungeon 시스템

`AHWDungeonDirector`

Room type:
- Combat
- Elite
- Objective
- Rest
- Boss

진행:
`Room → Clear → Checkpoint → Next Room → Boss → Complete`

## Wave

Combat/Elite:
remaining enemy count가 0이면 room clear.

## Objective

Graybox에서는 objective node에 접촉하면 진행.
최종에서는:
- 레버
- 장치 충전
- 파괴
- 운반
- 방어
등으로 Blueprint 교체.

## Checkpoint

방별 checkpoint flag.

Party wipe:
- Failed state
- revive token 사용
- latest checkpoint부터 재시작

## Difficulty

Normal / Hard / Nightmare.

초기:
- HP scale
- damage scale
- enemy count scale

Boss system에도 difficulty scale 전달.

---

# 8. Graybox fallback

아트 없이 시스템 검수 가능하도록 C++ fallback 제공.

Combat Room:
`AHWDungeonEnemy`

Objective Room:
`AHWDungeonObjectiveNode`

Boss Room:
`AHWBossCharacter`

Production map에서는
`bUseFallbackGrayboxSpawns=false`
후 실제 enemy/spawner/objective Blueprint를 사용.

---

# 9. 현재 기존 서버와의 관계

기존 `server/raid.cjs`는 이미:

- independent players
- 1 world / 1 boss
- party-size boss HP scale
- character per member
- skills
- ult
- revive
- threat
- boss parts
- boss phases

를 보유한다.

따라서 SYSTEM CORE v1의 목적은
**새로운 다른 게임 규칙을 서버에 만드는 것이 아니라
UE 클라이언트/Graybox가 기존 authoritative raid 구조와 같은 시스템 언어를 쓰게 하는 것**이다.

---

# 10. 완료 게이트

## Character
- [ ] 교대 시스템 없음
- [ ] Ain/Kain/Ryu/Sera 각각 단일 Pawn으로 사용 가능
- [ ] Skill1
- [ ] Skill2
- [ ] Ultimate
- [ ] unique gauge
- [ ] ultimate gauge
- [ ] dodge/counter
- [ ] down/revive

## Multiplayer
- [ ] 1P
- [ ] 2P
- [ ] 3P
- [ ] 4P
- [ ] 각 플레이어 character 1개
- [ ] aggro target 변경
- [ ] 전원 down wipe

## Boss
- [ ] 3 phase
- [ ] posture/break
- [ ] break window
- [ ] part targeting
- [ ] part break
- [ ] enrage
- [ ] party scaling
- [ ] threat

## Dungeon
- [ ] combat room
- [ ] elite room
- [ ] objective room
- [ ] checkpoint
- [ ] party wipe
- [ ] retry
- [ ] boss room
- [ ] clear
- [ ] normal/hard/nightmare

이 Gate가 통과하기 전에는 디자인 작업으로 돌아가지 않는다.
