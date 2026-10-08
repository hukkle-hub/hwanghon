/* 지역 전략망 규칙 — 서버 쪽 (docs/design/202). 거점은 HP 가 아니라 «서비스» 다.
   GPT 패키지 Hwanghon_Korea_GuildWorld_v03 (simulate_seoul_network.py · GuildRules_v02 · GuildCommandRules_v03) 를 옮기되,
   우리 쪽에 이미 있는 것(길드 직책·권한, 거점 관리권·정책·보급, 남산 서비스)은 그대로 쓰고 겹치지 않게 했다.
   지역 데이터는 ue/HwanghonCombatUE/Content/Data/region_<id>.json — UE 와 서버가 같은 파일을 읽는다.
   순수 함수만 둔다. 저장·시간은 server/region-store.cjs. */
const fs=require('node:fs'),path=require('node:path');
const DATA=path.join(__dirname,'..','ue','HwanghonCombatUE','Content','Data');
const OP_STATES=['online','degraded','occupied','recovering'];

function loadRegion(id){ const cfg=JSON.parse(fs.readFileSync(path.join(DATA,'region_'+id+'.json'),'utf8'));
 cfg.byId=new Map(cfg.nodes.map(n=>[n.id,n])); cfg.byNode=new Map(cfg.nodes.filter(n=>n.node).map(n=>[n.node,n])); return cfg; }
const knownRegion=id=>typeof id==='string'&&/^[a-z0-9_]{1,32}$/.test(id)&&fs.existsSync(path.join(DATA,'region_'+id+'.json'));

/* 처음 상태: 모두 정상, 위협 0, 압력 0 */
function initial(cfg){ return { pressure:0, nodes:Object.fromEntries(cfg.nodes.map(n=>[n.id,{ state:'online', threat:0, own:0, recovery:1 }])) }; }

/* 거점 하나의 서비스 몫: 정상 1 · 저하 0.55 · 점령 0 · 복구 0.75 → 1 */
function serviceRatio(s,rules){ if(s.state==='online') return 1; if(s.state==='degraded') return rules.degraded_ratio;
 if(s.state==='recovering'){ const a=rules.recovering_ratio; return a+(1-a)*Math.max(0,Math.min(1,s.recovery)); } return 0; }

/* 상태를 바꾼다 (판 결과가 부른다). 점령 = 복구 0, 복구 = 최소 0.25 에서, 정상 = 1 */
function setState(cfg,r,id,state){ const s=r.nodes[id]; if(!s||!OP_STATES.includes(state)) return false; s.state=state;
 if(state==='occupied') s.recovery=0; else if(state==='recovering') s.recovery=Math.max(s.recovery,cfg.rules.recover_start); else if(state==='online') s.recovery=1; return true; }
/* 밖에서 들어온 위협 (침공 예보·작전 실패…): 퍼뜨릴 수 있는 «자기 위협» 이 된다. 음수(방어 성공)는 둘 다 줄인다 */
function addThreat(r,id,delta){ const s=r.nodes[id]; if(!s) return false; s.threat=Math.max(0,Math.min(100,s.threat+delta));
 s.own=Math.max(0,Math.min(s.threat,(s.own||0)+delta)); return true; }

/* 한 걸음 (30분 논리 스텝 — 매 프레임 돌리지 않는다).
   1) 전파: 점령(=100) 이거나 «자기 위협»(밖에서 들어온 위협 — 침공 예보 같은 addThreat) 이 55 이상인 거점이 이웃에
      (위협−50)×전달률 을 넘긴다. 한 걸음에 한 거점이 받는 양은 12 까지.
      «받은 위협은 다시 퍼뜨리지 않는다» 는 우리가 더한 것이다: 패키지대로(위협 55 이상이면 누구나 퍼뜨림)면 저하된 거점끼리
      위협을 주고받아 98 에 묶이고, 남산을 되찾아도 서울 8곳이 영영 저하로 남았다 (패키지 시뮬은 4걸음만 돌려 못 봤다).
      두 다리 건너 번지는 것은 이웃이 «점령» 될 때다 — 패키지 서사(서울역까지 함락 → 용산·한강)와 같다. 문서 202 §4.
   2) 정상 거점이 위협 75 이상이면 저하. 망은 거점을 «점령» 시키지 못한다 — 점령은 판(전술)에서만 난다.
   3) 복구: 회복 +0.2, 위협 −8, 다 차고 위협 55 미만이면 정상.
   4) 정상·저하는 위협 −2. 저하는 위협 55 미만이면 다시 정상 (패키지 시뮬엔 저하에서 돌아오는 길이 없었다 — 문서 202 §4).
   5) 압력: 점령된 무게 몫 × 12 (걸음당 10 까지) 만큼 오르고, 점령이 없으면 −3. */
function step(cfg,r){ const R=cfg.rules, pending=Object.fromEntries(cfg.nodes.map(n=>[n.id,0])), events=[];
 for(const l of cfg.links) for(const [src,tgt] of [[l.a,l.b],[l.b,l.a]]){ const s=r.nodes[src];
  const q=s.state==='occupied'?100:(s.own||0); if(q>=R.spread_from) pending[tgt]+=(q-R.spread_base)*l.transfer; }
 for(const n of cfg.nodes){ const s=r.nodes[n.id]; if(s.state==='occupied') continue; const add=Math.min(R.max_threat_transfer,pending[n.id]);
  s.threat=Math.min(100,s.threat+add); if(s.state==='online'&&s.threat>=R.degrade_at){ s.state='degraded'; events.push({node:n.id,to:'degraded'}); } }
 for(const n of cfg.nodes){ const s=r.nodes[n.id];
  if(s.state==='recovering'){ s.recovery=Math.min(1,s.recovery+R.recover_per_step); s.threat=Math.max(0,s.threat-R.recover_threat_drop);
   if(s.recovery>=1&&s.threat<R.online_below){ s.state='online'; events.push({node:n.id,to:'online'}); } }
  else if(s.state==='online'||s.state==='degraded'){ s.threat=Math.max(0,s.threat-R.threat_decay);
   if(s.state==='degraded'&&s.threat<R.online_below){ s.state='online'; events.push({node:n.id,to:'online'}); } } }
 for(const n of cfg.nodes){ const s=r.nodes[n.id]; s.own=Math.min(s.own||0,s.threat); }   // 자기 위협은 전체 위협을 넘지 않는다 (같이 빠진다)
 const total=cfg.nodes.reduce((a,n)=>a+n.weight,0), occ=cfg.nodes.reduce((a,n)=>a+(r.nodes[n.id].state==='occupied'?n.weight:0),0);
 r.pressure=Math.max(0,Math.min(100,r.pressure+(occ>0?Math.min(R.pressure_occupied_max,occ/total*R.pressure_occupied_scale):-R.pressure_relief)));
 return events; }

/* 역할별 지역 서비스 (무게 가중) · 전체 운영률 */
function serviceByRole(cfg,r){ const out={}; for(const n of cfg.nodes){ const o=out[n.role]||(out[n.role]={w:0,s:0}); o.w+=n.weight; o.s+=n.weight*serviceRatio(r.nodes[n.id],cfg.rules); }
 return Object.fromEntries(Object.entries(out).map(([k,o])=>[k,+(o.s/o.w).toFixed(3)])); }
function operationalRatio(cfg,r){ let w=0,s=0; for(const n of cfg.nodes){ w+=n.weight; s+=n.weight*serviceRatio(r.nodes[n.id],cfg.rules); } return +(s/w).toFixed(3); }
function pressureBand(cfg,p){ let band=cfg.pressure_bands[0]; for(const b of cfg.pressure_bands) if(p>=b[0]) band=b; return { id:band[1], name:band[2] }; }
/* 지역 위기: 압력 75 이상 + 저하·점령 거점 2곳 이상 → 여러 거점에서 동시 작전 */
function crisis(cfg,r){ const c=cfg.crisis; if(!c) return null; const troubled=cfg.nodes.filter(n=>['degraded','occupied'].includes(r.nodes[n.id].state)).map(n=>n.id);
 return { id:c.id, name:c.name, active:r.pressure>=c.pressure_min&&troubled.length>=c.min_troubled, troubled, fronts:c.fronts }; }

/* ── 전국 (docs/design/202 §8, korea.json) — 권역마다 망은 따로 돌고, 전국은 «지금 상태» 를 모아 본다 ──
   회랑: 지나는 권역 중 하나라도 붕괴(압력 95+)이거나 허브가 점령이면 «단절», 운영 75% 미만이거나 침공(55+) 이상이면 «긴장», 아니면 «열림».
   전국 작전 단계 (패키지 NATIONAL_CAMPAIGN_LOOP 의 앞 네 단계, 시간 없이 상태로만):
     평시 → 동원(위기 권역 1 또는 침공 권역 2) → 진행(위기 권역 2) → 결정적(진행 중 붕괴 권역 1). 해결·쿨다운은 시간 축이라 나중.
   views: { id: { pressure, operational, hubOccupied } } */
const BAND_RANK={stable:0,tension:1,invasion:2,crisis:3,collapsed:4};
function nationalStatus(korea,bandsCfg,views){ const C=korea.campaign, band=id=>pressureBand(bandsCfg,views[id].pressure).id;
 const atLeast=(id,b)=>BAND_RANK[band(id)]>=BAND_RANK[b], ids=korea.regions.map(r=>r.id).filter(id=>views[id]);
 const crisis=ids.filter(id=>atLeast(id,'crisis')), collapsed=ids.filter(id=>atLeast(id,'collapsed')), invasion=ids.filter(id=>atLeast(id,'invasion'));
 const corridors=korea.corridors.map(c=>{ const rs=c.regions.filter(id=>views[id]);
  const cut=rs.some(id=>atLeast(id,'collapsed')||views[id].hubOccupied), strained=rs.some(id=>views[id].operational<0.75||atLeast(id,'invasion'));
  return { id:c.id, purpose:c.purpose, regions:c.regions, status:cut?'cut':strained?'strained':'open' }; });
 const active=crisis.length>=C.active_crisis_regions;
 const phase=active&&collapsed.length>=C.critical_collapsed_regions?'critical':active?'active':(crisis.length>=C.mobilize_crisis_regions||invasion.length>=C.mobilize_invasion_regions)?'mobilization':'dormant';
 return { phase, crisis, collapsed, invasion, corridors }; }

/* ── 관리 용량 (GuildRules_v02): 길드마다 80, 거점 단계별 비용 25·40·60, 지역 허브(3단계)는 길드당 하나 ──
   한 길드가 서울의 핵심 거점을 다 가져가지 못하게. 점수가 높은 (거점, 길드) 짝부터 채우고, 용량·허브 제한에 걸리면 그 길드는 건너뛴다.
   candidates: [{node, guild, score}] · nodes: [{id, tier}] · capacity: guild → 용량 (없으면 기본) */
const ADMIN={ capacity:80, maxCapacity:160, tierCost:{1:25,2:40,3:60}, hubLimit:1 };
function assignStewards(candidates,nodes,capacity={}){ const tierOf=new Map(nodes.map(n=>[n.id,n.tier])), used={}, hubs={}, out={};
 const order=[...candidates].filter(c=>c.score>0&&tierOf.has(c.node)).sort((a,b)=>b.score-a.score||(a.rank??0)-(b.rank??0)||(a.node<b.node?-1:a.node>b.node?1:0));
 for(const c of order){ if(out[c.node]) continue; const t=tierOf.get(c.node), cost=ADMIN.tierCost[t]||ADMIN.tierCost[1], cap=capacity[c.guild]??ADMIN.capacity;
  if((used[c.guild]||0)+cost>cap) continue; if(t>=3&&(hubs[c.guild]||0)>=ADMIN.hubLimit) continue;
  out[c.node]=c.guild; used[c.guild]=(used[c.guild]||0)+cost; if(t>=3) hubs[c.guild]=(hubs[c.guild]||0)+1; }
 return { stewards:out, used }; }
function adminUse(nodes,stewards,guild){ const managed=nodes.filter(n=>stewards[n.id]===guild);
 return { used:managed.reduce((a,n)=>a+(ADMIN.tierCost[n.tier]||0),0), capacity:ADMIN.capacity, managed:managed.map(n=>n.id) }; }

/* ── 길드 전략 명령 (GuildCommandRules_v03). 명령은 사람을 끌고 가지 않는다 — 추천 전선·집결 표시일 뿐 ──
   직책: leader(길드장)·vice(부길드장) 전부 · combat(전투대장) 방어·증원·정찰·탈환 준비 · supply(보급대장) 보급·수리·대피 · craft(제작대장) 수리 */
const ORDER_TYPES=['defend','reinforce','supply','repair','recon','evacuate','prepare_retake'];
const ORDER_NAME={defend:'방어',reinforce:'증원',supply:'보급',repair:'수리',recon:'정찰',evacuate:'대피',prepare_retake:'탈환 준비'};
const ORDER_ROLES={ leader:ORDER_TYPES, vice:ORDER_TYPES, combat:['defend','reinforce','recon','prepare_retake'], supply:['supply','repair','evacuate'], craft:['repair'], member:[] };
const canOrder=(role,type)=>(ORDER_ROLES[role]||[]).includes(type);
/* 취소: 낸 사람, 또는 길드장·부길드장 (패키지는 대장 누구나였다 — 제작대장이 전투대장의 명령을 지우게 두지 않았다) */
const canCancel=(role,isIssuer)=>isIssuer||role==='leader'||role==='vice';
const ORDER_LIMIT=8;   // 길드당 동시에 걸린 명령
/* 명령 보너스 (디렉터 결정, 문서 202 §4): 자기 길드 명령이 걸린 거점에서 판을 하면 그 판 공헌 +10%. 명령 종류는 따지지 않고, 겹쳐도 한 번.
   판 직전에 명령을 걸고 보고만 하는 것을 막으려고, 판 결과 보고보다 3분 넘게 먼저 걸린 명령만 센다 (한 판은 4분 이상) */
const ORDER_BONUS=0.10, ORDER_LEAD=3*60e3;
function cleanOrder(o){ return { priority:Math.max(1,Math.min(5,Math.round(+o.priority||3))), squads:Math.max(0,Math.min(8,Math.round(+o.squads||0))),
 resource:Math.max(0,Math.min(100,Math.round(+o.resource||0))) }; }

module.exports={ BAND_RANK, nationalStatus, OP_STATES, ADMIN, ORDER_TYPES, ORDER_NAME, ORDER_ROLES, ORDER_LIMIT, ORDER_BONUS, ORDER_LEAD, loadRegion, knownRegion, initial, serviceRatio, setState, addThreat, step,
 serviceByRole, operationalRatio, pressureBand, crisis, assignStewards, adminUse, canOrder, canCancel, cleanOrder };
