/* 문서 121 — 플레이어·보스 몸 겹침. 예전엔 몸끼리 막는 처리가 없어 스틱을 보스 쪽으로 밀면
   그대로 파고들었다 (tools/fight-overlap.mjs: d01 아인 40 초 최대 65 cm). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const SIM=require('../js/world-sim.js');
const ROOM=['##########','#........#','#........#','#........#','#........#','##########'];
function room(){return SIM.createWorld({rows:ROOM,cell:64});}

test('separate: 겹친 플레이어를 반지름 합까지 밀어내고 보스는 움직이지 않는다',()=>{
 const w=room(),b={x:320,y:192,r:60},p={x:300,y:192,r:22,aim:0};
 const pushed=w.separate(p,b);
 assert.ok(pushed>0);assert.equal(b.x,320);assert.equal(b.y,192);
 assert.ok(Math.abs(w.dist(p.x,p.y,b.x,b.y)-82)<1e-6,'간격 = r 합');
 assert.ok(p.x<300,'보스 반대쪽(왼쪽)으로');
});
test('separate: 깊이 보정 공간(dist)에서 잰다 — 세로로 겹쳐도 같은 간격',()=>{
 const w=room(),b={x:320,y:192,r:60},p={x:320,y:192-40*SIM.DEPTH,r:22,aim:0};
 w.separate(p,b);assert.ok(Math.abs(w.dist(p.x,p.y,b.x,b.y)-82)<1e-6);assert.equal(p.x,320);
});
test('separate: 안 겹치면 그대로 · 정확히 겹치면 보는 쪽 반대로',()=>{
 const w=room(),b={x:320,y:192,r:60},p={x:200,y:192,r:22,aim:0};
 assert.equal(w.separate(p,b),0);assert.equal(p.x,200);
 const q={x:320,y:192,r:22,aim:0};w.separate(q,b);assert.ok(q.x<320);assert.ok(Math.abs(w.dist(q.x,q.y,b.x,b.y)-82)<1e-6);
});
test('separate: 벽을 뚫고 밀지 않는다',()=>{
 const w=room(),b={x:140,y:192,r:60},p={x:100,y:192,r:22,aim:0};
 w.separate(p,b);assert.ok(p.x-p.r>=64-1e-6,'왼쪽 벽 안쪽');
});
test('game3d: 전투 중 플레이어·보스가 다 움직인 뒤 separate, 관통 돌진은 제외',()=>{
 const src=fs.readFileSync('js/game3d.js','utf8');
 const tick=src.indexOf('battle.tick(dt); fightT+=dt;'),sep=src.indexOf('world.separate(P, Bs)');
 assert.ok(tick>0&&sep>tick,'battle.tick(보스 이동 포함) 뒤에 온다');
 assert.match(src.slice(sep-80,sep),/battle&&!bossLunge&&!ain\.dead&&$/);
});
