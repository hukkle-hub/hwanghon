# Unreal / 서버 구조 경계 v0.2

## 지금 구현하는 것

`UHwanghonGuildWorldSubsystem`은 단일 서버/PIE에서 규칙을 검증하기 위한 런타임 모델이다.

## 출시 MMO에서 그대로 믿으면 안 되는 부분

다음은 GameInstance 메모리에만 두면 안 된다.
- 길드 멤버십
- 관리권
- 시즌 공헌도
- 동맹 계약
- 거점 장기 상태
- 전국 Pressure
- 거래/경제 데이터

출시 버전은 백엔드 DB와 authoritative service가 소유해야 한다.
Unreal 서버는 현재 필드의 캐시와 전투 결과만 처리한다.

## 권장 흐름

Client
→ Zone Dedicated Server
→ Guild/World Backend
→ Persistence DB

전투 종료:
Zone Server가 공헌 이벤트 전송
→ Backend가 검증/누적
→ 관리 주기 종료 시 Backend가 관리자 결정
→ 해당 결과를 각 Zone Server에 배포

## 서버 셀

대한민국 전체를 단일 Unreal 서버 프로세스로 돌리지 않는다.

- MacroRegion service
- Field/Node zone server
- Guild operation coordinator
- Chat/social service
- Persistence/economy service

를 분리할 수 있는 경계를 유지한다.

`HwanghonGuildWorldSubsystem`의 목적은 **규칙 검증과 클라이언트/필드 서버 연동용 인터페이스 확정**이다.
