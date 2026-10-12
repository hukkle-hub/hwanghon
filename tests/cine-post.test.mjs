/* 영화 같은 대기 — 빛줄기 · 해 둘레 번짐 · 색보정 (문서 230) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { cineSun } from '../js/mmo/cine-sun.js';

const camAt = (yaw, pitch = 0) => { const c = new THREE.PerspectiveCamera(60, 16 / 9, .1, 1000); c.position.set(0, 1.5, 0);
  c.lookAt(Math.sin(yaw) * 10, 1.5 + Math.tan(pitch) * 10, Math.cos(yaw) * 10); c.updateMatrixWorld(); c.updateProjectionMatrix(); return c; };
const SUN = new THREE.Vector3(0, .24, .97);   /* 남산 해 질 녘(고도 14°) */

test('해를 바라보면 화면 안 자리 · 세기 1', () => {
  const r = cineSun(THREE, camAt(0), SUN); assert.ok(r.k > .99, 'k ' + r.k); assert.ok(Math.abs(r.x - .5) < .01 && r.y > .5 && r.y < 1, `자리 ${r.x}, ${r.y}`);
});
test('등지면 0 · 화면 밖으로 멀어지면 0 · 그 사이는 서서히', () => {
  assert.equal(cineSun(THREE, camAt(Math.PI), SUN).k, 0, '카메라 뒤');
  const ks = [0, .5, .8, 1.1].map(a => cineSun(THREE, camAt(a), SUN).k); for (let i = 1; i < ks.length; i++) assert.ok(ks[i] <= ks[i - 1] + 1e-9, '돌수록 줄어든다 ' + ks);
  assert.ok(ks[1] > 0 && ks[3] < ks[0], '가장자리에서 갑자기 끊기지 않는다 ' + ks);
  const out = cineSun(THREE, camAt(.9), SUN); assert.ok(out.x > 1.02 && out.k > .1, `화면 바로 밖(x ${out.x.toFixed(2)})에서도 빛줄기가 들어온다 k ${out.k.toFixed(2)}`);
});
test('해가 지면 0 · 폭우(dim) 면 꺼진다', () => {
  assert.equal(cineSun(THREE, camAt(0, -.2), new THREE.Vector3(0, -.2, 1)).k, 0, '지평선 아래');
  assert.ok(Math.abs(cineSun(THREE, camAt(0), SUN, 1).k) < 1e-9, '폭우');
});
test('카메라가 망가진 프레임(NaN)은 0 — 화면이 하얗게 타지 않게', () => {
  const c = camAt(0); c.position.set(NaN, 1, 0); c.updateMatrixWorld(); const r = cineSun(THREE, c, SUN); assert.equal(r.k, 0);
});
test('3D 필드만 켜고 ?cine=0 으로 끈다 · 던전/2D 블룸은 그대로', () => {
  const W = fs.readFileSync('world3d.html', 'utf8'), B = fs.readFileSync('js/bloom.js', 'utf8');
  assert.match(W, /const CINE = \(env\.kind \|\| Z\.kind \|\| meta\.kind\) === 'field' && q\.get\('cine'\) !== '0';/);
  assert.match(W, /cine: CINE \? \{\} : null/); assert.match(W, /if \(bloom && bloom\.cine\) cineSunTick\(\);\n  if \(bloom\) bloom\.render/, '그리기 직전에 해 자리');
  assert.match(B, /C \? \{ CINE:1 \} : null/, 'cine 를 안 넘기면 셰이더에 CINE 가 없다(던전 · 2D 맵 결과 그대로)');
  assert.match(B, /if\(C && cu\.sunK\.value > 0\.001\)/, '해가 안 보이면 빛줄기 패스를 건너뛴다');
  for (const f of ['js/game3d.js', 'mmo.html']) { const calls = fs.readFileSync(f, 'utf8').match(/createBloom\([^)]*\)/g) || []; assert.ok(calls.length, f); for (const c of calls) assert.doesNotMatch(c, /cine/, f + ' 블룸은 켜지 않는다'); }
});
