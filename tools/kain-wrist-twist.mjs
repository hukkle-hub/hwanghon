/* 카인 두 손 잡기 왼손목 비틀림 — 평1→평2→평3→스매시를 게임처럼 60 fps 로 «이어» 재생하며
   프레임마다 왼손목 비틀림(아래팔 대비, tests/hand-grip.test.mjs 와 같은 식)·팔 닿음 부족·손목 꺾임을 잰다.
   사용: node tools/kain-wrist-twist.mjs [클립,클립,...]   (기본 attack1,attack2,attack3,smash)
   출력: 클립별 최대 비틀림과 그 순간(u), 60° 넘는 프레임 수, 그 순간의 resid(팔이 모자란 거리)·bend. */
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {gripHands} from '../js/hand-grip.js';
import {makeRigAdapter} from '../js/combat-motion.js';

globalThis.window=globalThis;
if(!globalThis.TW_LOOKS)vm.runInThisContext(fs.readFileSync('js/looks.js','utf8'));
const L=globalThis.TW_LOOKS,V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
const CLIPS=(process.argv[2]||'attack1,attack2,attack3,smash').split(',');
const b=fs.readFileSync('art/3d/kain_anim.glb'),ld=new GLTFLoader();ld.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
const g=await ld.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
const root=new T.Group(),m=g.scene;m.scale.setScalar(1.14);root.add(m);
const bones={};m.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
const HG=gripHands(m,'kain'),slot=L.anchor(T,bones.RightHandSlot);slot.userData.hand2=L.WEAPON.w_kain_greatsword.hand2;
const ad=makeRigAdapter(m,root,slot,{twoHand:true,handGrip:HG}),mixer=new T.AnimationMixer(m),left=bones.LeftHand;
function twist(){const rel=bones.LeftForeArm.getWorldQuaternion(Q()).invert().multiply(left.getWorldQuaternion(Q())),bx=left.position.clone().normalize(),p3=V().set(rel.x,rel.y,rel.z),pr=bx.multiplyScalar(p3.dot(bx));
  return 2*Math.acos(Math.min(1,Math.abs(new T.Quaternion(pr.x,pr.y,pr.z,rel.w).normalize().w)))*180/Math.PI;}
const out={};let id=0,prevS=null,prevE=null;const sw={max:0,at:''},el={max:0,at:''};
const idle=n=>{for(let i=0;i<n;i++){ad.restore();mixer.stopAllAction();mixer.update(0);ad.apply(null,false,false,process.env.GAME?.01:1/60);}prevS=prevE=null;};
const AGG={};const QUIET=!!process.env.MULTI;const log=(...a)=>{if(!QUIET)console.log(...a);};
/* MULTI=1: 여러 순서 × 클립 사이 쉬는 프레임 — 팔 풀이는 앞 프레임 해를 이어받아 한 순서만 재면 우연에 흔들린다 */
const SEQS=process.env.MULTI?['attack1,attack2,attack3,smash','attack2,attack3,smash','attack3,smash','attack1,attack2,attack3','attack1,smash','smash'].map(x=>x.split(',')):[CLIPS];
const GAPS=process.env.MULTI?[0,4,10,24]:[0];
for(const SEQ of SEQS)for(const GAP of GAPS){ idle(30);
for(const name of SEQ){ if(GAP)idle(GAP);
  const c=g.animations.find(a=>a.name===name);if(!c){console.log('없음',name);continue;}
  id++;const rows=[];
  mixer.stopAllAction();const act=mixer.clipAction(c);act.reset().play();
  /* GAME=1: 게임과 같은 조건 — 0.01 s 틱(R.tick)으로, 클립 전체를 행동 시간 ACT(기본 0.66 s)에 편다(카인 평3 은 clipSpan 없음 → 약 1.5 배속) */
  const GAME=!!process.env.GAME,DT=GAME?.01:1/60,ACT=Number(process.env.ACT||.66),K=GAME?c.duration/ACT:1;
  for(let t=0;t<=c.duration+1e-6;t+=DT*K){
    ad.restore();act.time=t;mixer.update(0);root.updateMatrixWorld(true);const raw=twist();   /* IK 전 = 원본 클립 자세 */
    ad.apply({id,clip:name,kind:'attack',duration:c.duration,elapsed:t,hitAt:c.duration*.42},false,false,DT);root.updateMatrixWorld(true);
    /* 대검(오른손 슬롯)·왼팔꿈치가 한 프레임에 움직인 거리 — 속도 제한을 풀면 «튀는지» 본다 */
    const sp=slot.getWorldPosition(V()),ep=bones.LeftForeArm.getWorldPosition(V());
    if(prevS&&t>2.5*DT*K){const ds=sp.distanceTo(prevS),de=ep.distanceTo(prevE);if(ds>sw.max){sw.max=ds;sw.at=name+' u'+(t/c.duration).toFixed(2);}if(de>el.max){el.max=de;el.at=name+' u'+(t/c.duration).toFixed(2);}}
    const dE=prevE&&t>2.5*DT*K?ep.distanceTo(prevE):0,dS=prevS&&t>2.5*DT*K?sp.distanceTo(prevS):0;prevS=sp;prevE=ep;
    const d=ad.diagnostics||{};rows.push({t:+t.toFixed(3),u:+(t/c.duration).toFixed(2),tw:+twist().toFixed(1),raw:+raw.toFixed(1),hold:+(d.twoHand||0).toFixed(2),resid:d.gripResid!=null?+d.gripResid.toFixed(3):null,bend:d.gripBend!=null?+(d.gripBend*180/Math.PI).toFixed(0):null,pull:d.gripPull!=null?+d.gripPull.toFixed(3):null,clav:d.gripClav!=null?+(d.gripClav*180/Math.PI).toFixed(0):null,err:+((d.gripError||0)*100).toFixed(1),dE:+(dE*100).toFixed(1),dS:+(dS*100).toFixed(1),needP:d.gripNeedPull!=null?+d.gripNeedPull.toFixed(3):null,needC:d.gripNeedClav!=null?+d.gripNeedClav.toFixed(2):null});
  }
  const held=rows.filter(r=>r.hold>.99),w=held.reduce((a,r)=>r.tw>a.tw?r:a,{tw:-1});
  out[name]={max:w.tw,u:w.u,over60:held.filter(r=>r.tw>60).length,frames:held.length,rawMax:Math.max(...rows.map(r=>r.raw)),at:w};
  const any=rows.filter(r=>r.hold>0),wa=any.reduce((a,r)=>r.tw>a.tw?r:a,{tw:-1});out[name].anyMax=wa.tw;
  const A=AGG[name]=AGG[name]||{tw:0,over60:0,held:0,err:0};A.tw=Math.max(A.tw,w.tw);A.over60+=out[name].over60;A.held+=held.length;A.err=Math.max(A.err,held.reduce((a,r)=>Math.max(a,r.err),0));
  log(`${name.padEnd(8)} 잡기 중(hold>0) 최대 ${wa.tw}° @u ${wa.u} hold ${wa.hold} (원본 ${wa.raw}°)`);
  const we=any.reduce((a,r)=>r.err>a.err?r:a,{err:-1});out[name].errMax=we.err;
  log(`${name.padEnd(8)} 주먹-손잡이 최대 ${we.err} cm @u ${we.u} hold ${we.hold}`);
  log(`${name.padEnd(8)} 잡은 프레임 ${String(held.length).padStart(3)} · 최대 비틀림 ${w.tw}° @u ${w.u} (원본 클립 그 순간 ${w.raw}°, resid ${w.resid}, bend ${w.bend}°) · 60° 초과 ${out[name].over60} 프레임 · 원본 클립 최대 ${out[name].rawMax.toFixed(0)}°`);
  const U=(process.env.U||'').split('-').map(Number);if(process.env.ROWS)console.log((U.length===2?rows.filter(r=>r.u>=U[0]&&r.u<=U[1]):held.filter(r=>r.tw>50)).map(r=>`  u${r.u} tw ${r.tw} raw ${r.raw} resid ${r.resid} bend ${r.bend} pull ${r.pull} clav ${r.clav} 주먹-손잡이 ${r.err} cm · 필요 pull ${r.needP} clav(rad) ${r.needC} · 프레임 이동 대검 ${r.dS} 팔꿈치 ${r.dE} cm`).join('\n'));
}
}
if(QUIET)for(const [k,A] of Object.entries(AGG))console.log(`${k.padEnd(8)} ${SEQS.length}순서×${GAPS.length}간격 · 잡은 프레임 ${A.held} · 최대 비틀림 ${A.tw}° · 60° 초과 ${A.over60} 프레임 · 잡은 채 주먹-손잡이 최대 ${A.err} cm`);
console.log(`(클립 첫 두 프레임 제외 — 이 도구는 클립 사이 교차 페이드가 없다) 대검 슬롯 프레임당 최대 ${(sw.max*100).toFixed(1)} cm (${sw.at}) · 왼팔꿈치 프레임당 최대 ${(el.max*100).toFixed(1)} cm (${el.at})`);
if(process.env.OUT)fs.writeFileSync(process.env.OUT,JSON.stringify(out,null,1));
