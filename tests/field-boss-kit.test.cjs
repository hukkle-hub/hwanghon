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

/* ---------- 실험체 09호 (판교 연구소) ---------- */
function setup09(rng=.5){ const f=new Field({rng:()=>.5}),P=profile(); f.initBosses(0); const o=f.bosses.get('subject09'); f.spawnBoss(o,1000); f.rng=()=>rng;
 const p=f.join('p',P,'pangyo_lab'); p.invulnUntil=0; p.at=1000; p.hp=p.maxHp=1e9; return {f,o,p,P}; }
test('09호 폭주 연타: 빠른 2타 → 멈춤 → 무거운 3타 · «리듬 깨기» 로 멈춤 뒤 박자만 0/0.2/0.4 s 밀리고 반격창도 같이 민다',()=>{
 for(const [rng,shift] of [[.1,0],[.5,200],[.9,400]]){ const {f,o,p}=setup09(rng); p.x=o.x; p.z=o.z+2.5; o.kit.target=p.id; f.tickBosses(1800);
  assert.equal(o.kit.skill,'frenzy'); assert.equal(o.kit.shift,shift); const s=o.kit.startedAt, hits=[]; let last=p.hp;
  for(let t=s;t<=s+4500;t+=10){ f.tickBosses(t); if(p.hp<last){ hits.push(t-s); last=p.hp; } }
  assert.deepEqual(hits,[550,850,1950+shift,2200+shift,2500+shift],'shift '+shift);
  }
 const {f,o,p}=setup09(.9); p.x=o.x; p.z=o.z+2.5; o.kit.target=p.id; f.tickBosses(1800); const s=o.kit.startedAt;
 const v=KIT.view(o); assert.equal(v.shift,400); assert.equal(v.counterOpen,s+2250+400);
 assert.equal(KIT.tryCounter(o,s+2300),false,'밀리지 않은 박자로는 반격 못 한다'); assert.equal(KIT.tryCounter(o,s+2700),true);
});
test('09호 방전 폭우: 50 % 아래로 들어서면 한 번 · 낙뢰는 1.2 s 전 «대상 자리» 에 찍힌다 — 찍힌 뒤 비키면 안 맞고, 서 있으면 맞는다',()=>{
 const {f,o,p}=setup09(); p.x=o.x; p.z=o.z+8; o.kit.target=p.id; f.tickBosses(1100); o.hp=Math.round(o.max*.49); o.kit.state='idle'; o.kit.endsAt=0;
 f.tickBosses(1200); assert.equal(o.kit.skill,'storm'); const s=o.kit.startedAt, hp0=p.hp;
 for(let t=s;t<=s+1650;t+=25) f.tickBosses(t); const v=KIT.view(o); assert.deepEqual(v.marks[0],[+p.x.toFixed(2),+p.z.toFixed(2)],'첫 표식은 그때의 내 자리');
 p.x+=3; for(let t=s+1675;t<=s+2850;t+=25) f.tickBosses(t); assert.equal(p.hp,hp0,'비키면 첫 낙뢰를 피한다');
 const q=setup09(); q.p.x=q.o.x; q.p.z=q.o.z+8; q.o.kit.target=q.p.id; q.f.tickBosses(1100); q.o.hp=Math.round(q.o.max*.49); q.o.kit.state='idle'; q.o.kit.endsAt=0; q.f.tickBosses(1200);
 let n=0,last=q.p.hp; for(let t=q.o.kit.startedAt;t<=q.o.kit.startedAt+5200;t+=25){ q.f.tickBosses(t); if(q.p.hp<last){ if(q.p.hurt&&q.p.hurt[3]==='storm'&&q.p.hurt[2]==='subject09') n++; last=q.p.hp; } } assert.equal(n,6,'서 있으면 여섯 발');   /* 사냥터 몬스터 타격은 빼고 센다 */
 for(let t=7000;t<40000;t+=50){ q.f.tickBosses(t); assert.ok(!(q.o.kit.state==='skill'&&q.o.kit.skill==='storm'),'두 번 열지 않는다'); }
});
test('09호 시간표: 판정마다 앞선 예고(또는 표식) · 판정은 기술 시간 안',()=>{
 const S=KIT.KITS.subject09.skills; for(const [id,s] of Object.entries(S)) for(const h of s.hits){ assert.ok(h.at+(s.jitter?400:0)<s.duration+(s.jitter?400:0),id);
  assert.ok(h.atTarget?h.lead>=1000:s.tells.some(t=>t.from<=h.at-100&&t.to>=h.at),id+' '+h.at); }
});

/* ---------- 정 장관 (고흥) ---------- */
function setupJ(){ const f=new Field({rng:()=>.5}),P=profile(); f.initBosses(0); const o=f.bosses.get('jeong'); f.spawnBoss(o,1000);
 const p=f.join('p',P,'goheung'); p.invulnUntil=0; p.at=1000; p.hp=p.maxHp=1e9; return {f,o,p,P}; }
const runTo=(f,o,skill,limit=60000)=>{ for(let t=o.kit.lastAt+50;t<limit;t+=50){ f.tickBosses(t); if(o.kit.state==='skill'&&o.kit.skill===skill&&o.kit.startedAt===t) return t; } return -1; };
test('정 장관 «외운 원»: 원은 매번 같고, 반격창은 네 번째 원에만 열린다',()=>{
 const {f,o,p}=setupJ(); p.x=o.x; p.z=o.z+2.2; o.kit.target=p.id; const opened=[];
 for(let n=0;n<4;n++){ o.kit.pattern='circle'; o.kit.state='idle'; o.kit.endsAt=0; const s=runTo(f,o,'circle'); assert.ok(s>0,'원 '+(n+1));
  const v=KIT.view(o); opened.push(v.counterOpen>0); assert.equal(KIT.tryCounter(o,s+1400),n===3,'원 '+(n+1)+' 반격'); o.kit.state='idle'; o.kit.endsAt=0; }
 assert.deepEqual(opened,[false,false,false,true]);
});
test('정 장관 «다 아는 검»: 등 뒤 3 m 안이면 돌아서지 않고 등 뒤를 친다 · 앞은 안 맞는다',()=>{
 const {f,o,p}=setupJ(); o.yaw=0; o.kit.yaw=0; p.x=o.x; p.z=o.z-2.2; o.kit.target=p.id; o.kit.state='idle'; o.kit.endsAt=0;
 const s=runTo(f,o,'back',20000); assert.ok(s>0,'등 뒤 기술'); assert.ok(Math.abs(o.yaw)<1e-6,'돌아서지 않는다');
 const hp0=p.hp; for(let t=s;t<=s+600;t+=10) f.tickBosses(t); assert.ok(p.hp<hp0,'등 뒤가 맞는다');
 const q=setupJ(); q.o.yaw=0; q.o.kit.yaw=0; q.p.x=q.o.x; q.p.z=q.o.z+2.2; q.o.kit.target=q.p.id; q.o.kit.pattern='back'; q.o.kit.state='idle'; q.o.kit.endsAt=0;
 const s2=runTo(q.f,q.o,'back',20000); const h1=q.p.hp; for(let t=s2;t<=s2+600;t+=10) q.f.tickBosses(t); assert.equal(q.p.hp,h1,'정면은 안 맞는다');
});
test('정 장관 «지휘 — 각도»: 4.2 m 밖이면 세 줄(−18°·0°·+18°) — 줄 사이는 안전 · 3합은 한 걸음씩 0.85 m 나간다',()=>{
 for(const [off,hit] of [[.32,true],[.16,false],[0,true]]){ const {f,o,p}=setupJ(); p.x=o.x+Math.sin(off)*10; p.z=o.z+Math.cos(off)*10; o.kit.target=p.id; o.kit.state='idle'; o.kit.endsAt=0;
  const s=runTo(f,o,'command',20000); assert.ok(s>0); assert.ok(Math.abs(o.yaw-off)<.02,'대상을 향한다'); o.yaw=0; o.kit.yaw=0; const hp0=p.hp; for(let t=s;t<=s+2000;t+=10) f.tickBosses(t); assert.equal(p.hp<hp0,hit,'각도 '+off); }
 const {f,o,p}=setupJ(); p.x=o.x; p.z=o.z+2.5; o.kit.target=p.id; o.kit.pattern='triple'; o.kit.state='idle'; o.kit.endsAt=0; const s=runTo(f,o,'triple',20000), z0=o.kit.fromZ;
 for(let t=s;t<=s+2000;t+=10) f.tickBosses(t); assert.equal(o.kit.state,'skill'); assert.ok(Math.abs(Math.hypot(o.x-o.kit.fromX,o.z-z0)-.85)<.02,'3합 전진 '+Math.hypot(o.x-o.kit.fromX,o.z-z0).toFixed(2));
});
