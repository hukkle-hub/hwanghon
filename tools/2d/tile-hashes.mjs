// 타일마다 내용 해시를 map.json 에 적는다 (docs/design/187 §2 — OpenMMO 처럼 «해시 붙은 정적 파일»)
//   node tools/2d/tile-hashes.mjs [zone…]   (없으면 전부)
// 게임(map2d.js)은 타일 주소에 ?v=<해시> 를 붙이고, 서비스워커(sw.js)는 그 주소를 배포가 바뀌어도 지우지 않는 캐시에서 먼저 꺼낸다.
// 다시 구운 타일만 해시가 바뀌어 새로 받는다. 굽기·압축 뒤에 돌린다.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const ROOT = path.join('maps', '2d'), zones = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(ROOT).filter(z => fs.existsSync(path.join(ROOT, z, 'map.json')));
for (const z of zones) { const f = path.join(ROOT, z, 'map.json'), m = JSON.parse(fs.readFileSync(f, 'utf8')); let n = 0;
  for (const t of m.tiles) { const h = crypto.createHash('sha1'); h.update(fs.readFileSync(path.join(ROOT, z, t.color))); h.update(fs.readFileSync(path.join(ROOT, z, t.depth))); const v = h.digest('hex').slice(0, 10); if (t.h !== v) { t.h = v; n++; } }
  fs.writeFileSync(f, JSON.stringify(m)); console.log(z, '타일', m.tiles.length, '해시 바뀜', n); }
