// 깊이(높이) 그림 PNG 를 같은 픽셀 그대로 다시 압축한다 — 행마다 가장 작은 필터 + zlib 9.
//   node tools/2d/repack-depth.mjs [zone…]   (없으면 전부) → 다음에 tile-hashes.mjs
// 캔버스 toDataURL 의 PNG 는 필터를 고르지 않아 컸다(강남 깊이 18 MB > 색 15 MB). 표본 40장 1.38 MB → 0.31 MB (23%).
// 무손실 WebP 는 12% 까지 가지만 시험(tests/map-height)이 PNG 를 직접 풀어 읽는다 — 형식은 그대로 둔다.
// 다시 풀어 픽셀이 한 개라도 다르면 멈춘다.
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
function dec(buf){let p=8,w,h,idat=[];while(p<buf.length){const len=buf.readUInt32BE(p),type=buf.toString('ascii',p+4,p+8),d=buf.subarray(p+8,p+8+len);if(type==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);}if(type==='IDAT')idat.push(d);if(type==='IEND')break;p+=12+len;}
const raw=zlib.inflateSync(Buffer.concat(idat)),bpp=4,st=w*bpp,out=Buffer.alloc(h*st);for(let y=0;y<h;y++){const f=raw[y*(st+1)],src=raw.subarray(y*(st+1)+1,(y+1)*(st+1)),row=out.subarray(y*st,(y+1)*st),up=y?out.subarray((y-1)*st,y*st):null;for(let x=0;x<st;x++){const a=x>=bpp?row[x-bpp]:0,b=up?up[x]:0,c=up&&x>=bpp?up[x-bpp]:0;let v=src[x];if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}row[x]=v&255;}}return{w,h,out};}
function crc(b){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}c=0xffffffff;for(const x of b)c=t[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(type,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(type),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);}
function enc({w,h,out},mode){const bpp=4,st=w*bpp,raw=Buffer.alloc(h*(st+1));for(let y=0;y<h;y++){const row=out.subarray(y*st,(y+1)*st),up=y?out.subarray((y-1)*st,y*st):Buffer.alloc(st);let best=null,bs=1e18;
for(const f of mode==='paeth'?[4]:[0,1,2,3,4]){const r=Buffer.alloc(st);let s=0;for(let x=0;x<st;x++){const a=x>=bpp?row[x-bpp]:0,b=up[x],c=x>=bpp?up[x-bpp]:0;let pr=0;if(f===1)pr=a;else if(f===2)pr=b;else if(f===3)pr=(a+b)>>1;else if(f===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);pr=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}const v=(row[x]-pr)&255;r[x]=v;s+=v<128?v:256-v;}if(s<bs){bs=s;best=[f,r];}}
raw[y*(st+1)]=best[0];best[1].copy(raw,y*(st+1)+1);}
const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw,{level:9,memLevel:9})),chunk('IEND',Buffer.alloc(0))]);}

const ROOT='maps/2d', zones=process.argv.slice(2).length?process.argv.slice(2):fs.readdirSync(ROOT).filter(z=>fs.existsSync(path.join(ROOT,z,'map.json')));
let A=0,B=0;
for(const z of zones){ const m=JSON.parse(fs.readFileSync(path.join(ROOT,z,'map.json'),'utf8')); let a=0,b=0;
  for(const t of m.tiles){ const f=path.join(ROOT,z,t.depth); if(!f.endsWith('.png')) continue; const buf=fs.readFileSync(f), im=dec(buf), e=enc(im);
    if(Buffer.compare(dec(e).out,im.out)) throw Error('픽셀이 다르다: '+f); a+=buf.length; if(e.length<buf.length){ fs.writeFileSync(f,e); b+=e.length; } else b+=buf.length; }
  A+=a; B+=b; console.log(z.padEnd(16),(a/1e6).toFixed(1),'MB →',(b/1e6).toFixed(1),'MB'); }
console.log('합계',(A/1e6).toFixed(1),'MB →',(B/1e6).toFixed(1),'MB');
