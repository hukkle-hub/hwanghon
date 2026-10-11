/* 휴대폰 장비 LOD (문서 229 §41) — 3D 필드가 장비(TW_LOOKS)만 원본으로 불러 영웅 하나가 16만 삼각형이었다 · 엉성한 축소로 망가진 LOD 12 개를 다시 만들었다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const tri = f => { const b = fs.readFileSync(f), n = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + n)); let t = 0; for (const m of j.meshes || []) for (const p of m.primitives) t += (p.indices != null ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count) / 3; return { t, j }; };
test('3D 필드: 장비도 휴대폰 경로(lodUrl)로 부른다 — 영웅·다른 사람 둘 다', () => {
  const w = fs.readFileSync('world3d.html', 'utf8');
  assert.match(w, /const gearLoader = \{ load: \(u, \.\.\.a\) => loader\.load\(lodUrl\(u\), \.\.\.a\) \};/);
  assert.equal((w.match(/TW_LOOKS\.attach\(THREE, gearLoader, /g) || []).length, 2); assert.doesNotMatch(w, /TW_LOOKS\.attach\(THREE, loader, /, '원본 loader 로 입히면 LOD 를 건너뛴다');
});
test('LOD 장비는 모두 원본보다 가볍다 (품질은 시험이 아니라 시트 — tools/3d/gear-lod-sheet.html 원본 · LOD 나란히. «꼭짓점 나눠 쓰기» 는 엉성한 축소도 같아 못 가른다)', () => {
  for (const f of fs.readdirSync('art/3d/lod/gear')) { const o = 'art/3d/gear/' + f; if (!fs.existsSync(o)) continue; const a = tri(o).t, b = tri('art/3d/lod/gear/' + f).t; assert.ok(b < a * 0.7, f + ' ' + a + ' → ' + b); }
});
