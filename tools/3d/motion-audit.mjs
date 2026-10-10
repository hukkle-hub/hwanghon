/* 동작 감사 — 디렉터 «스킬 모션이 정상적으로 사람같이 구현되는가» (문서 226).
   사람 관절로 못 하는 것을 클립마다 잰다:
   - 팔꿈치·무릎 역관절(과신전): 경첩 축 반대로 10° 넘게 꺾임 / 경첩 밖으로 꺾임(옆으로 25° 넘게)
   - 비틀림: 아래팔·손·종아리가 뼈 축으로 도는 각(사탕 껍질) — 아래팔 100°·손 80°·종아리 40° 넘으면
   - 목: 가슴 대비 머리 좌우 80° · 숙임/젖힘 70° 넘으면 / 척추: 골반 대비 가슴 비틀기 70° 넘으면
   - 튐: 한 프레임(1/30 s)에 뼈가 60° 넘게 도는 순간
   - 발 파묻힘: 발끝·발목 뼈가 바닥 아래로 (쉬는 자세 높이 기준) 4 cm 넘게
   경첩 축은 해부학으로 정한다(꺾으면 손은 앞, 발은 뒤). 발 파묻힘은 발 정점으로 잰다.
     node tools/3d/motion-audit.mjs art/3d/part1/clave.glb [clip,clip] [--json]  */
import * as T from '../../vendor/three/three.module.js';
import { loadGlb } from './stretch-audit.mjs';
import { makePoser } from './pose-eval.mjs';

const HINGE = ['LeftForeArm', 'RightForeArm', 'LeftLeg', 'RightLeg'];
const TWIST = { LeftForeArm: 100, RightForeArm: 100, LeftHand: 80, RightHand: 80, LeftLeg: 40, RightLeg: 40 };
const GENERIC = /^(idle|walk|run|hit|stagger|death|down|up|lie|kick|atk_(bolt|charge|hammer|hookL|hookR|kick|scythe|slam|spin))$/;
const D = 180 / Math.PI; let clipNow = '';
/* q(부모 기준, 쉬는 자세 대비) 를 뼈 축(+Y) 둘레 비틀림과 그 밖의 흔듦(swing)으로 */
function swingTwist(q) { const tw = new T.Quaternion(0, q.y, 0, q.w).normalize(), sw = q.clone().multiply(tw.clone().invert()); let t = 2 * Math.atan2(tw.y, tw.w); if (t > Math.PI) t -= 2 * Math.PI; if (t < -Math.PI) t += 2 * Math.PI;
  const s = 2 * Math.acos(Math.min(1, Math.abs(sw.w))), ax = new T.Vector3(sw.x, sw.y, sw.z); if (sw.w < 0) ax.negate(); if (ax.lengthSq() > 1e-12) ax.normalize(); return { twist: t * D, swing: s * D, axis: ax }; }
export async function motionAudit(file, clipNames) {
  const g = await loadGlb(file), root = g.scene; let sm = null; root.traverse(o => { if (o.isSkinnedMesh && !sm) sm = o; });
  const B = {}; root.traverse(o => { if (o.isBone) B[o.name.replace(/^mixamorig:?/, '')] = o; });
  const rest = new Map(); root.traverse(o => rest.set(o, [o.position.clone(), o.quaternion.clone()]));
  const restQ = n => rest.get(B[n])[1];
  const reset = () => { for (const [o, [p, q]] of rest) { o.position.copy(p); o.quaternion.copy(q); } };
  root.updateMatrixWorld(true); const W = n => B[n].getWorldPosition(new T.Vector3()), WQ = n => B[n].getWorldQuaternion(new T.Quaternion());
  const neckRest = B.Head && B.Spine2 ? WQ('Spine2').invert().multiply(WQ('Head')) : null, spineRest = B.Hips && B.Spine2 ? WQ('Hips').invert().multiply(WQ('Spine2')) : null;
  /* 발 정점(1위 뼈가 발·발끝) — 뼈 높이로 재면 쉬는 자세 기준이 어긋나 걷기에서도 20 cm 묻힌 걸로 나왔다 */
  const P = sm.geometry.attributes.position, si = sm.geometry.attributes.skinIndex, sw = sm.geometry.attributes.skinWeight, bones = sm.skeleton.bones, feet = [];
  for (let i = 0; i < P.count; i++) { let bw = -1, bb = 0; for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); bb = si.getComponent(i, k); } if (/(Foot|ToeBase)$/.test(bones[bb].name)) feet.push(i); }
  const vv = new T.Vector3(), footMin = () => { sm.skeleton.update(); let m = 1e9; for (let k = 0; k < feet.length; k += 3) { sm.getVertexPosition(feet[k], vv); sm.localToWorld(vv); if (vv.y < m) m = vv.y; } return m; };
  const footRest = footMin(), H = W('Head').y - footRest;
  const mixer = new T.AnimationMixer(root), rel = n => restQ(n).clone().invert().multiply(B[n].quaternion);
  const sample = (clip, fn, step = 1 / 30) => { const poser = makePoser(root, clip);   /* 믹서는 멈춘 구간에서 뼈를 다시 안 써서 «튐» 을 지어냈다 */
    for (let t = 0; t <= clip.duration + 1e-6; t += step) { reset(); poser(t); fn(t); } };
  /* 1) 경첩 축 — 해부학으로: 꺾으면 손은 앞으로, 발은 뒤로 가는 축(쉬는 자세에서 정해 뼈 로컬로 옮김).
     처음엔 일반 클립에서 배우려 했는데 그 클립들은 팔꿈치를 아예 안 굽혔다(아래팔 0°) — 축이 0 이 돼 전부 «경첩 밖 90°» 로 나왔다 */
  reset(); root.updateMatrixWorld(true);
  const fwd = W('LeftToeBase').sub(W('LeftFoot')).setY(0).normalize(), hinge = {};
  for (const n of HINGE) { if (!B[n]) continue; const child = B[n].children.find(c => c.isBone); const dir = child.getWorldPosition(new T.Vector3()).sub(W(n)).normalize();
    let hw = new T.Vector3().crossVectors(dir, fwd).normalize(); const want = /Leg$/.test(n) ? fwd.clone().negate() : fwd;
    const moved = dir.clone().applyAxisAngle(hw, .3).sub(dir); if (moved.dot(want) < 0) hw.negate();
    hinge[n] = hw.applyQuaternion(WQ(n).invert()).normalize(); }   /* 뼈 로컬(쉬는 자세) */
  /* 1b) 기하 경첩 — 위 마디의 «앞» (쉬는 자세 몸 앞을 그 뼈 로컬로 옮겨 두고 매 프레임 그 뼈 회전으로 다시 월드로).
     무릎 꼭짓점(엉덩이-발목 선에서 무릎이 나온 쪽)은 다리 앞, 팔꿈치 꼭짓점은 팔 뒤를 향해야 사람 관절 */
  const LIMB3 = { LeftLeg: ['LeftUpLeg', 'LeftLeg', 'LeftFoot', 1], RightLeg: ['RightUpLeg', 'RightLeg', 'RightFoot', 1], LeftForeArm: ['LeftArm', 'LeftForeArm', 'LeftHand', -1], RightForeArm: ['RightArm', 'RightForeArm', 'RightHand', -1] };
  const frontLocal = {}; for (const [n, [up]] of Object.entries(LIMB3)) if (B[up]) frontLocal[n] = fwd.clone().applyQuaternion(WQ(up).invert());
  /* 위 마디 경첩(쉬는 자세, 위 뼈 로컬) — 굽히면 손은 앞, 발은 뒤로 가는 축. 맞는 꼭짓점 = −(경첩 × 위-끝 선) (문서 227).
     처음엔 «위 뼈의 앞» 을 위-끝 선 둘레로 투영했는데, 마디를 150° 넘게 접으면 위 뼈가 선과 75° 넘게 벌어져 그 투영이 짧아지고 흔들렸다 — 아인 걷기 무릎이 153° 접힌 순간 «옆 63°» 로 나왔지만 굽힘 평면은 경첩에서 7° 였다 */
  const hingeUp = {}; for (const [n, [up, mid, end]] of Object.entries(LIMB3)) { if (!B[up] || !B[mid] || !B[end]) continue; const u = W(mid).sub(W(up)).normalize(), fd = W(end).sub(W(mid)).normalize(), want = /Leg$/.test(n) ? fwd.clone().negate() : fwd;
    let hw = u.clone().cross(want).normalize(); if (fd.clone().applyAxisAngle(hw, .3).sub(fd).dot(want) < 0) hw.negate(); hingeUp[n] = hw.applyQuaternion(WQ(up).invert()); }
  const apex = n => { const [up, mid, end, sgn] = LIMB3[n], a = W(up), k = W(mid), e = W(end), ae = e.clone().sub(a), t = k.clone().sub(a).dot(ae) / ae.lengthSq(), off = k.clone().sub(a.clone().addScaledVector(ae, t));
    const bend = 180 - k.clone().sub(a).angleTo(e.clone().sub(k).negate()) * D, axis = ae.clone().normalize(), pole = hingeUp[n].clone().applyQuaternion(WQ(up)).cross(axis).negate(); void sgn;
    if (off.length() < 1e-4 || pole.lengthSq() < 1e-10) return { bend: 0, dev: 0 }; const dev = off.normalize().angleTo(pole.normalize()) * D; return { bend, dev }; };   /* dev: 0 = 바른 쪽, 180 = 정반대(역관절) */
  /* 2) 클립마다 위반 */
  const clips = g.animations.filter(c => !clipNames || clipNames.includes(c.name)), out = [];
  for (const c of clips) { clipNow = c.name; const r = { clip: c.name, dur: +c.duration.toFixed(2), hyper: [0, 0, ''], offHinge: [0, 0, ''], twist: [0, 0, ''], neck: [0, 0, ''], spine: [0, 0], pop: [0, 0, ''], sink: [0, 0, ''], joints: {} };
    const prev = new Map(); const keep = (k, v, t, who = '') => { if (v > r[k][0]) r[k] = [+v.toFixed(1), +t.toFixed(2), who]; };
    sample(c, t => {
      for (const n of HINGE) { if (!B[n]) continue; const { bend, dev } = apex(n); if (bend < 15) continue;
        if (dev > 120) keep('hyper', bend, t, n); else if (dev > 50) keep('offHinge', dev, t, n);
        if (dev > 50) { const k = n + (dev > 120 ? ' 역' : ' 옆'), v = dev > 120 ? bend : dev; if (!(r.joints[k]?.[0] >= v)) r.joints[k] = [+v.toFixed(1), +t.toFixed(2)]; } }   /* 마디마다 (가장 큰 것 하나에 가려 다른 팔이 안 보였다) */   /* 역관절: 꼭짓점이 반대(120° 넘게) — 값 = 그때 꺾인 각 */
      for (const [n, lim] of Object.entries(TWIST)) { if (!B[n]) continue; const tw = Math.abs(swingTwist(rel(n)).twist); if (tw > lim) keep('twist', tw - lim, t, n); }
      /* 목: 가슴(Spine2) 대비 머리 */
      if (neckRest) { const e = new T.Euler().setFromQuaternion(neckRest.clone().invert().multiply(WQ('Spine2').invert().multiply(WQ('Head'))), 'YXZ'), yaw = Math.abs(e.y * D), pitch = Math.abs(e.x * D);
        if (yaw > 80) keep('neck', yaw - 80, t, 'yaw'); if (pitch > 70) keep('neck', pitch - 70, t, 'pitch'); }
      if (spineRest) { const yaw = Math.abs(new T.Euler().setFromQuaternion(spineRest.clone().invert().multiply(WQ('Hips').invert().multiply(WQ('Spine2'))), 'YXZ').y * D); if (yaw > 70) keep('spine', yaw - 70, t); }
      for (const [n, b] of Object.entries(B)) { const q = b.quaternion.clone(), p = prev.get(n); if (p) { const a = 2 * Math.acos(Math.min(1, Math.abs(p.dot(q)))) * D; if (a > 60) { keep('pop', a, t, n); if (process.env.DBG) console.error('pop', clipNow, n, t.toFixed(4), p.toArray().map(x => x.toFixed(3)).join(), q.toArray().map(x => x.toFixed(3)).join()); } } prev.set(n, q); }
      if (feet.length) { const d = footRest - footMin(); if (d > .04 * H / 1.8) keep('sink', d, t, 'feet'); }
    });
    out.push(r); }
  return { hinge: Object.fromEntries(HINGE.map(n => [n, hinge[n].toArray().map(v => +v.toFixed(2))])), H: +H.toFixed(2), clips: out };
}
if ((process.argv[1] || '').endsWith('motion-audit.mjs')) {
  const [file, list] = process.argv.slice(2).filter(a => !a.startsWith('--')), r = await motionAudit(file, list ? list.split(',') : null);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r)); else { console.log('경첩 축', JSON.stringify(r.hinge), '키', r.H);
    const f = (v, u = '°') => v[0] ? `${v[0]}${u}@${v[1]}s${v[2] ? ' ' + v[2].replace(/^(Left|Right)/, m => m[0]) : ''}` : '·';
    for (const c of r.clips) console.log(`${c.clip.padEnd(18)} 역관절 ${f(c.hyper).padEnd(20)} 경첩밖 ${f(c.offHinge).padEnd(20)} 비틀림 ${f(c.twist).padEnd(20)} 목 ${f(c.neck).padEnd(16)} 척추 ${f(c.spine).padEnd(12)} 튐 ${f(c.pop).padEnd(22)} 발묻힘 ${f(c.sink, 'm')}`); }
}
