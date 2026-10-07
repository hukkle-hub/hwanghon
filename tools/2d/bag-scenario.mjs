/* 필드 가방·상점·회복약·거점 기본 점령 실화면 검수 (문서 198) — 실제 서버 한 프로세스.
   node tools/2d/bag-scenario.mjs [출력 폴더]   ·  MOBILE=port|land  ·  QA_FONT=<ttf> (구글 폰트를 못 받는 곳)
   기다림은 벽시계가 아니라 렌더 프레임 (CLAUDE.md §1 헤드리스의 함정). */
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';import fs from 'node:fs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),require=createRequire(ROOT+'/');
const modulePath=process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright/index.mjs';
const {chromium}=await import(/^[A-Za-z]:[\\/]/.test(modulePath)?pathToFileURL(modulePath).href:modulePath);
const {Store}=require('./server/store.cjs'),{createPartyServer}=require('./server/index.cjs'),R=require('./server/rpg-rules.cjs');
const OUT=path.resolve(process.argv[2]||path.join(ROOT,'.bag-shots'));fs.mkdirSync(OUT,{recursive:true});
const MOBILE=process.env.MOBILE||'',tag=MOBILE?'-'+MOBILE:'';
const view=MOBILE==='port'?{width:412,height:915}:MOBILE==='land'?{width:915,height:412}:{width:1280,height:720};
const store=new Store(null),g=store.guest('가방검수');store.chooseName(g.profile.id,'가방검수','ain');const ID=g.profile.id;
const shop=store.shop('ain'),armor=shop.map(o=>R.byId[o.id]).filter(d=>d&&d.type==='armor'&&R.requirement(d)<=1).slice(0,3).map(d=>d.id);
{const p=store.get(ID);p.gold=5000;p.items={...p.items,c_potion:3,m_ore:12,m_bone:4,m_fiber:30,...Object.fromEntries(armor.map(a=>[a,1]))};p.vault={m_dew:2};store.put(p);}
const app=createPartyServer({store}),addr=await app.listen(0,'127.0.0.1'),host=`127.0.0.1:${addr.port}`,base=`http://${host}`,errors=[];
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const font=process.env.QA_FONT&&fs.readFileSync(process.env.QA_FONT);
async function open(zone){const ctx=await browser.newContext({viewport:view,deviceScaleFactor:1,isMobile:!!MOBILE,hasTouch:!!MOBILE});
 await ctx.addInitScript(x=>{localStorage.setItem('tw:party-token:'+x.host,x.token);localStorage.setItem('tw:party-name','가방검수');},{host,token:g.token});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(zone+': '+e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))errors.push(zone+': '+m.text());});
 if(font)await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:`@font-face{font-family:'Noto Sans KR';font-weight:100 900;src:url(data:font/otf;base64,${font.toString('base64')})}`}));
 await page.goto(`${base}/mmo.html?zone=${zone}`);await page.waitForFunction(()=>window.__MMO&&__MMO.net&&__MMO.frames>3,null,{timeout:240000});return page;}
const frames=async(page,n)=>{const f=await page.evaluate(()=>__MMO.frames);await page.waitForFunction(x=>__MMO.frames>=x,f+n,{timeout:240000});};
async function put(page,x,z){await page.evaluate(v=>__MMO.teleport(v.x,v.z),{x,z});const fp=app.field.players.get(ID);fp.x=x;fp.z=z;fp.at=Date.now();}
const shot=async(page,name)=>{await page.screenshot({path:path.join(OUT,name+tag+'.png')});console.log('  📷',name+tag+'.png');};
const centre=a=>a.circle?[a.circle[0],a.circle[1]]:[a.poly.reduce((s,q)=>s+q[0],0)/a.poly.length,a.poly.reduce((s,q)=>s+q[1],0)/a.poly.length];
const prof=()=>store.public(ID);
/* 모든 조작 요소의 크기·패널 넘침을 잰다 (CLAUDE.md §1 — 64px 미만 · 가로 넘침) */
const measure=page=>page.evaluate(()=>{const bp=document.querySelector('#bag .bp'),r=bp.getBoundingClientRect(),small=[];
 for(const el of document.querySelectorAll('#bag button,#bag .bx'))if(el.offsetParent){const b=el.getBoundingClientRect();if(b.width<64||b.height<44)small.push((el.textContent||'').trim().slice(0,10)+' '+Math.round(b.width)+'x'+Math.round(b.height));}
 const body=document.getElementById('bagBody');return {panel:[Math.round(r.width),Math.round(r.height)],fits:r.right<=innerWidth&&r.bottom<=innerHeight&&r.left>=0&&r.top>=0,hOver:document.documentElement.scrollWidth-innerWidth,bodyScroll:body.scrollHeight-body.clientHeight,small};});
const check=(ok,msg)=>{if(!ok)throw Error(msg);console.log('  ✓',msg);};
try{
 /* 1) 해운대(거점 아님) — 출발점 쉼터: 가방 · 상점 */
 const A=await open('haeundae'),rest=app.field.zones.get('haeundae').areas.find(a=>a.kind==='rest');
 {const [x,z]=centre(rest);await put(A,x,z);}await frames(A,12);
 check(await A.evaluate(()=>!!__BAG.safe),'해운대 쉼터 = 안전 지대');
 check((await A.textContent('#bagBtn'))==='가방 · 상점','가방 단추가 «가방 · 상점» 으로');
 check((await A.textContent('#potBtn em'))==='3','회복약 단추에 3개');
 await shot(A,'01-hud-rest');
 await A.evaluate(()=>__BAG.open());await frames(A,2);await shot(A,'02-bag-gear');
 const m1=await measure(A);console.log('  잰 값',JSON.stringify(m1));check(m1.fits&&m1.hOver<=0,'가방이 화면 안');
 /* 장착 */
 await A.evaluate(id=>__BAG.select(id,'gear'),armor[0]);await frames(A,2);await shot(A,'03-select');
 await A.click('#bagDet button[data-op="equip"]');await A.waitForFunction(id=>Object.values(__MMO.net.profile.equipment).includes(id),armor[0],{timeout:20000});
 check(Object.values(prof().equipment).includes(armor[0]),'장착 → 서버 프로필에 반영');await frames(A,3);await shot(A,'04-equipped');
 /* 재료 탭 */
 await A.evaluate(()=>__BAG.tab('mat'));await frames(A,2);await shot(A,'05-bag-mat');
 /* 상점: 회복약 10개 */
 await A.evaluate(()=>__BAG.tab('shop'));await A.waitForSelector('#bagBody .it[data-id="c_potion"]',{timeout:20000});
 await A.evaluate(()=>__BAG.select('c_potion','shop'));await frames(A,2);await shot(A,'06-shop');
 const m2=await measure(A);console.log('  잰 값(상점)',JSON.stringify(m2));
 await A.click('#bagDet button[data-op="buy"][data-q="10"]');await A.waitForFunction(()=>__MMO.net.profile.items.c_potion===13,null,{timeout:20000});
 check(prof().items.c_potion===13&&prof().gold===5000-1200,'회복약 10개 구매 (1,200 G)');
 /* 창고 */
 await A.evaluate(()=>__BAG.tab('vault'));await frames(A,2);await shot(A,'07-vault');
 await A.evaluate(()=>__BAG.close());
 /* 회복약: 쉼터 밖에서, HP 를 깎아 놓고 */
 const fp=app.field.players.get(ID);fp.hp=Math.round(fp.maxHp*.3);await frames(A,4);
 await A.click('#potBtn');await A.waitForFunction(()=>__MMO.net.profile.items.c_potion===12,null,{timeout:20000});await frames(A,3);
 check(fp.hp===Math.round(fp.maxHp*.3)+Math.round(fp.maxHp*.35),'회복약: HP 30% → 65%');await shot(A,'08-potion');
 /* 쉼터 밖에서는 상점 탭이 잠긴다 */
 const z=app.field.zones.get('haeundae'),c=Math.cos(z.ang),s=Math.sin(z.ang),sx=z.walk.s1-2,t=(z.walk.t0+z.walk.t1)/2;await put(A,sx*c-t*s,-sx*s-t*c);await frames(A,12);
 check(!(await A.evaluate(()=>__BAG.safe)),'쉼터 밖');await A.evaluate(()=>__BAG.open());await frames(A,2);
 check(await A.evaluate(()=>document.querySelector('#bagTabs button[data-t="shop"]').disabled),'쉼터 밖: 상점 탭 잠김');await shot(A,'09-bag-outside');
 await A.context().close();
 /* 2) 대전역(거점) — 처음엔 보스가 차지: 마을이어도 상점 닫힘 */
 const B=await open('daejeon'),town=app.field.zones.get('daejeon').areas.find(a=>a.kind==='rest'),siege=app.field.zones.get('daejeon').areas.find(a=>a.kind==='siege');
 await put(B,siege.circle[0]+1.5,siege.circle[1]+2.5);await frames(B,14);
 check(await B.evaluate(()=>__HUB.owner&&__HUB.owner.kind==='boss'),'대전역: 서버가 «보스 점령» 을 알려 줌');
 check(!(await B.evaluate(()=>__BAG.safe)),'보스가 차지한 마을은 안전 지대 아님');
 await shot(B,'10-hub-boss');await B.evaluate(()=>__BAG.open());await frames(B,2);await shot(B,'11-hub-bag');await B.evaluate(()=>__BAG.close());
 /* 길드가 빼앗으면 */
 app.field.setHub('daejeon',{kind:'guild',name:'황혼'});await B.evaluate(()=>__HUB.set({zone:'daejeon',owner:{kind:'guild',name:'황혼'}}));await frames(B,12);
 check(await B.evaluate(()=>!!__BAG.safe),'길드가 빼앗은 마을 = 안전 지대');await shot(B,'12-hub-guild');
 /* 전국 지도: 소식 없는 거점은 모두 «보스 점령» */
 await B.evaluate(()=>__WORLD.open());await frames(B,3);const own=await B.evaluate(()=>[...document.querySelectorAll('#wmap em.own')].map(e=>e.textContent));
 console.log('  지도 배지',own.join(' · '));check(own.filter(t=>t==='보스 점령').length>=own.length-1,'전국 지도: 거점 = 보스 점령 (대전만 길드)');await shot(B,'13-world');
 if(errors.length)throw Error('브라우저 오류\n'+errors.join('\n'));console.log('완료 →',OUT);
}finally{await browser.close();await app.close();}
