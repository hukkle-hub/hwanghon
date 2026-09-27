/* v12 8/8 Claude 보정 — GPT P0~P5 위에 얹은 것만 못박는다(판정 combat.js 무변경).
   ① 접점 끌림 따라잡기 완만(3.2 배 → 남은 행동 시간 기준, 최소 1.7 배) ② 보스 핵 빛 5.5 m·정점 3.5(붙어 선 아인을 붉게 칠하지 않게)
   ③ 관통 돌진 뒤 0.9 s 요우 상한 ×0.4 ④ 3 타·스매시 화각 +3° ⑤ 플레이어 피격 플래시 0.10 s 0x4a1a12 ⑥ GLB extras → 클립 userData(footlock 표식)
   ⑦ 바람 스프라이트 0.55×0.20·0.07 s ⑧ renderInfo 진단. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let G='',TR='',BR='';
test.before(async ()=>{ G=await readFile(new URL('../js/game3d.js',import.meta.url),'utf8'); TR=await readFile(new URL('../js/weapon-trail.js',import.meta.url),'utf8'); BR=await readFile(new URL('../js/ain-bind-repair.js',import.meta.url),'utf8'); });

test('끌림 따라잡기: dt*2.2 고정 대신 남은 행동 시간 기준(바닥 0.7)', ()=>{
  assert.ok(!/dragLag - dt\*2\.2/.test(G)); assert.match(G,/dragLag - dt\*Math\.max\(0\.7, dragLag\/rem\)/);
});
test('보스 핵 빛: 닿는 거리 4.0 m, 큰 기술 정점 2.0', ()=>{
  assert.match(G,/new THREE\.PointLight\(0xE04A3C, 3\.0, 4\.0, 1\.4\)/); assert.match(G,/\(a\.charge\|\|0\)\*2\.0/);
});
test('카메라: 관통 돌진 뒤 급회전 억제, 3 타·스매시 +3°, 흔들림 계수 무변경', ()=>{
  assert.match(G,/function startLunge\(l\)\{ if\(!l\|\|!boss\.root\) return; camCalmT=0\.9;/); assert.match(G,/if\(camCalmT>0\)\{ camCalmT-=dt; lim\*=0\.4; \}/);
  assert.match(G,/sa3\.clip==='attack3'\|\|sa3\.clip==='smash'\)\) fv\+=3;/);
  assert.match(G,/shake\(0\.008,240,axI\[0\],axI\[1\]\)/,'스매시 흔들림 계수 그대로');
});
test('플레이어 피격 플래시 0.08 s 0x30120e (전체 단색 빨강 아님)', ()=>{
  assert.ok(!/ain\.hitT=0\.18/.test(G)); assert.match(G,/ain\.hitT=0\.08; hitReact\(e\)/); assert.match(G,/ain\.hitT>0\?0x30120e:0x000000/);
});
test('GLB extras → 클립 userData, footlock 클립은 골반 XZ 를 지우지 않는다', ()=>{
  assert.ok(G.includes("c.userData=Object.assign(c.userData||{},adefs[i].extras)"),'r170 AnimationClip 은 userData 가 undefined — 만들어 넣는다'); assert.ok(G.indexOf("c.userData=Object.assign(c.userData||{}")<G.indexOf("g.animations=repairAinClips("));
  assert.match(BR,/!\/footlock\/\.test\(\(clip\.userData&&clip\.userData\.source\)\|\|''\)/);
});
test('바람 스프라이트 0.55×0.20, 0.07 s 간격; renderInfo 진단', ()=>{
  assert.match(TR,/sp\.scale\.set\(0\.55\*big,0\.20\*big,1\)/); assert.match(TR,/this\.windT=0\.07/);
  assert.match(G,/get renderInfo\(\)/);
});

test('발 앵커 해제는 한 프레임 스냅이 아니라 0.12 s 섞기 (combat-motion)', async ()=>{
  const m=await readFile(new URL('../js/combat-motion.js',import.meta.url),'utf8');
  assert.ok(!/if\(p\.y>anchor\.y\+0\.10\)\{delete anchors\[side\];continue;\}/.test(m),'즉시 삭제 제거');
  assert.match(m,/if\(p\.y>anchor\.y\+0\.10\)an\.lift=true;/); assert.match(m,/an\.w-=\(dt\|\|1\/60\)\/0\.12;/); assert.match(m,/p\.clone\(\)\.lerp\(anchor,Math\.max\(0,an\.w\)\)/);
});

test('아인 attack1/2/3 는 발 고정 재굽기 클립(smash 는 원본)(extras.source footlock) — 판정 시각은 clipContacts 그대로', async ()=>{
  const b=await readFile(new URL('../art/3d/ain_anim.glb',import.meta.url)); const jl=b.readUInt32LE(12); const j=JSON.parse(b.subarray(20,20+jl).toString());
  for(const n of ['attack1','attack2','attack3']){ const a=j.animations.find(x=>x.name===n); assert.ok(a&&a.extras&&/footlock/.test(a.extras.source),n+' footlock'); }
  const sm=j.animations.find(x=>x.name==='smash'); assert.ok(!(sm.extras&&/footlock/.test(sm.extras.source)),'smash 는 원본(골반 rest) — 세 박자 빠른 내리침에 골반 뿌리 이동이 얹히면 접점 한 프레임에 44 cm 튄다');
});
