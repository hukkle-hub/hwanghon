# 황혼 SYSTEM CORE v2.3 — current main

이번 패스는 UI 디자인이 아니라 시스템 안정화 패스다.

## v2.3 핵심 수정

- `PendingCharacterName / PendingCharacterId`가 잘못 `FHWRaidNetEvent` 안에 들어가 있던 구조 오류 수정.
- pending character creation 상태를 `UHWRaidNetworkSubsystem` private state로 이동.
- `SetPendingCharacterCreation()` API 추가.
- 서버 프로필 캐릭터가 이미 생성된 온라인 세션에서는 로컬 UI가 다른 캐릭터를 선택해 서버/UE 상태가 갈라지는 것을 차단.
- 기존 v2.2의 선택 저장 -> SaveGame v3 -> Pawn spawn 계약 유지.
- preflight가 character-selection regression까지 실행.

## 유지되는 핵심 계약

- 한 플레이어 = 한 캐릭터.
- 전투 중 캐릭터 교대 없음.
- 온라인 Raid의 damage / boss phase / parts / reward authority는 `server/raid.cjs`.
- UE는 intent / prediction / presentation / reconciliation 담당.
- 기존 `CommitDeath / OnDied / OnBossDied / UHWQuestRunSubsystem` 수명주기 보존.

## 검증 결과

패키지 단독 정적 검증:
- SYSTEM CORE V1 verifier PASS
- SYSTEM CORE V2 verifier PASS
- Node tests: 32 total / 28 PASS / 0 FAIL / 4 SKIP
- Python apply/preflight AST PASS
- C++ header/cpp brace sanity PASS

4 SKIP은 실제 저장소의 server runtime이 있어야 도는 2P/4P authoritative smoke test다.

## 다음 실제 게이트

Claude 작업 PC에서:
1. preflight dry run
2. UE 5.8.1 compile/UHT
3. Hwanghon.* automation
4. 1P local dungeon
5. 2P authoritative raid
6. 4P authoritative raid
7. down/revive
8. boss threat/phase/break/parts
9. expedition/interact/gate/hazard
10. wipe/retry
11. reconnect

전부 통과하기 전 UI/그래픽 polish로 돌아가지 않는다.
