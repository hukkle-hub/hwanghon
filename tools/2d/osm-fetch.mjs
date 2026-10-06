// OpenStreetMap(Overpass) 원본 받기 — 지역 하나를 칸으로 쪼개 병렬로, 실패하면 다시 (docs/licenses/osm.md)
//   node tools/2d/osm-fetch.mjs <출력 폴더> <위도0> <위도1> <경도0> <경도1> [칸=3]
// 주 서버(overpass-api.de)는 프록시 너머로 막혀 maps.mail.ru 미러를 쓴다. 큰 칸은 504 가 나서 칸을 잘게.
// 받는 것: 도로(highway) · 건물 · 땅 쓰임/자연/여가/물길/철길/공항/인공물 · 케이블카
import { execFile } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';
const [OUT, a0, a1, o0, o1, N = '3'] = process.argv.slice(2); if (!o1) { console.error('사용: <출력> <위도0> <위도1> <경도0> <경도1> [칸]'); process.exit(1); }
const EP = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', n = +N; fs.mkdirSync(OUT, { recursive: true });
/* 땅 쓰임·자연·물길 등은 한 질의로 묶으면 504 — 종류마다 따로 (2026-10-06, 여의도에서 7칸 실패) */
/* 묶음은 문장마다 범위를 붙인다 — «(a;b;)(범위)» 는 Overpass 문법이 아니라서 묶음 질의가 늘 실패했다 */
const KINDS = { r: ['way["highway"]'], b: ['way["building"]'], l: ['way["landuse"]'], n: ['way["natural"]'], e: ['way["leisure"]', 'way["amenity"="parking"]'], w: ['way["waterway"]'], t: ['way["railway"]', 'way["aerialway"]'], m: ['way["aeroway"]', 'way["man_made"]'] };
const Q = (parts, bb) => `[out:json][timeout:60];(${parts.map(p => p + bb + ';').join('')});out geom;`;
const jobs = [];
for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) { const la0 = +a0 + (a1 - a0) * i / n, la1 = +a0 + (a1 - a0) * (i + 1) / n, lo0 = +o0 + (o1 - o0) * k / n, lo1 = +o0 + (o1 - o0) * (k + 1) / n;
  const bb = `(${la0.toFixed(5)},${lo0.toFixed(5)},${la1.toFixed(5)},${lo1.toFixed(5)})`;
  for (const [key, parts] of Object.entries(KINDS)) jobs.push({ file: path.join(OUT, `osm-${key}${i}${k}.json`), q: Q(parts, bb) }); }
{ const bb = `(${a0},${o0},${a1},${o1})`; jobs.push({ file: path.join(OUT, 'osm-nodes.json'), q: `[out:json][timeout:60];(${['node["railway"~"subway_entrance|station"]', 'node["aerialway"="station"]', 'node["natural"="tree"]', 'node["highway"~"crossing|traffic_signals"]', 'node["shop"]', 'node["amenity"]', 'node["man_made"]', 'node["tourism"]'].map(p => p + bb + ';').join('')});out;` }); }
const ok = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')).elements !== undefined; } catch { return false; } };
const curl = (q, f) => new Promise(res => execFile('curl', ['-s', '-m', '110', '-G', '-o', f, '--data-urlencode', 'data=' + q, EP], () => res()));
let done = 0, fail = 0; const todo = jobs.filter(j => !ok(j.file));
async function worker() { while (todo.length) { const j = todo.shift();
    for (let t = 0; t < 8; t++) { await curl(j.q, j.file); if (ok(j.file)) break; await new Promise(r => setTimeout(r, 8000 + t * 4000)); }
    if (ok(j.file)) { done++; console.log('ok', path.basename(j.file), fs.statSync(j.file).size); } else { fail++; try { fs.unlinkSync(j.file); } catch {} console.log('FAIL', path.basename(j.file)); } } }
await Promise.all([0, 1, 2, 3].map(worker));
console.log('DONE 받음', done, '실패', fail, '/', jobs.length);
