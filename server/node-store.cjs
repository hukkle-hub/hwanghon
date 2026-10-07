/* 거점(노드) 저장 — 상태·점령 시각·관리 길드·정책·보급·공헌 장부 (docs/design/201 §6).
   규칙은 server/node-rules.cjs (UE HWNodeRules.h 와 같은 벡터로 시험). 함락은 실제 시간으로 흐른다: 2시간 전엔 탈환 불가,
   오래 점령될수록 단계가 오르고 보상도 오른다. 관리권은 입찰이 아니라 지난 주기 공헌으로 정해지고, 관리권은 소유권이 아니다
   (관리 길드도 다른 사람의 거점 사용을 막지 못한다 — 막는 기능 자체를 두지 않는다).
   지금 보고(nodeReport)는 클라이언트가 보낸 판 결과다(UE 혼자 하기 시제품). 서버가 판을 돌리게 되면 그 자리에서 부른다 — GPT 와 정할 것. */
const fs=require('node:fs'),path=require('node:path');
const R=require('./node-rules.cjs');
const WEEK=7*24*3600e3, HOUR=3600e3;
const REPORT_GAP=60e3;   // 한 사람이 같은 거점에 판 결과를 보내는 최소 간격
const PARTY_WINDOW=10*60e3;   // 같은 판의 파티원 보고: 첫 보고가 상태를 바꾸고, 10분 안의 같은 결과는 공헌만 쌓는다
const CAPS={kill:200,defense:500,repair:500,npc_rescue:5,boss:2e6,supply:50,command:100};   // 한 판에 말이 되는 최대치
const SUPPLY_CAP=12;
const DATA=path.join(__dirname,'..','ue','HwanghonCombatUE','Content','Data');
const knownNode=id=>typeof id==='string'&&/^[a-z0-9_]{1,32}$/.test(id)&&fs.existsSync(path.join(DATA,'node_'+id+'.json'));
const periodOf=now=>Math.floor(now/WEEK);
const methods={
 initNode(){ if(this.nodeReady) return; this.db.exec(`
  CREATE TABLE IF NOT EXISTS node_state(id TEXT PRIMARY KEY,data TEXT NOT NULL,updated INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS node_contrib(period INTEGER NOT NULL,node TEXT NOT NULL,player TEXT NOT NULL,guild TEXT,category TEXT NOT NULL,amount REAL NOT NULL,PRIMARY KEY(period,node,player,category));
  CREATE TABLE IF NOT EXISTS node_runs(id INTEGER PRIMARY KEY,node TEXT NOT NULL,player TEXT NOT NULL,outcome TEXT NOT NULL,at INTEGER NOT NULL,report TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS node_runs_player ON node_runs(player,node,at);`); this.nodeReady=true; },
 nodeLoad(id){ this.initNode(); if(!knownNode(id)) throw Error('알 수 없는 거점입니다.');
  const r=this.statement('SELECT data FROM node_state WHERE id=?').get(id);
  return { state:'stable', threat:0, fallenAt:0, steward:null, stewardPeriod:-1, policies:[], supply:0, supplyPeriod:-1, ...(r?JSON.parse(r.data):{}) }; },
 nodeSave(id,n,now){ this.statement('INSERT INTO node_state(id,data,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated').run(id,JSON.stringify(n),now); },
 /* 함락 시각에서 지금까지 — 점령 시간·단계, 2시간이 지나면 «탈환 가능» */
 nodeOccupation(n,now){ const hours=n.state==='fallen'||n.state==='retakeable'||n.state==='retaking'?Math.max(0,(now-n.fallenAt)/HOUR):0;
  if(n.state==='fallen'&&R.occupationTier(hours)!=='initial') n.state='retakeable'; return hours; },
 /* 길드 안 직책: 길드장 = leader, 임원(officer) = vice, 대장 셋 = combat/supply/craft, 나머지 member */
 guildRoleOf(player){ const g=this.guild(player); if(!g) return null;
  if(g.owner===player) return { guild:g.id, name:g.name, role:'leader' };
  const r=this.statement('SELECT role FROM guild_roles WHERE player=? AND guild=?').get(player,g.id);
  const role=!r?'member':r.role==='officer'?'vice':['combat','supply','craft'].includes(r.role)?r.role:'member';
  return { guild:g.id, name:g.name, role }; },
 /* 대장 임명 — 길드장만 (assign_roles). 부길드장은 기존 «임원» 으로 (guildManage officer) */
 guildAssign(id,target,role){ if(!['combat','supply','craft','member'].includes(role)) throw Error('직책을 확인하세요.');
  return this.transaction(()=>{ const me=this.guildRoleOf(id); if(!me||!R.hasPermission(me.role,'assign_roles')) throw Error('길드장만 직책을 맡길 수 있습니다.');
   const g=this.guild(id); if(target===id||!g.members.some(m=>m.id===target)) throw Error('길드원을 선택하세요.');
   if(role==='member') this.statement('DELETE FROM guild_roles WHERE player=?').run(target);
   else this.statement('INSERT INTO guild_roles VALUES(?,?,?) ON CONFLICT(player) DO UPDATE SET guild=excluded.guild,role=excluded.role').run(target,g.id,role);
   this.audit(id,'guildAssign',target,{role}); return this.guildRoleOf(target); }); },
 /* 지난 주기의 공헌으로 이번 주기 관리 길드를 정한다 (주기가 바뀐 뒤 처음 볼 때 한 번) */
 /* 한 주기의 길드별 공헌 — 사람마다 점수(항목별 1등 대비)를 매기고 길드로 더한다. 관리권과 쉘터 «이번 주기 순위» 가 같은 셈 */
 nodePeriodScores(id,period){ const rows=this.statement('SELECT player,guild,category,amount FROM node_contrib WHERE period=? AND node=?').all(period,id);
  const byPlayer=new Map(); for(const r of rows){ const p=byPlayer.get(r.player)||{guild:r.guild,raw:{}}; p.raw[r.category]=(p.raw[r.category]||0)+r.amount; byPlayer.set(r.player,p); }
  const players=[...byPlayer.values()], all=players.map(p=>p.raw), scores=players.map(p=>R.contributionScore(p.raw,all));
  /* 길드 순서 = 등록 순서 (동점이면 먼저 만든 길드) */
  const guilds=this.statement('SELECT id,name FROM guilds ORDER BY rowid').all(), index=new Map(guilds.map((g,i)=>[g.id,i]));
  /* 길드 단위 항목 몫 (R.guildContributionScores) — 길드 없는 사람의 공헌은 관리권에 들어가지 않는다 */
  const guildOf=players.map(p=>index.has(p.guild)?index.get(p.guild):-1), raw=guilds.map(()=>({})), active=guilds.map(()=>false);
  players.forEach((p,i)=>{ const g=guildOf[i]; if(g<0) return; active[g]=true; for(const [c,v] of Object.entries(p.raw)) raw[g][c]=(raw[g][c]||0)+v; });
  const gscores=R.guildContributionScores(raw);
  return { guilds, scores, guildOf, raw, active, gscores }; },
 nodeStandings(id,period,limit=5){ const {guilds,active,gscores}=this.nodePeriodScores(id,period);
  return guilds.map((g,i)=>[i,gscores[i]]).filter(([i,sc])=>active[i]&&sc>0).sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,limit).map(([g,sc])=>({ guild:guilds[g].id, name:guilds[g].name, score:Math.round(sc) })); },
 nodeStewardship(id,n,now){ const period=periodOf(now); if(n.stewardPeriod===period) return false;
  const {guilds,active,gscores}=this.nodePeriodScores(id,period-1);
  let winner=-1; gscores.forEach((sc,i)=>{ if(active[i]&&sc>0&&(winner<0||sc>gscores[winner])) winner=i; });   // 동점이면 먼저 만든 길드
  const next=winner>=0?{guild:guilds[winner].id,name:guilds[winner].name}:null;
  if((next&&next.guild)!==(n.steward&&n.steward.guild)) n.policies=[];   // 새 관리 길드가 정책을 다시 고른다
  n.steward=next; n.stewardPeriod=period; return true; },
 nodeView(id,now=Date.now(),viewer=null){ const n=this.nodeLoad(id); this.nodeStewardship(id,n,now); const hours=this.nodeOccupation(n,now); this.nodeSave(id,n,now);
  const tier=R.occupationTier(hours), me=viewer?this.guildRoleOf(viewer):null;
  return { id, state:n.state, occupiedHours:+hours.toFixed(3), tier, retakeIn:n.state==='fallen'?Math.max(0,2-hours):0,
   difficulty:R.DIFFICULTY[tier], reward:R.REWARD[tier], extraElites:R.EXTRA_ELITES[tier],
   steward:n.steward, policies:n.policies, effects:R.policyEffects(n.policies), supply:n.supplyPeriod===periodOf(now)?n.supply:0,
   services:R.nodeServices(n.state), period:periodOf(now), nextPeriodAt:(periodOf(now)+1)*WEEK, standings:this.nodeStandings(id,periodOf(now)),
   ...(me?{ me:{ ...me, steward:!!(n.steward&&n.steward.guild===me.guild),
     can:R.PERMS.filter(p=>R.hasPermission(me.role,p)&&(n.steward&&n.steward.guild===me.guild||p==='ping'||p==='rally')) } }:{}) }; },
 /* 판 결과 — held(방어 성공)·fallen(함락)·retaken(탈환)·retake_failed. 공헌은 이번 주기 장부에 */
 nodeReport(id,node,report,now=Date.now()){ if(!report||typeof report!=='object') throw Error('결과를 확인하세요.');
  const outcome=report.outcome; if(!['held','fallen','retaken','retake_failed'].includes(outcome)) throw Error('결과를 확인하세요.');
  const contrib={}; for(const [k,v] of Object.entries(report.contrib||{})){ if(!R.CATEGORIES.includes(k)) throw Error('공헌 항목을 확인하세요.');
   if(typeof v!=='number'||!Number.isFinite(v)||v<0) throw Error('공헌 값을 확인하세요.'); contrib[k]=Math.min(v,CAPS[k]); }
  return this.transaction(()=>{ this.initNode();
   const last=this.statement('SELECT at FROM node_runs WHERE player=? AND node=? ORDER BY at DESC LIMIT 1').get(id,node);
   if(last&&now-last.at<REPORT_GAP) throw Error('잠시 후 다시 보내세요.');
   const n=this.nodeLoad(node); this.nodeStewardship(node,n,now); const hours=this.nodeOccupation(n,now);
   /* 파티원 둘째부터: 첫 사람이 이미 «함락»·«탈환» 으로 바꿔 놓아 거절되던 것 (가상 길드 캠페인에서 드러났다) */
   const partyMate=n.lastOutcome&&n.lastOutcome.outcome===outcome&&now-n.lastOutcome.at>=0&&now-n.lastOutcome.at<=PARTY_WINDOW&&outcome!=='held';
   if(partyMate){}
   else if(outcome==='held'){ if(!R.STATES.slice(0,4).includes(n.state)) throw Error('지금은 방어전이 아닙니다.'); n.state='stable'; }
   else if(outcome==='fallen'){ if(!R.STATES.slice(0,4).includes(n.state)) throw Error('이미 함락된 거점입니다.'); n.state='fallen'; n.fallenAt=now; }
   else if(outcome==='retaken'){ if(n.state!=='retakeable'&&n.state!=='retaking') throw Error(n.state==='fallen'?'함락 2시간 뒤부터 탈환할 수 있습니다.':'탈환할 거점이 아닙니다.'); n.state='stable'; n.fallenAt=0; }
   if(!partyMate) n.lastOutcome={outcome,at:now};
   const g=this.guild(id), period=periodOf(now);
   for(const [k,v] of Object.entries(contrib)) if(v>0) this.statement('INSERT INTO node_contrib(period,node,player,guild,category,amount) VALUES(?,?,?,?,?,?) ON CONFLICT(period,node,player,category) DO UPDATE SET amount=amount+excluded.amount,guild=excluded.guild').run(period,node,id,g?g.id:null,k,v);
   this.statement('INSERT INTO node_runs(node,player,outcome,at,report) VALUES(?,?,?,?,?)').run(node,id,outcome,now,JSON.stringify({contrib,hours:+hours.toFixed(3)}));
   this.nodeSave(node,n,now); return this.nodeView(node,now,id); }); },
 /* 관리 길드의 길드장·부길드장만, 예산 안에서 (전부는 못 고른다) */
 nodePolicy(id,node,picks,now=Date.now()){ return this.transaction(()=>{ const n=this.nodeLoad(node); this.nodeStewardship(node,n,now);
  const me=this.guildRoleOf(id); if(!me||!n.steward||n.steward.guild!==me.guild) throw Error('관리 길드만 정책을 고를 수 있습니다.');
  if(!R.hasPermission(me.role,'select_policy')) throw Error('길드장·부길드장만 정책을 고를 수 있습니다.');
  if(!R.validPolicies(picks)) throw Error('정책 예산('+R.POLICY_BUDGET+')을 넘거나 겹칩니다.');
  n.policies=[...picks]; this.nodeSave(node,n,now); this.audit(id,'nodePolicy',node,{picks}); return this.nodeView(node,now,id); }); },
 /* 보급대장이 다음 방어전 보급을 배정 (주기당 최대 SUPPLY_CAP). 배정한 만큼 «보급» 공헌 */
 nodeSupply(id,node,amount,now=Date.now()){ if(!Number.isInteger(amount)||amount<1||amount>SUPPLY_CAP) throw Error('보급량을 확인하세요.');
  return this.transaction(()=>{ const n=this.nodeLoad(node); this.nodeStewardship(node,n,now); const me=this.guildRoleOf(id), period=periodOf(now);
   if(!me||!n.steward||n.steward.guild!==me.guild) throw Error('관리 길드만 보급을 배정합니다.');
   if(!R.hasPermission(me.role,'allocate_supply')) throw Error('보급대장 권한이 필요합니다.');
   const cur=n.supplyPeriod===period?n.supply:0; if(cur+amount>SUPPLY_CAP) throw Error('이번 주기 보급은 '+SUPPLY_CAP+'까지입니다.');
   n.supply=cur+amount; n.supplyPeriod=period; this.nodeSave(node,n,now);
   this.statement('INSERT INTO node_contrib(period,node,player,guild,category,amount) VALUES(?,?,?,?,?,?) ON CONFLICT(period,node,player,category) DO UPDATE SET amount=amount+excluded.amount').run(period,node,id,me.guild,'supply',amount);
   return this.nodeView(node,now,id); }); },
};
/* {type:'node', action, node, ...} → 응답. 보는 건 누구나, 고치는 건 권한대로 */
function command(store,id,msg,now=Date.now()){ const node=typeof msg.node==='string'?msg.node:'namsan_n01';
 if(msg.action==='info') return { type:'node', node:store.nodeView(node,now,id) };
 if(msg.action==='report') return { type:'node', node:store.nodeReport(id,node,msg.report,now) };
 if(msg.action==='policy') return { type:'node', node:store.nodePolicy(id,node,msg.picks,now) };
 if(msg.action==='supply') return { type:'node', node:store.nodeSupply(id,node,msg.amount,now) };
 if(msg.action==='role'){ if(typeof msg.target!=='string') throw Error('길드원을 선택하세요.'); return { type:'guildRole', target:msg.target, role:store.guildAssign(id,msg.target,msg.role) }; }
 throw Error('지원하지 않는 거점 요청입니다.'); }
function install(Store){ Object.assign(Store.prototype,methods); }
module.exports={ install, command, WEEK, HOUR, REPORT_GAP, PARTY_WINDOW, CAPS, SUPPLY_CAP, knownNode, periodOf };
