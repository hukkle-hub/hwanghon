/* 2급 지배형 화면 (docs/design/204) — 서버(server/field-dominator.cjs)가 정한 자리·방향·동작을 따라 그릴 뿐, 판정하지 않는다.
   몸은 임시: 승인 시트 모델(Hi3D)이 오기 전까지 사람형 애니메이션 모델을 어둡게 물들여 쓴다 (map.json bosses[].tint/glow).
   예고는 바닥에: 베기 = 붉은 부채꼴, 지배 파동 = 붉은 원 — 예고 시각(tell)까지 차오르고 그 순간 사라진다. */
import * as THREE from '../../vendor/three/three.module.js';

const CLIP = { idle: 'idle', walk: 'run', return: 'walk', rend: 'attack1', rend2: 'attack2', dominate: 'ult' };

function tintMaterials(root, tint, glow) {
  const t = new THREE.Color(tint), g = new THREE.Color(glow);
  root.traverse(m => {
    if (!m.isMesh) return; m.frustumCulled = false;
    m.material = [].concat(m.material).map(src => { const c = src.clone();
      if (c.color) c.color.multiplyScalar(.62).lerp(t, .28);                 /* 어둡게, 조금만 핏빛 쪽으로 — 피부는 창백하게 남긴다 (승인 시트: 검정·회백, 붉은 혈관은 보조) */
      if (c.emissive) { c.emissive.copy(g); c.emissiveIntensity = .05; }     /* .22 는 어두운 장면에서 몸 전체를 붉게 띄웠다 (확대 컷으로 확인) */
      if ('metalness' in c) c.metalness = Math.min(c.metalness ?? 0, .25);  /* 피부가 쇳덩이로 그려지지 않게 (CLAUDE.md §1) */
      return c; });
    if (m.material.length === 1) m.material = m.material[0];
  });
}
function sector(radius, angle) { return new THREE.CircleGeometry(radius, 40, Math.PI / 2 - angle / 2, angle); }

export function setupDominator(o, gl, scene, floor = 0) {
  const b = o.b, root = gl.scene;
  tintMaterials(root, b.tint ?? 0x2a0c12, b.glow ?? 0x8a0010);
  const box = new THREE.Box3().setFromObject(root), h = box.max.y - box.min.y || 1, k = (b.visualH || b.h || 2.2) / h;
  root.scale.setScalar(k); box.setFromObject(root);
  root.position.set(root.position.x - (box.min.x + box.max.x) / 2, root.position.y - box.min.y, root.position.z - (box.min.z + box.max.z) / 2);   /* 발을 바닥에 */
  const grp = new THREE.Group(); grp.position.set(b.x, 0, b.z); grp.add(root); scene.add(grp);
  o.root = grp; o.model = root; o.h = box.max.y - box.min.y; o.dom = { clip: '', seq: NaN };
  o.dmix = new THREE.AnimationMixer(root); o.dacts = {};
  for (const a of gl.animations) o.dacts[a.name] = o.dmix.clipAction(a);
  /* 바닥 예고: 원(파동)·부채꼴(베기) — 몸을 따라가되 몸과 같이 기울지 않게 장면에 따로 둔다 */
  const mat = new THREE.MeshBasicMaterial({ color: 0xff1a1a, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const warn = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat); warn.rotation.x = -Math.PI / 2; warn.position.y = floor + .05; warn.visible = false; scene.add(warn);
  o.dom.warn = warn; o.dom.geo = { dominate: new THREE.CircleGeometry(7, 64), rend: sector(3.8, 1.7), rend2: sector(4.2, 2.0) }; o.dom.floor = floor;
  play(o, 'idle');
  return o;
}
function play(o, name, once = false) {
  const a = o.dacts[CLIP[name] || name] || o.dacts.idle; if (!a) return; const d = o.dom;
  if (d.clip === a) { if (once) { a.reset(); a.play(); } return; }
  a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.fadeIn(.12).play();
  if (d.clip) d.clip.fadeOut(.12); d.clip = a;
}
export function applyDominatorAction(o, a) {
  o.netAct = a; if (!o.dom || !o.root) return;
  if (o.dom.seq !== a.seq) { o.dom.seq = a.seq; const once = a.motion === 'skill'; play(o, once ? a.skill : a.motion, once);
    if (o.dom.warn) { o.dom.warn.geometry = o.dom.geo[a.skill] || o.dom.geo.dominate; } }
}
export function updateDominator(o, dt, now) {
  const a = o.netAct, d = o.dom; if (!d || !o.root) return null;
  if (a) {
    const k = 1 - Math.exp(-dt * 10); o.root.position.x += (a.x - o.root.position.x) * k; o.root.position.z += (a.z - o.root.position.z) * k;
    let dy = a.yaw - o.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.root.rotation.y += dy * Math.min(1, dt * 12);
    const telling = a.motion === 'skill' && now < a.tell, w = d.warn;
    if (w) { w.visible = telling; if (telling) { const p = Math.max(0, Math.min(1, (now - a.startedAt) / Math.max(1, a.tell - a.startedAt)));
      w.position.set(o.root.position.x, d.floor + .05, o.root.position.z); w.rotation.z = a.skill === 'dominate' ? 0 : o.root.rotation.y + Math.PI;   /* 눕힌 원판의 +Y 는 세계 −Z — 앞(sin yaw, cos yaw)으로 돌리려면 +π */
      w.material.opacity = .15 + .45 * p; w.scale.setScalar(a.skill === 'dominate' ? .35 + .65 * p : 1); } }
  }
  o.dmix.update(dt);
  return a && a.motion === 'skill' && now >= a.tell && now < a.tell + 120 ? { impact: true } : null;
}
export function hideDominator(o) { const d = o.dom; if (!d) return; if (d.warn) d.warn.visible = false; o.netAct = null; d.seq = NaN; }
