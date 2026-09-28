# 132. 황혼 Story-to-Boss-Dungeon Pipeline v1

## 핵심 공식

황혼 던전은 `길고 많은 방`이 아니라 **소설의 중요한 사건 하나를 플레이 가능한 보스 무대로 농축한 것**이다.

`Novel Scene -> Story Staging -> Boss Entry -> Arena -> Phase State Changes -> Boss Result -> Next Novel Scene`

## 무료 샘플 역할

### Derelict Corridor
- 현대 폐쇄시설/벙커/병원/연구소 계열 최우선 베이스.
- 가져올 것: 콘크리트, 배관, 케이블, 잔해, 노후 표면, 분위기 조명.
- 버릴 것: 원본 레이아웃과 외국 표지판 정체성.

### Dark Ruins
- 큰 보스 Arena, 붕괴 구조, 강한 depth/focal lighting 참고.
- 현대 한국 배경으로 직접 재해석.

### Electric Dreams
- PCG와 Soundscape, puddle/fluid, procedural clutter 학습용.
- 전체 샘플을 모바일 빌드에 통째로 넣지 않는다.

### Valley of the Ancient
- 보스 중심 짧은 플레이 흐름.
- Data Layers/World Partition/Chaos/Control Rig/Motion Warping 참고.
- Ancient One 비주얼을 복제하지 않는다.

### Content Examples
- Chaos, Niagara, Control Rig, Blueprint 기능을 작은 단위로 검증.

## Arena 제작 순서

1. 소설 원문에서 공간의 기능/크기/상태를 추출.
2. 1m/2m/4m primitive로 graybox.
3. Boss charge/spin/slam 범위를 먼저 검증.
4. 카메라 readability 검증.
5. Data Layers로 Phase 상태 분리.
6. 무료 샘플에서 필요한 메시/머티리얼만 이전.
7. 한국/황혼 고유 Props 추가.
8. Chaos/Sequencer event 추가.
9. PCG clutter를 마지막에 추가.
10. Cinematic camera와 Gameplay camera를 같은 world에서 검증.

## Data Layer 템플릿

- DL_Arena_Base
- DL_Story_PreBattle
- DL_Phase1
- DL_Phase2_Damaged
- DL_Phase3_Critical
- DL_Aftermath
- DL_Cinematic

Phase 전환은 반드시 스토리/보스 패턴에 이유가 있어야 한다.

## Performance 원칙

고퀄 샘플은 학습/소스다. Shipping 기준이 아니다.

모바일/중간사양:
- 불필요 Nanite/Lumen 의존 금지
- 작은 Props는 HISM/ISM/PCG 인스턴싱
- 실시간 Chaos 파괴 수 제한
- 큰 붕괴는 Cache/Sequencer
- 투명/볼류메트릭 FX 과다 금지
- light count와 shadow caster 통제

## 게임/애니 공용화

Scene 하나의 world를 공유한다.

- Gameplay: 플레이어 카메라/보스 AI/인터랙션
- Cinematic: Sequencer 카메라/연기/조명 강화

공용:
- Environment
- Rig/Character
- Boss
- Props
- VFX
- Audio
- Dialogue

## 첫 번째 환경 QA

아트가 없어도 아래가 먼저 PASS해야 한다.

- 플레이어와 보스 실루엣이 배경에서 분리됨
- 보스 charge lane을 읽을 수 있음
- 모든 Phase에서 이동공간 충분
- 카메라가 벽을 과도하게 뚫지 않음
- boss/part lock-on이 환경물에 가려지지 않음
- Story Entry/Death camera 위치 확보
- Phase destruction 후 nav/arena collision 깨지지 않음
