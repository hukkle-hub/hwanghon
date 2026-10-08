/* 필드 완벽 회피 연출 (문서 205 §4) — 솔로(js/game3d.js perfectDodge)의 «캐릭터 모양 잔상 + 푸른 비네트» 를 필드로.
   판정: 맞을 시각이 회피를 누른 뒤 PERFECT_MS 안 — 솔로 js/dungeons.js dodge.perfect(0.14초)와 같다.
   온라인은 누른 순간이 서버에 닿기까지 걸리므로(서버는 dodgeB 가 도착한 때 무적을 연다) NET_SLACK 을 더 준다 — 근거 없음, 같이 조정할 값.
   연출만 한다(보상 없음): 판정·피해는 서버(또는 혼자 연습의 같은 규칙)가 이미 끝냈다.
   느린 시간(슬로모)은 일부러 없다 — 필드 보스 안무는 서버 시계로 돌아서, 나만 느려지면 보스와 어긋난다. */
import * as THREE from '../../vendor/three/three.module.js';
import { clone } from '../../vendor/three/SkeletonUtils.js';

export const PERFECT_MS = 140, NET_SLACK = 80;
export function isPerfect(pressAt, hitAt, online = false) {
  const d = hitAt - pressAt; return Number.isFinite(d) && d >= 0 && d <= PERFECT_MS + (online ? NET_SLACK : 0);
}

/* 지금 자세를 얼린 복제 — 뼈대만 복제하고 형상은 공유, 더하기 합성으로 사라진다 */
export function ghostSnap(scene, model, color, opacity, life) {
  if (!model || !model.parent) return null;
  /* clone 은 userData 를 JSON 으로 복사한다 — 2D 필드 영웅은 userData 에 장면 물체(sil 등)를 물고 있어 «순환 구조» 로 터졌다. 복제하는 동안만 비운다 */
  const kept = []; model.traverse(o => { kept.push([o, o.userData]); o.userData = {}; });
  let g; try { g = clone(model); } finally { for (const [o, u] of kept) o.userData = u; }
  const src = [], dst = [];
  model.traverse(o => { if (o.isBone) src.push(o); }); g.traverse(o => { if (o.isBone) dst.push(o); });
  for (let i = 0; i < src.length && i < dst.length; i++) { dst[i].position.copy(src[i].position); dst[i].quaternion.copy(src[i].quaternion); dst[i].scale.copy(src[i].scale); }
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const drop = []; g.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = o.receiveShadow = false; o.frustumCulled = false; } else if (o.isLight || o.isSprite || o.isPoints) drop.push(o); });
  drop.forEach(o => o.parent && o.parent.remove(o));
  model.parent.updateMatrixWorld(true);
  const holder = new THREE.Group(); holder.matrixAutoUpdate = false; holder.matrix.copy(model.parent.matrixWorld); holder.add(g); scene.add(holder);
  const t0 = performance.now();
  (function fade() { const k = (performance.now() - t0) / life; mat.opacity = opacity * Math.max(0, 1 - k) * (1 - k * 0.3);
    if (k < 1) requestAnimationFrame(fade); else { scene.remove(holder); mat.dispose(); } })();
  return holder;
}

let vig = null;
function vignette() {
  if (!vig) {
    const st = document.createElement('style');
    st.textContent = '.pd-vig{position:fixed;inset:0;pointer-events:none;z-index:40;opacity:0;background:radial-gradient(ellipse at center,rgba(120,180,255,0) 45%,rgba(60,110,200,.38) 100%)}.pd-vig.on{animation:pdVig .9s ease-out}@keyframes pdVig{0%{opacity:0}12%{opacity:1}100%{opacity:0}}';
    document.head.appendChild(st); vig = document.createElement('div'); vig.className = 'pd-vig'; document.body.appendChild(vig);
  }
  vig.classList.remove('on'); void vig.offsetWidth; vig.classList.add('on');
}

/* 솔로와 같은 박자: 잔상 다섯 개를 70 ms 마다 (줄임 모드는 하나, 비네트 없음) */
export function perfectDodgeFx(scene, model, { reduced = false } = {}) {
  const n = reduced ? 1 : 5;
  for (let i = 0; i < n; i++) setTimeout(() => ghostSnap(scene, model, i % 2 ? 0x7fb8ff : 0xb8e4ff, 0.42 - i * 0.05, 900 - i * 60), i * 70);
  if (!reduced) { vignette(); try { navigator.vibrate?.([18, 30, 18]); } catch {} }
  return n;
}
