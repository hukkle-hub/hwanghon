/* 황혼 — 내 초상 (3D). 장착한 장비가 그대로 보이는 얼굴 그림을 한 번 구워서
   [data-portrait="me"] 인 자리에 끼운다 (docs/design/36 §8).

   왜 한 번만 굽나: 로비·프로필·파티 카드가 같은 그림을 쓴다. 자리마다 캔버스를
   띄우면 안드로이드에서 WebGL 맥락이 네 개가 된다. 한 번 굽고 dataURL 로 돌려
   쓰고, 장비가 바뀌었을 때만 다시 굽는다(열쇠 = 캐릭터 + 장착 + 염색).

   남의 초상은 바꾸지 않는다 — 서버가 다른 사람의 장비를 내려 주지 않아
   «반영된 척» 을 할 수 없다. 원화 그대로 둔다. */
import * as THREE from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';

const SIZE=256;
const KEY='tw:portrait';

function stateKey(){
  const G=window.TW_GEAR; if(!G) return null;
  const s=G.state();
  try{ return JSON.stringify([G.char(), s.equipped, s.dye||{}]); }catch(e){ return null; }
}

function cached(k){
  try{ const raw=sessionStorage.getItem(KEY); if(!raw) return null;
    const o=JSON.parse(raw); return o&&o.k===k?o.url:null; }catch(e){ return null; }
}
function store(k,url){ try{ sessionStorage.setItem(KEY, JSON.stringify({k,url})); }catch(e){} }

/* 한 번만 구워서 dataURL 로 — 캔버스는 바로 버린다 */
function bake(char){
  return new Promise((res,rej)=>{
    const cv=document.createElement('canvas'); cv.width=cv.height=SIZE;
    let r;
    try{ r=new THREE.WebGLRenderer({canvas:cv, alpha:true, antialias:true, preserveDrawingBuffer:true}); }
    catch(e){ return rej(e); }
    r.setPixelRatio(1); r.setSize(SIZE,SIZE,false);
    r.outputColorSpace=THREE.SRGBColorSpace;
    r.toneMapping=THREE.ACESFilmicToneMapping; r.toneMappingExposure=1.18;

    const scene=new THREE.Scene();
    const cam=new THREE.PerspectiveCamera(22,1,0.05,20);
    scene.add(new THREE.HemisphereLight(0x46506a,0x141016,1.05));
    const key=new THREE.DirectionalLight(0xffe6cf,2.1); key.position.set(1.4,2.0,2.4); scene.add(key);
    const rim=new THREE.DirectionalLight(0xC9563F,1.5); rim.position.set(-1.8,1.6,-2.0); scene.add(rim);

    /* 방어구 조각은 attach 안에서 «따로» 받아 온다. onMain(무기)만 기다렸다가 굽는 바람에
       후드를 써도 초상이 그대로였다 — 로딩 관리자가 «전부 끝났다» 고 할 때 굽는다. */
    const mgr=new THREE.LoadingManager();
    const loader=new GLTFLoader(mgr);
    const done=(url)=>{ try{ r.dispose(); }catch(e){} res(url); };
    const fail=(e)=>{ try{ r.dispose(); }catch(x){} rej(e); };

    loader.load('art/3d/'+char+'_anim.glb', g=>{
      try{
        globalThis.TW_POSE?.repair(THREE, g);
        globalThis.TW_MATFIX?.repair(THREE, g.scene);
        const model=g.scene; scene.add(model);
        /* 초상은 «정면 얼굴» — 대기 자세 한 프레임만 쓰고 믹서는 버린다 */
        const mx=new THREE.AnimationMixer(model);
        const idle=(g.animations||[]).find(c=>c.name==='idle');
        if(idle){ mx.clipAction(idle).play(); mx.update(0.35); }
        model.updateMatrixWorld(true);

        const finish=()=>{
          model.updateMatrixWorld(true);
          /* 머리 뼈를 찾아 그 위를 잡는다 — 경계 상자로 잡으면 무기 때문에 어긋난다 */
          let head=null;
          model.traverse(o=>{ if(o.isBone&&o.name.replace(/^mixamorig:?/,'')==='Head') head=o; });
          const p=new THREE.Vector3();
          if(head) head.getWorldPosition(p); else { const bb=new THREE.Box3().setFromObject(model); p.set(0,bb.max.y-0.16,0); }
          /* 머리 뼈는 «목» 에 있고 머리 기하는 그 위 0.06 쯤에 있다.
             처음엔 0.62 까지 붙였다가 턱이 아래로, 머리카락이 오른쪽으로 잘렸다.
             머리(높이 0.19·폭 0.24)에 여백을 주려면 보이는 높이가 0.32 는 돼야 한다. */
          const at=new THREE.Vector3(p.x, p.y+0.042, p.z);
          cam.position.set(at.x+0.10, at.y+0.03, at.z+0.82);   /* 살짝 3/4 */
          cam.lookAt(at); cam.updateProjectionMatrix();
          r.render(scene,cam);
          let url=null; try{ url=cv.toDataURL('image/webp',0.9); }catch(e){}
          if(!url||url.length<800){ try{ url=cv.toDataURL('image/png'); }catch(e){} }
          url?done(url):fail(new Error('toDataURL 실패'));
        };

        if(window.TW_LOOKS&&window.TW_GEAR){
          const G=window.TW_GEAR, eq=G.state().equipped;
          const baseOf=id=>{ const it=window.TW_ITEMS&&TW_ITEMS.get(id); return it&&it.custom?it.custom.base:id; };
          const tintOf=id=>G.tintOf?G.tintOf(id):null;
          const mixOf=id=>(G.dyeOf&&G.dyeOf(id))?0.75:null;
          let settled=false, attached=false, timer=null;
          const once=()=>{ if(settled) return; settled=true; clearTimeout(timer); finish(); };
          mgr.onLoad=()=>{ if(!attached) return; clearTimeout(timer); timer=setTimeout(once,90); };
          try{ TW_LOOKS.attach(THREE, loader, model, eq, { charId:char, baseOf, tintOf, mixOf }); }
          catch(e){ once(); }
          attached=true;
          /* 이미 다 받아 둔 조각뿐이면 onLoad 가 안 올 수도 있다 */
          timer=setTimeout(once, 900);
          setTimeout(once, 5000);            /* 무엇이 안 와도 초상은 나와야 한다 */
        } else finish();
      }catch(e){ fail(e); }
    }, undefined, fail);
  });
}

let inflight=null;
function portrait(){
  const G=window.TW_GEAR; if(!G) return Promise.reject(new Error('gear 없음'));
  const char=G.char()||'ain', k=stateKey();
  const hit=k&&cached(k);
  if(hit) return Promise.resolve(hit);
  if(inflight) return inflight;
  inflight=bake(char).then(url=>{ if(k) store(k,url); inflight=null; return url; },
                            e=>{ inflight=null; throw e; });
  return inflight;
}

/* [data-portrait="me"] 에 끼운다. 실패하면 원화 그대로 둔다 — 빈 칸을 남기지 않는다 */
function apply(){
  const els=document.querySelectorAll('[data-portrait="me"]');
  if(!els.length) return;
  portrait().then(url=>{
    els.forEach(el=>{
      const img=el.tagName==='IMG'?el:el.querySelector('img');
      if(img) img.src=url; else el.style.backgroundImage='url('+url+')';
      el.classList.add('is-3d');
    });
  }).catch(e=>console.info('[tw-portrait] 원화 유지:', e&&e.message));
}

globalThis.TW_PORTRAIT={ portrait, apply, bake, stateKey };
if(document.readyState==='loading') addEventListener('DOMContentLoaded', apply); else apply();
addEventListener('pageshow', ()=>{ window.TW_SAVE?.reload?.(); apply(); });
