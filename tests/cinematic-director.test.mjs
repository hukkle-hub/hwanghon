/* Cinematic Director L1 ↔ HUD 계약 (docs/design/103-cinematic-combat-hud.md)
 *   - 판정 확정 뒤 tw:cinematic {id,tier,duration}, 끝·취소 때 tw:cinematic:end
 *   - L1 은 조작을 안 뺏고, 판정 전에 슬로를 걸지 않는다(update 는 시간 배율을 내지 않는다)
 *   - 카메라 15~25% 밀착, 화각 -4° 뒤 0.3 초 안에 복귀
 *   - L2·L3 는 훅만 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCineDirector,BEATS,FOV_BACK} from '../js/cine-director.js';

const L1=['deflect','repel','clash','perfectDodge','comboFinish'];
const L2=['execute','ult','poiseBreak','bossBigTellCinematic'];
const HOOKS=['bossBigTellCinematic','bossIntro','phase','victory'];
const L3=['bossIntro','phase','victory'];
const mk=(mode)=>{ const ev=[]; const d=createCineDirector({ mode, emit:(n,detail)=>ev.push({n,detail}) }); return {d,ev}; };
const step=(d,sec)=>{ let o; for(let t=0;t<sec-1e-9;t+=1/120) o=d.update(1/120,true); return o; };

test('every L1 judgement emits tw:cinematic after the trigger, with id/tier/duration in ms',()=>{
  for(const id of L1){
    const {d,ev}=mk('normal'); assert.equal(ev.length,0,'부르기 전엔 아무것도 안 낸다');
    const r=d.trigger(id,{at:{x:0,y:1,z:0}}); assert.ok(r);
    assert.equal(ev.length,1); assert.equal(ev[0].n,'tw:cinematic');
    assert.deepEqual(ev[0].detail,{ id, tier:'L1', duration:Math.round(BEATS[id].dur*1000) });
    assert.ok(ev[0].detail.duration>=200&&ev[0].detail.duration<=800,`${id}: L1 은 0.2~0.8 초`);
  }
});

test('L1 never takes control and never slows time before a judgement: only trigger() returns a slow, update() does not',()=>{
  const {d}=mk('normal');
  const o0=d.update(1/60,true); assert.ok(!('slow' in o0)&&!('timeScale' in o0),'프레임 출력엔 시간 배율이 없다');
  const r=d.trigger('clash',{}); assert.ok(r.slow&&r.slow.scale<1,'판정 뒤 돌려주는 값에만 슬로가 있다');
  assert.equal(d.lostRatio,0); step(d,BEATS.clash.dur+0.1); assert.equal(d.lostRatio,0,'L1 은 조작 뺏김 예산을 쓰지 않는다');
});

test('camera: L1 push peaks at 12~25 % (clash 후보 0.18, 나머지는 비례) and fov dips ~-4° then returns within 0.3 s',()=>{
  for(const id of L1){
    const {d}=mk('normal'); d.trigger(id,{}); let push=0, fovMin=0, tPeak=0, t=0, backAt=null;
    for(;t<BEATS[id].dur;t+=1/120){ const o=d.update(1/120,true); if(Math.abs(o.push)>push) push=Math.abs(o.push); if(o.fov<fovMin){ fovMin=o.fov; tPeak=t; } if(backAt===null&&t>tPeak&&fovMin<-3.9&&o.fov>-0.01) backAt=t; }
    assert.ok(push>=0.12-1e-6&&push<=0.25+1e-6,`${id}: 밀착 ${push.toFixed(3)} (12~25 %)`);
    assert.ok(fovMin<=-3.9,`${id}: 화각 ${fovMin.toFixed(2)}°`);
    assert.ok(backAt!==null&&backAt-tPeak<=FOV_BACK+0.02,`${id}: 화각 복귀 ${backAt===null?'없음':(backAt-tPeak).toFixed(2)+' s'}`);
  }
});

test('tw:cinematic:end is emitted when a beat finishes, is cancelled, or the director resets',()=>{
  const a=mk('normal'); a.d.trigger('repel',{}); step(a.d,BEATS.repel.dur+0.05);
  assert.deepEqual(a.ev.map(e=>e.n),['tw:cinematic','tw:cinematic:end'],'자연 종료');
  const b=mk('normal'); b.d.trigger('clash',{}); step(b.d,0.1); b.d.cancel(); assert.equal(b.ev.at(-1).n,'tw:cinematic:end','취소');
  assert.equal(b.d.active,null); assert.equal(b.d.out.push,0);
  b.d.cancel(); assert.equal(b.ev.filter(e=>e.n==='tw:cinematic:end').length,1,'도는 게 없으면 end 를 또 내지 않는다');
  const c=mk('normal'); c.d.trigger('deflect',{}); c.d.reset(); assert.equal(c.ev.at(-1).n,'tw:cinematic:end','전투 종료(reset)');
});

test('L2/L3 hooks: right tier, given duration, and they mirror existing cuts regardless of mode; L1 is skipped inside a cut',()=>{
  for(const id of L2) assert.equal(BEATS[id].tier,'L2',id);
  for(const id of L3) assert.equal(BEATS[id].tier,'L3',id);
  for(const id of HOOKS) assert.ok(BEATS[id].hook&&!BEATS[id].cam&&!BEATS[id].slow,`${id}: 훅만 — 카메라·시간은 아직 없다`);
  const {d,ev}=mk('off'); const h=d.hook('bossBigTellCinematic',0.8);
  assert.deepEqual(h,{ id:'bossBigTellCinematic', tier:'L2', duration:800 });
  assert.deepEqual(ev[0],{ n:'tw:cinematic', detail:{ id:'bossBigTellCinematic', tier:'L1', duration:800, keepInput:true } },'큰 기술 예고: 입력 유지 → HUD 엔 L1(조작 UI 유지)');
  assert.ok(d.trigger('clash',{})===null,'off 모드'); const kk=mk('normal'); kk.d.hook('bossBigTellCinematic',0.8); assert.ok(kk.d.trigger('deflect',{}),'입력 유지 훅은 L1 을 막지 않는다');
  const {d:d2,ev:ev2}=mk('normal'); d2.hook('phase',undefined,{ phase:2, title:'눈뜬 허수아비', subtitle:'핵이 타오른다' }); assert.equal(ev2[0].detail.duration,Math.round(BEATS.phase.dur*1000),'길이 생략 시 표 값');
  assert.deepEqual(ev2[0].detail,{ id:'phase', tier:'L3', duration:2850, phase:2, title:'눈뜬 허수아비', subtitle:'핵이 타오른다' },'L3 장면 제목을 detail 에 싣는다(105)');
  assert.equal(d2.trigger('clash',{}),null,'컷 도중 L1 은 생략'); assert.equal(d2.log.at(-1).why,'cut');
  step(d2,BEATS.phase.dur+0.05); assert.ok(d2.trigger('clash',{}),'컷이 끝나면 받는다');
  d2.cancel(); assert.equal(ev2.at(-1).n,'tw:cinematic:end');
  assert.equal(d2.trigger('bossIntro',{dur:4.2}).tier,'L3','trigger 로 불러도 훅으로 간다');
});

test('game3d wiring: events are dispatched on window and beats fire after the judgement cases',()=>{
  const js=fs.readFileSync(new URL('../js/game3d.js', import.meta.url),'utf8');
  assert.match(js,/createCineDirector\(\{ mode:SET\.cine\|\|'normal', emit:function\(name, detail\)\{ try\{ window\.dispatchEvent\(new CustomEvent\(name, \{ detail:detail \}\)\)/);
  const at=s=>{ const i=js.indexOf(s); assert.ok(i>=0,`missing ${s}`); return i; };
  assert.ok(at("case 'counter':")<at("cineBeat(cTier, cAt, 1)"),'카운터 판정(counter 이벤트) 뒤에 박자');
  assert.ok(at("function perfectDodge")<at("cineBeat('perfectDodge'"));
  at("cineBeat('comboFinish'");
  for(const h of ["CINE.hook('execute'","CINE.hook('ult'","CINE.hook('bossIntro', 4.2, { title:","CINE.hook('phase', 2.85, { phase:next+1, title:","CINE.hook('victory', 1.5, { title:","l2Cut('execute')"]) at(h);
  assert.ok(js.split('CINE.cancel()').length-1>=3,'컷 끝(등장·페이즈)·사망에서 end 를 낸다');
  assert.ok(!/battle\.input\([^)]*\)\s*;?\s*[^\n]*cineBeat/.test(js),'박자가 입력을 대신 넣지 않는다');
});
