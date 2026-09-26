/* 연출 감독 (docs/design/102·103) — 박자·예산·강도·우선순위 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCineDirector,BEATS,MODES,BUDGET} from '../js/cine-director.js';

const run=(d,sec,fighting=true)=>{ let o; for(let t=0;t<sec;t+=1/60) o=d.update(1/60,fighting); return o; };

test('L1 beats: every beat is L1, never takes control, and fades back to zero',()=>{
  for(const [id,b] of Object.entries(BEATS)){
    assert.equal(b.tier,'L1',id);
    const d=createCineDirector(); const r=d.trigger(id,{at:{x:0,y:1,z:0}});
    assert.ok(r,`${id} 재생`); assert.equal(d.lostRatio,0,`${id}: L1 은 조작을 뺏지 않는다`);
    let peak=0; for(let t=0;t<b.dur;t+=1/60){ const o=d.update(1/60,true); peak=Math.max(peak,Math.abs(o.push)+Math.abs(o.fov)+o.desat+o.dip); }
    assert.ok(peak>0,`${id}: 뭔가 보인다`);
    const o=run(d,0.1); assert.equal(o.active,null); assert.equal(o.push+o.fov+o.desat+o.dip+o.flash,0,`${id}: 끝나면 원래대로`);
  }
});

test('clash is the strongest moment: longest slow, biggest push, deepest desaturation',()=>{
  const peak=id=>{ const d=createCineDirector(); const r=d.trigger(id,{}); let m={push:0,desat:0}; for(let t=0;t<BEATS[id].dur;t+=1/60){ const o=d.update(1/60,true); m.push=Math.max(m.push,o.push); m.desat=Math.max(m.desat,o.desat); } return {...m,slow:r.slow.scale,ms:r.slow.ms}; };
  const c=peak('clash'),r=peak('repel'),f=peak('deflect');
  assert.ok(c.slow<r.slow&&r.slow<f.slow,'맞대기 < 튕김 < 흘림 (시간 배율)');
  assert.ok(c.ms>r.ms&&r.ms>f.ms); assert.ok(c.push>r.push&&r.push>f.push); assert.ok(c.desat>r.desat);
});

test('modes: off plays nothing, minimal is weaker than normal, cinema is stronger',()=>{
  const off=createCineDirector({mode:'off'}); assert.equal(off.trigger('clash',{}),null);
  const sl=m=>createCineDirector({mode:m}).trigger('clash',{}).slow.scale;
  assert.ok(sl('minimal')>sl('normal'),'최소는 덜 느려진다');
  assert.ok(sl('cinema')<=sl('normal'));
  assert.deepEqual(MODES.minimal.tiers,['L1']);
});

test('priority and spacing: a weaker beat does not cut a strong one; the same beat is not re-fired within 0.12 s',()=>{
  const d=createCineDirector(); d.trigger('clash',{}); run(d,0.1);
  assert.equal(d.trigger('deflect',{}),null,'맞대기 도중 흘림은 생략');
  run(d,BEATS.clash.dur); assert.ok(d.trigger('deflect',{}),'끝나면 받는다');
  assert.equal(d.trigger('deflect',{}),null,'같은 박자 연타는 간격 안에서 생략');
  run(d,BUDGET.l1Gap+0.02); assert.ok(d.trigger('deflect',{}));
  const log=d.log; assert.ok(log.some(l=>l.why==='busy')&&log.some(l=>l.why==='gap'));
});
