/* 전국 길 문 온라인 도착 (문서 220 §16) — map.json 에 없는 길 문 id(상대 지역)로 들어오면 출발점이 아니라 그 길 끝, 길 안쪽 5 m 에 선다.
   3D 클라(world3d.html)와 같은 공식이라야 «길을 따라 왔다» 가 이어진다. map.json 문은 그대로 우선. */
const test=require('node:test'),assert=require('node:assert/strict');
const {Field}=require('../server/field.cjs'),{Store}=require('../server/store.cjs'),{createCollide}=require('../js/mmo/field-collide.js'),{LINKS,linkGates}=require('../js/mmo/zone-links.js');
const map=z=>require('../maps/2d/'+z+'/map.json');
function joinAt(zone,gate){ const store=new Store(null),g=store.guest('길손');store.chooseName(g.profile.id,'길손'+Math.floor(Math.random()*1e6),'ain');const id=g.profile.id;
 const f=new Field({store,emit:()=>{},rng:()=>0.5});return f.join(id,store.public(id),zone,undefined,gate); }
test('길 문으로 들어오면 그 길 끝 안쪽에 선다 — 전 구간 양쪽', () => {
 let n=0;
 for(const [a,,b] of LINKS) for(const [zone,from] of [[a,b],[b,a]]){ const m=map(zone),w=m.walk,ang=m.road.ang,p=joinAt(zone,from),end=linkGates(zone).find(g=>g.id===from).at.end;
  const s=p.x*Math.cos(ang)-p.z*Math.sin(ang),t=-p.x*Math.sin(ang)-p.z*Math.cos(ang),edge=end==='s1'?w.s1:w.s0;
  assert.ok(Math.hypot(p.x-m.spawn.x,p.z-m.spawn.z)>20,`${zone}←${from}: 출발점에 섰다`);
  assert.ok(Math.abs(s-edge)<16,`${zone}←${from}: 띠 끝(${end})에서 ${Math.abs(s-edge).toFixed(1)} m`);
  assert.ok(s>=w.s0-0.5&&s<=w.s1+0.5&&t>=w.t0-0.5&&t<=w.t1+0.5,`${zone}←${from}: 걷는 띠 밖`);
  const q={x:p.x,z:p.z};createCollide(m).collide(q,0.4);assert.ok(Math.hypot(q.x-p.x,q.z-p.z)<0.05,`${zone}←${from}: 막이 안`);
  n++; }
 assert.equal(n,LINKS.length*2);
});
test('map.json 문은 그대로 우선 · 모르는 문은 출발점', () => {
 const m=map('gangnam'),g0=(m.gates||[])[0];
 if(g0){ const p=joinAt('gangnam',g0.id);assert.ok(Math.hypot(p.x-g0.x,p.z-g0.z)<3,'map.json 문 자리'); }
 const p=joinAt('daejeon','nowhere'),sp=map('daejeon').spawn;assert.ok(Math.hypot(p.x-sp.x,p.z-sp.z)<1,'모르는 문은 출발점(막이 밀기만)');
});
