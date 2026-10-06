/* 필드(존) 동기화 — 2D 맵 MMORPG (docs/design/185 §6.4)
   파티 레이드(raid.cjs)가 «방 안 4명» 이라면 필드는 «한 지역에 있는 모두» 다.
   클라이언트는 자기 위치·방향·동작을 초당 10번 보내고, 서버는 속도·걷는 띠를 검사한 뒤
   관심 반경 안의 사람만 초당 10번 돌려준다. 이름·영웅·장비 같은 고정 정보는 처음 보일 때와 바뀔 때만 보낸다.
   걷는 띠·출발점은 맵 굽기 결과(maps/2d/<zone>/map.json)를 그대로 읽는다 — 한 곳에서만 정한다. */
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const CY=require('./boss-cycle.cjs'),T=require('./boss-table.cjs'),C=require('./content.cjs');
const ANIMS=['idle','run','walk','attack1','dodgeB'];
const MAX_SPEED=7.5;       /* m/s — 클라 달리기 4.8 + 회피 돌진·지연 여유 */
const AOI=28;              /* m — 휴대폰 화면 대각선의 약 2배 */
const BOSS_AOI=60;         /* m — 보스는 크다. 멀리서도 «살아 있다» 가 보여야 사람이 모인다 */
const HIT_GAP=350;         /* ms — 한 사람이 보스를 때릴 수 있는 최소 간격 (클라 공격 동작 ≈0.6초) */
const LOOT_REACH=3.5, LOOT_PRIORITY=10e3, LOOT_LIFE=180e3;   /* 줍는 거리 · 기여도 1위 먼저(10초) · 바닥에 남는 시간 */
const reachOf=b=>2.5+Math.min(4,(b.h||3)*0.4);               /* 보스 몸 반지름 + 무기 길이 (대략) */
function loadZone(id){ try{ const m=JSON.parse(fs.readFileSync(path.join(ROOT,'maps','2d',id,'map.json'),'utf8')); return { id, walk:m.walk, ang:m.road.ang, spawn:m.spawn, gates:(m.gates||[]).filter(g=>g&&typeof g.id==='string'&&Number.isFinite(g.x)&&Number.isFinite(g.z)),
  bosses:(m.bosses||[]).filter(b=>b&&typeof b.id==='string'&&Number.isFinite(b.x)&&Number.isFinite(b.z)) }; }catch{ return null; } }
const ZONE_IDS=()=>{ try{ return fs.readdirSync(path.join(ROOT,'maps','2d')).filter(d=>/^[a-z0-9_]{1,24}$/.test(d)&&fs.existsSync(path.join(ROOT,'maps','2d',d,'map.json'))); }catch{ return []; } };
const itemOf=id=>C.equipment.find(i=>i.id===id);
const num=(v,lo,hi)=>Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):null;
class Field{
 /* store: 보스 상태·처치 기록 저장 (없으면 메모리만) · emit: 서버 전체 알림 (출현·처치·전설 획득) */
 constructor({ store=null, emit=()=>{}, rng=Math.random, timeScale=Number(process.env.BOSS_TIME_SCALE)||1 }={}){
  this.zones=new Map(); this.players=new Map(); this.bosses=new Map(); this.loot=new Map(); this.lootSerial=0;
  this.store=store; this.emit=emit; this.rng=rng; this.timeScale=timeScale; }
 zone(id){ if(typeof id!=='string'||!/^[a-z0-9_]{1,24}$/.test(id)) return null; if(!this.zones.has(id)){ const z=loadZone(id); if(!z) return null; this.zones.set(id,z); } return this.zones.get(id); }
 /* 길 좌표 (s, t) — js/mmo/env-gangnam.js 의 DIR·SIDE 와 같다 */
 clamp(z,p){ const c=Math.cos(z.ang),s=Math.sin(z.ang); let a=p.x*c-p.z*s, t=-p.x*s-p.z*c; a=Math.min(z.walk.s1,Math.max(z.walk.s0,a)); t=Math.min(z.walk.t1,Math.max(z.walk.t0,t)); p.x=a*c-t*s; p.z=-a*s-t*c; }
 info(profile, look){ return { name:profile.name, character:profile.character||'ain', eq:{...(profile.equipment||{})}, look }; }
 /* gate: 다른 지역의 문으로 넘어왔을 때 도착할 문 id (map.json gates) — 없거나 모르는 id 면 지역 출발점 */
 join(id, profile, zoneId, look, gate){ const z=this.zone(zoneId); if(!z) throw Error('지역을 찾을 수 없습니다.'); this.leave(id);
  const at=(typeof gate==='string'&&z.gates.find(g=>g.id===gate))||z.spawn;
  const p={ id, zone:z.id, x:at.x+(Math.random()-.5)*2, z:at.z+(Math.random()-.5)*2, yaw:0, anim:'idle', at:Date.now(), info:this.info(profile, Number.isInteger(look)&&look>=0&&look<=3?look:0), ver:1, known:new Map() };
  this.clamp(z,p); this.players.set(id,p); return p; }
 leave(id){ this.players.delete(id); }
 /* 외형이 바뀌었을 때(장비·외형 프리셋) — 보이는 사람들에게 다시 보낸다 */
 relook(id, profile, look){ const p=this.players.get(id); if(!p) return; const l=Number.isInteger(look)&&look>=0&&look<=3?look:p.info.look; p.info=this.info(profile,l); p.ver++; }
 move(id, msg, now=Date.now()){ const p=this.players.get(id); if(!p) throw Error('먼저 지역에 들어가세요.'); const z=this.zones.get(p.zone);
  const x=num(msg.x,-1e4,1e4), zz=num(msg.z,-1e4,1e4); if(x===null||zz===null) return p;
  /* 속도 검사: 지난 갱신 뒤 시간 × 최대 속도 + 0.6 m 를 넘으면 그 거리까지만 */
  const dt=Math.min(1,Math.max(0.01,(now-p.at)/1000)), dx=x-p.x, dz=zz-p.z, d=Math.hypot(dx,dz), lim=MAX_SPEED*dt+0.6;
  if(d>lim){ p.x+=dx/d*lim; p.z+=dz/d*lim; } else { p.x=x; p.z=zz; }
  this.clamp(z,p); p.at=now;
  const yaw=num(msg.yaw,-10,10); if(yaw!==null) p.yaw=yaw; p.anim=ANIMS.includes(msg.anim)?msg.anim:'idle'; return p; }
 /* 받는 사람 r 에게: 관심 반경 안 다른 사람들의 [id, x, z, yaw, 동작 번호] + 처음 보거나 바뀐 사람의 고정 정보 */
 view(r){ const out=[], infos={}; const seen=new Set();
  for(const p of this.players.values()){ if(p===r||p.zone!==r.zone) continue; if((p.x-r.x)**2+(p.z-r.z)**2>AOI*AOI) continue;
   seen.add(p.id); out.push([p.id, +p.x.toFixed(2), +p.z.toFixed(2), +p.yaw.toFixed(2), ANIMS.indexOf(p.anim)]);
   if(r.known.get(p.id)!==p.ver){ infos[p.id]=p.info; r.known.set(p.id,p.ver); } }
  for(const id of [...r.known.keys()]) if(!seen.has(id)) r.known.delete(id);   /* 반경 밖으로 나가면 다음에 다시 정보를 보낸다 */
  const bv=this.bosses.size?this.bossView(r):null;
  return { type:'field', you:[+r.x.toFixed(2), +r.z.toFixed(2)], players:out, infos, ...(bv&&(bv.bosses.length||bv.loot.length)?bv:{}) }; }
 /* ---------- 필드 보스 (docs/design/188) — 공유 세계: 지역마다 주기마다 한 마리, 모두가 노린다 ---------- */
 initBosses(now=Date.now()){
  const saved=new Map((this.store?this.store.bossStates():[]).map(r=>[r.id,r]));
  for(const zid of ZONE_IDS()){ const z=this.zone(zid); if(!z) continue;
   for(const b of z.bosses){ if(this.bosses.has(b.id)) continue; const row=T.BOSSES[b.id]||T.DEFAULT, cycle=CY.norm(row.cycle,this.timeScale);
    const o={ id:b.id, zone:zid, name:b.name, title:b.title||'', place:b.place||'', x:b.x, z:b.z, h:b.h||3, max:row.hp, hp:row.hp, cycle, drops:row.drops, alive:false, nextAt:0, dmg:new Map(), names:new Map(), last:new Map(), ver:0 };
    const r=saved.get(b.id);
    /* 살아 있던 보스는 체력을 채워 다시 세운다(리니지도 재시작하면 처음부터). 기다리던 보스는 약속한 시각을 지킨다. */
    if(r&&r.state==='alive'){ o.alive=true; o.nextAt=0; }
    else if(r&&r.state==='wait'&&r.next_at>now-cycle.period) o.nextAt=r.next_at;
    else { o.nextAt=CY.nextSpawn(cycle, now, { rng:this.rng }); this.store?.bossSave(o.id,o.zone,'wait',o.nextAt,now); }
    this.bosses.set(o.id,o); } }
  return this.bosses; }
 /* 1초마다: 나올 때가 된 보스를 세우고, 주인 없는 지 오래된 바닥 장비를 치운다 */
 tickBosses(now=Date.now()){
  for(const o of this.bosses.values()) if(!o.alive&&o.nextAt&&now>=o.nextAt) this.spawnBoss(o, now);
  for(const [k,l] of this.loot) if(now>=l.expires) this.loot.delete(k); }
 spawnBoss(o, now=Date.now()){ o.alive=true; o.hp=o.max; o.nextAt=0; o.dmg.clear(); o.names.clear(); o.last.clear(); o.ver++;
  this.store?.bossSave(o.id,o.zone,'alive',0,now);
  this.emit({ type:'announce', kind:'bossSpawn', zone:o.zone, boss:o.id, name:o.name, title:o.title, place:o.place }); return o; }
 hit(id, msg, profile, now=Date.now()){ const p=this.players.get(id); if(!p) throw Error('먼저 지역에 들어가세요.');
  const o=this.bosses.get(msg.boss); if(!o||o.zone!==p.zone) throw Error('보스를 찾을 수 없습니다.'); if(!o.alive) return null;
  if(Math.hypot(p.x-o.x,p.z-o.z)>reachOf(o)+0.5) return null;                 /* 닿지 않는 거리 — 조용히 버린다(지연 탓일 수 있다) */
  if(now-(o.last.get(id)||0)<HIT_GAP) return null; o.last.set(id,now);
  /* 피해는 서버가 굴린다 (클라가 보낸 숫자는 믿지 않는다) — 기본 공격력 + 무기 공격력 × 0.6, ±10%, 치명타 */
  const st=profile.stats||{}, w=itemOf((profile.equipment||{}).main), crit=this.rng()<(st.critChance||0);
  const dmg=Math.max(1,Math.round(((st.atk||1000)+((w&&w.stats&&w.stats.atk)||0)*0.6)*(0.9+this.rng()*0.2)*(crit?(st.critDamage||1.5):1)));
  o.hp=Math.max(0,o.hp-dmg); o.dmg.set(id,(o.dmg.get(id)||0)+dmg); o.names.set(id,profile.name||'?'); o.ver++;
  if(o.hp<=0) this.killBoss(o, now);
  return { type:'bossHit', boss:o.id, dmg, crit, hp:o.hp, max:o.max }; }
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
  let changed=[]; if(this.store){ this.store.bossSave(o.id,o.zone,'wait',o.nextAt,now); changed=this.store.bossKill(o.id,o.zone,now,ranking,drops,T.MATERIAL); }
  this.emit({ type:'announce', kind:'bossDown', zone:o.zone, boss:o.id, name:o.name, top:top&&top.name, players:ranking.length,
   drops:drops.map(i=>{ const d=itemOf(i); return { item:i, name:d&&d.name, rarity:d&&d.rarity }; }), changed });
  return { ranking, drops }; }
 pickup(id, lootId, store=this.store, now=Date.now()){ const p=this.players.get(id); if(!p) throw Error('먼저 지역에 들어가세요.');
  const l=this.loot.get(lootId); if(!l||l.zone!==p.zone) throw Error('이미 사라진 물품입니다.');
  if(Math.hypot(p.x-l.x,p.z-l.z)>LOOT_REACH) throw Error('더 가까이 가야 주울 수 있습니다.');
  if(l.owner&&l.owner!==id&&now<l.ownerUntil) throw Error('기여도 1위가 먼저 주울 수 있습니다 ('+Math.ceil((l.ownerUntil-now)/1000)+'초).');
  if(!store) throw Error('저장소가 없습니다.');
  const profile=store.bossLoot(id, l.item); this.loot.delete(lootId); const d=itemOf(l.item);
  if(d&&(d.rarity==='legend'||d.rarity==='myth')) this.emit({ type:'announce', kind:'loot', zone:l.zone, boss:l.boss, who:profile.name, item:l.item, name:d.name, rarity:d.rarity });
  return { profile, item:l.item }; }
 /* 지역 안 보스 상태 [id, 체력 비율, 살아 있나] + 반경 안 바닥 장비 [id, 아이템, x, z, 내가 먼저인가] */
 bossView(r, now=Date.now()){ const bs=[], loot=[];
  for(const o of this.bosses.values()){ if(o.zone!==r.zone) continue; if(o.alive&&(o.x-r.x)**2+(o.z-r.z)**2>BOSS_AOI*BOSS_AOI){ bs.push([o.id,-1,1]); continue; }
   bs.push([o.id, +(o.hp/o.max).toFixed(4), o.alive?1:0]); }
  for(const l of this.loot.values()){ if(l.zone!==r.zone||(l.x-r.x)**2+(l.z-r.z)**2>AOI*AOI) continue;
   loot.push([l.id, l.item, +l.x.toFixed(2), +l.z.toFixed(2), (!l.owner||l.owner===r.id||now>=l.ownerUntil)?1:0]); }
  return { bosses:bs, loot }; }
 command(id, msg, profile, inRaid){
  if(inRaid) throw Error('출격 중에는 필드에 들어갈 수 없습니다.');
  if(msg.type==='fieldJoin'){ const p=this.join(id, profile, msg.zone, msg.look, msg.gate); return { type:'fieldJoined', zone:p.zone, x:p.x, z:p.z, anims:ANIMS, ...this.bossView(p) }; }
  if(msg.type==='fieldHit'){ return typeof msg.boss==='string'?this.hit(id, msg, profile):null; }
  if(msg.type==='fieldMove'){ this.move(id, msg); return null; }
  if(msg.type==='fieldLook'){ this.relook(id, profile, msg.look); return null; }
  if(msg.type==='fieldLeave'){ this.leave(id); return { type:'fieldLeft' }; }
  throw Error('알 수 없는 필드 요청입니다.'); }
}
module.exports={ Field, ANIMS, MAX_SPEED, AOI, BOSS_AOI, HIT_GAP, LOOT_PRIORITY, reachOf };
