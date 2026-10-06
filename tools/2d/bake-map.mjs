// 2D 맵 굽기: node tools/serve.cjs & → node tools/2d/bake-map.mjs [id=gangnam]  →  maps/2d/<id>/map.json + t_<i>_<j>.webp + d_<i>_<j>.png
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const ID=process.argv[2]||'gangnam', DIR='maps/2d/'+ID+'/'; fs.mkdirSync(DIR,{recursive:true});
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage(); p.on('pageerror',e=>console.log('PAGEERR',e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/CERT|favicon/.test(m.text())) console.log('ERR',m.text()); });
await p.goto('http://127.0.0.1:'+(process.env.HWANGHON_PORT||8777)+'/tools/2d/bake-map.html'); await p.waitForFunction(()=>window.__BAKEMAP,{timeout:120000});
const meta=await p.evaluate(()=>__BAKEMAP.plan()), n=await p.evaluate(()=>__BAKEMAP.count); meta.tiles=[];
for(let k=0;k<n;k++){ const t=await p.evaluate(k=>__BAKEMAP.tile(k),k); const cn='t_'+t.i+'_'+t.j+'.webp', dn='d_'+t.i+'_'+t.j+'.png';
  fs.writeFileSync(DIR+cn, Buffer.from(t.color.split(',')[1],'base64')); fs.writeFileSync(DIR+dn, Buffer.from(t.depth.split(',')[1],'base64'));
  meta.tiles.push({ i:t.i, j:t.j, u0:+t.u0.toFixed(4), v0:+t.v0.toFixed(4), color:cn, depth:dn }); process.stdout.write('.'); }
fs.writeFileSync(DIR+'map.json', JSON.stringify(meta,null,1)); await b.close();
const bytes=fs.readdirSync(DIR).reduce((a,f)=>a+fs.statSync(DIR+f).size,0);
console.log('\n타일',meta.cols+'×'+meta.rows,'=',n,'· 합계',(bytes/1e6).toFixed(1),'MB ->',DIR);
