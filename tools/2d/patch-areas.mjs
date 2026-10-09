// 구운 맵의 하위 구역(hunt · rest · siege)만 지역 표대로 다시 — 그림·막이는 그대로 (docs/design/192 §8)
//   node tools/2d/patch-areas.mjs <zone…>
// 구역은 그림이 아니라서 다시 굽지 않아도 된다. replan-map 은 장면을 다시 지어 막이까지 새로 만드는데(나무 규칙이 바뀌면 그림과 어긋난다),
// 이건 map.json 의 areas 중 지역 표에서 온 것만 바꾸고 문·보스 둘레(safe · combat)는 남긴다. 굽기와 같은 함수(js/mmo/hunt-areas.js)를 쓴다.
import fs from 'node:fs';
import { ZONES } from '../../js/mmo/zones.js';
import { huntAreas, HUNT_KINDS } from '../../js/mmo/hunt-areas.js';
import { createCollide } from '../../js/mmo/field-collide.js';
import { createRequire } from 'node:module';
const REQ = createRequire(import.meta.url), SAFE = REQ('../../js/mmo/safe-zones.js');
/* 생태 자리 판정 — 서버 생태(server/field-ecology.cjs)의 legal·canTraverse 와 같은 규칙: 게임 충돌(막이·걷는 띠)에 안 밀리고, 사냥터 안,
   쉼터·문·보스 둘레(safe·combat·rest)에서 0.6 m 떨어진 곳. 순찰 네 변은 같은 경로 찾기(planRoute)로 실제로 이어져야 한다 */
const { touches } = REQ('../../server/field-ecology.cjs'), { planRoute } = REQ('../../server/field-ecology-route.cjs');
const placer = m => { const C = createCollide(m), keepOut = (m.areas || []).filter(a => a.kind === 'rest' || a.kind === 'safe' || a.kind === 'combat');
  return area => { const legal = q => { if (!SAFE.inArea(area, q[0], q[1]) || keepOut.some(a => touches(a, q, q, .6))) return false; const p = { x: q[0], z: q[1] }; C.collide(p, 0.6); return Math.hypot(p.x - q[0], p.z - q[1]) < 0.05; };
    const traverse = (a, b) => { if (keepOut.some(s => touches(s, a, b))) return false; const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .25); if (n > 4000) return false;
      for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; if (!legal([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) return false; } return true; };
    return { ok: (x, z) => legal([x, z]), link: (a, b) => !!(planRoute(a, b, legal, traverse) || planRoute(a, b, legal, traverse, { step: 1, budget: 12000 })) }; }; };
for (const id of process.argv.slice(2)) { const F = `maps/2d/${id}/map.json`, m = JSON.parse(fs.readFileSync(F, 'utf8')), Z = ZONES[id]; if (!Z) throw Error('지역 표에 없다: ' + id);
  const keep = (m.areas || []).filter(a => !HUNT_KINDS.includes(a.kind)), fresh = huntAreas(Z.hunts, m.road.ang, id, placer(m)), before = (m.areas || []).length;
  m.areas = [...keep, ...fresh]; fs.writeFileSync(F, JSON.stringify(m, null, 1));
  console.log(id, '구역', before, '→', m.areas.length, '·', fresh.map(a => a.kind + ':' + a.name).join(' · ')); }
