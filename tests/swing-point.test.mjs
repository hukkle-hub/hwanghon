import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import vm from 'node:vm';
const require=createRequire(import.meta.url);
require('../js/swing-body.js');
require('../js/contact-feel.js');
require('../js/combat-quality.js');
const SP=require('../js/swing-point.js');
const ctx={window:{}};
for(const f of ['world','dungeons','dungeon','dungeon-content'])
  vm.runInNewContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx,{filename:f});
const {RULES,ARENAS,SKILLS}=ctx.window.TW_DUNGEONS, CHAR=ctx.window.TW_WORLD.CHARS.ain;
const {createBattle}=require('../js/combat.js');
const cp=x=>JSON.parse(JSON.stringify(x));

/* 스매시 «타점» — 디렉터: 「스매쉬의 속도도 처음과 중간 마지막이 달라야하고.
   그 지점에 따라 데미지도 달라야하지」. docs/design/73-smash-tempo.md */

test('SPEED 표가 실제 세 박자 곡선과 어긋나지 않는다 — 템포를 바꾸면 표도 다시 뽑아라', async ()=>{
  globalThis.TW_COMBAT_QUALITY=globalThis.TW_COMBAT_QUALITY||{phase:a=>a};
  const {ainPathDir}=await import('../js/ain-two-hand.js');
  const rate=u=>{const h=.002,a=ainPathDir('smash',Math.max(0,u-h)),b=ainPathDir('smash',Math.min(1,u+h));
    return Math.acos(Math.max(-1,Math.min(1,a.dot(b))))/(2*h);};
  const live=SP.SPEED.smash.map(([u])=>rate(u)), mx=Math.max(...live);
  SP.SPEED.smash.forEach(([u,v],i)=>{
    assert.ok(Math.abs(live[i]/mx-v)<0.03, `u=${u}: 표 ${v} vs 실제 ${(live[i]/mx).toFixed(3)} — node tools/3d/swing-speed-table.mjs 로 다시 뽑아라`);
  });
});

test('처음·정타·끝 — 머리 위는 처음(느림), 몸통은 정타, 아주 낮으면 물린 뒤', ()=>{
  const at=(y,reach)=>SP.point('smash',{y,reach,range:1.5});
  assert.equal(at(3.6,1.5).phase,'early'); assert.equal(at(2.3,1.5).phase,'sweet'); assert.equal(at(0.6,1.5).phase,'late');
  assert.ok(at(2.3,1.5).mult>at(3.6,1.5).mult+0.25, '몸통 정타가 머리 스침보다 확실히 세다');
  assert.ok(at(2.3,1.5).mult>at(0.6,1.5).mult+0.2, '몸통 정타가 물린 뒤보다 세다');
  assert.equal(at(2.3,1.5).grade,'sweet'); assert.equal(at(3.66,.3).grade,'glance');
});

test('날의 어디로 맞았나 — 붙으면 자루, 사거리 끝이면 날끝 (선속도 = 각속도 × 반지름)', ()=>{
  let prev=0;
  for(const d of [0,.3,.6,.9,1.2,1.5]){ const m=SP.point('smash',{y:2.3,reach:d,range:1.5}).mult;
    assert.ok(m>=prev-1e-9, '멀어질수록 세거나 같아야 한다'); prev=m; }
  const lo=SP.point('smash',{y:3.66,reach:0,range:1.5}).mult, hi=SP.point('smash',{y:2.3,reach:1.5,range:1.5}).mult;
  assert.ok(lo>=0.70-1e-9 && hi<=1.15+1e-9, `배율 범위 0.70~1.15 (${lo}~${hi})`);
});

test('스매시에만 걸린다 — 평타·반격·기하 없는 판정은 배율 1', ()=>{
  assert.equal(SP.point('attack1',{y:2.3,reach:1.5,range:1.5}),null);
  assert.equal(SP.point('smash',null),null);
});

/* 실제 전투 엔진을 통과시켜 본다: 같은 씨앗, 같은 스매시, 다른 «자리» */
function smashWith(contact){
  const r=cp(RULES); r.bleed.chance=0;
  const b=createBattle({rules:r, dummy:cp(ARENAS.tutorial.stages[0]),
    char:{...CHAR,stats:{...CHAR.stats,crit:0,aspd:100}},
    hooks:{canHit:()=>contact}, skills:SKILLS.ain, ult:SKILLS.ainUlt, seed:7});
  b.input('smash');
  for(let i=0;i<500;i++){ b.tick(.01); for(const e of b.drain()) if(e.t==='hit') return e; }
  return null;
}
test('전투 엔진: 같은 스매시라도 날끝 정타가 머리 스침보다 세고, 기하가 없으면 예전과 같다', ()=>{
  const sweet=smashWith({x:0,y:2.3,z:0,part:'body',reach:1.5,range:1.5});
  const glance=smashWith({x:0,y:3.66,z:0,part:'body',reach:0.2,range:1.5});
  const plain=smashWith(true);
  assert.ok(sweet&&glance&&plain, '세 번 다 맞아야 한다');
  assert.equal(sweet.point.grade,'sweet'); assert.equal(glance.point.grade,'glance'); assert.equal(plain.point,null);
  assert.ok(Math.abs(sweet.dmg/plain.dmg-sweet.point.mult)<0.03, `정타 배율이 피해에 그대로 (${sweet.dmg}/${plain.dmg})`);
  assert.ok(glance.dmg<plain.dmg && sweet.dmg>plain.dmg);
});
