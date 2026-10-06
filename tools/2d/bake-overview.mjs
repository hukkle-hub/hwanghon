// 미니맵 그림: maps/2d/<zone>/overview.webp + map.json overview{u0,u1,v0,v1,w,h} (docs/design/190 §5)
//   node tools/serve.cjs & → node tools/2d/bake-overview.mjs <zone…>   (굽기 뒤에 — 타일은 건드리지 않는다)
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for(const ID of process.argv.slice(2)){ const F='maps/2d/'+ID+'/map.json', m=JSON.parse(fs.readFileSync(F,'utf8'));
  const p=await b.newPage(); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('http://127.0.0.1:'+(process.env.HWANGHON_PORT||8777)+'/tools/2d/bake-map.html?zone='+ID); await p.waitForFunction(()=>window.__BAKEMAP,null,{timeout:600000});
  const o=await p.evaluate(()=>__BAKEMAP.overview(1400)); await p.close();
  const buf=Buffer.from(o.url.split(',')[1],'base64'); fs.writeFileSync('maps/2d/'+ID+'/overview.webp',buf);
  const {url,...rest}=o; m.overview={ file:'overview.webp', ...rest }; fs.writeFileSync(F, JSON.stringify(m,null,1));
  console.log(ID,'미니맵',o.w+'×'+o.h,(buf.length/1e3).toFixed(0)+' KB'); }
await b.close();
