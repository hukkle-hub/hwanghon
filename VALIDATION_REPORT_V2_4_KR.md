# 황혼 SYSTEM CORE v2.4 — 검증 보고서

검증 일자: 2026-09-28

## 결과

- Node system-core tests: 44 total
- PASS: 37
- FAIL: 0
- SKIP: 7
- SYSTEM CORE V1 static verify: PASS
- SYSTEM CORE V2 static verify: PASS
- Python apply/preflight AST: PASS
- C++ header/cpp brace sanity: PASS

## SKIP 7의 의미

실제 저장소의 `server/` 런타임이 패키지와 함께 있을 때만 실행되는 authoritative smoke test다.
패키지 단독 검증에서는 의도적으로 skip되며 실패가 아니다.

검증 대상:
- 4-player independent character identity / boss scaling
- server down/revive 3.0s / 30% HP
- disconnect/reconnect/retry
- server-defined boss part target
- 1-player authoritative Raid
- authoritative store character stats
- Sera authoritative party ward

## 시스템 계약

- 플레이어 1명 = 캐릭터 1명
- Ain / Kain / Ryu / Sera 중 1명 선택
- 전투 중 캐릭터 교대 없음
- 1~4인 실제 플레이어 협동
- 온라인 damage / boss phase / boss part / reward authority = `server/raid.cjs`
- UE = input intent / local presentation prediction / snapshot reconciliation
- 기존 `CommitDeath / OnDied / OnBossDied / UHWQuestRunSubsystem` 수명주기 보존

## 다음 실제 PC Gate

1. 최신 main에 preflight
2. UE 5.8.1 compile / UHT 0 error
3. Hwanghon.* Automation
4. npm test
5. 1P authoritative Raid
6. 2P down/revive
7. 4P boss scaling/threat/parts/phase
8. expedition/interact/gate/hazard
9. wipe/retry
10. reconnect

이 10개가 실제 UE/서버 환경에서 통과하면 시스템 코어는 production content 작업으로 넘어갈 수 있다.
