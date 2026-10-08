# N01 5급 몬스터 PIE 시각 검증 v06

## 목표
더미 메시 상태에서도 각 몬스터 머리 위에서 다음 정보를 즉시 읽는다.

```text
T5 / BREAKER
TARGET: BP_N01_Generator
```

## 각 Enemy BP에 추가
- `HwanghonWaveMonsterComponent`
- `HwanghonWaveMonsterBrainComponent`
- `HwanghonWaveMonsterDebugComponent`

Resonator만 추가:
- `HwanghonResonanceEmitterComponent`

Shipping 빌드에서는 TextRender 디버그가 컴파일 조건으로 표시되지 않는다.

## World Target 연결
아래 Actor에 `HwanghonWaveTargetComponent`를 붙인다.

- Player -> Player
- Gate -> Gate
- Generator -> Generator
- Comms -> Comms
- 기술자 -> NPC / Importance 1.50
- 의무관 -> NPC / Importance 1.35
- 일반 민간인 -> NPC / Importance 1.00

## 테스트 액터
Pilot Level에 `AHwanghonN01PIETestController` 기반 BP를 하나 배치한다.

설정:
- NodeController = N01 NodeStateController
- bAutoStart = true
- ObserveInterval = 1.0
- MaxTestDuration = 330

Play를 누르면:
1. 거점 Reset
2. Warning
3. Invasion
4. 전체 웨이브 자동 실행
5. AI 행동 관찰
6. 결과 Output Log 출력

## 반드시 눈으로 확인할 장면
1. 파괴형의 라벨이 `TARGET: Generator`
2. 추적형이 기술자/의무관 쪽으로 전선 이탈
3. 철갑형이 Gate 앞 방어선을 압박
4. 공진형 주변 개체의 이동/공격 배율 상승
5. 공진형 제거 후 배율 원복
6. 모든 라벨 첫 줄은 `T5`

## 이 단계에서 아트 작업 금지
승인된 6종 이미지는 그대로 유지한다.
현재 목표는 gameplay proof다.
