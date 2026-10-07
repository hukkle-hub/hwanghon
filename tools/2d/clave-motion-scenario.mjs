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
const {Store}=require('./server/store.cjs');
const OUT=process.argv[2]||path.join(ROOT,'.clave-motion-shots'),M=process.env.MOBILE||'',RM=process.env.REDUCED==='1',VIEW=M==='port'?{width:412,height:915}:M?{width:915,height:412}:{width:1280,height:720},SUFFIX=(M==='port'?'-port':M?'-land':'')+(RM?'-reduced':'');
fs.mkdirSync(OUT,{recursive:true});const app=createPartyServer({store:new Store(null)}),addr=await app.listen(0,'127.0.0.1'),base=`http://127.0.0.1:${addr.port}`;
const browser=await chromium.launch({...(browserPath&&{executablePath:browserPath}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),ctx=await browser.newContext({viewport:VIEW,deviceScaleFactor:1,isMobile:!!M,hasTouch:!!M,reducedMotion:RM?'reduce':'no-preference'}),page=await ctx.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url().replace(base,''));});page.on('requestfailed',r=>errors.push('요청 실패 '+(r.failure()?.errorText||'')+' '+r.url().replace(base,'').slice(0,100)));   /* 어느 주소가 실패했는지 남긴다 (Claude 적용 검수 2026-10-07) */
// Offline QA may substitute a locally installed Korean font for the external stylesheet.
if(process.env.QA_FONT){const font=fs.readFileSync(process.env.QA_FONT);await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:`@font-face{font-family:'Noto Sans KR';font-weight:100 900;src:url(data:font/otf;base64,${font.toString('base64')})}` }));}
await page.goto(base+'/mmo.html?zone=gangnam_b1&char=kain'+(M||process.env.QA_LOD==='1'?'&lod=1':''));
await page.waitForFunction(()=>{if(!window.__MMO)return false;const b=window.__MMO.bosses?.find(x=>x.b.id==='clave');return window.__MMO.frames>3&&b?.root&&b?.fx&&b?.actions?.walk&&b?.actions?.atk_claveshut;},null,{timeout:240000});
const frames=async n=>{const f=await page.evaluate(()=>__MMO.frames);await page.waitForFunction(x=>__MMO.frames>=x,f+n,{timeout:240000});};
await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave');__MMO.teleport(b.b.x-3.15,b.b.z,Math.PI/2);});await frames(8);
let edgeCamera=null;if(M==='port'){await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave');__MMO.teleport(b.b.x-18,b.b.z,Math.PI/2);});await frames(4);edgeCamera=await page.evaluate(()=>{const p=__MMO.me.root.position.clone();p.y=1;return p.project(__MMO.cam).toArray().map(x=>+x.toFixed(4));});if(Math.abs(edgeCamera[0])>.78||Math.abs(edgeCamera[1])>.88)throw Error('세로 보스 구역 가장자리에서 플레이어가 화면을 벗어남: '+JSON.stringify(edgeCamera));await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave');__MMO.teleport(b.b.x-3.15,b.b.z,Math.PI/2);});await frames(4);}
const lateJoin=await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),now=Date.now(),elapsed=1600,yaw=Math.PI/2,travel=4.8*Math.max(0,Math.min(1,(elapsed-1350)/500)),fromX=b.b.x,fromZ=b.b.z,a={id:'clave',x:fromX+Math.sin(yaw)*travel,z:fromZ+Math.cos(yaw)*travel,yaw,motion:'skill',skill:'shutter',seq:700,startedAt:now-elapsed,endsAt:now-elapsed+3400,counterOpen:0,counterClose:0};__MMO.bossMsg({type:'field',bossNow:now,bosses:[['clave',1]],bossActs:[a]});b.poseElapsed=elapsed;return {fromX,fromZ,x:a.x,z:a.z};});await frames(2);
const lateJoinPose=await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave');return {root:[b.root.position.x,b.root.position.z],warning:[b.fx.warning.position.x,b.fx.warning.position.z]};});
if(Math.hypot(lateJoinPose.root[0]-lateJoin.x,lateJoinPose.root[1]-lateJoin.z)>.03||Math.hypot(lateJoinPose.warning[0]-lateJoin.fromX,lateJoinPose.warning[1]-lateJoin.fromZ)>.03)throw Error('셔터 늦은 입장 위치/예고 출발점 불일치: '+JSON.stringify({lateJoin,lateJoinPose}));
await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),now=Date.now();b.poseElapsed=null;__MMO.bossMsg({type:'field',bossNow:now,bosses:[['clave',1]],bossActs:[{id:'clave',x:b.b.x,z:b.b.z,yaw:0,motion:'idle',skill:'',seq:701,startedAt:now,endsAt:now+780,counterOpen:0,counterClose:0}]});});await frames(2);
const poolBefore=await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave');return {rings:b.fx.ringPool.map(r=>[r.m.uuid,r.m.geometry.uuid,r.m.material.uuid]),warnings:Object.values(b.fx.warningGeometries).flat().map(g=>g.uuid),outlines:Object.values(b.fx.warningOutlines).flat().map(g=>g.uuid),outline:[b.fx.warningOutline.uuid,b.fx.warningOutline.material.uuid],core:[b.fx.hitCore.uuid,b.fx.hitCore.geometry.uuid,b.fx.hitCore.material.uuid],trail:[b.fx.trail.uuid,b.fx.trail.geometry.uuid,b.fx.trail.material.uuid],children:b.fx.scene.children.length};});
const shot=async(name,motion,skill,elapsed,clipTime=null,footDust=false,probe=false)=>{await page.evaluate(v=>__MMO.bossPose('clave',...v),[motion,skill,elapsed,clipTime]);await frames(footDust?1:3);const gait=footDust?await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),pos=f=>{if(!f)return null;const p=f.position.clone();f.getWorldPosition(p);return [+p.x.toFixed(3),+p.y.toFixed(3),+p.z.toFixed(3)];};return {dustNext:b.fx.dustNext,dustLive:b.fx.dustLive,lastStep:b.fx.lastStep,feet:b.fx.feet.map(pos)};}):null,probeState=probe?await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),ring=b.fx.ringPool.find(r=>r.active);return {trail:b.fx.trail.visible,trailCount:b.fx.trailCount,rings:b.fx.ringActive,ringScale:ring?.m.scale.x||0,reduced:b.fx.reduced};}):null;const file=name+SUFFIX+'.png';await page.screenshot({timeout:120000,path:path.join(OUT,file)});console.log('찍음',file);return footDust?gait:probeState;};

await shot('01-idle-breath','idle','',600);
await shot('02-idle-brace','idle','',1500);
await shot('03-idle-guard','idle','',3000);
const leftGait=await shot('04-walk-left-contact','walk','',100,.10,true);
const rightGait=await shot('05-walk-right-contact','walk','',530,.53,true),gait={left:leftGait,right:rightGait};
const feetDistinct=g=>g.feet.length===2&&g.feet.every(Boolean)&&Math.hypot(g.feet[0][0]-g.feet[1][0],g.feet[0][2]-g.feet[1][2])>.08;
if(leftGait.dustNext<9||leftGait.dustLive<1||rightGait.dustNext<18||rightGait.dustLive<1||!feetDistinct(leftGait)||!feetDistinct(rightGait))throw Error('양발 접지 먼지/발 뼈 누락: '+JSON.stringify(gait));
await shot('06-shutter-hold','skill','shutter',1400);
await shot('07-shutter-presnap','skill','shutter',1600);
await shot('08-shutter-contact','skill','shutter',1720);
await shot('09-shutter-recovery','skill','shutter',2100);
await shot('10-storm-hold1','skill','storm',1050);
await shot('11-storm-contact1','skill','storm',1315);
await shot('12-storm-hold2','skill','storm',1900);
await shot('13-storm-contact2','skill','storm',2135);
await shot('14-storm-counter-hold','skill','storm',2700);
const counterCue=await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave');return {warning:b.fx.warnMat.color.getHex(),outline:b.fx.warnLineMat.color.getHex(),outlineVisible:b.fx.warningOutline.visible,glow:b.fx.glow.color.getHex(),trail:b.fx.trail.material.color.getHex(),scale:+b.fx.warning.scale.x.toFixed(4),dark:+getComputedStyle(document.getElementById('dark')).opacity,reduced:b.fx.reduced};});
if(counterCue.warning!==0x64ddff||counterCue.outline!==0x9decff||!counterCue.outlineVisible||counterCue.glow!==0x64ddff||counterCue.trail!==0x64ddff||counterCue.dark>.121||(RM&&counterCue.scale!==1))throw Error('counter 시각 의미/암전 제한 실패: '+JSON.stringify(counterCue));
const contactCue=await shot('15-storm-final-contact','skill','storm',2955,null,false,true);
if(RM&&(contactCue.trail||contactCue.trailCount||contactCue.ringScale<5.39))throw Error('감소 모션 잔상/고리 대체 실패: '+JSON.stringify(contactCue));if(!RM&&(!contactCue.trail||contactCue.trailCount<2))throw Error('일반 모션 접점 잔상 누락: '+JSON.stringify(contactCue));
await shot('16-storm-recovery','skill','storm',3400);
await shot('17-slam-compress','skill','slam',850);
await shot('18-slam-counter-hold','skill','slam',1320);
await shot('19-slam-presnap','skill','slam',1450);
await shot('20-slam-contact','skill','slam',1540);
await shot('21-slam-recovery','skill','slam',1900);
await shot('22-counter-stagger','stagger','storm',180,.09);
const staggerDark=await page.evaluate(()=>+getComputedStyle(document.getElementById('dark')).opacity);if(staggerDark>.121)throw Error('반격 경직이 던전 암전에 묻힘: '+staggerDark);
const fxState=()=>page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave');return {hitNext:b.fx.hitNext,dustNext:b.fx.dustNext,lastImpactSeq:b.fx.lastImpactSeq,core:{visible:b.fx.hitCore.visible,color:b.fx.hitCore.material.color.getHex(),scale:b.fx.hitCoreScale}};});
const sendImpact=(seq,crit,at=null)=>page.evaluate(v=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),x=b.root.position.x-1.05,z=b.root.position.z,stamp=v.at??Date.now();__MMO.bossMsg({type:'field',bossNow:Date.now(),bossImpacts:[['clave',v.seq,x,z,v.crit?1:0,0,stamp]]});return stamp;}, {seq,crit,at});
const beforeImpact=await fxState(),normalSeq=beforeImpact.lastImpactSeq+1;
const normalAt=await sendImpact(normalSeq,false);await frames(1);const normalImpact=await fxState();
if(normalImpact.hitNext-beforeImpact.hitNext!==12||normalImpact.lastImpactSeq!==normalSeq||!normalImpact.core.visible||normalImpact.core.color!==0xffa35a||normalImpact.core.scale!==1)throw Error('일반 공동 피격 실패: '+JSON.stringify({beforeImpact,normalImpact}));
await page.screenshot({timeout:120000,path:path.join(OUT,'23-shared-impact'+SUFFIX+'.png')});
await sendImpact(normalSeq,false,normalAt);await frames(1);const duplicateImpact=await fxState();
if(duplicateImpact.hitNext!==normalImpact.hitNext||duplicateImpact.lastImpactSeq!==normalImpact.lastImpactSeq)throw Error('같은 순번 중복 제거 실패: '+JSON.stringify({normalImpact,duplicateImpact}));
const critSeq=normalSeq+1;await sendImpact(critSeq,true);await frames(1);const critImpact=await fxState();
if(critImpact.hitNext-duplicateImpact.hitNext!==22||critImpact.lastImpactSeq!==critSeq||!critImpact.core.visible||critImpact.core.color!==0xffe39a||critImpact.core.scale!==1.65)throw Error('치명 공동 피격 실패: '+JSON.stringify({duplicateImpact,critImpact}));
await page.screenshot({timeout:120000,path:path.join(OUT,'24-shared-crit'+SUFFIX+'.png')});
await page.evaluate(()=>__MMO.bossMsg({type:'field',bossNow:Date.now(),self:{hp:6200,maxHp:24450,dead:0,respawnAt:0,invulnUntil:0},hurt:[9001,5300,'clave','slam','hit',1,Date.now()]}));await frames(3);await page.screenshot({timeout:120000,path:path.join(OUT,'25-player-hit'+SUFFIX+'.png')});
await page.evaluate(()=>__MMO.bossMsg({type:'field',bossNow:Date.now(),self:{hp:0,maxHp:24450,dead:1,respawnAt:Date.now()+4200,invulnUntil:0},hurt:[9002,6200,'clave','storm','dead',3,Date.now()]}));await frames(3);await page.screenshot({timeout:120000,path:path.join(OUT,'26-player-down'+SUFFIX+'.png')});
await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),now=Date.now();__MMO.bossMsg({type:'field',bossNow:now,bosses:[['clave',1]],bossActs:[{id:'clave',x:b.b.x,z:b.b.z,yaw:0,motion:'idle',skill:'',seq:0,startedAt:now,endsAt:now+780,counterOpen:0,counterClose:0}]});});await frames(2);
const deathSeq=critSeq+1,deathImpact=await page.evaluate(seq=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),x=b.root.position.x-1.05,z=b.root.position.z,at=Date.now();__MMO.bossMsg({type:'bossHit',boss:'clave',dmg:7777,crit:false,counter:true,down:true,impact:[seq,x,z,at]});return {at,alive:b.alive,hitLive:b.fx.hitLive,core:b.fx.hitCore.visible,rings:b.fx.ringActive,hitNext:b.fx.hitNext,lastImpactSeq:b.fx.lastImpactSeq};},deathSeq);
if(deathImpact.alive||deathImpact.hitLive<1||!deathImpact.core||deathImpact.rings<1||deathImpact.hitNext-critImpact.hitNext!==30||deathImpact.lastImpactSeq!==deathSeq)throw Error('마지막 타격 효과 생성 실패: '+JSON.stringify(deathImpact));
const deathDuplicate=await page.evaluate(v=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),x=b.root.position.x-1.05,z=b.root.position.z;__MMO.bossMsg({type:'field',bossNow:Date.now(),bosses:[['clave',0]],bossImpacts:[['clave',v.seq,x,z,0,1,v.at]]});return {hitLive:b.fx.hitLive,rings:b.fx.ringActive,hitNext:b.fx.hitNext,lastImpactSeq:b.fx.lastImpactSeq};},{seq:deathSeq,at:deathImpact.at});
if(deathDuplicate.hitNext!==deathImpact.hitNext||deathDuplicate.hitLive<1||deathDuplicate.lastImpactSeq!==deathSeq)throw Error('사망 스냅숏 중복 제거 실패: '+JSON.stringify({deathImpact,deathDuplicate}));await frames(45);
const deathCleanup=await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave');return {alive:b.alive,hitLive:b.fx.hitLive,core:b.fx.hitCore.visible,rings:b.fx.ringActive,hitNext:b.fx.hitNext,lastImpactSeq:b.fx.lastImpactSeq};});
if(deathCleanup.alive||deathCleanup.hitLive||deathCleanup.core||deathCleanup.rings||deathCleanup.lastImpactSeq!==deathSeq)throw Error('사망 프레임 피격 효과 정리 실패: '+JSON.stringify(deathCleanup));
await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),now=Date.now();__MMO.bossMsg({type:'field',bossNow:now,bosses:[['clave',1]],bossActs:[{id:'clave',x:b.b.x,z:b.b.z,yaw:0,motion:'idle',skill:'',seq:0,startedAt:now,endsAt:now+780,counterOpen:0,counterClose:0}]});});await frames(3);
const respawn=await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),a=b.actions.idle;return {alive:b.alive,visible:b.root.visible,clip:b.motionClip,state:b.motionState,seq:b.motionSeq,enabled:a.enabled,paused:a.paused,time:a.time};});
if(!respawn.alive||!respawn.visible||respawn.clip!=='idle'||respawn.state!=='idle'||respawn.seq!==0||!respawn.enabled||!Number.isFinite(respawn.time))throw Error('같은 idle seq 재출현 실패: '+JSON.stringify(respawn));
await page.evaluate(()=>__MMO.bossMsg({type:'field',bossNow:Date.now(),bosses:[['clave',0]]}));await page.waitForFunction(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave');return !b.root.visible;},null,{timeout:240000});await frames(2);
const staleSeq=deathSeq+1,staleImpact=await page.evaluate(seq=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),before={hitNext:b.fx.hitNext,rings:b.fx.ringActive},x=b.root.position.x-1.05,z=b.root.position.z;__MMO.bossMsg({type:'field',bossNow:Date.now(),bossImpacts:[['clave',seq,x,z,1,1,Date.now()-5000]]});return {before,after:{hitNext:b.fx.hitNext,hitLive:b.fx.hitLive,rings:b.fx.ringActive,lastImpactSeq:b.fx.lastImpactSeq}};},staleSeq);
if(staleImpact.after.lastImpactSeq!==staleSeq||staleImpact.after.hitNext!==staleImpact.before.hitNext||staleImpact.after.rings!==staleImpact.before.rings||staleImpact.after.hitLive)throw Error('오래된 공동 피격 무효과 소비 실패: '+JSON.stringify(staleImpact));
const poolAfter=await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave');return {rings:b.fx.ringPool.map(r=>[r.m.uuid,r.m.geometry.uuid,r.m.material.uuid]),warnings:Object.values(b.fx.warningGeometries).flat().map(g=>g.uuid),outlines:Object.values(b.fx.warningOutlines).flat().map(g=>g.uuid),outline:[b.fx.warningOutline.uuid,b.fx.warningOutline.material.uuid],core:[b.fx.hitCore.uuid,b.fx.hitCore.geometry.uuid,b.fx.hitCore.material.uuid],trail:[b.fx.trail.uuid,b.fx.trail.geometry.uuid,b.fx.trail.material.uuid],children:b.fx.scene.children.length};});
if(JSON.stringify(poolAfter)!==JSON.stringify(poolBefore))throw Error('FX 풀 정체성이 바뀜: '+JSON.stringify({poolBefore,poolAfter}));
const report=await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),i=__MMO.info(),a=b.actions?.[b.motionClip],base=b.baseModel||{},r=b.root.position,n=b.netAct;return {viewport:[innerWidth,innerHeight],reduced:b.fx.reduced,clips:Object.keys(b.actions),motion:{clip:b.motionClip,state:b.motionState,seq:b.motionSeq,net:n&&{motion:n.motion,skill:n.skill,seq:n.seq}},action:a&&{clip:a.getClip().name,time:+a.time.toFixed(3),paused:a.paused,enabled:a.enabled,running:a.isRunning()},drift:{model:[+(b.model.position.x-(base.x||0)).toFixed(4),+(b.model.position.y-(base.y||0)).toFixed(4),+(b.model.position.z-(base.z||0)).toFixed(4)],rotation:[+(b.model.rotation.x-(base.rx||0)).toFixed(4),+(b.model.rotation.z-(base.rz||0)).toFixed(4)],rootFromAction:n?[+(r.x-n.x).toFixed(4),+(r.z-n.z).toFixed(4)]:null},fx:{hitNext:b.fx.hitNext,dustNext:b.fx.dustNext,lastImpactSeq:b.fx.lastImpactSeq,live:[b.fx.sparkLive,b.fx.dustLive,b.fx.hitLive,b.fx.ringActive],visible:[b.fx.points.visible,b.fx.dust.visible,b.fx.hitPoints.visible,b.fx.hitCore.visible,b.fx.trail.visible,b.fx.glow.visible]},calls:i.calls,triangles:i.triangles,boss:[r.x,r.z],player:[__MMO.me.root.position.x,__MMO.me.root.position.z]};});
if(report.fx.live.some(Boolean)||report.fx.visible.some(Boolean))throw Error('최종 FX 정리 실패: '+JSON.stringify(report.fx));
report.proof={gait,edgeCamera,lateJoin:{input:lateJoin,pose:lateJoinPose},counterCue,contactCue,staggerDark,respawn,poolStable:true,impacts:{normalDelta:normalImpact.hitNext-beforeImpact.hitNext,duplicateHitNextUnchanged:duplicateImpact.hitNext===normalImpact.hitNext,critDelta:critImpact.hitNext-duplicateImpact.hitNext,sequences:[normalSeq,critSeq,deathSeq,staleSeq]},finalHit:{spawned:deathImpact,duplicateHitNextUnchanged:deathDuplicate.hitNext===deathImpact.hitNext,duplicateStillLive:deathDuplicate.hitLive>0,expired:deathCleanup},stale:staleImpact};
console.log(JSON.stringify(report));if(errors.length)throw Error('브라우저 오류: '+errors.join(' | '));await browser.close();await app.close();
