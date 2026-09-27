# 황혼 v12 — P6 로컬 전투 감사

## 목적
P0~P5가 실제 화면에서 먹혔는지를 감으로 보지 않고 같은 20초 전투를 데이터와 함께 검수한다.

## 실행
로컬에서:

`game3d.html?d=d01&combatAudit=1`

전투 자체는 평소와 똑같이 사람이 조작한다.
감사 모드는 전투 입력·판정·AI·보상에 개입하지 않는다.

## 실시간 패널
- 현재 clip / elapsed / hitAt
- combo
- boss 거리
- base / one-shot 상태
- P5 `plantSide / plantWeight / plantError`
- P0 boss additive reaction
- FPS / p95
- draw calls

## 이벤트 로그
`actionstart / actionend / actioncancel / hit / impact / counter / damaged / dodge / jump / deflect / break`

## 사용
1. d01 입장 후 `1.3m 정렬`을 눌러 같은 구도.
2. `1타 → 2타 → 3타 → smash → 회피 → 피격 → counter` 약 20초.
3. JSON 저장.
4. 영상과 JSON의 같은 시각을 맞춰 본다.

## P4 검수
`actionend → 다음 actionstart` 사이에 idle/run one-shot이 끼는지 확인.

## P5 검수
접점 주변 `plantError`가 커지는 공격을 찾고 해당 클립만 재작업한다.
