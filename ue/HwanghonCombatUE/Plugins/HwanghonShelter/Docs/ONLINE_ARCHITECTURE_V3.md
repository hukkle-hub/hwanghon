# 황혼 온라인 구조 v3

## 최종 실행 흐름

```text
Native Unreal App
    │
    ▼
L_Loading
    │
    ▼
L_CharacterSelect
    │  Ain / Kain / Ryu / Sera
    ▼
Matchmaker HTTP
    │
    ├─ available shelter instance?
    ▼
Unreal Dedicated Shelter Server
L_GangnamBunker_B1
    │
    ├─ NPC / 시설 / 파티 구성
    └─ 던전 출정
            │
            ▼
       Party Dungeon Server
       1~4 players
```

## HTML/WebGL 폐기 범위

`game3d.html`/Three.js/WebGL은 **게임 런타임에서 제거**한다.

남길 수 있는 용도:
- QA 모션 검수
- 디자인 비교
- 운영자/개발자 도구
- 웹사이트 홍보용 뷰어

게임 플레이, 전투, 쉘터, 캐릭터 선택, 네트워크 동기화는 Unreal native runtime에서 처리한다.

## 동시접속 목표

실측 전에는 보장 수치를 말하지 않는다.

1차 생산 목표:
- 쉘터 인스턴스: **24명**
- 상한 실험: **32명**
- 던전 인스턴스: **1~4명**
- Dedicated Server Tick: **30 Hz**
- 클라이언트 렌더: **60 FPS 우선 / 하위 30 FPS 옵션**

쉘터 24명은 한 서버 전체의 최대 CCU가 아니라 **한 인스턴스의 인원**이다.

예:
- 10개 쉘터 인스턴스 = 최대 240명
- 42개 쉘터 인스턴스 = 최대 1008명
- 실제 총 CCU에는 던전 인스턴스와 로그인/대기 인원도 포함

서버 머신 한 대에 몇 인스턴스를 넣을지는 CPU/RAM/네트워크 프로파일링 뒤 결정한다.

## 왜 24명부터 시작하는가

황혼은 단순 채팅 로비가 아니다.

- 실제 3D 캐릭터
- 장비 외형
- NPC
- 이동/애니메이션
- 시설 상호작용
- 파티 상태
- 음성/채팅 확장 가능성

때문에 첫 테스트부터 100명을 한 공간에 밀어 넣는 것보다
24명에서 replication budget을 고정하고 32명으로 올리는 편이 안전하다.

## 서버 권한

Dedicated server authoritative:
- 플레이어 위치/상태
- 파티
- 쉘터 상호작용
- 던전 입장
- 전투 판정
- 드랍/보상 확정

클라이언트:
- 입력
- 카메라
- HUD
- 로컬 FX
- 예측 가능한 이동/애니메이션

계정/인벤토리/영구 성장:
- 별도 백엔드 DB
- Unreal 서버 프로세스 메모리에만 저장하지 않는다.

## 이후 필수 작업

1. Replication Graph 또는 Iris relevancy 설정
2. 쉘터 NPC NetDormancy
3. 시설 Static Actor 미복제
4. 멀리 있는 플레이어 업데이트 빈도 감소
5. 캐릭터 Cosmetic은 Soft Asset 비동기 로드
6. 24/32/48 bot load test
7. 서버 frametime / bandwidth / memory 기준 수립
