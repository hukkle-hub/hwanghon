/* 문서 121 §3 — 카인 평3(몸통 비틀기, 문서 120)에서 필요한 왼쇄골 각·오른손 당김이 한 틱에 0 → 최대로 뛰는데
   대칭 속도 제한(5 rad/s·1 m/s)으로 따라가 «두 손으로 잡은 채» 왼주먹이 손잡이에서 최대 19 cm 떴다(게임 40 초 녹화 20 cm).
   늘릴 때만, 잡은 채 보통 속도로는 2 cm 넘게 못 닿는 틱에만 빠르게(8 m/s·40 rad/s) 따라간다.
   게임과 같은 조건: 0.01 s 틱(R.tick), 클립 전체를 행동 0.66 s 에 편다(카인 평3 은 clipSpan 없음). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {gripHands} from '../js/hand-grip.js';
import {makeRigAdapter} from '../js/combat-motion.js';

globalThis.window=globalThis;
if(!globalThis.TW_LOOKS)vm.runInThisContext(fs.readFileSync('js/looks.js','utf8'));
const L=globalThis.TW_LOOKS;

test('kain 평1→평2→평3 연속(게임 틱): 두 손으로 잡은 동안 왼주먹이 손잡이에서 뜨지 않는다',async()=>{
  const b=fs.readFileSync('art/3d/kain_anim.glb'),ld=new GLTFLoader();ld.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
  const g=await ld.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  const root=new T.Group(),m=g.scene;m.scale.setScalar(1.14);root.add(m);
  const bones={};m.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
  const HG=gripHands(m,'kain'),slot=L.anchor(T,bones.RightHandSlot);slot.userData.hand2=L.WEAPON.w_kain_greatsword.hand2;
  const ad=makeRigAdapter(m,root,slot,{twoHand:true,handGrip:HG}),mixer=new T.AnimationMixer(m),DT=.01;
  for(let i=0;i<30;i++){ad.restore();ad.apply(null,false,false,DT);}
  const worst={},over5={};let id=0;
  for(const name of ['attack1','attack2','attack3']){
    const c=g.animations.find(a=>a.name===name),K=c.duration/.66;id++;worst[name]=0;over5[name]=0;
    mixer.stopAllAction();const act=mixer.clipAction(c);act.reset().play();
    for(let t=0;t<=c.duration+1e-6;t+=DT*K){
      ad.restore();act.time=t;mixer.update(0);root.updateMatrixWorld(true);
      ad.apply({id,clip:name,kind:'attack',duration:c.duration,elapsed:t,hitAt:c.duration*.42},false,false,DT);root.updateMatrixWorld(true);
      const d=ad.diagnostics;if(d.twoHand>.99){worst[name]=Math.max(worst[name],d.gripError);if(d.gripError>.05)over5[name]++;}
    }
  }
  /* 잰 값(수정 후): 평1 0 · 평2 0.5 · 평3 7.9 cm, 5 cm 초과 4 틱(0.04 s, 필요량이 뛰는 순간). 수정 전 평3 19 cm · 5 cm 초과 9 틱 */
  assert.ok(worst.attack3<.10,`평3: 잡은 채 왼주먹-손잡이 ${(worst.attack3*100).toFixed(1)} cm`);
  assert.ok(over5.attack3<=5,`평3: 5 cm 넘게 뜬 틱 ${over5.attack3}`);
  assert.ok(worst.attack1<.02&&worst.attack2<.02,`평1·평2 는 그대로 붙어 있어야 한다 (${(worst.attack1*100).toFixed(1)} · ${(worst.attack2*100).toFixed(1)} cm)`);
});
