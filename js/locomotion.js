/* 달리기 배속 — 상수로 박지 않고 «클립에서 역산» 한다.
   제자리 클립이라 지면 속도 = 보폭 × 두 걸음 × 초당 사이클. 이게 이동 속도와 같아야
   발이 땅을 딛는 것처럼 보인다. 상수로 두면 캐릭터마다 다리 길이가 달라 어긋난다
   (아인 1.18 m · 카인 1.31 m — 같은 1.62 배속이면 카인은 5.11 m/s 로 «앞질러» 간다).
   docs/design/54-locomotion.md */
export const RUN_RATE_MIN = 0.80, RUN_RATE_MAX = 2.20;

export function runRate(stride, duration, speed){
  if(!(stride > 0.05) || !(duration > 0.01)) return 1;
  var r = speed * duration / (2 * stride);
  return Math.max(RUN_RATE_MIN, Math.min(RUN_RATE_MAX, r));
}

/* 지면 속도 — 검수·시험이 같은 식을 쓰도록 여기에 둔다 */
export function groundSpeed(stride, duration, rate){
  return stride * 2 * (rate / duration);
}
