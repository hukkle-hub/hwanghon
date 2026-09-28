# 126. 황혼 SYSTEM CORE v2 — 캐릭터·보스·던전 + 서버 권한형 1~4인 협동

## 0. 고정 전제

황혼은 **캐릭터 교대형 게임이 아니다.**

- 플레이어 1명 = 캐릭터 1명
- 출격 전에 Ain / Kain / Ryu / Sera 중 1명을 선택
- 던전 내부 캐릭터 교체 없음
- 협동은 실제 플레이어 1~4명
- UI/그래픽/연출보다 시스템 Graybox를 먼저 통과

## 1. 권한 구조

### Solo / Local Graybox
UE가 로컬 authority.

- `UHWCombatComponent`
- `UHWCharacterKitComponent`
- `UHWBossSystemComponent`
- `AHWDungeonDirector`
- `UHWCoopCombatSubsystem`

### Online Raid
기존 `server/raid.cjs`가 authority.

클라이언트는 intent만 보낸다.

- move
- target
- attack / smash
- dodge / jump
- counter / guard
- skill 0~3 / ult
- revive
- interact
- opening / execute

서버가 결정한다.

- HP / stamina / ult
- damage / crit
- boss HP / posture / phase
- boss part break
- threat
- revive
- expedition / checkpoint / gate
- hazard
- clear / reward

온라인에서 UE가 별도로 damage/reward/part-break를 확정하면 실패다.

## 2. Character System

공통 슬롯:

- Basic combo
- Smash
- Dodge
- Jump
- Counter
- Skill 1
- Skill 2
- Skill 3
- Skill 4
- Ultimate

캐릭터 전환/Entry/Exit/LinkGauge 없음.

### Ain
빠른 DPS / 회피·카운터 중심.

### Kain
Bruiser / 높은 threat / Break 보조.

### Ryu
Breaker / 빠른 압박.

### Sera
Support / 회복·방어 보조.

로컬 fallback의 skill CD/stamina/multiplier는 현재 서버 kit 계약과 맞춘다.

## 3. Co-op

`UHWCoopCombatSubsystem`

- 최대 4명
- 각 참가자 독립 캐릭터 ID
- 살아있는 플레이어 추적
- threat 누적
- highest-threat target
- closest living fallback

서버와 맞춘 Boss HP scale:

- 1P: 1.00
- 2P: 1.65
- 3P: 2.30
- 4P: 2.95

로컬 posture threshold는 서버와 동일하게 100 기준.

## 4. Down / Revive

서버 기준과 맞춤.

- Down: 20초
- Revive channel: 3.0초
- Revive HP: 30%
- 전원 Down/Dead → wipe

온라인에서는 server snapshot의 `downT`, `dead`, `reviveProgress`가 원본이다.

## 5. Boss System

`UHWBossSystemComponent`

로컬 Graybox:

- Phase 1 / 2 / 3
- posture
- Break window
- head / armor / limb part
- direct part lock-on
- part break
- enrage
- threat target
- difficulty scale

온라인:

`AHWBossCharacter`는 snapshot presentation actor로 전환.

- local AI tick off
- client local damage off
- server HP/state/position 사용
- server part IDs가 로컬 proxy보다 우선

## 6. Dungeon System

`AHWDungeonDirector`

Room type:

- Combat
- Elite
- Objective
- Rest
- Boss

지원:

- wave count
- objective progress
- checkpoint
- revive token
- party wipe
- retry
- boss clear
- Normal / Hard / Nightmare

로컬 시스템 QA는 C++ fallback actor를 사용한다.

- `AHWDungeonEnemy`
- `AHWDungeonObjectiveNode`
- `AHWBossCharacter`

## 7. Online Protocol

`UHWRAIDNetworkSubsystem`

WebSocket:
`/party-socket`

지원:

- hello / welcome
- create / join / leave
- ready / start
- retry / lobby
- monotonic input `seq`
- full `state`
- delta `patch`
- `$array`
- `$unset`
- auto reconnect

기존 서버의 약 20Hz snapshot/delta를 소비하고 서버 simulation cadence는 변경하지 않는다.

## 8. World Reconciliation

`AHWRaidWorldBridge`

첫 로컬 player snapshot을 이용해 server coordinate와 UE map origin offset을 자동 보정.

그 뒤:

- local player prediction + authoritative position correction
- remote player interpolation
- boss interpolation
- boss part broken sync
- hazard proxy
- expedition node proxy
- gate proxy

온라인 presentation map에는 큰 평면만 둔다. 가로 collision/progression은 서버가 원본이다.

## 9. Expedition Snapshot Extension

기존 `server/raid.cjs` snapshot에 presentation 정보만 추가한다.

- expedition node id/kind/name/x/y/range
- enabled / done / discovered
- gate x/y/open

이 정보로 UE가 기믹 위치를 보여준다.

**완료 판정은 여전히 서버의 `interact` intent가 수행한다.**

## 10. Gate

### Local
- [ ] Skill1~4 + Ult
- [ ] no character switching
- [ ] mob / elite / boss generic damage path
- [ ] boss phase / break / parts / enrage
- [ ] dungeon room progression
- [ ] checkpoint retry

### 2P
- [ ] 서로 다른 캐릭터 2명
- [ ] 독립 이동/공격
- [ ] threat target 변화
- [ ] one down → revive
- [ ] boss clear

### 4P
- [ ] 4 independent players
- [ ] boss HP scale 2.95
- [ ] part targeting/break sync
- [ ] phase sync
- [ ] hazard sync
- [ ] all-down wipe
- [ ] retry

### Network
- [ ] reconnect/token restore
- [ ] state then patch
- [ ] repeated/out-of-order seq server reject
- [ ] local correction stable
- [ ] remote interpolation stable
- [ ] server-only reward authority

이 Gate 전부 통과 전 UI/그래픽 polishing으로 돌아가지 않는다.
