import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeAudit,auditVerdict,markdownReport} from '../tools/combat-audit-report.mjs';

const data={
  frameMetrics:{fps:59.8,p95Ms:18.4,p99Ms:24,over50ms:0},
  events:[
    {event:'actionend',t:1.000,clip:'attack1'},
    {event:'actionstart',t:1.018,clip:'attack2'},
    {event:'hit',t:1.300,clip:'attack2',elapsed:.241,hitAt:.240},
    {event:'actionend',t:1.600,clip:'attack2'},
    {event:'actionstart',t:1.620,clip:'attack3'},
    {event:'hit',t:1.900,clip:'attack3',elapsed:.319,hitAt:.320}
  ],
  samples:[
    {t:.9,gapM:1.30,plantError:.004,plantWeight:.8,base:'idle',clip:'attack1'},
    {t:1.01,gapM:1.22,plantError:.006,plantWeight:1,base:'idle',clip:'attack1'},
    {t:1.05,gapM:1.18,plantError:.005,plantWeight:.7,base:'idle',clip:'attack2'},
    {t:1.30,gapM:1.10,plantError:.007,plantWeight:1,base:'idle',clip:'attack2',bossReaction:'hit'},
    {t:1.62,gapM:1.02,plantError:.006,plantWeight:.4,base:'idle',clip:'attack3'},
    {t:1.91,gapM:.96,plantError:.008,plantWeight:1,base:'idle',clip:'attack3',bossReaction:'hit'}
  ]
};

test('handoff와 접점 오차를 ms로 계산',()=>{
  const a=analyzeAudit(data);
  assert.deepEqual(a.handoffs.map(x=>x.ms),[18,20]);
  assert.deepEqual(a.hitDeltasMs.map(x=>x.ms),[1,-1]);
});

test('최소 간격·최대 plant error·성능을 모은다',()=>{
  const a=analyzeAudit(data);
  assert.equal(a.minGapM,.96);assert.equal(a.maxPlantErrorM,.008);
  assert.equal(a.performance.p95Ms,18.4);
});

test('정상 샘플은 전 항목 PASS',()=>{
  const v=auditVerdict(analyzeAudit(data));
  assert.equal(v.combo,'PASS');assert.equal(v.contact,'PASS');assert.equal(v.plant,'PASS');
  assert.equal(v.overlap,'PASS');assert.equal(v.reaction,'PASS');assert.equal(v.frame,'PASS');
});

test('0.8m 아래 실제 좌표 겹침은 CHECK',()=>{
  const d=structuredClone(data);d.samples.push({t:2,gapM:.62,plantError:.004,plantWeight:0,base:'idle',clip:''});
  assert.equal(auditVerdict(analyzeAudit(d)).overlap,'CHECK');
});

test('markdown 보고서에 핵심 판정이 들어간다',()=>{
  const md=markdownReport(data);assert.match(md,/콤보 handoff/);assert.match(md,/최소 플레이어-보스 간격/);assert.match(md,/PASS/);
});
