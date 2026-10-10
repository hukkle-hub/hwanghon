/* 보스 무대 (문서 221) — 보스전 «연출» 을 한 곳에. 싸움(판정·AI)은 서버/boss-motion 이 하고, 여기서는 보이고 들리는 것만 한다.
   디렉터: «지금 있는 보스 하나 먼저 하고 그걸 토대로 나머지도». 클레이브(강남 지하)로 먼저 만들고, 보스마다 BOSS_STAGES 한 장만 다르게 쓴다.
   · 가독성: 윤곽광(림, 셰이더) · 발밑 기운(데칼) — 어두운 지하에서 검은 갑옷이 배경에 묻혔다
   · 소리: 예고 박자마다 경고음 · 충격 · 반격 창 · 부위 파괴 · 페이즈 · 근처면 보스 배경음 (js/sfx.js 표본)
   · 등장: 처음 다가가면 3.2 초 — 레터박스 · 저각 카메라 · 이름 카드 · 포효(빛·먼지·흔들림·소리)
   · 반격 성공 · 부위 파괴 · 충격 카메라 킥 · 사망 장면(쓰러지는 클립 → 처치 카드 → 바닥으로 가라앉음)
   · 페이즈는 서버가 일부러 안 보낸다 → event('phase') 는 페이즈를 «보여도 되는» 보스만 직접 부른다
   · 이름표: 위 가운데 이름 · 칭호뿐 — 체력·페이즈는 보이지 않는다(«얼마나 남았는지 모르고 때린다», tests/field-clave-combat 의 설계 규칙)
   온라인에서도 화면만 바꾼다 — 서버 시계·판정·위치는 건드리지 않는다. 등장·사망 장면 동안 내 몸만 멈춘다(공격 단추로 넘긴다). */

/* 이름·칭호는 지도 데이터(maps/2d/<zone>/map.json bosses[].name/title)가 정본 — 여기서는 «색과 크기» 만 보스마다 다르게 쓴다.
   rim 윤곽광 색 · rimK 세기 · env 금속 반사(0 이면 없음) · aura 발밑 기운 · core 포효·고리 색 · introR 등장 반경(공격 반경보다 커야 등장 중에 안 맞는다)
   introD 등장 카메라 [처음 거리, 끝 거리, 처음 높이, 끝 높이] (보스 키 h 배) · plateR 이름표·보스 곡 반경 · introKey 같은 키끼리는 등장 장면을 한 번만(지배형 다섯) · down 처치 카드 아랫줄 */
const BASE = { introD: [1.6, 1.2, .16, .26], rim: 0xb4bccb, rimK: 0.3, env: 0, aura: 0x4f78c8, core: 0xff4a24, introR: 26, plateR: 34, metal: false, down: '' };
export const BOSS_STAGES = {
  clave: { env: 0.55, metal: true, down: '강남의 철문이 열렸다' },     /* 서버 AI 공격 반경 18 < 등장 26 */
  clave2: { env: 0.55, metal: true, down: '지하 2층의 철문이 열렸다' },
  jeong: { rim: 0xd8c8a8, aura: 0xc9a45e, core: 0xe0b060, introR: 20, plateR: 28, down: '의장대가 흩어졌다' },
  nova: { rim: 0x9fe8ff, aura: 0x40d0ff, core: 0x60e0ff, rimK: 0.4, introD: [1.3, 1.0, .9, .7],   /* 둘레 결정: 10 m 안(clear3d)은 무릎 높이, 밖은 5 m 숲 — 안쪽에서 내려다본다 (2.4h 는 결정 숲 속이었다) */
    introR: 34, plateR: 44, down: '결정 산이 멈췄다' },
  arsenal: { rim: 0xffc890, rimK: 0.14, aura: 0xff8a3a, core: 0xff8a3a, env: 0.5, metal: true,   /* 가장자리가 많은 정지 모델 — 0.3 이면 통째로 빛났다 */
    introR: 44, plateR: 56, down: '포탑 열여덟이 꺼졌다' },
  leviathan: { rim: 0x8fe0c8, rimK: 0.2, aura: 0x2fbf9f, core: 0x40e0b0, introR: 28, plateR: 36, down: '터널이 조용해졌다' },
  celestial: { rim: 0xfff0c8, aura: 0xffe0a0, core: 0xffe8b0, rimK: 0.4, introR: 36, plateR: 46, down: '하늘이 비었다' },
  celestial2: { rim: 0xfff0c8, aura: 0xffe0a0, core: 0xffe8b0, rimK: 0.4, introR: 38, plateR: 48, down: '날개 넷이 떨어졌다' },
  subject09: { rim: 0xd0ff9a, aura: 0x8fe040, core: 0xa0ff50, introR: 26, plateR: 34, down: '더는 나뉘지 않는다' },
  shadowfang: { rim: 0xb090ff, aura: 0x7a4cff, core: 0x9a6cff, introR: 20, plateR: 28, down: '소리가 끊겼다' },
  aegis: { rim: 0xa0c8ff, aura: 0x5aa0ff, core: 0x7ab8ff, env: 0.5, metal: true, introR: 30, plateR: 40, down: '보이지 않던 벽이 무너졌다' },
  dominator: { rim: 0xd8b0b0, aura: 0xa01020, core: 0xff3040, introR: 22, plateR: 30, introKey: 'dominator', down: '지배가 풀렸다' },   /* server/field-dominator AGGRO 16 < 22 */
};
export const stageOf = b => { if (!b || !b.name) return null; const k = BOSS_STAGES[b.id] || (b.ai === 'dominator' && BOSS_STAGES.dominator) || (b.stage && BOSS_STAGES[b.stage]) || {};
  return { ...BASE, ...k, name: k.name || b.name, title: k.title || b.title || '' }; };

/* 윤곽광: 시선과 면이 비스듬할수록 빛 — 어두운 배경에서 실루엣이 선다. 재질은 복제한다(지배형은 영웅 몸을 같이 쓴다)
   법선지도를 거친 normal 로 재면 잔주름마다 빛나 «전기 철사» 처럼 됐다 → 보간 법선 vNormal 로 «외곽선» 만 (문서 221 §1) */
export function rimify(THREE, model, color, k = 0.8, env = null, envK = 0.5) {
  const uK = { value: k }, uC = { value: new THREE.Color(color) };
  model.traverse(o => { if (!o.isMesh) return;
    o.material = [].concat(o.material).map(m => { if (!m || !m.isMeshStandardMaterial) return m; const c = m.clone(); c.userData.bossRim = true;
      /* 반사할 것: 금속 지도(metalnessMap)가 갑옷을 금속으로 칠하는데 필드엔 scene.environment 가 없다 → 정반사만 남아 «검은 덩어리».
         필드 전체가 아니라 보스 재질에만 던전 프리셋 환경맵을 약하게 (js/studio-env.js) */
      if (env) { c.envMap = env; c.envMapIntensity = envK; }
      c.onBeforeCompile = sh => { sh.uniforms.uRimK = uK; sh.uniforms.uRimC = uC;
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uRimK; uniform vec3 uRimC;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{\n#ifndef FLAT_SHADED\nvec3 rn = normalize(vNormal) * faceDirection;\n#else\nvec3 rn = normal;\n#endif\nfloat fr = 1.0 - clamp(dot(rn, normalize(vViewPosition)), 0.0, 1.0); totalEmissiveRadiance += uRimC * pow(fr, 4.0) * uRimK; }'); };
      c.customProgramCacheKey = () => 'boss-rim'; return c; });
    if (o.material.length === 1) o.material = o.material[0]; });
  return uK;
}

const FX = o => o.fx || o.kfx;   /* 클레이브(boss-motion) · 기술표형 보스(kit-motion) 둘 다 같은 이름표(telling·warnSeq·ringPool·floor·glow)를 단다 — 바닥 예고판(warning)은 클레이브에만 남았다(3D 필드에선 꺼 둠) */
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

export function createBossStage({ THREE, scene, cam, doc = document, sfx = () => window.TW_SFX, player, reduced = false, onLock = () => {}, occlude = null }) {
  /* occlude(at, want) → at 에서 want 로 가다 처음 부딪는 거리(없으면 Infinity) — 연출 카메라가 소품·벽 속으로 들어가지 않게 */
  const play = (n, a) => { const s = sfx(); if (s && s.play) try { s.play(n, a); } catch {} }, music = n => { const s = sfx(); if (s && s.scene) try { s.scene(n); } catch {} };
  /* 화면 겹 — 레터박스 · 이름 카드 · 이름표 · 섬광 */
  const css = doc.createElement('style'); css.textContent = `
#bsBars i{ position:fixed; left:0; right:0; height:0; background:#000; z-index:20; pointer-events:none; transition:height .35s ease; } #bsBars i:first-child{ top:0 } #bsBars i:last-child{ bottom:0 }
body.bossCine #bsBars i{ height:11vh } body.bossCine #hud{ opacity:0; pointer-events:none; } body.bossCine #mini, body.bossCine #areaName{ visibility:hidden; }   /* 지역 이름표는 inline opacity 로 서서히 꺼진다 → opacity 규칙이 안 먹었다 */
#bsCard{ position:fixed; left:50%; bottom:16vh; transform:translateX(-50%); z-index:21; text-align:center; pointer-events:none; opacity:0; transition:opacity .5s; color:#f0e2d0; font-family:'Noto Sans KR',sans-serif; text-shadow:0 2px 12px #000, 0 0 2px #000; white-space:nowrap }
#bsCard.on{ opacity:1 } #bsCard b{ display:block; font-size:clamp(30px,7vh,54px); font-weight:900; letter-spacing:.32em; padding-left:.32em } #bsCard small{ display:block; margin-top:4px; font-size:clamp(13px,2.6vh,18px); color:#c9a45e; letter-spacing:.18em } #bsCard em{ display:block; width:min(60vw,420px); height:2px; margin:8px auto 0; background:linear-gradient(90deg,transparent,#c9a45e,transparent) }
#bsPlate:not([hidden]){ position:absolute; top:calc(max(10px,env(safe-area-inset-top)) + 4px); left:50%; transform:translateX(-50%); z-index:4; text-align:center; pointer-events:none; color:#f0e2d0; font-family:'Noto Sans KR',sans-serif; text-shadow:0 1px 4px #000; display:block; max-width:min(42vw,300px) }
#bsPlate b{ font-size:16px; font-weight:900; letter-spacing:.14em } #bsPlate small{ display:block; font-size:11px; color:#c9a45e; letter-spacing:.06em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis } #bsPlate em{ display:block; width:100%; min-width:120px; height:1px; margin-top:4px; background:linear-gradient(90deg,transparent,#ff5a3a,transparent) }
#bsFlash{ position:fixed; inset:0; z-index:19; pointer-events:none; opacity:0; mix-blend-mode:screen }
#bsBanner{ position:fixed; left:50%; top:26%; transform:translateX(-50%); z-index:21; pointer-events:none; opacity:0; transition:opacity .35s; color:#ffb090; font:900 clamp(16px,3.6vh,26px) 'Noto Sans KR',sans-serif; letter-spacing:.2em; text-shadow:0 0 14px rgba(255,60,30,.8),0 2px 6px #000; white-space:nowrap } #bsBanner.on{ opacity:1 }`;
  doc.head.appendChild(css);
  const mk = (id, html = '') => { const e = doc.createElement('div'); e.id = id; e.innerHTML = html; doc.body.appendChild(e); return e; };
  const bars = mk('bsBars', '<i></i><i></i>'), card = mk('bsCard'), flashEl = mk('bsFlash'), banner = mk('bsBanner');
  const plate = doc.createElement('div'); plate.id = 'bsPlate'; plate.hidden = true; (doc.getElementById('hud') || doc.body).appendChild(plate); void bars;
  let dim = 0, flashT = 0, flashDur = 1, flashA = 0, bannerT = 0, cardT = 0;
  const flash = (color, a = .55, dur = .35) => { if (reduced) a *= .4; flashEl.style.background = color; flashA = a; flashEl.style.opacity = a; flashT = flashDur = dur; };
  const showBanner = (t, life = 2.2) => { banner.textContent = t; banner.classList.add('on'); bannerT = life; };
  const showCard = (name, sub, life) => { card.innerHTML = `<b>${name}</b><small>${sub}</small><em></em>`; card.classList.add('on'); cardT = life; };

  /* 발밑 기운 — 방사형 그라데이션 원(보스 위치가 어둠 속에서도 읽힌다) */
  const auraTex = (() => { const cv = doc.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); if (!g) return null; const gr = g.createRadialGradient(64, 64, 4, 64, 64, 63); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.45, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(cv); return t; })();
  const list = [], seen = new Set(), store = (() => { try { return sessionStorage; } catch { return null; } })();
  const introDone = id => seen.has(id) || (store && store.getItem('tw:bossIntro:' + id) === '1'), markIntro = id => { seen.add(id); try { store && store.setItem('tw:bossIntro:' + id, '1'); } catch {} };

  function attach(o, cfg = stageOf(o.b)) { if (!cfg || o.stage) return o.stage;
    const st = { cfg, rimK: o.model ? (o.model.userData.rimK || rimify(THREE, o.model, cfg.rim, cfg.rimK)) : { value: 0 }, warnKey: '', counterOn: false, impactT: 0, aura: null };
    if (auraTex) { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ map: auraTex, color: cfg.aura, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 3; m.userData.noCam = true; const r = Math.max(2.6, (o.h || 3) * .9); m.scale.setScalar(r); scene.add(m); st.aura = m; }
    if (o.model) { const bx = new THREE.Box3().setFromObject(o.model); st.span = Math.max(bx.max.x - bx.min.x, bx.max.z - bx.min.z) / 2; }   /* 긴 몸(레비아탄)은 키보다 길이로 잡는다 */
    o.stage = st; list.push(o); return st; }

  /* 카메라 연출: shot = { from, to, look, t, dur, back } — 게임 카메라 → 연출 → 게임 카메라로 부드럽게 */
  let shot = null, lockT = 0, kick = 0, kickDir = new THREE.Vector3(), fovPunch = 0;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), P = new THREE.Vector3(), L = new THREE.Vector3(), V1 = new THREE.Vector3();
  const lock = on => { doc.body.classList.toggle('bossCine', on); onLock(on); };
  const face = o => V1.set(o.root.position.x, o.root.position.y + (o.h || 3) * .62, o.root.position.z);   /* 가슴 — 얼굴(.78)을 보면 보스가 화면 아래로 내려앉았다 */

  function intro(o) { const st = o.stage, cfg = st.cfg, pp = player(), bx = o.root.position.x, bz = o.root.position.z; let dx = pp.x - bx, dz = pp.z - bz; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const h = o.h || 3, hs = Math.max(h, (st.span || 0) * .8), D = cfg.introD || [1.6, 1.2, .16, .26], side = 0.35, sx = dx * Math.cos(side) - dz * Math.sin(side), sz = dx * Math.sin(side) + dz * Math.cos(side);
    shot = { kind: 'intro', o, t: 0, dur: 3.3, blendIn: .45, blendOut: .6,
      a: new THREE.Vector3(sx * hs * D[0], h * D[2], sz * hs * D[0]), b: new THREE.Vector3(sx * hs * D[1], h * D[3], sz * hs * D[1]) };   /* 거리는 키·길이 중 큰 쪽, 높이는 키 */   /* 보스 기준 상대 위치 — 보스가 움직여도 구도가 남는다 */   /* 낮게·가깝게 — 올려다본다 (2.6h 는 보스가 화면 1/4 이었다) */
    shot.beats = [[.7, () => showCard(cfg.name, cfg.title, 2.2)],
      [.9, () => { play('phase'); kick = Math.max(kick, .35); kickDir.set(0, -1, 0); flash(`radial-gradient(circle at 50% 45%, ${hex(cfg.core)}99, transparent 60%)`, .6, .5); st.rimK.value = cfg.rimK * 2.4; if (FX(o) && FX(o).glow) { FX(o).glow.visible = true; FX(o).glow.intensity = 6; } ring(o, (o.h || 3) * 1.6); }]];
    markIntro(cfg.introKey || o.b.id); lockT = shot.dur; lock(true); music('boss'); }

  function death(o, done) { const st = o.stage; if (!st || st.dying) { done && done(); return; } const cfg = st.cfg, pp = player(), bx = o.root.position.x, bz = o.root.position.z, h = o.h || 3;
    st.dying = { t: 0, done, sink: 0, y0: o.model ? o.model.position.y : 0, rx0: o.model ? o.model.rotation.x : 0, ry0: o.root.position.y, mix: null, clip: false };
    if (FX(o) && FX(o).warning) { FX(o).warning.visible = FX(o).warningOutline.visible = false; } if (o.dom && o.dom.warn) o.dom.warn.visible = false;
    if (o.netAct) o.netAct = { ...o.netAct, motion: 'death', seq: (o.netAct.seq || 0) + 1e6 };
    /* 쓰러지는 클립: 클레이브(actions) · 지배형(dacts — 죽으면 월드 루프가 dmix 를 안 돌려서 여기서 돌린다) · 그 밖(deathClip) · 없으면(정지 모델) 앞으로 기울며 주저앉기 */
    const dk = o.dacts && Object.keys(o.dacts).find(k => /death|die/i.test(k)), mix = o.actions ? o.mixer : dk ? o.dmix : o.deathClip ? o.mixer : null;
    const act = o.actions ? (o.actions.death || o.actions.down) : dk ? o.dacts[dk] : o.deathClip && o.mixer ? o.mixer.clipAction(o.deathClip) : null;
    if (mix && act) { mix.stopAllAction(); act.reset(); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; act.timeScale = .7;   /* death 2.1s → 3.0s: 무너지는 게 보이게 */ act.play(); st.dying.clip = true; if (dk) st.dying.mix = mix; }
    const near = Math.hypot(pp.x - bx, pp.z - bz) < (cfg.plateR || 34);
    if (near) { let dx = pp.x - bx, dz = pp.z - bz; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d; const r = h * 2.0, by = o.root.position.y;
      shot = { kind: 'death', o, t: 0, dur: 4.6, blendIn: .5, blendOut: .7, orbit: { cx: bx, cz: bz, r, a0: Math.atan2(dx, dz) - .5, a1: Math.atan2(dx, dz) + .35, y0: by + h * .5, y1: by + h * .8 } };
      shot.beats = [[.9, () => play('clear')], [2.3, () => showCard(cfg.name + ' 처치', cfg.down || '', 2.4)]   /* 무릎이 꺾인 뒤에 (2.3s ≈ 클립 77%) */];
      lockT = shot.dur; lock(true); flash('#fff', .75, .6); play('ult'); }
    music('off'); st.rimK.value = cfg.rimK * 2; if (st.aura) st.aura.material.opacity = .9; }

  function ring(o, r) { if (!FX(o) || !FX(o).ringPool) return; const p = FX(o).ringPool.find(x => !x.active) || FX(o).ringPool[0]; p.active = true; p.t = 0; p.life = .7; p.r = r; p.m.visible = true; p.m.material.color.setHex(o.stage.cfg.core); p.m.position.set(o.root.position.x, (FX(o).floor || 0) + .06, o.root.position.z); FX(o).ringActive = (FX(o).ringActive || 0) + 1; }
  const hex = c => '#' + c.toString(16).padStart(6, '0');

  function event(o, kind, data = {}) { const st = o && o.stage; if (!st) return; const cfg = st.cfg, pp = player(), d = Math.hypot(pp.x - o.root.position.x, pp.z - o.root.position.z);
    if (kind === 'impact') { if (d < 22) { play('hit', { tier: 'smash', material: cfg.metal ? 'metal' : 'core' }); const k = Math.max(0, 1 - d / 22); kick = Math.max(kick, .22 + .38 * k); kickDir.set(pp.x - o.root.position.x, 0, pp.z - o.root.position.z).normalize(); kickDir.y = -.6; fovPunch = Math.max(fovPunch, 3.5 * k); } }
    else if (kind === 'counter') { play('counter', true); flash('radial-gradient(circle at 50% 50%, rgba(120,230,255,.75), transparent 65%)', .7, .45); kick = Math.max(kick, .3); kickDir.set(0, -1, 0); fovPunch = Math.max(fovPunch, -4); }
    else if (kind === 'tele') { if (d < 30) play('tele'); }   /* 예고 원 대신 표식만 쓰는 기술(방전 폭우) */
    else if (kind === 'break') { play('brk'); flash('radial-gradient(circle at 50% 50%, rgba(255,210,140,.7), transparent 60%)', .6, .4); showBanner('셔터 파괴 — 무방비', 2); }
    else if (kind === 'phase') { play('phase'); flash(`radial-gradient(circle at 50% 50%, transparent 30%, ${hex(cfg.core)}cc 100%)`, .8, .9); kick = Math.max(kick, .45); kickDir.set(0, -1, 0); ring(o, (o.h || 3) * 2.4); if (data.text) showBanner(data.text, 2.6); st.rimK.value = cfg.rimK * 2.2; } }

  function skip() { if (!shot) return; if (shot.beats) { for (const b of shot.beats) if (b[0] < 1.2) b[1](); shot.beats = null; } shot.t = Math.max(shot.t, shot.dur - shot.blendOut); lockT = 0; card.classList.remove('on'); }

  function tick(dt, now = Date.now()) { const pp = player(); let plateFor = null, plateD = 1e9;
    for (const o of list) { const st = o.stage, cfg = st.cfg, alive = o.root.visible && !st.dying, bx = o.root.position.x, bz = o.root.position.z, d = Math.hypot(pp.x - bx, pp.z - bz);
      if (st.aura) { st.aura.visible = o.root.visible; st.aura.position.set(bx, (FX(o)?.floor || 0) + .03, bz); st.aura.material.opacity += ((alive ? .3 : 0) - st.aura.material.opacity) * Math.min(1, dt * 4); }   /* 바닥 예고는 없앴다(문서 224) — 발밑 기운은 늘 같은 세기 */
      st.rimK.value += (cfg.rimK - st.rimK.value) * Math.min(1, dt * 1.6); st.impactT = Math.max(0, st.impactT - dt);
      const a = o.netAct;
      if (alive) {
        /* 준비 동작 박자마다 기합음 — boss-motion warning() · kit-motion 이 고른 박자(warnSeq · warnBeat). 바닥 예고는 없고 몸이 알린다 (문서 224) */
        const fx = FX(o); if (fx && fx.telling) { const k = fx.warnSeq + ':' + fx.warnBeat; if (k !== st.warnKey) { st.warnKey = k; if (d < 30) play('tele'); st.impactT = .4; } }
        const counter = !!(a && a.motion === 'skill' && a.counterOpen && now >= a.counterOpen && now <= a.counterClose); if (counter && !st.counterOn && d < 30) play('guard'); st.counterOn = counter;
        if (!shot && !introDone(cfg.introKey || o.b.id) && (!a || a.motion === 'idle') && d < (cfg.introR || 26)) intro(o);   /* AI 없는 보스는 netAct 가 없다 = 늘 대기 */
        if (d < (cfg.plateR || 34) && d < plateD) { plateD = d; plateFor = o; } }
      if (st.dying) { const y = st.dying, h = o.h || 3; y.t += dt; if (o.wind) { o.wind.g.position.set(0, 0, 0); o.wind.g.rotation.set(0, 0, 0); o.wind.g.scale.set(1, 1, 1); }   /* 쓰러질 땐 준비 동작 없음 */ if (y.mix) y.mix.update(dt);
        if (y.ry0 > .5) { const f = Math.min(1, y.t / 1.1); o.root.position.y = y.ry0 * (1 - f * f); }   /* 떠 있던 보스(셀레스티얼)는 땅으로 떨어진다 */
        if (o.model) { let dy = 0; if (!y.clip) { const k = smooth((y.t - .3) / 1.6), tilt = (st.span || 0) < h * 1.1; if (tilt) o.model.rotation.x = y.rx0 + k * .32; dy = k * h * .12; }   /* 정지 모델: 앞으로 기울며 주저앉는다 — 긴 몸은 기울이면 꼬리가 하늘로 들려 가라앉기만 */
          if (y.t > 3.8) { y.sink = Math.min(1, (y.t - 3.8) / .9); dy += y.sink * h * .5; if (st.aura) st.aura.material.opacity *= .9; }
          o.model.position.y = y.y0 - dy; }
        if (y.t > 4.9) { st.dying = null; o.root.position.y = y.ry0; if (o.model) { o.model.position.y = y.y0; o.model.rotation.x = y.rx0; } st.warnKey = ''; y.done && y.done(); } }
    }
    { let d = 0; for (const o of list) { const f = FX(o); if (f && f.dim && o.root.visible) d = Math.max(d, f.dim); } dim = reduced ? d * .6 : d; }   /* 방전 폭우: 하늘이 어두워진다 — world3d 가 그릴 때 노출에 곱한다 (조작 화면은 그대로) */
    /* 배경음: 살아 있는 보스 근처면 보스 곡 */
    const want = plateFor ? 'boss' : 'off'; if (want !== tick.music) { tick.music = want; music(want); }
    if (plateFor) { const cfg = plateFor.stage.cfg, key = cfg.name + cfg.title; if (plate.dataset.k !== key) { plate.dataset.k = key; plate.innerHTML = `<b>${cfg.name}</b><small>${cfg.title}</small><em></em>`; } }
    plate.hidden = !plateFor || !!shot;
    if (shot) { shot.t += dt; /* 박자는 연출 시계로 — setTimeout 이면 느린 기기·헤드리스에서 카메라와 어긋난다 */
      if (shot.beats) while (shot.beats.length && shot.t >= shot.beats[0][0]) shot.beats.shift()[1]();
      if (shot && shot.t >= shot.dur) shot = null; }
    if (lockT > 0) { lockT -= dt; if (lockT <= 0) { lockT = 0; lock(false); } }
    if (flashT > 0) { flashT = Math.max(0, flashT - dt); flashEl.style.opacity = (flashA * smooth(flashT / flashDur)).toFixed(3); }
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) banner.classList.remove('on'); }
    if (cardT > 0) { cardT -= dt; if (cardT <= 0) card.classList.remove('on'); }
  }

  /* placeCam 다음에 부른다 — 연출 중이면 카메라를 가져오고, 아니면 충격 킥·FOV 펀치만 더한다 */
  const baseFov = cam.fov;
  function applyCamera(dt) {
    if (shot) { const s = shot, o = s.o, u = s.t / s.dur; let w = s.t < s.blendIn ? smooth(s.t / s.blendIn) : s.t > s.dur - s.blendOut ? smooth((s.dur - s.t) / s.blendOut) : 1;
      if (s.kind === 'intro') { P.lerpVectors(s.a, s.b, smooth(u)); P.add(o.root.position); L.copy(face(o)); }
      else { const ob = s.orbit, a = ob.a0 + (ob.a1 - ob.a0) * smooth(u); P.set(ob.cx + Math.sin(a) * ob.r, ob.y0 + (ob.y1 - ob.y0) * smooth(u), ob.cz + Math.cos(a) * ob.r); L.set(ob.cx, o.root.position.y + (o.h || 3) * .45, ob.cz); }
      if (occlude) { const c = L, hit = occlude(c, P); if (hit < Infinity) P.sub(c).setLength(Math.max(1.2, hit)).add(c); }
      camLook.copy(cam.position).add(V1.set(0, 0, -1).applyQuaternion(cam.quaternion).multiplyScalar(8));
      camPos.copy(cam.position).lerp(P, w); camLook.lerp(L, w); cam.position.copy(camPos); cam.lookAt(camLook); }
    if (kick > 0 && !reduced) { const k = kick * kick; cam.position.addScaledVector(kickDir, k * .35); cam.position.x += (Math.random() - .5) * k * .18; cam.position.y += (Math.random() - .5) * k * .18; kick = Math.max(0, kick - dt * 1.8); }
    const fv = baseFov + fovPunch; if (Math.abs(cam.fov - fv) > .01) { cam.fov = fv; cam.updateProjectionMatrix(); } fovPunch *= Math.max(0, 1 - dt * 6); if (Math.abs(fovPunch) < .02) fovPunch = 0;
  }

  return { attach, tick, event, death, skip, applyCamera, intro,
    get locked() { return lockT > 0; }, get dim() { return dim; }, get shot() { return shot && { kind: shot.kind, t: +shot.t.toFixed(2), id: shot.o.b.id }; }, get list() { return list; } };
}
