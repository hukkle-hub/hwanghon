import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCombatRulesExport} from '../tools/ue/export-combat-rules.mjs';

const X=buildCombatRulesExport();
globalThis.window=globalThis.window||globalThis;
const {createRequire}=await import('node:module'); const require=createRequire(import.meta.url);
const R=require('../js/dungeons.js').RULES;

test('UE 데이터 포팅: 기본 3 타 = 0.66 s / 접점 0.24 s (규칙값 그대로, 변경 금지)',()=>{
  for(const k of ['attack1','attack2','attack3']){ assert.equal(X.actions[k].duration,0.66); assert.equal(X.actions[k].hit,0.24); assert.equal(X.actions[k].cancel,0.48); }
  assert.equal(X.actions.smash.duration,1.15); assert.equal(X.actions.smash.hit,0.48);   /* 아인 전용 프로파일이 이긴다 */
  assert.equal(X.actions.counter.duration,R.motion.characterProfiles.ain.counter.duration);
});
test('UE 데이터 포팅: 연계·회피·점프·카운터·기력·히트스톱·자세는 RULES 객체 그대로',()=>{
  assert.deepEqual(X.combo,R.combo); assert.deepEqual(X.dodge,R.dodge); assert.deepEqual(X.jump,R.jump);
  assert.deepEqual(X.counter,R.counter); assert.deepEqual(X.stamina,R.stamina); assert.deepEqual(X.hitstop,R.hitstop);
  assert.deepEqual(X.posture,R.posture); assert.deepEqual(X.stagger,R.stagger); assert.equal(X.inputBuffer,R.motion.buffer);
});
test('UE 데이터 포팅: d01 보스 3 단계·패턴·공격 이동(m) 이 들어간다',()=>{
  assert.equal(X.boss.stages.length,3);
  const awake=X.boss.stages.find(s=>s.id==='awake'); assert.ok(awake);
  assert.ok(awake.patterns.length>=5, '깨어난 허수아비: 연타·회전·도약 내려찍기·돌진·앞차기·지면 충격파');
  const lunge=awake.patterns.find(p=>p.name==='돌진'); assert.ok(lunge, '관통 돌진(lunge) 패턴');
  assert.ok(lunge.motion && lunge.motion.distanceM>5 && lunge.motion.at>0, 'attackMotion 이 m 단위로(px÷50)');
  const shock=awake.patterns.find(p=>p.name==='지면 충격파'); assert.ok(shock, '점프로만 넘는 바닥 광역');
  for(const p of awake.patterns){ assert.ok(p.tele>0 && p.window>0, p.name+' tele/window'); assert.equal(typeof p.counterable,'boolean'); }
  assert.ok(awake.counterWindow>0 && awake.counterWindow<=0.5, '단계별 카운터 창(런타임 0.14 s)');
});
test('UE 데이터 포팅: 저장된 JSON 이 현재 규칙과 같다 (수정 뒤 node tools/ue/export-combat-rules.mjs 재실행)',()=>{
  const saved=JSON.parse(fs.readFileSync(new URL('../ue/HwanghonCombatUE/Content/Data/combat_rules.json',import.meta.url),'utf8'));
  assert.deepEqual(saved,JSON.parse(JSON.stringify(X)));
});
