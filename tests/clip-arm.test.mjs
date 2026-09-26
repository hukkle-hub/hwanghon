/* 카인 몸 클립의 팔 뒤집힘 (docs/design/97) — 게임과 같은 곡선화를 거친 클립을 60 fps 로 돌려
   칼끝(오른손 슬롯 + 0.9 m)의 프레임당 가속(2차 차분)을 잰다. 굽는 단계의 IK 가 팔꿈치를 키마다 뒤집으면
   키 사이에서 대검이 한 프레임 아래로 꺾였다 돌아온다(3타 시작 296 cm/프레임²). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {smoothCharacterClips} from '../js/clip-smooth.js';
import {PATHS,pathSpec} from '../tools/3d/carry-paths.mjs';
globalThis.window=globalThis;
if(!globalThis.TW_DUNGEONS)vm.runInThisContext(fs.readFileSync('js/dungeons.js','utf8'));

test('Kain attack3 and ult: the greatsword tip does not flip between keys (clip arm IK repaired)',async()=>{
  const R=globalThis.TW_DUNGEONS.RULES;
  const b=fs.readFileSync('art/3d/kain_anim.glb');const l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
  const g=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  const clips=smoothCharacterClips('kain',g.animations,Object.assign({},R.motion.clipContacts,R.motion.clipContactsByChar.kain));
  const m=g.scene,B={};m.traverse(o=>{if(o.isBone)B[o.name.replace(/^mixamorig:?/,'')]=o;});const mixer=new T.AnimationMixer(m);
  /* 잰 값: 3타 296 → 23.5, 궁극기 14.2 (전문가 클립 스킬1·반격 손 가속 30 안팎). 한계 60 은 「근거 없음」 — 뒤집힘(수백)과 휘두름을 가른다 */
  for(const cn of ['attack3','ult']){const c=clips.find(x=>x.name===cn);const a=mixer.clipAction(c);mixer.stopAllAction();a.reset().play();
    const P=[];for(let t=0;t<=c.duration+1e-6;t+=1/60){a.time=t;mixer.update(0);m.updateMatrixWorld(true);const sl=B.RightHandSlot,h=B.Hips.getWorldPosition(new T.Vector3());
      P.push(new T.Vector3(0,.9,0).applyQuaternion(sl.getWorldQuaternion(new T.Quaternion())).add(sl.getWorldPosition(new T.Vector3())).sub(h));}
    let worst=0,at=0;for(let i=1;i<P.length-1;i++){const v=P[i+1].clone().sub(P[i].clone().multiplyScalar(2)).add(P[i-1]).length()*100;if(v>worst){worst=v;at=i/60;}}
    assert.ok(worst<=60,`kain ${cn}: 칼끝 가속 ${worst.toFixed(0)} cm/프레임² @ ${at.toFixed(2)}초 — 팔꿈치가 키 사이에서 뒤집힌다`);}
});

/* 굽는 단계의 «앞 뒤집힘» (docs/design/98) — rig_core.char_frame 이 골반 뼈의 아래쪽 축으로 앞을 잡아 골반이 조금만 기울어도
   앞이 180° 뒤집혔고, 1타·2타·스매시·처형의 뒷부분에서 손·대검이 몸 뒤로 거울처럼 옮겨졌다(2타 접점에 대검이 등 뒤).
   원본 키마다 설계 경로의 오른손 수평 방향과 90° 안이어야 한다. 칼끝 가속도 100 안(스매시 마무리 내려찍기 83) */
test('Kain attack1/attack2/smash/exec: hands stay on the designed side (no mirrored-forward keys) and the sword tip does not flip',async()=>{
  const R=globalThis.TW_DUNGEONS.RULES;
  const b=fs.readFileSync('art/3d/kain_anim.glb');const l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
  const g=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  const m=g.scene,B={};m.traverse(o=>{if(o.isBone)B[o.name.replace(/^mixamorig:?/,'')]=o;});
  m.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.pose();});m.updateMatrixWorld(true);const bindInv=B.Hips.getWorldQuaternion(new T.Quaternion()).invert();
  const mixer=new T.AnimationMixer(m);
  for(const cn of ['attack1','attack2','smash','exec']){const c=g.animations.find(x=>x.name===cn);const a=mixer.clipAction(c);mixer.stopAllAction();a.reset().play();
    for(let t=0;t<=c.duration+1e-6;t+=1/30){a.time=t;mixer.update(0);m.updateMatrixWorld(true);
      const D=B.Hips.getWorldQuaternion(new T.Quaternion()).multiply(bindInv),F=new T.Vector3(0,0,1).applyQuaternion(D);F.y=0;F.normalize();const Rt=new T.Vector3().crossVectors(F,new T.Vector3(0,1,0));
      const sp=pathSpec(PATHS[cn],t/c.duration),E=Rt.multiplyScalar(sp.rh[0]).addScaledVector(F,sp.rh[2]);
      const A=B.RightHand.getWorldPosition(new T.Vector3()).sub(B.Hips.getWorldPosition(new T.Vector3()));A.y=0;
      const ang=Math.abs(Math.atan2(new T.Vector3().crossVectors(E,A).y,E.dot(A)))*180/Math.PI;
      assert.ok(ang<=90,`kain ${cn} ${t.toFixed(2)}초: 오른손이 설계 방향과 ${ang.toFixed(0)}° — 몸 뒤로 뒤집힘`);}}
  const clips=smoothCharacterClips('kain',g.animations,Object.assign({},R.motion.clipContacts,R.motion.clipContactsByChar.kain));
  for(const cn of ['attack1','attack2','smash','exec']){const c=clips.find(x=>x.name===cn);const a=mixer.clipAction(c);mixer.stopAllAction();a.reset().play();
    const P=[];for(let t=0;t<=c.duration+1e-6;t+=1/60){a.time=t;mixer.update(0);m.updateMatrixWorld(true);const sl=B.RightHandSlot,h=B.Hips.getWorldPosition(new T.Vector3());
      P.push(new T.Vector3(0,.9,0).applyQuaternion(sl.getWorldQuaternion(new T.Quaternion())).add(sl.getWorldPosition(new T.Vector3())).sub(h));}
    let worst=0,at=0;for(let i=1;i<P.length-1;i++){const v=P[i+1].clone().sub(P[i].clone().multiplyScalar(2)).add(P[i-1]).length()*100;if(v>worst){worst=v;at=i/60;}}
    assert.ok(worst<=100,`kain ${cn}: 칼끝 가속 ${worst.toFixed(0)} cm/프레임² @ ${at.toFixed(2)}초`);}
});
