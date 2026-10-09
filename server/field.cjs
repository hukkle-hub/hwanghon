/* 필드(존) 동기화 — 2D 맵 MMORPG (docs/design/185 §6.4)
   파티 레이드(raid.cjs)가 «방 안 4명» 이라면 필드는 «한 지역에 있는 모두» 다.
   클라이언트는 자기 위치·방향·동작을 초당 10번 보내고, 서버는 속도·걷는 띠를 검사한 뒤
   관심 반경 안의 사람만 초당 10번 돌려준다. 이름·영웅·장비 같은 고정 정보는 처음 보일 때와 바뀔 때만 보낸다.
   걷는 띠·출발점은 맵 굽기 결과(maps/2d/<zone>/map.json)를 그대로 읽는다 — 한 곳에서만 정한다. */
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const CY=require('./boss-cycle.cjs'),T=require('./boss-table.cjs'),C=require('./content.cjs'),COMBAT=require('./field-boss-combat.cjs'),DOM=require('./field-dominator.cjs'),RS=require('./rpg-skills.cjs'),SAFE=require('../js/mmo/safe-zones.js');
const {Ecology}=require('./field-ecology.cjs'),{createCollide}=require('../js/mmo/field-collide.js'),{linkGates}=require('../js/mmo/zone-links.js'),MOB=require('./field-mob-combat.cjs'),RULES=require('./rpg-rules.cjs');
const MOB_CATALOG=require('../docs/design/ref/monster-catalog-v10/MonsterRoster_v10.json').Monsters;
const crypto=require('node:crypto'),{planRoute}=require('./field-ecology-route.cjs');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const PATROL_FILES=['server/field-ecology.cjs','server/field-ecology-route.cjs','js/mmo/field-collide.js','js/mmo/safe-zones.js'];
let PATROLS=null;try{const p=require('./field-ecology-patrols.json');
 if(p.schema===1&&PATROL_FILES.every(f=>p.rules[f]===digest(fs.readFileSync(path.join(ROOT,f)))))PATROLS=p;}catch{}
const ANIMS=['idle','run','walk','attack1','dodgeB','skill1','skill2','skill3','skill4'];   /* 스킬 1~4 — 다른 사람에게도 동작이 보이게 */
const MAX_SPEED=7.5;       /* m/s — 클라 달리기 4.8 + 회피 돌진·지연 여유 */
const AOI=28;              /* m — 휴대폰 화면 대각선의 약 2배 */
const HIT_GAP=350;         /* ms — 한 사람이 보스를 때릴 수 있는 최소 간격 (클라 공격 동작 ≈0.6초) */
const POTION_HEAL=.35, POTION_GAP=1000;   /* 회복약 «HP 35% 회복» (js/items.js c_potion) */
const DODGE_TIME=520, DODGE_GAP=780, RESPAWN_TIME=5000, RESPAWN_GUARD=2000;
const LOOT_REACH=3.5, LOOT_PRIORITY=10e3, LOOT_LIFE=180e3, BOSS_IMPACT_LIFE=650;   /* 줍는 거리 · 기여도 1위 먼저(10초) · 바닥에 남는 시간 · 공동 접촉 사건 수명 */
const reachOf=b=>2.5+Math.min(4,(b.h||3)*0.4);               /* 보스 몸 반지름 + 무기 길이 (대략) */
/* 공개 칭호는 «그냥 참가»가 아니라 해당 보스 기여도 1위 처치 기록이다. 희귀한 증표가 되도록 단계가 듬성듬성 열린다. */
const BOSS_TITLES={ clave:[[50,'강남의 철문'],[10,'셔터를 멈춘 자'],[1,'클레이브 토벌자']] };
function prestigeTitle(rows=[]){
 for(const r of rows){ const tiers=BOSS_TITLES[r.boss],n=Number(r.n)||0;if(!tiers)continue;
  const i=tiers.findIndex(t=>n>=t[0]);if(i>=0)return {boss:r.boss,text:tiers[i][1],tier:tiers.length-i}; }
 return null; }
/* 전국 길 문 도착 자리 — world3d.html 과 같은 공식: 띠 끝(s0+3 / s1−3) · t → 막이에서 6 번 밀기(2.4) → 길 안쪽으로 5 m(0.5).
   map.json(생태 해시·구운 높이)은 그대로 두고 문만 계산한다 (docs/gpt/2026-10-09-zone-links-server.md) */
function linkArrival(z,gate){ const g=linkGates(z.id).find(x=>x.id===gate),w=z.walk;if(!g||!w)return null;
 const a=z.ang||0,col=z.collideFn||(z.collideFn=createCollide(z.map).collide),s=g.at.end==='s1'?w.s1-3:w.s0+3,t=g.at.t??(w.t0+w.t1)/2;
 const q={x:s*Math.cos(a)-t*Math.sin(a),z:-s*Math.sin(a)-t*Math.cos(a)};for(let i=0;i<6;i++)col(q,2.4);
 const qs=q.x*Math.cos(a)-q.z*Math.sin(a),sg=qs<(w.s0+w.s1)/2?1:-1,q2={x:q.x+Math.cos(a)*sg*5,z:q.z-Math.sin(a)*sg*5};col(q2,0.5);
 return {x:+q2.x.toFixed(2),z:+q2.z.toFixed(2)}; }
function loadZone(id){ try{ const bytes=fs.readFileSync(path.join(ROOT,'maps','2d',id,'map.json')),m=JSON.parse(bytes); return { id, map:{...m,id}, mapHash:digest(bytes), walk:m.walk, ang:m.road.ang, spawn:m.spawn, gates:(m.gates||[]).filter(g=>g&&typeof g.id==='string'&&Number.isFinite(g.x)&&Number.isFinite(g.z)),
  bosses:(m.bosses||[]).filter(b=>b&&typeof b.id==='string'&&Number.isFinite(b.x)&&Number.isFinite(b.z)),
  areas:(m.areas||[]).filter(a=>a&&(a.kind==='rest'||a.kind==='siege')&&(Array.isArray(a.circle)||Array.isArray(a.poly))) }; }catch{ return null; } }   /* 안전 지대(마을·쉼터)·거점 판정 — js/mmo/safe-zones.js */
const ZONE_IDS=()=>{ try{ return fs.readdirSync(path.join(ROOT,'maps','2d')).filter(d=>/^[a-z0-9_]{1,24}$/.test(d)&&fs.existsSync(path.join(ROOT,'maps','2d',d,'map.json'))); }catch{ return []; } };
const itemOf=id=>C.equipment.find(i=>i.id===id);
const num=(v,lo,hi)=>Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):null;
class Field{
 /* store: 보스 상태·처치 기록 저장 (없으면 메모리만) · emit: 서버 전체 알림 (출현·처치·전설 획득) */
 constructor({ store=null, emit=()=>{}, rng=Math.random, timeScale=Number(process.env.BOSS_TIME_SCALE)||1,
  clock=Date.now, mobStats=MOB.statsFor, mobRewards=null, onMobReward=()=>{} }={}){
  this.zones=new Map(); this.players=new Map(); this.life=new Map(); this.bosses=new Map(); this.loot=new Map(); this.titleCache=new Map(); this.lootSerial=0;
  this.hubs=new Map();   /* 거점 주인 (zone → {kind:'guild',name}) — 없으면 보스가 차지 (문서 197·198). 점령전은 GPT 몫: setHub 로 바꾼다 */
  this.store=store; this.emit=emit; this.rng=rng; this.timeScale=timeScale;
  this.clock=clock;this.mobStats=mobStats;this.mobRewards=mobRewards;this.onMobReward=onMobReward;
  this.ecologies=new Map();this.mobStates=new Map();this.ecologyContexts=new Map();this.siegeContexts=new Map();this.pendingMobRewards=new Map(); }
 zone(id){ if(typeof id!=='string'||!/^[a-z0-9_]{1,24}$/.test(id)) return null; if(!this.zones.has(id)){ const z=loadZone(id); if(!z) return null; this.zones.set(id,z); } return this.zones.get(id); }
 hubOwner(zoneId){ const z=this.zone(zoneId); return z&&SAFE.isHub(z.areas)?(this.hubs.get(z.id)||SAFE.BOSS_OWNER):null; }
 setHub(zoneId, owner){ if(owner&&owner.kind==='guild')this.hubs.set(zoneId,{kind:'guild',name:String(owner.name||'').slice(0,24)});else this.hubs.delete(zoneId); return this.hubOwner(zoneId); }
 /* 지금 서 있는 곳이 안전 지대(마을·쉼터)인가 — 상점·판매·창고는 여기서만 */
 safeAt(id){ const p=this.players.get(id); if(!p) return null; const z=this.zones.get(p.zone); return z?SAFE.safeArea(z.areas,p.x,p.z,this.hubOwner(p.zone)):null; }
 /* 회복약: 최대 HP 의 35% (C.consumables c_potion) · 1초에 한 번 · 쓰러졌거나 가득 차면 안 쓴다(아깝게 버리지 않게) */
 canPotion(id, now=Date.now()){ const p=this.players.get(id); if(!p) throw Error('먼저 지역에 들어가세요.'); if(p.dead) throw Error('쓰러진 상태입니다.');
  if(now<(p.potionReady||0)) throw Error('회복약은 잠시 뒤에 다시 쓸 수 있습니다.'); if(p.hp>=p.maxHp) throw Error('HP 가 가득 찼습니다.'); return p; }
 potion(id, now=Date.now()){ const p=this.canPotion(id,now), heal=Math.round(p.maxHp*POTION_HEAL); p.hp=Math.min(p.maxHp,p.hp+heal); p.potionReady=now+POTION_GAP; return { heal, self:this.selfView(p) }; }
 /* 길 좌표 (s, t) — js/mmo/env-gangnam.js 의 DIR·SIDE 와 같다 */
 clamp(z,p){ const c=Math.cos(z.ang),s=Math.sin(z.ang); let a=p.x*c-p.z*s, t=-p.x*s-p.z*c; a=Math.min(z.walk.s1,Math.max(z.walk.s0,a)); t=Math.min(z.walk.t1,Math.max(z.walk.t0,t)); p.x=a*c-t*s; p.z=-a*s-t*c; }
 title(id){ if(this.titleCache.has(id))return this.titleCache.get(id);let title=null;try{title=prestigeTitle(this.store?.bossTitles(id)||[]);}catch{}if(this.titleCache.size>=2048)this.titleCache.delete(this.titleCache.keys().next().value);this.titleCache.set(id,title);return title; }
 info(profile, look){ const eq={...(profile.equipment||{})},enh={};
  /* 가방 전체/내구도/재산은 공개하지 않는다. 지금 몸에 걸친 슬롯의 강화 단계만 보낸다. */
  for(const [slot,item] of Object.entries(eq)){ const n=profile.gear?.[item]?.enh;if(Number.isInteger(n))enh[slot]=Math.max(0,Math.min(10,n)); }
  const title=this.title(profile.id);
  return { name:profile.name, character:profile.character||'ain', eq, enh, look, ...(title?{title}:{}) }; }
 /* gate: 다른 지역의 문으로 넘어왔을 때 도착할 문 id (map.json gates) — 없거나 모르는 id 면 지역 출발점 */
 join(id, profile, zoneId, look, gate){ const z=this.zone(zoneId); if(!z) throw Error('지역을 찾을 수 없습니다.'); const now=this.clock();this.ecology(z.id,now);this.leave(id,now);const prior=this.life.get(id);this.life.delete(id);
  const at=(typeof gate==='string'&&(z.gates.find(g=>g.id===gate)||linkArrival(z,gate)))||z.spawn;   /* 전국 길 문(zone-links)은 map.json 에 없다 — 3D 클라와 같은 공식으로 띠 끝 자리 (문서 220 §16) */
  const maxHp=Math.max(1,Math.round(profile.stats?.hp||20000));
  const keep=prior&&prior.expires>now,hp=keep?(prior.dead?0:Math.max(1,Math.round(maxHp*prior.hp/Math.max(1,prior.maxHp)))):maxHp;
  const p={ id, zone:z.id, x:at.x+(Math.random()-.5)*2, z:at.z+(Math.random()-.5)*2, yaw:0, anim:'idle', at:now,
   info:this.info(profile, Number.isInteger(look)&&look>=0&&look<=3?look:0), ver:1, known:new Map(),
   hp,maxHp,defense:Math.max(0,profile.stats?.defense||0),dead:!!(keep&&prior.dead),respawnAt:keep?prior.respawnAt:0,invulnUntil:keep?prior.invulnUntil:now+RESPAWN_GUARD,
   dodgeUntil:0,dodgeReady:0,hurtSeq:0,hurt:null };
  this.clamp(z,p); this.players.set(id,p); return p; }
 leave(id,now=Date.now()){ const p=this.players.get(id);if(p)this.life.set(id,{hp:p.hp,maxHp:p.maxHp,dead:p.dead,respawnAt:p.respawnAt,invulnUntil:p.invulnUntil,expires:now+30000});this.players.delete(id); }
 /* 외형이 바뀌었을 때(장비·외형 프리셋) — 보이는 사람들에게 다시 보낸다 */
 relook(id, profile, look){ const p=this.players.get(id); if(!p) return; const l=Number.isInteger(look)&&look>=0&&look<=3?look:p.info.look,old=p.maxHp;
  p.maxHp=Math.max(1,Math.round(profile.stats?.hp||p.maxHp));p.hp=p.dead?0:Math.max(1,Math.round(p.maxHp*p.hp/Math.max(1,old)));p.defense=Math.max(0,profile.stats?.defense||0);
  const next=this.info(profile,l),changed=JSON.stringify(next)!==JSON.stringify(p.info);p.info=next;if(changed)p.ver++;return changed; }
 move(id, msg, now=Date.now()){ const p=this.players.get(id); if(!p) throw Error('먼저 지역에 들어가세요.'); if(p.dead)return p; const z=this.zones.get(p.zone);
  const x=num(msg.x,-1e4,1e4), zz=num(msg.z,-1e4,1e4); if(x===null||zz===null) return p;
  /* 속도 검사: 지난 갱신 뒤 시간 × 최대 속도 + 0.6 m 를 넘으면 그 거리까지만 */
  const dt=Math.min(1,Math.max(0.01,(now-p.at)/1000)), dx=x-p.x, dz=zz-p.z, d=Math.hypot(dx,dz), lim=MAX_SPEED*dt+0.6;
  if(d>lim){ p.x+=dx/d*lim; p.z+=dz/d*lim; } else { p.x=x; p.z=zz; }
  this.clamp(z,p); p.at=now;
  const yaw=num(msg.yaw,-10,10); if(yaw!==null) p.yaw=yaw; const next=ANIMS.includes(msg.anim)?msg.anim:'idle';
  if(next==='dodgeB'&&p.anim!=='dodgeB'&&now>=p.dodgeReady){ p.dodgeUntil=now+DODGE_TIME; p.dodgeReady=now+DODGE_GAP; }
  p.anim=next; return p; }
 /* 받는 사람 r 에게: 관심 반경 안 다른 사람들의 [id, x, z, yaw, 동작 번호] + 처음 보거나 바뀐 사람의 고정 정보 */
 view(r,commit=true){ const out=[], infos={},now=this.clock();
  for(const p of this.players.values()){ if(p===r||p.zone!==r.zone) continue; if((p.x-r.x)**2+(p.z-r.z)**2>AOI*AOI) continue;
   out.push([p.id, +p.x.toFixed(2), +p.z.toFixed(2), +p.yaw.toFixed(2), ANIMS.indexOf(p.anim)]);
   if(r.known.get(p.id)!==p.ver) infos[p.id]=p.info; }
  if(commit)this.commitView(r,out);
  const bv=this.bosses.size?this.bossView(r):null;
  return { type:'field', you:[+r.x.toFixed(2), +r.z.toFixed(2)], self:this.selfView(r), hurt:r.hurt,
   players:out, infos, mobs:this.mobView(r,now), mobNow:now, ...(bv&&(bv.bosses.length||bv.loot.length)?bv:{}) }; }
 /* Population is lazy per visited region (boss startup loads every map). No
    client-provided night/invasion/owner is accepted. Node event wiring can call
    setEcologyContext; no undocumented day/night cycle is invented here. */
 ecology(zoneId,now=this.clock()){
  if(this.ecologies.has(zoneId))return this.ecologies.get(zoneId);
  const z=this.zone(zoneId);if(!z)return null;
  const e=new Ecology({zone:z.map,catalog:MOB_CATALOG,now,rng:this.rng,
   collide:createCollide(z.map).collide,owner:this.hubOwner(zoneId)});
  this.ecologies.set(zoneId,e);this.preparePatrols(e);this.syncMobs(e,now);return e; }
 preparePatrols(e){
  const row=PATROLS?.zones[e.zone.id],z=this.zones.get(e.zone.id),kind=e.owner?.kind==='guild'?'guild':'boss';
  const hints=row?.hash===z.mapHash?row.owners[kind]:null;e.patrolCacheValid=!!hints;
  for(const g of e.groups)if(g.kind==='patrol'){
   g.routes.clear();for(let i=0;i<4;i++)g.routes.set(i,structuredClone(hints?.[g.area.id]?.[i]||null));
   for(const id of g.mobIds){const m=e.mobs.get(id);if(m)m.routePoint=0;}
  }
  /* Missing/stale bake: holds patrol, never performs multi-second A* inside a
     live tick. Rebuild with tools/monsters/build-field-patrols.mjs before deploy. */
 }
 setEcologyContext(zoneId,{night=false,invasion=false}={}){this.ecologyContexts.set(zoneId,{night:!!night,invasion:!!invasion});}
 /* Only a server-owned node event may supply actual NPC/facility objects.
    Ordinary field maps have none; no fabricated destructible buildings. */
 setSiegeContext(zoneId,context){if(context)this.siegeContexts.set(zoneId,context);else this.siegeContexts.delete(zoneId);}
 syncMobs(e,now){
  for(const m of e.mobs.values()){
   const old=this.mobStates.get(m.id);if(old?.generation===m.generation)continue;
   const stats=MOB.validateStats(this.mobStats(m.catalogId,m.group.area));
   this.mobStates.set(m.id,{id:m.id,zone:e.zone.id,catalogId:m.catalogId,generation:m.generation,
    hp:stats.hp,max:stats.hp,stats,last:new Map(),ai:MOB.reset(m,now),rewarded:false}); }
  for(const [id,s]of this.mobStates)if(s.zone===e.zone.id&&!e.mobs.has(id))this.mobStates.delete(id); }
 mobView(p,now=this.clock()){
  const e=this.ecologies.get(p.zone);if(!e)return [];
  return e.snapshot(p.x,p.z,now,AOI).map(m=>{const s=this.mobStates.get(m.id),action=s?.generation===m.generation?MOB.visualAction(e.mobs.get(m.id)||m,s.ai):null;
   /* Final document 210 / v2: exact seven Ecology.snapshot fields, followed by
      HP and optional action sequence. Keep alive boolean and HP in slot 8. */
   return [m.id,m.catalogId,m.x,m.z,m.alive,m.anim,m.generation,
    m.alive&&s?.generation===m.generation?Math.ceil(100*s.hp/s.max):0,
    s?.generation===m.generation?s.ai.seq:0,
    ...(action?[action]:[])];}); }
 tickEcologies(now){
  let retry=2;for(const [key,r]of this.pendingMobRewards){if(retry<=0)break;if(now<r.nextAt)continue;
   retry--;this.rewardMob(r.id,r.m,r.s,now);}
  const byZone=new Map();for(const p of this.players.values()){if(!byZone.has(p.zone))byZone.set(p.zone,[]);byZone.get(p.zone).push(p);}
  for(const [zoneId,e]of this.ecologies){if(now<e.lastTick)continue;
   const owner=this.hubOwner(zoneId);if(e.owner?.kind!==owner?.kind){e.owner=owner;this.preparePatrols(e);}
   e.tick(now,{...(this.ecologyContexts.get(zoneId)||{}),owner});this.syncMobs(e,now);
   let routes=2;const nav={legal:(a,q)=>e.legal(a,q),canTraverse:(a,p,q)=>e.canTraverse(a,p,q),
    route:(a,p,q)=>routes-->0?planRoute(p,q,r=>e.legal(a,r),(r,t)=>e.canTraverse(a,r,t),{step:1,budget:64}):null,
    safe:p=>!!SAFE.safeArea(e.zone.areas,p.x,p.z,e.owner)};
   /* Short-range chase search has its own bounded budget; patrol's approved
      8000/12000 search and map anchors are unchanged. Long blocked chase holds. */
   e.resonanceCache=e.resonanceCache||{};MOB.refreshResonance(e.mobs,this.mobStates,now,e.resonanceCache);
   const context={...(this.siegeContexts.get(zoneId)||{}),allies:[...e.mobs.values()]};
   for(const m of e.mobs.values()){const s=this.mobStates.get(m.id);
    for(const [pid,at]of s.last)if(now-at>60000)s.last.delete(pid);
    const hit=MOB.tick(m,s.ai,s.stats,byZone.get(zoneId)||[],now,nav,context);
    if(hit?.targetKind)this.siegeContexts.get(zoneId)?.strike?.(m,hit,now);
    else if(hit){const p=this.players.get(hit.target);if(p&&p.zone===zoneId)
      this.bossStrike(m,p,{...hit,damage:hit.damage/p.maxHp,knock:0},now);} }
  } }
 hitMob(id,msg,profile,now=this.clock(),opt={}){
  const p=this.players.get(id);if(!p)throw Error('먼저 지역에 들어가세요.');
  const e=this.ecologies.get(p.zone),m=e?.mobs.get(msg.mob),s=m&&this.mobStates.get(m.id);
  if(!m||!s)throw Error('몬스터를 찾을 수 없습니다.');
  if(!m.alive||p.dead||(msg.generation!==undefined&&msg.generation!==m.generation))return null;
  if(now<e.lastTick||this.safeAt(id)||!e.legal(m.group.area,[m.x,m.z])||
   Math.hypot(p.x-m.x,p.z-m.z)>3||!e.canTraverse(m.group.area,[m.x,m.z],[p.x,p.z]))return null;
  /* Per-player as well as per-target: changing IDs cannot bypass HIT_GAP. */
  if(!opt.skill&&(now-(s.last.get(id)??-Infinity)<HIT_GAP||now-(p.mobHitAt??-Infinity)<HIT_GAP))return null;
  s.last.set(id,now);if(!opt.skill)p.mobHitAt=now;
  const st=profile.stats||{},w=itemOf(profile.equipment?.main),crit=!!p.critNext||this.rng()<(st.critChance||0);p.critNext=false;
  const counter=MOB.tryCounter(m,s.ai,now);
  const dmg=Math.max(1,Math.round(((st.atk||1000)+(w?.stats?.atk||0)*.6)*(.9+this.rng()*.2)*(crit?(st.critDamage||1.5):1)*(opt.mult||1)*MOB.damageScale(m.catalogId,s.ai,now)));
  s.hp=Math.max(0,s.hp-dmg);if(!counter&&m.catalogId!=='G5_ARMORED'){MOB.stagger(s.ai,now);m.anim='hit';}m.engaged=true;s.ai.target=id;
  let reward=null;if(s.hp===0&&e.defeat(m.id,now)){reward=this.rewardMob(id,m,s,now);MOB.refreshResonance(e.mobs,this.mobStates,now,e.resonanceCache||{});}
  return {type:'mobHit',mob:m.id,catalogId:m.catalogId,generation:m.generation,dmg,crit,down:!m.alive,hp:Math.ceil(100*s.hp/s.max),reward,...(counter?{counter}:{})}; }
 rewardMob(id,m,s,now=this.clock()){
  if(s.rewarded)return null;
  /* Director's drop table / XP curve are pending. No fabricated economy. */
  if(!this.store||!this.mobRewards){s.rewarded=true;return {status:'pending_policy'};}
  const award=s.award||this.mobRewards(m.catalogId,m.group.area);if(!award){s.rewarded=true;return {status:'pending_policy'};}
  const {items=[],gold=0,xp=0}=award;
  if(!Number.isSafeInteger(gold)||gold<0||gold>1e6||!Number.isSafeInteger(xp)||xp<0||xp>1e6||!Array.isArray(items)||items.length>20||
   items.some(v=>!Array.isArray(v)||v.length!==2||!RULES.byId[v[0]]||RULES.byId[v[0]].stats||!Number.isSafeInteger(v[1])||v[1]<1||v[1]>999))throw Error('Invalid mob reward policy');
  s.award=structuredClone(award);const key=m.id+':'+s.generation;
  let r;try{r=this.store.mutate(id,'field:mobReward',p=>{
   if(!Number.isSafeInteger(p.gold+gold)||!Number.isSafeInteger(p.xp+xp))throw Error('Reward overflow');
   this.store.addItems(p,items);p.gold+=gold;p.xp+=xp;
   return {mob:m.id,generation:s.generation,items,gold,xp};});}
  catch{this.pendingMobRewards.set(key,{id,m,s,nextAt:now+1000});return {status:'pending_storage'};}
  s.rewarded=true;this.pendingMobRewards.delete(key);this.onMobReward(r.profile);return {status:'granted',items:items.map(([id,n])=>({id,n})),gold,xp}; }
 /* 소켓 전송이 실제 성공한 뒤에만 고정 정보를 «전달함»으로 기록한다. backpressure로 버리면 다음 틱에 다시 싣는다. */
 commitView(r,out){const seen=new Set(out.map(x=>x[0]));for(const id of seen){const p=this.players.get(id);if(p)r.known.set(id,p.ver);}for(const id of [...r.known.keys()])if(!seen.has(id))r.known.delete(id);}
 /* ---------- 필드 보스 (docs/design/188) — 공유 세계: 지역마다 주기마다 한 마리, 모두가 노린다 ---------- */
 initBosses(now=Date.now()){
  const saved=new Map((this.store?this.store.bossStates():[]).map(r=>[r.id,r]));
  for(const zid of ZONE_IDS()){ const z=this.zone(zid); if(!z) continue;
   for(const b of z.bosses){ if(this.bosses.has(b.id)) continue; const row=T.BOSSES[b.id]||T.DEFAULT, cycle=CY.norm(row.cycle,this.timeScale);
    const o={ id:b.id, zone:zid, name:b.name, title:b.title||'', place:b.place||'', x:b.x, z:b.z, r:b.r||18, h:b.h||3, max:row.hp, hp:row.hp, cycle, drops:row.drops, alive:false, nextAt:0, dmg:new Map(), names:new Map(), last:new Map(), ver:0, impactSeq:0, impacts:[] };
    const r=saved.get(b.id);
    /* 살아 있던 보스는 체력을 채워 다시 세운다(리니지도 재시작하면 처음부터). 기다리던 보스는 약속한 시각을 지킨다. */
    if(r&&r.state==='alive'){ o.alive=true; o.nextAt=0; }
    else if(r&&r.state==='wait'&&r.next_at>now-cycle.period) o.nextAt=r.next_at;
    else { o.nextAt=CY.nextSpawn(cycle, now, { rng:this.rng }); this.store?.bossSave(o.id,o.zone,'wait',o.nextAt,now); }
    COMBAT.setup(o,now); DOM.setup(o,now); this.bosses.set(o.id,o); } }   /* DOM: 2급 지배형 (문서 204) */
  return this.bosses; }
 /* 20 Hz 에서: 출현·클레이브 전투·사망 복귀·바닥 장비를 함께 갱신한다. */
 tickBosses(now=Date.now()){
  for(const o of this.bosses.values()) if(!o.alive&&o.nextAt&&now>=o.nextAt) this.spawnBoss(o, now);
  for(const o of this.bosses.values()){ COMBAT.tick(this,o,now); DOM.tick(this,o,now); }
  this.tickEcologies(now);
  for(const p of this.players.values()) if(p.dead&&now>=p.respawnAt) this.respawn(p,now);
  for(const [id,s] of this.life)if(now>=s.expires)this.life.delete(id);
  for(const [k,l] of this.loot) if(now>=l.expires) this.loot.delete(k); }
 spawnBoss(o, now=Date.now()){ o.alive=true; o.hp=o.max; o.nextAt=0; o.dmg.clear(); o.names.clear(); o.last.clear(); o.impacts.length=0;o.ver++;
  COMBAT.reset(o,now); DOM.reset(o,now);
  this.store?.bossSave(o.id,o.zone,'alive',0,now);
  this.emit({ type:'announce', kind:'bossSpawn', zone:o.zone, boss:o.id, name:o.name, title:o.title, place:o.place }); return o; }
 hit(id, msg, profile, now=Date.now(), opt={}){ const p=this.players.get(id); if(!p) throw Error('먼저 지역에 들어가세요.');
  const o=this.bosses.get(msg.boss); if(!o||o.zone!==p.zone) throw Error('보스를 찾을 수 없습니다.'); if(!o.alive||p.dead) return null;
  if(Math.hypot(p.x-o.x,p.z-o.z)>reachOf(o)+0.5) return null;                 /* 닿지 않는 거리 — 조용히 버린다(지연 탓일 수 있다) */
  if(!opt.skill&&now-(o.last.get(id)||0)<HIT_GAP) return null; o.last.set(id,now);   /* 스킬 타격은 재사용 대기가 따로 막는다 */
  /* 피해는 서버가 굴린다 (클라가 보낸 숫자는 믿지 않는다) — 기본 공격력 + 무기 공격력 × 0.6, ±10%, 치명타 */
  const counter=COMBAT.tryCounter(o,now),st=profile.stats||{}, w=itemOf((profile.equipment||{}).main), crit=!!p.critNext||this.rng()<(st.critChance||0); p.critNext=false;   /* critNext: 그림자 걸음류 스킬 — 다음 공격 치명타 확정 */
  const dmg=Math.max(1,Math.round(((st.atk||1000)+((w&&w.stats&&w.stats.atk)||0)*0.6)*(0.9+this.rng()*0.2)*(crit?(st.critDamage||1.5):1)*(counter?1.65:1)*(opt.mult||1)));
  o.hp=Math.max(0,o.hp-dmg); o.dmg.set(id,(o.dmg.get(id)||0)+dmg); o.names.set(id,profile.name||'?'); o.ver++;
  const part=o.hp>0?COMBAT.damageShutter(o,p,profile,dmg,counter,now):null;
  /* 공동 전투에는 접촉만 공유한다. 피해량·공격력·보스 체력은 공격자 밖으로 내보내지 않는다 (문서 191). */
  let dx=p.x-o.x,dz=p.z-o.z,dist=Math.hypot(dx,dz);if(dist<.001){dx=-Math.sin(o.yaw||0);dz=-Math.cos(o.yaw||0);dist=1;}
  const edge=Math.max(.8,Math.min(1.55,(o.h||3)*.38)),impact={seq:++o.impactSeq,x:o.x+dx/dist*edge,z:o.z+dz/dist*edge,crit:!!crit,counter:!!counter,at:now};
  o.impacts.push(impact);if(o.impacts.length>3)o.impacts.shift();   /* 한 10 Hz 틱 사이 사건도 최대 셋까지 보존 — 폭주 없이 반격/치명을 덮지 않는다. */
  if(part?.broken)this.emit({type:'announce',kind:'bossPartBreak',zone:o.zone,boss:o.id,name:o.name,part:'shutter'});
  if(o.hp<=0) this.killBoss(o, now);
  return { type:'bossHit', boss:o.id, dmg, crit, counter, down:!o.alive, part:part&&part.changed?[part.state,part.broken?1:0]:null, impact:[impact.seq,+impact.x.toFixed(2),+impact.z.toFixed(2),impact.at] }; }   /* 체력은 보내지 않는다 — 얼마나 남았는지 모르고 때린다 (디렉터 2026-10-06) */
 /* 캐릭터 스킬 1~4 (디렉터: «스킬을 누르고 공격을 누르면 그 스킬이 나간다» — 고르는 건 화면, 결과는 서버).
    수치는 솔로와 같은 표(js/dungeons.js SKILLS + 스킬 성장 rpg-skills.resolve). 재사용 대기는 서버가 센다.
    종류: mult>0 → 보스 타격(배율) · dodge → 회피 무적(+critNext: 다음 공격 치명타) · buff.reduce → 그 시간 동안 받는 피해 감소 */
 skill(id, msg, profile, now=this.clock()){ const p=this.players.get(id); if(!p) throw Error('먼저 지역에 들어가세요.'); if(p.dead) return null;
  const i=msg.skill|0, def=(RS.resolve(profile).skills||[])[i]; if(!def||i<0||i>3) return null;
  p.skillReady=p.skillReady||[0,0,0,0]; if(now<p.skillReady[i]){
   const used={skill:i,ok:false,ready:p.skillReady[i],name:def.name};
   const m=typeof msg.mob==='string'&&typeof msg.boss!=='string'?this.ecologies.get(p.zone)?.mobs.get(msg.mob):null;
   return m&&(msg.generation===undefined||msg.generation===m.generation)
    ?{type:'mobHit',mob:m.id,generation:m.generation,...used}:{type:'skillUsed',...used}; }
  p.skillReady[i]=now+Math.round((def.cd||6)*1000); p.anim='skill'+(i+1);
  if(def.dodge){ p.dodgeUntil=now+DODGE_TIME; if(def.critNext) p.critNext=true; }
  if(def.buff&&def.buff.reduce){ p.buffUntil=now+Math.round((def.buff.dur||2)*1000); p.buffReduce=Math.max(0,Math.min(.8,def.buff.reduce)); }
  let hit=null; if(def.mult>0){ try{ if(typeof msg.mob==='string'&&typeof msg.boss!=='string')hit=this.hitMob(id,msg,profile,now,{mult:def.mult,skill:true});
    else if(typeof msg.boss==='string'&&typeof msg.mob!=='string')hit=this.hit(id,{boss:msg.boss},profile,now,{mult:def.mult,skill:true}); }catch{ hit=null; } }
  const used={ skill:i, ok:true, ready:p.skillReady[i], name:def.name };
  return hit?{ ...hit, ...used }:{ type:'skillUsed', ...used }; }
 /* 보스 타격 판정. 회피 무적·피해·넉백·사망을 한 서버 시각에서 결정한다. */
 bossStrike(o,p,hit,now=Date.now()){
  if(p.dead)return null; const seq=++p.hurtSeq;
  if(now<p.invulnUntil||now<p.dodgeUntil){ p.hurt=[seq,0,o.id,hit.skill,'evade',hit.beat,now];if(now>=p.invulnUntil&&now<p.dodgeUntil)COMBAT.notePlayerResult(o,p.id,true); return {evade:true}; }
  const reduce=Math.min(.28,(p.defense/(p.defense+6000))*.36),partMul=o.shutterState===2?(hit.skill==='storm'?.84:hit.skill==='slam'?.88:1):1,buffMul=now<(p.buffUntil||0)?1-(p.buffReduce||0):1,amount=Math.max(1,Math.round(p.maxHp*hit.damage*partMul*buffMul*(1-reduce)));   /* buffMul: 결의·철벽류 스킬 */
  p.hp=Math.max(0,p.hp-amount);
  if(hit.knock){ let dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz); if(d<.01){dx=Math.sin(o.yaw||0);dz=Math.cos(o.yaw||0);d=1;}
   p.x+=dx/d*hit.knock;p.z+=dz/d*hit.knock;this.clamp(this.zones.get(p.zone),p); }
  const kind=p.hp<=0?'dead':'hit'; if(p.hp<=0){p.dead=true;p.respawnAt=now+RESPAWN_TIME;p.anim='idle';}
  p.hurt=[seq,amount,o.id,hit.skill,kind,hit.beat,now];COMBAT.notePlayerResult(o,p.id,false); return {amount,dead:p.dead}; }
 respawn(p,now=Date.now()){ const z=this.zones.get(p.zone),at=z&&z.spawn;if(!z||!at)return;
  p.x=at.x;p.z=at.z;p.yaw=0;p.anim='idle';p.hp=p.maxHp;p.dead=false;p.respawnAt=0;p.invulnUntil=now+RESPAWN_GUARD;p.dodgeUntil=0;
  p.hurt=[++p.hurtSeq,0,'','','respawn',0,now]; }
 selfView(p){ return {hp:p.hp,maxHp:p.maxHp,dead:p.dead?1:0,respawnAt:p.respawnAt||0,invulnUntil:p.invulnUntil||0}; }
 killBoss(o, now=Date.now()){ o.alive=false; o.hp=0; o.ver++;
  const total=[...o.dmg.values()].reduce((a,b)=>a+b,0)||1;
  const ranking=[...o.dmg].sort((a,b)=>b[1]-a[1]).map(([pid,d])=>({ id:pid, name:o.names.get(pid), dmg:d, share:d/total }));
  /* 드롭: 묶음마다 확률 → 맞으면 그 묶음에서 하나. 바닥(보스 자리 둘레)에 떨어지고 1위가 10초 먼저 */
  const drops=[]; for(const g of o.drops) if(g.pick.length&&this.rng()<g.rate) drops.push(g.pick[Math.floor(this.rng()*g.pick.length)]);
  const top=ranking[0]||null;
  const a0=this.rng()*Math.PI*2;   /* 고르게 흩는다 — 붙어 떨어지면 이름표가 겹치고 엉뚱한 걸 줍는다 */
  for(const [n,item] of drops.entries()){ const k='L'+(++this.lootSerial), a=a0+n/drops.length*Math.PI*2, r=2+this.rng()*1.2;
   this.loot.set(k,{ id:k, item, zone:o.zone, x:o.x+Math.cos(a)*r, z:o.z+Math.sin(a)*r, owner:top&&top.id, ownerUntil:now+LOOT_PRIORITY, expires:now+LOOT_LIFE, boss:o.id }); }
  o.nextAt=CY.nextSpawn(o.cycle, now, { rng:this.rng, dead:true });
  let changed=[]; if(this.store){ this.store.bossSave(o.id,o.zone,'wait',o.nextAt,now); changed=this.store.bossKill(o.id,o.zone,now,ranking,drops,T.MATERIAL);if(top){this.titleCache.delete(top.id);if(!changed.includes(top.id))changed.push(top.id);} }
  this.emit({ type:'announce', kind:'bossDown', zone:o.zone, boss:o.id, name:o.name, top:top&&top.name, players:ranking.length,
   drops:drops.map(i=>{ const d=itemOf(i); return { item:i, name:d&&d.name, rarity:d&&d.rarity }; }), changed });
  return { ranking, drops }; }
 pickup(id, lootId, store=this.store, now=Date.now()){ const p=this.players.get(id); if(!p) throw Error('먼저 지역에 들어가세요.');
  if(p.dead)throw Error('전투 불능 중에는 주울 수 없습니다.');
  const l=this.loot.get(lootId); if(!l||l.zone!==p.zone) throw Error('이미 사라진 물품입니다.');
  if(Math.hypot(p.x-l.x,p.z-l.z)>LOOT_REACH) throw Error('더 가까이 가야 주울 수 있습니다.');
  if(l.owner&&l.owner!==id&&now<l.ownerUntil) throw Error('기여도 1위가 먼저 주울 수 있습니다 ('+Math.ceil((l.ownerUntil-now)/1000)+'초).');
  if(!store) throw Error('저장소가 없습니다.');
  const profile=store.bossLoot(id, l.item); this.loot.delete(lootId); const d=itemOf(l.item);
  if(d&&(d.rarity==='legend'||d.rarity==='myth')) this.emit({ type:'announce', kind:'loot', zone:l.zone, boss:l.boss, who:profile.name, item:l.item, name:d.name, rarity:d.rarity });
  return { profile, item:l.item }; }
 /* 지역 안 보스 상태 [id, 살아 있나] + 서버 권위 동작 + 반경 안 바닥 장비 [id, 아이템, x, z, 내가 먼저인가]
    보스 체력은 보내지 않는다 — 디렉터 2026-10-06 «보스의 체력바는 안 나왔으면 좋겠어. 나오면 재미없지» (리니지처럼) */
 bossView(r, now=Date.now()){ const bs=[], bossActs=[], bossImpacts=[], loot=[];
  for(const o of this.bosses.values()) if(o.zone===r.zone){ bs.push([o.id, o.alive?1:0]); const a=COMBAT.view(o)||DOM.view(o);if(a)bossActs.push(a);
   if((o.x-r.x)**2+(o.z-r.z)**2<=AOI*AOI)for(const h of o.impacts)if(now-h.at<=BOSS_IMPACT_LIFE)bossImpacts.push([o.id,h.seq,+h.x.toFixed(2),+h.z.toFixed(2),h.crit?1:0,h.counter?1:0,h.at]); }
  for(const l of this.loot.values()){ if(l.zone!==r.zone||(l.x-r.x)**2+(l.z-r.z)**2>AOI*AOI) continue;
   loot.push([l.id, l.item, +l.x.toFixed(2), +l.z.toFixed(2), (!l.owner||l.owner===r.id||now>=l.ownerUntil)?1:0]); }
  return { bossNow:now, bosses:bs, bossActs, bossImpacts, loot }; }
 command(id, msg, profile, inRaid){
  if(inRaid) throw Error('출격 중에는 필드에 들어갈 수 없습니다.');
  if(msg.type==='fieldJoin'){ const p=this.join(id, profile, msg.zone, msg.look, msg.gate); return { type:'fieldJoined', zone:p.zone, x:p.x, z:p.z, anims:ANIMS, info:p.info, self:this.selfView(p), hub:this.hubOwner(p.zone), mobs:this.mobView(p), mobNow:this.clock(), ...this.bossView(p) }; }
  if(msg.type==='fieldHit'){ if(typeof msg.mob==='string'&&typeof msg.boss!=='string')return this.hitMob(id,msg,profile);
    return typeof msg.boss==='string'&&typeof msg.mob!=='string'?this.hit(id, msg, profile):null; }
  if(msg.type==='fieldSkill'){ return this.skill(id, msg, profile); }
  if(msg.type==='fieldMove'){ this.move(id, msg); return null; }
  /* 옛 데모 클라이언트 호환용 무응답. 온라인 외형은 장착 장비만 권위로 삼아 반복 재생성 공격을 막는다. */
  if(msg.type==='fieldLook')return null;
  if(msg.type==='fieldLeave'){ this.leave(id); return { type:'fieldLeft' }; }
  throw Error('알 수 없는 필드 요청입니다.'); }
}
module.exports={ Field, POTION_HEAL, POTION_GAP, ANIMS, MAX_SPEED, AOI, HIT_GAP, LOOT_PRIORITY, BOSS_IMPACT_LIFE, DODGE_TIME, RESPAWN_TIME, RESPAWN_GUARD, reachOf, prestigeTitle };
