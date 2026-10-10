/* 클립 관절 바로잡기 (문서 226) — 디렉터 «스킬 모션이 정상적으로 사람같이 구현되는가».
   1) 역무릎: 엉덩이·발목 자리는 그대로 두고, 엉덩이-발목 선 «뒤» 로 나간 무릎을 발끝 쪽으로 거울 대칭으로 옮긴다(두 뼈 길이 그대로).
      거울은 무릎이 선 위에 올 때 항등이라 프레임 사이가 이어진다(앞/뒤를 «골라» 뒤집으면 경계 프레임에서 튄다). 발 방향은 원래대로 되돌린다.
      Kimodo 생성 동작을 블렌더로 옮겨 구운 전용 기술 클립(tools/3d/boss_takes.py)에서 무릎이 59~77° 뒤로 꺾였다.
   2) 바닥: 손·쥔 소품을 뺀 몸 정점이 쉬는 자세 바닥보다 내려가면 그만큼 골반(Hips 위치)을 올린다 — 일반 클립의 골반 높이가 이 몸들보다 낮아
      대기에서도 발이 18 cm 묻혔다. 올리기만 한다(뜀은 그대로).
   GLB 안 애니메이션 출력 값만 «같은 자리, 같은 크기» 로 덮어쓴다 — 키 시각마다 다시 풀어 쓴다.
     node tools/3d/clip-joint-fix.mjs art/3d/part1/shadow_fang.glb [clip,clip] [--no-knee] [--no-ground] [--no-seams] [--dry] */
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';
import { chunks, writeAccessor, writeGlb } from './skin-rebind.mjs';
import { makePoser } from './pose-eval.mjs';

const SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }, COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function readFloats(json, bin, ai) { const a = json.accessors[ai], bv = json.bufferViews[a.bufferView], nc = COMPS[a.type], es = SIZE[a.componentType], st = bv.byteStride || es * nc, base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  if (a.componentType !== 5126) throw Error('float 아님: accessor ' + ai); const out = new Float32Array(a.count * nc); for (let i = 0; i < a.count; i++) for (let k = 0; k < nc; k++) out[i * nc + k] = bin.readFloatLE(base + i * st + k * 4); return out; }
const LEG = ['UpLeg', 'Leg', 'Foot'];
/* 이음매 (문서 226 §3): 전용 기술 클립은 Kimodo 테이크 여러 개를 이어 붙여 구웠는데(tools/3d/boss_takes.py) 이음새를 섞지 않아
   테이크가 바뀌는 프레임에 뼈가 60~138° 한 번에 돈다(클레이브 폭풍 1.57·2.57·3.57 s, 섀도우 팽 연격 1.3·2.0·2.6·3.3·3.9 s).
   - 시작 결함: 처음 1~3 키만 다른 자세 → 그 다음 키로 채운다
   - 끊김: 큰 걸음(45° 넘게)이 한두 키 이어지고 앞뒤는 작은 곳 → 이음새 앞 0.12 s 동안 끊긴 만큼의 회전을 0 → 1 로 얹어 이음새에서 뒤 테이크에 닿는다(타격 시각 그대로)
   끊긴 «시각» 은 클립 전체에서 한 번 정하고, 그 시각엔 모든 뼈에 같은 섞기를 건다(작은 뼈도 같이 끊겼다) */
const twistY = q => new T.Quaternion(0, q.y, 0, q.w).normalize();   /* 뼈 축(+Y) 둘레 비틀림 */
const qa = (v, i) => new T.Quaternion(v[i * 4], v[i * 4 + 1], v[i * 4 + 2], v[i * 4 + 3]), angD = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))) * 180 / Math.PI;
/* 손목 (문서 226 §5): 손이 자기 축으로 60° 넘게 돌면 넘친 만큼을 아래팔 비틀림(회내·회외)으로 옮긴다(최대 80°) — 손 방향은 그대로, 손목 메시만 덜 꼬인다.
   프레임마다 따로 재면 ±180°에서 부호가 뒤집혀 아래팔이 한 프레임에 140° 튀었다(클레이브 폭풍 3.57 s — 원본에서 손이 3 키에 220° 돈다).
   그래서 트랙 전체에서 비틀림을 이어 붙여(unwrap) 연속된 값으로 나눈다. 둘 다 «자기 뼈 축» 둘레라 손 자리도 그대로.
   다만 클립 앞에서 손이 한 바퀴 돌면 이어 붙인 값이 커져 아래팔이 오래 80° 로 꼬인 채 남았다 — 기본 끔(--wrist) */
function wristPass(clip, { lim = 60, cap = 80 } = {}) {
  let moved = 0;
  for (const sd of ['Left', 'Right']) { const fa = clip.tracks.find(t => /(^|[:]|rig)(Left|Right)ForeArm\.quaternion$/.test(t.name) && t.name.includes(sd + 'ForeArm')), h = clip.tracks.find(t => t.name.endsWith(sd + 'Hand.quaternion'));
    if (!fa || !h || fa.times.length !== h.times.length || h.times.length < 3) continue; const n = h.times.length, tw = [];
    for (let i = 0; i < n; i++) { const q = qa(h.values, i), t = twistY(q); let a = 2 * Math.atan2(t.y, t.w) * 180 / Math.PI; if (a > 180) a -= 360; if (a < -180) a += 360; if (i) { while (a - tw[i - 1] > 180) a -= 360; while (a - tw[i - 1] < -180) a += 360; } tw.push(a); }
    for (let i = 0; i < n; i++) { const x = tw[i], m = Math.sign(x) * Math.min(cap, Math.max(0, Math.abs(x) - lim)); if (Math.abs(m) < .05) continue; moved = Math.max(moved, Math.abs(m));
      const r = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), m * Math.PI / 180);
      qa(fa.values, i).multiply(r).normalize().toArray(fa.values, i * 4); r.invert().multiply(qa(h.values, i)).normalize().toArray(h.values, i * 4); } }
  return moved;
}
function seamPass(clip, { big = 45, blend = .12 } = {}) {
  let rot = clip.tracks.filter(t => t.name.endsWith('.quaternion')); if (!rot.length) return { lead: 0, cuts: [] };
  const n = Math.max(...rot.map(t => t.times.length)); rot = rot.filter(t => t.times.length === n); const times = rot[0].times;   /* 안 움직이는 뼈는 키 2개 — 빼고 */
  if (n < 6) return { lead: 0, cuts: [] };
  const step = i => Math.max(...rot.map(t => angD(qa(t.values, i - 1), qa(t.values, i))));   /* i-1 → i 에서 가장 많이 돈 뼈 */
  const S = [0]; for (let i = 1; i < n; i++) S.push(step(i));
  let lead = 0; for (let i = 1; i <= 3 && i < n - 1; i++) if (S[i] > big && S[i + 1] < 15) lead = i;   /* 0..lead-1 이 결함 */
  if (lead) for (const t of rot) for (let i = 0; i < lead; i++) for (let k = 0; k < 4; k++) t.values[i * 4 + k] = t.values[lead * 4 + k];
  const cuts = []; for (let i = Math.max(2, lead + 1); i < n - 1; i++) { if (S[i] <= big || S[i - 1] > S[i] * .5) continue; let j = i; if (S[i + 1] > big && j + 1 < n - 1) j++; if (S[j + 1] > S[j] * .5) continue; cuts.push([i, j]); i = j; }
  /* 섞기는 이음새 «앞» 에서: 이음새가 곧 타격 순간이다(클레이브 안무 CLAVE_CHOREOGRAPHY — 폭풍 1.6·2.567·3.6 s 가 판정). 뒤에서 섞으면 타격 자세가 판정보다 0.2 s 늦게 온다.
     이음새 앞 blend 초 동안 «끊긴 만큼의 회전» 을 0 → 1 로 얹어, 이음새 키에서 뒤 테이크 자세에 닿게 한다 — 순간이동이 빠른 휘두름이 된다 */
  const N = Math.max(2, Math.round(blend / ((times[n - 1] - times[0]) / (n - 1))));
  for (const [i, j] of cuts) for (const t of rot) { const v = t.values, D = qa(v, j).multiply(qa(v, i - 1).invert()), I = new T.Quaternion(), lo = Math.max(lead, i - N);
    const orig = []; for (let k = lo; k < j; k++) orig.push(qa(v, k));
    for (let k = lo; k < j; k++) { const w = (x => x * x * (3 - 2 * x))((k - lo + 1) / (j - lo + 1)), q = I.clone().slerp(D, w).multiply(k < i ? orig[k - lo] : orig[i - 1 - lo]); q.normalize().toArray(v, k * 4); } }   /* 두 키 끊김: 이미 덮어쓴 앞 키가 아니라 원래 값 */
  return { lead, cuts: cuts.map(([i]) => +times[i].toFixed(3)), rot };
}

export async function fixClips(file, { clips = null, knee = true, ground = true, seams = true, elbow = false, wrist = false, dry = false } = {}) {   /* elbow: 비틀기 맞춤은 ±180° 근처에서 부호가 뒤집혀 튐을 만들었다 — 기본 끔 (문서 226 §4) */
  const raw = fs.readFileSync(file), { json, bin } = chunks(raw), ld = new GLTFLoader(); ld.register(() => ({ name: 'skip', loadTexture: () => Promise.resolve(new T.Texture()) }));
  const g = await ld.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), ''), root = g.scene;
  const B = {}; root.traverse(o => { if (o.isBone) B[o.name.replace(/^mixamorig:?/, '')] = o; });
  let sm = null; root.traverse(o => { if (o.isSkinnedMesh && !sm && !/Held/.test(o.name)) sm = o; });
  const rest = new Map(); root.traverse(o => rest.set(o, [o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
  const reset = () => { for (const [o, [p, q, s]] of rest) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); } };
  const V = () => new T.Vector3(), W = b => b.getWorldPosition(V()), WQ = b => b.getWorldQuaternion(new T.Quaternion());
  /* 몸 정점(1위 뼈가 손·슬롯이 아닌 것) 표본 */
  const P = sm.geometry.attributes.position, si = sm.geometry.attributes.skinIndex, sw = sm.geometry.attributes.skinWeight, bones = sm.skeleton.bones, body = [];
  for (let i = 0; i < P.count; i += 5) { let bw = -1, bb = 0; for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); bb = si.getComponent(i, k); } if (!/Hand/.test(bones[bb].name)) body.push(i); }
  const vv = V(), bodyMin = () => { root.updateMatrixWorld(true); sm.skeleton.update(); let m = 1e9; for (const i of body) { sm.getVertexPosition(i, vv); sm.localToWorld(vv); if (vv.y < m) m = vv.y; } return m; };
  reset(); const floor = bodyMin();
  /* 팔꿈치 경첩(쉬는 자세의 «앞으로 굽힘» 축)을 위팔 로컬에 둔다 — 몸 앞 = 발→발끝 */
  const fwd = W(B.LeftToeBase).sub(W(B.LeftFoot)).setY(0).normalize(), HINGE = {};
  for (const sd of ['Left', 'Right']) { const a = B[sd + 'Arm'], f = B[sd + 'ForeArm'], h = B[sd + 'Hand']; if (!a || !f || !h) continue; const u = W(f).sub(W(a)).normalize(), fd = W(h).sub(W(f)).normalize();
    let hw = u.clone().cross(fwd).normalize(); if (fd.clone().applyAxisAngle(hw, .3).sub(fd).dot(fwd) < 0) hw.negate(); HINGE[sd] = hw.applyQuaternion(WQ(a).invert()); }
  const setWorldQ = (b, q) => { b.quaternion.copy(WQ(b.parent).invert().multiply(q)); b.updateMatrixWorld(true); };
  const turn = (b, from, to) => { const p = W(b), v1 = from.clone().sub(p).normalize(), v2 = to.clone().sub(p).normalize(); if (v1.distanceTo(v2) < 1e-7) return; setWorldQ(b, new T.Quaternion().setFromUnitVectors(v1, v2).multiply(WQ(b))); };
  const stat = { knee: 0, kneeMax: 0, lift: 0, elbow: 0 };
  function fixPose() {
    root.updateMatrixWorld(true);
    if (knee) for (const s of ['Left', 'Right']) { const up = B[s + 'UpLeg'], leg = B[s + 'Leg'], foot = B[s + 'Foot'], toe = B[s + 'ToeBase']; if (!up || !leg || !foot || !toe) continue;
      const h = W(up), k = W(leg), a = W(foot), ax = a.clone().sub(h).normalize(), off = k.clone().sub(h), along = off.dot(ax), perp = off.clone().addScaledVector(ax, -along);
      const pole = W(toe).sub(a); pole.addScaledVector(ax, -pole.dot(ax)); if (pole.lengthSq() < 1e-10) continue; pole.normalize();
      const d = perp.dot(pole); if (d >= 0) continue;
      const kNew = h.clone().addScaledVector(ax, along).add(perp.clone().addScaledVector(pole, -2 * d)), fq = WQ(foot), tw0 = twistY(leg.quaternion);
      turn(up, k, kNew); root.updateMatrixWorld(true); turn(leg, W(foot), a);
      /* 종아리 비틀림(허벅지 기준, 뼈 축 둘레)은 원래대로 — 최소 회전 두 번이 비틀림을 70° 까지 얹어 무릎이 사탕 껍질처럼 꼬였다 */
      { const q = leg.quaternion, tw1 = twistY(q), sw = q.clone().multiply(tw1.invert()); leg.quaternion.copy(sw.multiply(tw0)); leg.updateMatrixWorld(true); }
      root.updateMatrixWorld(true); setWorldQ(foot, fq);
      stat.knee++; stat.kneeMax = Math.max(stat.kneeMax, -d); }
    /* 팔꿈치: 위팔을 자기 축 둘레로만 돌려 경첩을 굽힘 평면에 — 뼈 자리는 그대로, 손 방향도 그대로. 위팔 비틀기는 ±100° 까지 */
    if (elbow) for (const sd of ['Left', 'Right']) { const a = B[sd + 'Arm'], f = B[sd + 'ForeArm'], h = B[sd + 'Hand']; if (!HINGE[sd]) continue;
      const u = W(f).sub(W(a)).normalize(), wp = W(h), fd = wp.clone().sub(W(f)).normalize(), bend = Math.acos(Math.max(-1, Math.min(1, u.dot(fd)))) * 180 / Math.PI;
      const wgt = Math.max(0, Math.min(1, (bend - 10) / 15)); if (!wgt) continue;
      const n = u.clone().cross(fd).normalize(), hw = HINGE[sd].clone().applyQuaternion(WQ(a)); hw.addScaledVector(u, -hw.dot(u)).normalize();
      let phi = Math.atan2(u.dot(hw.clone().cross(n)), hw.dot(n)) * wgt; phi = Math.max(-100 * Math.PI / 180, Math.min(100 * Math.PI / 180, phi)); if (Math.abs(phi) < 1e-3) continue;
      const hq = WQ(h); setWorldQ(a, new T.Quaternion().setFromAxisAngle(u, phi).multiply(WQ(a))); root.updateMatrixWorld(true); turn(f, W(h), wp); root.updateMatrixWorld(true); setWorldQ(h, hq);
      stat.elbow = Math.max(stat.elbow || 0, Math.abs(phi) * 180 / Math.PI); }
    if (ground) { const m = bodyMin(), lift = floor - m; if (lift > 1e-4) { const hp = W(B.Hips); hp.y += lift; B.Hips.position.copy(B.Hips.parent.worldToLocal(hp)); stat.lift = Math.max(stat.lift, lift); } }
    root.updateMatrixWorld(true);
  }
  const done = [];
  for (const ja of json.animations) { if (clips && !clips.includes(ja.name)) continue; const clip = g.animations.find(c => c.name === ja.name); if (!clip) continue;
    const sp = seams ? seamPass(clip) : { lead: 0, cuts: [] }, wm = wrist ? wristPass(clip) : 0, seamed = sp.lead || sp.cuts.length || wm > .05;
    const poser = makePoser(root, clip), cache = new Map(); stat.elbow = 0; stat.wrist = wm;   /* 믹서 대신 — 멈춘 구간에서 믹서는 뼈를 다시 안 쓴다 */ const s0 = { ...stat }; stat.knee = 0; stat.kneeMax = 0; stat.lift = 0;
    const pose = t => { const key = t.toFixed(5); let r = cache.get(key); if (r) return r; reset(); poser(t); fixPose();
      r = { Hips: B.Hips.position.clone() }; for (const s of ['Left', 'Right']) for (const n of [...LEG, 'Arm', 'ForeArm', 'Hand']) if (B[s + n]) r[s + n] = B[s + n].quaternion.clone(); cache.set(key, r); return r; };
    let wrote = 0;
    for (const ch of ja.channels) { const node = json.nodes[ch.target.node], name = (node.name || '').replace(/^mixamorig:?/, ''), smp = ja.samplers[ch.sampler];
      const want = (ch.target.path === 'rotation' && knee && /^(Left|Right)(UpLeg|Leg|Foot)$/.test(name)) || (ch.target.path === 'rotation' && elbow && /^(Left|Right)(Arm|ForeArm|Hand)$/.test(name)) || (ch.target.path === 'translation' && ground && name === 'Hips');
      if (!want && seamed && ch.target.path === 'rotation') { const tr = clip.tracks.find(t => t.name.replace(/^mixamorig:?/, '') === name + '.quaternion' || t.name === node.name + '.quaternion');
        if (tr && json.accessors[smp.output].count === tr.times.length) { if (!dry) writeAccessor(json, bin, smp.output, (i, k) => tr.values[i * 4 + k]); wrote++; } continue; }   /* 이음매만 손본 뼈 — 고친 트랙 값 그대로 */
      if (!want) continue; const times = readFloats(json, bin, smp.input), vals = Array.from(times, t => pose(t)[name]);   /* Float32Array.map 은 숫자만 돌려준다 */
      if (!dry) writeAccessor(json, bin, smp.output, (i, k) => vals[i].toArray()[k]); wrote++; }
    done.push({ clip: ja.name, channels: wrote, knees: stat.knee, kneeMax: +stat.kneeMax.toFixed(3), lift: +stat.lift.toFixed(3), lead: sp.lead, cuts: sp.cuts, elbow: +(stat.elbow || 0).toFixed(1), wrist: +(stat.wrist || 0).toFixed(1) }); void s0; }
  if (!dry) { json.asset = json.asset || {}; json.asset.extras = { ...(json.asset.extras || {}), clipJointFix: { v: 4, by: 'tools/3d/clip-joint-fix.mjs', knee, ground, seams, elbow, wrist } }; writeGlb(file, json, bin); }
  return done;
}
if ((process.argv[1] || '').endsWith('clip-joint-fix.mjs')) {
  const a = process.argv.slice(2), [file, list] = a.filter(x => !x.startsWith('--'));
  const r = await fixClips(file, { clips: list ? list.split(',') : null, knee: !a.includes('--no-knee'), ground: !a.includes('--no-ground'), seams: !a.includes('--no-seams'), elbow: a.includes('--elbow'), wrist: a.includes('--wrist'), dry: a.includes('--dry') });
  for (const x of r) console.log(`${x.clip.padEnd(18)} 쓴 채널 ${x.channels} · 고친 무릎 키 ${x.knees} (최대 ${x.kneeMax} m 뒤) · 골반 올림 최대 ${x.lift} m${x.lead ? ' · 시작 결함 ' + x.lead + '키' : ''}${x.cuts.length ? ' · 끊김 ' + x.cuts.join('/') + ' s' : ''}${x.elbow > 5 ? ' · 위팔 비틂 최대 ' + x.elbow + '°' : ''}${x.wrist > 1 ? ' · 손목→아래팔 ' + x.wrist + '°' : ''}`);
}
