/* Render 빌드 거르기 (2026-10-13): 서버가 읽는 파일이 render.yaml buildFilter 에 다 들어 있어야 한다.
   빠지면 그 파일만 바뀐 커밋에서 서버가 옛 코드로 남는다. 반대로 거르기를 지우면 모든 커밋마다 다시 지어 무료 한도를 다 쓴다 */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
function filterPaths() { const y = fs.readFileSync(path.join(ROOT, 'render.yaml'), 'utf8'), m = y.match(/buildFilter:\s*\n\s*paths:\s*\n((?:\s*-\s*.+\n)+)/); assert.ok(m, 'render.yaml 에 buildFilter.paths 가 없다 — 모든 커밋마다 다시 짓는다');
  return m[1].split('\n').map(l => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean); }
const covered = (f, globs) => globs.some(g => g.endsWith('/**') ? f.startsWith(g.slice(0, -2)) : f === g);
function serverDeps() { const seen = new Set(), q = fs.readdirSync(path.join(ROOT, 'server')).map(f => path.join(ROOT, 'server', f)), out = new Set();
  while (q.length) { const f = q.pop(); if (seen.has(f) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) continue; seen.add(f); out.add(path.relative(ROOT, f).split(path.sep).join('/'));
    if (!/\.(c?js|mjs)$/.test(f)) continue; const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)) { let p = path.resolve(path.dirname(f), m[1]); if (!fs.existsSync(p) && fs.existsSync(p + '.js')) p += '.js'; q.push(p); } }
  return [...out]; }
test('서버가 require 하는 파일은 전부 Render buildFilter 안', () => { const g = filterPaths(), miss = serverDeps().filter(f => !covered(f, g)); assert.deepEqual(miss, [], '빠졌다: ' + miss.join(', ')); });
test('서버가 readFileSync 로 읽는 js · 지도 · UE 데이터도 안', () => { const g = filterPaths();
  for (const n of ['world', 'items', 'dungeons', 'dungeon', 'dungeon-content']) assert.ok(covered('js/' + n + '.js', g), 'content.cjs 가 읽는 js/' + n + '.js');
  assert.ok(covered('maps/2d/gangnam/map.json', g), 'field.cjs 가 읽는 maps/2d'); assert.ok(covered('ue/HwanghonCombatUE/Content/Data/korea.json', g), 'region-store 가 읽는 UE 데이터');
  const C = fs.readFileSync(path.join(ROOT, 'server/content.cjs'), 'utf8').match(/for\(const name of \[([^\]]+)\]\)/); assert.ok(C, 'content.cjs 목록 모양이 바뀌었다 — 이 시험도 고칠 것');
  for (const n of C[1].match(/'([^']+)'/g).map(x => x.slice(1, -1))) assert.ok(covered('js/' + n + '.js', g), 'content.cjs 새 파일 js/' + n + '.js 를 render.yaml 에');
  assert.ok(!covered('world3d.html', g) && !covered('js/mmo/env-lib.js', g) && !covered('art/tex/ph/red_brick_diff.jpg', g), '화면 쪽 파일까지 넣으면 다시 매 커밋 빌드');
});
