/* 대기↔공격 넘어갈 때 팔 돌기 (docs/design/99).
   (1) 팔 돌기 묶기(js/arm-blend.js): 위팔·아래팔이 제 축 둘레로 한 프레임 ROLL_RATE/60 넘게 돌지 않고, 관절 자리·손 방향은 그대로.
   (2) 게임처럼(곡선화 + 교차 페이드 + 두 손 잡기 + 묶기, 60 fps) 대기 → 기술 → 대기를 돌려
       팔 뼈가 한 프레임 40° 넘게 돌지 않고(전: 아래팔 135~165°, 묶기 12°/프레임 · 관절이 90° 넘게 꼬이면 최대 36°), 왼팔꿈치 가속이 50 cm/프레임² 안(전: 76~120). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {makeRigAdapter} from '../js/combat-motion.js';
import {gripHands} from '../js/hand-grip.js';
import {smoothCharacterClips} from '../js/clip-smooth.js';
import {transitionFor} from '../js/character-cinema.js';
import {createArmBlend,ROLL_RATE} from '../js/arm-blend.js';

globalThis.window=globalThis;
if(!globalThis.TW_LOOKS)vm.runInThisContext(fs.readFileSync('js/looks.js','utf8'));
if(!globalThis.TW_DUNGEONS)vm.runInThisContext(fs.readFileSync('js/dungeons.js','utf8'));
const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
async function load(ch){const b=fs.readFileSync(`art/3d/${ch}_anim.glb`),l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
  return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const bonesOf=m=>{const B={};m.traverse(o=>{if(o.isBone)B[o.name.replace(/^mixamorig:?/,'')]=o;});return B;};
/* 보이는 팔 돌기: 뼈에 붙은 옆 방향 표지를 가슴 기준으로 앞 프레임과 견준다(뼈 축 둘레 각) */
function rollMeter(B,names){const chest=B.Spine2,prev={};
  return ()=>{const ci=chest.getWorldQuaternion(Q()).invert();let worst=0;
    for(const n of names){const b=B[n],ax=b.children.find(c=>c.isBone).position.clone().normalize(),m=V().set(1,0,0);if(Math.abs(ax.x)>.8)m.set(0,0,1);m.addScaledVector(ax,-m.dot(ax)).normalize();
      const q=ci.clone().multiply(b.getWorldQuaternion(Q())),A=ax.applyQuaternion(q),M=m.applyQuaternion(q);
      if(prev[n]){const p=prev[n].clone().addScaledVector(A,-prev[n].dot(A)).normalize();worst=Math.max(worst,p.angleTo(M));}prev[n]=M;}
    return worst*180/Math.PI;};}

test('arm roll limiter: bone roll per frame is capped, joints and hand orientation stay put',async()=>{
  for(const [flip,maxStep,frames] of [[80,ROLL_RATE/60,[6,8]],[150,3*ROLL_RATE/60,[4,14]]]){
    const g=await load('kain'),m=g.scene,B=bonesOf(m),ab=createArmBlend(m);
    m.updateMatrixWorld(true);ab.apply(1/60);
    const fo=B.RightForeArm,ax=B.RightHand.position.clone().normalize(),q0=fo.quaternion.clone(),qf=q0.clone().multiply(Q().setFromAxisAngle(ax,flip*Math.PI/180));
    const meter=rollMeter(B,['RightForeArm']);meter();
    let steps=0;
    for(let f=0;f<40;f++){ab.restore();
      fo.quaternion.copy(qf);   /* 클립이 한 프레임에 flip° 뒤집음 */
      m.updateMatrixWorld(true);const hand=B.RightHand.getWorldQuaternion(Q()),wrist=B.RightHand.getWorldPosition(V()),elbow=fo.getWorldPosition(V());
      ab.apply(1/60);m.updateMatrixWorld(true);const r=meter();
      assert.ok(r<=maxStep*180/Math.PI+.05,`${flip}° 프레임 ${f}: 아래팔이 ${r.toFixed(1)}° 돌았다`);
      assert.ok(B.RightHand.getWorldPosition(V()).distanceTo(wrist)<1e-5&&fo.getWorldPosition(V()).distanceTo(elbow)<1e-5,'관절 자리가 움직였다');
      assert.ok(B.RightHand.getWorldQuaternion(Q()).angleTo(hand)<1e-3,`${flip}° 프레임 ${f}: 손 방향이 ${(B.RightHand.getWorldQuaternion(Q()).angleTo(hand)*57.3).toFixed(3)}° 바뀌었다`);
      if(ab.diagnostics.clamped)steps=f+1;}
    assert.ok(steps>=frames[0]&&steps<=frames[1],`${flip}° 를 ${steps} 프레임에 따라잡았다(기대 ${frames})`);
    ab.restore();assert.ok(fo.quaternion.angleTo(qf)<1e-6,'되돌리면 믹서 값 그대로');
  }
});

test('kain idle → attack → idle in game order: no arm spin, no left elbow jump',async()=>{
  const CH='kain',R=globalThis.TW_DUNGEONS.RULES;
  for(const seq of [['attack1'],['attack3'],['smash'],['ult'],['exec'],['attack1','attack2','attack3']]){
    const g=await load(CH),clips=smoothCharacterClips(CH,g.animations,Object.assign({},R.motion.clipContacts,(R.motion.clipContactsByChar||{})[CH]));
    const root=new T.Group(),m=g.scene;m.scale.setScalar(1.14);root.add(m);const B=bonesOf(m);
    const slot=globalThis.TW_LOOKS.anchor(T,B.RightHandSlot);slot.userData.hand2=globalThis.TW_LOOKS.WEAPON.w_kain_greatsword.hand2;
    const ad=makeRigAdapter(m,root,slot,{twoHand:true,handGrip:gripHands(m,CH)}),ab=createArmBlend(m),mixer=new T.AnimationMixer(m);
    const A=n=>mixer.clipAction(clips.find(c=>c.name===n)),base=A('idle');base.reset().play();
    const step=a=>{ab.restore();ad.restore();mixer.update(1/60);ad.apply(a,false,false,1/60);ab.apply(1/60);root.updateMatrixWorld(true);};
    for(let i=0;i<60;i++)step(null);
    const meter=rollMeter(B,['LeftArm','LeftForeArm','RightArm','RightForeArm']);meter();
    const H=[];let worstRoll=0,worstAcc=0,at='';
    let q=[...seq],act=null,cur=null,t0=0,time=0,tail=null;
    const start=n=>{const a=A(n),tr=transitionFor(CH,n);if(act){act.clampWhenFinished=true;act.fadeOut(Math.min(.08,tr.out));}a.reset();a.setLoop(T.LoopOnce,1);a.clampWhenFinished=false;a.enabled=true;a.setEffectiveWeight(1);a.fadeIn(tr.in);a.play();base.fadeOut(tr.in);act=a;cur=n;t0=time;};
    start(q.shift());
    for(let f=0;f<600;f++){
      if(act&&time-t0>=act.getClip().duration-Math.min(.14,transitionFor(CH,cur).out*.8)){if(q.length)start(q.shift());else{const out=transitionFor(CH,cur).out;act.clampWhenFinished=true;act.fadeOut(out);base.reset();base.fadeIn(out);base.play();tail={clip:cur,dur:act.getClip().duration,t0};act=null;cur=null;}}
      if(!act&&tail&&time-tail.t0>tail.dur+.6)break;
      time+=1/60;
      const a=act?{id:cur,clip:cur,kind:'attack',duration:act.getClip().duration,elapsed:time-t0,hitAt:act.getClip().duration*.42}:(tail&&time-tail.t0<tail.dur?{id:tail.clip,clip:tail.clip,kind:'attack',duration:tail.dur,elapsed:time-tail.t0,hitAt:tail.dur*.42}:null);
      step(a);
      const r=meter();if(r>worstRoll){worstRoll=r;at=`${cur||'대기'} ${(time-t0).toFixed(2)}`;}
      const hi=B.Hips.getWorldQuaternion(Q()).invert();H.push(B.LeftForeArm.getWorldPosition(V()).sub(B.Hips.getWorldPosition(V())).applyQuaternion(hi));
      if(H.length>=3){const n=H.length,acc=H[n-1].clone().sub(H[n-2].clone().multiplyScalar(2)).add(H[n-3]).length()*100;worstAcc=Math.max(worstAcc,acc);}}
    assert.ok(worstRoll<=40,`${seq.join('→')}: 팔 뼈가 한 프레임 ${worstRoll.toFixed(0)}° 돌았다 @${at}`);
    assert.ok(worstAcc<=50,`${seq.join('→')}: 왼팔꿈치 가속 ${worstAcc.toFixed(0)} cm/프레임²`);
  }
});
