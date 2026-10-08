/* 거점 규칙 두 구현(UE C++ HWNodeRules.h · 서버 server/node-rules.cjs)을 같은 벡터로 시험한다 (docs/design/201).
   JS 는 바로, C++ 는 벡터에서 시험 소스를 만들어 g++ 로 굽고 돌린다 — 한쪽만 바꾸면 여기서 깨진다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const R=require('../server/node-rules.cjs'), C=require('../tools/ue/node-combat-rules.cjs'), V=require('./vectors/node-rules.json');
const near=(a,b)=>Math.abs(a-b)<0.01;
test('서버 규칙: 카운터 판정·점령 단계·정책·권한',()=>{
 for(const [e,g] of V.grade) assert.equal(R.gradeCounter(e),g,'grade '+e);
 for(const [h,t] of V.occupation) assert.equal(R.occupationTier(h),t,'tier '+h);
 for(const [t,[d,rw,x]] of Object.entries(V.tier_effects)){ assert.equal(R.DIFFICULTY[t],d,'difficulty '+t); assert.equal(R.REWARD[t],rw,'reward '+t); assert.equal(R.EXTRA_ELITES[t],x,'elites '+t); }
 for(const p of V.policies) assert.equal(R.validPolicies(p.picks),p.valid,'policies '+p.picks);
 for(const role of R.ROLES) for(const perm of R.PERMS) assert.equal(R.hasPermission(role,perm),V.permissions[role].includes(perm),role+' '+perm);
});
test('서버 규칙: 공헌도(보스 딜 1위가 1등이 아니다)·관리권',()=>{
 for(const [[l,r,m],[cap,prep,rep]] of V.region_effects.cases){ const e=R.regionEffects(l,r,m); assert.equal(e.supplyCap,cap,'supply cap '+[l,r,m]); assert.ok(near(e.prepDeltaSeconds,prep)&&near(e.turretRepairScale,rep),'region '+[l,r,m]); }
 for(const K of [V.contribution,V.contribution2]){ const P=K.players; P.forEach((p,i)=>assert.ok(near(R.contributionScore(p,P),K.scores[i]),'score '+i+' '+R.contributionScore(p,P))); }
 /* 길드 단위 셈도 같은 상한·보너스 (관리권이 쓰는 쪽) */
 assert.deepEqual(R.guildContributionScores(V.contribution2.players).map(x=>+x.toFixed(3)),V.contribution2.scores);
 for(const s of V.steward) assert.equal(R.stewardGuild(s.scores,s.guild_of,s.guilds),s.expect);
});
test('서버 규칙: 상태 기계 (안정→침공→방어/함락→점령→탈환→복구)',()=>{
 for(const c of V.machine){ const m=R.machine(); c.steps.forEach((st,i)=>{ const [op,...a]=st;
  if(op==='threat') R.setThreat(m,a[0]); if(op==='invade') R.startInvasion(m); if(op==='held') R.defenceHeld(m); if(op==='recover') R.addRecovery(m,a[0]);
  if(op==='tick') R.tickInvasion(m,a[0],a[1],a[2]); if(op==='occupy') R.tickOccupation(m,a[0]); if(op==='retake') R.startRetake(m); if(op==='retake_end') R.retakeEnded(m,a[0]); if(op==='retake_tick') R.tickRetake(m,a[0],a[1],a[2]);
  assert.equal(m.state,c.expect[i],'step '+i+' '+JSON.stringify(st)); }); }
});
/* 판을 돌리는 규칙 (시뮬레이터 tools/ue/node-sim.cjs 가 쓴다) */
function waveRun(kills){ const w=C.waveRunner(), out=[], k=[...kills];
 for(let i=0;i<500;i++){ const n=w.tick(0.5); if(n>=0) out.push([n,i,+w.clock.toFixed(2)]); while(k.length&&k[0]<=i){ k.shift(); w.enemyDied(w.clock); } } return {out,done:w.done()}; }
test('전투 규칙(JS): 역할 수치·목표 선택·정문 차단·웨이브·전력·NPC',()=>{
 const K=V.combat; assert.deepEqual(C.STATS,K.stats);
 for(const c of K.target) assert.equal(C.chooseTarget(c.role,c.view),c.expect,c.role+' '+JSON.stringify(c.view));
 for(const c of K.gate) assert.equal(C.blockedByGate(...c.args),c.expect,JSON.stringify(c.args));
 assert.deepEqual(C.WAVES.map(C.waveSize),K.waves.sizes);
 for(const r of K.waves.runs){ const g=waveRun(r.kill_steps); assert.deepEqual(g.out,r.spawned); assert.equal(g.done,r.done); }
 for(const c of K.power){ assert.equal(C.effectivePower(c.f,c.reserve),c.power); assert.ok(near(C.turretDps(c.power),c.dps)); }
 for(const c of K.npc){ const pe=R.policyEffects(c.policies), e=C.npcEffects(c.states,pe); for(const [k,v] of Object.entries(c.expect)) assert.ok(typeof v==='boolean'?e[k]===v||k==='prepSeconds':near(k==='prepSeconds'?C.prepSeconds(e,pe):e[k],v),k+' '+JSON.stringify(c)); }
 const L=C.npcLife(K.life.max); K.life.seq.forEach(([op,a],i)=>{ const r=op==='dmg'?L.applyDamage(a):op==='rescue'?L.rescue():L.tick(a); assert.deepEqual([r,L.state,Math.round(L.health)],K.life.expect[i],'life '+i); });
 for(const c of K.npc_health) assert.equal(C.npcMaxHealth(c.role,c.armed),c.expect);
 assert.deepEqual(C.SUPPLY_COST,K.supply.cost); assert.equal(C.TURRET_REPAIR_FRACTION,K.supply.turret_repair_fraction); assert.equal(C.POTION_HEAL_FRACTION,K.supply.potion_heal_fraction); assert.equal(C.TURRET_REPAIR_BELOW,K.supply.turret_repair_below); assert.equal(C.POTION_USE_BELOW,K.supply.potion_use_below);
 for(const [fr,pts,src] of K.supply.potion) assert.equal(C.potionSource(fr,pts),src,'potion '+fr+' '+pts);
 for(const [r,w] of K.credit.kill) assert.equal(C.killWeight(r),w); for(const [r,d,w] of K.credit.defense) assert.equal(C.defenseCredit(r,d),w); for(const [a2,d,ok] of K.credit.ping) assert.equal(C.pingCredits(a2,d),ok);
});
/* 같은 벡터 → C++ 시험 소스 */
function cpp(){ const E={stable:'Stable',uneasy:'Uneasy',alert:'Alert',invasion:'Invasion',recovering:'Recovering',fallen:'Fallen',retakeable:'Retakeable',retaking:'Retaking'};
 const T={initial:'Initial',basic:'Basic',elite_up:'EliteUp',fortress:'Fortress',infection_core:'InfectionCore'}, G={perfect:'Perfect',normal:'Normal',none:'None'};
 const P={gate_reinforce:'GateReinforce',generator_reinforce:'GeneratorReinforce',arm_npcs:'ArmNpcs',scouting:'Scouting',medical_stock:'MedicalStock',reserve_power:'ReservePower'};
 const RO={leader:'Leader',vice:'Vice',combat:'CombatCaptain',supply:'SupplyCaptain',craft:'CraftCaptain',member:'Member'};
 const PE={ping:'Ping',rally:'Rally',order_npc:'OrderNpc',allocate_supply:'AllocateSupply',invest_facility:'InvestFacility',select_policy:'SelectPolicy',assign_roles:'AssignRoles'};
 const C={kill:'Kill',defense:'Defense',repair:'Repair',npc_rescue:'NpcRescue',boss:'Boss',supply:'Supply',command:'Command'};
 const f=x=>Number(x).toFixed(4)+'f', L=[];
 L.push('#include "HWNodeRules.h"','#include <cstdio>','#include <cmath>','using namespace HWNodeRules;','static int Fails=0;','#define CHECK(c,msg) do{ if(!(c)){ std::printf("FAIL %s\\n", msg); ++Fails; } }while(0)','int main(){');
 V.grade.forEach(([e,g],i)=>L.push(`CHECK(GradeCounter(${f(e)},0.10f,0.25f)==ECounterGrade::${G[g]},"grade ${i}");`));
 V.occupation.forEach(([h,t],i)=>L.push(`CHECK(OccupationTier(${f(h)})==EOccupationTier::${T[t]},"tier ${i}");`));
 for(const [t,[d,rw,x]] of Object.entries(V.tier_effects)) L.push(`CHECK(std::fabs(OccupationDifficulty(EOccupationTier::${T[t]})-${f(d)})<0.001f&&std::fabs(OccupationReward(EOccupationTier::${T[t]})-${f(rw)})<0.001f&&OccupationExtraElites(EOccupationTier::${T[t]})==${x},"tier effects ${t}");`);
 V.policies.forEach((p,i)=>L.push(`{ EPolicy A[8]={${p.picks.map(x=>'EPolicy::'+P[x]).join(',')||'EPolicy::GateReinforce'}}; CHECK(ValidPolicies(A,${p.picks.length})==${p.valid},"policies ${i}"); }`));
 for(const [role,perms] of Object.entries(V.permissions)) for(const pe of Object.keys(PE)) L.push(`CHECK(HasPermission(EGuildRole::${RO[role]},EGuildPerm::${PE[pe]})==${perms.includes(pe)},"perm ${role} ${pe}");`);
 [V.contribution,V.contribution2].forEach((K,ki)=>{ L.push(`{ FContribution All[${K.players.length}];`);
  K.players.forEach((p,i)=>{ for(const [k,v] of Object.entries(p)) L.push(`All[${i}].Raw[static_cast<int>(EContribution::${C[k]})]=${f(v)};`); });
  K.scores.forEach((s,i)=>L.push(`CHECK(std::fabs(ContributionScore(All[${i}],All,${K.players.length})-${f(s)})<0.01f,"score ${ki}.${i}");`));
  L.push('}'); });
 V.region_effects.cases.forEach(([[l,r,m],[cap,prep,rep]],i)=>L.push(`{ const FRegionEffects E=RegionEffects(${f(l)},${f(r)},${f(m)}); CHECK(E.SupplyCap==${cap}&&std::fabs(E.PrepDeltaSeconds-(${f(prep)}))<0.01f&&std::fabs(E.TurretRepairScale-${f(rep)})<0.001f,"region effects ${i}"); }`));
 V.steward.forEach((s,i)=>L.push(`{ const float S[]={${s.scores.map(f).join(',')}}; const int G[]={${s.guild_of.join(',')}}; CHECK(StewardGuild(S,G,${s.scores.length},${s.guilds})==${s.expect},"steward ${i}"); }`));
 V.machine.forEach((c,ci)=>{ L.push('{ FNodeStateMachine M;'); c.steps.forEach((st,i)=>{ const [op,...a]=st;
  L.push(op==='threat'?`M.SetThreat(${f(a[0])});`:op==='invade'?'M.StartInvasion();':op==='held'?'M.DefenceHeld();':op==='recover'?`M.AddRecovery(${f(a[0])});`:
   op==='tick'?`M.TickInvasion(${f(a[0])},${a[1]},${a[2]});`:op==='occupy'?`M.TickOccupation(${f(a[0])});`:op==='retake'?'M.StartRetake();':op==='retake_tick'?`M.TickRetake(${f(a[0])},${a[1]},${a[2]});`:`M.RetakeEnded(${a[0]});`);
  L.push(`CHECK(M.State==ENodeState::${E[c.expect[i]]},"machine ${ci} step ${i}");`); }); L.push('}'); });
 /* 전투 */
 const K=V.combat, RL={normal:'Normal',runner:'Runner',breaker:'Breaker',stalker:'Stalker',armored_elite:'ArmoredElite'};
 const TK={none:'None',player:'Player',gate:'Gate',generator:'Generator',comms:'Comms',npc:'Npc'}, NS={normal:'Normal',injured:'Injured',missing:'Missing',rescued:'Rescued'};
 const NR={technician:'Technician',medic:'Medic',scout:'Scout',operator:'Operator',guard:'Guard'};
 for(const [r,st] of Object.entries(K.stats)) L.push(`{ const FRoleStats S=RoleStats(EEnemyRole::${RL[r]}); CHECK(std::fabs(S.Health-${f(st.health)})<0.01f&&std::fabs(S.Damage-${f(st.damage)})<0.01f&&std::fabs(S.FacilityDamage-${f(st.facilityDamage)})<0.01f&&std::fabs(S.Speed-${f(st.speed)})<0.01f&&std::fabs(S.AttackCooldown-${f(st.attackCooldown)})<0.001f&&std::fabs(S.ArmorScale-${f(st.armorScale)})<0.001f,"stats ${r}"); }`);
 K.target.forEach((c,i)=>{ const v=c.view; L.push(`{ FTargetView W; W.Player=${f(v.player)}; W.Gate=${f(v.gate)}; W.Generator=${f(v.generator)}; W.Comms=${f(v.comms)}; W.Npc=${f(v.npc)}; W.bFlanked=${v.flanked}; CHECK(ChooseTarget(EEnemyRole::${RL[c.role]},W)==ETargetKind::${TK[c.expect]},"target ${i} ${c.role}"); }`); });
 K.gate.forEach((c,i)=>{ const [ey,ty,gy,st,r,fl]=c.args; L.push(`CHECK(BlockedByGate(${f(ey)},${f(ty)},${f(gy)},${st},EEnemyRole::${RL[r]},${fl})==${c.expect},"gate ${i}");`); });
 K.waves.sizes.forEach((n,i)=>L.push(`CHECK(WaveSize(PrototypeAWave(${i}))==${n},"wave size ${i}");`));
 K.waves.runs.forEach((r,ri)=>{ L.push(`{ FWaveRunner W; int Got[16][2]; int N=0; const int Kill[]={${r.kill_steps.join(',')||'-1'}}; int KI=0; const int KN=${r.kill_steps.length};`,
  `for(int I=0;I<500;++I){ const int S=W.Tick(0.5f); if(S>=0&&N<16){ Got[N][0]=S; Got[N][1]=I; ++N; } while(KI<KN&&Kill[KI]<=I){ ++KI; W.EnemyDied(W.Now()); } }`,
  `CHECK(N==${r.spawned.length},"wave run ${ri} count");`, ...r.spawned.map(([s,i],j)=>`CHECK(N>${j}&&Got[${j}][0]==${s}&&Got[${j}][1]==${i},"wave run ${ri} spawn ${j}");`), `CHECK(W.Done()==${r.done},"wave run ${ri} done"); }`); });
 K.power.forEach((c,i)=>L.push(`CHECK(EffectivePower(${f(c.f)},${f(c.reserve)})==${c.power}&&std::fabs(TurretDps(${c.power})-${f(c.dps)})<0.01f,"power ${i}");`));
 K.npc.forEach((c,i)=>{ const st=NR_=>NS[c.states[NR_]||'normal']; L.push(`{ ENpcState S[5]={${Object.keys(NR).map(k=>'ENpcState::'+st(k)).join(',')}}; EPolicy A[8]={${c.policies.map(x=>'EPolicy::'+P[x]).join(',')||'EPolicy::GateReinforce'}};`,
  `const FPolicyEffects PE=PolicyEffects(A,${c.policies.length}); const FNpcEffects E=NpcEffects(S,PE); const auto&X=E;`,
  `CHECK(std::fabs(X.RepairScale-${f(c.expect.repairScale)})<0.001f&&std::fabs(X.MedicalHealPerSecond-${f(c.expect.medicalHealPerSecond)})<0.001f&&std::fabs(X.PrepBonusSeconds-${f(c.expect.prepBonusSeconds)})<0.001f&&X.bWavePreview==${c.expect.wavePreview}&&X.bRescueSignals==${c.expect.rescueSignals}&&std::fabs(X.GuardDps-${f(c.expect.guardDps)})<0.01f&&std::fabs(PrepSeconds(E,PE)-${f(c.expect.prepSeconds)})<0.01f,"npc ${i}"); }`); });
 L.push(`{ FNpcLife N; N.MaxHealth=${f(K.life.max)}; N.Health=N.MaxHealth;`); K.life.seq.forEach(([op,a],i)=>{ const [r,s,h]=K.life.expect[i];
  L.push(`{ const bool R=${op==='dmg'?`N.ApplyDamage(${f(a)})`:op==='rescue'?'N.Rescue()':`N.Tick(${f(a)})`}; CHECK(R==${r}&&N.State==ENpcState::${NS[s]}&&std::fabs(N.Health-${f(h)})<0.6f,"life ${i}"); }`); }); L.push('}');
 K.npc_health.forEach((c,i)=>L.push(`CHECK(std::fabs(NpcMaxHealth(ENpcRole::${NR[c.role]},${c.armed})-${f(c.expect)})<0.01f,"npc health ${i}");`));
 { const SU={barricade:'Barricade',turret_repair:'TurretRepair',potion:'Potions'}, PS={free:'Free',supply:'Supply',none:'None'};
  for(const [u,c] of Object.entries(K.supply.cost)) L.push(`CHECK(SupplyCost(ESupplyUse::${SU[u]})==${c},"supply cost ${u}");`);
  L.push(`CHECK(std::fabs(TurretRepairFraction-${f(K.supply.turret_repair_fraction)})<0.001f&&std::fabs(PotionHealFraction-${f(K.supply.potion_heal_fraction)})<0.001f&&std::fabs(TurretRepairBelow-${f(K.supply.turret_repair_below)})<0.001f&&std::fabs(PotionUseBelow-${f(K.supply.potion_use_below)})<0.001f,"supply fractions");`);
  K.supply.potion.forEach(([fr,pts,src],i)=>L.push(`CHECK(PotionSource(${fr},${pts})==EPotionSource::${PS[src]},"potion ${i}");`)); }
 K.credit.kill.forEach(([r,w],i)=>L.push(`CHECK(std::fabs(KillWeight(EEnemyRole::${RL[r]})-${f(w)})<0.001f,"kill weight ${i}");`));
 K.credit.defense.forEach(([r,d,w],i)=>L.push(`CHECK(std::fabs(DefenseCredit(EEnemyRole::${RL[r]},${f(d)})-${f(w)})<0.001f,"defense ${i}");`));
 K.credit.ping.forEach(([a2,d,ok],i)=>L.push(`CHECK(PingCredits(${f(a2)},${f(d)})==${ok},"ping ${i}");`));
 L.push('if(Fails){ std::printf("%d failed\\n",Fails); return 1; } std::printf("vectors ok\\n"); return 0; }');
 return L.join('\n'); }
const has=c=>{ try{ execFileSync(c,['--version'],{stdio:'ignore'}); return true; }catch{ return false; } };
test('UE 규칙: 같은 벡터를 C++ 로 굽고 돌린다',{skip:!has('g++')&&'g++ 없음'},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hwvec-')), src=path.join(dir,'v.cpp'), exe=path.join(dir,'v');
 fs.writeFileSync(src,cpp());
 execFileSync('g++',['-std=c++17','-Wall','-Werror','-I',path.join(__dirname,'..','ue','HwanghonCombatUE','Source','HwanghonCombatUE','Public','Node'),'-o',exe,src],{stdio:'pipe'});
 let out; try{ out=execFileSync(exe,{encoding:'utf8'}); }catch(e){ assert.fail(String(e.stdout)); }
 assert.match(out,/vectors ok/);
});
