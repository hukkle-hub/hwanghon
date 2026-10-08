/* 거점 전투 규칙 — 시뮬레이터용 JS 판 (docs/design/201 §8).
   원본은 ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Node/HWNodeRules.h. 서버가 쓰는 규칙은 server/node-rules.cjs,
   여기는 «판» 을 돌리는 데 필요한 것: 역할 수치·목표 선택·정문 차단·웨이브·전력과 포탑·NPC 상태.
   tests/vectors/node-rules.json 의 combat 벡터로 C++ 와 같은 답을 내는지 시험한다 (tests/node-rules-vectors.test.cjs). */
const ROLES = ['normal', 'runner', 'breaker', 'stalker', 'armored_elite', 'resonator'];
/* GuildWorld v04/v05 N01_Tier5: 여섯 역할 모두 5급 (HWNodeRules::NodeThreatGrade · ArchetypeId) */
const THREAT_GRADE = 5;
const ARCHETYPE = { normal: 'T5_WALKER', runner: 'T5_RUNNER', breaker: 'T5_BREAKER', stalker: 'T5_STALKER', armored_elite: 'T5_ARMORED', resonator: 'T5_RESONATOR' };
const NPC_ROLES = ['technician', 'medic', 'scout', 'operator', 'guard'];

/* HWNodeRules::RoleStats — health, damage(플레이어), facilityDamage(시설 한 방), speed(cm/s), attackCooldown, armorScale */
const STATS = {
  normal:        { health: 5500,  damage: 850,  facilityDamage: 300,  speed: 285, attackCooldown: 1.35, armorScale: 1 },
  runner:        { health: 3200,  damage: 600,  facilityDamage: 180,  speed: 520, attackCooldown: 1.1,  armorScale: 1 },
  breaker:       { health: 7000,  damage: 700,  facilityDamage: 900,  speed: 240, attackCooldown: 1.8,  armorScale: 1 },
  stalker:       { health: 4200,  damage: 800,  facilityDamage: 200,  speed: 380, attackCooldown: 1.3,  armorScale: 1 },
  armored_elite: { health: 26000, damage: 1500, facilityDamage: 1400, speed: 230, attackCooldown: 2.4,  armorScale: 0.25 },
  resonator:     { health: 5400,  damage: 640,  facilityDamage: 220,  speed: 290, attackCooldown: 1.5,  armorScale: 1 },   // 패키지 비율(보행형 대비) × 우리 보행형
};
const roleStats = r => STATS[r] || STATS.normal;

/* HWNodeRules::ChooseTarget — 거리(cm), 음수 = 없음(무너짐·죽음) */
const has = d => d != null && d >= 0;
const RESONATOR_SELF_DEFENCE = 600, RESONATOR_TRAIL = 350, RESONATOR_PACK_RADIUS = 3000;
function chooseTarget(role, v) {
  /* 파괴형 (v05): 발전기 → 통신 → 정문 */
  const facility = genFirst => genFirst && has(v.generator) ? 'generator' : genFirst && has(v.comms) ? 'comms' : has(v.gate) ? 'gate' : has(v.generator) ? 'generator' : has(v.comms) ? 'comms' : 'none';
  switch (role) {
    case 'normal':
      if (has(v.player) && v.player <= 900) return 'player';
      if (facility(false) !== 'none') return facility(false);
      return has(v.player) ? 'player' : 'none';
    case 'runner':
      if (has(v.player) && v.player <= 300) return 'player';
      if (!v.flanked) return 'none';
      if (has(v.npc)) return 'npc';
      if (has(v.generator)) return 'generator';
      if (has(v.comms)) return 'comms';
      return has(v.player) ? 'player' : 'none';
    case 'breaker': { const f = facility(true); return f !== 'none' ? f : has(v.player) ? 'player' : 'none'; }
    case 'stalker':
      if (has(v.npc)) return 'npc';
      return has(v.player) ? 'player' : 'none';
    case 'armored_elite':
      if (has(v.player) && v.player <= 250) return 'player';
      if (has(v.gate)) return 'gate';
      if (has(v.comms)) return 'comms';
      return has(v.player) ? 'player' : 'none';
    case 'resonator':
      /* 무리 뒤 — 가까이 온 플레이어만 친다, 무리가 없으면 보행형처럼 */
      if (has(v.player) && v.player <= RESONATOR_SELF_DEFENCE) return 'player';
      if (has(v.ally)) return 'ally';
      return chooseTarget('normal', v);
  }
  return 'none';
}
/* 공진 (HWNodeRules::Resonance*) — 판(감독·시뮬)이 계산한다, 중첩 상한 1 */
const RESONANCE = { radius: 1800, move: 1.1, attack: 1.12, cap: 1, refresh: 0.4 };
const resonanceStacks = n => n <= 0 ? 0 : Math.min(n, RESONANCE.cap);
const inResonance = (role, d) => role !== 'resonator' && d >= 0 && d <= RESONANCE.radius;
const resonanceMove = k => k > 0 ? RESONANCE.move : 1, resonanceAttack = k => k > 0 ? RESONANCE.attack : 1;
function resonatorHoldPoint(self, pack) { const dx = self[0] - pack[0], dy = self[1] - pack[1], d = Math.hypot(dx, dy);
  if (d < 1) return [pack[0], pack[1] - RESONATOR_TRAIL]; const k = RESONATOR_TRAIL / d; return [pack[0] + dx * k, pack[1] + dy * k]; }
/* 역할별 목표 재평가 (v05 target_reevaluate_sec) */
const THINK = { normal: 0.7, runner: 0.35, breaker: 0.6, stalker: 0.4, armored_elite: 0.65, resonator: 0.8 };
const thinkSeconds = r => THINK[r] ?? 0.7;
/* 철갑형 세 공격 (v05) — 카운터 판정은 그대로, 카운터가 이 공격에 하는 일만 */
const ARMORED_ATTACKS = ['shield_bash', 'heavy_charge', 'shield_bash', 'overhead_crush'];
const armoredAttackAt = n => ARMORED_ATTACKS[((n % 4) + 4) % 4];
const counterAllowed = a => a !== 'overhead_crush';
const armoredCrackGrade = (a, g) => !counterAllowed(a) || g === 'none' ? 'none' : a === 'heavy_charge' ? g : 'normal';
const ARMORED_PERFECT_POSTURE = 2.25;
const armoredStaggerSeconds = (a, g) => a === 'heavy_charge' && g === 'perfect' ? 1.4 * ARMORED_PERFECT_POSTURE : 1.4;
const armoredWindupSeconds = a => a === 'heavy_charge' ? 1.0 : a === 'overhead_crush' ? 1.2 : 0.8;
/* PIE 증명 (v06 pass_conditions — HWNodeRules::FTier5Evidence 와 같은 일곱 항목) */
const TIER5_CHECKS = ['all six roles spawn', 'all spawned monsters report ThreatGrade 5', 'Breaker selects Generator at least once', 'Stalker selects NPC at least once',
  'Armored selects Gate at least once', 'Resonator aura changes a nearby T5 monster multiplier', 'the multiplier returns once the Resonator is gone'];
function tier5Evidence() {
  return { spawned: Object.fromEntries(ROLES.map(r => [r, false])), notGrade5: 0, breakerOnGenerator: false, stalkerOnNpc: false, armoredOnGate: false, auraApplied: false, auraReverted: false,
    noteSpawn(r, g) { this.spawned[r] = true; if (g !== THREAT_GRADE) this.notGrade5++; },
    noteTarget(r, k) { if (r === 'breaker' && k === 'generator') this.breakerOnGenerator = true; if (r === 'stalker' && k === 'npc') this.stalkerOnNpc = true; if (r === 'armored_elite' && k === 'gate') this.armoredOnGate = true; },
    noteResonance(b, a) { if (b === 0 && a > 0) this.auraApplied = true; if (b > 0 && a === 0) this.auraReverted = true; },
    allSpawned() { return ROLES.every(r => this.spawned[r]); },
    check(i) { return [this.allSpawned(), this.allSpawned() && this.notGrade5 === 0, this.breakerOnGenerator, this.stalkerOnNpc, this.armoredOnGate, this.auraApplied, this.auraReverted][i] ?? false; },
    pass() { return TIER5_CHECKS.every((_, i) => this.check(i)); },
    report() { return TIER5_CHECKS.map((name, i) => ({ name, pass: this.check(i) })); } };
}
function blockedByGate(enemyY, targetY, gateY, gateStanding, role, flanked) {
  if (!gateStanding) return false;
  if (role === 'runner' && flanked) return false;
  return enemyY < gateY && targetY > gateY;
}

/* 웨이브 — PrototypeAWave · FWaveRunner (GuildWorld v04 N01_Tier5_Waves_v04.json, 패키지 시각 − 20초) */
const WAVES = [
  { id: 'W1_CONTACT',  count: { normal: 4, runner: 2, breaker: 0, stalker: 0, armored_elite: 0, resonator: 0 }, startAt: 0 },
  { id: 'W2_FLANK',    count: { normal: 4, runner: 3, breaker: 0, stalker: 1, armored_elite: 0, resonator: 0 }, startAt: 45 },
  { id: 'W3_FACILITY', count: { normal: 4, runner: 0, breaker: 2, stalker: 0, armored_elite: 0, resonator: 0 }, startAt: 95 },
  { id: 'W4_PRESSURE', count: { normal: 5, runner: 0, breaker: 0, stalker: 0, armored_elite: 1, resonator: 1 }, startAt: 150 },
  { id: 'W5_BREACH',   count: { normal: 4, runner: 2, breaker: 1, stalker: 1, armored_elite: 1, resonator: 0 }, startAt: 200 },
];
const waveSize = w => ROLES.reduce((a, r) => a + w.count[r], 0);
function waveRunner() {
  return { nextWave: 0, alive: 0, clock: 0, clearedAt: -1, breather: 8, waveCount: WAVES.length,
    tick(dt) { this.clock += dt; if (this.nextWave >= this.waveCount) return -1; const w = WAVES[this.nextWave];
      const due = this.clock >= w.startAt, pulled = this.nextWave > 0 && this.alive === 0 && this.clearedAt >= 0 && this.clock - this.clearedAt >= this.breather;
      if (!due && !pulled) return -1; if (pulled && !due) this.clock = w.startAt;
      this.alive += waveSize(w); this.clearedAt = -1; return this.nextWave++; },
    enemyDied(now) { if (this.alive > 0) this.alive--; if (this.alive === 0) this.clearedAt = now; },
    done() { return this.nextWave >= this.waveCount && this.alive === 0; } };
}

/* 전력 · 포탑 */
const generatorPower = f => f <= 0 ? 0 : f <= 0.33 ? 1 : f <= 0.66 ? 2 : 3;
const effectivePower = (f, reserveLeft) => { const p = generatorPower(f); return p === 0 && reserveLeft > 0 ? 1 : p; };
const TURRET_BASE_DPS = 320, TURRET_RANGE = 1500;
const turretDps = p => p >= 3 ? TURRET_BASE_DPS : p === 2 ? TURRET_BASE_DPS * 0.6 : p === 1 ? TURRET_BASE_DPS * 0.25 : 0;

/* 철갑 */
function eliteArmor() { return { crackedFor: 0, onCountered(g) { if (g !== 'none') this.crackedFor = g === 'perfect' ? 9 : 6; },
  tick(dt) { this.crackedFor = this.crackedFor > dt ? this.crackedFor - dt : 0; }, damageScale(a) { return this.crackedFor > 0 ? 1 : a; } }; }

/* NPC */
const npcMaxHealth = (role, armed) => (role === 'guard' ? 6000 : 3000) * (armed ? 1.5 : 1);
/* 어느 NPC 를 노리나 (v05): 추적형은 기술자 1.5 · 의무관 1.35 · 나머지 1.0 − 10 m 당 0.08, 나머지 역할은 가장 가까운 NPC. 높을수록 */
const NPC_IMPORTANCE = { technician: 1.5, medic: 1.35 }, NPC_DISTANCE_PENALTY = 0.08;
const npcImportance = r => NPC_IMPORTANCE[r] ?? 1;
const npcPickScore = (hunter, npc, d) => hunter === 'stalker' ? npcImportance(npc) - d / 1000 * NPC_DISTANCE_PENALTY : -d;
const npcFunction = s => s === 'normal' ? 1 : s === 'injured' ? 0.5 : s === 'rescued' ? 0.6 : 0;
const technicianRepairScale = s => s === 'normal' ? 1 : s === 'injured' ? 0.5 : s === 'missing' ? 0.2 : 0.6;
function npcLife(max) {
  return { state: 'normal', health: max, maxHealth: max, recoverLeft: 0,
    targetable() { return this.state !== 'missing'; },
    applyDamage(a) { if (!this.targetable() || a <= 0) return false; this.health -= a; if (this.health > 0) return false;
      this.state = this.state === 'normal' ? 'injured' : 'missing'; this.health = this.state === 'injured' ? this.maxHealth * 0.5 : 0; return true; },
    rescue() { if (this.state !== 'missing') return false; this.state = 'rescued'; this.health = this.maxHealth * 0.5; this.recoverLeft = 60; return true; },
    tick(dt) { if (this.state !== 'rescued') return false; this.recoverLeft -= dt; if (this.recoverLeft > 0) return false; this.state = 'normal'; this.health = this.maxHealth; return true; } };
}
/* states: {technician:'normal', ...}, policy: server/node-rules.cjs policyEffects 결과 */
function npcEffects(states, policy) {
  const f = r => npcFunction(states[r] || 'normal');
  return { repairScale: technicianRepairScale(states.technician || 'normal'),
    medicalHealPerSecond: 0.08 * f('medic') * policy.medicalHealScale,
    prepBonusSeconds: 10 * f('scout'), wavePreview: f('scout') > 0 || policy.wavePreview,
    rescueSignals: f('operator') > 0, guardDps: policy.npcsArmed ? 150 * (f('guard') >= 1 ? 1 : 0) : 0 };
}
const prepSeconds = (npc, policy) => 20 + npc.prepBonusSeconds + policy.prepBonusSeconds;
const technicianRepairPerSecond = s => 400 * technicianRepairScale(s);

/* 공헌 (HWNodeRules::KillWeight · DefenseCredit · PingCredits) */
const KILL_WEIGHT = { normal: 1, runner: 1.2, breaker: 2, stalker: 1.5, armored_elite: 5, resonator: 2 };
const killWeight = r => KILL_WEIGHT[r] ?? 1;
const DEFENSE_RADIUS = 1500, PING_LIFE = 15, PING_RADIUS = 800;
const defenseCredit = (r, d) => d >= 0 && d <= DEFENSE_RADIUS ? killWeight(r) : 0;
const pingCredits = (age, d) => age >= 0 && age <= PING_LIFE && d <= PING_RADIUS;

/* 보급 쓰임 (HWNodeRules::SupplyCost · TurretRepairFraction · PotionHealFraction · PotionSource) */
const SUPPLY_COST = { barricade: 3, turret_repair: 2, potion: 1 };
const TURRET_REPAIR_FRACTION = 0.5, TURRET_REPAIR_BELOW = 0.5, POTION_HEAL_FRACTION = 0.4, POTION_USE_BELOW = 0.9;   // ~BELOW: 이 몫 이하일 때만 쓴다
const potionSource = (freeLeft, points) => freeLeft > 0 ? 'free' : points >= SUPPLY_COST.potion ? 'supply' : 'none';

module.exports = { TIER5_CHECKS, tier5Evidence, THREAT_GRADE, ARCHETYPE, RESONANCE, resonanceStacks, inResonance, resonanceMove, resonanceAttack, resonatorHoldPoint, RESONATOR_SELF_DEFENCE, RESONATOR_TRAIL, RESONATOR_PACK_RADIUS,
  THINK, thinkSeconds, ARMORED_ATTACKS, armoredAttackAt, counterAllowed, armoredCrackGrade, ARMORED_PERFECT_POSTURE, armoredStaggerSeconds, armoredWindupSeconds, NPC_IMPORTANCE, NPC_DISTANCE_PENALTY, npcImportance, npcPickScore,
  SUPPLY_COST, TURRET_REPAIR_FRACTION, TURRET_REPAIR_BELOW, POTION_HEAL_FRACTION, POTION_USE_BELOW, potionSource, killWeight, defenseCredit, pingCredits, DEFENSE_RADIUS, PING_LIFE, PING_RADIUS, ROLES, NPC_ROLES, STATS, roleStats, chooseTarget, blockedByGate, WAVES, waveSize, waveRunner,
  generatorPower, effectivePower, TURRET_BASE_DPS, TURRET_RANGE, turretDps, eliteArmor,
  npcMaxHealth, npcFunction, technicianRepairScale, npcLife, npcEffects, prepSeconds, technicianRepairPerSecond };
