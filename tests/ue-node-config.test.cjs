/* 남산 N-01 그레이박스가 실제로 걸리는가 (docs/design/200) — Content/Data/node_namsan_n01.json 을 UE 와 같은 셈으로
   상자로 만들고(tools/ue/node-graybox.js), 적이 걷는 길·시작점이 바닥 위에 있고 끊기지 않는지, 정문이 길을 막는지 잰다.
   UE 가 없는 곳에서 «적이 허공으로 떨어진다» 를 미리 잡는다. */
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const G=require('../tools/ue/node-graybox.js');
const N=require(path.join(__dirname,'..','ue','HwanghonCombatUE','Content','Data','node_namsan_n01.json'));
const B=G.blocks(N), walls=B.filter(b=>b.kind==='wall'), gate=B.find(b=>b.fkind==='gate');
const onFloor=(p,tol=30)=>{ const h=G.floorAt(B,p[0],p[1],p[2]); return h!=null&&Math.abs(h-p[2])<=tol; };
/* 길 한 구간: 50 cm 마다 바닥이 있고, 높이가 이어지고(한 걸음 45 cm 이하 — UE MaxStepHeight), 경사 35° 이하 */
function legOk(A,Bp){ const L=Math.hypot(Bp[0]-A[0],Bp[1]-A[1]), n=Math.max(1,Math.ceil(L/50)); let prev=null;
 for(let k=0;k<=n;k++){ const x=A[0]+(Bp[0]-A[0])*k/n, y=A[1]+(Bp[1]-A[1])*k/n, z=A[2]+(Bp[2]-A[2])*k/n, h=G.floorAt(B,x,y,z);
  if(h==null) return 'x'+x.toFixed(0)+' y'+y.toFixed(0)+' 바닥 없음';
  if(prev!=null){ const step=Math.abs(h-prev), run=L/n; if(step>45&&Math.atan2(step,run)>35*Math.PI/180) return 'x'+x.toFixed(0)+' y'+y.toFixed(0)+' 턱 '+step.toFixed(0)+' cm'; }
  prev=h; } return null; }
test('남산 N-01: 출발점·기술자·보스·적 시작점이 바닥 위',()=>{
 for(const [name,p] of [['플레이어',N.player_start],['기술자',N.technician_start],['보스',N.boss_start],...N.spawns.map((s,i)=>['적 시작 '+i,s])]) assert.ok(onFloor(p),name+' '+p+' 가 바닥 위가 아니다');
});
test('남산 N-01: 적이 걷는 길(정면·서·동 우회·발전동·통신센터)이 끊기지 않는다',()=>{
 for(const [name,r] of Object.entries(N.routes)){ for(const p of r) assert.ok(onFloor(p),name+' 경유점 '+p+' 이 바닥 위가 아니다');
  const legs=name==='main'||name==='west'||name==='east'?[[N.spawns[name==='east'?2:0],r[0]],...r.slice(1).map((p,i)=>[r[i],p])]:r.slice(1).map((p,i)=>[r[i],p]);
  for(const [a,b] of legs){ const bad=legOk(a,b); assert.equal(bad,null,name+' '+a+' → '+b+': '+bad); } }
 /* 발전동·통신센터 길은 광장에서 시작한다 — 광장(정면 길 끝)과 이어져야 한다 */
 const plaza=N.routes.main.at(-1); for(const k of ['generator','comms']) assert.equal(legOk(plaza,N.routes[k][0]),null,'광장 → '+k);
});
test('남산 N-01: 정문이 정면 길을 막고, 벽이 정문 양옆을 막으며, 우회로는 벽 바깥으로 돈다',()=>{
 const m=N.routes.main; assert.ok(G.crosses(gate,m[0],m[1]),'정면 길이 정문을 지나지 않는다 — 정문이 길을 못 막는다');
 for(const w of walls) for(let i=1;i<m.length;i++) assert.ok(!G.crosses(w,m[i-1],m[i]),'정면 길이 벽을 뚫는다 '+m[i-1]+' → '+m[i]);
 for(const k of ['west','east']){ const r=N.routes[k]; for(const b of [gate,...walls]) for(let i=1;i<r.length;i++) assert.ok(!G.crosses(b,r[i-1],r[i]),k+' 우회로가 '+(b.id||'벽')+' 을 뚫는다 '+r[i-1]+' → '+r[i]); }
 /* 정문 줄: 정문 받침 폭 전체가 벽 + 정문으로 덮여 있다 (틈으로 걸어 들어오지 못한다) */
 const pad=B.find(b=>b.kind==='pad'&&b.center[1]===N.anchors.SouthGate[1]), x0=pad.center[0]-pad.half[0], x1=pad.center[0]+pad.half[0];
 for(let x=x0+10;x<x1;x+=20){ const cov=[gate,...walls.filter(w=>w.center[1]===gate.center[1])].some(b=>Math.abs(x-b.center[0])<=b.half[0]); assert.ok(cov,'정문 줄 x '+x+' 이 비었다'); }
});
test('남산 N-01: 시설 셋(정문·발전기·통신센터)이 바닥 위에 있고, 길 끝에서 닿는다',()=>{
 for(const f of N.facilities){ const a=G.pt(N,f.at); assert.ok(onFloor(a),f.id+' 가 바닥 위가 아니다'); }
 const reach=(f,p)=>{ const a=G.pt(N,f.at); return Math.max(0,Math.abs(p[0]-a[0])-f.half[0])+Math.max(0,Math.abs(p[1]-a[1])-f.half[1]); };
 assert.ok(reach(N.facilities.find(f=>f.kind==='generator'),N.routes.generator.at(-1))<=260,'발전기 길 끝이 너무 멀다');
 assert.ok(reach(N.facilities.find(f=>f.kind==='comms'),N.routes.comms.at(-1))<=260,'통신센터 길 끝이 너무 멀다');
 assert.ok(reach(N.facilities.find(f=>f.kind==='gate'),N.routes.main[0])<=600,'정문 앞 경유점이 정문에서 너무 멀다');
});
