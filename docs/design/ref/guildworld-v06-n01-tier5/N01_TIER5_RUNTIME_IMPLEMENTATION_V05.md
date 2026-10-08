# N01 5급 감염체 Runtime v05

## 이번 단계
승인된 6종 외형은 변경하지 않는다.
이번 버전은 **게임플레이 역할 구현**에만 집중한다.

### 공통
모든 개체:
- ThreatGrade = 5
- 기존 Enemy Pawn / Character / Combat 시스템 우선 재사용
- `UHwanghonWaveMonsterComponent`로 역할 DataAsset 연결
- `UHwanghonWaveMonsterBrainComponent`로 0.35~0.8초 간격 목표 재평가
- 서버만 목표 선택

### 월드 타겟
Player, Gate, Generator, Comms, NPC에
`UHwanghonWaveTargetComponent`를 붙인다.

NPC Importance 권장:
- 일반 민간인 1.0
- 의무관 1.35
- 기술자 1.50

## 역할별 실제 행동

### Walker
전선 유지용.
가장 가까운 플레이어를 압박하고 플레이어가 없을 때 Gate로 전진한다.

### Runner
Player 중심이지만 NPC/후방으로 우회 가능한 빠른 개체.
최종 BT에서는 측면 EQS/Anchor를 활용한다.

### Breaker
Generator > Comms > Gate > Player.
플레이어가 가까이 있다고 무조건 타깃을 바꾸지 않도록 Facility weight가 높다.

### Stalker
NPC가 최우선.
기술자/의무관 ImportanceMultiplier로 동일 NPC 타입 안에서도 우선순위를 만든다.

### Armored
Gate > Player.
전면 피해 배율 0.45.
`Heavy Charge` 퍼펙트 카운터 시 자세 피해 배율 2.25.
`Overhead Crush`는 카운터 불가 → 회피.

**기존 카운터 판정 시스템을 수정하지 말고 위 배율만 연결한다.**

### Resonator
후방 지원.
반경 1800cm 내 5급 아군에게:
- 이동 ×1.10
- 공격 ×1.12
- 중첩 상한 1

공진형 자신과 다른 공진형은 강화하지 않는다.
공진형 사망/이탈 시 0.4초 안에 버프가 해제된다.

## 성능
Prototype에서는 TActorIterator 탐색을 사용한다.
정식 MMORPG 서버 적용 전:
- Node별 Target Registry
- Spatial Hash / GameplayTag query
- AI Perception / Mass 고려
로 교체한다.

중요: 현재 코드는 **N01 Vertical Slice 검증용**이지,
전국 서버에서 매 AI마다 전 Actor 스캔하는 최종 구현이 아니다.
