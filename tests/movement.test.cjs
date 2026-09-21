const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync('js/world-sim.js','utf8'),ctx,{filename:'world-sim'});
const SIM=ctx.window.TW_WORLDSIM;
const SPEED=230, SCALE=50;
function world(){ return SIM.createWorld({rows:['..........','..........','..........','..........'],cell:64}); }
function player(w){ return w.add('p',{x:200,y:150,r:10,rollT:0,lockT:0,kbT:0,aim:0}); }

/* 가속·감속 — 예전엔 스틱을 미는 «그 프레임» 에 전속이 됐다 (docs/design/56). */
test('출발은 한 프레임이 아니다 — 전속까지 시간이 걸린다', () => {
 const w=world(), p=player(w);
 w.movePlayer(p,1,0,.016,SPEED);
 assert.ok(p.spd<0.2, '첫 프레임 속도 '+p.spd.toFixed(3)+' — 0.2 미만이어야 한다');
 let t=.016; while(p.spd<0.95&&t<2){ w.movePlayer(p,1,0,.016,SPEED); t+=.016; }
 assert.ok(t>0.25&&t<0.55, '전속의 95%까지 '+t.toFixed(2)+'초 — 0.25~0.55초 대역');
});

test('멈춤도 한 프레임이 아니고, 결국 완전히 선다', () => {
 const w=world(), p=player(w);
 for(let i=0;i<120;i++) w.movePlayer(p,1,0,.016,SPEED);
 assert.ok(p.spd>0.98);
 const x0=p.x;
 w.movePlayer(p,0,0,.016,SPEED);
 assert.ok(p.spd>0.8, '놓은 첫 프레임에 '+p.spd.toFixed(2)+' — 뚝 끊기면 안 된다');
 let t=.016; while(p.spd>0&&t<3){ w.movePlayer(p,0,0,.016,SPEED); t+=.016; }
 assert.equal(p.spd,0,'결국 완전히 선다');
 const slide=(p.x-x0)/SCALE;
 assert.ok(slide>0.1&&slide<1.2, '미끄러진 거리 '+slide.toFixed(2)+' m — 0.1~1.2 m 대역');
});

test('멈추는 동안에도 마지막 방향으로 간다 — 옆으로 새지 않는다', () => {
 const w=world(), p=player(w);
 for(let i=0;i<120;i++) w.movePlayer(p,0,1,.016,SPEED);      /* +y 로 달린다 */
 const y0=p.y, x0=p.x;
 while(p.spd>0) w.movePlayer(p,0,0,.016,SPEED);
 assert.ok(p.y>y0, '가던 방향으로 더 간다');
 assert.ok(Math.abs(p.x-x0)<1e-6, '옆으로 새지 않는다');
});

test('굳어 있으면(lockT) 가속하지 않는다', () => {
 const w=world(), p=player(w); p.lockT=1;
 for(let i=0;i<60;i++) w.movePlayer(p,1,0,.016,SPEED);
 assert.equal(p.spd||0,0);
});

test('lockT 를 안 쓰는 호출자도 움직인다', () => {
 /* «undefined <= 0» 은 false 라, 조건을 뒤집어 쓰면 이런 호출자가 영영 안 움직인다.
    실제로 탐사 시험이 「movement stuck」으로 이걸 잡아냈다. */
 const w=world(), p=w.add('q',{x:200,y:150,r:10,rollT:0});
 for(let i=0;i<60;i++) w.movePlayer(p,1,0,.016,SPEED);
 assert.ok(p.x>200);
});
