# 황혼 SYSTEM CORE v2.2 CURRENT — 캐릭터 / 보스 / 던전 / 1~4인 협동

기준 current main 확인 commit: `d08b0a3e68071052186651eb4b38fa1570b91246`

이 패키지는 UI/그래픽 패키지가 아니다.

목표:
- 캐릭터 1명 고정 조작
- 캐릭터별 Skill 1~4 + Ultimate
- 1~4인 실제 플레이어 협동
- Boss phase / posture / break / part / enrage / threat
- Dungeon room / wave / objective / checkpoint / wipe / retry
- 기존 `/party-socket` + `server/raid.cjs` authoritative multiplayer 연결

## 절대 계약

- 3인 캐릭터 편성 없음
- 전투 중 캐릭터 교체 없음
- 한 플레이어는 한 캐릭터만 조작
- 온라인 client는 damage/reward/phase/part-break authority를 가지지 않음
- current main의 `CommitDeath`, `OnDied`, `OnBossDied`, `UHWQuestRunSubsystem` 수명주기 보존

## 적용 순서

최신 main 루트에서:

```powershell
powershell -ExecutionPolicy Bypass -File tools\ue\integrate-system-core-v2-current.ps1
```

내부 순서:
1. `apply-system-core-v1.py`
2. `apply-system-core-v1-part2.py`
3. `apply-system-core-v2-current.py`
4. SYSTEM CORE tests
5. static verify
6. existing `npm test`
7. UE 5.8 Editor compile
8. `Hwanghon_OnlineRaid` graybox 생성
9. Hwanghon UE automation

## 현재 패키지 정적 검증

- System tests: **21 / 21 PASS**
- SYSTEM CORE v1 static verify: **PASS**
- SYSTEM CORE v2.2 static verify: **PASS**
- apply scripts AST: **PASS**
- C++ source brace/forbidden-switch grammar scan: **PASS**

실제 UE 컴파일 및 실제 2P/4P 네트워크 실검증은 UE/서버가 있는 Claude 작업 환경에서 수행한다.

## 서버와 맞춘 핵심 값

### Boss HP party scale
- 1P: 1.00
- 2P: 1.65
- 3P: 2.30
- 4P: 2.95

### Revive
- down timer: 20s
- channel: 3.0s
- revive HP: 30%

### Character
- Basic / Smash / Dodge / Jump / Counter
- Skill1 / Skill2 / Skill3 / Skill4
- Ultimate
- no switching

## Online

UE sends intents only:
- move / target
- attack / smash
- dodge / jump
- counter / guard
- skill0~3 / ult
- revive
- interact
- opening / execute

UE consumes:
- full state + delta patch
- player HP/stamina/ult/cooldowns
- boss HP/state/posture/pattern
- boss parts
- expedition/checkpoint/node/gate
- hazards
- events/result

## 다음 실제 Gate

1. UE compile
2. 1P local dungeon
3. 2P real WebSocket
4. 4P real WebSocket
5. down/revive
6. boss threat/parts/phase/break
7. expedition interact/gate/hazard
8. wipe/retry
9. reconnect
10. reward server save

위 Gate 전 UI/그래픽 polishing으로 돌아가지 않는다.

## 온라인 초기 캐릭터 생성
- 서버의 기존 `type: character` 계약을 UE에 연결했다.
- 새 프로필(`characterCreated=false`)은 `CreateCharacter(name, characterId)`로 이름 + 캐릭터 1명을 확정한다.
- 허용 캐릭터는 `ain/kain/ryu/sera`뿐이다.
- 이 호출은 **최초 생성용**이며 전투 중 캐릭터 교대가 아니다.
- QA 자동연결은 `-HWCharacter=ain -HWCharacterName=테스트아인`처럼 사용할 수 있다.

## 적용 전 preflight
`python tools/ue/preflight-system-core-v2.py`는 실제 저장소를 임시 폴더에 복사해 v1→v2 적용 스크립트를 dry-run하고, 기존 `CommitDeath / OnDied / OnBossDied / QuestRun` 계약이 남아 있는지 확인한다. 원본 작업 트리는 건드리지 않는다.

## 캐릭터 선택 → 실제 출격 Pawn 연결
- `UHWSaveGame` schema v3에 `SelectedCharacter` 1개만 저장한다.
- 기존 v1/v2 저장은 안전하게 `ain` 기본값으로 마이그레이션한다.
- `UHWProfileSubsystem::SelectCharacter()`가 저장 트랜잭션을 담당한다.
- 캐릭터/스킬/외형 화면의 선택은 더 이상 화면 상태만 바꾸지 않고 저장 프로필을 갱신한다.
- `AHWCombatGameMode::GetDefaultPawnClassForController_Implementation()`이 `ain/kain/ryu/sera` 중 정확히 한 Pawn을 생성한다.
- 온라인 Raid에서는 로컬 저장값보다 **서버 프로필 캐릭터가 우선**한다.
- 전투 중 캐릭터 교대는 여전히 금지다.
