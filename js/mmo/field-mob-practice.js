/* 혼자 연습 몬스터 반격 (문서 210 §8) — 서버(server/field.cjs tickEcologies · hitMob)와 같은 순서로 GPT 공용 모듈(server/field-mob-combat.cjs)을 돌린다.
   결정(쫓기 · 예고 600 ms · 공격 · 회복 · 경직 · 귀환)은 모듈이, 체력과 피해는 이 판이 맡는다. 맞히는 건 화면의 bossStrike — 회피 무적·완벽 회피가 그대로 먹는다.
   모듈이 없으면(서버 합치기 전) 이 판을 만들지 않는다 — 몬스터는 공격하지 않고 연습 체력(PRACTICE_HP)으로 맞기만 한다. */
export function createMobPractice({ MOB, ECO, planRoute = null, safe = () => false, strike }) {
  const states = new Map();
  /* 서버와 같은 길잡이: 지형 판정은 생태가, 짧은 추적 길 찾기는 틱당 두 번 · 64 노드 (server/field.cjs) */
  const nav = budget => ({ legal: (a, q) => ECO.legal(a, q), canTraverse: (a, p, q) => ECO.canTraverse(a, p, q), safe,
    route: (a, p, q) => planRoute && budget.n-- > 0 ? planRoute(p, q, r => ECO.legal(a, r), (r, t) => ECO.canTraverse(a, r, t), { step: 1, budget: 64 }) : null });
  function sync(now) {   /* 세대가 바뀐 개체는 체력·AI 를 새로 (server syncMobs) */
    for (const m of ECO.mobs.values()) { const s = states.get(m.id); if (s && s.generation === m.generation) continue;
      const stats = MOB.validateStats(MOB.statsFor(m.catalogId)); states.set(m.id, { generation: m.generation, hp: stats.hp, max: stats.hp, stats, ai: MOB.reset(m, now) }); }
    for (const id of states.keys()) if (!ECO.mobs.has(id)) states.delete(id); }
  return {
    states,
    tick(now, players) { sync(now); const nv = nav({ n: 2 });
      for (const m of ECO.mobs.values()) { const s = states.get(m.id), hit = MOB.tick(m, s.ai, s.stats, players, now, nv);
        if (hit) { const p = players.find(q => q.id === hit.target); if (p) strike(m, p, { ...hit, damage: hit.damage / p.maxHp, knock: 0 }, now); } } },
    /* 내가 친 피해 — 서버 hitMob 과 같은 뒤처리: 경직 · 나를 노림 · 0 이면 생태에 한 번 defeat */
    hit(id, dmg, now, who = 'me') { const m = ECO.mobs.get(id), s = states.get(id); if (!m || !s || !m.alive || s.generation !== m.generation) return null;
      s.hp = Math.max(0, s.hp - dmg); MOB.stagger(s.ai, now); m.anim = 'hit'; m.engaged = true; s.ai.target = who;
      const down = s.hp === 0 && !!ECO.defeat(id, now); return { hp: Math.ceil(100 * s.hp / s.max), down }; },
    /* 그리기 칸 = 생태 snapshot + 체력% + 동작 순번 (서버 mobs 8·9번째 칸과 같은 값) */
    snapshot(x, z, now) { return ECO.snapshot(x, z, now).map(e => { const s = states.get(e.id), ok = !!s && s.generation === e.generation; return { ...e, hp: e.alive && ok ? Math.ceil(100 * s.hp / s.max) : 0, seq: ok ? s.ai.seq : null }; }); },
  };
}
