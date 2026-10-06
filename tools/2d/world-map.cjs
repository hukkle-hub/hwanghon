// 전국 지도 그림 (docs/design/192 §2.6): 지형 타일(terrarium, AWS 공개 · SRTM 등에서 — 출처 표기)을 받아 음영도 → maps/world/korea.png + korea.json
//   node tools/2d/world-map.cjs   (그다음 ffmpeg -i maps/world/korea.png -vf scale=1600:-1 -quality 78 maps/world/korea.webp)
// 투영: 웹 메르카토르 z9 (지도 위 점 = js/mmo/regions.js 의 위도·경도 → korea.json 으로 변환)
const {execFileSync}=require('child_process');
const fs=require('fs'),zlib=require('zlib'),path=require('path');
function dec(buf){let p=8,w,h,ct,idat=[];while(p<buf.length){const len=buf.readUInt32BE(p),type=buf.toString('ascii',p+4,p+8),d=buf.subarray(p+8,p+8+len);if(type==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);ct=d[9];}if(type==='IDAT')idat.push(d);if(type==='IEND')break;p+=12+len;}
const bpp=ct===6?4:3,raw=zlib.inflateSync(Buffer.concat(idat)),st=w*bpp,out=Buffer.alloc(h*st);for(let y=0;y<h;y++){const f=raw[y*(st+1)],src=raw.subarray(y*(st+1)+1,(y+1)*(st+1)),row=out.subarray(y*st,(y+1)*st),up=y?out.subarray((y-1)*st,y*st):null;for(let x=0;x<st;x++){const a=x>=bpp?row[x-bpp]:0,b=up?up[x]:0,c=up&&x>=bpp?up[x-bpp]:0;let v=src[x];if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}row[x]=v&255;}}return{w,h,bpp,out};}
function crc(b){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}c=0xffffffff;for(const x of b)c=t[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(type,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(type),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);}
function enc(w,h,rgba){const raw=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
const CACHE=process.env.DEM_CACHE||'/tmp/hwanghon-dem', Z=9; fs.mkdirSync(CACHE,{recursive:true});
const tl=(lat,lon)=>{ const n=2**Z, s=Math.sin(lat*Math.PI/180); return [Math.floor((lon+180)/360*n), Math.floor((0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n)]; };
const [tx0,ty0]=tl(38.9,124.3), [tx1,ty1]=tl(32.9,131.2), T=[];
for(let x=tx0;x<=tx1;x++) for(let y=ty0;y<=ty1;y++){ T.push([Z,x,y]); const f=path.join(CACHE,'t_'+x+'_'+y+'.png'); if(!fs.existsSync(f)) try{ execFileSync('curl',['-s','-m','30','-o',f,'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/'+Z+'/'+x+'/'+y+'.png']); }catch{} }
const xs=T.map(t=>t[1]),ys=T.map(t=>t[2]),X0=Math.min(...xs),Y0=Math.min(...ys),W=(Math.max(...xs)-X0+1)*256,H=(Math.max(...ys)-Y0+1)*256;
const hgt=new Float32Array(W*H).fill(-100);
for(const [z,x,y] of T){const f=path.join(CACHE,'t_'+x+'_'+y+'.png');if(!fs.existsSync(f)||!fs.statSync(f).size)continue;const im=dec(fs.readFileSync(f));
 for(let j=0;j<256;j++)for(let i=0;i<256;i++){const o=(j*256+i)*im.bpp;hgt[((y-Y0)*256+j)*W+(x-X0)*256+i]=im.out[o]*256+im.out[o+1]+im.out[o+2]/256-32768;}}
/* 음영: 북서쪽 빛 · 높이 색 (바다는 어둡게) — 해상도 z9 ≈ 픽셀당 250 m(위도 36°) */
const rgba=Buffer.alloc(W*H*4), mpp=40075016/(256*512)*Math.cos(36*Math.PI/180);
const tint=h=>h<=0?[18,24,34]:h<100?[70,86,60]:h<300?[92,100,66]:h<700?[120,104,74]:h<1200?[140,118,96]:[190,180,176];
for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const k=y*W+x,h=hgt[k];let c=tint(h);
 if(h>0){const dx=(hgt[k+1]-hgt[k-1])/(2*mpp),dy=(hgt[k+W]-hgt[k-W])/(2*mpp);const sh=Math.max(0.25,Math.min(1.35,1+(-dx-(-dy))*2.2*0.7));c=c.map(v=>Math.min(255,v*sh));}
 rgba[k*4]=c[0];rgba[k*4+1]=c[1];rgba[k*4+2]=c[2];rgba[k*4+3]=255;}
/* 남한 + 울릉도로 자른다 */
const gp=(lat,lon)=>{ const n=2**Z*256, s=Math.sin(lat*Math.PI/180); return [(lon+180)/360*n-X0*256, (0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n-Y0*256]; };
const [cx0,cy0]=gp(38.75,124.4).map(Math.floor), [cx1,cy1]=gp(33.0,131.1).map(Math.ceil), CW=cx1-cx0, CH=cy1-cy0, crop=Buffer.alloc(CW*CH*4);
for(let y=0;y<CH;y++) rgba.copy(crop,y*CW*4,((cy0+y)*W+cx0)*4,((cy0+y)*W+cx0+CW)*4);
fs.mkdirSync('maps/world',{recursive:true}); fs.writeFileSync('maps/world/korea.png',enc(CW,CH,crop));
fs.writeFileSync('maps/world/korea.json',JSON.stringify({ z:Z, px0:X0*256+cx0, py0:Y0*256+cy0, w:CW, h:CH, file:'korea.webp', source:'terrain tiles (terrarium) — SRTM·GMTED·ETOPO1 등 (https://github.com/tilezen/joerd/blob/master/docs/attribution.md)' }));
let land=0;for(let i=0;i<W*H;i++)if(hgt[i]>0)land++;

console.log('전국 지도',CW,'x',CH,'land px',land,'≈',(land*mpp*mpp/1e6).toFixed(0),'km² (북한·일본 일부 포함)');
