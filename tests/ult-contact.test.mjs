import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {repairAinClips} from '../js/ain-bind-repair.js';

/* 궁극기는 «피해가 뜨는 그 프레임» 에 실제로 치고 있어야 한다.
   앵커가 .78 이던 동안 그 순간의 손은 1.5 m/s 로 «떠 있었다» — 휘두름과 휘두름
   사이에서 피해가 떴다. .86 에서는 49.6 m/s 로 지나간다.
   런타임이 쓰는 클립(ain-bind-repair 가 갈아 끼운 것)으로 재야 한다 — GLB 의
   ult 트랙은 게임이 재생하지 않는다. docs/design/49-skill-motion.md

   «앞으로 뻗었나» 는 일부러 재지 않는다. 손이 몸통 기준 어느 축으로 나가는지는
   이 리그에서 한 축으로 딱 떨어지지 않아(찌르기에서 ±X 0.39/0.43, −Z 0.40)
   잘못 읽기 쉽다. 대신 «뻗음»(엉덩이~손 거리)과 «속도» 로 본다. */
const FPS=60, TRACK=['LeftHand','RightHand','LeftFoot','RightFoot'];

async function played(){
  const b=await readFile('art/3d/ain_anim.glb'), l=new GLTFLoader();
  l.register(()=>({name:'no-raster',loadTexture:()=>Promise.resolve(new T.Texture())}));
  const g=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  return {root:g.scene, clips:repairAinClips(g.animations,{changed:new Map()})};
}

function trace(root, clip){
  const bone={}; root.traverse(o=>{ if(o.isBone) bone[o.name.replace(/^mixamorig:?/,'')]=o; });
  const mixer=new T.AnimationMixer(root), act=mixer.clipAction(clip);
  mixer.stopAllAction(); act.reset(); act.setLoop(T.LoopOnce,1); act.clampWhenFinished=true; act.play();
  const N=Math.max(4,Math.round(clip.duration*FPS)), rows=[], yaw=[];
  for(let i=0;i<=N;i++){
    mixer.setTime(Math.min(clip.duration*0.998,i/FPS)); root.updateMatrixWorld(true);
    yaw.push(new T.Euler().setFromQuaternion(bone.Hips.getWorldQuaternion(new T.Quaternion()),'YXZ').y);
    const h=bone.Hips.getWorldPosition(new T.Vector3()), r={};
    for(const n of TRACK) if(bone[n]) r[n]=bone[n].getWorldPosition(new T.Vector3()).sub(h);
    rows.push(r);
  }
  act.stop();
  const sp=[], ext=[];
  for(let i=1;i<rows.length;i++){
    let s=0; for(const n of TRACK){ const a=rows[i-1][n], c=rows[i][n]; if(a&&c) s=Math.max(s,a.distanceTo(c)*FPS); }
    sp.push(s);
    const hands=[rows[i].RightHand,rows[i].LeftHand].filter(Boolean);
    ext.push(Math.max(...hands.map(v=>v.length())));    /* 엉덩이~손 거리 = 뻗음 */
  }
  return {sp, ext, yaw};
}

test('궁극기는 피해가 뜨는 프레임에 실제로 치고 있다', async () => {
  const {root, clips}=await played();
  const ult=clips.find(c=>c.name==='ult');
  const {sp, ext, yaw}=trace(root, ult);
  const k=Math.round(0.50*sp.length);                   /* clipContacts.ult = 0.50 */
  assert.ok(sp[k]>20, '판정 순간 손 속도가 '+sp[k].toFixed(1)+' m/s — 치는 중이 아니다');
  assert.ok(ext[k]>0.40, '판정 순간 팔이 '+ext[k].toFixed(2)+' m — 대기(0.34 m)보다 뻗어 있어야 한다');
  assert.ok(Math.abs(yaw[k])<0.30, '판정 순간 상대를 보고 있어야 한다 (요우 '+(yaw[k]*180/Math.PI).toFixed(0)+'°)');
});

test('궁극기의 최고속 지점이 판정과 같은 자리에 있다', async () => {
  const {root, clips}=await played();
  const {sp}=trace(root, clips.find(c=>c.name==='ult'));
  /* 첫 봉우리는 회전의 시작이다. «앞으로 뻗은» 마지막 봉우리가 타격이다. */
  const vmax=Math.max(...sp);
  let last=-1, on=false, bi=0, bv=0;
  for(let i=0;i<sp.length;i++){
    if(!on && sp[i]>vmax*0.45){ on=true; bi=i; bv=sp[i]; }
    else if(on){ if(sp[i]>bv){bv=sp[i];bi=i;} if(sp[i]<vmax*0.28){ on=false; last=bi; } }
  }
  if(on) last=bi;
  const t=(last+0.5)/sp.length;
  assert.ok(Math.abs(t-0.50)<0.12, '타격 봉우리가 t='+t.toFixed(3)+' — 판정 0.50 과 0.12 넘게 벌어졌다');
});

test('피의 회전은 판정 프레임에 «한 바퀴를 끝내고 정면을 보며» 친다', async () => {
  const {root, clips}=await played();
  const {sp, ext, yaw}=trace(root, clips.find(c=>c.name==='skill3'));
  const k=Math.round(0.55*sp.length);                   /* clipContacts.skill3 = 0.55 */
  /* 최고속(35 m/s)은 베기의 정점인 0.61 에 있고, 판정 프레임 0.55 는 그 직전이다.
     고치기 전에는 이 자리가 0.3 m/s 였다 — 아무것도 안 하는 프레임에 피해가 떴다. */
  assert.ok(sp[k]>8, '판정 순간 손 속도가 '+sp[k].toFixed(1)+' m/s — 고치기 전에는 0.3 이었다');
  assert.ok(ext[k]>0.40, '판정 순간 팔이 '+ext[k].toFixed(2)+' m — 뻗어 있어야 한다');
  assert.ok(Math.abs(yaw[k])<0.30, '판정 순간 상대를 봐야 한다 (요우 '+(yaw[k]*180/Math.PI).toFixed(0)+'°)');
  const vmax=Math.max(...sp), pk=(sp.indexOf(vmax)+0.5)/sp.length;
  assert.ok(Math.abs(pk-0.55)<0.12, '베기의 정점이 t='+pk.toFixed(3)+' — 판정 0.55 와 0.12 넘게 벌어졌다');
  assert.ok(vmax>25, '최고속 '+vmax.toFixed(1)+' m/s — 기본 공격(32~42) 대역이어야 한다');
  /* 그리고 한 바퀴를 «실제로» 돈다 — 팔만 휘두르는 것이 아니다 */
  let total=0;
  for(let i=1;i<yaw.length;i++) total+=Math.atan2(Math.sin(yaw[i]-yaw[i-1]),Math.cos(yaw[i]-yaw[i-1]));
  assert.ok(Math.abs(total)>5.5, '골반 순회전 '+(Math.abs(total)*180/Math.PI).toFixed(0)+'° — 한 바퀴여야 한다');
});
