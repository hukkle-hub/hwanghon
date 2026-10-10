/* 스킨 다시 묶기 (문서 225) — 디렉터 «모션에 다 늘어나서 붙었네 … 제대로 잡고 가야지».
   전용 기술 클립에서 삼각형 변이 쉬는 자세의 2배 넘게 늘어나는 비율. 원본 GLB: 클레이브 셔터 들기 11.4 % · 섀도우 팽 연격 5.9 % · 정 장관 원 4.2 % · 실험체 09호 폭주 1.8 %. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { audit } = await import('../tools/3d/stretch-audit.mjs');
const CASES = [
  ['art/3d/part1/clave.glb', ['atk_claveshut', 'atk_clavestorm', 'atk_slam', 'walk'], .03],
  ['art/3d/part1/shadow_fang.glb', ['atk_sfflurry', 'atk_sfbloom'], .03],
  ['art/3d/part1/subject_09.glb', ['atk_s09frenzy', 'atk_s09storm'], .016],   /* 원본 1.65 % · 다시 묶음 1.50 % (0.2 s 간격) — 원래 덜 엉켜 있던 몸 */
  ['art/3d/part1/minister_jeong_candidate.glb', ['atk_jeong_circle', 'atk_jeong_triple', 'atk_jeong_back', 'atk_jeong_command'], .012],
];
for (const [file, clips, lim] of CASES) test(`늘어남: ${file.split('/').pop()} 전용 클립에서 2배↑ 변 ${lim * 100}% 미만 · 다시 묶은 표가 있다`, async () => {
  const b = fs.readFileSync(file), j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  assert.ok(j.asset?.extras?.skinRebind, 'tools/3d/skin-rebind.mjs 로 구운 표가 없다');
  const r = await audit(file, clips, .2), bad = r.clips.filter(c => c.frac >= lim).map(c => `${c.clip} ${(c.frac * 100).toFixed(2)}%`);
  assert.equal(r.clips.length, clips.length, '클립 이름'); assert.deepEqual(bad, []);
});
test('떨어진 조각 굳히기 · 붙은 살 끊기: 클레이브 셔터 아래 절반(왼손 70 %·왼발 20 %)이 손을 따라간다', async () => {
  const T = await import('../vendor/three/three.module.js'), { rigidIslands } = await import('../js/mmo/skin-fix.js');
  /* 몸통(삼각형 2개) + 떨어진 판(삼각형 1개, 뼈1 70 %·뼈2 30 %) */
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0, 1,1,0, 5,0,0, 6,0,0, 5,1,0], 3)); g.setIndex([0,1,2, 1,3,2, 4,5,6]);
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute([0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,2,0,0, 1,2,0,0, 1,2,0,0], 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute([1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, .7,.3,0,0, .7,.3,0,0, .7,.3,0,0], 4));
  assert.equal(rigidIslands(g, .6, .5), 3); assert.deepEqual([g.attributes.skinIndex.getX(4), g.attributes.skinWeight.getX(4), g.attributes.skinWeight.getY(4)], [1, 1, 0]);
  assert.equal(g.attributes.skinWeight.getX(0), 1, '몸통은 그대로');
});
