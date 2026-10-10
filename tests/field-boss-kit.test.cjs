/* 기술표형 필드 보스 (문서 222) — 섀도우 팽: 그림자 난무(흡혈) · 무음 찌르기(반격창) · 그림자 개화(50 % 한 번) */
const test=require('node:test'),assert=require('node:assert/strict');
const {Field}=require('../server/field.cjs');
const KIT=require('../server/field-boss-kit.cjs'),COMBAT=require('../server/field-boss-combat.cjs');
const profile=(name='검사')=>({name,character:'kain',equipment:{},stats:{hp:20000,atk:3000,defense:1600,critChance:0,critDamage:1.5}});
function setup(){ const f=new Field({rng:()=>.5}),P=profile(); f.initBosses(0); const o=f.bosses.get('shadowfang'); f.spawnBoss(o,1000);
 const p=f.join('p',P,'southroad'); p.invulnUntil=0; p.at=1000; return {f,o,p,P}; }
const run=(f,from,to,step=50)=>{ for(let t=from;t<=to;t+=step) f.tickBosses(t); };

test('연결: 섀도우 팽은 기술표 AI 를 갖고, 클레이브 모듈과 섞이지 않는다 · 화면 패킷에 체력·단계 없음',()=>{
 const {f,o,p}=setup(); assert.ok(o.kit); assert.equal(COMBAT.enabled(o),false); assert.equal(o.combat?.state,undefined);
 p.x=o.x; p.z=o.z+10; f.tickBosses(1050); assert.equal(o.kit.state,'walk');
 const a=f.bossView(p,1050).bossActs.find(x=>x.id==='shadowfang'); assert.equal(a.ai,'kit'); assert.equal(a.motion,'walk');
 for(const k of ['hp','max','phase']) assert.equal(k in a,false,k);
});

test('무음 찌르기: 5 m 밖이면 찌르기 · 1.25 s 동안 제자리 · 0.12 s 에 9 m · 잠근 방향으로만 · 반격창은 타격 직전 0.2 s',()=>{
 const {f,o,p}=setup(); p.x=o.x; p.z=o.z+7; o.kit.target=p.id; f.tickBosses(1800);
 assert.equal(o.kit.skill,'thrust'); const s=o.kit.startedAt, z0=o.z;
 f.tickBosses(s+1200); assert.ok(Math.abs(o.z-z0)<1e-6,'웅크림 동안 움직이지 않는다');
 p.x+=3; f.tickBosses(s+1370); assert.ok(o.z-z0>8.9,'9 m 돌진 '+(o.z-z0).toFixed(2)); assert.ok(Math.abs(o.x-p.x+3)<1e-6,'마지막 순간 따라 꺾지 않는다');
 const v=KIT.view(o); assert.equal(v.counterClose-v.counterOpen,200);
 const g=setup(); g.p.x=g.o.x; g.p.z=g.o.z+7; g.o.kit.target=g.p.id; g.f.tickBosses(1800); const t0=g.o.kit.startedAt;
 assert.equal(KIT.tryCounter(g.o,t0+900),false,'이르면 실패'); assert.equal(KIT.tryCounter(g.o,t0+1100),true); assert.equal(g.o.kit.state,'stagger');
});

test('그림자 난무: 떠올라 5·5·7타 + 내리꽂기 18판정 · 맞힐 때마다 체력 1.5 % 회복 · 회피하면 회복 없음',()=>{
 const {f,o,p}=setup(); o.hp=Math.round(o.max*.8); p.x=o.x; p.z=o.z+2; o.kit.target=p.id; o.kit.pattern='flurry'; f.tickBosses(1800);
 assert.equal(o.kit.skill,'flurry'); assert.equal(KIT.KITS.shadowfang.skills.flurry.hits.length,18);
 const s=o.kit.startedAt, hp0=o.hp; p.hp=p.maxHp=1e9; run(f,s,s+1300,10); assert.ok(o.hp>hp0,'첫 타 흡혈'); const one=o.hp-hp0; assert.equal(one,Math.round(o.max*.015));
 const q=setup(); q.o.hp=Math.round(q.o.max*.8); q.p.x=q.o.x; q.p.z=q.o.z+2; q.o.kit.target=q.p.id; q.o.kit.pattern='flurry'; q.f.tickBosses(1800); const s2=q.o.kit.startedAt, h2=q.o.hp;
 q.p.dodgeUntil=s2+9999; run(q.f,s2,s2+6400,10); assert.equal(q.o.hp,h2,'다 피하면 회복 없다');
});

test('그림자 개화: 50 % 아래로 들어서면 한 번 · 원 밖(8 m 넘게)은 안전 · 그 뒤로는 고르지 않는다',()=>{
 const {f,o,p}=setup(); p.x=o.x; p.z=o.z+12; o.kit.target=p.id; f.tickBosses(1100); o.hp=Math.round(o.max*.49); o.kit.state='idle'; o.kit.endsAt=0;
 f.tickBosses(1200); assert.equal(o.kit.skill,'bloom'); const s=o.kit.startedAt, hp0=p.hp; run(f,s,s+6400,25); assert.equal(p.hp,hp0,'12 m: 원 밖은 안전');
 for(let i=0;i<40;i++){ const w=KIT.skillWeights(o,{x:o.x,z:o.z+2}); assert.equal(w.bloom||0,0); }
 const q=setup(); q.p.x=q.o.x; q.p.z=q.o.z+5; q.o.kit.target=q.p.id; q.f.tickBosses(1100); q.o.hp=Math.round(q.o.max*.49); q.o.kit.state='idle'; q.o.kit.endsAt=0; q.f.tickBosses(1200);
 q.p.hp=q.p.maxHp=1e9; const before=q.p.hp; run(q.f,q.o.kit.startedAt,q.o.kit.startedAt+3500,25); assert.ok(q.p.hp<before,'5 m: 원 안은 맞는다');
});

test('시간표: 예고(tells)는 판정보다 먼저 가장 짙어지고, 판정은 모두 기술 시간 안',()=>{
 for(const [id,s] of Object.entries(KIT.KITS.shadowfang.skills)){ for(const h of s.hits) assert.ok(h.at<s.duration,id+' '+h.at);
  for(const h of s.hits.filter(h=>!h.pool)) assert.ok(s.tells.some(t=>t.from<=h.at-100&&t.to>=h.at),id+' '+h.at+' 에 예고가 없다'); }
});

test('그림자 개화: 끝난 뒤 다시 50 % 아래에 있어도 두 번 열지 않는다 · 부활하면 다시 한 번',()=>{
 const {f,o,p}=setup(); p.x=o.x; p.z=o.z+12; o.kit.target=p.id; f.tickBosses(1100); o.hp=Math.round(o.max*.49); o.kit.state='idle'; o.kit.endsAt=0;
 f.tickBosses(1200); assert.equal(o.kit.skill,'bloom'); p.hp=p.maxHp=1e9; const seen=[]; for(let t=1250;t<40000;t+=50){ f.tickBosses(t); if(o.kit.state==='skill'&&o.kit.startedAt===t) seen.push(o.kit.skill); }
 assert.equal(seen.filter(s=>s==='bloom').length,0,'두 번째 개화 '+seen.join(','));
 KIT.reset(o,50000); assert.equal(o.kit.opened,false);
});

test('그림자 난무: 세트 사이 «숨» 에 옆으로 돌아가면 다음 세트는 그쪽을 향한다 (세트마다 다시 잡는다)',()=>{
 const {f,o,p}=setup(); p.x=o.x; p.z=o.z+2; o.kit.target=p.id; o.kit.pattern='flurry'; f.tickBosses(1800); const s=o.kit.startedAt; p.hp=p.maxHp=1e9;
 run(f,s,s+1900,10); const y1=o.yaw; p.x=o.x+2.2; p.z=o.z; run(f,s+1910,s+2600,10);
 assert.ok(Math.abs(Math.atan2(Math.sin(o.yaw-y1),Math.cos(o.yaw-y1)))>1.2,'옆으로 돈다 '+y1.toFixed(2)+'→'+o.yaw.toFixed(2));
});
