// 구운 맵의 하위 구역(hunt · rest · siege)만 지역 표대로 다시 — 그림·막이는 그대로 (docs/design/192 §8)
//   node tools/2d/patch-areas.mjs <zone…>
// 구역은 그림이 아니라서 다시 굽지 않아도 된다. replan-map 은 장면을 다시 지어 막이까지 새로 만드는데(나무 규칙이 바뀌면 그림과 어긋난다),
// 이건 map.json 의 areas 중 지역 표에서 온 것만 바꾸고 문·보스 둘레(safe · combat)는 남긴다. 굽기와 같은 함수(js/mmo/hunt-areas.js)를 쓴다.
import fs from 'node:fs';
import { ZONES } from '../../js/mmo/zones.js';
import { huntAreas, HUNT_KINDS } from '../../js/mmo/hunt-areas.js';
for (const id of process.argv.slice(2)) { const F = `maps/2d/${id}/map.json`, m = JSON.parse(fs.readFileSync(F, 'utf8')), Z = ZONES[id]; if (!Z) throw Error('지역 표에 없다: ' + id);
  const keep = (m.areas || []).filter(a => !HUNT_KINDS.includes(a.kind)), fresh = huntAreas(Z.hunts, m.road.ang), before = (m.areas || []).length;
  m.areas = [...keep, ...fresh]; fs.writeFileSync(F, JSON.stringify(m, null, 1));
  console.log(id, '구역', before, '→', m.areas.length, '·', fresh.map(a => a.kind + ':' + a.name).join(' · ')); }
