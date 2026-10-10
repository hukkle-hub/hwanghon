/* 실내 보스 머리 위 공간 (문서 221 §9) — 3.4 m 천장이 4.2 m 클레이브의 머리를 잘라 «목 없는 몸» 이 몇 달 보였다.
   3D 필드(view3d)로 실제 장면을 짓고, 보스 자리 위로 광선을 쏴서 처음 막히는 높이가 보스 키보다 높은지 잰다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { ZONES } from '../js/mmo/zones.js';
import { setView3d } from '../js/mmo/env-lib.js';

const ctx = new Proxy({}, { get: (t, k) => /^create(Linear|Radial)Gradient$|^createPattern$/.test(k) ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}, set: () => true });
const ENV = { dungeon: '../js/mmo/env-dungeon.js', indoor: '../js/mmo/env-indoor.js' };

test('실내 보스: 보스 자리 위 천장이 보스 키(시각 높이)보다 높다 — 머리가 천장 위로 잘리지 않게', async () => {
  const hadDoc = 'document' in globalThis, oldDoc = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }) };
  setView3d(true);
  try {
    const seen = [];
    for (const [id, Z] of Object.entries(ZONES)) { if (!ENV[Z.env]) continue; let meta; try { meta = JSON.parse(fs.readFileSync(`maps/2d/${id}/map.json`, 'utf8')); } catch { continue; }
      const bosses = (meta.bosses || []).filter(b => b.model); if (!bosses.length) continue;
      const osm = Z.osm ? JSON.parse(fs.readFileSync(`maps/2d/${Z.osm}/osm.json`, 'utf8')) : null, scene = new THREE.Scene();
      const { build } = await import(ENV[Z.env]); build(THREE, scene, osm, { id, ...Z, view3d: true }); scene.updateMatrixWorld(true);
      const objs = []; scene.traverse(m => { if (m.isMesh && !(m.material && [].concat(m.material).some(x => x.transparent))) objs.push(m); });
      const rc = new THREE.Raycaster(); rc.far = 60;
      for (const b of bosses) { const h = b.visualH || b.h || 3, top = (b.fly || 0) + h; let low = Infinity;
        for (let k = 0; k <= 8; k++) { const a = k * Math.PI / 4, r = k ? h * .35 : 0;
          rc.set(new THREE.Vector3(b.x + Math.cos(a) * r, .3, b.z + Math.sin(a) * r), new THREE.Vector3(0, 1, 0));
          const hit = rc.intersectObjects(objs, false).find(x => x.point.y > 1.0); if (hit) low = Math.min(low, hit.point.y); }   /* 1 m 아래는 바닥 장식 */
        seen.push(`${id}/${b.id} 키 ${top.toFixed(1)} 천장 ${low === Infinity ? '없음' : low.toFixed(2)}`);
        assert.ok(low > top + 0.2, `${id}/${b.id}: 보스 키 ${top} m 인데 ${low.toFixed(2)} m 에서 막힌다`); } }
    assert.ok(seen.length >= 5, '실내 보스를 다 봤는가: ' + seen.join(' · '));
  } finally { setView3d(false); if (hadDoc) globalThis.document = oldDoc; else delete globalThis.document; }
});
