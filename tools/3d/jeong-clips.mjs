/* 정 장관 전용 동작 (문서 223) — 블렌더·Kimodo 없이 «방향으로 잡는 키프레임» 을 GLB 에 굽는다.
 *   node tools/3d/jeong-clips.mjs            → .node-shots/jeong-clips/*.json 만들고 art/3d/part1/minister_jeong_candidate.glb 에 넣는다
 *   node tools/3d/jeong-clips.mjs --dry      → JSON 만
 * 키는 뼈 각도가 아니라 «이 뼈가 몸 기준 어느 쪽을 가리키나» 로 적는다 ([오른쪽, 위, 앞]). 각도는 여기서 푼다:
 *   q = Qparent⁻¹ · R(지금 방향 → 원하는 방향) · Qparent · q쉼   (최소 회전 — 비틀림은 쉬는 자세 그대로)
 * 원작(문서 149 §3, EP26): 의전용 군도 · 변주 없는 원 · 정면 결계 3합 · 보지 않고 쳐내는 등 뒤 · 왼손이 그리는 각도 · 군도를 짚고 선 채 꺼짐. */
import * as T from '../../vendor/three/three.module.js';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createGrip } from '../../js/mmo/jeong-saber.js';

const GLB = 'art/3d/part1/minister_jeong_candidate.glb', OUT = '.node-shots/jeong-clips/', FPS = 30;
/* 군도 칼날: 손 슬롯(RightHandSlot) 의 로컬 +Y — js/mmo/jeong-saber.js 와 같은 축 */
export const BLADE_AXIS = [0, 1, 0];

const raw = fs.readFileSync(GLB), ld = new GLTFLoader(); ld.register(() => ({ name: 'skip', loadTexture: () => Promise.resolve(new T.Texture()) }));
const g = await ld.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
const root = g.scene, B = {}; root.traverse(o => { if (o.isBone) B[o.name.replace(/^mixamorig:?/, '')] = o; });
const rest = new Map(); for (const b of Object.values(B)) rest.set(b, [b.position.clone(), b.quaternion.clone()]);
const GRIP = createGrip(T, root);   /* 보이는 손의 틀 — 칼날 방향은 뼈가 아니라 이걸로 잰다 (js/mmo/jeong-saber.js) */
let NECK = +(process.env.NECK || 1);   /* 고개 돌림 중 목뼈 몫 */
const V = (x, y, z) => new T.Vector3(x, y, z), Y = V(0, 1, 0), D2R = Math.PI / 180;

/* 몸 기준 [오른쪽, 위, 앞] → 월드. 모델은 +Z 를 보고, 오른쪽은 −X */
const bodyDir = (d, yaw) => V(-d[0], d[1], d[2]).normalize().applyAxisAngle(Y, yaw);
function worldQ(o) { return o.getWorldQuaternion(new T.Quaternion()); }
function rotWorld(b, R) {   /* 뼈를 월드 회전 R 만큼 (부모 기준으로 바꿔) 돌린다 */
  const Qp = worldQ(b.parent), q = Qp.clone().invert().multiply(R).multiply(Qp).multiply(b.quaternion); b.quaternion.copy(q); b.updateMatrixWorld(true); }
function aim(b, child, dir) {   /* b → child 방향이 dir 이 되게 */
  b.updateMatrixWorld(true); const cur = child.getWorldPosition(V()).sub(b.getWorldPosition(V())).normalize();
  rotWorld(b, new T.Quaternion().setFromUnitVectors(cur, dir.clone().normalize())); }
function aimAxis(b, axisLocalOfChild, child, dir) {   /* child(슬롯) 의 로컬 축이 dir 을 보게 b 를 돌린다 */
  b.updateMatrixWorld(true); const cur = V(...axisLocalOfChild).applyQuaternion(worldQ(child)).normalize();
  rotWorld(b, new T.Quaternion().setFromUnitVectors(cur, dir.clone().normalize())); }

function twistTo(b, child, axisLocal, slot, want) {   /* b 를 자기 축(b→child) 둘레로만 돌려 «보이는 손» 의 칼날이 want 쪽을 보게 (수직 성분끼리).
     손 정점이 위팔에도 묶여 있어 비튼 만큼 다 안 돈다 → 세 번 되풀이해 맞춘다 */
  for (let it = 0; it < 4; it++) { b.updateMatrixWorld(true); root.updateMatrixWorld(true);
    const ax = child.getWorldPosition(V()).sub(b.getWorldPosition(V())).normalize(), cur = GRIP ? GRIP.blade(V()) : V(...axisLocal).applyQuaternion(worldQ(slot));
    const c = cur.clone().addScaledVector(ax, -ax.dot(cur)), w = want.clone().normalize().addScaledVector(ax, -ax.dot(want.clone().normalize())); if (c.lengthSq() < 1e-6 || w.lengthSq() < 1e-6) return;
    c.normalize(); w.normalize(); const ang = Math.atan2(ax.dot(c.clone().cross(w)), c.dot(w)); if (Math.abs(ang) < .01) return; rotWorld(b, new T.Quaternion().setFromAxisAngle(ax, ang)); } }
/* 팔꿈치 경첩 맞추기 (문서 226): 위팔·아래팔을 따로 «최소 회전» 으로 겨누면 위팔 비틀림이 팔꿈치 경첩과 어긋나 팔꿈치가 옆으로 꺾인다(동작 감사 76~90°).
   위팔을 자기 축 둘레로만 돌려 경첩(쉬는 자세의 «앞으로 굽힘» 축)이 굽힘 평면에 오게 하고, 아래팔은 다시 겨눈다 — 뼈 방향은 그대로, 비틀림만 바뀐다.
   거의 편 팔(5~20°)은 덜 돌려 축이 정해지지 않는 곳에서 튀지 않게 */
const HINGE_L = {}; { for (const [b, [pos, q]] of rest) { b.position.copy(pos); b.quaternion.copy(q); } root.updateMatrixWorld(true);
  for (const s of ['Left', 'Right']) { const a = B[s + 'Arm'], f = B[s + 'ForeArm'], h = B[s + 'Hand'], u = f.getWorldPosition(V()).sub(a.getWorldPosition(V())).normalize(), fwd = V(0, 0, 1);
    let hw = u.clone().cross(fwd).normalize(); const fd = h.getWorldPosition(V()).sub(f.getWorldPosition(V())).normalize(); if (fd.clone().applyAxisAngle(hw, .3).sub(fd).dot(fwd) < 0) hw.negate();
    HINGE_L[s] = hw.applyQuaternion(worldQ(a).invert()); } }
function elbowHinge(s, fDir) { const a = B[s + 'Arm'], f = B[s + 'ForeArm'], h = B[s + 'Hand']; root.updateMatrixWorld(true);
  const u = f.getWorldPosition(V()).sub(a.getWorldPosition(V())).normalize(), fd = fDir.clone().normalize(), bend = Math.acos(Math.max(-1, Math.min(1, u.dot(fd))));
  const wgt = Math.max(0, Math.min(1, (bend * 180 / Math.PI - 5) / 15)); if (!wgt) return;
  const n = u.clone().cross(fd).normalize(), hw = HINGE_L[s].clone().applyQuaternion(worldQ(a)); hw.addScaledVector(u, -hw.dot(u)).normalize();
  const phi = Math.atan2(u.dot(hw.clone().cross(n)), hw.dot(n)); rotWorld(a, new T.Quaternion().setFromAxisAngle(u, phi * wgt)); aim(f, h, fd); }
/* 자세 하나를 몸에 얹는다. p: { yaw, hip:[dx,dy,dz], lean, twist, roll, head(가슴 기준 도), nod, rA, rF, rB, lA, lF, legs:{ r:[up, low], l:[up, low] } } */
function apply(p) {
  for (const [b, [pos, q]] of rest) { b.position.copy(pos); b.quaternion.copy(q); }
  root.updateMatrixWorld(true);
  const yaw = (p.yaw || 0) * D2R, hip = p.hip || [0, 0, 0], H = B.Hips;
  H.position.add(V(-hip[0], hip[1], hip[2]).applyAxisAngle(Y, yaw));   /* 골반 이동도 몸 기준 */
  H.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(Y, yaw)); H.updateMatrixWorld(true);
  const tw = (p.twist || 0) * D2R, chestYaw = yaw + tw;
  for (const [i, n] of ['Spine', 'Spine1', 'Spine2'].entries()) { const yNow = yaw + tw * (i + 1) / 3, right = V(-1, 0, 0).applyAxisAngle(Y, yNow), fwd = V(0, 0, 1).applyAxisAngle(Y, yNow);
    rotWorld(B[n], new T.Quaternion().setFromAxisAngle(Y, tw / 3).multiply(new T.Quaternion().setFromAxisAngle(right, -(p.lean || 0) * D2R / 3)).multiply(new T.Quaternion().setFromAxisAngle(fwd, (p.roll || 0) * D2R / 3))); }
  /* 머리: 몸 기준 yaw(head) 와 숙임(nod) — 기본은 앞(가슴과 같은 쪽) */
  /* 고개: 얼굴 정점은 머리뼈 60 %·목뼈 32 % 로 섞여 묶여 있다 — 한 뼈에만 돌리면 목과 머리 사이가 늘어나 얼굴이 일그러졌다(얼굴 감사 최대 72 %).
     그래서 목 45 %·머리 55 % 로 나누고, 가슴 기준 ±50°·숙임 24° 까지만 (문서 223 §3) */
  const relYaw = Math.max(-50 * D2R, Math.min(50 * D2R, (p.head || 0) * D2R)), nod = Math.max(-10, Math.min(24, p.nod || 0)) * D2R, headYaw = chestYaw + relYaw;
  rotWorld(B.Neck, new T.Quaternion().setFromAxisAngle(Y, relYaw * NECK)); rotWorld(B.Head, new T.Quaternion().setFromAxisAngle(Y, relYaw * (1 - NECK)));
  if (nod) { const ax = V(-1, 0, 0).applyAxisAngle(Y, headYaw); rotWorld(B.Neck, new T.Quaternion().setFromAxisAngle(ax, -nod * NECK)); rotWorld(B.Head, new T.Quaternion().setFromAxisAngle(ax, -nod * (1 - NECK))); }
  /* 손 메시는 손 뼈(RightHand)에 가중치가 0 이고 아래팔에 묶여 있다(스킨 재 봄) — 손 뼈를 돌리면 칼만 돌고 손은 남아 «떠 있는 칼» 이 된다.
     그래서 손 뼈는 쉬는 자세 그대로 두고, 칼날 방향은 아래팔의 비틀림(엄지 쪽)으로 잡는다. 칼날은 아래팔에 거의 수직이다 */
  /* 위팔은 수평에서 37° 아래까지만 — 그보다 들면 코트 소매·몸판이 날개처럼 부푼다(재 봄: 25° 아래도 부풀었다) */
  const clampUp = A => { const n = Math.hypot(...A), y = A[1] / n; if (y <= -.6) return A; const h = Math.hypot(A[0], A[2]) || 1, k = Math.sqrt(1 - .36) / h; return [A[0] * k, -.6, A[2] * k]; };
  const arm = (s, A, F, Bl) => { if (A) A = clampUp(A); if (A) aim(B[s + 'Arm'], B[s + 'ForeArm'], bodyDir(A, chestYaw)); if (F) aim(B[s + 'ForeArm'], B[s + 'Hand'], bodyDir(F, chestYaw));
    if (A && F) elbowHinge(s, bodyDir(F, chestYaw));
    if (Bl && s === 'Right') aimAxis(B.RightHandSlot, BLADE_AXIS, B.RightHandSlot, bodyDir(Bl, chestYaw)); };   /* 칼 방향은 슬롯 뼈로 — 슬롯엔 정점이 없어 메시가 안 일그러진다. 칼 자리는 보이는 주먹(js/mmo/jeong-saber.js) */
  arm('Right', p.rA, p.rF, p.rB); arm('Left', p.lA, p.lF, null);
  for (const [s, k] of [['Right', 'r'], ['Left', 'l']]) { const L = p.legs && p.legs[k]; if (!L) continue; aim(B[s + 'UpLeg'], B[s + 'Leg'], bodyDir(L[0], yaw)); aim(B[s + 'Leg'], B[s + 'Foot'], bodyDir(L[1], yaw)); }
}

/* 키 사이 보간: 숫자는 직선, 방향은 정규화 직선. ease: 'io'(기본) · 'in'(느리게 시작 → 빠르게 끝 = 베기) · 'out' · 'lin' */
const EASE = { lin: t => t, io: t => t * t * (3 - 2 * t), in: t => t * t * t, out: t => 1 - Math.pow(1 - t, 3) };
/* 칼날 방향(rB)이 키 사이에서 120° 넘게 바뀌면 직선 보간이 0 근처를 지나 한 프레임에 뒤집힌다(3합 0.73 s 178°, 원 1.37 s 170°).
   그때는 아래팔(rF)이 도는 회전을 칼날에도 같이 얹고, 남는 차이만 따로 보간한다 — 칼이 손목과 함께 휘돈다 */
function bladeLerp(a, b, k) { const A = V(...a).normalize(), Bv = V(...b).normalize(); if (A.dot(Bv) > -0.5) return lerpV(a, b, k);
  const fa = V(...bladeLerp.fa).normalize(), fb = V(...bladeLerp.fb).normalize(), q = new T.Quaternion().setFromUnitVectors(fa, fb), w1 = A.clone().applyQuaternion(q), r = new T.Quaternion().setFromUnitVectors(w1, Bv);
  const v = A.clone().applyQuaternion(new T.Quaternion().slerp(q, k)).applyQuaternion(new T.Quaternion().slerp(r, k)); return v.toArray(); }
function lerpPose(a, b, k) { const o = {}; if (a.rF && b.rF) { bladeLerp.fa = a.rF; bladeLerp.fb = b.rF; } else { bladeLerp.fa = bladeLerp.fb = [0, 0, 1]; }
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[key], y = b[key] ?? x; if (x == null) { o[key] = y; continue; }
    if (key === 'legs') { o.legs = {}; for (const s of ['r', 'l']) { const u = x[s], w = (y || {})[s] ?? u; if (u) o.legs[s] = [lerpV(u[0], w[0], k), lerpV(u[1], w[1], k)]; } continue; }
    o[key] = typeof x === 'number' ? x + (y - x) * k : key === 'rB' ? bladeLerp(x, y, k) : lerpV(x, y, k, key === 'hip'); }
  return o; }
function lerpV(a, b, k, raw) { const v = a.map((x, i) => x + (b[i] - x) * k); if (raw) return v; const n = Math.hypot(...v) || 1; return v.map(x => x / n); }
function poseAt(keys, t) { let i = 0; while (i < keys.length - 1 && t > keys[i + 1].t) i++; const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  if (a === b || t <= a.t) return a.p; const k = (EASE[b.ease || 'io'])(Math.min(1, (t - a.t) / (b.t - a.t))); return lerpPose(a.p, b.p, k); }
/* 앞 키의 값을 이어받게 채운다 (안 적은 건 그대로) */
function fill(keys) { let prev = {}; for (const k of keys) { k.p = { ...prev, ...k.p }; prev = k.p; } return keys; }

/* ---------- 자세 사전 — 몸 기준 [오른쪽, 위, 앞] ----------
   제약 (재 보고 정함): ① 위팔을 어깨 위로 들면 코트가 날개처럼 늘어난다 → 위팔은 수평 아래(y ≤ −0.2)
   ② 칼날은 아래팔에 거의 수직 → rB 는 «바라는 쪽» 이고 실제로는 아래팔에 수직인 성분으로 맞춘다 */
const STAND = { legs: { r: [[.08, -1, 0], [.04, -1, -.05]], l: [[-.08, -1, 0], [-.04, -1, -.05]] } };
/* 칼 들어 자세(의전): 오른 아래팔 앞으로 수평, 칼날 세워 오른 어깨 앞 · 왼팔 차렷 */
const CARRY = { ...STAND, rA: [.15, -1, .06], rF: [.04, .08, 1], rB: [0, 1, .05], lA: [-.12, -1, .02], lF: [-.06, -1, .12], head: 0, lean: 0, twist: 0, yaw: 0, hip: [0, 0, 0], nod: 0 };   /* head: 가슴 기준 고개 각도(도) */
/* 겨눔: 칼끝이 앞 위 — 실전 각도 */
const GUARD = { ...CARRY, legs: { r: [[.2, -1, -.22], [.12, -1, -.3]], l: [[-.16, -1, .25], [-.1, -1, .1]] }, hip: [0, -.06, 0], rA: [.22, -.85, .45], rF: [-.15, -.2, 1], rB: [-.1, .7, .7], lA: [-.25, -.9, .05], lF: [-.3, -.6, .5], lean: 8 };

export const CLIPS = {
  /* 대기: 칼 들어 자세로 부동 — 아주 작은 숨 */
  idle_jeong: { dur: 1.6, loop: true, keys: [{ t: 0, p: { ...CARRY } }, { t: .8, p: { hip: [0, -.008, 0], lean: 1.2, nod: 1 } }, { t: 1.6, p: { hip: [0, 0, 0], lean: 0, nod: 0 } }] },
  /* 완성된 원: 겨눔 → 왼쪽으로 감기(칼날 뒤로) → 한 바퀴(0.45 s) → 겨눔 → 칼 들어. 매번 소수점까지 같은 원 */
  atk_jeong_circle: { dur: 2.8, keys: [
    { t: 0, p: { ...CARRY } },
    { t: .55, p: { ...GUARD } },
    { t: 1.15, ease: 'out', p: { yaw: 25, twist: 55, rA: [-.35, -.65, .6], rF: [-1, -.05, .25], rB: [0, 0, -1], lA: [-.4, -.75, -.2], lF: [-.5, -.7, .2], lean: 12 } },
    { t: 1.4, ease: 'in', p: { yaw: -90, twist: -20, rA: [.8, -.5, .3], rF: [.85, -.12, .5], rB: [.2, .05, 1], lA: [-.55, -.8, 0], lean: 6 } },
    { t: 1.6, ease: 'lin', p: { yaw: -250, twist: -30 } },
    { t: 1.8, ease: 'out', p: { yaw: -335, twist: -25, rA: [.6, -.6, .5], rF: [.5, -.3, .8], rB: [-.2, .4, 1] } },
    { t: 2.25, p: { ...GUARD, yaw: -360 } },
    { t: 2.8, p: { ...CARRY, yaw: -360 } }] },
  /* 결계 가르기: 정면 3합 — 오른 위 → 왼 아래 · 왼 아래 → 오른 위 · 위 → 아래 (한 걸음씩). 위팔은 수평 아래, 들어 올리는 건 아래팔·칼날 */
  atk_jeong_triple: { dur: 2.6, keys: [
    { t: 0, p: { ...CARRY } }, { t: .35, p: { ...GUARD } },
    { t: .55, ease: 'out', p: { rA: [.55, -.25, .35], rF: [.35, .75, .4], rB: [.6, .5, -.6], twist: 30, lean: 4 } },
    { t: .75, ease: 'in', p: { rA: [-.15, -.6, .75], rF: [-.65, -.45, .6], rB: [-.6, -.6, .5], twist: -30, lean: 14, hip: [0, -.08, 0] } },
    { t: 1.05, ease: 'out', p: { rA: [-.25, -.75, .5], rF: [-.75, -.55, .3], rB: [-.5, -.3, -.8] } },
    { t: 1.28, ease: 'in', p: { rA: [.55, -.25, .6], rF: [.55, .55, .6], rB: [.6, .7, .3], twist: 35, lean: 6, hip: [0, -.06, 0] } },
    { t: 1.55, ease: 'out', p: { rA: [.25, -.25, .55], rF: [.05, .95, .25], rB: [0, .2, -1], twist: 5, lean: -4 } },
    { t: 1.82, ease: 'in', p: { rA: [.15, -.55, .8], rF: [.05, -.35, .95], rB: [0, -.8, .5], lean: 22, hip: [0, -.14, 0] } },
    { t: 2.2, p: { ...GUARD, hip: [0, -.06, 0] } }, { t: 2.6, p: { ...CARRY, hip: [0, 0, 0] } }] },
  /* 다 아는 검: 몸만 돌려 등 뒤를 쳐낸다 — 가슴 방향(yaw+twist = −175°)은 그대로 두고 척추 비틀기는 70° 까지(사람 척추 한도), 나머지는 골반째 돈다 (문서 226) — 고개는 앞쪽으로 남긴다(가슴 기준 +35°, 얼굴이 안 늘어나는 한도) «보지도 않고» */
  atk_jeong_back: { dur: 1.5, keys: [
    { t: 0, p: { ...CARRY } },
    { t: .22, ease: 'out', p: { twist: 25, rA: [.45, -.6, .4], rF: [.2, -.2, 1], rB: [.6, .3, .3] } },
    { t: .45, ease: 'in', p: { yaw: -85, twist: -70, head: 35, rA: [.55, -.45, .55], rF: [.4, -.15, .9], rB: [-.6, .1, .4], lean: 4 } },
    { t: .62, ease: 'out', p: { yaw: -105, twist: -70, head: 35, rA: [.1, -.5, .8], rF: [-.4, -.25, .9], rB: [-.7, -.1, -.4] } },
    { t: 1.1, p: { ...CARRY } }, { t: 1.5, p: { ...CARRY } }] },
  /* 지휘 — 각도: 왼손이 왼쪽 앞에서 대상 쪽으로 각도를 긋는다(칼은 칼 들어). 그 각도로 의장대의 그림자가 파고든다 */
  atk_jeong_command: { dur: 2.4, keys: [
    { t: 0, p: { ...CARRY } },
    { t: .55, p: { lA: [-.75, -.25, .55], lF: [-.7, .1, .7], head: -25, lean: -2 } },
    { t: .95, ease: 'in', p: { lA: [-.2, -.25, .95], lF: [-.05, -.02, 1], head: 0, lean: 3 } },
    { t: 1.2, p: { lA: [.02, -.3, .95], lF: [.12, -.05, 1] } },
    { t: 1.9, p: { lA: [.02, -.32, .95], lF: [.1, -.08, 1] } },
    { t: 2.4, p: { ...CARRY } }] },
  /* 처치: 칼 들어 자세 그대로 선 채 — 칼끝이 천천히 앞으로 기울고 고개를 떨군다 (문서 149 §3.1 «부동자세로 서고 … 빛을 잃는다») */
  death_jeong: { dur: 3.0, keys: [
    { t: 0, p: { ...CARRY } },
    { t: .5, p: { lean: 3 } },
    { t: 1.6, p: { nod: 20, lean: 7, rF: [.04, -.2, 1], rB: [0, .8, .6] } },
    { t: 3.0, p: { nod: 36, lean: 11, hip: [0, -.04, 0], rA: [.15, -1, .02], rF: [.04, -.55, .85], rB: [0, .5, .85] } }] },
};

/* 굽기 */
function bake(name, c) {
  const keys = fill(c.keys.map(k => ({ ...k, p: { ...k.p } }))), n = Math.round(c.dur * FPS) + 1, times = [], tracks = {}, hips = [];
  const names = Object.keys(B);   /* 슬롯도 굽는다 — 칼 방향 */
  for (const k of names) tracks[k] = [];
  for (let i = 0; i < n; i++) { const t = Math.min(c.dur, i / FPS); times.push(+t.toFixed(4)); apply(poseAt(keys, t));
    for (const k of names) tracks[k].push(...B[k].quaternion.toArray().map(v => +v.toFixed(5)));
    hips.push(...B.Hips.position.toArray().map(v => +v.toFixed(5))); }
  return { name, duration: c.dur, times, tracks, hips, sourceClip: 'jeong-clips:' + name, from: 0, to: c.dur };
}
if (process.argv.includes('--axes')) { root.updateMatrixWorld(true); const q = worldQ(B.RightHandSlot); for (const [n, a] of [['+X', [1, 0, 0]], ['+Y', [0, 1, 0]], ['+Z', [0, 0, 1]]]) console.log('slot', n, V(...a).applyQuaternion(q).toArray().map(v => +v.toFixed(2)));
  console.log('forearm', B.RightHand.getWorldPosition(V()).sub(B.RightForeArm.getWorldPosition(V())).normalize().toArray().map(v => +v.toFixed(2))); process.exit(0); }
/* 얼굴 감사: 쉬는 자세에서 목 위(머리) 정점의 삼각형 변 길이가 자세에서 얼마나 늘고 주는지 — 최대 |비율−1|. 디렉터 «얼굴 일그러졌네» (문서 223 §3) */
export function faceAudit(name, c, step = 1 / 15) {
  let mesh = null; root.traverse(o => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  if (!faceAudit.tri) { for (const [b, [pos, q]] of rest) { b.position.copy(pos); b.quaternion.copy(q); } root.updateMatrixWorld(true);
    const P = mesh.geometry.attributes.position, ix = mesh.geometry.index.array, v = V(), rp = [];
    for (let i = 0; i < P.count; i++) { mesh.getVertexPosition(i, v); rp.push(v.clone()); }
    /* 얼굴 = 머리뼈 가중치 0.6 넘는 정점 (목 위 높이로 고르면 높은 옷깃까지 섞여 지표가 부풀었다) */
    const hi = mesh.skeleton.bones.findIndex(b => /Head$/.test(b.name)), SW = mesh.geometry.attributes.skinWeight, SI = mesh.geometry.attributes.skinIndex;
    const isFace = i => { let w = 0; for (let k = 0; k < 4; k++) if (SI.getComponent(i, k) === hi) w += SW.getComponent(i, k); return w > .6; }, edges = new Map();
    for (let t = 0; t < ix.length; t += 3) { const tri = [ix[t], ix[t + 1], ix[t + 2]]; if (!tri.every(isFace)) continue;
      for (let k = 0; k < 3; k++) { const a = Math.min(tri[k], tri[(k + 1) % 3]), b = Math.max(tri[k], tri[(k + 1) % 3]); edges.set(a * 1e7 + b, [a, b, rp[a].distanceTo(rp[b])]); } }
    faceAudit.tri = [...edges.values()].filter(e => e[2] > 1e-4); faceAudit.mesh = mesh; }
  const keys = fill(c.keys.map(k => ({ ...k, p: { ...k.p } }))), va = V(), vb = V(); let worst = 0, at = 0;
  for (let t = 0; t <= c.dur + 1e-6; t += step) { apply(poseAt(keys, t)); root.updateMatrixWorld(true); let m = 0;
    for (const [a, b, d0] of faceAudit.tri) { mesh.getVertexPosition(a, va); mesh.getVertexPosition(b, vb); m = Math.max(m, Math.abs(va.distanceTo(vb) / d0 - 1)); }
    if (m > worst) { worst = m; at = t; } }
  return { name, worst: +worst.toFixed(3), at: +at.toFixed(2) };
}
if (process.argv.includes('--face')) { for (const [n, c] of Object.entries(CLIPS)) console.log(JSON.stringify(faceAudit(n, c))); process.exit(0); }
const probe = process.argv.find(a => a.startsWith('--probe='));
if (probe) { const [nm, t] = probe.slice(8).split('@'), c = CLIPS[nm]; apply(poseAt(fill(c.keys.map(k => ({ ...k, p: { ...k.p } }))), +t)); root.updateMatrixWorld(true);
  for (const n of ['RightArm', 'RightForeArm', 'RightHand', 'RightHandSlot', 'LeftHand', 'Head']) console.log(n, B[n].getWorldPosition(V()).toArray().map(v => +v.toFixed(2)));
  console.log('blade(손 틀)', GRIP.blade(V()).toArray().map(v => +v.toFixed(2)), 'grip', V().setFromMatrixPosition(GRIP.world()).toArray().map(v => +v.toFixed(2))); process.exit(0); }
if ((process.argv[1] || '').endsWith('jeong-clips.mjs')) {
  fs.mkdirSync(OUT, { recursive: true }); const files = [];
  for (const [name, c] of Object.entries(CLIPS)) { const j = bake(name, c), f = OUT + name + '.json'; fs.writeFileSync(f, JSON.stringify(j)); files.push(f); console.log(name, c.dur + 's', j.times.length + ' 키'); }
  /* 다시 구울 때 덧붙이기만 하면 GLB 가 자꾸 커진다(옛 버퍼가 남는다) → 처음 원본(전용 클립 없는 판)을 받아 두고 늘 거기서 시작 */
  if (!process.argv.includes('--dry')) { const orig = OUT + 'orig.glb';
    if (!fs.existsSync(orig)) { const j = JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)).toString()); if (j.animations.some(a => /jeong/.test(a.name))) throw Error('원본이 없다: git show <전용 클립 전 커밋>:' + GLB + ' > ' + orig); fs.copyFileSync(GLB, orig); }
    fs.copyFileSync(orig, GLB); execFileSync('node', ['tools/3d/glb-put-clips.mjs', GLB, ...files], { stdio: 'inherit' }); if (fs.existsSync(GLB + '.bak')) fs.unlinkSync(GLB + '.bak');
    execFileSync('node', ['tools/3d/skin-rebind.mjs', GLB], { stdio: 'inherit' });   /* 원본엔 예전 가중치 — 다시 묶는다 (문서 225) */
    execFileSync('node', ['tools/3d/clip-joint-fix.mjs', GLB], { stdio: 'inherit' }); }   /* 무릎·바닥 (문서 226) */
}
