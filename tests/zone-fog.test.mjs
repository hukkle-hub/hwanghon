/* 장소마다 안개 (문서 229 §15) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fogFor, ZONE_FOG } from '../js/mmo/zone-fog.js';

test('장소마다 안개: 도심은 70~230 그대로 · 강변·바다·산 위는 멀리 · 산 밑·호숫가는 짙게', () => {
  assert.deepEqual([fogFor('gangnam').near, fogFor('gangnam').far], [70, 230]); assert.equal(fogFor('없는곳').far, 230);
  for (const z of ['yeouido', 'namsan', 'haeundae', 'jeju', 'gyeongpo']) assert.ok(fogFor(z).far >= 300, z + ' 트인 곳');
  for (const z of ['chuncheon', 'gyeryong']) assert.ok(fogFor(z).far < 200, z + ' 짙은 곳');
  for (const [z, f] of Object.entries(ZONE_FOG)) { assert.ok(f[0] > 20 && f[0] < f[1] * 0.45, z + ' 가까이'); assert.ok(f[1] <= 420, z + ' 끝 — 휴대폰 그리는 양'); assert.ok(f[2], z + ' 이유'); }
  const zones = fs.readdirSync('maps/2d'); for (const z of Object.keys(ZONE_FOG)) if (z !== 'default') assert.ok(zones.includes(z), '없는 지역 이름: ' + z);
});
test('world3d 가 지역 안개를 쓴다 (?fogf 로 견주기) — 안개 덜어내기·휴대폰 카메라 끝이 그 끝을 따라간다', () => {
  const w = fs.readFileSync('world3d.html', 'utf8');
  assert.match(w, /const ZFOG = fogFor\(ZONE\);/); assert.match(w, /scene\.fog = new THREE\.Fog\(skyCol, ZFOG\.near, ZFOG\.far\);/);
  assert.ok(!/new THREE\.Fog\(skyCol, 70, 230\)/.test(w), '한 값으로 돌아갔다');
  assert.match(w, /cam\.far = scene\.fog\.far \+ 10/); assert.match(w, /FOGC\.update\(cam\.position, scene\.fog\.far\)/);
});
