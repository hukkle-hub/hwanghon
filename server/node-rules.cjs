/* 거점(노드) 규칙 — 서버 쪽 (docs/design/200·201).
   UE 의 ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Node/HWNodeRules.h 와 같은 규칙을 서버가 쓰는 만큼만 옮겼다.
   두 구현은 tests/vectors/node-rules.json 하나로 같이 시험한다 (tests/node-rules-vectors.test.cjs) — 한쪽만 바꾸면 깨진다. */
const STATES=['stable','uneasy','alert','invasion','recovering','fallen','retakeable','retaking'];
const TIERS=['initial','basic','elite_up','fortress','infection_core'];
const POLICIES=['gate_reinforce','generator_reinforce','arm_npcs','scouting','medical_stock','reserve_power'];
const POLICY_COST={gate_reinforce:4,generator_reinforce:4,arm_npcs:3,scouting:3,medical_stock:3,reserve_power:4};
const POLICY_BUDGET=10;
const CATEGORIES=['kill','defense','repair','npc_rescue','boss','supply','command'];
const WEIGHT={kill:1,defense:1.2,repair:1,npc_rescue:1.2,boss:1,supply:0.8,command:0.8};
const ROLES=['member','craft','supply','combat','vice','leader'];
const PERMS=['ping','rally','order_npc','allocate_supply','invest_facility','select_policy','assign_roles'];

function gradeCounter(elapsed,perfect=0.10,window=0.25){ if(elapsed<0||elapsed>window) return 'none'; return elapsed<=perfect?'perfect':'normal'; }
function occupationTier(hours){ return hours<2?'initial':hours<6?'basic':hours<12?'elite_up':hours<24?'fortress':'infection_core'; }
const DIFFICULTY={initial:1,basic:1,elite_up:1.3,fortress:1.65,infection_core:2.1};
const REWARD={initial:0,basic:1,elite_up:1.35,fortress:1.8,infection_core:2.4};
const EXTRA_ELITES={initial:0,basic:0,elite_up:1,fortress:2,infection_core:3};

/* 상태 기계 — HWNodeRules::FNodeStateMachine 와 같은 전이 */
function machine(init={}){ return { state:'stable', threat:0, commsHeld:0, commsHoldToFall:20, occupiedHours:0, recover:0, ...init }; }
const calm=m=>m.state==='stable'||m.state==='uneasy'||m.state==='alert';
function setThreat(m,t){ m.threat=Math.max(0,Math.min(1,t)); if(!calm(m)) return m; m.state=m.threat>=0.6?'alert':m.threat>=0.3?'uneasy':'stable'; return m; }
function startInvasion(m){ if(!calm(m)) return false; m.state='invasion'; m.commsHeld=0; return true; }
function defenceHeld(m){ if(m.state!=='invasion') return false; m.state='recovering'; m.recover=0; return true; }
function tickInvasion(m,dt,commsDestroyed,enemyOnComms){ if(m.state!=='invasion') return false; m.commsHeld=enemyOnComms?m.commsHeld+dt:0;
 if(!commsDestroyed&&m.commsHeld<m.commsHoldToFall) return false; m.state='fallen'; m.occupiedHours=0; return true; }
function tickOccupation(m,hours){ if(m.state!=='fallen'&&m.state!=='retakeable'&&m.state!=='retaking') return; m.occupiedHours+=hours; if(m.state==='fallen'&&occupationTier(m.occupiedHours)!=='initial') m.state='retakeable'; }
function startRetake(m){ if(m.state!=='retakeable') return false; m.state='retaking'; return true; }
function retakeEnded(m,ok){ if(m.state!=='retaking') return false; m.state=ok?'recovering':'retakeable'; if(ok){ m.recover=0; m.occupiedHours=0; } return true; }
function addRecovery(m,a){ if(m.state!=='recovering') return false; m.recover+=a; if(m.recover<1) return false; m.recover=1; m.state='stable'; setThreat(m,m.threat); return true; }

/* 공헌도 — 항목마다 이번 판 1등 대비 0..100, 가중 합 */
function contributionScore(mine,all){ let total=0; for(const c of CATEGORIES){ const best=Math.max(0,...all.map(a=>a[c]||0)); if(best>0) total+=WEIGHT[c]*100*(mine[c]||0)/best; } return total; }
function stewardGuild(scores,guildOf,guildCount){ let best=-1,bestSum=0; for(let g=0;g<guildCount;g++){ let sum=0; for(let i=0;i<scores.length;i++) if(guildOf[i]===g) sum+=scores[i]; if(sum>bestSum){ bestSum=sum; best=g; } } return best; }
function validPolicies(picks,budget=POLICY_BUDGET){ if(!Array.isArray(picks)) return false; const seen=new Set(); let spent=0;
 for(const p of picks){ if(!POLICIES.includes(p)||seen.has(p)) return false; seen.add(p); spent+=POLICY_COST[p]; } return spent<=budget; }
function policyEffects(picks){ const e={gateHealthScale:1,generatorHealthScale:1,npcsArmed:false,prepBonusSeconds:0,wavePreview:false,medicalHealScale:1,extraPotions:0,reservePowerSeconds:0};
 for(const p of picks||[]){ if(p==='gate_reinforce') e.gateHealthScale=1.5; if(p==='generator_reinforce') e.generatorHealthScale=1.5; if(p==='arm_npcs') e.npcsArmed=true;
  if(p==='scouting'){ e.prepBonusSeconds=20; e.wavePreview=true; } if(p==='medical_stock'){ e.medicalHealScale=1.6; e.extraPotions=3; } if(p==='reserve_power') e.reservePowerSeconds=90; } return e; }
function hasPermission(role,perm){ switch(role){ case 'leader': return true; case 'vice': return perm!=='assign_roles';
 case 'combat': return perm==='ping'||perm==='rally'||perm==='order_npc'; case 'supply': return perm==='allocate_supply';
 case 'craft': return perm==='invest_facility'||perm==='order_npc'; default: return false; } }
/* 정보 거점 기능 — 함락되면 지도가 어두워진다 */
function nodeServices(state,commsFraction=1,power=3){ if(state==='fallen'||state==='retakeable'||state==='retaking') return {mapIntel:0.35,eventDetection:0.15,rescueSignals:false,invasionForecast:false};
 const c=Math.max(0,Math.min(1,commsFraction)), ps=power>=3?1:power===2?0.75:power===1?0.45:0.2;
 return {mapIntel:0.35+0.65*c*ps,eventDetection:0.15+0.85*c*ps,rescueSignals:c>0&&power>=1,invasionForecast:c>0.5&&power>=2&&state!=='recovering'}; }

module.exports={ STATES,TIERS,POLICIES,POLICY_COST,POLICY_BUDGET,CATEGORIES,WEIGHT,ROLES,PERMS,DIFFICULTY,REWARD,EXTRA_ELITES,
 gradeCounter,occupationTier,machine,setThreat,startInvasion,defenceHeld,tickInvasion,tickOccupation,startRetake,retakeEnded,addRecovery,
 contributionScore,stewardGuild,validPolicies,policyEffects,hasPermission,nodeServices };
