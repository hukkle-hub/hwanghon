/* 검은 화면 판정 — «아무것도 안 그려졌나» 를 한 함수로 모아 둔다.
   두 번이나 오탐으로 앱이 스스로 재시작했기에(디렉터 보고: 「들어가면 밖으로 나갔다가 다시 시작」)
   규칙을 게임 루프에서 떼어 내 시험으로 못박는다. docs/design/52-restart-bug.md

   samples: 화면 네 곳에서 읽은 [최소휘도, 최대휘도] 네 쌍 (0~255).
   · 패치 «안» 이 고르다  → 그 패치는 평평한 면 하나로 차 있다 (어두운 벽도 여기 걸린다)
   · 패치 «끼리» 도 같다  → 화면 전체가 한 색이다 = 그려진 게 없다
   두 조건을 다 만족해야 «빈 프레임» 이다. 어둡기는 보지 않는다 —
   배경색만 남는 실패(밝은 회색일 수도 있다)도 같은 규칙으로 잡히기 때문이다. */
export const BW_FLAT = 3;      /* 한 패치 안 허용 편차 */
export const BW_SPREAD = 4;    /* 네 패치를 통틀어 허용 편차 */

export function bwEmpty(samples, flat, spread){
  if(!samples || samples.length < 2) return false;
  var f = flat == null ? BW_FLAT : flat, s = spread == null ? BW_SPREAD : spread;
  var lo = Infinity, hi = -Infinity;
  for(var i=0;i<samples.length;i++){
    var mn = samples[i][0], mx = samples[i][1];
    if(mx - mn >= f) return false;
    if(mn < lo) lo = mn;
    if(mx > hi) hi = mx;
  }
  return hi - lo < s;
}
