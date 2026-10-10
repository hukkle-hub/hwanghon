import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const g=await readFile(new URL('../js/game3d.js',import.meta.url),'utf8');
function auditBlock(source){const i=source.indexOf('function auditSnapshot()'),end=source.indexOf('function auditEvent(',i);assert.ok(i>=0&&end>i,'complete audit function boundaries');return source.slice(i,end);}
function assertObservationOnly(block){
  assert.match(block,/battle\.snapshot\(\)/);
  assert.match(block,/FRAME_METRICS\.report\(\)/);
  assert.match(block,/renderer\.info\.render\.calls/);
  assert.match(block,/renderer\.info\.render\.triangles/);
  assert.ok(!block.includes('battle.input('));
}

test('combatAudit는 localhost 전용 query flag',()=>{
  assert.match(g,/\['127\.0\.0\.1','localhost'\]\.includes\(location\.hostname\).*combatAudit/);
});

test('감사는 판정 입력 없이 snapshot과 renderer 통계만 기록',()=>{
  // Check the entire function, not an arbitrary 2500-character prefix which
  // truncated the renderer metrics when actual palm/sole observation grew.
  const block=auditBlock(g);assertObservationOnly(block);
  assert.throws(()=>assertObservationOnly(block+'battle.input("attack");'));
  assert.throws(()=>assertObservationOnly(block.replace('renderer.info.render.calls','0')));
});

test('P5 지지발과 P0 보스 reaction, 카메라 거리, 프레임을 한 로그에 남긴다',()=>{
  assert.match(g,/plantSide:cd\.plantSide/);
  assert.match(g,/plantError:cd\.plantError/);
  assert.match(g,/bossReaction:boss\.behavior&&boss\.behavior\.reaction/);
  assert.match(g,/bodyRadiusM=\(Math\.max\(0,P\.r\|\|0\)\+Math\.max\(0,Bs\.r\|\|0\)\)\/SCALE/);
  assert.match(g,/penetrationM:\+penetrationM\.toFixed\(3\)/);
  assert.match(g,/bossLunge:!!bossLunge/);
  assert.match(g,/p95Ms:fm\.p95Ms/);
});

test('핵심 전투 이벤트만 타임라인에 저장',()=>{
  assert.match(g,/actionstart\|actionend\|actioncancel\|hit\|impact\|counter\|damaged\|dodge\|jump\|deflect\|break/);
  assert.match(g,/auditEvent\(e\)/);
});

test('감사 JSON은 실제 전투를 관찰만 했음을 명시',()=>{
  assert.match(g,/combatAudit는 실제 전투를 관찰만 하며 판정\/AI\/보상에 개입하지 않는다/);
  assert.match(g,/hwanghon-combat-audit-/);
});

test('정렬 버튼은 충돌 반지름 합 + 12cm로 맞추고 전투 규칙은 건드리지 않는다',()=>{
  assert.match(g,/var d=\(P\.r\+Bs\.r\)\/SCALE\+\.12/);
  assert.match(g,/P\.x=Bs\.x-d\*SCALE/);
  assert.match(g,/setLock\(true\)/);
});
