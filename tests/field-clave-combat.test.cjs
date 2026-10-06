/* 클레이브 상세 필드 전투 — 보행·예고·연계·마지막 타 반격·회피·사망 복귀 */
const test=require('node:test'),assert=require('node:assert/strict');
const {Field,RESPAWN_TIME}=require('../server/field.cjs');
const COMBAT=require('../server/field-boss-combat.cjs');

const profile=(name='검사')=>({name,character:'kain',equipment:{},stats:{hp:20000,atk:3000,defense:1600,critChance:0,critDamage:1.5}});
function setup(){
 const f=new Field({rng:()=>.5}),P=profile(); f.initBosses(0); const o=f.bosses.get('clave'); f.spawnBoss(o,1000);
 const p=f.join('p',P,'gangnam_b1'); p.invulnUntil=0;p.at=1000; return {f,o,p,P};
}

test('클레이브: 서버가 목표를 향해 무게 있게 걷고, 화면에는 위치·선회·동작만 보낸다',()=>{
 const {f,o,p}=setup(); p.x=o.x;p.z=o.z+10;
 f.tickBosses(1050); assert.equal(o.combat.state,'walk'); const z=o.z;
 f.tickBosses(1150); assert.ok(o.z>z&&o.z-z<=COMBAT.WALK_SPEED*.101,'한 틱 보행 거리 제한');
 const v=f.bossView(p,1150),a=v.bossActs.find(x=>x.id==='clave');
 assert.equal(a.motion,'walk');assert.equal(a.skill,'');assert.equal(typeof a.yaw,'number');
 assert.equal('hp' in a||'max' in a,false,'보스 체력은 동작 패킷에도 없다');
 assert.deepEqual(v.bosses.find(x=>x[0]==='clave'),['clave',1]);
});

test('클레이브: 공동 접촉은 AOI 안에 최근 셋만 보내고 출현 때 묵은 사건을 지운다',()=>{
 const {f,o}=setup(),players=[];for(let i=0;i<4;i++){const P=profile('타격'+i),p=f.join('h'+i,P,'gangnam_b1');p.x=o.x+1;p.z=o.z;players.push({p,P});}
 const eye=f.join('eye',profile('관찰'),'gangnam_b1');eye.x=o.x+2;eye.z=o.z;
 for(let i=0;i<players.length;i++)assert.ok(f.hit(players[i].p.id,{boss:o.id},players[i].P,2000+i));
 assert.equal(o.impacts.length,3,'고정 크기 큐');const v=f.bossView(eye,2010);assert.equal(v.bossImpacts.length,3);assert.deepEqual(v.bossImpacts.map(h=>h[1]),o.impacts.map(h=>h.seq));
 eye.x=o.x+100;assert.equal(f.bossView(eye,2010).bossImpacts.length,0,'관심 반경 밖에는 안 보낸다');const seq=o.impactSeq;
 f.spawnBoss(o,2100);assert.equal(o.impacts.length,0,'재출현 때 묵은 접촉 제거');eye.x=o.x+2;assert.equal(f.bossView(eye,2100).bossImpacts.length,0);
 players[0].p.x=o.x+1;players[0].p.z=o.z;const next=f.hit(players[0].p.id,{boss:o.id},players[0].P,2400);assert.ok(next.impact[0]>seq,'출현 뒤에도 순번은 단조 증가');
});

test('클레이브: 셔터 돌진은 먼저 예고하고, 서버 판정 순간 회피 중이면 피해가 없다',()=>{
 const {f,o,p}=setup();p.x=o.x;p.z=o.z+3;
 f.tickBosses(1700);assert.equal(o.combat.skill,'shutter');const start=o.combat.startedAt,hp=p.hp;
 const hitAt=COMBAT.SKILLS.shutter.hits[0].at;f.tickBosses(start+hitAt-1);assert.equal(p.hp,hp,'예고 중에는 피해 없음');
 p.dodgeUntil=start+hitAt+120;f.tickBosses(start+hitAt);
 assert.equal(p.hp,hp);assert.equal(p.hurt[4],'evade');assert.equal(p.hurt[3],'shutter');
 assert.ok(o.z>o.homeZ,'예고 뒤 잠근 방향으로 돌진');
});

test('클레이브: 3연계의 중간 타는 맞아도 마지막 타 직전 공격은 반격으로 끊는다',()=>{
 const {f,o,p,P}=setup();p.x=o.x;p.z=o.z+2.5;o.combat.pattern=1;
 f.tickBosses(1700);assert.equal(o.combat.skill,'storm');const start=o.combat.startedAt;
 const s=COMBAT.SKILLS.storm;f.tickBosses(start+s.hits[0].at);f.tickBosses(start+s.hits[1].at);const afterTwo=p.hp;assert.ok(afterTwo<p.maxHp,'앞 두 타 피해');p.x=o.x;p.z=o.z+2.4;
 const counterAt=start+s.counter[0]+40,hit=f.hit(p.id,{boss:o.id},P,counterAt);assert.equal(hit.counter,true);assert.equal(o.combat.state,'stagger');
 f.tickBosses(start+s.hits[2].at);assert.equal(p.hp,afterTwo,'마지막 타가 취소됨');
 assert.equal(f.bossView(p,start+s.hits[2].at).bossActs[0].motion,'stagger');
});

test('클레이브: 전투 불능 뒤 출발점에서 전 체력·2초 보호로 복귀한다',()=>{
 const {f,o,p}=setup(),x=p.x,z=p.z;
 f.bossStrike(o,p,{skill:'slam',beat:1,damage:2,knock:3},2000);
 assert.equal(p.dead,true);assert.equal(p.hp,0);assert.equal(p.hurt[4],'dead');
 f.move(p.id,{x:x+20,z,anim:'run'},2100);assert.notEqual(p.x,x+20,'사망 중 이동 불가');
 f.tickBosses(2000+RESPAWN_TIME-1);assert.equal(p.dead,true);
 f.tickBosses(2000+RESPAWN_TIME);assert.equal(p.dead,false);assert.equal(p.hp,p.maxHp);assert.equal(p.hurt[4],'respawn');
 assert.ok(p.invulnUntil>2000+RESPAWN_TIME);assert.deepEqual(f.selfView(p).dead,0);
});

test('필드 생명: 새로고침·지역 이동으로 즉시 회복하지 않고, 사망 중 드롭을 줍지 못한다',()=>{
 const {f,p,P}=setup();p.hp=Math.round(p.maxHp*.4);p.invulnUntil=0;f.leave(p.id);const q=f.join(p.id,P,'gangnam_b1');
 assert.ok(Math.abs(q.hp/q.maxHp-.4)<.01,'30초 안 재입장은 체력 비율 유지');assert.equal(q.invulnUntil,0,'재입장 무적 재지급 없음');
 f.relook(q.id,{...P,stats:{...P.stats,hp:30000,defense:3200}},0);assert.equal(q.maxHp,30000);assert.equal(q.defense,3200);assert.ok(Math.abs(q.hp/q.maxHp-.4)<.01);
 q.dead=true;q.hp=0;f.loot.set('Lx',{id:'Lx',item:'w_clave_blade',zone:q.zone,x:q.x,z:q.z,owner:null,ownerUntil:0,expires:1e15,boss:'clave'});
 assert.throws(()=>f.pickup(q.id,'Lx',null),/전투 불능/);
});
