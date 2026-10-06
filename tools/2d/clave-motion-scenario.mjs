/* 클레이브 모션 접점표 — 실제 mmo.html에서 GLB·예고·검 궤적을 프레임 기준으로 찍는다.
   node tools/2d/clave-motion-scenario.mjs [출력 폴더]
   MOBILE=land 로 915×412 재검수. 벽시계 대기 대신 __MMO.frames만 센다. */
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),require=createRequire(ROOT+'/'),fs=require('node:fs');
const {createPartyServer}=require('./server/index.cjs');
const OUT=process.argv[2]||path.join(ROOT,'.clave-motion-shots'),M=process.env.MOBILE||'',VIEW=M?{width:915,height:412}:{width:1280,height:720};
fs.mkdirSync(OUT,{recursive:true});const app=createPartyServer(),addr=await app.listen(0,'127.0.0.1'),base=`http://127.0.0.1:${addr.port}`;
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),ctx=await browser.newContext({viewport:VIEW,deviceScaleFactor:1,isMobile:!!M,hasTouch:!!M}),page=await ctx.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(base+'/mmo.html?zone=gangnam_b1&char=kain');
await page.waitForFunction(()=>{if(!window.__MMO)return false;const b=window.__MMO.bosses?.find(x=>x.b.id==='clave');return window.__MMO.frames>3&&b?.root&&b?.fx&&b?.actions?.walk&&b?.actions?.atk_claveshut;},null,{timeout:240000});
const frames=async n=>{const f=await page.evaluate(()=>__MMO.frames);await page.waitForFunction(x=>__MMO.frames>=x,f+n,{timeout:240000});};
await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave');__MMO.teleport(b.b.x-3.15,b.b.z,Math.PI/2);});await frames(8);
const shot=async(name,motion,skill,elapsed,clipTime=null)=>{await page.evaluate(v=>__MMO.bossPose('clave',...v),[motion,skill,elapsed,clipTime]);await frames(3);const file=name+(M?'-land':'')+'.png';await page.screenshot({path:path.join(OUT,file)});console.log('찍음',file);};

await shot('01-idle-weight','idle','',0,.36);
await shot('02-walk-left-contact','walk','',100,.10);
await shot('03-walk-right-contact','walk','',530,.53);
await shot('04-shutter-held','skill','shutter',1350);
await shot('05-shutter-impact','skill','shutter',1720);
await shot('06-storm-hit1','skill','storm',1315);
await shot('07-storm-hit2','skill','storm',2135);
await shot('08-storm-counter-window','skill','storm',2780);
await shot('09-storm-final','skill','storm',2955);
await shot('10-slam-held','skill','slam',1320);
await shot('11-slam-impact','skill','slam',1540);
await shot('12-counter-stagger','stagger','storm',180,.09);
await page.evaluate(()=>__MMO.bossMsg({type:'field',bossNow:Date.now(),self:{hp:6200,maxHp:24450,dead:0,respawnAt:0,invulnUntil:0},hurt:[9001,5300,'clave','slam','hit',1,Date.now()]}));await frames(3);await page.screenshot({path:path.join(OUT,'13-player-hit'+(M?'-land':'')+'.png')});
await page.evaluate(()=>__MMO.bossMsg({type:'field',bossNow:Date.now(),self:{hp:0,maxHp:24450,dead:1,respawnAt:Date.now()+4200,invulnUntil:0},hurt:[9002,6200,'clave','storm','dead',3,Date.now()]}));await frames(3);await page.screenshot({path:path.join(OUT,'14-player-down'+(M?'-land':'')+'.png')});
const report=await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),i=__MMO.info();return {viewport:[innerWidth,innerHeight],clips:Object.keys(b.actions),motion:b.motionClip,calls:i.calls,triangles:i.triangles,boss:[b.root.position.x,b.root.position.z],player:[__MMO.me.root.position.x,__MMO.me.root.position.z]};});
console.log(JSON.stringify(report));if(errors.length)throw Error('브라우저 오류: '+errors.join(' | '));await browser.close();await app.close();
