/* 스킬 모션 이벤트 (docs/design/89) — 20종 계약 · 다단 접점 · 투척 → 폭발 · 회복 결계 · 파괴/자세 특화.
   솔로(js/combat.js)와 온라인(server/raid.cjs)이 같은 사건표를 쓰는지까지 본다. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};
for(const f of ['world','dungeons'])vm.runInNewContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx,{filename:f});
const {RULES,ARENAS,SKILLS}=ctx.window.TW_DUNGEONS;
const SE=require('../js/skill-events.js');
const {createBattle}=require('../js/combat.js');
const copy=x=>JSON.parse(JSON.stringify(x));
const CHARS=['ain','kain','ryu','sera'];

function solo(id,{skills,player,parts}={}){
  const r=copy(RULES);r.bleed.chance=0;
  const d=Object.assign(copy(ARENAS.tutorial.stages[0]),{patterns:[]});if(parts)d.parts=parts;
  const C=ctx.window.TW_WORLD.CHARS[id];
  return createBattle({rules:r,dummy:d,char:{...C,stats:{...C.stats,crit:0,aspd:100}},hooks:{},skills:skills||SKILLS[id],ult:SKILLS[id+'Ult'],player,seed:7});
}
function run(b,sec){const out=[];for(let i=0;i<Math.round(sec*100);i++){b.tick(.01);out.push(...b.drain());}return out;}

test('20종 스킬 모두 모션 이벤트 계약이 있다 (가중치 합 1, 클립 범위 안)',()=>{
  let n=0;
  for(const c of CHARS){for(const k of [...SKILLS[c],SKILLS[c+'Ult']]){assert.equal(SE.validate(k),null,`${c}/${k.id}: ${SE.validate(k)}`);n++;}}
  assert.equal(n,20);
});

test('다단 스킬은 총 배율을 나눠 맞는다 — 류 쌍날 난무 3타 · 붉은 그림자 5타 · 회전 2타',()=>{
  const expect={ryu:{0:3,2:3,ult:5},ain:{2:2},kain:{2:2,ult:2}};
  for(const [c,m] of Object.entries(expect))for(const [slot,hits] of Object.entries(m)){
    const b=solo(c,{player:{ult:100}});if(slot==='ult')b.input('ult');else b.input('skill',+slot);
    const ev=b.drain().concat(run(b,3));
    const imp=ev.filter(e=>e.t==='impact');
    assert.equal(imp.length,hits,`${c}/${slot}: 타격 ${imp.length}번`);
    assert.deepEqual(imp.map(e=>e.seq),Array.from({length:hits},(_,i)=>i+1));
    for(let i=1;i<imp.length;i++)assert.ok(imp[i].time>imp[i-1].time,'시간 순서');
  }
});

test('나눠 맞아도 총 피해는 한 번에 맞을 때와 같다 (±5%, 분산 0.95~1.05)',()=>{
  const single=SKILLS.ryu.map(k=>k.id==='fan'?{...k,ev:{type:'hit',hits:[[.65,1]]}}:k);
  const a=solo('ryu'),b=solo('ryu',{skills:single});
  a.input('skill',0);b.input('skill',0);run(a,3);run(b,3);
  const da=a.metrics.dmg,db=b.metrics.dmg;assert.ok(da>0&&db>0);
  assert.ok(Math.abs(da-db)/db<.05,`3타 ${da} vs 1타 ${db}`);
});

test('세라 부식 시약: 손을 떠난 뒤(release) 날아가서 터질 때(detonate) 피해가 난다',()=>{
  const b=solo('sera');b.input('skill',0);const ev=run(b,3);
  const rel=ev.find(e=>e.t==='release'),det=ev.find(e=>e.t==='detonate'),hit=ev.find(e=>e.t==='hit');
  assert.ok(rel&&det&&hit,'release · detonate · hit 모두');
  assert.ok(det.time-rel.time>=.27&&det.time-rel.time<=.30,`비행 ${(det.time-rel.time).toFixed(3)}초`);
  assert.ok(hit.time>=rel.time+.27,'피해는 폭발 때');
  /* 던지고 바로 굴러도 병은 날아간다 */
  const c=solo('sera');c.input('skill',0);const pre=run(c,1.2);assert.ok(pre.some(e=>e.t==='release'));c.input('dodge');const post=run(c,1);
  assert.ok(pre.concat(post).some(e=>e.t==='detonate'));
});

test('세라 연쇄 폭발: 투척 한 번에 폭발 두 번',()=>{
  const b=solo('sera');b.input('skill',2);const ev=run(b,3);
  assert.equal(ev.filter(e=>e.t==='release').length,1);assert.equal(ev.filter(e=>e.t==='detonate').length,2);
});

test('세라 회복 결계: 체력을 15% 채우고 방어 버프를 건다 (최대치를 넘지 않는다)',()=>{
  const C=ctx.window.TW_WORLD.CHARS.sera,max=C.stats.hp;
  const b=solo('sera',{player:{hp:Math.round(max*.5)}});b.input('skill',3);const ev=b.drain();
  const heal=ev.find(e=>e.t==='heal');assert.ok(heal);assert.equal(heal.amount,Math.round(max*.15));
  assert.equal(b.snapshot().player.hp,Math.round(max*.5)+heal.amount);
  const full=solo('sera');full.input('skill',3);assert.equal(full.drain().find(e=>e.t==='heal').amount,0);
});

test('카인 대검 내려치기는 부위 파괴 피해 ×1.5, 지면 강타는 자세 +30',()=>{
  const parts=copy(ARENAS.tutorial.stages[1].parts);const bk=parts.find(p=>p.breakable);
  const noBonus=SKILLS.kain.map(k=>k.id==='cleave'?{...k,breakMult:undefined}:k);
  const a=solo('kain',{parts:copy(parts)}),b=solo('kain',{parts:copy(parts),skills:noBonus});
  a.input('target',bk.id);b.input('target',bk.id);a.input('skill',0);b.input('skill',0);run(a,3);run(b,3);
  const pa=a.snapshot().enemy.parts.find(p=>p.id===bk.id),pb=b.snapshot().enemy.parts.find(p=>p.id===bk.id);
  const lostA=pa.hpMax-pa.hp,lostB=pb.hpMax-pb.hp;assert.ok(lostB>0);
  assert.ok(Math.abs(lostA/lostB-1.5)<.08,`파괴 피해 비 ${(lostA/lostB).toFixed(2)}`);
  const s=solo('kain');s.input('skill',3);run(s,3);assert.ok(s.snapshot().enemy.posture>=30,`자세 ${s.snapshot().enemy.posture}`);
});

test('온라인도 같은 사건표: 류 난무 3타, 세라 시약 release → detonate',()=>{
  const {Raid}=require('../server/raid.cjs');
  const tick=(r,t)=>{for(let i=0;i<Math.round(t*100);i++)r.tick(.01);};
  const make=ch=>{const r=new Raid('d01',[{id:'a',name:'A',character:ch,skills:{skills:SKILLS[ch],ult:SKILLS[ch+'Ult']}}]);r.startFight();const p=r.players.get('a');p.x=r.boss.x-110;p.y=r.boss.y;p.target='body';p.st=120;r.boss.state='idle';r.boss.timer=99;return r;};
  const r=make('ryu');r.input('a',{type:'skill',index:0});tick(r,2.5);
  assert.equal(r.events.filter(e=>e.type==='hit'&&e.player==='a').length,3,'류 3타');
  const s=make('sera');s.input('a',{type:'skill',index:0});tick(s,2.5);
  const types=s.events.map(e=>e.type);assert.ok(types.includes('release')&&types.includes('detonate'),types.join(','));
  assert.ok(types.indexOf('detonate')<types.lastIndexOf('hit'));
});
