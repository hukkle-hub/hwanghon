/* 자동으로 찍어 낸 지역 (tools/2d/new-zone.mjs · docs/design/192 §7)
   찍어 낸 지역은 사람이 안 들여다봐도 «들어가자마자 갇히거나 물속» 이 아니어야 한다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const MAPS=path.join(__dirname,'..','maps','2d');
const autoP=import('../js/mmo/zones-auto.js'), regionsP=import('../js/mmo/regions.js');
const inPoly=([x,z],P)=>{ let o=false; for(let i=0,j=P.length-1;i<P.length;j=i++){ const [xi,zi]=P[i],[xj,zj]=P[j]; if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi) o=!o; } return o; };
const segD=(p,a,b)=>{ const dx=b[0]-a[0],dz=b[1]-a[1],L2=dx*dx+dz*dz||1,u=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/L2)); return Math.hypot(p[0]-a[0]-dx*u,p[1]-a[1]-dz*u); };
const inBox=(p,b)=>{ const c=Math.cos(-(b.rot||0)),s=Math.sin(-(b.rot||0)),dx=p[0]-b.x,dz=p[1]-b.z,u=dx*c-dz*s,v=dx*s+dz*c; return Math.abs(u)<b.hw&&Math.abs(v)<b.hd; };
const blocked=(m,p)=>m.blockers.find(b=>b.poly?inPoly(p,b.poly):b.line?b.line.some((q,i)=>i&&segD(p,b.line[i-1],q)<b.w):inBox(p,b));
const st=(m,x,z)=>{ const a=m.road.ang,c=Math.cos(a),s=Math.sin(a); return [x*c-z*s,-x*s-z*c]; };
test('자동 지역: 지역 표에 있고, 구운 맵의 출발점이 걷는 띠 안 · 막이(건물·물·바위) 밖이며 둘레 2 m 도 걸을 수 있다',async()=>{
 const {AUTO}=await autoP, {REGIONS}=await regionsP; let n=0;
 for(const id of Object.keys(AUTO)){ assert.ok(REGIONS.find(r=>r.id===id&&r.zone===id),id+' 가 지역 표(regions.js)와 이어지지 않았다');
  const F=path.join(MAPS,id,'map.json'); if(!fs.existsSync(F)) continue; const m=JSON.parse(fs.readFileSync(F,'utf8')), p=[m.spawn.x,m.spawn.z], [s,t]=st(m,...p), w=m.walk; n++;
  assert.ok(s>w.s0&&s<w.s1&&t>w.t0&&t<w.t1,id+' 출발점이 띠 밖');
  for(const [dx,dz] of [[0,0],[2,0],[-2,0],[0,2],[0,-2]]){ const b=blocked(m,[p[0]+dx,p[1]+dz]); assert.ok(!b,id+' 출발점 둘레가 막혔다 '+String(JSON.stringify(b)).slice(0,80)); } }
 assert.ok(n>=1,'구운 자동 지역 '+n);
});
test('자동 지역: 하위 구역 — 위험할수록 레벨이 높고, 쉼터(거점은 마을)가 하나 있다',async()=>{
 const {AUTO}=await autoP;
 for(const [id,z] of Object.entries(AUTO)){ const hunt=z.hunts.filter(h=>(h.kind||'hunt')==='hunt').sort((a,b)=>a.danger-b.danger), rest=z.hunts.filter(h=>h.kind==='rest');
  assert.equal(rest.length,1,id+' 쉼터 '+rest.length); assert.ok(hunt.length>=2,id+' 사냥 구역 '+hunt.length);
  for(let i=1;i<hunt.length;i++) assert.ok(hunt[i].lv[0]>=hunt[i-1].lv[0],id+' '+hunt[i].name+' 가 더 위험한데 레벨이 낮다');
  assert.equal(new Set(z.hunts.map(h=>h.name)).size,z.hunts.length,id+' 구역 이름이 겹친다'); }
});

test('자동 거점: 점령 지점(siege)이 하나 — 마을 안, 출발점에서 10 m 넘게, 구운 맵에서는 막이 밖 (문서 192 §8)',async()=>{
 const {AUTO}=await autoP, {REGIONS}=await regionsP; let n=0;
 for(const [id,z] of Object.entries(AUTO)){ const r=REGIONS.find(x=>x.id===id); if(!r||r.kind!=='hub') continue; n++;
  const sg=z.hunts.filter(h=>h.kind==='siege'), town=z.hunts.find(h=>h.id==='town'); assert.equal(sg.length,1,id+' 점령 지점 '+sg.length); assert.ok(town,id+' 마을 구역');
  const [s,t]=sg[0].st; assert.ok(s>=town.s[0]&&s<=town.s[1]&&t>=town.t[0]&&t<=town.t[1],id+' 점령 지점이 마을 밖');
  const sp=z.field.spawn.st; assert.ok(Math.hypot(s-sp[0],t-sp[1])>10,id+' 점령 지점이 출발점에 붙었다');
  const F=path.join(MAPS,id,'map.json'); if(!fs.existsSync(F)) continue; const m=JSON.parse(fs.readFileSync(F,'utf8')), a=(m.areas||[]).find(x=>x.kind==='siege');
  assert.ok(a,id+' 구운 맵에 점령 지점이 없다 — node tools/2d/patch-areas.mjs '+id);
  for(const [dx,dz] of [[0,0],[2,0],[-2,0],[0,2],[0,-2]]){ const b=blocked(m,[a.circle[0]+dx,a.circle[1]+dz]); assert.ok(!b,id+' 점령 지점이 막혔다 '+String(JSON.stringify(b)).slice(0,80)); } }
 assert.ok(n>=1,'자동 거점 '+n);
});
