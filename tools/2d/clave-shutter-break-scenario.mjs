/* 클레이브 셔터 부위파괴 실화면 검수 — 정상/균열/파괴 실루엣과 4.2m 시각 체급을 자동 확인한다.
   PLAYWRIGHT_MODULE=<playwright/index.mjs> PLAYWRIGHT_BROWSER=<chrome> node tools/2d/clave-shutter-break-scenario.mjs [출력 폴더]
   MOBILE=land|port 로 모바일 검수. */
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
const {createPartyServer}=require('./server/index.cjs'),{Store}=require('./server/store.cjs');
const OUT=process.argv[2]||path.join(ROOT,'.clave-shutter-shots'),M=process.env.MOBILE||'',VIEW=M==='port'?{width:412,height:915}:M?{width:915,height:412}:{width:1280,height:720},SUFFIX=M==='port'?'-port':M?'-land':'-desktop';
fs.mkdirSync(OUT,{recursive:true});const app=createPartyServer({store:new Store(null)}),addr=await app.listen(0,'127.0.0.1'),base=`http://127.0.0.1:${addr.port}`;
const browser=await chromium.launch({...(browserPath&&{executablePath:browserPath}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),ctx=await browser.newContext({viewport:VIEW,deviceScaleFactor:1,isMobile:!!M,hasTouch:!!M}),page=await ctx.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url().replace(base,''));});page.on('requestfailed',r=>errors.push('요청 실패 '+(r.failure()?.errorText||'')+' '+r.url().replace(base,'').slice(0,100)));   /* 어느 주소가 실패했는지 남긴다 (Claude 적용 검수 2026-10-07) */
// Offline QA may substitute a locally installed Korean font for the external stylesheet.
if(process.env.QA_FONT){const font=fs.readFileSync(process.env.QA_FONT);await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:`@font-face{font-family:'Noto Sans KR';font-weight:100 900;src:url(data:font/otf;base64,${font.toString('base64')})}` }));}
await page.goto(base+'/mmo.html?zone=gangnam_b1&char=ain&offline=1'+(M?'&lod=1':''));
await page.waitForFunction(()=>{const b=window.__MMO?.bosses?.find(x=>x.b.id==='clave');return window.__MMO?.frames>3&&b?.root&&b?.fx;},null,{timeout:240000});
const frames=async n=>{const f=await page.evaluate(()=>__MMO.frames);await page.waitForFunction(x=>__MMO.frames>=x,f+n,{timeout:240000});};
await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave');__MMO.teleport(b.b.x-3.4,b.b.z,Math.PI/2);});await frames(5);
const baseInfo=await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),sh=b.fx.shutter;return {visualH:b.h,gameH:b.b.h,declaredVisual:b.b.visualH,hasShutter:!!sh,intactIndex:sh?.geometry?.index?.count||0,brokenIndex:b.fx.shutterBroken?.index?.count||0};});
if(Math.abs(baseInfo.gameH-3.2)>.001||Math.abs(baseInfo.declaredVisual-4.2)>.001||Math.abs(baseInfo.visualH-4.2)>.18)throw Error('클레이브 시각/판정 높이 분리 실패: '+JSON.stringify(baseInfo));
if(!baseInfo.hasShutter||baseInfo.intactIndex<9||baseInfo.brokenIndex<9||baseInfo.brokenIndex>=baseInfo.intactIndex*.72||baseInfo.brokenIndex<=baseInfo.intactIndex*.35)throw Error('Boss_HeldPart 반쪽 geometry 계약 실패: '+JSON.stringify(baseInfo));
const setPart=async(part,seq)=>{await page.evaluate(({part,seq})=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),now=Date.now();__MMO.bossMsg({type:'field',bossNow:now,bosses:[['clave',1]],bossActs:[{id:'clave',x:b.b.x,z:b.b.z,yaw:0,motion:'idle',skill:'',seq,startedAt:now,endsAt:now+2000,counterOpen:0,counterClose:0,part}]});b.poseElapsed=600;},{part,seq});await frames(2);return page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave');return {state:b.fx.shutterState,index:b.fx.shutter?.geometry?.index?.count||0,chunk:!!b.fx.breakChunk,chunkY:b.fx.breakChunk?.m.position.y??null};});};
const intact=await setPart(0,910);await page.screenshot({timeout:120000,path:path.join(OUT,'01-intact'+SUFFIX+'.png')});
const cracked=await setPart(1,911);await page.screenshot({timeout:120000,path:path.join(OUT,'02-cracked'+SUFFIX+'.png')});
const broken=await setPart(2,912);await page.screenshot({timeout:120000,path:path.join(OUT,'03-broken-impact'+SUFFIX+'.png')});
await page.waitForFunction(()=>{const fx=__MMO.bosses.find(x=>x.b.id==='clave').fx,b=fx.breakChunk;return b&&b.life<1.5&&b.m.position.y<=fx.floor+.25;},null,{timeout:240000});await page.screenshot({timeout:120000,path:path.join(OUT,'04-broken-settle'+SUFFIX+'.png')});
if(intact.state!==0||intact.index!==baseInfo.intactIndex)throw Error('정상 셔터 상태 실패: '+JSON.stringify(intact));
if(cracked.state!==1||cracked.index!==baseInfo.intactIndex)throw Error('균열 단계는 실루엣을 먼저 자르면 안 됨: '+JSON.stringify(cracked));
if(broken.state!==2||broken.index!==baseInfo.brokenIndex||!broken.chunk)throw Error('파괴 실루엣/낙하 파편 실패: '+JSON.stringify(broken));
const final=await page.evaluate(()=>{const b=__MMO.bosses.find(x=>x.b.id==='clave'),i=__MMO.info();return {part:b.fx.shutterState,index:b.fx.shutter.geometry.index.count,chunk:!!b.fx.breakChunk,calls:i.calls,triangles:i.triangles,viewport:[innerWidth,innerHeight],bossH:b.h,gameH:b.b.h,visualH:b.b.visualH};});
const report={baseInfo,intact,cracked,broken,final,errors};fs.writeFileSync(path.join(OUT,'clave-shutter-report'+SUFFIX+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
if(errors.length)throw Error('브라우저 오류: '+errors.join(' | '));await browser.close();await app.close();
