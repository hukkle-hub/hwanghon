/* 황혼 — 로비의 내 캐릭터 (3D). 배경 그림에 «구워진» 인물 위에 실제 캐릭터를 세운다.
   (docs/design/36)

   왜 배경에서 지우지 않았나: 구워진 인물은 크고 대비가 센 요소라, 생성형 인페인팅
   없이 지우면 얼룩만 남는다 (세 가지 방법을 시도했고 셋 다 자국이 남았다).
   그런데 그 인물은 «낫을 든 아인의 뒷모습» — 우리가 세우려는 바로 그 구도다.
   그래서 지우는 대신 «같은 자리에 조금 더 크게» 덮는다. 둘 다 어두운 실루엣이라
   삐져나오는 가장자리도 배경의 일부로 읽힌다.

   배경 그림(1920×1080) 안에서 인물의 자리 — 눈금을 올려 재었다:
     몸통 중심 x 555 (28.9%) · 머리 꼭대기 y 300 · 발끝 y 930 (86.1%) · 키 630px (58.3%)
   배경은 cover 로 깔리므로 화면 비율이 달라져도 같은 자리에 서도록 cover 셈을 그대로 따른다. */
import * as THREE from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';

const BG_W=1920, BG_H=1080;          /* 배경 그림 크기 */
const FIG={ cx:555, feet:930, top:300 };
const COVER=1.12;                    /* 구워진 인물을 덮을 여유 */

const host=document.getElementById('lb3d');
if(host && !matchMedia('(prefers-reduced-motion: reduce)').matches) start(host);

function start(canvas){
  let renderer;
  try{
    renderer=new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, powerPreference:'low-power'});
  }catch(e){ canvas.hidden=true; return; }               /* WebGL 이 없으면 배경 그림 그대로 */
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=0.86;

  const scene=new THREE.Scene();
  const cam=new THREE.PerspectiveCamera(26,1,0.1,60);

  /* 배경의 빛에 맞춘다 — 붉은 달이 오른쪽 위, 도시 불빛이 아래에서 희미하게 */
  /* 배경은 «차갑고 어두운» 그림이다. 처음엔 달빛을 2.6 으로 줬다가 캐릭터만
     청동빛으로 떠서, 값과 채도를 배경에 맞춰 내렸다. */
  scene.add(new THREE.HemisphereLight(0x2c3340, 0x0f0d12, 0.62));
  const moon=new THREE.DirectionalLight(0xB4675C, 1.15); moon.position.set(2.6,3.0,-2.2); scene.add(moon);
  const fill=new THREE.DirectionalLight(0x50607e, 0.55); fill.position.set(-2.4,1.4,1.8); scene.add(fill);
  const rim =new THREE.DirectionalLight(0x9a8452, 0.85); rim.position.set(-1.2,2.2,-3.0); scene.add(rim);

  const root=new THREE.Group(); scene.add(root);
  let model=null, mixer=null, wind=null, charH=1.7, fullH=1.7, clock=new THREE.Clock();

  const CHAR=(window.TW_SAVE&&TW_SAVE.char)?TW_SAVE.char():'ain';
  if(window.TW_GEAR&&TW_GEAR.setChar) TW_GEAR.setChar(CHAR);

  const loader=new GLTFLoader();
  loader.load('art/3d/'+CHAR+'_anim.glb', g=>{
    /* 던전·뷰어와 같은 순서 — 보정막은 믹서보다 «먼저» (docs/design/33 §4.3) */
    globalThis.TW_POSE?.repair(THREE, g);
    globalThis.TW_MATFIX?.repair(THREE, g.scene);
    if(globalThis.TW_WIND){ try{
      TW_WIND.prepare(THREE, g.scene);
      wind=TW_WIND.bind(THREE, g.scene, TW_WIND.profile('road'));   /* 고가의 강풍 — 로비는 옥외 고지대다 */
    }catch(e){} }
    model=g.scene; root.add(model);
    model.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
    mixer=new THREE.AnimationMixer(model);
    const idle=(g.animations||[]).find(c=>c.name==='idle')||(g.animations||[])[0];
    if(idle){ const a=mixer.clipAction(idle); a.timeScale=0.72; a.play(); }   /* 천천히 숨 쉬게 */

    /* 장착한 장비를 그대로 입힌다 — 로비에서 «내가 입은 옷» 이 늘 보인다 */
    equip();

    const bb=new THREE.Box3().setFromObject(model);
    charH=Math.max(0.5, bb.max.y-bb.min.y);
    model.position.y-=bb.min.y;                 /* 발을 원점에 */
    fullH=charH;
    /* 낫은 비동기로 붙는다 — 붙고 나서 «무기까지 포함한 키» 를 다시 재고 배치한다.
       안 그러면 좁은 화면에서 낫날이 위로 잘린다. */
    setTimeout(measureFull, 1200); setTimeout(measureFull, 3000);
    /* 캐릭터는 +z 를 보고 서 있고 카메라는 −z 에 있다 → 회전 0 이 «뒷모습» 이다 */
    root.rotation.y=0.24;                       /* 뒷모습, 살짝 틀어서 */
    layout();
  }, undefined, ()=>{ canvas.hidden=true; });

  function measureFull(){
    if(!model) return;
    model.updateMatrixWorld(true);
    const bb=new THREE.Box3().setFromObject(model);
    const h=bb.max.y-model.position.y-0;           /* 발(월드 0)에서 가장 높은 점까지 */
    if(isFinite(h)&&h>charH*0.9){ fullH=h; layout(); }
  }

  function equip(){
    if(!model||!window.TW_LOOKS||!window.TW_GEAR) return;
    const G=TW_GEAR, eq=G.state().equipped;
    const baseOf=id=>{ const it=window.TW_ITEMS&&TW_ITEMS.get(id); return it&&it.custom?it.custom.base:id; };
    const tintOf=id=>G.tintOf?G.tintOf(id):null;
    const mixOf=id=>(G.dyeOf&&G.dyeOf(id))?0.75:null;
    try{ TW_LOOKS.attach(THREE, loader, model, eq, { charId:CHAR, baseOf, tintOf, mixOf,
      onMain:wr=>{ const t=tintOf(eq.main); if(t){ const mx=mixOf(eq.main)??0.55;
        wr.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); o.material.color.lerp(new THREE.Color(t),mx); } }); } } });
    }catch(e){ console.warn('lobby equip', e); }
  }

  /* 그림 안의 한 점이 화면 어디로 가는가.
     «cover 겠거니» 하고 계산했다가 휴대폰에서 인물이 두 명으로 보였다 —
     좁은 화면에서는 index.html 이 background 를 `auto 62%` / `32% 20%` 로 바꾼다.
     그래서 짐작하지 않고 실제 계산값을 읽는다. */
  const bgEl=document.querySelector('.lb__bg');
  function bgMap(vw,vh){
    let sx=vw/BG_W, sy=vh/BG_H, s=Math.max(sx,sy), ox, oy;
    let px=0.5, py=0.5, r={left:0,top:0,width:vw,height:vh};
    if(bgEl){
      const cs=getComputedStyle(bgEl); r=bgEl.getBoundingClientRect();
      const size=(cs.backgroundSize||'cover').trim();
      if(size==='cover') s=Math.max(r.width/BG_W, r.height/BG_H);
      else if(size==='contain') s=Math.min(r.width/BG_W, r.height/BG_H);
      else {
        const [a,b]=size.split(/\s+/);
        const num=(v,base)=>v.endsWith('%')?parseFloat(v)/100*base:parseFloat(v);
        if(b&&b!=='auto') s=num(b,r.height)/BG_H;
        else if(a&&a!=='auto') s=num(a,r.width)/BG_W;
        else s=1;
      }
      const pos=(cs.backgroundPosition||'50% 50%').trim().split(/\s+/);
      const pnum=v=>v&&v.endsWith('%')?parseFloat(v)/100:0.5;
      px=pnum(pos[0]); py=pnum(pos[1]!=null?pos[1]:pos[0]);
      /* 퍼센트 위치는 «남는 공간» 을 그 비율로 나눈다 (음수면 넘친 만큼 잘린다) */
      ox=r.left+(r.width-BG_W*s)*px; oy=r.top+(r.height-BG_H*s)*py;
    } else { ox=(vw-BG_W*s)/2; oy=(vh-BG_H*s)/2; }
    return { s, x:p=>ox+p*s, y:p=>oy+p*s };
  }

  /* 구워진 낫날을 덮는 헝겊. 배경과 같은 cover 셈으로 자리를 잡아 어느 화면비에서도 같은 곳에 온다 */
  const patch=document.getElementById('lb-patch');
  /* 낫날만 덮으려 했는데, 화면비에 따라 3D 캐릭터를 메뉴 밖으로 밀어내야 해서
     구워진 몸통이 드러날 수 있다. 그래서 «인물 전체» 를 덮는다. 장면이 원래
     어둡고 비네팅이 깊어, 부드러운 타원 하나는 안개로 읽힌다. */
  const FIGRECT={ x0:326, y0:66, x1:744, y1:1026 };
  function layoutPatch(m){
    if(!patch) return;
    const x=m.x(FIGRECT.x0), y=m.y(FIGRECT.y0), w=m.x(FIGRECT.x1)-x, h=m.y(FIGRECT.y1)-y;
    patch.style.left=x+'px'; patch.style.top=y+'px';
    patch.style.width=w+'px'; patch.style.height=h+'px';
    patch.style.background='radial-gradient(56% 52% at 50% 46%, rgba(9,8,12,.97) 0%, rgba(9,8,12,.93) 46%, rgba(9,8,12,.62) 74%, rgba(9,8,12,0) 100%)';
    patch.classList.add('is-on');
  }

  function layout(){
    const vw=innerWidth, vh=innerHeight;
    renderer.setSize(vw,vh,false);
    cam.aspect=vw/vh; 
    if(!model){ layoutPatch(bgMap(vw,vh)); cam.updateProjectionMatrix(); return; }
    const m=bgMap(vw,vh); layoutPatch(m);
    const feet=m.y(FIG.feet), top=m.y(FIG.top);
    let wantPx=Math.max(40,(feet-top))*COVER;             /* 화면에서 차지할 키(화소) */
    /* 낫까지 화면 안에 — 몸 키 wantPx 로 잡으면 전체는 fullH/charH 배가 된다 */
    const topGap=Math.max(10, vh*0.035);
    const maxBody=(feet-topGap)/Math.max(1.02, fullH/charH);
    wantPx=Math.min(wantPx, maxBody);
    /* 가로로 잘리는 화면(세로 휴대폰)에서는 배경의 자리가 화면 밖으로 나간다.
       왼쪽 메뉴에 겹치지도 않게, 쓸 수 있는 범위로 당긴다. */
    const menu=document.querySelector('.lb__menu');
    const mr=menu?menu.getBoundingClientRect().right:0;
    const half=wantPx*0.20;                               /* 몸통 반폭 어림 */
    const lo=Math.min(mr+half+10, vw*0.52), hi=vw*0.62;
    const cx=Math.max(lo, Math.min(hi, m.x(FIG.cx)));
    const hf=wantPx/vh;                                    /* 화면 높이 대비 비율 */
    const visH=charH/hf, visW=visH*cam.aspect;
    const D=visH/(2*Math.tan(THREE.MathUtils.degToRad(cam.fov)/2));
    /* 화면에서 발이 feet 에 오도록 — 카메라를 평행 이동한다(키스톤 없이) */
    const fyFeet=feet/vh, fxc=cx/vw;
    /* 화면 세로는 아래로 커지고 월드 y 는 위로 커진다 → 화면비 = 0.5 − (Y−camY)/visH
       카메라가 −z 에서 +z 를 보므로 화면 «오른쪽» 은 월드 −x → 화면비 = 0.5 − (X−camX)/visW
       (두 부호를 다 반대로 잡았다가 캐릭터가 화면 밖 오른쪽 위로 날아갔다) */
    const camY=(fyFeet-0.5)*visH;                         /* 발(월드 y=0)이 fyFeet 에 오도록 */
    const camX=(fxc-0.5)*visW;
    cam.position.set(camX, camY, -D);
    cam.lookAt(camX, camY, 0);
    cam.updateProjectionMatrix();
  }

  addEventListener('resize', layout, {passive:true});
  layout();

  let hidden=false;
  document.addEventListener('visibilitychange', ()=>{ hidden=document.hidden; });
  (function loop(){
    requestAnimationFrame(loop);
    if(hidden) return;
    const dt=Math.min(0.05, clock.getDelta());
    if(mixer) mixer.update(dt);
    if(wind&&model) wind.update(dt, model);
    renderer.render(scene,cam);
  })();

  /* 장비를 바꾸고 돌아오면 다시 입힌다 (다른 창이 저장을 고쳤을 수 있다) */
  addEventListener('pageshow', ()=>{ window.TW_SAVE?.reload?.(); equip(); });
  globalThis.TW_LOBBY3D={ get model(){return model;}, layout, equip, get wind(){return wind;} };
}
