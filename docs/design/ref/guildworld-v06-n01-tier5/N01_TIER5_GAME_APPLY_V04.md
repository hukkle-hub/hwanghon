# N01 5급 감염체 게임 적용 v04

## 확정 레퍼런스
`References/황혼_남산_거점_5급_감염체_시안.png`

이 이미지는 **디자인 참고용 임시 이미지가 아니라 N01 Prototype의 5급 6종 외형 기준**이다.
새 디자인으로 교체하지 않는다.

## 확정 6종
1. `T5_WALKER` — 5급 보행형 — 이미지 1열
2. `T5_RUNNER` — 5급 질주형 — 이미지 2열
3. `T5_BREAKER` — 5급 파괴형 — 이미지 3열
4. `T5_STALKER` — 5급 추적형 — 이미지 4열
5. `T5_ARMORED` — 5급 철갑형 — 이미지 5열
6. `T5_RESONATOR` — 5급 공진형 — 이미지 6열

## 아트 잠금
- 전부 5급.
- 좀비 시체형으로 재해석 금지.
- 인간 얼굴/체형 유지.
- 고급스럽고 어두운 한국형 다크 판타지/SF 톤 유지.
- 붉은 감염 흔적은 보조 포인트.
- 공진형은 특히 귀족적·뱀파이어 같은 세련된 인간형을 유지.
- 5급인데도 역할이 다르며 등급 차이로 오해하지 않는다.

## Unreal 적용 원칙
기존 Enemy Pawn/BP를 먼저 감사한다.
새 Base Character를 만들지 말고 가능하면 기존 적 BP에
`UHwanghonWaveMonsterComponent`를 붙인다.

각 BP는 대응 DataAsset 하나를 가진다.

- `DA_N01_T5_Walker`
- `DA_N01_T5_Runner`
- `DA_N01_T5_Breaker`
- `DA_N01_T5_Stalker`
- `DA_N01_T5_Armored`
- `DA_N01_T5_Resonator`

외형은 최종 3D 모델이 준비되기 전까지 더미 Skeletal Mesh로 테스트해도 되지만,
최종 모델 제작 시 본 문서의 이미지 열별 디자인을 그대로 기준으로 한다.

## AI 역할
- Walker: 플레이어/전선 유지.
- Runner: 측후방 침투.
- Breaker: Generator/Comms 시설 파괴.
- Stalker: 기술자·의무관·민간 NPC 추적.
- Armored: Gate 압박 + 방패 전진 + 카운터 유도.
- Resonator: 후방에서 주변 5급 강화.

## 기존 보스 시스템과 분리
이 6종은 일반 웨이브 적이다.
`AHwanghonBossBase`를 상속시키지 않는다.
보스의 Phase/PartBreak 프레임워크를 일반 잡몹 전체에 복제하지 않는다.
철갑형의 카운터 보상은 기존 공통 전투 인터페이스를 재사용한다.

## 완료 조건
- 남산 정문 Prototype에서 6종이 실제로 스폰될 것.
- Breaker가 플레이어보다 Generator를 우선하는 상황이 발생할 것.
- Stalker가 NPC를 실제 표적으로 선택할 것.
- Armored가 Gate 전선을 형성할 것.
- Resonator 제거 전후로 주변 몬스터의 이동/공격 수치가 달라질 것.
- 전부 HUD/로그상 `ThreatGrade=5`일 것.
