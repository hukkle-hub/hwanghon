/* 세라 투척 (문서 229 §33) — 부식 시약 «선택 부위에 시약을 던진다 — 날아가 맞은 자리에서 터진다» · 연쇄 폭발 «던진 병이 두 번 연달아 터진다» 인데
   필드(던전도) 어디에도 날아가는 병이 없어 근접 공격처럼 숫자만 떴다. 판정은 그대로 두고 그림만:
   - 병은 접점(판정) 시각에 **도착**하게 그보다 FLIGHT 초 앞서 손을 떠나 포물선으로 난다(몬스터 판정 거리 2.8 m — 짧은 비행). 표적이 없으면 앞으로 4 m.
   - 닿으면 터짐: 바닥 고리가 퍼지고 빛 덩이가 부풀며 사라진다. 부식 = 산성 초록, 연쇄 = 주황 두 번(0.22 s 간격).
   시각은 게임 시각(dt) — 헤드리스·느린 기기에서도 판정과 박자가 같다 */
export const THROW = { FLIGHT: 0.22, ARC: 0.9, GAP: 0.22 };
export const THROW_KIND = { acid: { color: 0x8dff5a, bursts: 1 }, chain: { color: 0xff9a3a, bursts: 2 } };
/* 언제 손을 떠나나 — 접점 tc(초)보다 FLIGHT 앞, 그러나 0.05 s 보다 이르지 않게(그때는 비행을 줄인다) */
export function throwPlan(tc) { const launch = Math.max(0.05, tc - THROW.FLIGHT); return { launch, flight: Math.max(0.08, tc - launch) }; }
/* 포물선 위치 (u 0..1) */
export function arcAt(a, b, u, h = THROW.ARC) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + 4 * h * u * (1 - u), a[2] + (b[2] - a[2]) * u]; }
export function createThrowFx(THREE, scene) {
  const jobs = [], live = [];
  const flaskG = new THREE.CylinderGeometry(.05, .07, .16, 8), neckG = new THREE.CylinderGeometry(.025, .03, .07, 6); neckG.translate(0, .11, 0);
  const ringG = new THREE.RingGeometry(.7, .82, 40), puffG = new THREE.IcosahedronGeometry(.5, 1);
  const glow = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  function burst(at, color) {
    const ring = new THREE.Mesh(ringG, glow(color)); ring.rotation.x = -Math.PI / 2; ring.position.set(at[0], .1, at[2]);
    const puff = new THREE.Mesh(puffG, glow(color)); puff.position.set(at[0], Math.max(.4, at[1]), at[2]);
    scene.add(ring, puff); live.push({ kind: 'burst', ring, puff, t: 0, dur: .55 });
  }
  return { live, jobs,
    /* from: [x,y,z] 또는 그것을 돌려주는 함수(손을 떠날 때 부른다) · to: [x,y,z] · tc: 지금부터 접점까지(초) · kind: 'acid' | 'chain' */
    throw(from, to, tc, kind = 'acid') { const K = THROW_KIND[kind] || THROW_KIND.acid, p = throwPlan(tc); jobs.push({ t: -p.launch, flight: p.flight, from, to, K }); },
    tick(dt) {
      for (let i = jobs.length - 1; i >= 0; i--) { const j = jobs[i]; j.t += dt;
        if (j.t >= 0 && !j.mesh && !j.burst) { if (typeof j.from === 'function') j.from = j.from();   /* 손 위치는 손을 떠나는 순간에 읽는다 */
          j.mesh = new THREE.Group(); const m = glow(j.K.color); m.opacity = .95; j.mesh.add(new THREE.Mesh(flaskG, m), new THREE.Mesh(neckG, m)); scene.add(j.mesh); }
        if (j.mesh) { const u = Math.min(1, j.t / j.flight), p = arcAt(j.from, j.to, u); j.mesh.position.set(p[0], p[1], p[2]); j.mesh.rotation.x += dt * 14; j.mesh.rotation.z += dt * 9;
          if (u >= 1) { scene.remove(j.mesh); j.mesh.children[0].material.dispose(); for (let b = 0; b < j.K.bursts; b++) jobs.push({ t: -b * THROW.GAP, burstAt: j.to, color: j.K.color, burst: true }); jobs.splice(i, 1); continue; } }
        if (j.burst && j.t >= 0) { burst(j.burstAt, j.color); jobs.splice(i, 1); } }
      for (let i = live.length - 1; i >= 0; i--) { const L = live[i]; L.t += dt; const k = L.t / L.dur;
        if (k >= 1) { scene.remove(L.ring, L.puff); L.ring.material.dispose(); L.puff.material.dispose(); live.splice(i, 1); continue; }
        L.ring.scale.setScalar(.4 + 2.0 * k); L.ring.material.opacity = .9 * (1 - k); L.puff.scale.setScalar(.3 + 1.1 * Math.sqrt(k)); L.puff.material.opacity = .7 * (1 - k) * (1 - k); } } };
}
