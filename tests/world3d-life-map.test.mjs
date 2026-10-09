/* 3D 필드 — 살아 있는 도시 · 전국 지도 (문서 219) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { createCityLife } from '../js/mmo/city-life.js';
import { koreaMapSVG, mapEdges } from '../js/mmo/korea-map.js';
import { ZONES } from '../js/mmo/zones.js';
import { REGIONS } from '../js/mmo/regions.js';
import { linkGates } from '../js/mmo/zone-links.js';

test('살아 있는 도시: 까마귀 떼·연기 기둥·떠다니는 재가 그리기 3번(인스턴스·점 두 묶음), 같은 지역은 늘 같은 하늘, 막이·카메라 막이 없음', () => {
  const mk = () => { const scene = new THREE.Scene(), blink = new THREE.MeshStandardMaterial(); blink.userData.blink = 1.4; const glow = new THREE.MeshStandardMaterial(); glow.userData.farGlow = 0.5;
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), blink), new THREE.Mesh(new THREE.BoxGeometry(), glow));
    const L = createCityLife(THREE, scene, { tops: [[200, 20, 0], [0, 25, 300], [-250, 18, -100], [205, 20, 5]], seed: 42 }); return { scene, L, blink, glow }; };
  const a = mk(), b = mk(); a.L.tick(1.3, 1.9); b.L.tick(1.3, 1.9);
  assert.equal(a.L.counts.plumes, 3, '90 m 안에 붙은 연기 기둥은 하나로'); assert.equal(a.L.counts.birds, 30);
  assert.deepEqual(Array.from(a.L.birds.instanceMatrix.array), Array.from(b.L.birds.instanceMatrix.array), '같은 시드인데 하늘이 다르다');
  const extra = a.scene.children.filter(o => o.isInstancedMesh || o.isPoints); assert.equal(extra.length, 3, '그리기 호출이 늘었다');   /* 까마귀 · 연기 · 떠다니는 재(문서 220 §11) */
  for (const o of extra) assert.ok(o.userData.noCam);
  assert.ok(a.glow.emissiveIntensity > 0.5 * 1.5, '밤인데 먼 도시 창 불빛이 안 켜졌다'); b.L.tick(0.01, 0); assert.ok(b.glow.emissiveIntensity < 0.5 * 0.5, '낮인데 창 불빛이 켜져 있다');
  const src = fs.readFileSync(new URL('../js/mmo/city-life.js', import.meta.url), 'utf8'); assert.ok(!/Math\.random\(/.test(src), "Math.random() 을 쓰면 사람마다 하늘이 다르다");
  assert.match(src, /vec4 mvPosition = modelViewMatrix/, 'three 안개 조각(fog_vertex)은 mvPosition 이라는 이름을 쓴다 — mv 로 쓰면 연기 셰이더가 안 돈다');
});

test('전국 지도: 모든 필드가 점으로, 길이 끊김 없이 한 덩어리 · 지하·배는 점선 · 지금 자리 강조', () => {
  const field = Object.keys(ZONES).filter(z => ZONES[z].kind === 'field'), E = mapEdges(ZONES, linkGates);
  const adj = new Map(field.map(z => [z, []])); for (const e of E) { adj.get(e.a)?.push(e.b); adj.get(e.b)?.push(e.a); }
  const seen = new Set(['gangnam']), q = ['gangnam']; while (q.length) for (const n of adj.get(q.shift()) || []) if (!seen.has(n)) { seen.add(n); q.push(n); }
  assert.deepEqual(field.filter(z => !seen.has(z)), [], '지도에서 떨어진 지역');
  assert.ok(E.some(e => e.ferry && [e.a, e.b].sort().join() === 'jeju,mokpo'), '목포 ⇢ 제주 배');
  assert.ok(E.some(e => e.via && [e.a, e.b].sort().join() === 'namsan,yeouido'), '남산 ⇢ 여의도 (지하 공동구)');
  const svg = koreaMapSVG({ ZONES, REGIONS, linkGates, current: 'daejeon' });
  assert.ok((svg.match(/<animate /g) || []).length === 1, '지금 자리 반짝임'); assert.match(svg, /fill="#7af0c8"[^>]*>대전역</);
  for (const r of REGIONS) if (ZONES[r.zone || r.id]?.kind === 'field') assert.ok(svg.includes('>' + r.name + '<'), r.name + ' 이름이 없다');
});

test('world3d: 지도 단추(64 px · 가방 아래) · 지도는 hidden 이 이기게 · 닫기', () => {
  const s = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8');
  assert.match(s, /#mapBtn\{ width:64px; height:64px;/); assert.match(s, /#kmap:not\(\[hidden\]\)\{/); assert.match(s, /min-width:64px; min-height:64px;/);
  assert.match(s, /koreaMapSVG\(\{ ZONES, REGIONS, linkGates, current: ZONE \}\)/); assert.match(s, /if \(LIFE\) LIFE\.tick\(dt, lampK, cam\.position\);/);
});

test('떠다니는 재: 카메라를 감싸 감기고(CPU 갱신 없음) · 밤엔 푸르고 옅다', () => {
  const scene = new THREE.Scene(), L = createCityLife(THREE, scene, { seed: 3 }), u = L.motes.material.uniforms, p0 = Array.from(L.motes.geometry.attributes.position.array);
  L.tick(5, 1, new THREE.Vector3(100, 0, -50)); assert.deepEqual(Array.from(L.motes.geometry.attributes.position.array), p0, '알갱이 자리는 셰이더가 움직인다'); assert.deepEqual(u.uCam.value.toArray(), [100, 0, -50]);
  const dusk = u.uCol.value.clone(), aD = u.uA.value; L.tick(0.1, 1.9); assert.ok(u.uCol.value.b > dusk.b && u.uA.value < aD, '밤 색');
  assert.match(L.motes.material.vertexShader, /mod\(p\.xz - uCam\.xz \+ 20\.0, 40\.0\)/); assert.equal(L.counts.motes, 400);
});
