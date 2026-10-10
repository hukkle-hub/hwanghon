/* 클립 관절 바로잡기 (문서 226) — 디렉터 «스킬 모션이 정상적으로 사람같이 구현되는가».
   1) 역무릎: 엉덩이·발목 자리는 그대로 두고, 엉덩이-발목 선 «뒤» 로 나간 무릎을 발끝 쪽으로 거울 대칭으로 옮긴다(두 뼈 길이 그대로).
      거울은 무릎이 선 위에 올 때 항등이라 프레임 사이가 이어진다(앞/뒤를 «골라» 뒤집으면 경계 프레임에서 튄다). 발 방향은 원래대로 되돌린다.
      Kimodo 생성 동작을 블렌더로 옮겨 구운 전용 기술 클립(tools/3d/boss_takes.py)에서 무릎이 59~77° 뒤로 꺾였다.
   2) 바닥: 손·쥔 소품을 뺀 몸 정점이 쉬는 자세 바닥보다 내려가면 그만큼 골반(Hips 위치)을 올린다 — 일반 클립의 골반 높이가 이 몸들보다 낮아
      대기에서도 발이 18 cm 묻혔다. 올리기만 한다(뜀은 그대로).
   3) (문서 227) 팔꿈치 거울 + 위팔·허벅지 비틀기 계획(옆꺾임) · 손목 감기 풀기 + 넘친 비틀림을 아래팔로.
   GLB 안 애니메이션 출력 값만 «같은 자리, 같은 크기» 로 덮어쓴다 — 키 시각마다 다시 풀어 쓴다.
     node tools/3d/clip-joint-fix.mjs art/3d/part1/shadow_fang.glb [clip,clip] [--no-knee] [--no-ground] [--no-seams] [--no-elbow] [--no-leg-twist] [--no-wrist] [--dry]   (영웅 몸: --no-elbow --no-wrist --no-seams --no-ground) */
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
/* 손목 (문서 227): 손이 자기 축으로 도는 값(쉬는 자세 기준 비틀림)을 트랙 전체에서 이어 붙여(unwrap) 본다.
   클레이브 폭풍은 타격마다 손이 360° 를 돌아(이어 붙인 값이 끝에 1231°) 매번 ±180° 를 지나며 손목 살이 한 점으로 꼬였다.
   1) 감기 풀기: 180°+360k 를 넘는 곳마다 앞뒤 N 키 창 안을, 창 양 끝의 «감긴 수를 뺀 값» 사이 직선으로 바꾼다 — 180° 를 지나지 않고 반대로 돈다.
      창 밖은 360° 의 배수만 뺐으니 손 방향이 원래와 똑같다.
   2) 넘친 비틀림: 그래도 lim° 넘는 몫(최대 cap°)은 아래팔 비틀림(회내·회외)으로 옮긴다 — 손 방향은 그대로.
   문서 226 에서 버린 판은 매 프레임 따로 재거나(±180° 에서 140° 튐), 감긴 수를 안 빼고 이어 붙인 값을 그대로 옮겨(아래팔이 오래 80° 꼬임) 실패했다 */
function wristPass(clip, { lim = 60, cap = 80, N = 5 } = {}) {
  let moved = 0, unwound = 0; const D = 180 / Math.PI;
  for (const sd of ['Left', 'Right']) { const fa = clip.tracks.find(t => t.name.endsWith(sd + 'ForeArm.quaternion')), h = clip.tracks.find(t => t.name.endsWith(sd + 'Hand.quaternion'));
    if (!fa || !h || fa.times.length !== h.times.length || h.times.length < 3 || !h.restQ) continue; const n = h.times.length, ri = h.restQ.clone().invert(), u = [];
    for (let i = 0; i < n; i++) { const t = twistY(ri.clone().multiply(qa(h.values, i))); let a = 2 * Math.atan2(t.y, t.w) * D; while (a > 180) a -= 360; while (a < -180) a += 360; if (i) { while (a - u[i - 1] > 180) a -= 360; while (a - u[i - 1] < -180) a += 360; } u.push(a); }
    const w = u.map(x => 360 * Math.round(x / 360)), v = u.map((x, i) => x - w[i]);   /* v: 감긴 수를 뺀 값 (−180..180) */
    const wins = []; for (let i = 1; i < n; i++) if (w[i] !== w[i - 1]) { const lo = Math.max(0, i - N), hi = Math.min(n - 1, i - 1 + N); if (wins.length && lo <= wins[wins.length - 1][1]) wins[wins.length - 1][1] = hi; else wins.push([lo, hi]); }
    /* 손이 쉬는 자세에서 100° 넘게 꺾인 창은 그대로 둔다 — 그만큼 꺾이면 «축 둘레 비틀림» 이 잘 안 정해져(꺾임과 비틀림이 서로 맞바뀜) 비틀림만 바꾸면 손 전체가 한 키 95° 튀었다(클레이브 폭풍 3.57 s).
       그 창 안팎 N 키는 아래팔로 옮기는 몫도 0 으로 줄인다(옮길 값이 ±180° 에서 뒤집히니까) */
    const bendAt = i => { const r = ri.clone().multiply(qa(h.values, i)), sw = r.clone().multiply(twistY(r).invert()); return 2 * Math.acos(Math.min(1, Math.abs(sw.w))) * D; };
    const taper = new Float32Array(n).fill(1);
    for (const [lo, hi] of wins) { let bent = 0; for (let i = lo; i <= hi; i++) bent = Math.max(bent, bendAt(i));
      if (bent > 100) { for (let i = 0; i < n; i++) { const dd = i < lo ? lo - i : i > hi ? i - hi : 0; taper[i] = Math.min(taper[i], Math.min(1, dd / N)); } continue; }
      for (let i = lo + 1; i < hi; i++) { const x = (i - lo) / (hi - lo); v[i] = v[lo] * (1 - x) + v[hi] * x; unwound = Math.max(unwound, Math.abs((u[i] - w[i]) - v[i])); } }
    for (let i = 0; i < n; i++) { const d = (u[i] - v[i]) / D;   /* 이 키에서 손을 자기 축으로 거꾸로 돌릴 양 (창 밖은 360° 배수 = 방향 그대로) */
      let q = qa(h.values, i); if (Math.abs(d) > 1e-6) q = q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -d));
      const m = Math.sign(v[i]) * Math.min(cap, Math.max(0, Math.abs(v[i]) - lim)) * taper[i]; moved = Math.max(moved, Math.abs(m));
      if (Math.abs(m) > .05) { const r = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), m / D); qa(fa.values, i).multiply(r).normalize().toArray(fa.values, i * 4); q = r.invert().multiply(q); }
      q.normalize().toArray(h.values, i * 4); } }
  return { moved, unwound };
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

export async function fixClips(file, { clips = null, knee = true, ground = true, seams = true, elbow = true, legTwist = true, wrist = true, kneePole = process.env.KNEE_POLE || 'thigh', dry = false } = {}) {   /* elbow·legTwist: 문서 227 — 거울 뒤 비틀기 계획 */
  const raw = fs.readFileSync(file), { json, bin } = chunks(raw), ld = new GLTFLoader(); for (const name of ['skip', 'EXT_texture_webp']) ld.register(() => ({ name, loadTexture: () => Promise.resolve(new T.Texture()) }));   /* 휴대폰 모델(art/3d/lod)은 webp 텍스처 */
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
  /* 경첩(쉬는 자세의 «굽힘» 축)을 위 마디 로컬에 둔다 — 몸 앞 = 발→발끝. 굽히면 손은 앞으로, 발은 뒤로 */
  const fwd = W(B.LeftToeBase).sub(W(B.LeftFoot)).setY(0).normalize(), HINGE = {}, LIMB = {};
  for (const sd of ['Left', 'Right']) { LIMB[sd + 'Arm'] = [sd + 'Arm', sd + 'ForeArm', sd + 'Hand', fwd]; LIMB[sd + 'Leg'] = [sd + 'UpLeg', sd + 'Leg', sd + 'Foot', fwd.clone().negate()]; }
  for (const [key, [un, mn, en, want]] of Object.entries(LIMB)) { const a = B[un], f = B[mn], h = B[en]; if (!a || !f || !h) continue; const u = W(f).sub(W(a)).normalize(), fd = W(h).sub(W(f)).normalize();
    let hw = u.clone().cross(want).normalize(); if (fd.clone().applyAxisAngle(hw, .3).sub(fd).dot(want) < 0) hw.negate(); HINGE[key] = hw.applyQuaternion(WQ(a).invert()); }
  const setWorldQ = (b, q) => { b.quaternion.copy(WQ(b.parent).invert().multiply(q)); b.updateMatrixWorld(true); };
  const turn = (b, from, to) => { const p = W(b), v1 = from.clone().sub(p).normalize(), v2 = to.clone().sub(p).normalize(); if (v1.distanceTo(v2) < 1e-7) return; setWorldQ(b, new T.Quaternion().setFromUnitVectors(v1, v2).multiply(WQ(b))); };
  /* 거울: 위·끝 마디 자리는 그대로, 둘을 잇는 선에서 가운데 마디가 «틀린 쪽» 으로 나갔으면 맞는 쪽으로 거울 대칭(두 뼈 길이 그대로).
     거울은 마디가 선 위일 때 항등이라 프레임 사이가 이어진다(앞/뒤를 «골라» 뒤집으면 경계 프레임에서 튄다). 가운데 뼈 비틀림·끝 방향은 원래대로.
     무릎의 맞는 쪽 = 발끝 쪽(처음부터). 팔꿈치 = −(경첩 × 위팔), 경첩으로 굽히면 손이 가는 쪽의 반대 — 정반대로 꺾인 팔(±180°)을 비틀기로만 맞추려면 위팔을 145° 넘게 돌려야 했다 */
  /* 위 뼈의 X 축을 «위 뼈 → 아래 뼈» 최소 회전으로 옮긴 것과 아래 뼈 X 축이 아래 뼈 축 둘레로 이루는 각 — 접힘이 180° 가 아니면 늘 정해진다 */
  const relTwist = (a, f, h) => { const ua = W(f).sub(W(a)).normalize(), fd = W(h).sub(W(f)).normalize(), xt = new T.Vector3(1, 0, 0).applyQuaternion(WQ(a)).applyQuaternion(new T.Quaternion().setFromUnitVectors(ua, fd)), xf = new T.Vector3(1, 0, 0).applyQuaternion(WQ(f));
    xt.addScaledVector(fd, -xt.dot(fd)); xf.addScaledVector(fd, -xf.dot(fd)); return Math.atan2(fd.dot(xt.clone().cross(xf)), xt.dot(xf)); };
  const mirror = key => { const [un, mn, en] = LIMB[key], a = B[un], f = B[mn], h = B[en]; if (!HINGE[key]) return 0;
    const s0 = W(a), k = W(f), e = W(h), ax = e.clone().sub(s0).normalize(), off = k.clone().sub(s0), along = off.dot(ax), perp = off.clone().addScaledVector(ax, -along);
    const pole = /Leg$/.test(key) && kneePole === 'toe' ? W(B[key.replace('Leg', 'ToeBase')]).sub(e) : HINGE[key].clone().applyQuaternion(WQ(a)).cross(ax).negate();   /* −(경첩 × 위-끝 선): 경첩대로 굽은 마디가 나오는 쪽. 처음엔 −(경첩 × 위 뼈)였는데 무릎을 157° 접으면(세라 달리기) 위 뼈가 선과 78° 벌어져 그 «앞» 이 짧아지고 부호가 뒤집혀, 바른 무릎을 거울로 뒤집어 한 키 140° 튀었다 */
    pole.addScaledVector(ax, -pole.dot(ax)); if (pole.lengthSq() < 1e-10) return 0; pole.normalize();
    const d = perp.dot(pole); if (process.env.DBG_MIRROR && key === process.env.DBG_MIRROR) console.error('mirror', key, curT.toFixed(3), d.toFixed(4), perp.length().toFixed(4)); if (d >= 0) return 0;
    const kNew = s0.clone().addScaledVector(ax, along).add(perp.clone().addScaledVector(pole, -2 * d)), hq = WQ(h), tw0 = relTwist(a, f, h), fq0 = WQ(f), fd0 = e.clone().sub(k).normalize();
    turn(a, k, kNew); root.updateMatrixWorld(true); turn(f, W(h), e);
    /* 가운데 뼈 비틀림(위 마디 기준, 뼈 축 둘레)은 원래대로 — 최소 회전 두 번이 비틀림을 70° 까지 얹어 무릎이 사탕 껍질처럼 꼬였다.
       비틀림은 relTwist 로 잰다: 처음엔 로컬 회전을 «축 둘레/나머지» 로 갈랐는데 마디를 120° 넘게 접으면 그 가름이 뒤집혀(카인 공격1 팔꿈치) 아래팔이 한 키 140° 돌았다 */
    { const fd = W(h).sub(W(f)).normalize();
      if (/Leg$/.test(key) || process.env.ARM_REL) setWorldQ(f, new T.Quaternion().setFromAxisAngle(fd, tw0 - relTwist(a, f, h)).multiply(WQ(f)));
      else setWorldQ(f, new T.Quaternion().setFromUnitVectors(fd0, fd).multiply(fq0)); }   /* 팔: 아래팔은 원래 월드 방향에서 최소 회전만 — 위팔 기준 비틀림을 지키면 팔꿈치가 정·역을 0.05 s 에 오가는 카인 공격1에서 아래팔이 한 키 117° 돌았다 */
    root.updateMatrixWorld(true); setWorldQ(h, hq); return -d; };
  const mirrorAll = () => { for (const key of Object.keys(LIMB)) { const isLeg = /Leg$/.test(key); if (isLeg ? !knee : !elbow) continue; const d = mirror(key);
      if (d > 0) { if (isLeg) { stat.knee++; stat.kneeMax = Math.max(stat.kneeMax, d); } else stat.elbowMirror = Math.max(stat.elbowMirror || 0, d); } } };
  /* 지금 자세의 굽힘 평면이 경첩에서 몇 도 돌아가 있나 (위 마디 축 둘레, 부호 있음) · 굽힘 정도에 따른 무게(곧은 마디는 평면이 없다) */
  const limbRaw = key => { const [un, mn, en] = LIMB[key], a = B[un], u = W(B[mn]).sub(W(a)).normalize(), fd = W(B[en]).sub(W(B[mn])).normalize(), bend = Math.acos(Math.max(-1, Math.min(1, u.dot(fd)))) * 180 / Math.PI;
    const n = u.clone().cross(fd); if (n.lengthSq() < 1e-10) return { phi: 0, w: 0 }; n.normalize(); const hw = HINGE[key].clone().applyQuaternion(WQ(a)); hw.addScaledVector(u, -hw.dot(u)).normalize();
    return { phi: Math.atan2(u.dot(hw.clone().cross(n)), hw.dot(n)), w: Math.max(0, Math.min(1, (bend - 6) / 10)) }; };   /* 감사는 15° 부터 본다 — 곧게 가까운 팔도 옆으로 꺾이면 팔꿈치 살이 옆으로 접힌다 */
  /* 클립 하나의 비틀기 계획: 키 시각마다 (거울 뒤) raw 를 재고 → 경첩에서 keep° 안이면 0, 넘친 만큼만 → 최대 lim° → 앞뒤 키로 부드럽게.
     키마다 따로 정해 바로 쓰면 꼭짓점이 정반대(±180°)일 때 부호가 뒤집혀 손이 한 키 163° 튀었다(거울이 먼저 정반대를 없앤다) */
  const SMOOTH = +(process.env.TW_SMOOTH || .05);
  const TWK = { Arm: [20, +(process.env.ARM_LIM ?? 90)], Leg: [20, 60] };
  function planTwist(clip, poser) {
    const tr = clip.tracks.find(t => /LeftForeArm\.quaternion$/.test(t.name)) || clip.tracks.find(t => /Hips\.quaternion$/.test(t.name)); if (!tr || tr.times.length < 3) return null; const times = Array.from(tr.times), out = {};
    const keys = Object.keys(LIMB).filter(k => HINGE[k] && (/Leg$/.test(k) ? knee && legTwist : elbow)); if (!keys.length) return null;
    const raws = times.map(t => { reset(); poser(t); mirrorAll(); return Object.fromEntries(keys.map(k => [k, limbRaw(k)])); });
    for (const key of keys) { const [keep, lim] = TWK[/Leg$/.test(key) ? 'Leg' : 'Arm'], K = keep * Math.PI / 180, L = lim * Math.PI / 180;
      const want = raws.map(r => { const { phi: p, w } = r[key]; return Math.max(-L, Math.min(L, Math.sign(p) * Math.max(0, Math.abs(p) - K))) * w; });   /* 거울 뒤라 |p| ≤ 90° 언저리 — 이어 붙일 가지가 없다 */
      if (process.env.DBG_ELBOW) raws.forEach((r, i) => console.error(clip.name, key, times[i].toFixed(3), (r[key].phi * 180 / Math.PI).toFixed(1), r[key].w.toFixed(2), (want[i] * 180 / Math.PI).toFixed(1)));
      out[key] = want.map((_, i) => { let s = 0, ws = 0; for (let j = 0; j < want.length; j++) { const dt = (times[j] - times[i]) / SMOOTH; if (Math.abs(dt) > 3) continue; const g = Math.exp(-dt * dt / 2); s += want[j] * g; ws += g; } return s / ws; }); }   /* 시간으로 (키 수로 하면 60 fps 영웅 클립에서 절반 폭이었다) */
    return (key, t) => { const v = out[key]; if (!v) return 0; if (t <= times[0]) return v[0]; if (t >= times[times.length - 1]) return v[v.length - 1]; let i = 1; while (times[i] < t) i++; const x = (t - times[i - 1]) / (times[i] - times[i - 1]); return v[i - 1] * (1 - x) + v[i] * x; };
  }
  let twistPlan = null, curT = 0;
  const stat = { knee: 0, kneeMax: 0, lift: 0, elbow: 0, legTwist: 0 };
  function fixPose() {
    root.updateMatrixWorld(true);
    mirrorAll();
    /* 비틀기: 위 마디를 자기 축 둘레로만 돌려(상완·고관절 회전) 굽힘 평면을 경첩 쪽으로 — 세 마디 자리와 끝(손·발) 방향은 그대로, 가운데 뼈는 다시 겨눔 */
    if (twistPlan) for (const key of Object.keys(LIMB)) { const [un, mn, en] = LIMB[key], a = B[un], f = B[mn], h = B[en]; const phi = twistPlan(key, curT); if (Math.abs(phi) < 1e-3) continue;
      const u = W(f).sub(W(a)).normalize(), wp = W(h), hq = WQ(h); setWorldQ(a, new T.Quaternion().setFromAxisAngle(u, phi).multiply(WQ(a))); root.updateMatrixWorld(true); turn(f, W(h), wp); root.updateMatrixWorld(true); setWorldQ(h, hq);
      const k = /Leg$/.test(key) ? 'legTwist' : 'elbow'; stat[k] = Math.max(stat[k] || 0, Math.abs(phi) * 180 / Math.PI); }
    if (ground) { const m = bodyMin(), lift = floor - m; if (lift > 1e-4) { const hp = W(B.Hips); hp.y += lift; B.Hips.position.copy(B.Hips.parent.worldToLocal(hp)); stat.lift = Math.max(stat.lift, lift); } }
    root.updateMatrixWorld(true);
  }
  const done = [];
  for (const ja of json.animations) { if (clips && !clips.includes(ja.name)) continue; const clip = g.animations.find(c => c.name === ja.name); if (!clip) continue;
    for (const tr of clip.tracks) { const nd = root.getObjectByName(tr.name.slice(0, tr.name.lastIndexOf('.'))); if (nd) tr.restQ = rest.get(nd)?.[1]; }
    const sp = seams ? seamPass(clip) : { lead: 0, cuts: [] }, wr = wrist ? wristPass(clip) : { moved: 0, unwound: 0 }, wm = Math.max(wr.moved, wr.unwound), seamed = sp.lead || sp.cuts.length || wm > .05;
    const poser = makePoser(root, clip), cache = new Map(); stat.elbow = 0; stat.legTwist = 0; stat.wrist = wr.moved; stat.unwound = wr.unwound;   /* 믹서 대신 — 멈춘 구간에서 믹서는 뼈를 다시 안 쓴다 */ const s0 = { ...stat }; stat.knee = 0; stat.kneeMax = 0; stat.lift = 0;
    twistPlan = planTwist(clip, poser); stat.knee = 0; stat.kneeMax = 0; stat.elbowMirror = 0;   /* 계획 단계의 거울은 세지 않는다 */
    const pose = t => { const key = t.toFixed(5); let r = cache.get(key); if (r) return r; reset(); poser(t); curT = t; fixPose();
      r = { Hips: B.Hips.position.clone() }; for (const s of ['Left', 'Right']) for (const n of [...LEG, 'Arm', 'ForeArm', 'Hand']) if (B[s + n]) r[s + n] = B[s + n].quaternion.clone(); cache.set(key, r); return r; };
    let wrote = 0;
    for (const ch of ja.channels) { const node = json.nodes[ch.target.node], name = (node.name || '').replace(/^mixamorig:?/, ''), smp = ja.samplers[ch.sampler];
      const want = (ch.target.path === 'rotation' && knee && /^(Left|Right)(UpLeg|Leg|Foot)$/.test(name)) || (ch.target.path === 'rotation' && elbow && /^(Left|Right)(Arm|ForeArm|Hand)$/.test(name)) || (ch.target.path === 'translation' && ground && name === 'Hips');
      if (!want && seamed && ch.target.path === 'rotation') { const tr = clip.tracks.find(t => t.name.replace(/^mixamorig:?/, '') === name + '.quaternion' || t.name === node.name + '.quaternion');
        if (tr && json.accessors[smp.output].count === tr.times.length) { if (!dry) writeAccessor(json, bin, smp.output, (i, k) => tr.values[i * 4 + k]); wrote++; } continue; }   /* 이음매만 손본 뼈 — 고친 트랙 값 그대로 */
      if (!want) continue; const times = readFloats(json, bin, smp.input), vals = Array.from(times, t => pose(t)[name]);   /* Float32Array.map 은 숫자만 돌려준다 */
      if (!dry) writeAccessor(json, bin, smp.output, (i, k) => vals[i].toArray()[k]); wrote++; }
    done.push({ clip: ja.name, channels: wrote, knees: stat.knee, kneeMax: +stat.kneeMax.toFixed(3), lift: +stat.lift.toFixed(3), lead: sp.lead, cuts: sp.cuts, elbow: +(stat.elbow || 0).toFixed(1), legTwist: +(stat.legTwist || 0).toFixed(1), wrist: +(stat.wrist || 0).toFixed(1), unwound: +(stat.unwound || 0).toFixed(1) }); void s0; }
  if (!dry) { json.asset = json.asset || {}; json.asset.extras = { ...(json.asset.extras || {}), clipJointFix: { v: 5, by: 'tools/3d/clip-joint-fix.mjs', knee, ground, seams, elbow, legTwist, wrist } }; writeGlb(file, json, bin); }
  return done;
}
if ((process.argv[1] || '').endsWith('clip-joint-fix.mjs')) {
  const a = process.argv.slice(2), [file, list] = a.filter(x => !x.startsWith('--'));
  const r = await fixClips(file, { clips: list ? list.split(',') : null, knee: !a.includes('--no-knee'), ground: !a.includes('--no-ground'), seams: !a.includes('--no-seams'), elbow: !a.includes('--no-elbow'), legTwist: !a.includes('--no-leg-twist'), wrist: !a.includes('--no-wrist'), dry: a.includes('--dry') });
  for (const x of r) console.log(`${x.clip.padEnd(18)} 쓴 채널 ${x.channels} · 고친 무릎 키 ${x.knees} (최대 ${x.kneeMax} m 뒤) · 골반 올림 최대 ${x.lift} m${x.lead ? ' · 시작 결함 ' + x.lead + '키' : ''}${x.cuts.length ? ' · 끊김 ' + x.cuts.join('/') + ' s' : ''}${x.elbow > 5 ? ' · 위팔 비틂 최대 ' + x.elbow + '°' : ''}${x.legTwist > 5 ? ' · 허벅지 비틂 최대 ' + x.legTwist + '°' : ''}${x.wrist > 1 ? ' · 손목→아래팔 ' + x.wrist + '°' : ''}${x.unwound > 1 ? ' · 손 감기 풂 최대 ' + x.unwound + '°' : ''}`);
}
