/* 클레이브 명예 장비 실화면 검수 — 실제 서버 두 계정으로 본인/원격 전체 장비·강화 광휘·칭호를 찍는다.
   PLAYWRIGHT_MODULE=<playwright/index.mjs> node tools/2d/clave-gear-scenario.mjs [출력 폴더]
   ENH=0|7|9|10, MOBILE=land, REDUCED=1 조합을 지원한다. 기다림은 벽시계가 아니라 렌더 프레임 기준. */
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';import fs from 'node:fs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),require=createRequire(ROOT+'/');
const modulePath=process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright/index.mjs';
const {chromium}=await import(/^[A-Za-z]:[\\/]/.test(modulePath)?pathToFileURL(modulePath).href:modulePath);
const {Store}=require('./server/store.cjs'),{createPartyServer}=require('./server/index.cjs');
const OUT=path.resolve(process.argv[2]||path.join(ROOT,'.clave-gear-shots'));fs.mkdirSync(OUT,{recursive:true});
const ENH=Math.max(0,Math.min(10,Number(process.env.ENH??10))),REDUCED=process.env.REDUCED==='1';
const SPARKS=ENH>=10?{tier:3,count:12,size:2.6,color:0xffead8}:ENH>=9?{tier:2,count:9,size:2,color:0xff3b24}:ENH>=7?{tier:1,count:6,size:1.6,color:0xd6652f}:{tier:0,count:4,size:1.2,color:0xd6652f};
const store=new Store(null);
function account(name,character){const g=store.guest(name);store.chooseName(g.profile.id,name,character);return {id:g.profile.id,token:g.token,name};}
const knight=account('명예기사','kain'),witness=account('검수자','ain');
const gear=['w_clave_blade','x_clave_shutter','a_clave_helm','a_clave_cuirass','a_clave_gauntlet','a_clave_greaves'];
const p=store.get(knight.id);p.xp=40*1200;p.equipment={main:gear[0],off:gear[1],head:gear[2],chest:gear[3],gloves:gear[4],legs:gear[5]};p.items=Object.fromEntries(gear.map(id=>[id,1]));p.gear=Object.fromEntries(gear.map(id=>[id,{enh:ENH,dur:100}]));store.put(p);
for(let i=0;i<10;i++)store.bossKill('clave','gangnam_b1',Date.now()-i,[{id:knight.id,name:knight.name,dmg:1,share:1}],[],null);
const app=createPartyServer({store}),addr=await app.listen(0,'127.0.0.1'),host=`127.0.0.1:${addr.port}`,base=`http://${host}`;
const mobile=!!process.env.MOBILE,view=mobile?{width:915,height:412}:{width:1280,height:720},errors=[];
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
async function open(a){const ctx=await browser.newContext({viewport:view,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,reducedMotion:REDUCED?'reduce':'no-preference'});await ctx.addInitScript(x=>{localStorage.setItem('tw:party-token:'+x.host,x.token);localStorage.setItem('tw:party-name',x.name);},{host,token:a.token,name:a.name});const page=await ctx.newPage();page.on('pageerror',e=>errors.push(a.name+': '+e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))errors.push(a.name+': '+m.text());});await page.goto(`${base}/mmo.html?zone=gangnam_b1&online=1`);await page.waitForFunction(()=>window.__MMO&&__MMO.net&&__MMO.frames>3,null,{timeout:240000});return page;}
const frames=async(page,n)=>{const f=await page.evaluate(()=>__MMO.frames);await page.waitForFunction(x=>__MMO.frames>=x,f+n,{timeout:240000});};
async function put(page,x,z,yaw){const id=await page.evaluate(v=>{__MMO.teleport(v.x,v.z,v.yaw);return __MMO.net.profile.id;},{x,z,yaw});const fp=app.field.players.get(id);fp.x=x;fp.z=z;fp.yaw=yaw;fp.at=Date.now();}
async function prestige(page,id){return page.evaluate(id=>{const root=id?__MMO.remotes.get(id)?.root:__MMO.me.root;if(!root)return null;let aura,points,crest,core;root.traverse(o=>{if(o.userData.lookAura){aura=o;crest=o.children.find(x=>x.isMesh);points=o.children.find(x=>x.isPoints);}if(o.userData.claveCore)core=o;});const sample=o=>o&&({uuid:o.uuid,x:o.position.x,y:o.position.y,z:o.position.z,rx:o.rotation.x,ry:o.rotation.y,rz:o.rotation.z,opacity:o.material?.opacity});return {meta:aura?.userData.prestige,points:{...sample(points),count:points?.geometry.attributes.position.count,size:points?.material.size,sizeAttenuation:points?.material.sizeAttenuation,color:points?.material.color.getHex()},crest:sample(crest),core:sample(core),render:__MMO.info()};},id);}
function assertSpark(label,s){if(!s)throw Error(label+' 광휘 개체 누락');if(s.meta?.tier!==SPARKS.tier||s.meta?.sparks!==SPARKS.count||s.meta?.sparkSize!==SPARKS.size)throw Error(label+' 광휘 메타 불일치 '+JSON.stringify(s.meta));if(s.points.count!==SPARKS.count||s.points.size!==SPARKS.size||s.points.sizeAttenuation!==false||s.points.color!==SPARKS.color)throw Error(label+' 불티 규격 불일치 '+JSON.stringify(s.points));}
function motionChanged(a,b){return ['points','crest','core'].some(k=>['x','y','z','rx','ry','rz','opacity'].some(v=>a[k]?.[v]!==b[k]?.[v]));}
function identityStable(a,b){return ['points','crest','core'].every(k=>a[k]?.uuid===b[k]?.uuid);}
try{
 const A=await open(knight),B=await open(witness),o=app.field.bosses.get('clave');for(const b of app.field.bosses.values()){b.alive=false;b.nextAt=Date.now()+1e9;}
 await put(B,o.x,o.z+4,Math.PI);await put(A,o.x,o.z+2.2,Math.PI);await frames(B,35);await frames(A,20);
 const remote=await B.evaluate(id=>{const h=__MMO.remotes.get(id),looks=[],auras=[],p=h.tag.querySelector('.prestige');h.root.traverse(o=>{if(o.userData.look)looks.push(o.userData.look);if(o.userData.lookAura)auras.push(o.userData.prestige);});return {eq:h.eqNet,enh:h.enhNet,title:h.title,tag:h.tag.textContent,badge:p&&{text:p.textContent,boss:p.dataset.boss,tier:+p.dataset.tier,aria:p.getAttribute('aria-label'),count:h.tag.querySelectorAll('.prestige').length},looks:[...new Set(looks)],auras,render:__MMO.info()};},knight.id);
 const self=await A.evaluate(()=>{const looks=[],auras=[],p=__MMO.me.tag.querySelector('.prestige');__MMO.me.root.traverse(o=>{if(o.userData.look)looks.push(o.userData.look);if(o.userData.lookAura)auras.push(o.userData.prestige);});return {eq:__MMO.me.eqNet,enh:__MMO.me.enhNet,title:__MMO.me.title,tag:__MMO.me.tag.textContent,badge:p&&{text:p.textContent,boss:p.dataset.boss,tier:+p.dataset.tier,aria:p.getAttribute('aria-label'),count:__MMO.me.tag.querySelectorAll('.prestige').length},looks:[...new Set(looks)],auras,render:__MMO.info()};});
 if(Object.keys(remote.eq||{}).length!==6||Object.keys(self.eq||{}).length!==6)throw Error('전체 장착 슬롯 누락');
 if(remote.title?.text!=='셔터를 멈춘 자'||!remote.tag.includes('셔터를 멈춘 자'))throw Error('원격 칭호 누락');
 const expectedBadge=ENH>=7?{text:'≡ 클레이브 +'+ENH,boss:'clave',tier:SPARKS.tier,aria:'클레이브 장비 +'+ENH,count:1}:null;if(JSON.stringify(remote.badge)!==JSON.stringify(expectedBadge)||JSON.stringify(self.badge)!==JSON.stringify(expectedBadge))throw Error('본인/원격 명예 표식 불일치 '+JSON.stringify({expectedBadge,self:self.badge,remote:remote.badge}));
 if(!remote.auras.some(a=>a&&a.tier===SPARKS.tier)||!self.auras.some(a=>a&&a.tier===SPARKS.tier))throw Error('강화 광휘 단계 누락');
 if(!remote.looks.includes('x_clave_shutter')||!self.looks.includes('x_clave_shutter'))throw Error('등 셔터 누락');
 if(remote.looks.includes('a_sluice_boots')||self.looks.includes('a_sluice_boots'))throw Error('서버에서 입지 않은 프리셋 장비가 섞임');
 const beforeSelf=await prestige(A),beforeRemote=await prestige(B,knight.id);assertSpark('본인',beforeSelf);assertSpark('원격',beforeRemote);await frames(A,120);await frames(B,120);const afterSelf=await prestige(A),afterRemote=await prestige(B,knight.id);assertSpark('본인',afterSelf);assertSpark('원격',afterRemote);
 if(!identityStable(beforeSelf,afterSelf)||!identityStable(beforeRemote,afterRemote))throw Error('광휘가 프레임마다 재생성됨');
 if(REDUCED&&(motionChanged(beforeSelf,afterSelf)||motionChanged(beforeRemote,afterRemote)))throw Error('동작 줄이기에서 광휘가 움직임');
 if(!REDUCED&&(!motionChanged(beforeSelf,afterSelf)||!motionChanged(beforeRemote,afterRemote)))throw Error('일반 모드 광휘가 정지함');
 const limit=mobile?80000:220000;for(const [label,s] of [['본인',afterSelf],['원격',afterRemote]]){if(s.render.calls>40||s.render.triangles>limit)throw Error(label+' 렌더 예산 초과 '+JSON.stringify(s.render));}
 const suffix=`-enh${ENH}${REDUCED?'-reduced':''}${mobile?'-mobile':'-desktop'}`;await B.screenshot({path:path.join(OUT,'clave-remote-back'+suffix+'.png')});await A.screenshot({path:path.join(OUT,'clave-self-back'+suffix+'.png')});
 await put(A,o.x,o.z+2.2,0);await frames(B,9);await B.screenshot({path:path.join(OUT,'clave-remote-front'+suffix+'.png')});
 await A.keyboard.press('KeyJ');await frames(A,7);await A.screenshot({path:path.join(OUT,'clave-attack'+suffix+'.png')});
 /* 관심 반경 이탈→재진입을 두 번 거쳐도 장비가 다시 보이고, 매번 전용 GPU 해제가 호출되어야 한다. */
 await B.evaluate(()=>{const old=TW_LOOKS.detach;window.__claveDetach=0;TW_LOOKS.detach=function(){window.__claveDetach++;return old.apply(this,arguments);};});
 await put(A,o.x+40,o.z+2.2,0);await frames(B,18);if(await B.evaluate(id=>__MMO.remotes.has(id),knight.id))throw Error('AOI 이탈 뒤 원격 캐릭터 잔존');
 await put(A,o.x,o.z+2.2,0);await frames(B,35);const returned=await B.evaluate(id=>{const h=__MMO.remotes.get(id),looks=[];if(!h||h.loading)return null;h.root.traverse(o=>{if(o.userData.look)looks.push(o.userData.look);});return looks;},knight.id);if(!returned||!returned.includes('x_clave_shutter'))throw Error('AOI 재진입 뒤 장비 복원 실패');
 await put(A,o.x+40,o.z+2.2,0);await frames(B,18);const detached=await B.evaluate(()=>window.__claveDetach);if(detached<2)throw Error('AOI 장비 GPU 해제 누락 '+detached);
 console.log(JSON.stringify({view,enh:ENH,reduced:REDUCED,sparks:SPARKS,self,remote,prestige:{beforeSelf,afterSelf,beforeRemote,afterRemote},errors},null,2));if(errors.length)throw Error('브라우저 오류 '+errors.join(' | '));
}finally{await browser.close();await app.close();}
