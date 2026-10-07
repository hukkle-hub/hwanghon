/* 거점 전투 규칙 — 시뮬레이터용 JS 판 (docs/design/201 §9).
   원본은 ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Node/HWNodeRules.h. 서버가 쓰는 규칙은 server/node-rules.cjs,
   여기는 «판» 을 돌리는 데 필요한 것: 역할 수치·목표 선택·정문 차단·웨이브·전력과 포탑·NPC 상태.
   tests/vectors/node-rules.json 의 combat 벡터로 C++ 와 같은 답을 내는지 시험한다 (tests/node-rules-vectors.test.cjs). */
const ROLES = ['normal', 'runner', 'breaker', 'stalker', 'armored_elite'];
const NPC_ROLES = ['technician', 'medic', 'scout', 'operator', 'guard'];

/* HWNodeRules::RoleStats — health, damage(플레이어), facilityDamage(시설 한 방), speed(cm/s), attackCooldown, armorScale */
const STATS = {
  normal:        { health: 5500,  damage: 850,  facilityDamage: 300,  speed: 285, attackCooldown: 1.35, armorScale: 1 },
  runner:        { health: 3200,  damage: 600,  facilityDamage: 180,  speed: 520, attackCooldown: 1.1,  armorScale: 1 },
  breaker:       { health: 7000,  damage: 700,  facilityDamage: 900,  speed: 240, attackCooldown: 1.8,  armorScale: 1 },
  stalker:       { health: 4200,  damage: 800,  facilityDamage: 200,  speed: 380, attackCooldown: 1.3,  armorScale: 1 },
  armored_elite: { health: 26000, damage: 1500, facilityDamage: 1400, speed: 230, attackCooldown: 2.4,  armorScale: 0.25 },
};
const roleStats = r => STATS[r] || STATS.normal;

/* HWNodeRules::ChooseTarget — 거리(cm), 음수 = 없음(무너짐·죽음) */
const has = d => d != null && d >= 0;
function chooseTarget(role, v) {
  const facility = genFirst => genFirst && has(v.generator) ? 'generator' : has(v.gate) ? 'gate' : has(v.generator) ? 'generator' : has(v.comms) ? 'comms' : 'none';
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
  }
  return 'none';
}
function blockedByGate(enemyY, targetY, gateY, gateStanding, role, flanked) {
  if (!gateStanding) return false;
  if (role === 'runner' && flanked) return false;
  return enemyY < gateY && targetY > gateY;
}

/* 웨이브 — PrototypeAWave · FWaveRunner */
const WAVES = [
  { count: { normal: 4, runner: 2, breaker: 0, stalker: 0, armored_elite: 0 }, startAt: 0 },
  { count: { normal: 5, runner: 3, breaker: 0, stalker: 0, armored_elite: 0 }, startAt: 55 },
  { count: { normal: 6, runner: 0, breaker: 1, stalker: 0, armored_elite: 0 }, startAt: 115 },
  { count: { normal: 4, runner: 0, breaker: 0, stalker: 0, armored_elite: 1 }, startAt: 175 },
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

module.exports = { ROLES, NPC_ROLES, STATS, roleStats, chooseTarget, blockedByGate, WAVES, waveSize, waveRunner,
  generatorPower, effectivePower, TURRET_BASE_DPS, TURRET_RANGE, turretDps, eliteArmor,
  npcMaxHealth, npcFunction, technicianRepairScale, npcLife, npcEffects, prepSeconds, technicianRepairPerSecond };
