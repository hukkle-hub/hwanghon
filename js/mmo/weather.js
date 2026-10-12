/* 날씨 — 비 (문서 230 §14). 엘든 링 림그레이브의 비 온 뒤 젖은 들판 · 회색 하늘.
   시계는 시간대(daycycle)와 같은 서버 시각 — 같은 필드의 사람은 같은 비를 맞는다. 18 분 칸마다 존 씨앗 해시로 28 % 가 비,
   칸 경계 75 초 동안 서서히 오고 그친다. 그친 뒤 땅은 6 분에 걸쳐 마른다(젖음 wet). 빛 · 색 · 입자만 — 자리 · 막이 · 장면 난수는 그대로.
   아무것도 import 하지 않는다(퍼들 · 땅 셰이더가 WX 를 읽는다). */
export const WX_SLOT = 18 * 60 * 1000, WX_FADE = 75 * 1000, WX_P = 0.28, WX_MIST = 0.14, WX_DRY = 6 * 60 * 1000;   /* 칸마다: 비 28 % · 짙은 안개 14 % · 나머지 맑음 */
export const WX = { uRain: { value: 0 }, uWet: { value: 0 }, uGloss: { value: 0.5 }, uMist: { value: 0 } };   /* 셰이더가 같이 쓰는 값 — world3d 가 매 프레임 */
const ss = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
function hh(a, b) { let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; }
export function zoneSeed(zone) { let s = 7; for (const c of String(zone || '')) s = (Math.imul(s, 31) + c.charCodeAt(0)) | 0; return s; }
export const rainySlot = (seed, k) => hh(seed, k) < WX_P;
export const mistySlot = (seed, k) => { const u = hh(seed, k); return u >= WX_P && u < WX_P + WX_MIST; };
/* 칸 판정 is(seed, k) 의 세기 0~1 — 칸 경계 75 초에 걸쳐 앞뒤 칸과 섞는다 */
function slotK(is, seed, ms) { const k = Math.floor(ms / WX_SLOT), u = ms - k * WX_SLOT, cur = is(seed, k) ? 1 : 0;
  if (u < WX_FADE) { const p = is(seed, k - 1) ? 1 : 0; return p + (cur - p) * ss(0.5 + u / (2 * WX_FADE)); }
  if (WX_SLOT - u < WX_FADE) { const n = is(seed, k + 1) ? 1 : 0; return cur + (n - cur) * ss(0.5 - (WX_SLOT - u) / (2 * WX_FADE)); }
  return cur; }
/* 비 세기 0~1 */
export const rainAt = (seed, ms) => slotK(rainySlot, seed, ms);
/* 짙은 안개 0~1 — 엘든 림그레이브 아침 안개: 땅에 깔린 하얀 안개 사이로 빛줄기 */
export const mistAt = (seed, ms) => slotK(mistySlot, seed, ms);
/* 땅 젖음 0~1 — 비가 오면 비 세기, 그치면 마지막 비 칸 끝에서부터 마른다 */
export function wetAt(seed, ms) { const r = rainAt(seed, ms), k = Math.floor(ms / WX_SLOT); let dry = 0;
  for (let j = 0; j <= 1; j++) if (rainySlot(seed, k - j) && !(j === 0)) { dry = Math.exp(-Math.max(0, ms - (k - j + 1) * WX_SLOT) / WX_DRY * 3); break; }
  return Math.max(r, dry); }
/* ?wx=rain|clear|wet — 견주기 · 촬영용 덮어쓰기 */
export function weatherNow(seed, ms, force) { if (force === 'rain') return { rain: 1, wet: 1, mist: 0 }; if (force === 'clear') return { rain: 0, wet: 0, mist: 0 }; if (force === 'wet') return { rain: 0, wet: 1, mist: 0 }; if (force === 'mist' || force === 'fog') return { rain: 0, wet: 0.35, mist: 1 };
  const mist = mistAt(seed, ms); return { rain: rainAt(seed, ms), wet: Math.max(wetAt(seed, ms), 0.35 * mist), mist }; }   /* 안개 낀 땅은 이슬로 조금 젖는다 */
/* 짙은 안개: 하늘 · 안개는 밝은 잿빛 쪽으로(안개는 빛을 흩어 밝다), 해는 반쯤 가려지고 반구광이 오른다 — 대비가 낮은 부드러운 빛 */
export function applyMist(o, m) { if (!(m > 0.001)) return o;
  for (const c of [o.top, o.hor, o.fog]) { const l = c.r * 0.299 + c.g * 0.587 + c.b * 0.114, t = Math.min(1, l * 1.35 + 0.04); c.r += (t - c.r) * 0.55 * m; c.g += (t - c.g) * 0.55 * m; c.b += (t * 1.03 - c.b) * 0.55 * m; }
  o.sunI *= 1 - 0.45 * m; o.hemiI *= 1 + 0.2 * m; return o; }
/* 시간대 결과(daycycle out)에 비를 얹는다: 하늘 · 안개 · 반구광은 잿빛으로, 해는 구름 뒤로(세기 · 둘레 빛 ↓), 그늘진 낮은 반구광을 조금 올린다 */
export function applyRain(o, r) { if (!(r > 0.001)) return o;
  for (const c of [o.top, o.hor, o.fog, o.hemi]) { const l = c.r * 0.299 + c.g * 0.587 + c.b * 0.114; c.r += (l - c.r) * 0.6 * r; c.g += (l - c.g) * 0.6 * r; c.b += (l * 1.06 - c.b) * 0.6 * r; }
  for (const c of [o.top, o.hor, o.fog]) c.multiplyScalar(1 - 0.22 * r);
  o.sunI *= 1 - 0.75 * r; o.glow *= 1 - 0.85 * r; o.hemiI *= 1 + 0.12 * r; o.exp *= 1 - 0.04 * r; return o; }
