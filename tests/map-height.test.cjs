/* 구운 높이 규약 — 인물이 서는 곳의 «보이는 면 높이» 는 바닥(≈ 0)이어야 한다 (docs/design/185 §6.6)
   첫 던전은 물면(0.9 m)을 높이 그림에 구워 넣어 인물의 무릎 아래가 «땅에 박힌» 듯 잘렸다(디렉터 지적 2026-10-06).
   높이 그림(d_*.png, 512², R·G 16비트)을 직접 풀어 출발점·문·보스 자리 밑을 읽는다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const MAPS=path.join(__dirname,'..','maps','2d');
/* 최소 PNG 해독: 8비트 RGBA, 인터레이스 없음 (굽기 도구가 쓰는 형식) */
const pngCache=new Map(); function pngFile(f){ if(!pngCache.has(f)){ if(pngCache.size>64) pngCache.clear(); pngCache.set(f,png(fs.readFileSync(f))); } return pngCache.get(f); }
function png(buf){ let p=8,w=0,h=0,idat=[];
 while(p<buf.length){ const len=buf.readUInt32BE(p),type=buf.toString('ascii',p+4,p+8),d=buf.subarray(p+8,p+8+len);
  if(type==='IHDR'){ w=d.readUInt32BE(0);h=d.readUInt32BE(4); assert.equal(d[8],8,'8비트');assert.equal(d[9],6,'RGBA'); }
  if(type==='IDAT') idat.push(d); if(type==='IEND') break; p+=12+len; }
 const raw=zlib.inflateSync(Buffer.concat(idat)),bpp=4,stride=w*bpp,out=Buffer.alloc(h*stride);
 for(let y=0;y<h;y++){ const f=raw[y*(stride+1)],src=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)),row=out.subarray(y*stride,(y+1)*stride),up=y?out.subarray((y-1)*stride,y*stride):null;
  for(let x=0;x<stride;x++){ const a=x>=bpp?row[x-bpp]:0,b=up?up[x]:0,c=up&&x>=bpp?up[x-bpp]:0; let v=src[x];
   if(f===1) v+=a; else if(f===2) v+=b; else if(f===3) v+=(a+b)>>1; else if(f===4){ const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c); v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c; }
   row[x]=v&255; } }
 return { w, h, px:(x,y)=>out.subarray((y*w+x)*4,(y*w+x)*4+4) }; }
function heightAt(zone,m,x,z){ const T=m.tile/m.pxPerM,u=x,v=-z*Math.sin(m.pitch);   /* 땅(y = 0)의 그림 좌표 */
 const i=Math.floor((u-m.u0)/T),j=Math.floor((m.v1-v)/T),tl=m.tiles.find(t=>t.i===i&&t.j===j); if(!tl) return null;
 const im=pngFile(path.join(MAPS,zone,tl.depth)),px=Math.min(im.w-1,Math.floor((u-tl.u0)/T*im.w)),py=Math.min(im.h-1,Math.floor((tl.v0-v)/T*im.h)),c=im.px(px,py);
 return (c[0]*256+c[1])/65535*m.hmax; }
for(const zone of fs.readdirSync(MAPS).filter(z=>fs.existsSync(path.join(MAPS,z,'map.json')))){
 test('구운 높이: '+zone+' — 출발점·문·보스 자리 밑은 바닥 높이',()=>{
  const m=JSON.parse(fs.readFileSync(path.join(MAPS,zone,'map.json'),'utf8')); if(m.depthMode!=='height') return;
  const spots=[['출발점',m.spawn],...(m.gates||[]).map(g=>['문 '+g.id,g]),...(m.bosses||[]).map(b=>['보스 '+b.id,b])];
  for(const [name,s] of spots){ const h=heightAt(zone,m,s.x,s.z); assert.ok(h!==null,zone+' '+name+' 타일 없음'); assert.ok(h<0.15,zone+' '+name+' 밑 높이 '+h.toFixed(2)+' m — 인물이 그만큼 묻힌다'); }
 });
}

/* 걷는 띠가 지붕·차양에 덮이면 인물이 통째로 가려진다 (남태령 첫 굽기: 요금소 지붕 6 m 가 8차로를 덮었다).
   필드(실측 OSM)만 잰다 — 실내 던전은 띠(방들의 외곽 사각형)에 벽 너머 빈 곳이 섞여 숫자가 뜻이 없다 */
const inPoly=(p,poly)=>{let s=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])s=!s;}return s;};
for(const zone of fs.readdirSync(MAPS).filter(z=>fs.existsSync(path.join(MAPS,z,'map.json')))){
 const m=JSON.parse(fs.readFileSync(path.join(MAPS,zone,'map.json'),'utf8')); if(m.kind!=='field'||m.depthMode!=='height') continue;
 test('가려지는 자리: '+zone+' — 걸을 수 있는 곳에 땅이 다 그려졌고, 8 × 8 m 칸이 «대부분 가려진» 곳이 없다 (지붕·차양)',()=>{
  const a=m.road.ang,FROM=(s,t)=>[s*Math.cos(a)-t*Math.sin(a),-s*Math.sin(a)-t*Math.cos(a)];
  const blocked=([x,z])=>m.blockers.some(b=>{ if(b.poly) return inPoly([x,z],b.poly); if(b.line) return false; const c=Math.cos(b.rot||0),sn=Math.sin(b.rot||0),dx=x-b.x,dz=z-b.z,lx=dx*c-dz*sn,lz=dx*sn+dz*c; return Math.abs(lx)<b.hw+0.3&&Math.abs(lz)<b.hd+0.3; });
  const G=2, ns=Math.floor((m.walk.s1-m.walk.s0)/G), nt=Math.floor((m.walk.t1-m.walk.t0)/G), cell=new Int8Array(ns*nt).fill(-1);   /* -1 못 걷는 곳 · 0 보임 · 1 가려짐 */
  /* 카메라 쪽(월드 +z)으로 12 m 안에 건물·막힘이 있으면 «건물 뒤» — 정상 가림. 막힘이 아닌 것(지붕·차양)에 가려진 곳만 센다 */
  const polys=m.blockers.filter(b=>b.poly&&!b.water);   /* 건물 윤곽만 — 차·부스(상자)까지 넣으면 요금소 지붕 밑도 «건물 뒤» 로 빠졌다 */
  const bigs=m.blockers.filter(b=>!b.poly&&!b.line&&b.hw>=4&&b.hd>=4);   /* 큰 상자(남산타워 기단 등)도 «건물» */
  const inBig=([x,z])=>bigs.some(b=>{ const c=Math.cos(b.rot||0),sn=Math.sin(b.rot||0),dx=x-b.x,dz=z-b.z,lx=dx*c-dz*sn,lz=dx*sn+dz*c; return Math.abs(lx)<b.hw&&Math.abs(lz)<b.hd; });
  const behindSolid=p=>{ for(let k=0.5;k<=24;k+=0.5){ const q=[p[0],p[1]+k]; if(polys.some(b=>inPoly(q,b.poly))||inBig(q)) return true; } return false; };
  /* 걸을 수 있는데 땅이 안 그려진 칸(빈 하늘·타일 없음) — 굽기 카메라가 원점 평면 기준이라 원점에서 먼 띠 구석(부산·대전 s354~ t204~)이 NEAR/FAR 밖으로 잘렸다 */
  const voids=[];
  for(let i=0;i<ns;i++) for(let j=0;j<nt;j++){ const p=FROM(m.walk.s0+(i+0.5)*G,m.walk.t0+(j+0.5)*G); if(blocked(p)) continue; const h=heightAt(zone,m,p[0],p[1]); if(h===null||h>1000){ voids.push('s'+(m.walk.s0+(i+0.5)*G).toFixed(0)+' t'+(m.walk.t0+(j+0.5)*G).toFixed(0)); continue; } cell[i*nt+j]=h>1.8&&!behindSolid(p)?1:0; }
  assert.equal(voids.length,0,zone+' 걸을 수 있는데 땅이 안 그려진 칸 '+voids.length+'곳: '+voids.slice(0,12).join(', '));
  const bad=[]; for(let i=0;i+4<=ns;i+=2) for(let j=0;j+4<=nt;j+=2){ let w=0,hd=0; for(let a2=0;a2<4;a2++) for(let b2=0;b2<4;b2++){ const v=cell[(i+a2)*nt+j+b2]; if(v>=0){ w++; if(v===1) hd++; } }
    if(w>=8&&hd/w>0.7) bad.push('s'+(m.walk.s0+i*G+4).toFixed(0)+' t'+(m.walk.t0+j*G+4).toFixed(0)); }
  assert.equal(bad.length,0,zone+' 대부분 가려진 칸 '+bad.length+'곳: '+bad.slice(0,20).join(', '));
 });
}
