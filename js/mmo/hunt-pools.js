/* 사냥터 ↔ 감염체 (문서 208) — «(가안)» 사냥터에 캐논(js/mmo/monster-catalog.js) 종을 앉힌다.
   규칙: 지역 성향(지역 기본 + 사냥터 이름에서 읽은 것 ×2)이 겹치는 종 중에서
   · 흔한 종 = 5급 · OpenWorld — 2종(레벨 15 이하, 보행자 포함) 또는 3종
   · 드문 종 = 레벨 20 부터 4급 1종, 45 부터 3급 1종 더 — OpenWorldRare
   · 2급·1급·특급은 무작위 풀에 넣지 않는다 (레이드·월드 보스 · 지배형은 따로 놓는다 — 문서 204)
   같은 입력이면 늘 같은 답(이름으로 만든 해시로 흔든다). 이야기 속 이름(쇼윈도 리퍼·탈영병 …)은 건드리지 않는다. */
import { CATALOG } from './monster-catalog.js';

export const ZONE_REGIONS = {
  gangnam: ['Urban'], namsan: ['Mountain', 'Urban'], yeouido: ['Urban', 'Riverside'], namtae: ['Urban', 'Mountain'], pangyo: ['Urban', 'Industrial'],
  southroad: ['Industrial', 'Mountain'], gyeryong: ['Mountain', 'Industrial'], goheung: ['Industrial', 'Port'], daejeon: ['Urban'], busan: ['Port', 'Urban'],
  haeundae: ['Port', 'Urban'], gyeongpo: ['Port', 'Riverside'], jeonju: ['Urban'], jeju: ['Urban', 'Port'], suwon: ['Urban'], chuncheon: ['Riverside', 'Mountain'],
  sokcho: ['Port', 'Mountain'], gyeongju: ['Urban', 'Mountain'], yeosu: ['Port', 'Urban'], mokpo: ['Port', 'Mountain'], seogwipo: ['Port', 'Urban'],
};
const NAME_TAGS = [[/해수욕장|해변|항구|부두|포구|갯/, 'Port'], [/숲|능선|비탈|오름|골짜기|산\b/, 'Mountain'], [/강|호 터|호수|천 /, 'Riverside'],
  [/창고|정비|공단|연구|발사|조립/, 'Industrial'], [/지하|터널|승강장/, 'Underground']];
export const DRAFT = /\(가안\)/;

export function regionsOf(zoneId, hunt) {
  const w = new Map(); for (const t of ZONE_REGIONS[zoneId] || ['Urban']) w.set(t, 1);
  for (const [re, t] of NAME_TAGS) if (re.test(hunt.name || '')) w.set(t, (w.get(t) || 0) + 2);
  return w;
}
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function pick(cands, w, n, key, must = []) {
  const score = m => m.regions.reduce((a, r) => a + (w.get(r) || 0), 0), jit = m => score(m) + (hash(key + m.id) % 1000) / 1000 * 1.5;   /* 흔들기 ≤1.5: 지역이 반만 맞는 종도 가끔 이긴다 — 항구가 다 포획자·갈고리손이 되지 않게. 이름이 맞는 종(+2)은 그대로 이긴다 */
  const list = cands.filter(m => score(m) > 0 && !must.includes(m.id)).sort((a, b) => jit(b) - jit(a));
  return [...must, ...list.map(m => m.id)].slice(0, n);
}
export function poolFor(zoneId, hunt, catalog = CATALOG) {
  const w = regionsOf(zoneId, hunt), lv = hunt.lv || [1, 1], key = zoneId + ':' + hunt.id + ':';
  const g = (grade, ctx) => catalog.filter(m => m.grade === grade && m.contexts.includes(ctx));
  const common = pick(g(5, 'OpenWorld'), w, lv[1] <= 15 ? 2 : 3, key, lv[1] <= 15 ? ['G5_WALKER'] : []);
  const rare = [...(lv[0] >= 20 ? pick(g(4, 'OpenWorldRare'), w, 1, key) : []), ...(lv[0] >= 45 ? pick(g(3, 'OpenWorldRare'), w, 1, key) : [])];
  return { common, rare, regions: [...w.keys()] };
}
export function labelOf(pool, catalog = CATALOG) {
  const name = id => (catalog.find(m => m.id === id) || {}).name || id;
  return pool.common.map(name).join(' · ') + (pool.rare.length ? ' · 드물게 ' + pool.rare.map(name).join('·') : '');
}
/* 지역 표의 hunt 하나 → { mobs, pool } (가안 아닌 이름은 그대로, pool 없음). «2급 지배형 · » 같은 앞머리는 남긴다 */
export function huntMobs(zoneId, hunt, catalog = CATALOG) {
  const mobs = hunt.mobs || '';
  if ((hunt.kind || 'hunt') !== 'hunt' || !(DRAFT.test(mobs) || !mobs)) return { mobs };
  const pool = poolFor(zoneId, hunt, catalog), head = (/^(2급 지배형 · )/.exec(mobs) || [''])[0];
  return { mobs: head + labelOf(pool, catalog), pool };
}

/* 생태 자리 (문서 208 §3 · GPT v09 Nest/Patrol) — 사냥터마다 둥지 3곳(작은 군락)과 순찰 고리 4점.
   자리만 깐다: 리스폰·낮밤 교체·침공 전환 같은 «살아 움직이는 층» 은 서버(GPT) 몫. ok(x,z) = 걸을 수 있고 막이·쉼터 밖인가 (굽기·patch-areas 가 준다).
   길 좌표(s,t)에서 고르고 월드로 돌린다 — 사냥터 정의가 길 좌표라서. 같은 입력이면 같은 자리 */
export function ecologyOf(zoneId, hunt, ang, ok = () => true) {
  if ((hunt.kind || 'hunt') !== 'hunt') return null;
  if (hunt.r && hunt.st) {   /* 원형 사냥터(강남역 사거리 등): 둘레 네모에서 고르고 원 안만 */
    const [cs, ct] = hunt.st, r = hunt.r, ca = Math.cos(ang), sa = Math.sin(ang), cx = cs * ca - ct * sa, cz = -cs * sa - ct * ca;
    return ecologyOf(zoneId, { ...hunt, r: 0, s: [cs - r * .8, cs + r * .8], t: [ct - r * .8, ct + r * .8] }, ang, (x, z) => Math.hypot(x - cx, z - cz) <= r * 0.95 && ok(x, z)); }
  if (!hunt.s || !hunt.t) return null;
  const FR = (s, t) => [+(s * Math.cos(ang) - t * Math.sin(ang)).toFixed(2), +(-s * Math.sin(ang) - t * Math.cos(ang)).toFixed(2)];
  let seed = hash(zoneId + ':' + hunt.id + ':eco'); const rnd = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) ^ Math.imul(seed ^ (seed >>> 13), 3266489909)) >>> 0) / 4294967296;
  const [s0, s1] = [Math.min(...hunt.s), Math.max(...hunt.s)], [t0, t1] = [Math.min(...hunt.t), Math.max(...hunt.t)], at = (u, v) => FR(s0 + (s1 - s0) * u, t0 + (t1 - t0) * v);
  const nests = [], minGap = Math.max(8, Math.min(s1 - s0, t1 - t0) * 0.25);
  for (let i = 0; i < 80 && nests.length < 3; i++) { const p = at(0.1 + rnd() * 0.8, 0.1 + rnd() * 0.8); if (ok(p[0], p[1]) && nests.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) >= minGap)) nests.push(p); }
  /* 순찰: 사냥터 안쪽 고리(0.2~0.8 사각) 네 모서리에서 가장 가까운 걸을 수 있는 점 */
  const patrol = [];
  for (const [u, v] of [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]]) { let got = null;
    for (let k = 0; k < 24 && !got; k++) { const r = k * 0.02, a = k * 2.4, p = at(Math.min(.95, Math.max(.05, u + Math.cos(a) * r)), Math.min(.95, Math.max(.05, v + Math.sin(a) * r))); if (ok(p[0], p[1])) got = p; }
    if (got) patrol.push(got); }
  return { nests, patrol: patrol.length >= 3 ? patrol : [] };
}
