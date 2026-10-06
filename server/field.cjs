/* 필드(존) 동기화 — 2D 맵 MMORPG (docs/design/185 §6.4)
   파티 레이드(raid.cjs)가 «방 안 4명» 이라면 필드는 «한 지역에 있는 모두» 다.
   클라이언트는 자기 위치·방향·동작을 초당 10번 보내고, 서버는 속도·걷는 띠를 검사한 뒤
   관심 반경 안의 사람만 초당 10번 돌려준다. 이름·영웅·장비 같은 고정 정보는 처음 보일 때와 바뀔 때만 보낸다.
   걷는 띠·출발점은 맵 굽기 결과(maps/2d/<zone>/map.json)를 그대로 읽는다 — 한 곳에서만 정한다. */
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const ANIMS=['idle','run','walk','attack1','dodgeB'];
const MAX_SPEED=7.5;       /* m/s — 클라 달리기 4.8 + 회피 돌진·지연 여유 */
const AOI=28;              /* m — 휴대폰 화면 대각선의 약 2배 */
function loadZone(id){ try{ const m=JSON.parse(fs.readFileSync(path.join(ROOT,'maps','2d',id,'map.json'),'utf8')); return { id, walk:m.walk, ang:m.road.ang, spawn:m.spawn }; }catch{ return null; } }
const num=(v,lo,hi)=>Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):null;
class Field{
 constructor(){ this.zones=new Map(); this.players=new Map(); }
 zone(id){ if(typeof id!=='string'||!/^[a-z0-9_]{1,24}$/.test(id)) return null; if(!this.zones.has(id)){ const z=loadZone(id); if(!z) return null; this.zones.set(id,z); } return this.zones.get(id); }
 /* 길 좌표 (s, t) — js/mmo/env-gangnam.js 의 DIR·SIDE 와 같다 */
 clamp(z,p){ const c=Math.cos(z.ang),s=Math.sin(z.ang); let a=p.x*c-p.z*s, t=-p.x*s-p.z*c; a=Math.min(z.walk.s1,Math.max(z.walk.s0,a)); t=Math.min(z.walk.t1,Math.max(z.walk.t0,t)); p.x=a*c-t*s; p.z=-a*s-t*c; }
 info(profile, look){ return { name:profile.name, character:profile.character||'ain', eq:{...(profile.equipment||{})}, look }; }
 join(id, profile, zoneId, look){ const z=this.zone(zoneId); if(!z) throw Error('지역을 찾을 수 없습니다.'); this.leave(id);
  const p={ id, zone:z.id, x:z.spawn.x+(Math.random()-.5)*2, z:z.spawn.z+(Math.random()-.5)*2, yaw:0, anim:'idle', at:Date.now(), info:this.info(profile, Number.isInteger(look)&&look>=0&&look<=3?look:0), ver:1, known:new Map() };
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
  return { type:'field', you:[+r.x.toFixed(2), +r.z.toFixed(2)], players:out, infos }; }
 command(id, msg, profile, inRaid){
  if(inRaid) throw Error('출격 중에는 필드에 들어갈 수 없습니다.');
  if(msg.type==='fieldJoin'){ const p=this.join(id, profile, msg.zone, msg.look); return { type:'fieldJoined', zone:p.zone, x:p.x, z:p.z, anims:ANIMS }; }
  if(msg.type==='fieldMove'){ this.move(id, msg); return null; }
  if(msg.type==='fieldLook'){ this.relook(id, profile, msg.look); return null; }
  if(msg.type==='fieldLeave'){ this.leave(id); return { type:'fieldLeft' }; }
  throw Error('알 수 없는 필드 요청입니다.'); }
}
module.exports={ Field, ANIMS, MAX_SPEED, AOI };
