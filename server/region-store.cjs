/* 지역 전략망 저장 — 서울 8거점의 운영 상태·위협·압력, 다거점 관리권(관리 용량), 길드 전략 명령 (docs/design/202).
   서버가 권위다 (패키지 BACKEND_STATE_CONTRACT_V03): 클라이언트는 관리 길드·압력·공헌 합계를 정하지 못한다.
   망은 30분 논리 스텝으로 움직이고, 매 프레임이 아니라 «볼 때 밀린 만큼» 돌린다 (함락 시계와 같은 방식).
   전술 판이 있는 거점(남산 = namsan_n01)은 판 결과(server/node-store.cjs nodeReport)가 상태를 바꾼다. */
const G=require('./region-rules.cjs'), R=require('./node-rules.cjs');
const WEEK=7*24*3600e3;
const periodOf=now=>Math.floor(now/WEEK);
const regions=new Map();
const fs=require('node:fs'), path=require('node:path');
const KOREA=JSON.parse(fs.readFileSync(path.join(__dirname,'..','ue','HwanghonCombatUE','Content','Data','korea.json'),'utf8'));
const regionCfg=id=>{ if(!G.knownRegion(id)) throw Error('알 수 없는 지역입니다.'); if(!regions.has(id)) regions.set(id,G.loadRegion(id)); return regions.get(id); };
/* 전술 거점 → 지역 (지금은 서울 하나) */
const REGION_OF_NODE=new Map(); for(const rid of KOREA.regions.map(r=>r.id)) for(const n of regionCfg(rid).nodes) if(n.node) REGION_OF_NODE.set(n.node,{ region:rid, id:n.id });
const CALM=['stable','uneasy','alert','invasion'];

const methods={
 initRegion(){ if(this.regionReady) return; this.db.exec(`
  CREATE TABLE IF NOT EXISTS region_state(id TEXT PRIMARY KEY,data TEXT NOT NULL,updated INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS guild_orders(id INTEGER PRIMARY KEY,guild TEXT NOT NULL,region TEXT NOT NULL,node TEXT NOT NULL,type TEXT NOT NULL,
   priority INTEGER NOT NULL,squads INTEGER NOT NULL,resource INTEGER NOT NULL,issuer TEXT NOT NULL,at INTEGER NOT NULL,period INTEGER NOT NULL,active INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS guild_orders_guild ON guild_orders(guild,period,active);`); this.regionReady=true; },
 regionLoad(id){ this.initRegion(); const cfg=regionCfg(id), row=this.statement('SELECT data FROM region_state WHERE id=?').get(id);
  const r={ ...G.initial(cfg), lastStep:0, stewards:{}, stewardPeriod:-1, ...(row?JSON.parse(row.data):{}) };
  for(const n of cfg.nodes) if(!r.nodes[n.id]) r.nodes[n.id]={ state:'online', threat:0, own:0, recovery:1 };   // 데이터에 거점이 늘어도 옛 저장이 읽힌다
  return { cfg, r }; },
 regionSave(id,r,now){ this.statement('INSERT INTO region_state(id,data,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated').run(id,JSON.stringify(r),now); },
 /* 전술 상태와 맞춘다: 남산이 함락·탈환 대기 중이면 «점령», 점령으로 남았는데 판이 다시 평시면 «복구» (옛 저장 대비) */
 regionSync(cfg,r){ for(const n of cfg.nodes){ if(!n.node) continue; const t=this.nodeLoad(n.node).state, s=r.nodes[n.id];
  if(!CALM.includes(t)&&t!=='recovering'&&s.state!=='occupied') G.setState(cfg,r,n.id,'occupied');
  else if(CALM.includes(t)&&s.state==='occupied') G.setState(cfg,r,n.id,'recovering'); } },
 /* 밀린 30분 스텝을 돌린다 (한 번에 최대 catch_up_steps — 서버가 오래 꺼져 있었어도 한 번에 수천 걸음 돌지 않게) */
 regionAdvance(cfg,r,now){ const ms=cfg.rules.step_minutes*60e3; if(!r.lastStep) r.lastStep=Math.floor(now/ms)*ms;
  const steps=Math.max(0,Math.floor((now-r.lastStep)/ms)); this.regionSync(cfg,r);
  for(let i=0;i<Math.min(steps,cfg.rules.catch_up_steps);i++) G.step(cfg,r); r.lastStep+=steps*ms; return steps; },
 /* 다거점 관리권: 지난 주기의 거점별 길드 점수(node-store 와 같은 셈) → 관리 용량·허브 제한 안에서 배정. 주기마다 한 번 */
 regionStewards(id,r,cfg,period){ if(r.stewardPeriod===period) return r.stewards;
  const cand=[];
  for(const n of cfg.nodes){ if(!n.node) continue; const { guilds, active, gscores }=this.nodePeriodScores(n.node,period-1);
   gscores.forEach((sc,i)=>{ if(active[i]&&sc>0) cand.push({ node:n.id, guild:guilds[i].id, name:guilds[i].name, score:sc, rank:i }); }); }
  const { stewards }=G.assignStewards(cand,cfg.nodes), names=new Map(cand.map(c=>[c.guild,c.name]));
  r.stewards=Object.fromEntries(Object.entries(stewards).map(([node,guild])=>[node,{ guild, name:names.get(guild) }])); r.stewardPeriod=period; return r.stewards; },
 /* node-store 가 부른다: 이 전술 거점이 속한 지역의 역할별 서비스 → 판 효과 (문서 202 §2.5). 지역 밖 거점이면 null */
 regionEffectsOf(nodeId,now){ const m=REGION_OF_NODE.get(nodeId); if(!m) return null;
  const { cfg, r }=this.regionLoad(m.region); this.regionAdvance(cfg,r,now); this.regionSave(m.region,r,now);
  const sv=G.serviceByRole(cfg,r), s={ logistics:sv.logistics??1, recon:sv.recon??1, manufacturing:sv.manufacturing??1 };
  const fx=R.regionEffects(s.logistics,s.recon,s.manufacturing);
  /* UE 실행 옵션 (?HWRegion=물류,정찰,제작) — 온라인이면 UE 가 서버에서 직접 받는다 */
  return { region:m.region, node:m.id, services:s, effects:fx, ueOption:'HWRegion='+[s.logistics,s.recon,s.manufacturing].map(v=>+v.toFixed(3)).join(',') }; },
 /* node-store 가 부른다: 이 전술 거점의 이번 주기 관리 길드 (지역에 속하지 않으면 undefined) */
 regionStewardOf(nodeId,now){ const m=REGION_OF_NODE.get(nodeId); if(!m) return undefined;
  const { cfg, r }=this.regionLoad(m.region), st=this.regionStewards(m.region,r,cfg,periodOf(now)); this.regionSave(m.region,r,now); return st[m.id]||null; },
 /* 판 결과 → 망: 함락 = 점령, 탈환 = 복구(75% 에서), 방어 성공 = 위협 −15 (node.defense.completed …) */
 regionNodeEvent(nodeId,outcome,now){ const m=REGION_OF_NODE.get(nodeId); if(!m) return;
  const { cfg, r }=this.regionLoad(m.region); this.regionAdvance(cfg,r,now);
  if(outcome==='fallen') G.setState(cfg,r,m.id,'occupied');
  else if(outcome==='retaken') G.setState(cfg,r,m.id,'recovering');
  else if(outcome==='held') G.addThreat(r,m.id,-cfg.rules.held_threat_drop);
  this.regionSave(m.region,r,now); },
 /* 명령 보너스: 이 사람 길드의 명령이 이 전술 거점(지역의 그 거점)에 판 보고 3분 전부터 걸려 있었나 */
 regionOrderBonus(player,nodeId,now){ const m=REGION_OF_NODE.get(nodeId), g=this.guild(player); if(!m||!g) return null; this.initRegion();
  return this.statement('SELECT id,type FROM guild_orders WHERE guild=? AND region=? AND node=? AND period=? AND active=1 AND at<=? ORDER BY priority DESC,at LIMIT 1')
   .get(g.id,m.region,m.id,periodOf(now),now-G.ORDER_LEAD)||null; },
 /* 전국 — 16권역을 밀린 만큼 돌리고 모은다 (권역끼리는 아직 서로 번지지 않는다, 문서 202 §8) */
 nationalView(now=Date.now()){ const views={}, list=[];
  for(const meta of KOREA.regions){ const { cfg, r }=this.regionLoad(meta.id); this.regionAdvance(cfg,r,now); this.regionSave(meta.id,r,now);
   const op=G.operationalRatio(cfg,r), hub=r.nodes[meta.hub];
   views[meta.id]={ pressure:r.pressure, operational:op, hubOccupied:!!hub&&hub.state==='occupied' };
   list.push({ id:meta.id, name:meta.name, identity:meta.identity, at:meta.at, hubName:meta.hubName, pressure:+r.pressure.toFixed(1), band:G.pressureBand(cfg,r.pressure), operational:op,
    troubled:cfg.nodes.filter(n=>r.nodes[n.id].state!=='online').length, nodes:cfg.nodes.length }); }
  const st=G.nationalStatus(KOREA,regionCfg('seoul'),views);
  return { regions:list, corridors:st.corridors, phase:st.phase, crisis:st.crisis, collapsed:st.collapsed }; },
 regionOrders(guild,region,now){ return this.statement('SELECT id,node,type,priority,squads,resource,issuer,at FROM guild_orders WHERE guild=? AND region=? AND period=? AND active=1 ORDER BY priority DESC,at')
  .all(guild,region,periodOf(now)).map(o=>({ ...o, name:G.ORDER_NAME[o.type], issuerName:(this.statement("SELECT json_extract(data,'$.name') AS name FROM profiles WHERE id=?").get(o.issuer)||{}).name||'' })); },
 regionView(id,now=Date.now(),viewer=null){ const { cfg, r }=this.regionLoad(id); this.regionAdvance(cfg,r,now);
  const stewards=this.regionStewards(id,r,cfg,periodOf(now)); this.regionSave(id,r,now);
  const ms=cfg.rules.step_minutes*60e3, me=viewer?this.guildRoleOf(viewer):null, gStewards=Object.fromEntries(Object.entries(stewards).map(([k,v])=>[k,v.guild]));
  return { id, name:cfg.name, pressure:+r.pressure.toFixed(1), band:G.pressureBand(cfg,r.pressure), operational:G.operationalRatio(cfg,r), services:G.serviceByRole(cfg,r),
   crisis:G.crisis(cfg,r), stepMinutes:cfg.rules.step_minutes, nextStepAt:r.lastStep+ms, period:periodOf(now),
   nodes:cfg.nodes.map(n=>{ const s=r.nodes[n.id]; return { id:n.id, node:n.node||null, name:n.name, role:n.role, tier:n.tier, at:n.at, state:s.state, threat:Math.round(s.threat),
    service:+G.serviceRatio(s,cfg.rules).toFixed(2), effect:n.effects[s.state==='recovering'?'degraded':s.state]||'', steward:stewards[n.id]||null }; }),
   links:cfg.links.map(l=>[l.a,l.b]),
   ...(me?{ me:{ ...me, admin:G.adminUse(cfg.nodes,gStewards,me.guild), canOrder:G.ORDER_TYPES.filter(t=>G.canOrder(me.role,t)), orders:this.regionOrders(me.guild,id,now),
    /* 동맹: 서로의 명령과 관리 거점을 본다 (관리권·용량·공헌은 합치지 않는다 — server/alliance-store.cjs) */
    ...this.regionAllies(me.guild,id,now) } }:{}) }; },
 regionAllies(guild,region,now){ const a=this.allianceOf(guild); if(!a) return { alliance:null, allyOrders:[] };
  const others=a.guilds.filter(g=>g.id!==guild);
  return { alliance:{ id:a.id, name:a.name, guilds:a.guilds }, allyOrders:others.flatMap(g=>this.regionOrders(g.id,region,now).map(o=>({ ...o, guild:g.id, guildName:g.name }))) }; },
 /* 전략 명령 — 직책대로. 관리 길드가 아니어도 자기 길드원에게는 낼 수 있다 (명령은 길드 안 추천일 뿐, 거점을 바꾸지 않는다) */
 regionOrder(id,region,o,now=Date.now()){ if(!o||typeof o!=='object') throw Error('명령을 확인하세요.');
  const cfg=regionCfg(region); if(!cfg.byId.has(o.node)) throw Error('거점을 확인하세요.'); if(!G.ORDER_TYPES.includes(o.type)) throw Error('명령 종류를 확인하세요.');
  this.initRegion(); return this.transaction(()=>{ const me=this.guildRoleOf(id); if(!me) throw Error('길드에 들어가야 명령을 낼 수 있습니다.');
   if(!G.canOrder(me.role,o.type)) throw Error(G.ORDER_NAME[o.type]+' 명령은 이 직책이 낼 수 없습니다.');
   const n=this.statement('SELECT COUNT(*) c FROM guild_orders WHERE guild=? AND period=? AND active=1').get(me.guild,periodOf(now)).c;
   if(n>=G.ORDER_LIMIT) throw Error('걸린 명령이 '+G.ORDER_LIMIT+'개입니다. 하나를 내리고 다시 내세요.');
   const c=G.cleanOrder(o);
   this.statement('INSERT INTO guild_orders(guild,region,node,type,priority,squads,resource,issuer,at,period,active) VALUES(?,?,?,?,?,?,?,?,?,?,1)')
    .run(me.guild,region,o.node,o.type,c.priority,c.squads,c.resource,id,now,periodOf(now));
   this.audit(id,'regionOrder',o.node,{type:o.type,...c}); return this.regionView(region,now,id); }); },
 regionCancel(id,region,orderId,now=Date.now()){ regionCfg(region); this.initRegion(); return this.transaction(()=>{ const me=this.guildRoleOf(id); if(!me) throw Error('길드에 들어가야 합니다.');
  const o=this.statement('SELECT guild,issuer FROM guild_orders WHERE id=? AND active=1').get(orderId);
  if(!o||o.guild!==me.guild) throw Error('명령을 찾을 수 없습니다.'); if(!G.canCancel(me.role,o.issuer===id)) throw Error('낸 사람이나 길드장·부길드장만 내릴 수 있습니다.');
  this.statement('UPDATE guild_orders SET active=0 WHERE id=?').run(orderId); this.audit(id,'regionCancel',String(orderId),{}); return this.regionView(region,now,id); }); },
};
function install(Store){ Object.assign(Store.prototype,methods); }
module.exports={ install, regionCfg, REGION_OF_NODE, KOREA, periodOf };
