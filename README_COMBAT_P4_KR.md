# 황혼 v12 — P4 기본공격 연계 이음매

## 문제
시뮬레이션은 버퍼된 다음 공격을 이전 `actionend`와 같은 tick에 시작할 수 있다.
화면은 그 이벤트를 순서대로 받아 예전에는:

`attack1 끝 → idle/run fadeIn → attack2 시작`

을 아주 짧게 거쳤다.

이 틈은 수십 ms라도 1→2→3타를 하나의 봉술 연계가 아니라 세 개의 독립 공격처럼 보이게 만든다.

## 수정
- `actionend`에서 마지막 공격 자세를 20ms 유지.
- 같은 tick/직후 `actionstart`가 오면 예약된 base 복귀를 취소.
- `playOnce()`가 이전 one-shot의 마지막 자세에서 다음 공격으로 직접 cross-fade.
- 후속 공격이 없을 때만 0.12s로 idle/run 복귀.
- `actioncancel`은 기존처럼 즉시 복귀해 회피/방어 반응성을 유지.

## 변경하지 않음
- `combat.js`
- 공격 duration/hitAt/cancel
- 입력 버퍼
- 피해·스태미나

## 실기 검수
공격 버튼을 연속 입력해 1→2→3타를 60fps 슬로모션으로 확인한다.
타 사이에 몸이 정면 idle 자세로 펴졌다 다시 감기면 실패.
