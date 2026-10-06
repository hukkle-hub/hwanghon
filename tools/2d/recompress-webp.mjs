// 구운 색 타일(webp)을 더 낮은 품질로 다시 굽는다 — 숲처럼 잔무늬가 많은 지역은 0.82 로 한 장 70 KB 였다.
//   node tools/2d/recompress-webp.mjs <zone> <품질 0~1> [표본만=1]
// 브라우저 캔버스로 다시 인코딩한다(cwebp·sharp 가 없는 환경). 더 커지면 원본을 둔다.
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs'; import fs from 'node:fs'; import path from 'node:path';
const Z=process.argv[2], Q=+(process.argv[3]||0.65), SAMPLE=process.argv[4]==='1', DIR=path.join('maps','2d',Z);
const files=fs.readdirSync(DIR).filter(f=>/^t_.*\.webp$/.test(f)); const pick=SAMPLE?files.filter((_,i)=>i%97===0):files;
const b=await chromium.launch(); const p=await b.newPage();
let before=0, after=0;
for(const f of pick){ const src=fs.readFileSync(path.join(DIR,f)); before+=src.length;
  const out=await p.evaluate(async([b64,q])=>{ const img=new Image(); img.src='data:image/webp;base64,'+b64; await img.decode(); const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; c.getContext('2d').drawImage(img,0,0); return c.toDataURL('image/webp',q).split(',')[1]; },[src.toString('base64'),Q]);
  const buf=Buffer.from(out,'base64');
  if(SAMPLE){ fs.writeFileSync(path.join(process.env.SAMPLE_DIR||'/tmp',f.replace('.webp','-q'+Q+'.webp')),buf); after+=buf.length; continue; }
  if(buf.length<src.length){ fs.writeFileSync(path.join(DIR,f),buf); after+=buf.length; } else after+=src.length; }
await b.close(); console.log(Z,'타일',pick.length,(before/1e6).toFixed(1)+' MB →',(after/1e6).toFixed(1)+' MB','(품질',Q+')');
