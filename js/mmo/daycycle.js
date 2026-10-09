/* 3D 필드 시간대 (문서 217) — 48분에 한 바퀴: 황혼(지금 모습, 가장 길다) → 밤 → 새벽 → 잿빛 낮 → 황혼.
   시계는 서버 시각(온라인) · 기기 시각(혼자) — 같은 필드의 사람은 같은 하늘을 본다.
   «황혼» 열쇠는 존이 정한 값 그대로(base) — 나머지 열쇠는 절대 색에 존 안개를 30% 섞어 존마다 결을 남긴다.
   빛·색만 바꾼다: 자리·막이·장면 난수는 손대지 않는다. 실내(던전·벙커)는 돌리지 않는다. */
export const DAY_LEN = 48 * 60 * 1000;
export const NAMES = { dusk: '황혼', night: '밤', dawn: '새벽', day: '낮' };
/* [바퀴 위치 0~1, 열쇠] — 같은 열쇠가 이어지면 그동안 머문다 */
export const KEYS = [[0, 'dusk'], [0.26, 'dusk'], [0.34, 'night'], [0.56, 'night'], [0.62, 'dawn'], [0.66, 'dawn'], [0.74, 'day'], [0.92, 'day'], [1, 'dusk']];
/* az: 해 방위(0 = 서쪽, π = 동쪽) · alt: 높이(도) · sunK/hemiK/fillK: 존 기본 세기에 곱 · lampK: 가로등 · exp: 노출 */
export const PAL = {
  night: { top: '#0c0c22', hor: '#24204a', fog: '#1a1830', sun: '#8ea4ff', sunc: '#9aaeff', hemi: '#7078c0', ground: '#1e1a30', az: Math.PI * 0.75, alt: 38, sunK: 0.22, hemiK: 0.5, fillK: 0.75, lampK: 1.9, exp: 1.75, glow: 0.35 },
  dawn: { top: '#3c3c62', hor: '#d0706a', fog: '#5e4a5c', sun: '#ffb494', sunc: '#ffa070', hemi: '#b4a4d4', ground: '#4a3a42', az: Math.PI, alt: 26, sunK: 0.35, hemiK: 0.85, fillK: 0.9, lampK: 0.6, exp: 1.5, glow: 0.45 },
  day: { top: '#56627a', hor: '#a4948e', fog: '#766c76', sun: '#fff0dc', sunc: '#fff4e0', hemi: '#c8c8da', ground: '#5c4c44', az: Math.PI * 0.5, alt: 52, sunK: 0.72, hemiK: 0.85, fillK: 0.6, lampK: 0, exp: 1.0, glow: 0.4 },
};
export const phaseAt = (ms, len = DAY_LEN) => (((ms % len) + len) % len) / len;
const ss = x => x * x * (3 - 2 * x);
/* 바퀴 위치 → 앞뒤 열쇠와 섞는 몫 */
export function keyAt(t) { t = ((t % 1) + 1) % 1;
  for (let i = 0; i < KEYS.length - 1; i++) { const [t0, a] = KEYS[i], [t1, b] = KEYS[i + 1]; if (t >= t0 && t <= t1) { const w = a === b ? 0 : ss((t - t0) / (t1 - t0)); return { a, b, w, name: NAMES[w < 0.5 ? a : b] }; } }
  return { a: 'dusk', b: 'dusk', w: 0, name: NAMES.dusk }; }
/* 이름 → 바퀴 위치(그 열쇠가 머무는 한가운데) */
export function tOf(name) { if (name == null || name === '') return null; const n = Number(name); if (Number.isFinite(n)) return n >= 0 && n < 1 ? n : ((n % 1) + 1) % 1;
  const k = Object.keys(NAMES).find(k => k === name || NAMES[k] === name); if (!k) return null; if (k === 'dusk') return 0.1;
  const i = KEYS.findIndex(([, x], j) => x === k && KEYS[j + 1] && KEYS[j + 1][1] === k); return i < 0 ? null : (KEYS[i][0] + KEYS[i + 1][0]) / 2; }

/* base: 존의 황혼 값 { top, hor, fog, sun, sunc, hemi, ground (THREE.Color) · sunI, hemiI, fillI, exp, alt, westX, westZ } */
export function createDayCycle(THREE, base, apply) {
  const C = {}; for (const k of ['night', 'dawn', 'day']) { const p = PAL[k]; C[k] = {}; for (const c of ['top', 'hor', 'fog', 'sun', 'sunc', 'hemi', 'ground']) C[k][c] = new THREE.Color(p[c]); C[k].fog.lerp(base.fog, 0.3); C[k].hor.lerp(base.hor, 0.15); }
  const D = { ...base, az: 0, sunK: 1, hemiK: 1, fillK: 1, lampK: 1, glow: 1 };
  const get = (k, c) => k === 'dusk' ? D[c] : (c in C[k] ? C[k][c] : PAL[k][c]);
  const out = { top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), sunc: new THREE.Color(), hemi: new THREE.Color(), ground: new THREE.Color(), dir: new THREE.Vector3() };
  const st = { t: 0, name: NAMES.dusk, fixed: null };
  function at(t) { const { a, b, w, name } = keyAt(t); st.t = t; st.name = name;
    for (const c of ['top', 'hor', 'fog', 'sun', 'sunc', 'hemi', 'ground']) out[c].copy(get(a, c)).lerp(get(b, c), w);
    const mix = c => get(a, c) + (get(b, c) - get(a, c)) * w;
    out.sunI = base.sunI * mix('sunK'); out.hemiI = base.hemiI * mix('hemiK'); out.fillI = base.fillI * mix('fillK'); out.lampK = mix('lampK'); out.exp = mix('exp'); out.glow = mix('glow');
    const az = mix('az'), alt = mix('alt') * Math.PI / 180, ca = Math.cos(az), sa = Math.sin(az);   /* 서쪽 벡터를 위축(y)으로 az 만큼 돌린다 */
    out.dir.set(base.westX * ca - base.westZ * sa, 0, base.westX * sa + base.westZ * ca).normalize().multiplyScalar(Math.cos(alt)); out.dir.y = Math.sin(alt);
    out.name = name; out.t = t; apply(out); return out; }
  return { at, get state() { return st; }, set fixed(v) { st.fixed = v; }, get fixed() { return st.fixed },
    update(ms) { return at(st.fixed != null ? st.fixed : phaseAt(ms)); } };
}
