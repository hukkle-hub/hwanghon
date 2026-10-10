/* 준비 동작 (문서 224) — 디렉터: «게임내 예고를 알리는 표시같은 건 다 지워. 의미 없어. 다만 그 스킬을 쓸때 준비 동작을 넣어줘».
   바닥 예고 대신 보스 «몸» 이 기술을 알린다: 판정 전까지 웅크리거나 비틀어 감거나 젖혔다가, 판정 순간 앞으로 터진다.
   클립 위에 얹는다 — 뿌리(root)와 몸(model) 사이에 틀(WindRig) 하나를 끼워 그 틀만 움직이므로 각 모듈이 몸에 하는 일과 안 부딪힌다.
   시각은 서버 시계(기술 시작부터 ms) — 헤드리스·느린 기기에서도 박자가 같다. */

/* 모양: 감기(가로 베기) · 웅크림(돌진·찌르기) · 젖힘(내려찍기·광역) · 버팀(그 밖) */
export const STYLES = {
  coil:   { crouch: .045, lean: -.08, twist: .42, relLean: .16, relTwist: -.2, relPush: .05 },
  crouch: { crouch: .10, lean: .2, twist: 0, relLean: .1, relTwist: 0, relPush: .16 },
  rear:   { crouch: .03, lean: -.24, twist: .08, relLean: .3, relTwist: 0, relPush: .06 },
  brace:  { crouch: .06, lean: -.1, twist: .12, relLean: .16, relTwist: -.06, relPush: .06 },
  none:   { crouch: 0, lean: 0, twist: 0, relLean: 0, relTwist: 0, relPush: 0 },
};
const REL = 180;   /* 터짐 길이(ms) */
const ease = t => t * t * (3 - 2 * t);

export function addWindRig(THREE, o) {
  if (!o.model || !o.model.parent || o.wind) return o.wind;
  const g = new THREE.Group(); g.name = 'WindRig'; const p = o.model.parent; p.add(g); g.add(o.model);
  o.wind = { g, h: o.h || 2, seed: Math.random() * 100 }; return o.wind;
}
/* 창 목록([{from, at, style}]) 과 기술 경과 t(ms) → 지금 준비(p 0~1) 또는 터짐(r 0~1) */
export function windAt(wins, t) {
  for (const w of wins) { if (t >= w.from && t < w.at) { const span = Math.max(1, w.at - w.from); return { w, p: ease(Math.min(1, (t - w.from) / (span * .85))), r: -1 }; }
    if (t >= w.at && t < w.at + REL) return { w, p: 1, r: (t - w.at) / REL }; }
  return null;
}
/* 틀에 얹는다. reduced: 떨림 없음 */
export function applyWind(o, wins, t, reduced = false) {
  const W = o.wind; if (!W) return null; const g = W.g, s = wins && windAt(wins, t);
  g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); if (!s) return null;
  const st = STYLES[s.w.style] || STYLES.brace, h = W.h, k = s.p;
  if (s.r < 0) {   /* 준비: 웅크림·젖힘/숙임·비틀어 감기 + 끝무렵 떨림 */
    g.position.y = -st.crouch * h * k; g.rotation.x = st.lean * k; g.rotation.y = st.twist * k;
    if (!reduced && k > .8) { const j = (k - .8) * 5; g.position.x = Math.sin(t * .09 + W.seed) * .006 * h * j; g.rotation.z = Math.sin(t * .11 + W.seed) * .012 * j; }
  } else {   /* 터짐: 앞으로 쏟아졌다 제자리로 */
    const e = 1 - s.r, f = Math.sin(Math.PI * Math.min(1, s.r * 1.4)) * e;
    g.position.y = -st.crouch * h * e * e; g.rotation.x = st.lean * e * e + st.relLean * f; g.rotation.y = st.twist * e * e + st.relTwist * f; g.position.z = st.relPush * h * f;
  }
  return s;
}
