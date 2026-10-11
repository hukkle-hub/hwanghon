/* 보스 화면 밖 걸러내기 · 먼 거리 축소판 (문서 229 §45) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const glb = f => { const b = fs.readFileSync(f), n = b.readUInt32LE(12); return JSON.parse(b.slice(20, 20 + n)); };
const tri = j => j.meshes.reduce((a, m) => a + m.primitives.reduce((s, p) => s + j.accessors[p.indices].count / 3, 0), 0);
const NAMES = ['minister_jeong_candidate', 'shadow_fang', 'subject_09', 'clave'];
test('축소판: 삼각형 ≤ 40 % · 스킨 메시 수·뼈 수가 원본과 같다 · UV 가 있다 · 위치는 실수(양자화하면 스킨 메시가 쪼그라든다) · 텍스처·클립 없음', () => {
  for (const n of NAMES) { const a = glb('art/3d/part1/' + n + '.glb'), b = glb('art/3d/lod/part1/' + n + '.glb');
    assert.ok(tri(b) <= tri(a) * 0.4, n + ' ' + tri(a) + ' → ' + tri(b));
    assert.equal(b.meshes.length, a.meshes.length, n + ' 메시 수'); assert.equal((b.skins || [])[0].joints.length, a.skins[0].joints.length, n + ' 뼈 수');
    for (const m of b.meshes) for (const p of m.primitives) { assert.ok('TEXCOORD_0' in p.attributes, n + ' UV 없음 — 정리(prune)가 지웠다(얼굴이 어두웠다)'); assert.equal(b.accessors[p.attributes.POSITION].componentType, 5126, n + ' 위치가 양자화됐다'); }
    assert.ok(!(b.images || []).length && !(b.animations || []).length, n + ' 텍스처·클립은 원본 것을 쓴다'); }
});
test('world3d: 휴대폰만 축소판 · 원본 옆에 같은 뼈대·같은 재질로 붙여 보이기만 바꾼다(군도 손잡이는 원본 정점) · 경계구 3 배 + 6 m · ?blod=0 ?bcull=0', () => {
  const w = fs.readFileSync('world3d.html', 'utf8');
  assert.match(w, /const BOSS_LOD = LOD && q\.get\('blod'\) !== '0' \? new Set\(\['minister_jeong_candidate', 'shadow_fang', 'subject_09', 'clave'\]\)/);
  assert.match(w, /new THREE\.SkinnedMesh\(low\[i\]\.geometry, f\.material\)/); assert.match(w, /m\.bind\(f\.skeleton, f\.bindMatrix\)/); assert.match(w, /f\.parent\.add\(m\)/);
  assert.doesNotMatch(w, /\.geometry = low\[/, '원본 메시의 기하를 바꿔 끼우면 군도 손잡이(정점 번호)가 튄다');
  assert.match(w, /radius \* 3 \+ pad/); assert.match(w, /q\.get\('bcull'\) === '0'/); assert.match(w, /bossCull\(r, k\); fbs\.push\(o\); STAGE\.attach\(o\); bossLod\(o, gl\);/);
  assert.match(w, /if \(BOSS_LOD && frames % 10 === 0\) bossLodTick\(\);/);
});
