/* 카인 두손 IK 할당 없애기 (문서 229 §47) — 계산 순서는 그대로 두고 임시 객체만 재사용했다. 예전 함수(fixtures/kain-hand-ik.ref.js)와 결과가 비트 단위로 같아야 한다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { solveKainHand } from '../js/kain-hand-ik.js';
import { solveKainHand as ref } from './fixtures/kain-hand-ik.ref.js';
let seed = 12345; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647, s = k => (r() * 2 - 1) * k;
const V = (x, y, z) => new THREE.Vector3(x, y, z), rq = () => new THREE.Quaternion().setFromEuler(new THREE.Euler(s(3), s(3), s(3)));
function inputs(withPrev, baked) {
  const shoulder = V(s(.2), 1.4 + s(.05), s(.2)), ar = { outward: V(s(1), s(.3), s(1)).normalize(), foreLocal: V(0, 1, 0), shoulder, upper: .29 + s(.02), lower: .27 + s(.02), lowerElbow: r(), elbowDrop: .08, hingeBasis: rq(), bindLower: rq(), maxLowerAngularRate: withPrev ? 12 : 0, baked, searchFull: false, upperClearanceWeight: 1e6 };
  const palm = shoulder.clone().add(V(s(.4), -.3 + s(.3), .25 + s(.2))), axis = V(s(1), 1, s(1)).normalize(), normal = V(0, 0, 1).cross(axis).normalize();
  const cal = { gripAxis: V(0, 1, 0), frame: rq(), offset: V(s(.03), s(.03), s(.03)) }, body = { forward: V(0, 0, 1), base: V(0, .95, 0), axis: V(0, .45, 0) };
  const previous = withPrev ? { handQ: rq(), elbow: shoulder.clone().add(V(s(.1), -.25, s(.1))), lowerQ: rq() } : null;
  return [ar, palm, axis, normal, cal, 1 + s(.1), rq(), body, previous, 1 / 30];
}
const same = (a, b, path = '') => { if (a && typeof a === 'object') { for (const k of Object.keys(a)) if (typeof a[k] !== 'function') same(a[k], b[k], path + '.' + k); return; } if (typeof a === 'number') assert.ok(Object.is(a, b), path + ' ' + a + ' ≠ ' + b); };
test('예전 함수와 결과가 비트 단위로 같다 — 이전 자세 있음/없음/구운 동작, 무작위 600 가지', () => {
  for (let i = 0; i < 600; i++) { const prev = i % 3 !== 0, baked = i % 17 === 0, x = inputs(prev, baked);
    const a = ref(...x), b = solveKainHand(...x); same(a, b, '#' + i); }
});
test('돌려준 풀이는 호출마다 새 객체 — 다음 호출이 앞 결과를 덮어쓰지 않는다(호출자가 previous 로 들고 있다)', () => {
  const x = inputs(true, false), a = solveKainHand(...x), keep = a.handQ.clone(), y = inputs(true, false); solveKainHand(...y);
  assert.ok(a.handQ.equals(keep)); assert.notEqual(a, solveKainHand(...x));
});
