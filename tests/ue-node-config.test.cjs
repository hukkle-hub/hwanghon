/* 남산 N-01 그레이박스가 실제로 걸리는가 (docs/design/200·201) — Content/Data/node_namsan_n01.json 을 UE 와 같은 셈으로
   상자로 만들고(tools/ue/node-graybox.js), 적이 걷는 길·시작점·NPC 자리가 바닥 위에 있고 끊기지 않는지, 벽·엄폐·포탑·건물을
   뚫지 않는지, 정문이 길을 막는지 잰다. UE 가 없는 곳에서 «적이 허공으로 떨어진다·벽에 끼인다» 를 미리 잡는다. */
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const G=require('../tools/ue/node-graybox.js');
const N=require(path.join(__dirname,'..','ue','HwanghonCombatUE','Content','Data','node_namsan_n01.json'));
const B=G.blocks(N), walls=B.filter(b=>b.kind==='wall'), gate=B.find(b=>b.fkind==='gate');
const solids=B.filter(b=>b.kind==='wall'||(b.kind==='facility'&&b.fkind!=='gate'));   // 길이 절대 지나면 안 되는 것
const onFloor=(p,tol=30)=>{ const h=G.floorAt(B,p[0],p[1],p[2]); return h!=null&&Math.abs(h-p[2])<=tol; };
const GATE_S=N.routes.main[0];
/* 길 한 구간: 50 cm 마다 바닥이 있고, 높이가 이어지고(턱 45 cm 이하 — UE MaxStepHeight), 경사 35° 이하 */
function legOk(A,Bp){ const L=Math.hypot(Bp[0]-A[0],Bp[1]-A[1]), n=Math.max(1,Math.ceil(L/50)); let prev=null;
 for(let k=0;k<=n;k++){ const x=A[0]+(Bp[0]-A[0])*k/n, y=A[1]+(Bp[1]-A[1])*k/n, z=A[2]+(Bp[2]-A[2])*k/n, h=G.floorAt(B,x,y,z);
  if(h==null) return 'x'+x.toFixed(0)+' y'+y.toFixed(0)+' 바닥 없음';
  if(prev!=null){ const step=Math.abs(h-prev), run=L/n; if(step>45&&Math.atan2(step,run)>35*Math.PI/180) return 'x'+x.toFixed(0)+' y'+y.toFixed(0)+' 턱 '+step.toFixed(0)+' cm'; }
  prev=h; }
 for(const s of solids) if(G.crosses(s,A,Bp)) return (s.id||s.wkind||'벽')+' 을 뚫는다';
 return null; }
/* 각 길의 구간들 — 정문 앞(GATE_S)에서 시작하는 길은 첫 구간만 정문을 지난다(정문이 부서진 뒤) */
const SPAWN_ROUTES=['main','west','east','west_loop','east_forest'], EXT_ROUTES=['generator','comms','medical','comms_tower'];
function legsOf(name){ const r=N.routes[name], legs=r.slice(1).map((p,i)=>[r[i],p]);
 if(SPAWN_ROUTES.includes(name)) legs.unshift([N.spawns[name==='east'?2:0],r[0]]);
 if(name==='north') legs.unshift([N.north_spawns[0],r[0]]);
 if(EXT_ROUTES.includes(name)) legs.unshift([N.routes.main.at(-1),r[0]]);
 return legs; }

test('남산 N-01: 시작점·NPC 자리·포로 자리·의무실이 바닥 위',()=>{
 const spots=[['플레이어',N.player_start],['기술자 시작',N.technician_start],['보스',N.boss_start],['포로 자리',N.holding_spot],['의무실',N.medical_bay],
  ...N.spawns.map((s,i)=>['남쪽 적 시작 '+i,s]),...N.north_spawns.map((s,i)=>['북쪽 적 시작 '+i,s]),...N.npcs.map(n=>['NPC '+n.id,n.at])];
 for(const [name,p] of spots) assert.ok(onFloor(p),name+' '+p+' 가 바닥 위가 아니다');
 for(const [name,p] of spots) for(const s of solids) assert.ok(!(Math.abs(p[0]-s.center[0])<s.half[0]&&Math.abs(p[1]-s.center[1])<s.half[1]),name+' 이 '+(s.id||s.wkind)+' 안에 있다');
});
test('남산 N-01: 모든 길(정면·우회·서측 순환로·동측 숲길·북측·시설·NPC)이 끊기지 않고 벽·엄폐·포탑·건물을 뚫지 않는다',()=>{
 for(const name of Object.keys(N.routes)){ for(const p of N.routes[name]) assert.ok(onFloor(p),name+' 경유점 '+p+' 이 바닥 위가 아니다');
  const legs=legsOf(name);
  for(const [a,b] of legs){ const bad=legOk(a,b); assert.equal(bad,null,name+' '+a+' → '+b+': '+bad);
   const throughGate=G.crosses(gate,a,b), allowed=a===GATE_S||(a[0]===GATE_S[0]&&a[1]===GATE_S[1]);
   if(name!=='gate'&&!allowed) assert.ok(!throughGate,name+' '+a+' → '+b+' 이 정문을 통과한다 (정문 앞 첫 구간만 허용)'); } }
});
test('남산 N-01: 정문이 정면 길을 막고 정문 줄 전체가 벽+정문, 우회로는 벽 바깥, 발전동은 문으로만 들어간다',()=>{
 const m=N.routes.main; assert.ok(G.crosses(gate,m[0],m[1]),'정면 길이 정문을 지나지 않는다 — 정문이 길을 못 막는다');
 for(const k of ['west','east']){ const r=N.routes[k]; for(let i=1;i<r.length;i++) assert.ok(!G.crosses(gate,r[i-1],r[i]),k+' 우회로가 정문을 지난다'); }
 const pad=B.find(b=>b.kind==='pad'&&b.center[1]===N.anchors.SouthGate[1]), x0=pad.center[0]-pad.half[0], x1=pad.center[0]+pad.half[0];
 const line=[gate,...walls.filter(w=>w.wkind==='wall'&&w.center[1]===gate.center[1])];
 for(let x=x0+10;x<x1;x+=20) assert.ok(line.some(b=>Math.abs(x-b.center[0])<=b.half[0]),'정문 줄 x '+x+' 이 비었다');
 /* 발전동: 발전기 둘레가 건물 벽으로 닫혀 있고, 길(서문·남문)만 들어간다 — 벽을 지우면 잡힌다 */
 const gen=N.facilities.find(f=>f.kind==='generator'), g=G.pt(N,gen.at), bw=walls.filter(w=>w.wkind==='building'&&Math.abs(w.center[0]-g[0])<1200&&Math.abs(w.center[1]-g[1])<1200);
 const ring=[]; for(let a=0;a<360;a+=5){ const r=1300; ring.push([g[0]+Math.cos(a*Math.PI/180)*r,g[1]+Math.sin(a*Math.PI/180)*r]); }
 let open=0; for(const [x,y] of ring){ const toward=[g[0],g[1],g[2]], from=[x,y,g[2]]; if(!bw.some(w=>G.crosses(w,from,toward))) open++; }
 assert.ok(open>=4&&open<=14,'발전동 문 틈 '+open+'/72 방향 — 벽이 없거나(많음) 문이 없다(0)');
});
test('남산 N-01: 바리케이드 자리가 숲길 위에 있고 질주형 우회로를 막는다 (보급으로 세우면 질주형이 부숴야 지나간다)',()=>{
 assert.equal(N.barricade_slots.length,2);
 for(const [slot,route] of [[N.barricade_slots[0],'west'],[N.barricade_slots[1],'east']]){ assert.ok(onFloor(slot.at),slot.id+' 이 바닥 위가 아니다');
  const box={center:[slot.at[0],slot.at[1],slot.at[2]+slot.half[2]],half:slot.half}, r=N.routes[route];
  assert.ok(r.slice(1).some((p,i)=>G.crosses(box,r[i],p)),slot.id+' 이 '+route+' 우회로를 막지 않는다');
  assert.ok(!N.routes.main.slice(1).some((p,i)=>G.crosses(box,N.routes.main[i],p)),slot.id+' 이 정면 길을 막는다'); }
 assert.ok(N.supply_default>=3,'기본 보급으로 바리케이드 하나는 세울 수 있어야');
});
test('남산 N-01: 시설·NPC 길 끝이 목표에 닿고, 역할별 길·NPC 길이 실제로 있다',()=>{
 const reach=(f,p)=>{ const a=G.pt(N,f.at); return Math.max(0,Math.abs(p[0]-a[0])-f.half[0])+Math.max(0,Math.abs(p[1]-a[1])-f.half[1]); };
 assert.ok(reach(N.facilities.find(f=>f.kind==='generator'),N.routes.generator.at(-1))<=260,'발전기 길 끝이 너무 멀다');
 assert.ok(reach(N.facilities.find(f=>f.kind==='generator'),N.routes.east_forest.at(-1))<=260,'숲길 끝이 발전기에서 너무 멀다');
 assert.ok(reach(N.facilities.find(f=>f.kind==='comms'),N.routes.comms.at(-1))<=260,'통신센터 길 끝이 너무 멀다');
 for(const n of N.npcs){ const r=N.routes[n.route]; assert.ok(r,n.id+' 의 길 '+n.route+' 이 없다'); const e=r.at(-1); assert.ok(Math.hypot(e[0]-n.at[0],e[1]-n.at[1])<=450,n.id+' 길 끝이 '+Math.hypot(e[0]-n.at[0],e[1]-n.at[1]).toFixed(0)+' cm 떨어졌다'); }
 for(const [role,r] of Object.entries(N.role_routes)) for(const k of [].concat(r)) assert.ok(N.routes[k],role+' 의 길 '+k+' 이 없다');
 assert.equal(N.facilities.filter(f=>f.kind==='turret').length,4,'포탑 넷');
});
