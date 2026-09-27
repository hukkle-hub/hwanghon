import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTuning} from '../tools/ue/check-ue-tuning.mjs';

const rows=compareTuning();

test('UE 1.2 튜닝: 판정·타이밍·기력·회피·점프·카운터·보스 예고는 three.js 규칙과 같다',()=>{
  const bad=rows.filter(r=>r.required&&!r.ok);
  assert.deepEqual(bad.map(r=>`${r.item}: three.js ${r.ref} / UE ${r.ue}`),[]);
  assert.ok(rows.filter(r=>r.required).length>=45,'필수 대조 항목 수');
});

test('UE 1.2 튜닝: 알려진 차이는 이 4 개뿐 (디렉터 판단 대기 — 문서 119 §7)',()=>{
  const diffs=rows.filter(r=>!r.required&&!r.ok).map(r=>r.item).sort();
  assert.deepEqual(diffs,['UE 에 없는 d01 패턴','smash stamina (tier 3)'].sort());   /* 돌진 920 cm·회전 합계 6500 은 규칙대로 맞췄다 (문서 121 §5) */
});
