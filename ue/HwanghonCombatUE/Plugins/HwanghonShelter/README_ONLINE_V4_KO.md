# 황혼 Online Native v4

v4는 v3의 다음 단계다.

## 이번에 실제로 붙인 것

- 로딩 → 캐릭터 선택 → 쉘터 흐름 유지
- 쉘터 24인 Dedicated Server 목표
- 다른 플레이어 Pawn replication 기본 튜닝
- 1~4인 서버 권한 파티
- 바라보는 플레이어 초대
- 수락/거절/준비/나가기
- 파티 HUD
- 파티장 출정
- 던전 서버 자동 배정
- 파티원별 1회용 던전 입장권
- 던전 서버 입장권 검증
- 별도 4인 Dungeon GameMode
- 쉘터/던전 서버 heartbeat
- pre-warmed dungeon pool prototype
- Windows/Linux dungeon server scripts

## 실제 플레이 개발키

```text
P  파티 생성
I  바라보는 플레이어 초대
Y  초대 수락
N  초대 거절
R  준비
L  파티 나가기
G  던전 출정
```

최종 모바일 UI는 이 RPC들을 버튼에 연결하면 된다.

## 설치

v3 플러그인 폴더를 이 v4의 `HwanghonOnline_v4` 내용으로 교체한다.

그 후:
1. C++ 재빌드
2. `DefaultGame.ini.append`, `DefaultEngine.ini.append` 병합
3. Shelter GameMode Blueprint에서 4개 Character Pawn BP 연결
4. Dungeon GameMode Blueprint에서도 동일하게 연결
5. matchmaker 실행
6. shelter server 실행
7. dungeon server 실행
8. client 실행

## 테스트 순서

1. 클라이언트 2개
2. 캐릭터 서로 다르게 선택
3. 같은 쉘터 배정 확인
4. 서로 바라보고 `I`
5. 상대 `Y`
6. 둘 다 `R`
7. 파티장 `G`
8. 둘이 같은 7780 dungeon server로 이동 확인
9. 잘못된/재사용 ticket은 kick되는지 확인
10. 24 bot shelter load test로 확장
