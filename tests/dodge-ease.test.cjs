const test=require('node:test'), assert=require('node:assert/strict');
const W=require('../js/world-sim.js');
/* 회피 이동: 튀어 나가서 미끄러지듯 멈춘다 (명조식). 거리·시간은 예전과 같아야 한다 —
   무적 시간과 회피 거리는 판정이다. docs/design/73 §5 */
function world(){ const rows=[]; for(let y=0;y<20;y++) rows.push('.'.repeat(40)); return W.createWorld({rows,cell:64}); }
function roll(dt){ const w=world(), p=w.add('p',{x:600,y:600,r:10,rollT:0,lockT:0,kbT:0,aim:0});
  w.roll(p,1,0,240,0.5); const xs=[p.x]; while(p.rollT>0){ w.movePlayer(p,1,0,dt,300); xs.push(p.x); } return xs; }
test('총 거리는 dt 와 무관하게 정확히 같다', ()=>{
  for(const dt of [1/30,1/60,1/144,0.013]){ const xs=roll(dt); assert.ok(Math.abs(xs[xs.length-1]-xs[0]-240)<1e-6, `dt ${dt}: ${xs[xs.length-1]-xs[0]}`); }
});
test('처음이 제일 빠르고(평균의 2배 근처) 끝으로 갈수록 느려진다 — 뚝 멈추지 않는다', ()=>{
  const xs=roll(1/60), v=xs.slice(1).map((x,i)=>x-xs[i]), avg=240/v.length;
  assert.ok(v[0]>avg*1.8, `첫 프레임 ${v[0].toFixed(2)} vs 평균 ${avg.toFixed(2)}`);
  for(let i=1;i<v.length;i++) assert.ok(v[i]<=v[i-1]+1e-9, '속도가 줄기만 해야 한다');
  assert.ok(v[v.length-1]<avg*0.15, `마지막 프레임 ${v[v.length-1].toFixed(2)} — 거의 멈춘 채 끝나야 한다`);
});
test('구르기가 끝나면 달리기는 거의 멈춘 데서 다시 붙는다 (끝 속도와 이어짐)', ()=>{
  const w=world(), p=w.add('p',{x:600,y:600,r:10,rollT:0,lockT:0,kbT:0,aim:0,spd:1});
  w.roll(p,1,0,240,0.5); while(p.rollT>0) w.movePlayer(p,1,0,1/60,300);
  assert.ok(p.spd<=0.15);
});
