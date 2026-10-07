// 2D 맵 굽기: node tools/serve.cjs & → node tools/2d/bake-map.mjs [id=gangnam]  →  maps/2d/<id>/map.json + t_<i>_<j>.webp + d_<i>_<j>.png
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const ID=process.argv[2]||'gangnam', FINAL='maps/2d/'+ID+'/';
/* OUT=<임시 폴더> 이면 거기에 다 구운 뒤 마지막에 한 번에 바꿔 넣는다 — 굽는 40분 동안 저장소가 반쯤 바뀐 채로 있지 않게 */
const DIR=process.env.OUT?process.env.OUT.replace(/\/?$/,'/'):FINAL; fs.mkdirSync(DIR,{recursive:true});
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage(); p.on('pageerror',e=>console.log('PAGEERR',e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/CERT|favicon/.test(m.text())) console.log('ERR',m.text()); });
await p.goto('http://127.0.0.1:'+(process.env.HWANGHON_PORT||8777)+'/tools/2d/bake-map.html?zone='+ID+(process.env.PX?'&px='+process.env.PX:'')); await p.waitForFunction(()=>window.__BAKEMAP,null,{timeout:600000});
const meta=await p.evaluate(()=>__BAKEMAP.plan()), n=+(process.env.LIMIT||await p.evaluate(()=>__BAKEMAP.count)), total=await p.evaluate(()=>__BAKEMAP.total); meta.tiles=[]; console.log('타일',n,'/ 격자',total);
const t0=Date.now();
/* RESUME=1 — 컨테이너가 굽다가 재시작되면 OUT 에 이미 쓴 타일은 다시 그리지 않는다(같은 장면 설정일 때만 — 설정이 바뀌었으면 OUT 을 지우고 처음부터) */
let resumed=0;
for(let k=0;k<n;k++){ if(process.env.RESUME){ const f=await p.evaluate(k=>__BAKEMAP.info(k),k), cn='t_'+f.i+'_'+f.j+'.webp', dn='d_'+f.i+'_'+f.j+'.png';
    if(fs.existsSync(DIR+cn)&&fs.existsSync(DIR+dn)&&fs.statSync(DIR+cn).size>0&&fs.statSync(DIR+dn).size>0){ meta.tiles.push({ i:f.i, j:f.j, u0:+f.u0.toFixed(4), v0:+f.v0.toFixed(4), color:cn, depth:dn }); resumed++; continue; } }
  const t=await p.evaluate(k=>__BAKEMAP.tile(k),k); const cn='t_'+t.i+'_'+t.j+'.webp', dn='d_'+t.i+'_'+t.j+'.png';
  fs.writeFileSync(DIR+cn, Buffer.from(t.color.split(',')[1],'base64')); fs.writeFileSync(DIR+dn, Buffer.from(t.depth.split(',')[1],'base64'));
  meta.tiles.push({ i:t.i, j:t.j, u0:+t.u0.toFixed(4), v0:+t.v0.toFixed(4), color:cn, depth:dn }); if(k%20===19) console.log(k+1,'/',n,((Date.now()-t0)/1000/(k+1)).toFixed(1)+' s/타일'); }
if(resumed) console.log('이어 굽기: 이미 있던 타일',resumed); fs.writeFileSync(DIR+'map.json', JSON.stringify(meta,null,1)); await b.close();
if(DIR!==FINAL){ fs.mkdirSync(FINAL,{recursive:true}); for(const f of fs.readdirSync(FINAL)) if(/^[td]_\d+_\d+\.(webp|png)$/.test(f)||f==='map.json') fs.unlinkSync(FINAL+f);
  for(const f of fs.readdirSync(DIR)) fs.copyFileSync(DIR+f, FINAL+f); console.log('바꿔 넣음 ->',FINAL); }
const bytes=fs.readdirSync(DIR).reduce((a,f)=>a+fs.statSync(DIR+f).size,0);
console.log('\n타일',n,'장 (격자',meta.cols+'×'+meta.rows+') · 합계',(bytes/1e6).toFixed(1),'MB ->',DIR);
