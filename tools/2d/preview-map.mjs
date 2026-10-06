// 실제 공간 맵 미리보기 (굽기 전): node tools/2d/preview-map.mjs <zone> <s,t,viewH;…> [접두]
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs'; import fs from 'node:fs';
const Z=process.argv[2]||'gangnam-real', SPOTS=(process.argv[3]||'0,10,40').split(';').map(x=>x.split(',').map(Number)), PRE=process.argv[4]||'/tmp/preview';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}); const p=await b.newPage({viewport:{width:1830,height:824}});
p.on('pageerror',e=>console.log('PAGEERR',e.message)); p.on('console',m=>{ if(/env-osm|rror/.test(m.text())&&!/CERT/.test(m.text())) console.log(m.text()); });
await p.goto('http://127.0.0.1:'+(process.env.HWANGHON_PORT||8777)+'/tools/2d/bake-map.html?zone='+Z); await p.waitForFunction(()=>window.__BAKEMAP,null,{timeout:600000});
console.log(JSON.stringify(await p.evaluate(()=>({ count:__BAKEMAP.count, total:__BAKEMAP.total, walk:__BAKEMAP.plan().walk, spawn:__BAKEMAP.plan().spawn, exits:__BAKEMAP.plan().exits.map(e=>e.ref) }))));
let i=0; for(const [s,t,vh] of SPOTS){ const url=await p.evaluate(([s,t,vh])=>__BAKEMAP.preview(s,t,vh,1830,824),[s,t,vh]); fs.writeFileSync(PRE+'-'+(i++)+'.png',Buffer.from(url.split(',')[1],'base64')); }
await b.close(); console.log('->',PRE+'-*.png');
