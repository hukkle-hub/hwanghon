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
    {t:.9,gapM:1.78,bodyRadiusM:1.64,clearanceM:.14,penetrationM:0,plantError:.004,plantWeight:.8,base:'idle',clip:'attack1'},
    {t:1.01,gapM:1.70,bodyRadiusM:1.64,clearanceM:.06,penetrationM:0,plantError:.006,plantWeight:1,base:'idle',clip:'attack1'},
    {t:1.05,gapM:1.67,bodyRadiusM:1.64,clearanceM:.03,penetrationM:0,plantError:.005,plantWeight:.7,base:'idle',clip:'attack2'},
    {t:1.30,gapM:1.66,bodyRadiusM:1.64,clearanceM:.02,penetrationM:0,plantError:.007,plantWeight:1,base:'idle',clip:'attack2',bossReaction:'hit'},
    {t:1.62,gapM:1.69,bodyRadiusM:1.64,clearanceM:.05,penetrationM:0,plantError:.006,plantWeight:.4,base:'idle',clip:'attack3'},
    {t:1.91,gapM:1.65,bodyRadiusM:1.64,clearanceM:.01,penetrationM:0,plantError:.008,plantWeight:1,base:'idle',clip:'attack3',bossReaction:'hit'}
  ]
};

test('handoff와 접점 오차를 ms로 계산',()=>{
  const a=analyzeAudit(data);
  assert.deepEqual(a.handoffs.map(x=>x.ms),[18,20]);
  assert.deepEqual(a.hitDeltasMs.map(x=>x.ms),[1,-1]);
});

test('최소 간격·최대 plant error·성능을 모은다',()=>{
  const a=analyzeAudit(data);
  assert.equal(a.minGapM,1.65);assert.equal(a.maxPenetrationM,0);assert.equal(a.maxPlantErrorM,.008);
  assert.equal(a.worstOverlap.clip,'attack3');
  assert.equal(a.performance.p95Ms,18.4);
});

test('정상 샘플은 전 항목 PASS',()=>{
  const v=auditVerdict(analyzeAudit(data));
  assert.equal(v.combo,'PASS');assert.equal(v.contact,'PASS');assert.equal(v.plant,'PASS');
  assert.equal(v.overlap,'PASS');assert.equal(v.reaction,'PASS');assert.equal(v.frame,'PASS');
});

test('일반 전투 12cm penetration은 CHECK, 24cm는 FAIL',()=>{
  const c=structuredClone(data);c.samples.push({t:2,gapM:1.52,bodyRadiusM:1.64,penetrationM:.12,plantError:.004,plantWeight:0,base:'idle',clip:'smash',bossState:'recover'});
  const ca=analyzeAudit(c);assert.equal(auditVerdict(ca).overlap,'CHECK');assert.equal(ca.worstOverlap.clip,'smash');assert.equal(ca.worstOverlap.bossState,'recover');
  const f=structuredClone(data);f.samples.push({t:2,gapM:1.40,bodyRadiusM:1.64,penetrationM:.24,plantError:.004,plantWeight:0,base:'idle',clip:''});
  assert.equal(auditVerdict(analyzeAudit(f)).overlap,'FAIL');
});

test('보스 관통 돌진 penetration은 일반 overlap 판정에서 제외',()=>{
  const d=structuredClone(data);d.samples.push({t:2,gapM:.80,bodyRadiusM:1.64,penetrationM:.84,bossLunge:true,plantError:.004,plantWeight:0,base:'idle',clip:''});
  const a=analyzeAudit(d);assert.equal(a.maxPenetrationM,0);assert.equal(a.maxLungePenetrationM,.84);
  assert.equal(auditVerdict(a).overlap,'PASS');
});

test('markdown 보고서에 핵심 판정이 들어간다',()=>{
  const md=markdownReport(data);assert.match(md,/콤보 handoff/);assert.match(md,/일반 전투 최대 body penetration/);assert.match(md,/PASS/);
});
