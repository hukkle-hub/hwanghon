/* L2 흐름 컷 (docs/design/102 §3, 디렉터 규칙)
 *   - 벽/보스 몸에 막히지 않는 2~3 후보 중 선택(chooseShot), 없으면 null(예전 고정 컷)
 *   - 1.0~2.2 초 · 조작 상실 8% 이내 · 20 초 내 중복 금지 · 조작을 뺏는 동안 무적(invuln 플래그를 game3d 가 훅으로 적용)
 *   - HUD 에 tw:cinematic {tier:'L2', id:'execute'|'ult'|'poiseBreak', duration}
 *   - 피해·판정·회피 무적·이동 거리 값은 건드리지 않는다(game3d 는 훅·카메라만) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCineDirector,BEATS,BUDGET,L2_RULES,chooseShot} from '../js/cine-director.js';

const L2=['execute','ult','poiseBreak'];
const mk=(mode='normal')=>{ const ev=[]; const d=createCineDirector({ mode, emit:(n,detail)=>ev.push({n,detail}) }); return {d,ev}; };
const step=(d,sec,fighting=true)=>{ for(let t=0;t<sec-1e-9;t+=1/60) d.update(1/60,fighting); };
const ctx=(free)=>({ bx:0, bz:0, px:0, pz:2.5, headY:2.2, free });

test('every L2 beat has 2~3 shot candidates and a 1.0~2.2 s length with fly-in/out inside it',()=>{
  for(const id of L2){ const b=BEATS[id]; assert.equal(b.tier,'L2',id);
    assert.ok(b.shots.length>=2&&b.shots.length<=3,`${id}: 후보 ${b.shots.length}`);
    assert.ok(b.dur>=L2_RULES.minDur&&b.dur<=L2_RULES.maxDur,`${id}: ${b.dur} s`);
    assert.ok(b.inDur+b.outDur<b.dur,`${id}: 들어감+복귀 < 길이`); }
  assert.equal(BEATS.poiseBreak.hold,true,'자세 붕괴는 전투 시계를 멈춘다(처형 창 보존)'); assert.equal(BEATS.execute.hold,false);
});

test('chooseShot: first clear candidate wins, blocked ones are skipped, all blocked → null; positions are boss-relative',()=>{
  const shots=BEATS.execute.shots;
  const a=chooseShot(shots,ctx(()=>true)); assert.equal(a.name,shots[0].name);
  assert.ok(Math.abs(Math.hypot(a.pos.x,a.pos.z)-shots[0].dist)<1e-9,'보스에서의 거리'); assert.equal(a.pos.y,shots[0].h);
  assert.ok(a.look.z>0&&a.look.z<2.5,'mid 는 플레이어·보스 사이');
  const seen=[]; const b=chooseShot(shots,ctx((pos)=>{ seen.push(pos); return seen.length>=2; })); assert.equal(b.name,shots[1].name,'첫 후보가 막히면 둘째');
  assert.equal(chooseShot(shots,ctx(()=>false)),null,'다 막히면 null');
  const l=chooseShot(shots,{ bx:5, bz:5, px:5, pz:8, free:()=>true }); assert.ok(Math.abs(Math.hypot(l.pos.x-5,l.pos.z-5)-shots[0].dist)<1e-9,'보스 위치를 따라간다');
  /* 플레이어가 보스의 -z 쪽이면 후보도 같이 돈다(«보스→플레이어» 축 기준) */
  const r1=chooseShot([{name:'x',ang:0,dist:3,h:1,look:'boss'}],{ bx:0,bz:0,px:0,pz:3,free:()=>true }), r2=chooseShot([{name:'x',ang:0,dist:3,h:1,look:'boss'}],{ bx:0,bz:0,px:0,pz:-3,free:()=>true });
  assert.ok(r1.pos.z>0&&r2.pos.z<0);
});

test('trigger: L2 emits tw:cinematic {tier:L2,id,duration}, returns the chosen shot with in/out, invuln, hold; end is emitted when it finishes',()=>{
  const {d,ev}=mk(); step(d,30);
  const r=d.trigger('execute',{ pick:shots=>chooseShot(shots,ctx(()=>true)) });
  assert.ok(r&&r.shot&&r.shot.pos&&r.shot.look); assert.equal(r.shot.inDur,BEATS.execute.inDur); assert.equal(r.invuln,true); assert.equal(r.hold,false); assert.equal(r.dur,1.7);
  assert.deepEqual(ev.at(-1),{ n:'tw:cinematic', detail:{ id:'execute', tier:'L2', duration:1700 } });
  const o=d.update(1/60,true); assert.equal(o.tier,'L2'); assert.equal(o.push,0,'L2 는 카메라 밀착값을 내지 않는다(비행은 game3d)');
  step(d,1.75); assert.equal(ev.at(-1).n,'tw:cinematic:end'); assert.equal(d.active,null);
  const p=mk(); step(p.d,30); assert.equal(p.d.trigger('poiseBreakCinematic',{ pick:s=>chooseShot(s,ctx(()=>true)) }).hold,true,'옛 이름 별칭'); assert.equal(p.ev.at(-1).detail.id,'poiseBreak','HUD 에는 poiseBreak');
});

test('rules: no shot → null (old fixed cut), 20 s gap, 8 % lost-time budget, minimal/off modes play no L2, L1 is skipped inside an L2 cut',()=>{
  const {d}=mk(); step(d,30);
  assert.equal(d.trigger('execute',{ pick:()=>null }),null,'후보가 다 막히면 안 논다'); assert.equal(d.log.at(-1).why,'blocked');
  assert.ok(d.trigger('execute',{ pick:s=>chooseShot(s,ctx(()=>true)) }));
  assert.equal(d.trigger('deflect',{}),null,'L2 중 L1 생략'); assert.equal(d.log.at(-1).why,'cut');
  step(d,2); assert.equal(d.trigger('ult',{ pick:s=>chooseShot(s,ctx(()=>true)) }),null,'20 초 안 중복 금지'); assert.equal(d.log.at(-1).why,'l2gap');
  step(d,BUDGET.l2Gap+0.1); assert.ok(d.trigger('ult',{ pick:s=>chooseShot(s,ctx(()=>true)) }),'20 초 지나면 된다 (52 초 싸움에 2.9 초 = 5.6 %)');
  /* 예산: 전투 시간은 52 초 그대로(전투 밖에서 20 초), 다음 1.7 초는 (2.9+1.7)/52 = 8.8 % > 8 % → 거절 */
  step(d,BUDGET.l2Gap+0.1,false); assert.equal(d.trigger('execute',{ pick:s=>chooseShot(s,ctx(()=>true)) }),null); assert.equal(d.log.at(-1).why,'budget');
  assert.ok(d.lostRatio<=BUDGET.lostMax,`뺏긴 시간 ${d.lostRatio.toFixed(3)}`);
  step(d,40); assert.ok(d.trigger('execute',{ pick:s=>chooseShot(s,ctx(()=>true)) }),'싸움이 길어지면(92 초) 다시 예산이 생긴다'); assert.ok(d.lostRatio<=BUDGET.lostMax);
  for(const m of ['minimal','off']){ const x=mk(m); step(x.d,30); assert.equal(x.d.trigger('execute',{ pick:s=>chooseShot(s,ctx(()=>true)) }),null,m); }
});

test('game3d wiring: l2Cut on execute/ult/downed, invulnerability via the inZone hook, battle clock hold, zone dim 45~55 %, combat numbers untouched',()=>{
  const js=fs.readFileSync(new URL('../js/game3d.js', import.meta.url),'utf8');
  for(const s of ["l2Cut('execute')","l2Cut('ult')","l2Cut('poiseBreak')","!l2Invuln&&!!zone&&world.inZone","if(battle&&!cineHold)","cine=true; l2Invuln=true; cineHold=!!r.hold","back:true"]) assert.ok(js.includes(s),`missing ${s}`);
  const dim=+(js.match(/ZONE_DIM=([0-9.]+)/)||[])[1]; assert.ok(dim>=0.45&&dim<=0.55,`ZONE_DIM ${dim}`);
  assert.ok(/CINE\.out\.tier==='L1'\?ZONE_DIM:1/.test(js),'표식 감쇠는 L1 연출 중에만'); assert.ok(js.includes("m.material.opacity=(m.userData.op||m.material.opacity)*dim"),'표식은 남고 강도만 낮춘다');
  assert.ok(!/l2Invuln[^\n]*R\.dodge|R\.dodge[^\n]*l2Invuln/.test(js),'회피 무적 값은 건드리지 않는다');
  const combat=fs.readFileSync(new URL('../js/combat.js', import.meta.url),'utf8'); assert.ok(!/cine|L2|invuln/i.test(combat.replace(/\/\*[\s\S]*?\*\//g,'')),'combat.js 에 연출 코드가 없다');
});
