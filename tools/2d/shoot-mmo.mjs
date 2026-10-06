// 2D 맵 MMORPG 시제품 찍기 (Pixel 7 가로·세로). node tools/serve.cjs & → node tools/2d/shoot-mmo.mjs <이름> [쿼리] [s,t,yaw | gate:<id>,dx,dz | boss:<id>,dx,dz]
//   OUT=<파일> 이면 docs/img 대신 거기에
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
const NAME=process.argv[2]||'mmo', QS=process.argv[3]||'', AT=process.argv[4], PORT=process.env.MOBILE==='port';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:PORT?{width:412,height:915}:{width:915,height:412},deviceScaleFactor:2,isMobile:true,hasTouch:true});
p.on('pageerror',e=>console.log('PAGEERR',e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/CERT|favicon/.test(m.text())) console.log('ERR',m.text()); });
await p.goto('http://127.0.0.1:'+(process.env.HWANGHON_PORT||8777)+'/mmo.html?'+QS);
await p.waitForFunction(()=>window.__MMO&&!document.getElementById('load'),{timeout:240000});
if(AT&&/^(gate|boss):/.test(AT)){ const [kind,rest]=AT.split(':'), [id,dx,dz]=rest.split(','); await p.evaluate(([kind,id,dx,dz])=>{ const m=__MMO.meta, o=(kind==='gate'?m.gates:m.bosses).find(g=>g.id===id); __MMO.teleport(o.x+dx,o.z+dz,0); },[kind,id,+dx||0,+dz||0]); }
else if(AT){ const [s,t,yaw]=AT.split(',').map(Number); await p.evaluate(([s,t,yaw])=>{ const [x,z]=__MMO.fromRoad(s,t); __MMO.teleport(x,z,yaw); },[s,t,yaw]); }
/* 헤드리스는 초당 1~2프레임 — 그려진 프레임을 센다 (CLAUDE.md §1) */
const f0=await p.evaluate(()=>__MMO.frames); await p.waitForFunction(f=>__MMO.frames>=f+14,f0,{timeout:600000});   /* 타일 스트리밍·출구 표시가 따라올 때까지 */
const info=await p.evaluate(()=>__MMO.info()); console.log(NAME,'콜',info.calls,'삼각형',info.triangles);
const st=await p.evaluate(()=>({ gate:__MMO.gateNear&&__MMO.gateNear.id, boss:__MMO.inBoss&&__MMO.inBoss.b.id, place:document.getElementById('place').textContent })); console.log(JSON.stringify(st));
const OUT=process.env.OUT||'docs/img/185-'+NAME+'.png'; await p.screenshot({path:OUT}); await b.close(); console.log('->',OUT);
