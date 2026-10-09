/* 필드 몬스터 그리기 (문서 209) — 서버/혼자 연습의 생태(server/field-ecology.cjs) snapshot 을 따라 그릴 뿐.
   snapshot 한 칸 = { id, catalogId, x, z, alive, anim:'idle'|'walk'|'die', generation }. 자리·생사는 생태가, 체력·피해는 필드가 정한다.
   **몸은 임시** — 승인된 몬스터 GLB 가 아직 없다(문서 208). 사람형 가벼운 몸을 등급색으로 물들여 쓰고 이름표에 «임시 몸» 을 단다.
   승인 몸이 오면 bodyFor(catalogId) 만 바꾸면 된다. 등급이 높다고 키우지 않는다(캐논: «무조건 거대화 금지»).
   온라인은 서버 field 패킷의 mobs 를 mobsFromPacket 으로 같은 꼴로 바꿔 넣는다(GPT 서버 인계 2026-10-09). anim 은 idle/walk/attack/hit/die —
   attack 이 시작될 때 발밑에 붉은 고리(예고 600 ms 동안 차오름)를 그린다: 보이지 않는 몬스터에게 맞는 일이 없게. */
const GRADE_TINT = { 5: [0x2c3a30, 0x0c2a10], 4: [0x2e2440, 0x2a0c40], 3: [0x3e1418, 0x5a0010] };
const GRADE_NAME = { 5: '5급', 4: '4급', 3: '3급', 2: '2급', 1: '1급' };
const CLIP = { idle: 'idle', walk: 'walk', attack: 'attack1', hit: 'hit', die: 'death' }, ONCE = new Set(['attack', 'hit', 'die']), WARN_MS = 600;
import { motionFor } from './n01-body-catalog.js';
/* 서버 mobs 한 줄 → snapshot 한 칸. GPT 서버 v2(확정): [id, catalogId, x, z, alive, anim, generation, hp%, (동작 순번)] — 앞 일곱 칸은 snapshot 과 같은 순서.
   9번째 칸(선택)은 동작 순번 — 같은 attack 이 연달아 와도 순번이 바뀌면 다시 그린다(없으면 anim 이 바뀔 때만).
   인계서 v1 의 7칸 꼴 [id, catalogId, x, z, hp%, anim, generation] 도 받는다(5번째가 숫자면 — v2 가 대체했다). 숫자가 아니면 버린다 */
export function mobsFromPacket(rows,serverNow) {
  const out = []; if (!Array.isArray(rows)) return out;
  for (const r of rows) { if (!Array.isArray(r) || typeof r[0] !== 'string') continue; const [id, catalogId, x, z] = r; if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const old = typeof r[4] === 'boolean', hp = Math.max(0, Math.min(100, Number(old ? (r[7] ?? (r[4] ? 100 : 0)) : r[4]) || 0)), anim = typeof r[5] === 'string' ? r[5] : 'idle';
    const row={ id, catalogId: String(catalogId), x, z, hp, anim, generation: Number(r[6]) || 0, seq: old ? (Number.isFinite(r[8]) ? r[8] : null) : null, alive: (old ? r[4] : hp > 0) && anim !== 'die' };
    const a=r[9];if(a&&typeof a.key==='string'&&Number.isFinite(a.windupMs)&&a.windupMs>=150&&a.windupMs<=5000&&Number.isFinite(a.seq)){row.action={...a};if(Number.isFinite(serverNow)&&Number.isFinite(a.startAt))row.action.elapsedMs=Math.max(0,serverNow-a.startAt);}out.push(row); }
  return out;
}

export function createMobView({ THREE, clone, scene, loadBody, loadBodyFor = null, hud, tagAt, catalog, floor = 0, height = 1.85 }) {
  const views = new Map(), byId = new Map(catalog.map(m => [m.id, m])), matCache = new Map(); let body = null, last = performance.now();
  const bodies=new Map(),pending=new Set();
  function selected(id){if(!loadBodyFor)return body;const entry=loadBodyFor(id);if(!entry)return body;
    if(bodies.has(id))return bodies.get(id);if(!pending.has(id)){pending.add(id);entry.load().then(g=>bodies.set(id,{...g,n01Asset:entry})).catch(e=>{console.warn('[mobs] 종별 몸 로드 실패, 임시 몸 유지',id,e);bodies.set(id,body);});}return null;}
  loadBody().then(g => { body = g; }).catch(e => console.warn('[mobs] 임시 몸', e));
  const tinted = (src, grade) => { const k = src.uuid + ':' + grade; let c = matCache.get(k); if (c) return c; const [t, g] = GRADE_TINT[grade] || GRADE_TINT[5];
    c = src.clone(); if (c.color) c.color.multiplyScalar(.55).lerp(new THREE.Color(t), .35); if (c.emissive) { c.emissive.setHex(g); c.emissiveIntensity = .06; } if ('metalness' in c) c.metalness = Math.min(c.metalness, .2);
    matCache.set(k, c); return c; };
  function make(s,asset) {
    const m = byId.get(s.catalogId) || { name: s.catalogId, grade: 5 }, root = new THREE.Group(), model = clone(asset.scene),visualH=asset.n01Asset?.height||height;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if(!asset.n01Asset){o.material = [].concat(o.material).map(x => tinted(x, m.grade)); if (o.material.length === 1) o.material = o.material[0];} } });
    const box = new THREE.Box3().setFromObject(model), k = visualH / Math.max(.1, box.max.y - box.min.y); model.scale.setScalar(k); model.position.y = -box.min.y * k;
    root.add(model); root.position.set(s.x, floor, s.z); scene.add(root);
    const mixer = new THREE.AnimationMixer(model), act = {}, named={};for(const c of asset.animations){named[c.name]=mixer.clipAction(c);if(!['idle','walk','run'].includes(c.name)){named[c.name].setLoop(THREE.LoopOnce,1);named[c.name].clampWhenFinished=true;}}
    for (const [n, clip] of Object.entries(CLIP)) {const c=named[clip]||named[n];if(c)act[n]=c;}
    if (act.idle) act.idle.play();
    const bar = document.createElement('div'); bar.className = 'mobhp'; bar.innerHTML = '<i></i>'; bar.style.display = 'none'; hud.appendChild(bar);
    const tag = document.createElement('div'); tag.className = 'tag mob g' + m.grade; tag.innerHTML = String(m.name).replace(/[<>&]/g, '') + '<small>' + (GRADE_NAME[m.grade] || '') + ' · 임시 몸</small>'; hud.appendChild(tag);
    const bodyLabel=asset.n01Asset?(asset.n01Asset.approved?'':' · 검수 후보'):' · 임시 몸';
    if(asset.n01Asset)tag.innerHTML=String(m.name).replace(/[<>&]/g,'')+'<small>'+GRADE_NAME[m.grade]+bodyLabel+'</small>';
    let aura=null;if(asset.n01Asset&&s.catalogId==='G5_RESONATOR'){aura=new THREE.Mesh(new THREE.RingGeometry(17.94,18,64),new THREE.MeshBasicMaterial({color:0xff293e,transparent:true,opacity:.08,depthWrite:false,side:THREE.DoubleSide}));aura.rotation.x=-Math.PI/2;aura.position.y=.025;root.add(aura);}
    return { id: s.id, gen: s.generation, cat: m, root, model, head:asset.n01Asset?model.getObjectByName?.('mixamorig_Head'):null, mixer, act, named, bodyLabel, aura, cur: 'idle', tag, bar, hp: 100, tx: s.x, tz: s.z, alive: true, deadT: 0, seen: true, h: visualH, warn: null, warnT: 0 };
  }
  function drop(v) {
    scene.remove(v.root);v.mixer.stopAllAction?.();v.mixer.uncacheRoot?.(v.model);
    // Geometry/materials belong to the shared body cache, but each cloned
    // skeleton's GPU bone texture and per-instance effects belong to this mob.
    const skeletons=new Set();v.model.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);});
    for(const skeleton of skeletons)skeleton.dispose?.();
    v.warn?.material.dispose?.();if(v.aura){v.aura.geometry.dispose();v.aura.material.dispose();}
    v.tag.remove();v.bar.remove();views.delete(v.id);
  }
  // Baked infected idle crouches below the A-pose height. Anchor labels to the
  // actual head, not an invisible 1.85m standing box; legacy bodies unchanged.
  function labelY(v,extra=.25){return v.head?v.head.getWorldPosition(new THREE.Vector3()).y+extra:floor+v.h+extra;}
  function play(v, n, again = false) {const name=motionFor(n,v.action,Object.keys(v.named),v.cat.id),next=v.named[name]||v.act[n];if(!next)return;
    if(v.cur==='attack'&&n==='idle'&&v.current?.isRunning()&&v.current.time<v.current.getClip().duration)return;
    if(v.cur===n&&v.current===next&&!again)return;const prev=v.current||v.act[v.cur];next.reset().play();const elapsed=['attack','support'].includes(n)?Math.max(0,v.action?.elapsedMs||0)/1000:0;if(elapsed)next.time=Math.min(elapsed,next.getClip().duration);if(prev&&prev!==next)next.crossFadeFrom(prev,.15,false);v.current=next;v.cur=n;
    if (n === 'attack') { if (!v.warn) { v.warn = new THREE.Mesh(warnGeo || (warnGeo = new THREE.RingGeometry(.55, .75, 32)), new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: .8, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false })); v.warn.renderOrder = 5; v.warn.rotation.x = -Math.PI / 2; v.warn.position.y = .04; v.root.add(v.warn); } v.warnDuration=(v.action?.windupMs||WARN_MS)/1000;v.warnT = v.warnDuration-elapsed; v.warn.visible = v.warnT>-.25; } }
  let warnGeo = null;
  return {
    views,
    update(list, dtIn) {
      const now = performance.now(), dt = dtIn ?? Math.min(.1, (now - last) / 1000); last = now;
      for (const v of views.values()) v.seen = false;
      if (body) for (const s of list) { let v = views.get(s.id);
        if (v && v.gen !== s.generation) { drop(v); v = null; }   /* 다시 났다 — 옛 몸을 끌고 오지 않는다 */
        if (!v) { if (!s.alive) continue; const asset=selected(s.catalogId);if(!asset)continue;v = make(s,asset); views.set(s.id, v); }   /* 시체로 처음 보이면 안 만든다 — 2.2초 뒤 지운 시체가 다음 패킷에 «다시 살아나 또 죽는» 걸 막는다 */
        v.seen = true; v.tx = s.x; v.tz = s.z; if (Number.isFinite(s.hp)) v.hp = s.hp;
        if (v.alive && !s.alive) { v.alive = false; v.deadT = 0; play(v, 'die'); }
        v.action=s.action||null;
        if (s.alive) { const n = s.anim==='idle'&&v.action?.support&&v.named.aura_cast?'support':CLIP[s.anim] && s.anim !== 'die' ? s.anim : 'idle', again = s.seq != null && v.seq != null && s.seq !== v.seq && (ONCE.has(n)||n==='support'); play(v, n, again);
          if(n==='attack'&&Number.isFinite(v.action?.targetX)&&Number.isFinite(v.action?.targetZ))v.root.rotation.y=Math.atan2(v.action.targetX-v.root.position.x,v.action.targetZ-v.root.position.z); }
        if (s.seq != null) v.seq = s.seq; }
      for (const v of [...views.values()]) {
        if (!v.seen && v.alive) { drop(v); continue; }   /* 관심 반경 밖 */
        const dx = v.tx - v.root.position.x, dz = v.tz - v.root.position.z, d = Math.hypot(dx, dz);
        if (d > 4) { v.root.position.x = v.tx; v.root.position.z = v.tz; } else if (d > 1e-3) { const k = Math.min(1, dt * 8); v.root.position.x += dx * k; v.root.position.z += dz * k; if (d > .02) v.root.rotation.y = Math.atan2(dx, dz); }
        if (!v.alive) { v.deadT += dt; const clip = !!v.act.die,settle=clip?v.act.die.getClip().duration:0;if(v.aura)v.aura.visible=false;v.root.position.y = floor - Math.min(1, Math.max(0, v.deadT - settle) / 1.2) * .9; if (!clip) v.root.rotation.z = Math.min(1, v.deadT / .4) * 1.2; if (v.deadT > Math.max(2.2,settle+1.2)) { drop(v); continue; } }   /* 쓰러지는 클립이 있으면 눕고 나서 가라앉는다 */
        if (v.warn && v.warn.visible) { v.warnT -= dt; const k = 1 - Math.max(0, v.warnT) / (v.warnDuration||WARN_MS / 1000); v.warn.scale.setScalar(.6 + k * .9); v.warn.material.opacity = v.warnT > 0 ? .35 + k * .55 : Math.max(0, .9 + v.warnT * 4); if (v.warnT < -.25 || !v.alive) v.warn.visible = false; }
        if (v.alive && v.hp < 100) { v.bar.style.display = ''; v.bar.firstChild.style.width = v.hp.toFixed(0) + '%'; tagAt(v.bar, v.root.position.x, labelY(v,.22), v.root.position.z); } else v.bar.style.display = 'none';   /* 맞은 몸만 체력 띠 — 무리 이름표와 따로, 마리마다 */
        if(v.warn?.visible){const counterTell=v.cat.id==='G5_ARMORED'&&v.action?.counterAllowed!==false&&v.action?.key!=='overhead_crush'&&v.warnT>0&&v.warnT<=.25;v.warn.material.color.setHex(counterTell?(v.warnT<=.10?0x8affec:0xffc45b):0xff3020);}
        v.mixer.update(dt); }
      /* 이름표는 무리(같은 둥지·순찰)마다 하나 — 붙어 선 넷의 이름표가 겹쳐 못 읽었다. 대표는 살아 있는 첫 마리, 수가 둘 넘으면 «외 ×N» */
      const groups = new Map(); for (const v of views.values()) { const g = v.id.slice(0, v.id.lastIndexOf(':')); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(v); }
      for (const list of groups.values()) { const live = list.filter(v => v.alive), lead = live[0] || null;
        for (const v of list) { if (v !== lead) { v.tag.style.display = 'none'; continue; }
          const names = [...new Set(live.map(x => x.cat.name))], head = names[0] + (live.length > 1 ? (names.length > 1 ? ' 외' : '') + ' ×' + live.length : '');
          if (v.tagHead !== head) { v.tagHead = head; v.tag.innerHTML = String(head).replace(/[<>&]/g, '') + '<small>' + (GRADE_NAME[v.cat.grade] || '') + v.bodyLabel+'</small>'; }
          tagAt(v.tag, v.root.position.x, labelY(v,.32), v.root.position.z); } }
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
