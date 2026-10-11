/* 몬스터 몸짓 얹기 (문서 229 §28) — 디렉터 «너무 좀비처럼 서 있다». 재 보니 전투 중(가까운 표본 120 중 97 이 «공격» 상태)인데:
   대기 클립(4 초)은 거의 정지, 공격 클립 셋은 1.3 초 제자리 팔 휘두르기로 똑같고, 공격 상태는 클립보다 길어 끝 프레임(선 자세)에 멈춰 있었다.
   클립은 그대로 두고 그 위에 뼈 몇 개만 더 돌린다(믹서가 쓴 뒤 · 다음 프레임 전에 되돌림 — 트랙 없는 뼈에 쌓이지 않게):
   - 숨: 늘 가슴이 오르내린다
   - 전투 대기(교전 무게 e): 무게를 좌우로 옮기고(엉덩이 흔들림) · 낮게 웅크리고 · 앞으로 숙이고 · 고개가 표적을 따라 돌고 · 두 팔을 앞으로 들어 할퀼 채비
   - 공격: 클립의 앞 15~65 % 에 한 걸음 디딤(0.5 m) + 숙임 + 몸통 비틀기(번갈아 좌우) + 오른팔(왼팔) 휘두름
   축은 몸(model) 공간 — 옆(X)·위(Y)·앞(Z) — 을 뼈의 부모 공간으로 바꿔 돌린다. 리그마다 뼈 축이 달라도 같은 방향으로 굽는다.
   몸째 내리지 않는다(발이 파묻힌다) · 방패 든 몸은 팔을 안 돌린다.
   N01 몸(mixamorig_ 뼈)만. 임시 몸은 손대지 않는다 */
const BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm'];
export const MOTION = { amp: 1 };   /* 검수용: 0 이면 끔 */
export function createMobMotion(THREE) {
  const pa = new THREE.Vector3(), pf = new THREE.Vector3(), qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), qpi = new THREE.Quaternion(), qm = new THREE.Quaternion(), ax = new THREE.Vector3();
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  /* 몸 공간 축 a 로 각 r 만큼 — 뼈의 부모 세계 회전 P, 몸 세계 회전 M: 부모 공간 축 = P⁻¹·M·a */
  function turn(b, a, r) { if (!b || !r) return; b.parent.getWorldQuaternion(qp); qpi.copy(qp).invert(); ax.copy(a).applyQuaternion(qm).applyQuaternion(qpi).normalize(); qa.setFromAxisAngle(ax, r); b.quaternion.premultiply(qa); }
  return {
    attach(v) { const B = {}; for (const n of BONES) B[n] = v.model.getObjectByName('mixamorig_' + n) || v.model.getObjectByName('mixamorig' + n) || null;
      if (!B.Spine || !B.Head) return null;
      v.motion = { B, saved: BONES.filter(n => B[n]).map(n => [B[n], B[n].quaternion.clone()]), base: v.model.position.clone(), e: 0, t: Math.random() * 10, side: 1, lastSeq: null, lastAtk: -9, shield: !!(v.named && v.named.shield_bash), ph: Math.random() * 6.28 };
      return v.motion; },
    /* 믹서 앞: 지난 프레임에 얹은 것을 걷어 낸다 */
    before(v) { const M = v.motion; if (!M) return; for (const [b, q] of M.saved) b.quaternion.copy(q); v.model.position.copy(M.base); },
    /* 믹서 뒤: 얹는다. 시각 t 는 몸마다 따로(같은 박자로 흔들리면 군무 같다) */
    after(v, dt) { const M = v.motion; if (!M || !v.alive) return; const B = M.B, amp = MOTION.amp; if (!amp) return; M.t += dt;
      for (const s of M.saved) s[1].copy(s[0].quaternion);   /* 믹서가 쓴 값 — 다음 before 가 여기로 되돌린다 */
      v.model.updateMatrixWorld(true); v.model.getWorldQuaternion(qm);
      const atk = v.cur === 'attack', clip = v.current && v.current.getClip ? v.current.getClip().duration : 1, u = atk ? Math.min(1, (v.current.time || 0) / Math.max(.1, clip)) : 1;
      if (atk && v.seq !== M.lastSeq) { M.lastSeq = v.seq; M.side = -M.side; }
      if (atk || v.cur === 'hit') M.lastAtk = M.t;
      const want = M.t - M.lastAtk < 4 ? 1 : 0; M.e += (want - M.e) * Math.min(1, dt * 3); const e = M.e * amp, t = M.t + M.ph;
      const lunge = atk ? Math.sin(Math.PI * Math.min(1, Math.max(0, (u - .15) / .5))) * amp : 0;   /* 앞 15~65 % 에 덮치고 돌아온다 */
      /* 숨 */
      turn(B.Spine1, X, .035 * Math.sin(t * 2.1) * amp);
      /* 몸통: 숙임 · 무게 옮김 · 비틀기 */
      turn(B.Spine, X, (.2 * e + .18 * lunge)); turn(B.Spine2, X, .08 * e); turn(B.Spine2, Y, .09 * Math.sin(t * 1.3) * e + .34 * lunge * M.side);
      turn(B.Hips, Y, -.06 * Math.sin(t * 1.3) * e - .12 * lunge * M.side);
      v.model.position.x = M.base.x + .045 * Math.sin(t * 1.3) * e; /* 몸째 내리지 않는다 — 발이 바닥에 5~11 cm 파묻혔다. 낮아 보이는 건 숙임으로 */
      v.model.position.z = M.base.z + .6 * lunge;
      /* 고개: 표적 쪽으로(몸이 이미 향했으면 흔들림만) */
      let look = .18 * Math.sin(t * .7) * e; const a = v.action;
      if (a && Number.isFinite(a.targetX) && Number.isFinite(a.targetZ)) { const yaw = Math.atan2(a.targetX - v.root.position.x, a.targetZ - v.root.position.z), d = Math.atan2(Math.sin(yaw - v.root.rotation.y), Math.cos(yaw - v.root.rotation.y)); look = Math.max(-.8, Math.min(.8, d)) * e; }
      turn(B.Neck, Y, look * .4); turn(B.Head, Y, look * .6); turn(B.Head, X, -(.1 * e + .28 * lunge));   /* 숙인 몸에서 고개는 들어 표적을 본다 */
      /* 팔: 앞으로 들어 할퀼 채비 · 공격 쪽 팔은 크게 휘두름 */
      const swingR = M.side > 0 ? lunge : lunge * .35, swingL = M.side > 0 ? lunge * .35 : lunge;
      if (M.shield) return;   /* 방패 든 몸(철갑병 · 빌린 방패수): 팔을 돌리면 방패가 머리 위로 납작하게 돌아갔다 — 방패 공격 클립에 맡긴다 */
      /* 늘어진 팔만 든다 — 클립이 이미 앞으로 뻗은 팔(보행자 잽)을 더 돌리면 손이 하늘을 가리켰다. 위팔 → 아래팔 방향의 아래 성분 0~1 */
      const hang = (a, f) => { if (!a || !f) return 0; a.getWorldPosition(pa); f.getWorldPosition(pf); pf.sub(pa); return Math.max(0, Math.min(1, -pf.y / Math.max(1e-4, pf.length()))); };
      const hR = hang(B.RightArm, B.RightForeArm), hL = hang(B.LeftArm, B.LeftForeArm);
      turn(B.RightArm, X, -(.45 * e + 1.0 * swingR) * hR); turn(B.LeftArm, X, -(.45 * e + 1.0 * swingL) * hL);
      turn(B.RightForeArm, X, -.35 * e); turn(B.LeftForeArm, X, -.35 * e); }
  };
}
