// 필드 동기화 시나리오 (docs/design/185 §6.4): 파티 서버를 이 프로세스에서 띄우고 휴대폰 두 대(아인·카인)로 같은 지역에 들어간다.
// node tools/2d/field-scenario.mjs  →  docs/img/185-field-a.png · 185-field-b.png
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);
const {createPartyServer}=require('../../server/index.cjs'), {Store}=require('../../server/store.cjs');
const app=createPartyServer({store:new Store(null)}), addr=await app.listen(0,'127.0.0.1'), base='http://127.0.0.1:'+addr.port;
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
async function phone(char){ const ctx=await b.newContext({viewport:{width:915,height:412},deviceScaleFactor:2,isMobile:true,hasTouch:true}); const p=await ctx.newPage();
  p.on('pageerror',e=>console.log(char,'PAGEERR',e.message)); p.on('console',m=>{ if(['error','warning'].includes(m.type())&&!/CERT|favicon|ExperimentalWarning/.test(m.text())) console.log(char,m.type(),m.text()); });
  await p.goto(base+'/mmo.html?online=1&lod=1&char='+char); await p.waitForFunction(()=>window.__MMO&&!document.getElementById('load'),{timeout:300000}); return p; }
const A=await phone('ain'), B=await phone('kain');
const frames=async(p,n)=>{ const f0=await p.evaluate(()=>__MMO.frames); await p.waitForFunction(([f,n])=>__MMO.frames>=f+n,[f0,n],{timeout:300000}); };
/* A 를 B 옆 길 위로 옮기고 달리게 한다 — B 화면에 A 가 «달리는 아인» 으로 와야 한다 */
const bp=await B.evaluate(()=>{ const p=__MMO.me.root.position; return [p.x,p.z]; });
await A.evaluate(([x,z])=>__MMO.teleport(x+1.6,z+0.8,0.6),bp);
await B.waitForFunction(()=>__MMO.remotes.size>=1&&[...__MMO.remotes.values()].every(r=>r.root),{timeout:300000});
await A.waitForFunction(()=>__MMO.remotes.size>=1&&[...__MMO.remotes.values()].every(r=>r.root),{timeout:300000});
await frames(A,4); await frames(B,4);
const rep=async p=>p.evaluate(()=>({ net:document.getElementById('net').textContent, remotes:[...__MMO.remotes.values()].map(r=>({id:r.id,x:+r.root.position.x.toFixed(2),z:+r.root.position.z.toFixed(2)})), me:[+__MMO.me.root.position.x.toFixed(2),+__MMO.me.root.position.z.toFixed(2)] }));
const ra=await rep(A), rb=await rep(B); console.log('A',JSON.stringify(ra)); console.log('B',JSON.stringify(rb));
console.log('서버 필드 인원',app.field.players.size,'· A 위치 오차(B 가 본 A − A 자신)', Math.hypot(rb.remotes[0].x-ra.me[0], rb.remotes[0].z-ra.me[1]).toFixed(2),'m');
await A.screenshot({path:'docs/img/185-field-a.png'}); await B.screenshot({path:'docs/img/185-field-b.png'});
await b.close(); await app.close(); console.log('-> docs/img/185-field-a.png, 185-field-b.png');
