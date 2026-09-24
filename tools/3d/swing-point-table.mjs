/* 스매시 날이 «어디를 얼마나 빠르게» 지나가는지 표로 뽑는다.
 *
 * 디렉터: 「스매쉬의 속도도 처음과 중간 마지막이 달라야하고. 그 지점에 따라
 * 데미지도 달라야하지」. 판정은 여전히 접점 한 순간(hitAt)에 나지만, «대상이
 * 스윙 호의 어디에 있었나» 는 기하로 정해진다 — 높이 있는 부위는 내려오는
 * 날의 앞쪽(느린 곳)에, 낮은 부위는 끝쪽(빠른 곳)에 걸린다. 그 순간 그 자리를
 * 지나던 날의 속도가 곧 위력이다.
 *
 * 게임과 똑같은 경로로 돌린다: 클립 교체 → sampleAction(세 박자 템포) → 두손
 * 리그 → 체간 스윙. 좌표는 아인 루트 기준 미터(CHAR_SCALE 1.14 곱함),
 *   f = 앞(+), h = 높이, 날을 손잡이→날끝 5 점으로 나눠 각 점의 속도를 적는다.
 *
 * 사용: node tools/3d/swing-point-table.mjs [clip] > 표
 */
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
const require=createRequire(import.meta.url);
globalThis.TW_COMBAT_QUALITY=require('../../js/combat-quality.js');
require('../../js/swing-body.js');
const vm=require('node:vm'), fs=require('node:fs'), ctx={window:{}};
for(const n of ['world','dungeons']) vm.runInNewContext(fs.readFileSync(new URL('../../js/'+n+'.js',import.meta.url),'utf8'),ctx);
const R=ctx.window.TW_DUNGEONS.RULES;
const {repairAinBind,repairAinClips}=await import('../../js/ain-bind-repair.js');
const {makeAinRigAdapter}=await import('../../js/ain-two-hand.js');
const {sampleAction}=await import('../../js/combat-motion.js');

const name=process.argv[2]||'smash', CHAR_SCALE=1.14;
const load=async f=>{const b=await readFile(new URL(f,import.meta.url)),l=new GLTFLoader();
  l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
  return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const g=await load('../../art/3d/ain_anim.glb'), w=await load('../../art/3d/ain_scythe_tex.glb');
const root=new T.Group(); root.add(g.scene);
const clips=repairAinClips(g.animations,repairAinBind(g.scene));
let slot; g.scene.traverse(o=>{if(o.name.endsWith('RightHandSlot'))slot=o;});
slot.add(w.scene);
/* 날끝 = 무기 메시에서 손잡이(슬롯)로부터 가장 먼 점 */
w.scene.updateWorldMatrix(true,true);
const inv=new T.Matrix4().copy(w.scene.matrixWorld).invert(); let tip=null,far=-1;
w.scene.traverse(o=>{ if(!o.isMesh) return; o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox;
  for(let i=0;i<8;i++){ const v=new T.Vector3(i&1?bb.max.x:bb.min.x,i&2?bb.max.y:bb.min.y,i&4?bb.max.z:bb.min.z).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
    if(v.length()>far){far=v.length();tip=v.clone();} } });
const rig=makeAinRigAdapter(g.scene,root,slot), mixer=new T.AnimationMixer(g.scene);
const M=R.motion, prof=(M.characterProfiles&&M.characterProfiles.ain)||{}, P=prof[name]||{};
const KIND={attack1:'light',attack2:'light',attack3:'light',smash:'smash',counter:'counter',exec:'exec',ult:'ult'};
const base=M[KIND[name]]||M.light, dur=P.duration||base.duration, hitAt=(P.hit!=null?P.hit:base.hit);
const hit=(M.clipContacts||{})[name], span=(M.clipSpan||{})[name]||1;
const clip=clips.find(c=>c.name===name), a=mixer.clipAction(clip);
const act={id:'t',clip:name,kind:'attack',duration:dur,hitAt,elapsed:0,clipHit:hit,combo:0,opt:{}};
const pose=e=>{ rig.restore(); mixer.stopAllAction(); a.reset(); a.play(); a.paused=true;
  a.time=Math.max(0,Math.min(clip.duration,sampleAction(Object.assign({},act,{elapsed:e,clipHit:hit/span}),clip.duration*span)));
  mixer.update(0); rig.apply(Object.assign({},act,{elapsed:e}),false,false,dur/240,name,null); root.updateMatrixWorld(true); };
for(let k=0;k<12;k++) pose(0);                                   /* 예열 */
const K=5, N=120, rows=[]; let prev=null;
for(let i=0;i<=N;i++){
  const e=dur*i/N; pose(e);
  const grip=slot.getWorldPosition(new T.Vector3()), t=tip.clone().applyMatrix4(slot.matrixWorld);
  const pts=[]; for(let k=0;k<K;k++) pts.push(grip.clone().lerp(t,(k+1)/K).multiplyScalar(CHAR_SCALE));
  const u=globalThis.TW_COMBAT_QUALITY.phase(Object.assign({},act,{elapsed:e}));
  rows.push({u:+u.toFixed(4), pts:pts.map(p=>[+p.z.toFixed(3),+p.y.toFixed(3),+p.x.toFixed(3)]),
             v:prev?pts.map((p,k)=>+(p.distanceTo(prev[k])/(dur/N)).toFixed(2)):pts.map(()=>0)});
  prev=pts;
}
console.log(JSON.stringify({clip:name,dur,hitAt,K,rows}));
