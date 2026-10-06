// 강남대로 외형 시험을 휴대폰(Pixel 7 가로) 크기로 찍는다. node tools/serve.cjs & → node tools/2d/shoot-street.mjs [zoom] [out.png]
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
const ZOOM=process.argv[2]||'1', OUT=process.argv[3]||'docs/img/185-street-z'+ZOOM+'.png';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:915,height:412},deviceScaleFactor:2,isMobile:true,hasTouch:true});
p.on('console',m=>{ if(m.type()==='error'&&!/CERT|favicon/.test(m.text())) console.log('ERR',m.text()); }); p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto('http://127.0.0.1:'+(process.env.HWANGHON_PORT||8777)+'/tools/2d/look-street.html?zoom='+ZOOM+(process.env.Q||''));
await p.waitForFunction(()=>window.__STREET,{timeout:60000}); await p.evaluate(()=>__STREET.ready);
/* 헤드리스는 초당 1~2프레임 — 벽시계가 아니라 그려진 프레임을 센다 (CLAUDE.md §1) */
const f0=await p.evaluate(()=>__STREET.frames); await p.waitForFunction(f=>__STREET.frames>=f+4,f0,{timeout:180000});
await p.screenshot({path:OUT}); await b.close(); console.log('->',OUT);
