/* 전투 몸 겹침 녹화 — 실제 game3d 전투를 «게임 시간 60 fps» 로 돌리며 봇이 싸우고,
   매 프레임 플레이어·보스 중심 간격과 몸 반지름 합으로 penetration 을 잰다.

   헤드리스는 초당 1~2 프레임이라 벽시계로는 게임 시간이 안 간다(CLAUDE.md §1).
   그래서 performance.now·requestAnimationFrame 을 가상 시계로 바꿔 한 번에 1/60 s 씩 민다.
   NOSHOT(기본): WebGLRenderer.render 를 건너뛰어 빠르게 돈다 — 판정·이동·AI 는 그대로다.

   사용:
     node tools/serve.cjs &
     node tools/fight-overlap.mjs                     # d01 아인 24 s, 봇 «붙어 싸움»
     SECONDS=40 CHAR=kain BOT=hold node tools/fight-overlap.mjs
     SHOT=1 node tools/fight-overlap.mjs              # 최악 순간을 렌더해 PNG 로
   출력: 최악 겹침 순간(시각·행동·보스 상태·직전 이벤트), 원인별 합계, JSON(OUT=경로). */
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const PORT=Number(process.env.HWANGHON_PORT||8777), D=process.env.D||'d01', CHAR=process.env.CHAR||'';
const SECONDS=Number(process.env.SECONDS||24), BOT=process.env.BOT||'hold', SHOT=!!process.env.SHOT;
const OUT=process.env.OUT||'', SEED=Number(process.env.SEED||7), SHOT_F=Number(process.env.SHOT_F||0), SHOT_PNG=process.env.SHOT_PNG||'fight-overlap.png', SHOT_HIT=Number(process.env.SHOT_HIT||0), SHOT_AFTER=Number(process.env.SHOT_AFTER||0), TRAIL=!!process.env.TRAIL, SHOT_ACT=process.env.SHOT_ACT||'';   /* SHOT_ACT=smash:0.62:2 → 두 번째 스매시가 경과 0.62 s 를 처음 넘는 프레임 */
const url=`http://127.0.0.1:${PORT}/game3d.html?d=${D}&combatAudit=1`;

const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
page.on('pageerror',e=>console.error('[pageerror]',e.message));
if(process.env.SET) await page.addInitScript(v=>{try{localStorage.setItem('tw:settings',v);}catch(e){}},process.env.SET);   /* 예: SET='{"cine":"minimal","quality":"low"}' */
if(CHAR) await page.addInitScript(c=>{try{localStorage.setItem('tw:save',JSON.stringify({char:c}));}catch(e){}},CHAR);   /* TW_SAVE.char() 가 읽는 자리 */
await page.addInitScript(({seed})=>{
  /* 가상 시계 — 게임이 읽는 now 는 우리가 민 만큼만 간다. 로딩 중(시계 멈춤 전)은 실시간. */
  let virt=false,t=0;const q=[];const rNow=performance.now.bind(performance),rRAF=window.requestAnimationFrame.bind(window);
  performance.now=()=>virt?t:rNow();
  window.requestAnimationFrame=cb=>{if(!virt)return rRAF(cb);q.push(cb);return q.length;};
  let s=seed>>>0||1;Math.random=()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};
  window.__vt={go(){if(virt)return;t=rNow()+1000;virt=true;},get q(){return q.length;},step(n){for(let i=0;i<n;i++){t+=1000/60;const cbs=q.splice(0);cbs.forEach(cb=>cb(t));if(window.__vtTick)window.__vtTick();}},get t(){return t;}};
  window.__NOSHOT=true;
},{seed:SEED});
await page.route('**/vendor/three/three.module.js',async route=>{
  const r=await route.fetch();let body=await r.text();
  body+=`\n;{const __WR=WebGLRenderer;WebGLRenderer=class extends __WR{constructor(p){super(p);const r=this.render;this.render=(...a)=>globalThis.__NOSHOT?undefined:r.apply(this,a);}};}\n`;
  route.fulfill({response:r,body,headers:{...r.headers(),'content-type':'text/javascript'}});
});
await page.goto(url);
await page.waitForFunction(()=>window.TW_DUNGEON&&document.querySelector('[data-go]'),null,{timeout:120000});
await page.waitForTimeout(1500);
/* 입장 → 연출·대사 넘기기 → 가상 시계 시작 → 보스 방으로 옮겨 전투 시작 */
await page.evaluate(()=>{window.TW_DUNGEON.start();});
for(let i=0;i<30;i++){await page.evaluate(()=>{try{window.TW_DUNGEON.dlg();}catch(e){}});await page.waitForTimeout(100);}
await page.evaluate(()=>window.__vt.go());
/* 이미 «진짜» rAF 에 걸린 프레임 콜백이 한 번 돌아야 루프가 가상 큐로 넘어온다 — 동기 루프 전에 한 번 양보 */
await page.waitForFunction(()=>window.__vt.q>0,null,{timeout:120000,polling:200});
const entered=await page.evaluate(async()=>{
  const G=window.TW_DUNGEON,P=G.P,B=G.B,X=G.expedition;
  for(let j=0;j<8;j++){try{G.dlg();}catch(e){}window.__vt.step(6);}
  /* 탐사 필수 지점을 차례로 «조사» 해 문을 연다 (gateReady → openGate) */
  for(let k=0;k<20&&X&&!X.ready();k++){const n=X.nodes.find(n=>!X.completed(n.id)&&(n.requires||[]).every(r=>X.completed(r)));if(!n)break;P.x=n.x;P.y=n.y;X.interact(P);window.__vt.step(2);}
  window.__vt.step(10);
  /* 보스 방 안쪽(보스 앞 5 m)으로 옮기면 step() 이 startFight 를 부른다 */
  P.x=B.x-250;P.y=B.y;
  for(let k=0;k<200&&G.state!=='fight';k++){try{G.dlg();}catch(e){}window.__vt.step(3);}
  G.setBot({sx:0,sy:0});
  for(let k=0;k<600&&(G.l2State.cine||!G.battle);k++){try{G.dlg();}catch(e){}window.__vt.step(6);}
  return {char:window.TW_SAVE&&TW_SAVE.char(),state:G.state,battle:!!G.battle,t:window.__vt.t,cine:G.l2State.cine,dlg:document.querySelector('#dlg').className,ov:document.querySelector('#ov')&&document.querySelector('#ov').className,P:[P.x,P.y],gate:G.gateOpen,q:0};
});
console.log('entered',JSON.stringify(entered));
if(!entered.battle){console.error('전투에 들어가지 못했다');await browser.close();process.exit(1);}

const res=await page.evaluate(({SECONDS,BOT,SHOT_F,SHOT_HIT,SHOT_AFTER,TRAIL,SHOT_ACT})=>{
  const G=window.TW_DUNGEON,P=G.P,B=G.B,SCALE=50,DEPTH=.55,rows=[],events=[];let fr=0,lastEv=[];
  const reach=150;
  const wdist=()=>G.world.dist(P.x,P.y,B.x,B.y);   /* 게임·combatAudit 과 같은 깊이 보정 공간 */
  const bat=()=>G.battle;
  /* 이벤트 가로채기: battle.drain 을 감싸 이름만 적는다(원래 소비자는 그대로 받는다) */
  let hooked=null;
  function hook(){const b=bat();if(!b||hooked===b)return;hooked=b;const d=b.drain.bind(b);b.drain=function(){const v=d();v.forEach(e=>{const r={f:fr,t:e.t,clip:e.clip||'',pattern:e.pattern||'',tier:e.tier||''};events.push(r);lastEv.push(r);if(lastEv.length>6)lastEv.shift();});return v;};}
  function bot(){
    const b=bat();if(!b)return;const s=b.snapshot(),e=s.enemy,p=s.player;
    const dx=B.x-P.x,dy=(B.y-P.y)/DEPTH,m=Math.hypot(dx,dy)||1;
    if(e.state==='telegraph'&&e.tele>0){
      if(e.jumpOnly&&e.tele<.3){b.input('jump');}
      else if(e.counterable&&!e.jumpOnly&&e.tele<=e.window*.7){b.input('counter');}
      else if(!e.counterable&&e.tele<.28){G.setBot({sx:-dx/m,sy:-dy/m});b.input('dodge');return;}
    }
    /* hold: 사람처럼 스틱을 보스 쪽으로 계속 민다 · polite: 사거리 밖일 때만 */
    const far=wdist()>reach*.85;
    G.setBot(BOT==='hold'||far?{sx:dx/m,sy:dy/m}:{sx:0,sy:0});
    if(!far&&!p.action){ if(p.combo>=3&&p.st>40)b.input('smash'); else b.input('attack'); }
  }
  /* 궤적 리본(weapon-trail.js, 점 64 개 × 2 정점, renderOrder 3) — 화면 크기와 이웃 점 간격을 잰다 */
  const V=G.cam.position.constructor;let ribbons=null;const trail=[];
  function trailMetric(){
    if(!ribbons){ribbons=[];G.scene.traverse(o=>{if(o.isMesh&&o.renderOrder===3&&o.material&&o.material.vertexColors&&o.geometry.attributes.position&&o.geometry.attributes.position.count===128)ribbons.push(o);});}
    const m=ribbons[1]||ribbons[0];if(!m||!m.visible)return null;
    const n=Math.round(m.geometry.drawRange.count/6)+1;if(n<3)return null;
    const a=m.geometry.attributes.position.array;G.cam.updateMatrixWorld();
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,gap=0,v=new V(),w=new V();
    for(let i=0;i<n;i++){for(const k of [0,3]){v.set(a[i*6+k],a[i*6+k+1],a[i*6+k+2]).project(G.cam);x0=Math.min(x0,v.x);x1=Math.max(x1,v.x);y0=Math.min(y0,v.y);y1=Math.max(y1,v.y);}
      if(i>0){v.set(a[i*6+3],a[i*6+4],a[i*6+5]);w.set(a[i*6-3],a[i*6-2],a[i*6-1]);gap=Math.max(gap,v.distanceTo(w));}}
    const W=innerWidth,H=innerHeight;
    /* 밝기 가중 화면 넓이: 두 겹 리본의 사각형마다 (화면 넓이 px² × 네 정점 색 평균 × 재질 opacity) — «판» 이 얼마나 밝게 넓은가 */
    let lit=0;for(const r of ribbons){if(!r.visible)continue;const rn=Math.round(r.geometry.drawRange.count/6)+1,pa=r.geometry.attributes.position.array,ca=r.geometry.attributes.color.array,sp=[];
      for(let i=0;i<rn*2;i++){v.set(pa[i*3],pa[i*3+1],pa[i*3+2]).project(G.cam);sp.push([v.x*W/2,v.y*H/2]);}
      for(let i=0;i<rn-1;i++){const q=[sp[i*2],sp[i*2+1],sp[i*2+3],sp[i*2+2]];let A=0;for(let j=0;j<4;j++){const a1=q[j],a2=q[(j+1)%4];A+=a1[0]*a2[1]-a2[0]*a1[1];}
        let L=0;for(const k of [i*2,i*2+1,i*2+2,i*2+3])L+=(ca[k*3]+ca[k*3+1]+ca[k*3+2])/3;lit+=Math.abs(A)/2*L/4*r.material.opacity;}}
    return {n,wPx:Math.round((x1-x0)/2*W),hPx:Math.round((y1-y0)/2*H),gap:+gap.toFixed(3),lit:Math.round(lit)};
  }
  window.__vtTick=function(){
    fr++;hook();
    if(TRAIL){const t=trailMetric();if(t){const s0=bat()&&bat().snapshot();trail.push(Object.assign({f:fr,act:s0&&s0.player.action?(s0.player.action.clip||s0.player.action.kind):'',el:s0&&s0.player.action?+s0.player.action.elapsed.toFixed(3):null,hs:s0?+s0.player.hitstop.toFixed(3):0},t));}}
    const b=bat();const s=b&&b.snapshot();
    const gap=wdist()/SCALE,body=(P.r+B.r)/SCALE,pen=Math.max(0,body-gap);
    rows.push({f:fr,gap:+gap.toFixed(3),pen:+pen.toFixed(3),lunge:!!G.lungeState,roll:P.rollT>0,kb:P.kbT>0,spd:+(P.spd||0).toFixed(2),
      act:s&&s.player.action?(s.player.action.clip||s.player.action.kind):'',boss:s?s.enemy.state:'',pat:s?s.enemy.pattern||'':'',
      px:+P.x.toFixed(1),py:+P.y.toFixed(1),bx:+B.x.toFixed(1),by:+B.y.toFixed(1),ev:pen>0?lastEv.map(x=>x.t+(x.pattern?':'+x.pattern:'')+(x.tier?':'+x.tier:'')).join(' '):''});
  };
  const N=Math.round(SECONDS*60);
  for(let i=0;i<N;i++){bot();window.__vt.step(1);if(bat()&&bat().snapshot().over)break;if(SHOT_F&&fr>=SHOT_F)break;if(SHOT_ACT){const [c,e,nth]=SHOT_ACT.split(':'),a=bat()&&bat().snapshot().player.action;if(a&&(a.clip||a.kind)===c&&a.elapsed>=Number(e)&&a.id!==window.__shotSeen){window.__shotSeen=a.id;window.__shotN=(window.__shotN||0)+1;if(window.__shotN>=Number(nth||1))break;}}if(SHOT_HIT&&!SHOT_F){const h=events.filter(e=>e.t==='hit');if(h.length>=SHOT_HIT){SHOT_F=h[SHOT_HIT-1].f+SHOT_AFTER;}}}
  window.__vtTick=null;if(!SHOT_F&&!SHOT_HIT&&!SHOT_ACT)G.setBot({sx:0,sy:0});
  return {rows,events,trail,body:(P.r+B.r)/SCALE,pr:P.r,br:B.r};
},{SECONDS,BOT,SHOT_F,SHOT_HIT,SHOT_AFTER,TRAIL,SHOT_ACT});

const rows=res.rows,normal=rows.filter(r=>!r.lunge);
const worst=normal.reduce((a,r)=>r.pen>a.pen?r:a,{pen:-1});
const over=(lim)=>normal.filter(r=>r.pen>lim).length;
/* 겹침이 시작된 프레임의 원인: 그 프레임에 누가 움직였나 */
const cause={player:0,boss:0,both:0};
for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i];if(b.lunge||b.pen<=a.pen||b.pen<=0)continue;
  const pm=Math.hypot(b.px-a.px,b.py-a.py)>0.01,bm=Math.hypot(b.bx-a.bx,b.by-a.by)>0.01;cause[pm&&bm?'both':pm?'player':bm?'boss':'player']++;}
const hitCount=res.events.filter(e=>e.t==='hit').length,counters=res.events.filter(e=>e.t==='counter').length;
console.log(`frames ${rows.length} (${(rows.length/60).toFixed(1)} s) · body r 합 ${res.body.toFixed(2)} m (P ${res.pr}px + B ${res.br}px) · hit ${hitCount} · counter ${counters}`);
console.log(`일반 전투 최대 penetration ${(worst.pen*100).toFixed(1)} cm @ f${worst.f} (${(worst.f/60).toFixed(2)} s) · 행동 ${worst.act||'-'} · 보스 ${worst.boss}/${worst.pat} · roll ${worst.roll} kb ${worst.kb}`);
console.log(`  직전 이벤트: ${worst.ev}`);
const minGap=normal.reduce((a,r)=>Math.min(a,r.gap),1e9),moving=rows.filter(r=>r.spd>0.05).length;
console.log(`  최소 중심 간격 ${minGap.toFixed(2)} m · 이동 중 프레임 ${moving}`);
console.log(`  > 8 cm 프레임 ${over(.08)} · > 20 cm ${over(.2)} · 관통 돌진 프레임 ${rows.length-normal.length}`);
console.log(`  겹침이 커진 프레임의 원인 — 플레이어만 움직임 ${cause.player} · 보스만 ${cause.boss} · 둘 다 ${cause.both}`);
if(TRAIL){const t=res.trail;console.log(`궤적 표본 ${t.length} 프레임`);
  const top=[...t].sort((a,b)=>b.wPx*b.hPx-a.wPx*a.hPx).slice(0,8);top.forEach(r=>console.log(`  f${r.f} ${r.act} ${r.el} hs ${r.hs} · 화면 ${r.wPx}×${r.hPx}px · lit ${r.lit} · 점 ${r.n} · 이웃 점 최대 ${r.gap} m`));
  const by={};for(const r of t){const k=r.act||'-';(by[k]=by[k]||[]).push(r.lit);}
  console.log('  행동별 밝기 가중 넓이(lit) 최대/중앙: '+Object.entries(by).map(([k,v])=>{v.sort((a,b)=>a-b);return `${k} ${v[v.length-1]}/${v[v.length>>1]}`;}).join(' · '));
  const gx=[...t].sort((a,b)=>b.gap-a.gap).slice(0,5);console.log('  이웃 점 간격 상위: '+gx.map(r=>`f${r.f} ${r.act} ${r.gap} m`).join(' · '));}
if(OUT)fs.writeFileSync(OUT,JSON.stringify(res,null,1));
if(SHOT_F||SHOT_HIT||SHOT_ACT){
  /* 그 프레임에서 멈추고 렌더를 켜 한 장. 카메라·자세는 NOSHOT 동안에도 매 프레임 갱신됐다(render 호출만 건너뜀). */
  const last=rows[rows.length-1];
  await page.evaluate(hide=>{const G=window.TW_DUNGEON;G.freeze(true);
    /* HIDE=trail: 궤적 리본만 숨겨 «이 판이 궤적인가» 를 가른다 */
    if(hide==='trail')G.scene.traverse(o=>{if(o.isMesh&&o.renderOrder===3&&o.material&&o.material.vertexColors&&o.geometry.attributes.position&&o.geometry.attributes.position.count===128)o.visible=false;});
    window.__NOSHOT=false;window.__vt.step(2);},process.env.HIDE||'');
  await page.screenshot({path:SHOT_PNG});
  const tl=res.trail&&res.trail[res.trail.length-1];
  console.log(`SHOT f${last.f}${tl&&tl.f===last.f?` · 궤적 ${tl.wPx}×${tl.hPx}px lit ${tl.lit}`:''} (${SHOT_HIT?'hit #'+SHOT_HIT+' +'+SHOT_AFTER+'f · ':''}${last.act||'-'}) gap ${last.gap} m pen ${(last.pen*100).toFixed(1)} cm → ${SHOT_PNG}`);
} else if(worst.f>0) console.log(`  찍기: SHOT_F=${worst.f} SEED=${SEED} BOT=${BOT}${CHAR?' CHAR='+CHAR:''} node tools/fight-overlap.mjs`);
await browser.close();
