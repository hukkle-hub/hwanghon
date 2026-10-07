// 지역 찍어 내기 — 좌표 하나로 필드 하나 (docs/design/192 §2.5, §7)
//   node tools/2d/new-zone.mjs <지역 id…>          (js/mmo/regions.js 의 id)
//   1) OSM 원본이 없으면 받는다 (osm-fetch, 1.4 km 네모)  2) osm-extract AXIS=auto — 원점 둘레 가장 큰 길이 축
//   3) 땅을 5 m 격자로 나눠 물·건물·숲·모래·풀을 센다 (게임이 그리는 것과 같은 규칙: 해안선 오른쪽 = 바다, 강은 폭)
//   4) 걷는 띠(400 × 240 m)를 «물이 없고, 길이 가운데쯤, 카메라 쪽으로 넓게» 고른다. 해안이면 바다를 먼 쪽(화면 위)에
//   5) 띠를 셋으로 나눠 하위 구역 — 이름은 그 안의 OSM 공원·해변·숲 이름, 없으면 큰길 이름 + 땅 종류. 거점은 가운데가 마을(안전)
//   6) js/mmo/zones-auto.js 에 쓴다 → 굽기: node tools/2d/bake-map.mjs <id> (뒤처리: recompress-webp · repack-depth · tile-hashes · bake-overview)
// 손으로 고칠 게 있으면 zones-auto.js 가 아니라 원작 지역처럼 zones.js 로 옮겨 다듬는다(같은 id 면 zones.js 가 이긴다).
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { REGIONS, levelOf } from '../../js/mmo/regions.js';
const OSM_CACHE = process.env.OSM_CACHE || '/tmp/hwanghon-osm', AUTO_F = 'js/mmo/zones-auto.js', PENDING_F = 'js/mmo/zones-pending.js';
/* PENDING=1 — 만들기만 하고 굽기 전: 게임이 읽지 않는 zones-pending.js 에 쓴다(전국 지도에 «갈 수 있는 곳» 으로 뜨지 않게, 시험이 «안 구운 지역» 으로 깨지지 않게).
   굽기 직전에 --promote <id…> 로 zones-auto.js 로 옮긴다 */
const OUT = process.env.PENDING ? PENDING_F : AUTO_F;
const SCREEN_ANG = 28 * Math.PI / 180, DIR = [Math.cos(SCREEN_ANG), -Math.sin(SCREEN_ANG)], SIDE = [-Math.sin(SCREEN_ANG), -Math.cos(SCREEN_ANG)];
const ST = ([x, z]) => [x * DIR[0] + z * DIR[1], x * SIDE[0] + z * SIDE[1]], FROM = (s, t) => [s * DIR[0] + t * SIDE[0], s * DIR[1] + t * SIDE[1]];
const rotP = r => { const c = Math.cos(r), s = Math.sin(r); return ([x, z]) => [x * c - z * s, x * s + z * c]; };
const inPoly = ([x, z], P) => { let o = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) o = !o; } return o; };
const bbox = P => P.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [1e9, 1e9, -1e9, -1e9]);
const area = P => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
const segD = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)); return Math.hypot(p[0] - a[0] - dx * u, p[1] - a[1] - dz * u); };
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 90000 + 10000;

/* 땅 종류별 꾸미기·몬스터 계열 (가안 — 몬스터 표가 생기면 바꾼다) */
const LOOK = {
  city: { ground: 'paver', dress: { urban: true, logs: false, patches: ['concrete', 'sand', 'asphalt'] }, trees: { density: 0.3, inBand: 0.08, pine: 0.1 }, boundary: 'urban', ruin: [5, 11] },
  coast: { ground: 'paver', dress: { urban: true, logs: false, patches: ['sand', 'concrete', 'grass'] }, trees: { density: 0.4, inBand: 0.08, pine: 0.7 }, boundary: 'urban', ruin: [4.5, 9] },
  mountain: { ground: 'forest', dress: { patches: ['forest', 'sand', 'grass'] }, trees: { density: 0.85, inBand: 0.15, pine: 0.7 }, boundary: 'fence', ruin: [4.5, 8] },
  rural: { ground: 'grass', dress: { patches: ['grass', 'sand', 'forest'] }, trees: { density: 0.6, inBand: 0.12, pine: 0.4 }, boundary: 'fence', ruin: [4.5, 8] },
};
const lookOf = r => LOOK[{ hub: 'city', city: 'city', historic: 'city', industrial: 'city', coast: 'coast', island: 'coast', mountain: 'mountain', river: 'rural', rural: 'rural' }[r.kind] || 'city'];
const CLASS_NAME = { street: '폐허 거리', beach: '모래사장', forest: '숲 가장자리', park: '공원 터', city: '무너진 상가', open: '빈터', water: '물가' };
const MOBS = { street: '감염체 무리 (가안)', beach: '갯가 감염체 (가안)', forest: '탈영병 (가안)', park: '광장의 감염체 (가안)', city: '감염체 무리 (가안)', open: '들개 무리 (가안)', water: '갯가 감염체 (가안)' };

/* 빈 블록 채우기 — 지방 도시는 OSM 건물이 드물다(대전역 둘레 1.4 km 에 143채). 실측 건물이 20 m 안에 없는 길가에만
   낮은 건물(2~5층)을 길과 나란히 세운다. 길·물·철길·공원·숲 위에는 세우지 않는다. 표시 gen: true (MSFS 의 «윤곽 없는 곳은 절차 생성» 과 같은 생각) */
function fillBlocks(osm, seed) { let x = seed >>> 0; const R = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
  const HW = { trunk: 11, primary: 10, secondary: 8, tertiary: 6.5, unclassified: 4.5, residential: 4, living_street: 3, service: 3, pedestrian: 4 };
  const roads = osm.roads.filter(r => !r.tunnel && !r.area && (HW[r.kind.replace('_link', '')] || /footway|path|steps|cycleway/.test(r.kind))).map(r => ({ line: r.line, hw: r.width ? r.width / 2 : r.lanes ? r.lanes * 1.75 + 1 : HW[r.kind.replace('_link', '')] || 1.2, front: !!HW[r.kind.replace('_link', '')] && r.kind !== 'service' }));
  const no = [...osm.areas.filter(a => /water|basin|reservoir|riverbank|park|grass|wood|forest|scrub|beach|sand|pitch|garden|parking|railway|cemetery|military|construction|man:|aero:/.test(a.kind)).map(a => ({ poly: a.poly, bb: bbox(a.poly) }))];
  const lines = osm.lines.filter(l => !l.tunnel).map(l => ({ line: l.line, hw: /^rail/.test(l.kind) ? 5 : l.kind === 'coastline' ? 6 : (l.width || 10) / 2 + 2 }));
  const CELL = 40, hashB = new Map(), key = (a, b) => a + ',' + b, add = (bb, v) => { for (let i = Math.floor(bb[0] / CELL); i <= Math.floor(bb[2] / CELL); i++) for (let j = Math.floor(bb[1] / CELL); j <= Math.floor(bb[3] / CELL); j++) { const k = key(i, j); if (!hashB.has(k)) hashB.set(k, []); hashB.get(k).push(v); } };
  const near = (bb, pad) => { const out = new Set(); for (let i = Math.floor((bb[0] - pad) / CELL); i <= Math.floor((bb[2] + pad) / CELL); i++) for (let j = Math.floor((bb[1] - pad) / CELL); j <= Math.floor((bb[3] + pad) / CELL); j++) for (const v of hashB.get(key(i, j)) || []) out.add(v); return out; };
  for (const b of osm.buildings) { const bb = bbox(b.poly); add(bb, { bb, real: true }); }
  const clearOf = (p, list) => list.every(r => r.line.every((q, i) => !i || segD(p, r.line[i - 1], q) > r.hw + 1.2));
  let n = 0;
  for (const r of roads) { if (!r.front) continue; const g = r.line;
    for (let i = 1; i < g.length; i++) { const a = g[i - 1], b = g[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 8) continue; const ux = dx / L, uz = dz / L;
      for (const side of [-1, 1]) for (let d = 4 + R() * 6; d < L - 4; d += 0) { const w = 8 + R() * 10, dep = 8 + R() * 9, set = r.hw + 2 + R() * 2.5, cd = d + w / 2;
        const cx = a[0] + ux * cd - uz * side * (set + dep / 2), cz = a[1] + uz * cd + ux * side * (set + dep / 2); d += w + 1.5 + R() * 4;
        if (Math.abs(cx) > 660 || Math.abs(cz) > 660) continue;
        const poly = [[-w / 2, -dep / 2], [w / 2, -dep / 2], [w / 2, dep / 2], [-w / 2, dep / 2]].map(([u, v]) => [+(cx + ux * u - uz * side * v).toFixed(2), +(cz + uz * u + ux * side * v).toFixed(2)]), bb = bbox(poly);
        const hits = near(bb, 20); if ([...hits].some(h => h.real || (bb[0] < h.bb[2] + 1.5 && bb[2] > h.bb[0] - 1.5 && bb[1] < h.bb[3] + 1.5 && bb[3] > h.bb[1] - 1.5))) continue;
        const pts = [[cx, cz], ...poly]; if (!pts.every(p => clearOf(p, roads) && clearOf(p, lines))) continue;
        if (no.some(o => pts.some(p => p[0] >= o.bb[0] && p[0] <= o.bb[2] && p[1] >= o.bb[1] && p[1] <= o.bb[3] && inPoly(p, o.poly)))) continue;
        osm.buildings.push({ id: 9e9 + n, poly: [...poly, poly[0]], height: null, levels: 2 + Math.floor(R() * 4), kind: 'yes', name: null, under: false, gen: true }); add(bb, { bb, real: false }); n++; } } }
  return n; }

function plan(region) {
  const id = region.id, src = path.join(OSM_CACHE, id);
  if (!fs.existsSync(src) || !fs.readdirSync(src).some(f => f.startsWith('osm-r'))) {
    const dl = 700 / 110540, dn = 700 / (111320 * Math.cos(region.lat * Math.PI / 180));
    execFileSync('node', ['tools/2d/osm-fetch.mjs', src, (region.lat - dl).toFixed(5), (region.lat + dl).toFixed(5), (region.lon - dn).toFixed(5), (region.lon + dn).toFixed(5), '2'], { stdio: 'inherit' }); }
  console.log(execFileSync('node', ['tools/2d/osm-extract.mjs', src, id], { env: { ...process.env, ORIGIN: region.lat + ',' + region.lon, AXIS: region.axis || 'auto', SNAP: '1' } }).toString().trim().split('\n').slice(0, 3).join('\n'));
  const osm = JSON.parse(fs.readFileSync(path.join('maps', '2d', id, 'osm.json'), 'utf8'));
  if (lookOf(region).dress.urban) { const n = fillBlocks(osm, hash(id)); fs.writeFileSync(path.join('maps', '2d', id, 'osm.json'), JSON.stringify(osm)); console.log('빈 블록 채움', n, '채 (실측', osm.buildings.length - n, '채)'); }

  /* 물: 물 다각형 · 강 띠 · 해안선 오른쪽 2 km (env-lib lines 와 같은 규칙) */
  const water = osm.areas.filter(a => /^water$|reservoir|basin|riverbank/.test(a.kind)).map(a => a.poly), rivers = [];
  for (const l of osm.lines) { if (l.tunnel || l.layer < 0) continue;
    if (l.kind === 'coastline') { const a0 = l.line[0], a1 = l.line.at(-1), dx = a1[0] - a0[0], dz = a1[1] - a0[1], L0 = Math.hypot(dx, dz) || 1, rx = -dz / L0 * 2000, rz = dx / L0 * 2000;
      /* OSM 좌표는 z 가 남쪽 + 라서 env-lib 의 «오른쪽» 과 같은 식을 그대로 쓴다 */ water.push([...l.line, [a1[0] + rx, a1[1] + rz], [a0[0] + rx, a0[1] + rz]]); }
    else if (/^water:(river|canal|stream|ditch|drain)/.test(l.kind)) { const w = l.width || (/river|canal/.test(l.kind) ? 18 : 3); if (w > 4) rivers.push({ line: l.line, w: w / 2 }); } }
  const P = (list, kind) => list.map(poly => ({ poly, bb: bbox(poly), kind }));
  const polys = [...P(water, 'water'), ...P(osm.buildings.filter(b => !b.under && area(b.poly) > 2500).map(b => b.poly), 'big'), ...P(osm.buildings.filter(b => !b.under && area(b.poly) <= 2500).map(b => b.poly), 'city'),
    ...P(osm.areas.filter(a => /wood|forest|military|scrub/.test(a.kind)).map(a => a.poly), 'forest'), ...P(osm.areas.filter(a => /beach|sand/.test(a.kind)).map(a => a.poly), 'beach'),
    ...P(osm.areas.filter(a => /park|grass|meadow|garden|pitch|village_green|recreation|golf|farmland|orchard/.test(a.kind)).map(a => a.poly), 'park')];
  const ORDER = ['water', 'big', 'city', 'beach', 'forest', 'park'];
  const classify = p => { for (const k of ORDER) { if (k === 'water' && rivers.some(r => r.line.some((q, i) => i && segD(p, r.line[i - 1], q) < r.w))) return 'water';
      for (const o of polys) if (o.kind === k && p[0] >= o.bb[0] && p[0] <= o.bb[2] && p[1] >= o.bb[1] && p[1] <= o.bb[3] && inPoly(p, o.poly)) return k; } return 'open'; };

  /* 먼 쪽: 해안이면 바다 쪽, 아니면 기본(남쪽) — frameOf 의 두 후보 중 그 점이 t > 0 이 되는 쪽 */
  let far = [0, 1];
  { const sea = []; for (let x = -600; x <= 600; x += 40) for (let z = -600; z <= 600; z += 40) if (classify([x, z]) === 'water') sea.push([x, z]);
    if (sea.length > 20) far = [sea.reduce((a, p) => a + p[0], 0) / sea.length, sea.reduce((a, p) => a + p[1], 0) / sea.length]; }
  let rot = 0; for (const cand of [-SCREEN_ANG - osm.axis, Math.PI - SCREEN_ANG - osm.axis]) { const w = rotP(cand)(far); if (w[0] * SIDE[0] + w[1] * SIDE[1] > 0) { rot = cand; break; } }
  const toOsm = rotP(-rot), G = 5, R0 = 380, N = R0 * 2 / G + 1, grid = new Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) grid[i * N + j] = classify(toOsm(FROM(-R0 + i * G, -R0 + j * G)));
  const cls = (s, t) => grid[Math.round((s + R0) / G) * N + Math.round((t + R0) / G)];
  const stats = (s0, s1, t0, t1) => { const c = { water: 0, big: 0, city: 0, beach: 0, forest: 0, park: 0, open: 0 }; let n = 0; for (let s = s0; s <= s1; s += G) for (let t = t0; t <= t1; t += G) { c[cls(s, t)]++; n++; } for (const k in c) c[k] /= n; c.city += c.big; return c; };

  /* 걷는 띠: 400 × 240 m. 물 0 에 가깝게, 길(t=0)을 품고, 카메라 쪽으로 — 해안은 띠 바로 위(먼 쪽)에 바다가 보이면 덤 */
  const SL = 400, TL = 240; let best = null;
  const mustRoad = lookOf(region).ground === 'paver';   /* 도시·마을은 띠가 큰길을 품는다 — 길이 마을의 등뼈 */
  for (let sc = -200; sc <= 200; sc += 20) for (let t0 = -340; t0 <= 100; t0 += 10) { const t1 = t0 + TL, s0 = sc - SL / 2, s1 = sc + SL / 2; if (mustRoad && !(t0 <= -30 && t1 >= 30)) continue;
    const c = stats(s0, s1, t0, t1), view = stats(s0, s1, t1, Math.min(t1 + 60, R0)).water;
    const score = -10 * c.water - 6 * c.big - 2 * Math.max(0, c.city - 0.2) + (t0 < 0 && t1 > 0 ? 0.4 : 0) - 0.002 * Math.abs(t1 - 40) - 0.0005 * Math.abs(sc) + (far[0] || far[1] !== 1 ? 0.5 * view : 0);
    if (process.env.DEBUG && sc === 0 && t0 % 40 === 0) console.log("  띠 t", t0, t1, "점수", score.toFixed(2), Object.entries(c).map(([k, v]) => k + " " + (v * 100).toFixed(0)).join(" "));
    if (!best || score > best.score) best = { score, s0, s1, t0, t1, c }; }
  const walk = { s0: best.s0, s1: best.s1, t0: best.t0, t1: best.t1 }, c = best.c;
  /* 출발점: 띠 가운데 길가 — 차도 위가 아니고(대전 첫 굽기: 10차선 교차로 한가운데라 화면이 빈 아스팔트뿐), 도시면 20 m 안에 건물이 있는 칸.
     물·건물이 아니고 둘레 3 m 도 걸을 수 있어야 한다 */
  const carRoads = osm.roads.filter(r => !r.tunnel && !r.area && /trunk|primary|secondary|tertiary|unclassified|residential|living_street|service/.test(r.kind)).map(r => ({ line: r.line, hw: r.width ? r.width / 2 : r.lanes ? r.lanes * 1.75 : /trunk|primary/.test(r.kind) ? 9 : /secondary|tertiary/.test(r.kind) ? 6 : 3.5 }));
  const onRoad = (s, t) => { const p = toOsm(FROM(s, t)); return carRoads.some(r => r.line.some((q, i) => i && segD(p, r.line[i - 1], q) < r.hw + 1)); };
  const urban = lookOf(region).dress.urban, nearB = (s, t) => { for (let ds = -20; ds <= 20; ds += G) for (let dt = -20; dt <= 20; dt += G) if (/city|big/.test(cls(s + ds, t + dt))) return true; return false; };
  const sc = (walk.s0 + walk.s1) / 2, want = [sc, walk.t0 < 0 && walk.t1 > 0 ? 0 : (walk.t0 + walk.t1) / 2]; let spawn = null;
  const okAt = (s, t) => s > walk.s0 + 10 && s < walk.s1 - 10 && t > walk.t0 + 10 && t < walk.t1 - 10 && [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]].every(([ds, dt]) => /open|park|beach/.test(cls(s + ds, t + dt))) && !onRoad(s, t);
  for (const strict of [true, false]) for (let r = 0; r < 120 && !spawn; r += G) for (let a = 0; a < 24 && !spawn; a++) { const s = want[0] + Math.cos(a / 24 * Math.PI * 2) * r, t = want[1] + Math.sin(a / 24 * Math.PI * 2) * r; if (okAt(s, t) && (!strict || !urban || nearB(s, t))) spawn = [Math.round(s), Math.round(t)]; }
  if (!spawn) console.warn("  ! 출발점 후보 없음 — 띠 가운데로", want); spawn = spawn || want;
  if (process.env.DEBUG) { let n = 0, road = 0, cl = 0; for (let s = walk.s0; s < walk.s1; s += 10) for (let t = walk.t0; t < walk.t1; t += 10) { n++; if (onRoad(s, t)) road++; if (/open|park|beach/.test(cls(s, t))) cl++; } console.log("  칸", n, "차도", road, "걸을 수 있는 땅", cl); }

  /* 하위 구역: 띠를 s 로 셋 — 가운데(출발점 쪽)가 쉬움, 양 끝이 어려움. 거점은 가운데가 마을(안전) */
  const lv = levelOf(region) || levelOf({ ...region, kind: 'city' }), thirds = [0, 1, 2].map(k => [walk.s0 + (walk.s1 - walk.s0) * k / 3, walk.s0 + (walk.s1 - walk.s0) * (k + 1) / 3].map(Math.round));
  const odd = n => /_|청사|시청|구청|민원|주차|학교|아파트|지하차도|터널|고가|육교|램프/.test(n);   /* 관청·시설 이름, 지하차도·고가는 구역 이름으로 어색하다 (제주시청_민원실, 충장지하차도) */
  const named = osm.areas.filter(a => a.name && !odd(a.name) && /park|beach|wood|forest|garden|square|recreation|water|sand|scrub|nature_reserve/.test(a.kind)), roadsNamed = osm.roads.filter(r => r.name && !odd(r.name) && /trunk|primary|secondary|tertiary/.test(r.kind));
  /* 이름: ① 아직 안 쓴 공원·해변·숲 이름 ② 이미 쓴 이름이 이 구역도 덮으면 «○○ 동쪽» (실제 방위) ③ 큰길 이름 + 땅 종류 («○○번길» 골목은 빼고) ④ 땅 종류 */
  const compass = (sMid, tMid) => { const c0 = toOsm(FROM((walk.s0 + walk.s1) / 2, (walk.t0 + walk.t1) / 2)), c1 = toOsm(FROM(sMid, tMid)), dx = c1[0] - c0[0], dz = c1[1] - c0[1];
    return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? '동쪽' : '서쪽') : (dz > 0 ? '남쪽' : '북쪽'); };
  const nameOf = (s0, s1, t0, t1, k, used) => { const cnt = new Map(); let n = 0;
    for (let s = s0; s <= s1; s += 10) for (let t = t0; t <= t1; t += 10) { n++; const p = toOsm(FROM(s, t)); for (const a of named) if (inPoly(p, a.poly)) cnt.set(a.name, (cnt.get(a.name) || 0) + 1);
      for (const r of roadsNamed) if (!/번길$/.test(r.name) && r.line.some((q, i) => i && segD(p, r.line[i - 1], q) < 8)) cnt.set('@' + r.name, (cnt.get('@' + r.name) || 0) + 0.4); }
    const all = [...cnt.entries()].sort((a, b) => b[1] - a[1]), area = all.filter(([m]) => !m.startsWith('@'));
    const fresh = area.find(([m]) => !used.has(m)); if (fresh) { used.add(fresh[0]); return fresh[0] + ' 터'; }
    const again = area.find(([, v]) => v > n * 0.2); if (again) return again[0] + ' ' + compass((s0 + s1) / 2, (t0 + t1) / 2);
    const road = all.find(([m]) => m.startsWith('@') && !used.has(m)); if (road) { used.add(road[0]); return road[0].slice(1) + ' ' + CLASS_NAME[k]; }
    const g = CLASS_NAME[k]; if (!used.has(g)) { used.add(g); return g; } return g + ' ' + compass((s0 + s1) / 2, (t0 + t1) / 2); };   /* 같은 이름이 둘이면 실제 방위를 붙인다 (수원·목포 «폐허 거리» 셋) */
  const used = new Set(), hunts = [], hub = region.kind === 'hub';
  const order = [1, 0, 2];   /* 가운데 → 왼쪽(s 작은 쪽) → 오른쪽 순으로 위험이 커진다 */
  order.forEach((k, rank) => { const [s0, s1] = thirds[k], st = stats(s0, s1, walk.t0, walk.t1), dom = Object.entries(st).filter(([n]) => n !== 'water').sort((a, b) => b[1] - a[1])[0][0];
    if (hub && rank === 0) { hunts.push({ id: 'town', name: /마을$/.test(region.name) ? region.name : region.name + ' 마을', kind: 'rest', s: [s0, s1], t: [walk.t0, walk.t1] }); return; }
    const span = lv[1] - lv[0], a = lv[0] + Math.round(span * (rank / 3)), b = Math.min(lv[1], a + Math.max(2, Math.round(span / 2)));
    const k2 = dom === 'open' && lookOf(region).dress.urban ? 'street' : dom;   /* 도시의 «빈 땅» 은 길이다 */
    hunts.push({ id: ['mid', 'left', 'right'][rank], name: nameOf(s0, s1, walk.t0, walk.t1, k2, used), s: [s0, s1], t: [walk.t0, walk.t1], lv: [a, b], mobs: MOBS[k2], danger: rank + 1 }); });
  if (!hub) hunts.push({ id: 'rest', name: '길잡이 쉼터', kind: 'rest', st: spawn, r: 12 });
  /* 거점 점령 지점 (문서 192 §8): 마을 한가운데 맨땅 — 차도 밖, 출발점에서 10 m 넘게(깃발과 겹치지 않게). 서버가 map.json 에서 읽어 거점 보스를 여기 세운다 */
  if (hub) { const [m0, m1] = thirds[1], want2 = [(m0 + m1) / 2, (walk.t0 + walk.t1) / 2]; let siege = null;
    for (let r = 0; r < 100 && !siege; r += G) for (let a = 0; a < 24 && !siege; a++) { const s = want2[0] + Math.cos(a / 24 * Math.PI * 2) * r, t = want2[1] + Math.sin(a / 24 * Math.PI * 2) * r;
      if (s > m0 + 8 && s < m1 - 8 && okAt(s, t) && Math.hypot(s - spawn[0], t - spawn[1]) > 10 && [[6, 0], [-6, 0], [0, 6], [0, -6]].every(([ds, dt]) => /open|park|beach/.test(cls(s + ds, t + dt)))) siege = [Math.round(s), Math.round(t)]; }
    if (siege) hunts.push({ id: 'siege', name: '점령 지점', kind: 'siege', st: siege, r: 10 }); else console.warn('  ! 점령 지점 자리를 못 찾았다'); }

  const L = lookOf(region), tall = osm.buildings.some(b => (b.height || (b.levels || 0) * 3.6) > 45), lampsOn = walk.t0 < 0 && walk.t1 > 0;
  const ground = L.ground === 'paver' && c.city < 0.08 ? (c.beach > 0.1 ? 'sand' : 'grass') : L.ground;
  const zone = { title: region.name, kind: 'field', env: 'field', osm: id, px: 90, auto: true, rules: { mark: true, escape: true }, restart: { zone: id }, hunts,
    field: { seed: hash(id), tc: 0, cutT: walk.t0, walk, farSide: { osm: far.map(v => Math.round(v)) }, spawn: { st: spawn }, ground, curtain: tall, extentH: 40, ruin: { h: L.ruin },
      dress: L.dress, sky: { hemiI: 3.0 }, trees: L.trees, cars: { gap: 0.6, trucks: 0.08 }, crystals: 16, lampStep: 30, ...(lampsOn ? { lampT: 3 } : { lamps: false }),
      boundary: { style: L.boundary, closed: { s0: '통제구역 — 안개', s1: '통제구역 — 안개' } } } };
  console.log(`${id}: 띠 s ${walk.s0}~${walk.s1} · t ${walk.t0}~${walk.t1} · 물 ${(c.water * 100).toFixed(1)}% 건물 ${(c.city * 100).toFixed(0)}% (큰 건물 ${(c.big * 100).toFixed(0)}%) 숲 ${(c.forest * 100).toFixed(0)}% 모래 ${(c.beach * 100).toFixed(0)}% 풀 ${(c.park * 100).toFixed(0)}% · 먼 쪽 ${far.map(v => v.toFixed(0))} · 출발 ${spawn}`);
  for (const h of hunts) console.log('   ', h.kind === 'rest' ? '쉼' : h.kind === 'siege' ? '점령' : '사냥', h.name, h.lv ? 'Lv ' + h.lv.join('~') : '', h.mobs || '');
  return zone;
}

const load = async f => fs.existsSync(f) ? (await import(path.resolve(f) + '?' + Date.now())).AUTO : {};
const write = (f, obj, note) => fs.writeFileSync(f, `/* ${note} — tools/2d/new-zone.mjs 가 쓴다. 손으로 고치지 말고 다시 돌리거나 zones.js 로 옮긴다 (docs/design/192 §7)
   좌표·이름은 js/mmo/regions.js, 땅은 OSM(© OpenStreetMap contributors, ODbL). zones.js 가 같은 id 를 가지면 그쪽이 이긴다. */
export const AUTO = {
${Object.entries(obj).map(([k, v]) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',').join('\n')}
};
`);
const NOTE = { [AUTO_F]: '자동으로 찍어 낸 지역 (구운 것)', [PENDING_F]: '찍어 냈지만 아직 안 구운 지역 — 게임은 읽지 않는다' };
const args = process.argv.slice(2);
if (args[0] === '--promote') { const pend = await load(PENDING_F), auto = await load(AUTO_F);
  for (const id of args.slice(1)) { if (!pend[id]) { console.error('대기 목록에 없다:', id); process.exit(1); } auto[id] = pend[id]; delete pend[id]; }
  write(AUTO_F, auto, NOTE[AUTO_F]); write(PENDING_F, pend, NOTE[PENDING_F]); console.log('→ 굽기 목록으로', args.slice(1).join(', '), '· 남은 대기', Object.keys(pend).join(', ') || '없음'); process.exit(0); }
const ids = args; if (!ids.length) { console.error('사용: node tools/2d/new-zone.mjs <지역 id…>  (PENDING=1 이면 대기 목록) · --promote <id…>'); process.exit(1); }
const prev = await load(OUT);
for (const id of ids) { const r = REGIONS.find(x => x.id === id); if (!r) { console.error('지역 표에 없다:', id); process.exit(1); } prev[id] = plan(r); }
write(OUT, prev, NOTE[OUT]);
console.log('→', OUT, Object.keys(prev).join(', '));
