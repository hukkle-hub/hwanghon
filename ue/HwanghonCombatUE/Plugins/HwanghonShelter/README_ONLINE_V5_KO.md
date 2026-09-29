# 황혼 Online Native v5 — Full Loop

이번 버전은 **게임 한 바퀴가 다시 쉘터로 돌아오는 데까지** 연결한 버전이다.

## 들어간 것

- 로딩
- 캐릭터 선택
- 클라이언트별 개발용 UUID
- one-time 쉘터 입장권
- 24인 목표 쉘터 Dedicated Server
- NPC/시설
- 1~4인 파티
- 실제 출격 셔터 대기구역
- 파티 전원 대기구역 검사
- 던전 서버 배정
- 셔터 개방
- one-time 던전 티켓
- 던전 티켓 서버 검증
- 던전 완료
- 귀환 쉘터 재배정
- one-time 귀환 티켓
- 귀환 후 파티/파티장 복원

## 테스트

```text
P party
I invite
Y accept
R ready
G deploy
H dungeon complete (development only)
```

출정할 때는 **파티원 전원이 실제 셔터 앞 BoxVolume 안에 있어야 한다.**

## 아직 실제 Unreal 에디터에서 확인해야 하는 것

이 ZIP은 코드/구조 구현본이다. 여기서는 Unreal Editor/Visual Studio 빌드를 직접 실행하지 못했으므로 아래는 프로젝트에서 확인해야 한다.

- UE 5.8 C++ compile
- Character Pawn BP map 연결
- 실제 B-1 레벨에 gate 배치
- 2-client Dedicated Server test
- Android packaged client
- 24/32 user load test
