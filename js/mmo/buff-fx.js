/* 버프 표시 (문서 229 §31) — 결의 · 철벽 · 표식 · 회복 결계가 걸려도 몸에 아무 표시가 없어 «피해 감소가 켜졌는지» 화면으로 알 수 없었다.
   두 겹: ① 몸빛 — 영웅 재질 패치(hero-rim)의 버프 윤곽(uBuffK · uBuffC)을 켠다(셰이더를 더 만들지 않는다) ② 발밑 — 도는 빛 고리 셋(더하기 섞기).
   색은 캐릭터마다(결의 진홍 · 철벽 금빛 · 표식 보라 · 회복 결계 초록). 들어올 때 0.15 s 로 켜지고, 끝 0.6 s 는 깜빡여 «곧 풀린다» 를 알리고, 0.2 s 로 꺼진다.
   판정(피해 감소)은 그대로 — 온라인은 서버, 혼자 연습은 P.buffUntil. 이건 내 화면에만(서버가 남의 버프를 안 보낸다) */
import { HERO_RIM } from './hero-rim.js';
export const BUFF_COLOR = { ain: 0xff4a3a, kain: 0xffc860, ryu: 0xb07aff, sera: 0x6cff9a };
export const BLINK = 0.6, FADE_IN = 0.15, FADE_OUT = 0.2;
/* 남은 시간 → 세기 0..1 (시험이 쓰는 순수 함수) */
export function buffLevel(t, dur) {
  if (t < 0 || t > dur + FADE_OUT) return 0;
  if (t > dur) return 1 - (t - dur) / FADE_OUT;
  const k = Math.min(1, t / FADE_IN), left = dur - t;
  return left < BLINK ? k * (Math.sin(left * 26) > 0 ? 1 : .3) : k * (.85 + .15 * Math.sin(t * 6));
}
export function createBuffFx(THREE, root, { reduced = false } = {}) {
  const g = new THREE.Group(); g.name = 'buffFx'; g.visible = false; root.add(g);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.62, .7, 48), mat); ring.rotation.x = -Math.PI / 2; g.add(ring);
  const arcs = new THREE.Group(); for (let i = 0; i < 3; i++) { const a = new THREE.Mesh(new THREE.RingGeometry(.82, .88, 16, 1, i * Math.PI * 2 / 3, Math.PI * .42), mat); a.rotation.x = -Math.PI / 2; arcs.add(a); } g.add(arcs);
  /* 고리만으로는 몸에 가려 안 보였다 — 발밑에 은은한 빛 원판(가운데 밝고 가장자리로 사라짐) */
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.55, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
  const discM = mat.clone(); discM.map = new THREE.CanvasTexture(cv); const disc = new THREE.Mesh(new THREE.CircleGeometry(1.05, 32), discM); disc.rotation.x = -Math.PI / 2; disc.position.y = -.01; g.add(disc);
  g.position.y = .1; const col = new THREE.Color(); let t = -1, dur = 0;
  if (!HERO_RIM.uBuffC.value) HERO_RIM.uBuffC.value = new THREE.Color(0xffffff);
  return { group: g,
    start(color, seconds) { col.set(color); mat.color.copy(col); discM.color.copy(col); HERO_RIM.uBuffC.value.copy(col); t = 0; dur = Math.max(.3, seconds); g.visible = true; },
    get active() { return t >= 0 && t <= dur + FADE_OUT; },
    tick(dt) { if (t < 0) return 0; t += dt; const k = buffLevel(t, dur);
      if (k <= 0 && t > dur) { t = -1; g.visible = false; HERO_RIM.uBuffK.value = 0; mat.opacity = 0; discM.opacity = 0; return 0; }
      HERO_RIM.uBuffK.value = .35 * k; mat.opacity = .95 * k; discM.opacity = .45 * k;   /* 몸빛 .55 는 재질 13 개 다 붙자 통째 물든 조각상 */ if (!reduced) arcs.rotation.y += dt * 2.4; ring.scale.setScalar(1 + .06 * Math.sin(t * 5)); return k; } };
}
