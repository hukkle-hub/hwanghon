# 황혼 v5 — 실제 한 바퀴 플레이 루프

```text
Native client
  ↓
Loading
  ↓
Character Select
  ↓
one-time Shelter ticket
  ↓
B-1 Shelter Dedicated Server
  ↓
NPC / 파티
  ↓
파티 전원 출격 셔터 앞 대기구역
  ↓
파티장 G
  ↓
Dungeon ticket 발급
  ↓
셔터 개방 연출
  ↓
GangnamStation_B2 Dedicated Server
  ↓
전투 / 보스
  ↓
Dungeon GameMode CompleteDungeonRun()
  ↓
same-party return shelter allocation
  ↓
one-time Return ticket
  ↓
B-1 Shelter
  ↓
파티 복원
```

## v5 핵심 변경

- `local-dev` 고정 계정 ID 제거
- 클라이언트별 개발용 UUID 생성/보관
- 쉘터도 one-time admission ticket 검증
- 던전도 URL 파라미터가 아니라 ticket payload를 신뢰
- 출격 셔터 `AHHDeploymentGate` 추가
- 파티 전원이 셔터 대기구역에 없으면 출정 거부
- 서버 배정 성공 후 셔터가 실제로 올라간 뒤 travel
- 던전 종료 후 동일 파티가 같은 쉘터로 귀환
- 귀환 ticket에 party/leader 상태 보존
- 귀환한 쉘터에서 party runtime 재구성

## 개발 테스트키

Shelter:
- P 파티 생성
- I 바라보는 유저 초대
- Y 수락
- N 거절
- R 준비
- L 파티 나가기
- G 출정

Dungeon vertical slice:
- H 파티장 개발용 던전 완료/귀환

`H`는 최종판에서 제거하고 보스/Exit Blueprint가 `CompleteDungeonRun()`을 호출하게 한다.
