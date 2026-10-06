/* 구운 높이 규약 — 인물이 서는 곳의 «보이는 면 높이» 는 바닥(≈ 0)이어야 한다 (docs/design/185 §6.6)
   첫 던전은 물면(0.9 m)을 높이 그림에 구워 넣어 인물의 무릎 아래가 «땅에 박힌» 듯 잘렸다(디렉터 지적 2026-10-06).
   높이 그림(d_*.png, 512², R·G 16비트)을 직접 풀어 출발점·문·보스 자리 밑을 읽는다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const MAPS=path.join(__dirname,'..','maps','2d');
/* 최소 PNG 해독: 8비트 RGBA, 인터레이스 없음 (굽기 도구가 쓰는 형식) */
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
 const im=png(fs.readFileSync(path.join(MAPS,zone,tl.depth))),px=Math.min(im.w-1,Math.floor((u-tl.u0)/T*im.w)),py=Math.min(im.h-1,Math.floor((tl.v0-v)/T*im.h)),c=im.px(px,py);
 return (c[0]*256+c[1])/65535*m.hmax; }
for(const zone of fs.readdirSync(MAPS).filter(z=>fs.existsSync(path.join(MAPS,z,'map.json')))){
 test('구운 높이: '+zone+' — 출발점·문·보스 자리 밑은 바닥 높이',()=>{
  const m=JSON.parse(fs.readFileSync(path.join(MAPS,zone,'map.json'),'utf8')); if(m.depthMode!=='height') return;
  const spots=[['출발점',m.spawn],...(m.gates||[]).map(g=>['문 '+g.id,g]),...(m.bosses||[]).map(b=>['보스 '+b.id,b])];
  for(const [name,s] of spots){ const h=heightAt(zone,m,s.x,s.z); assert.ok(h!==null,zone+' '+name+' 타일 없음'); assert.ok(h<0.15,zone+' '+name+' 밑 높이 '+h.toFixed(2)+' m — 인물이 그만큼 묻힌다'); }
 });
}
