# Claude Code 적용 지시 — 황혼 SYSTEM CORE v2.2 CURRENT

최신 main 기준으로 첨부 패키지를 저장소 루트에 병합한다.

이번 작업은 **UI/그래픽이 아니라 캐릭터·보스·던전·1~4인 협동 시스템만** 진행한다.

## 고정 계약

- 한 플레이어 = 한 캐릭터
- 출격 전 Ain/Kain/Ryu/Sera 선택
- 던전 내부 캐릭터 교체 금지
- 실제 플레이어 1~4인 협동
- online Raid authority = 기존 `server/raid.cjs`
- UE client는 intent + prediction + presentation + reconciliation
- client damage / part break / phase / reward authority 금지

## 적용

```powershell
powershell -ExecutionPolicy Bypass -File tools\ue\integrate-system-core-v2-current.ps1
```

현재 main의 다음 구현은 반드시 보존한다.

- `UHWCombatComponent::CommitDeath`
- `OnDied` terminal ordering
- `AHWBossCharacter::Die` / `OnBossDied`
- `UHWQuestRunSubsystem` attach/complete/fail/leave
- 현재 HUD/UI 코드

충돌 시 위 구현을 되돌리지 말고 SYSTEM CORE hook만 최신 문맥에 맞춰 최소 수정한다.

## 실검증 순서

### 1P Local
- Skill1~4 + Ultimate
- mob → elite → objective → boss
- boss phase 1/2/3
- posture/break
- part lock-on/break
- wipe/checkpoint retry

### 2P Online
두 UE client + 실제 `/party-socket`.

- 각 client 다른 character 1개
- 독립 이동/공격
- skill0~3/ult
- target part
- threat target 변화
- 한 명 Down
- 다른 플레이어 3초 revive
- 30% HP 복귀
- boss clear/reward server save

### 4P Online
- 4 independent players
- boss HP scale = 2.95
- no character switching
- boss phase/parts/hazard sync
- expedition node/interact/gate
- all-down wipe
- retry
- reconnect/token recovery

## 온라인 입력

UE → server intent only:

- move
- target
- attack/smash
- dodge/jump
- counter/guard
- skill 0~3
- ult
- revive
- interact
- opening
- execute

서버 snapshot → UE:

- players / character / HP / stamina / ult
- skill cooldown
- boss HP/state/posture/pattern
- parts
- threat-related target behavior
- expedition/checkpoint/nodes/gate
- hazards
- events/result

## 완료 보고

- commit SHA
- UE 5.8.1 compile
- Hwanghon automation
- npm tests
- 1P result
- 2P result
- 4P result
- down/revive
- boss phase/break/parts
- expedition/gate/hazard
- wipe/retry
- reconnect
- 남은 blocker

부분 적용 후 UI 작업으로 넘어가지 말고 위 시스템 Gate까지 수정해서 main에 커밋/푸시한다.

## 추가 확인 — 온라인 캐릭터 생성
새 guest/profile에서 `characterCreated=false`이면 UE의 `CreateCharacter(name, ain|kain|ryu|sera)`가 서버 `type: character`로 정상 저장되는지 확인해. 이건 최초 캐릭터 생성이며 전투 중 교대가 아니다.

CLI QA도 확인:
`-HWServer=http://127.0.0.1:PORT -HWName=GuestA -HWCharacter=ain -HWCharacterName=TestAin`

적용 전에 `python tools/ue/preflight-system-core-v2.py`가 PASS해야 한다. preflight는 임시 복사본에서만 apply를 실행하므로 실패하면 main 작업 트리는 건드리지 않는다.

## 추가 확인 — 캐릭터 선택 실제 출격 연결
반드시 다음을 실제 UE에서 확인해:
- 캐릭터 화면에서 Kain 선택 → 앱/에디터 재시작 → Kain 선택 유지
- Kain 선택 상태로 출격 → 실제 Pawn class가 `AHWKainCharacter`
- Ryu/Sera도 동일
- 기존 v2 저장을 로드하면 schema v3로 올라오고 `ain` 기본값으로 정상 로드
- 온라인 Raid에서는 서버 `profile.character`가 Pawn 선택 우선권을 가짐
- 한 플레이어에게 둘 이상의 Pawn/캐릭터 슬롯을 붙이지 말 것

적용 순서는 `v1 → v1-part2 → v2-current → v2-1-selection`이야.
