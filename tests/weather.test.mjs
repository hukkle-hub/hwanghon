/* 날씨 — 비 (문서 230 §14) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { WX, WX_SLOT, zoneSeed, rainAt, wetAt, weatherNow, applyRain } from '../js/mmo/weather.js';
import { rainStreaks } from '../js/mmo/rain.js';

test('비 일정: 같은 존 · 같은 시각이면 누구나 같다 · 약 28 % · 서서히 오고 그친다 · 그친 뒤 마른다', () => {
  const s = zoneSeed('namsan'); assert.equal(zoneSeed('namsan'), s); assert.notEqual(zoneSeed('gangnam'), s);
  let n = 0, N = 4000, maxJump = 0, prev = rainAt(s, 0); for (let i = 1; i < N * 10; i++) { const r = rainAt(s, i * 6000); maxJump = Math.max(maxJump, Math.abs(r - prev)); prev = r; if (i % 10 === 0 && r > 0.5) n++; }
  assert.ok(n / N > 0.2 && n / N < 0.36, '비 비율 ' + n / N); assert.ok(maxJump < 0.1, '6 초에 ' + maxJump.toFixed(2) + ' — 갑자기 쏟아진다');
  let k = 0; while (!(rainAt(s, k * WX_SLOT + WX_SLOT / 2) > 0.99 && rainAt(s, (k + 1) * WX_SLOT + WX_SLOT / 2) < 0.01)) k++;   /* 비 → 맑음 칸 */
  const end = (k + 1) * WX_SLOT; assert.ok(wetAt(s, end + 3 * 60000) > 0.15, '그치자마자 마르면 안 된다'); assert.ok(wetAt(s, end + 12 * 60000) < 0.05, '12 분 뒤엔 마른다');
  assert.deepEqual(weatherNow(s, 0, 'rain'), { rain: 1, wet: 1 }); assert.deepEqual(weatherNow(s, 0, 'clear'), { rain: 0, wet: 0 });
});
test('비 빛: 하늘 · 안개는 잿빛으로 · 해는 구름 뒤로 · 비가 0 이면 그대로', () => {
  const mk = () => ({ top: new THREE.Color(0.2, 0.1, 0.3), hor: new THREE.Color(0.8, 0.4, 0.3), fog: new THREE.Color(0.3, 0.2, 0.2), hemi: new THREE.Color(0.7, 0.6, 0.8), sunI: 4, glow: 1, hemiI: 2, exp: 1 });
  const a = applyRain(mk(), 0), b = applyRain(mk(), 1); assert.equal(a.sunI, 4);
  const sat = c => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b); assert.ok(sat(b.hor) < sat(a.hor) * 0.5, '노을이 잿빛이 된다'); assert.ok(b.sunI < 1.2 && b.glow < 0.2, '해가 구름 뒤로');
});
test('빗줄기: 그리기 1 번 · 셰이더가 떨어뜨리고 감싼다 · 세기 0 이면 숨는다 · 웅덩이 동심원 · 젖은 땅', () => {
  const R = rainStreaks(THREE, { n: 100 }); assert.ok(R.mesh.isInstancedMesh && R.mesh.count === 100 && !R.mesh.frustumCulled);
  assert.match(R.mesh.material.vertexShader, /mod\(base \+ vel \* uWind - lo, uBox\)/); assert.match(R.mesh.material.vertexShader, /step\(rh\(id \+ 6\.0\), uRain\)/, '세기만큼만');
  assert.equal(R.mesh.material.blending, THREE.AdditiveBlending); assert.equal(R.mesh.material.depthWrite, false);
  WX.uRain.value = 0; R.follow(new THREE.Vector3(), new THREE.Vector3(0, 0, -1)); assert.equal(R.mesh.visible, false); WX.uRain.value = 0.5; R.follow(new THREE.Vector3(), new THREE.Vector3(0, 0, -1)); assert.equal(R.mesh.visible, true); WX.uRain.value = 0;
  const P = fs.readFileSync('js/mmo/puddle-shader.js', 'utf8'); assert.match(P, /vec2 rainRip\(vec2 p\)/); assert.match(P, /pd -= uWet \* 0\.3;/, '비 오면 웅덩이가 넓어진다'); assert.match(P, /uRain: WX\.uRain, uWet: WX\.uWet, uWind: WIND/);
  const W = fs.readFileSync('world3d.html', 'utf8'); assert.match(W, /sh\.uniforms\.uGWet = WX\.uWet/, '젖은 땅'); assert.match(W, /roughnessFactor = mix\(roughnessFactor, max\(uGGloss, roughnessFactor \* 0\.6\), uGWet \* wm\)/);
  assert.match(W, /WX\.uGloss\.value = 0\.45 - 0\.2 \* Math\.min\(1, o\.lampK\)/, '낮 젖은 땅은 0.45 아래로 안 간다(낮은 해 번짐, 문서 217)'); assert.match(W, /applyRain\(o, WXS\.rain\)/); assert.match(W, /weatherNow\(WXSEED, ms, WXF\)/);
});
