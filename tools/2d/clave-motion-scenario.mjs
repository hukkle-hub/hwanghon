/* 클레이브 모션 접점표 — 실제 mmo.html에서 GLB·예고·검 궤적·공동 피격을 프레임 기준으로 찍는다.
   PLAYWRIGHT_MODULE=<playwright/index.mjs> PLAYWRIGHT_BROWSER=<chrome> node tools/2d/clave-motion-scenario.mjs [출력 폴더]
   MOBILE=land 로 915×412 재검수. 벽시계 대기 대신 __MMO.frames만 센다. */
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),require=createRequire(ROOT+'/'),fs=require('node:fs');
const playwrightCandidates=[process.env.PLAYWRIGHT_MODULE,
 process.env.CODEX_MCP_NODE_PATH&&path.join(path.dirname(process.env.CODEX_MCP_NODE_PATH),'node_modules/playwright/index.mjs'),
 process.env.USERPROFILE&&path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'),
 '/opt/node22/lib/node_modules/playwright/index.mjs'].filter(Boolean);
const modulePath=playwrightCandidates.find(x=>fs.existsSync(x));
if(!modulePath)throw Error('Playwright를 찾지 못했습니다. PLAYWRIGHT_MODULE=<playwright/index.mjs>을 지정하세요.');
const {chromium}=await import(/^[A-Za-z]:[\\/]/.test(modulePath)?pathToFileURL(modulePath).href:modulePath);
const localBrowsers=process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'ms-playwright'),installed=[];
if(localBrowsers&&fs.existsSync(localBrowsers))for(const d of fs.readdirSync(localBrowsers).sort().reverse())for(const rel of ['chrome-headless-shell-win64/chrome-headless-shell.exe','chrome-win64/chrome.exe'])installed.push(path.join(localBrowsers,d,rel));
const browserPath=[process.env.PLAYWRIGHT_BROWSER,chromium.executablePath(),...installed,
 process.env.PROGRAMFILES&&path.join(process.env.PROGRAMFILES,'Google/Chrome/Application/chrome.exe'),
 process.env['PROGRAMFILES(X86)']&&path.join(process.env['PROGRAMFILES(X86)'],'Microsoft/Edge/Application/msedge.exe')].filter(Boolean).find(x=>fs.existsSync(x));
const {createPartyServer}=require('./server/index.cjs');
const OUT=process.argv[2]||path.join(ROOT,'.clave-motion-shots'),M=process.env.MOBILE||'',VIEW=M?{width:915,height:412}:{width:1280,height:720};
fs.mkdirSync(OUT,{recursive:true});const app=createPartyServer(),addr=await app.listen(0,'127.0.0.1'),base=`http://127.0.0.1:${addr.port}`;
const browser=await chromium.launch({...(browserPath&&{executablePath:browserPath}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),ctx=await browser.newContext({viewport:VIEW,deviceScaleFactor:1,isMobile:!!M,hasTouch:!!M}),page=await ctx.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(base+'/mmo.html?zone=gangnam_b1&char=kain'+(M?'&lod=1':''));
await page.waitForFunction(()=>{if(!window.__MMO)return false;const b=window.__MMO.bosses?.find(x=>x.b.id==='clave');return window.__MMO.frames>3&&b?.root&&b?.fx&&b?.actions?.walk&&b?.actions?.atk_claveshut;},null,{timeout:240000});
const frames=async n=>{const f=await page.evaluate(()=>__MMO.frames);await page.waitForFunction(x=>__MMO.frames>=x,f+n,{timeout:240000});};
await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave');__MMO.teleport(b.b.x-3.15,b.b.z,Math.PI/2);});await frames(8);
const shot=async(name,motion,skill,elapsed,clipTime=null,footDust=false)=>{await page.evaluate(v=>__MMO.bossPose('clave',...v),[motion,skill,elapsed,clipTime]);await frames(footDust?1:3);const gait=footDust?await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),pos=f=>{if(!f)return null;const p=f.position.clone();f.getWorldPosition(p);return [+p.x.toFixed(3),+p.y.toFixed(3),+p.z.toFixed(3)];};return {dustNext:b.fx.dustNext,dustLive:Array.from(b.fx.dustLife).filter(x=>x>0).length,lastStep:b.fx.lastStep,feet:b.fx.feet.map(pos)};}):null;const file=name+(M?'-land':'')+'.png';await page.screenshot({path:path.join(OUT,file)});console.log('찍음',file);return gait;};

await shot('01-idle-weight','idle','',0,.36);
const leftGait=await shot('02-walk-left-contact','walk','',100,.10,true);
const rightGait=await shot('03-walk-right-contact','walk','',530,.53,true),gait={left:leftGait,right:rightGait};
const feetDistinct=g=>g.feet.length===2&&g.feet.every(Boolean)&&Math.hypot(g.feet[0][0]-g.feet[1][0],g.feet[0][2]-g.feet[1][2])>.08;
if(leftGait.dustNext<9||leftGait.dustLive<1||rightGait.dustNext<18||rightGait.dustLive<1||!feetDistinct(leftGait)||!feetDistinct(rightGait))throw Error('양발 접지 먼지/발 뼈 누락: '+JSON.stringify(gait));
await shot('04-shutter-held','skill','shutter',1350);
await shot('05-shutter-impact','skill','shutter',1720);
await shot('06-storm-hit1','skill','storm',1315);
await shot('07-storm-hit2','skill','storm',2135);
await shot('08-storm-counter-window','skill','storm',2780);
await shot('09-storm-final','skill','storm',2955);
await shot('10-slam-held','skill','slam',1320);
await shot('11-slam-impact','skill','slam',1540);
await shot('12-counter-stagger','stagger','storm',180,.09);
const fxState=()=>page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave');return {hitNext:b.fx.hitNext,dustNext:b.fx.dustNext,lastImpactSeq:b.fx.lastImpactSeq};});
const sendImpact=(seq,crit,at=null)=>page.evaluate(v=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),x=b.root.position.x-1.05,z=b.root.position.z,stamp=v.at??Date.now();__MMO.bossMsg({type:'field',bossNow:Date.now(),bossImpacts:[['clave',v.seq,x,z,v.crit?1:0,0,stamp]]});return stamp;}, {seq,crit,at});
const beforeImpact=await fxState(),normalSeq=beforeImpact.lastImpactSeq+1;
const normalAt=await sendImpact(normalSeq,false);await frames(1);const normalImpact=await fxState();
if(normalImpact.hitNext-beforeImpact.hitNext!==12||normalImpact.lastImpactSeq!==normalSeq)throw Error('일반 공동 피격 실패: '+JSON.stringify({beforeImpact,normalImpact}));
await page.screenshot({path:path.join(OUT,'13-shared-impact'+(M?'-land':'')+'.png')});
await sendImpact(normalSeq,false,normalAt);await frames(1);const duplicateImpact=await fxState();
if(duplicateImpact.hitNext!==normalImpact.hitNext||duplicateImpact.lastImpactSeq!==normalImpact.lastImpactSeq)throw Error('같은 순번 중복 제거 실패: '+JSON.stringify({normalImpact,duplicateImpact}));
const critSeq=normalSeq+1;await sendImpact(critSeq,true);await frames(1);const critImpact=await fxState();
if(critImpact.hitNext-duplicateImpact.hitNext!==22||critImpact.lastImpactSeq!==critSeq)throw Error('치명 공동 피격 실패: '+JSON.stringify({duplicateImpact,critImpact}));
await page.screenshot({path:path.join(OUT,'14-shared-crit'+(M?'-land':'')+'.png')});
await page.evaluate(()=>__MMO.bossMsg({type:'field',bossNow:Date.now(),self:{hp:6200,maxHp:24450,dead:0,respawnAt:0,invulnUntil:0},hurt:[9001,5300,'clave','slam','hit',1,Date.now()]}));await frames(3);await page.screenshot({path:path.join(OUT,'15-player-hit'+(M?'-land':'')+'.png')});
await page.evaluate(()=>__MMO.bossMsg({type:'field',bossNow:Date.now(),self:{hp:0,maxHp:24450,dead:1,respawnAt:Date.now()+4200,invulnUntil:0},hurt:[9002,6200,'clave','storm','dead',3,Date.now()]}));await frames(3);await page.screenshot({path:path.join(OUT,'16-player-down'+(M?'-land':'')+'.png')});
const deathSeq=critSeq+1,deathImpact=await page.evaluate(seq=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),x=b.root.position.x-1.05,z=b.root.position.z,at=Date.now();__MMO.bossMsg({type:'bossHit',boss:'clave',dmg:7777,crit:false,counter:true,down:true,impact:[seq,x,z,at]});return {at,alive:b.alive,hitLive:Array.from(b.fx.hitLife).filter(x=>x>0).length,rings:b.fx.rings.length,hitNext:b.fx.hitNext,lastImpactSeq:b.fx.lastImpactSeq};},deathSeq);
if(deathImpact.alive||deathImpact.hitLive<1||deathImpact.rings<1||deathImpact.hitNext-critImpact.hitNext!==30||deathImpact.lastImpactSeq!==deathSeq)throw Error('마지막 타격 효과 생성 실패: '+JSON.stringify(deathImpact));
const deathDuplicate=await page.evaluate(v=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),x=b.root.position.x-1.05,z=b.root.position.z;__MMO.bossMsg({type:'field',bossNow:Date.now(),bosses:[['clave',0]],bossImpacts:[['clave',v.seq,x,z,0,1,v.at]]});return {hitLive:Array.from(b.fx.hitLife).filter(x=>x>0).length,rings:b.fx.rings.length,hitNext:b.fx.hitNext,lastImpactSeq:b.fx.lastImpactSeq};},{seq:deathSeq,at:deathImpact.at});
if(deathDuplicate.hitNext!==deathImpact.hitNext||deathDuplicate.hitLive<1||deathDuplicate.lastImpactSeq!==deathSeq)throw Error('사망 스냅숏 중복 제거 실패: '+JSON.stringify({deathImpact,deathDuplicate}));await frames(45);
const deathCleanup=await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave');return {alive:b.alive,hitLive:Array.from(b.fx.hitLife).filter(x=>x>0).length,rings:b.fx.rings.length,hitNext:b.fx.hitNext,lastImpactSeq:b.fx.lastImpactSeq};});
if(deathCleanup.alive||deathCleanup.hitLive||deathCleanup.rings||deathCleanup.lastImpactSeq!==deathSeq)throw Error('사망 프레임 피격 효과 정리 실패: '+JSON.stringify(deathCleanup));
const staleSeq=deathSeq+1,staleImpact=await page.evaluate(seq=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),before={hitNext:b.fx.hitNext,rings:b.fx.rings.length},x=b.root.position.x-1.05,z=b.root.position.z;__MMO.bossMsg({type:'field',bossNow:Date.now(),bossImpacts:[['clave',seq,x,z,1,1,Date.now()-5000]]});return {before,after:{hitNext:b.fx.hitNext,hitLive:Array.from(b.fx.hitLife).filter(x=>x>0).length,rings:b.fx.rings.length,lastImpactSeq:b.fx.lastImpactSeq}};},staleSeq);
if(staleImpact.after.lastImpactSeq!==staleSeq||staleImpact.after.hitNext!==staleImpact.before.hitNext||staleImpact.after.rings!==staleImpact.before.rings||staleImpact.after.hitLive)throw Error('오래된 공동 피격 무효과 소비 실패: '+JSON.stringify(staleImpact));
const report=await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),i=__MMO.info(),a=b.actions?.[b.motionClip],base=b.baseModel||{},r=b.root.position,n=b.netAct;return {viewport:[innerWidth,innerHeight],clips:Object.keys(b.actions),motion:{clip:b.motionClip,state:b.motionState,seq:b.motionSeq,net:n&&{motion:n.motion,skill:n.skill,seq:n.seq}},action:a&&{clip:a.getClip().name,time:+a.time.toFixed(3),paused:a.paused,enabled:a.enabled,running:a.isRunning()},drift:{model:[+(b.model.position.x-(base.x||0)).toFixed(4),+(b.model.position.y-(base.y||0)).toFixed(4),+(b.model.position.z-(base.z||0)).toFixed(4)],rotation:[+(b.model.rotation.x-(base.rx||0)).toFixed(4),+(b.model.rotation.z-(base.rz||0)).toFixed(4)],rootFromAction:n?[+(r.x-n.x).toFixed(4),+(r.z-n.z).toFixed(4)]:null},fx:{hitNext:b.fx.hitNext,dustNext:b.fx.dustNext,lastImpactSeq:b.fx.lastImpactSeq},calls:i.calls,triangles:i.triangles,boss:[r.x,r.z],player:[__MMO.me.root.position.x,__MMO.me.root.position.z]};});
report.proof={gait,impacts:{normalDelta:normalImpact.hitNext-beforeImpact.hitNext,duplicateHitNextUnchanged:duplicateImpact.hitNext===normalImpact.hitNext,critDelta:critImpact.hitNext-duplicateImpact.hitNext,sequences:[normalSeq,critSeq,deathSeq,staleSeq]},finalHit:{spawned:deathImpact,duplicateHitNextUnchanged:deathDuplicate.hitNext===deathImpact.hitNext,duplicateStillLive:deathDuplicate.hitLive>0,expired:deathCleanup},stale:staleImpact};
console.log(JSON.stringify(report));if(errors.length)throw Error('브라우저 오류: '+errors.join(' | '));await browser.close();await app.close();
