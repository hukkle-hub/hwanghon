# Claude 적용 지시 — Korea GuildWorld v0.2

## 우선순위
개인 캐릭터 외형보다 길드/거점/지역/전국 시스템을 먼저 구현한다.

## 1. 먼저 읽기 전용 감사
- 기존 Guild 시스템 존재 여부
- 기존 Party/Session/Backend 구조
- 기존 GameInstanceSubsystem/WorldSubsystem
- 기존 Node/Outpost/Wave/Contribution 시스템
- 기존 Save/DB/API 계층

중복 구조가 있으면 이 패키지 클래스를 그대로 추가하지 말고 기존 구조에 병합한다.

## 2. v01과의 관계
`Hwanghon_Namsan_PrototypeA_v01`의 Node 전투는 한 거점의 전술 레이어다.
이번 v02 GuildWorld는 그 위의 전략 레이어다.

전술:
Gate / Generator / Comms / Wave / Boss

전략:
Guild / Alliance / Management / Region / National Campaign

둘을 한 클래스에 합치지 않는다.

## 3. 첫 통합 목표
남산 N01 전투 종료 시 공헌을 GuildWorld에 전달한다.

예:
- 시설 수리 → Repair
- NPC 구조 → Rescue
- Gate 방어 → Defense
- 재료 보급 → Supply
- 일반 처치 → Combat
- 중계자 공략 → Boss
- 지휘 핑/분대 목표 성공 → Command (캡 적용)

## 4. 첫 UI
최종 디자인 금지. Debug UI로:
- 현재 관리 길드
- 관리 정책
- 길드 공헌도 Top 3
- Administration Capacity
- 서울 Pressure
- 다음 관리권 정산까지 시간

만 표시한다.

## 5. 첫 서버 테스트
세 테스트 길드로 진행:
- G_ALPHA: 전투 중심
- G_BRAVO: 수리/구조/보급 중심
- G_CHARLIE: 다거점 확장 시도

검증:
- DPS 1위가 무조건 관리권을 얻지 않는가
- 다거점 길드가 Capacity 때문에 제한되는가
- RegionalHub 2개 동시 관리가 차단되는가
- 동맹 4개 길드 생성이 거부되는가
- 관리 길드가 바뀌어도 일반 플레이어 서비스는 그대로인가

## 6. 금지
- 전국 맵 아트를 먼저 만들지 않는다.
- 1:1 실측 대한민국 월드를 만들지 않는다.
- 한 화면 50인 공성전을 목표로 최적화를 망치지 않는다.
- PvP 승리만으로 관리권을 넘기지 않는다.
- 관리 길드가 일반 유저에게 세금을 부과하거나 출입을 막게 하지 않는다.
