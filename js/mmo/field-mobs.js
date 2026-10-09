/* 필드 몬스터 그리기 (문서 209) — 서버/혼자 연습의 생태(server/field-ecology.cjs) snapshot 을 따라 그릴 뿐.
   snapshot 한 칸 = { id, catalogId, x, z, alive, anim:'idle'|'walk'|'die', generation }. 자리·생사는 생태가, 체력·피해는 필드가 정한다.
   **몸은 임시** — 승인된 몬스터 GLB 가 아직 없다(문서 208). 사람형 가벼운 몸을 등급색으로 물들여 쓰고 이름표에 «임시 몸» 을 단다.
   승인 몸이 오면 bodyFor(catalogId) 만 바꾸면 된다. 등급이 높다고 키우지 않는다(캐논: «무조건 거대화 금지»). */
const GRADE_TINT = { 5: [0x2c3a30, 0x0c2a10], 4: [0x2e2440, 0x2a0c40], 3: [0x3e1418, 0x5a0010] };
const GRADE_NAME = { 5: '5급', 4: '4급', 3: '3급', 2: '2급', 1: '1급' };

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
    const mixer = new THREE.AnimationMixer(model), act = {}; for (const n of ['idle', 'walk']) { const c = body.animations.find(a => a.name === n); if (c) act[n] = mixer.clipAction(c); }
    if (act.idle) act.idle.play();
    const tag = document.createElement('div'); tag.className = 'tag mob g' + m.grade; tag.innerHTML = String(m.name).replace(/[<>&]/g, '') + '<small>' + (GRADE_NAME[m.grade] || '') + ' · 임시 몸</small>'; hud.appendChild(tag);
    return { id: s.id, gen: s.generation, cat: m, root, model, mixer, act, cur: 'idle', tag, tx: s.x, tz: s.z, alive: true, deadT: 0, seen: true, h: height };
  }
  function drop(v) { scene.remove(v.root); v.tag.remove(); views.delete(v.id); }
  function play(v, n) { if (v.cur === n || !v.act[n]) return; v.act[n].reset().play(); if (v.act[v.cur]) v.act[n].crossFadeFrom(v.act[v.cur], .2, false); v.cur = n; }
  return {
    views,
    update(list, dtIn) {
      const now = performance.now(), dt = dtIn ?? Math.min(.1, (now - last) / 1000); last = now;
      for (const v of views.values()) v.seen = false;
      if (body) for (const s of list) { let v = views.get(s.id);
        if (v && v.gen !== s.generation) { drop(v); v = null; }   /* 다시 났다 — 옛 몸을 끌고 오지 않는다 */
        if (!v) { v = make(s); views.set(s.id, v); }
        v.seen = true; v.tx = s.x; v.tz = s.z;
        if (v.alive && !s.alive) { v.alive = false; v.deadT = 0; }
        if (s.alive) play(v, s.anim === 'walk' ? 'walk' : 'idle'); }
      for (const v of [...views.values()]) {
        if (!v.seen && v.alive) { drop(v); continue; }   /* 관심 반경 밖 */
        const dx = v.tx - v.root.position.x, dz = v.tz - v.root.position.z, d = Math.hypot(dx, dz);
        if (d > 4) { v.root.position.x = v.tx; v.root.position.z = v.tz; } else if (d > 1e-3) { const k = Math.min(1, dt * 8); v.root.position.x += dx * k; v.root.position.z += dz * k; if (d > .02) v.root.rotation.y = Math.atan2(dx, dz); }
        if (!v.alive) { v.deadT += dt; v.root.position.y = floor - Math.min(1, v.deadT / 1.6) * .9; v.root.rotation.z = Math.min(1, v.deadT / .4) * 1.2; if (v.deadT > 2.2) { drop(v); continue; } }
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
    get count() { return views.size; },
  };
}
/* 혼자 연습 몬스터 체력 — 서버 연결 전까지의 연습값(근거 없음). 등급이 오를수록 «판단» 이 올라야지 체력만 오르면 안 된다(캐논) — 5급 네 대 · 4급 열다섯 대 · 3급 마흔 대 남짓 */
export const PRACTICE_HP = { 5: 12000, 4: 45000, 3: 120000 };
/* 캐논 표(js/mmo/monster-catalog.js) → 생태 모듈이 읽는 꼴(GPT v10 스키마 이름) */
export const ecologyCatalog = catalog => catalog.map(m => ({ MonsterId: m.id, Grade: m.grade, Name: m.name, SpawnContext: m.contexts, RegionAffinity: m.regions }));
