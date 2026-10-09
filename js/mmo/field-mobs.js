/* 필드 몬스터 그리기 (문서 209) — 서버/혼자 연습의 생태(server/field-ecology.cjs) snapshot 을 따라 그릴 뿐.
   snapshot 한 칸 = { id, catalogId, x, z, alive, anim:'idle'|'walk'|'die', generation }. 자리·생사는 생태가, 체력·피해는 필드가 정한다.
   **몸은 임시** — 승인된 몬스터 GLB 가 아직 없다(문서 208). 사람형 가벼운 몸을 등급색으로 물들여 쓰고 이름표에 «임시 몸» 을 단다.
   승인 몸이 오면 bodyFor(catalogId) 만 바꾸면 된다. 등급이 높다고 키우지 않는다(캐논: «무조건 거대화 금지»).
   온라인은 서버 field 패킷의 mobs 를 mobsFromPacket 으로 같은 꼴로 바꿔 넣는다(GPT 서버 인계 2026-10-09). anim 은 idle/walk/attack/hit/die —
   attack 이 시작될 때 발밑에 붉은 고리(예고 600 ms 동안 차오름)를 그린다: 보이지 않는 몬스터에게 맞는 일이 없게. */
const GRADE_TINT = { 5: [0x2c3a30, 0x0c2a10], 4: [0x2e2440, 0x2a0c40], 3: [0x3e1418, 0x5a0010] };
const GRADE_NAME = { 5: '5급', 4: '4급', 3: '3급', 2: '2급', 1: '1급' };
const CLIP = { idle: 'idle', walk: 'walk', attack: 'attack1', hit: 'hit', die: 'death' }, ONCE = new Set(['attack', 'hit', 'die']), WARN_MS = 600;
/* 서버 mobs 한 줄 → snapshot 한 칸. GPT 서버: [id, catalogId, x, z, hp%, anim, generation, (동작 순번)].
   8번째 칸(선택)은 동작 순번 — 같은 attack 이 연달아 와도 순번이 바뀌면 다시 그린다(없으면 anim 이 바뀔 때만).
   옛 지시서 꼴 [id, catalogId, x, z, alive, anim, generation, hp%] 도 받는다(5번째가 참/거짓이면). 숫자가 아니면 버린다 */
export function mobsFromPacket(rows) {
  const out = []; if (!Array.isArray(rows)) return out;
  for (const r of rows) { if (!Array.isArray(r) || typeof r[0] !== 'string') continue; const [id, catalogId, x, z] = r; if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const old = typeof r[4] === 'boolean', hp = Math.max(0, Math.min(100, Number(old ? (r[7] ?? (r[4] ? 100 : 0)) : r[4]) || 0)), anim = typeof r[5] === 'string' ? r[5] : 'idle';
    out.push({ id, catalogId: String(catalogId), x, z, hp, anim, generation: Number(r[6]) || 0, seq: old ? null : (Number.isFinite(r[7]) ? r[7] : null), alive: (old ? r[4] : hp > 0) && anim !== 'die' }); }
  return out;
}

export function createMobView({ THREE, clone, scene, loadBody, hud, tagAt, catalog, floor = 0, height = 1.85 }) {
  const views = new Map(), byId = new Map(catalog.map(m => [m.id, m])), matCache = new Map(); let body = null, last = performance.now();
  loadBody().then(g => { body = g; }).catch(e => console.warn('[mobs] 임시 몸', e));
  const tinted = (src, grade) => { const k = src.uuid + ':' + grade; let c = matCache.get(k); if (c) return c; const [t, g] = GRADE_TINT[grade] || GRADE_TINT[5];
    c = src.clone(); if (c.color) c.color.multiplyScalar(.55).lerp(new THREE.Color(t), .35); if (c.emissive) { c.emissive.setHex(g); c.emissiveIntensity = .06; } if ('metalness' in c) c.metalness = Math.min(c.metalness, .2);
    matCache.set(k, c); return c; };
  function make(s) {
    const m = byId.get(s.catalogId) || { name: s.catalogId, grade: 5 }, root = new THREE.Group(), model = clone(body.scene);
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = [].concat(o.material).map(x => tinted(x, m.grade)); if (o.material.length === 1) o.material = o.material[0]; } });
    const box = new THREE.Box3().setFromObject(model), k = height / Math.max(.1, box.max.y - box.min.y); model.scale.setScalar(k); model.position.y = -box.min.y * k;
    root.add(model); root.position.set(s.x, floor, s.z); scene.add(root);
    const mixer = new THREE.AnimationMixer(model), act = {}; for (const [n, clip] of Object.entries(CLIP)) { const c = body.animations.find(a => a.name === clip); if (!c) continue; act[n] = mixer.clipAction(c); if (ONCE.has(n)) { act[n].setLoop(THREE.LoopOnce, 1); act[n].clampWhenFinished = true; } }
    if (act.idle) act.idle.play();
    const bar = document.createElement('div'); bar.className = 'mobhp'; bar.innerHTML = '<i></i>'; bar.style.display = 'none'; hud.appendChild(bar);
    const tag = document.createElement('div'); tag.className = 'tag mob g' + m.grade; tag.innerHTML = String(m.name).replace(/[<>&]/g, '') + '<small>' + (GRADE_NAME[m.grade] || '') + ' · 임시 몸</small>'; hud.appendChild(tag);
    return { id: s.id, gen: s.generation, cat: m, root, model, mixer, act, cur: 'idle', tag, bar, hp: 100, tx: s.x, tz: s.z, alive: true, deadT: 0, seen: true, h: height, warn: null, warnT: 0 };
  }
  function drop(v) { scene.remove(v.root); v.tag.remove(); v.bar.remove(); views.delete(v.id); }
  function play(v, n, again = false) { if ((v.cur === n && !again) || !v.act[n]) return; v.act[n].reset().play(); if (v.act[v.cur]) v.act[n].crossFadeFrom(v.act[v.cur], .15, false); v.cur = n;
    if (n === 'attack') { if (!v.warn) { v.warn = new THREE.Mesh(warnGeo || (warnGeo = new THREE.RingGeometry(.55, .75, 32)), new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: .8, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false })); v.warn.renderOrder = 5; v.warn.rotation.x = -Math.PI / 2; v.warn.position.y = .04; v.root.add(v.warn); } v.warnT = WARN_MS / 1000; v.warn.visible = true; } }
  let warnGeo = null;
  return {
    views,
    update(list, dtIn) {
      const now = performance.now(), dt = dtIn ?? Math.min(.1, (now - last) / 1000); last = now;
      for (const v of views.values()) v.seen = false;
      if (body) for (const s of list) { let v = views.get(s.id);
        if (v && v.gen !== s.generation) { drop(v); v = null; }   /* 다시 났다 — 옛 몸을 끌고 오지 않는다 */
        if (!v) { if (!s.alive) continue; v = make(s); views.set(s.id, v); }   /* 시체로 처음 보이면 안 만든다 — 2.2초 뒤 지운 시체가 다음 패킷에 «다시 살아나 또 죽는» 걸 막는다 */
        v.seen = true; v.tx = s.x; v.tz = s.z; if (Number.isFinite(s.hp)) v.hp = s.hp;
        if (v.alive && !s.alive) { v.alive = false; v.deadT = 0; play(v, 'die'); }
        if (s.alive) { const n = CLIP[s.anim] && s.anim !== 'die' ? s.anim : 'idle', again = s.seq != null && v.seq != null && s.seq !== v.seq && ONCE.has(n); play(v, n, again); }
        if (s.seq != null) v.seq = s.seq; }
      for (const v of [...views.values()]) {
        if (!v.seen && v.alive) { drop(v); continue; }   /* 관심 반경 밖 */
        const dx = v.tx - v.root.position.x, dz = v.tz - v.root.position.z, d = Math.hypot(dx, dz);
        if (d > 4) { v.root.position.x = v.tx; v.root.position.z = v.tz; } else if (d > 1e-3) { const k = Math.min(1, dt * 8); v.root.position.x += dx * k; v.root.position.z += dz * k; if (d > .02) v.root.rotation.y = Math.atan2(dx, dz); }
        if (!v.alive) { v.deadT += dt; const clip = !!v.act.die; v.root.position.y = floor - Math.min(1, Math.max(0, v.deadT - (clip ? 1 : 0)) / 1.2) * .9; if (!clip) v.root.rotation.z = Math.min(1, v.deadT / .4) * 1.2; if (v.deadT > 2.2) { drop(v); continue; } }   /* 쓰러지는 클립이 있으면 눕고 나서 가라앉는다 */
        if (v.warn && v.warn.visible) { v.warnT -= dt; const k = 1 - Math.max(0, v.warnT) / (WARN_MS / 1000); v.warn.scale.setScalar(.6 + k * .9); v.warn.material.opacity = v.warnT > 0 ? .35 + k * .55 : Math.max(0, .9 + v.warnT * 4); if (v.warnT < -.25 || !v.alive) v.warn.visible = false; }
        if (v.alive && v.hp < 100) { v.bar.style.display = ''; v.bar.firstChild.style.width = v.hp.toFixed(0) + '%'; tagAt(v.bar, v.root.position.x, floor + v.h + .05, v.root.position.z); } else v.bar.style.display = 'none';   /* 맞은 몸만 체력 띠 — 무리 이름표와 따로, 마리마다 */
        v.mixer.update(dt); }
      /* 이름표는 무리(같은 둥지·순찰)마다 하나 — 붙어 선 넷의 이름표가 겹쳐 못 읽었다. 대표는 살아 있는 첫 마리, 수가 둘 넘으면 «외 ×N» */
      const groups = new Map(); for (const v of views.values()) { const g = v.id.slice(0, v.id.lastIndexOf(':')); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(v); }
      for (const list of groups.values()) { const live = list.filter(v => v.alive), lead = live[0] || null;
        for (const v of list) { if (v !== lead) { v.tag.style.display = 'none'; continue; }
          const names = [...new Set(live.map(x => x.cat.name))], head = names[0] + (live.length > 1 ? (names.length > 1 ? ' 외' : '') + ' ×' + live.length : '');
          if (v.tagHead !== head) { v.tagHead = head; v.tag.innerHTML = String(head).replace(/[<>&]/g, '') + '<small>' + (GRADE_NAME[v.cat.grade] || '') + ' · 임시 몸</small>'; }
          tagAt(v.tag, v.root.position.x, floor + v.h + .25, v.root.position.z); } }
    },
    nearest(x, z, r) { let best = null, bd = r; for (const v of views.values()) { if (!v.alive) continue; const d = Math.hypot(v.root.position.x - x, v.root.position.z - z); if (d <= bd) { bd = d; best = v; } } return best; },
    hurt(id, hp) { const v = views.get(id); if (v) v.hp = Math.max(0, Math.min(100, hp)); },   /* 혼자 연습: 연습 체력을 띠에 */
    get count() { return views.size; },
  };
}
/* 혼자 연습 몬스터 체력 — 서버 연결 전까지의 연습값(근거 없음). 등급이 오를수록 «판단» 이 올라야지 체력만 오르면 안 된다(캐논) — 5급 네 대 · 4급 열다섯 대 · 3급 마흔 대 남짓 */
export const PRACTICE_HP = { 5: 12000, 4: 45000, 3: 120000 };
/* 캐논 표(js/mmo/monster-catalog.js) → 생태 모듈이 읽는 꼴(GPT v10 스키마 이름) */
export const ecologyCatalog = catalog => catalog.map(m => ({ MonsterId: m.id, Grade: m.grade, Name: m.name, SpawnContext: m.contexts, RegionAffinity: m.regions }));
