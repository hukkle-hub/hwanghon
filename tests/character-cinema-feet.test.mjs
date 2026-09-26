/* 시네마 레이어가 골반을 낮추거나 돌려도 발은 제자리에 있어야 한다 (docs/design/91 적용 기록).
   인수인계 초안은 골반만 내려서 발이 바닥 아래로 꺼졌다 — 카인 백스텝 12 cm. 실제 캐릭터 GLB 로 잰다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {createCharacterCinema} from '../js/character-cinema.js';

async function load(ch){const b=fs.readFileSync(`art/3d/${ch}_anim.glb`);const l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const low=b=>Math.min(b.LeftFoot.getWorldPosition(new T.Vector3()).y,b.RightFoot.getWorldPosition(new T.Vector3()).y);

test('cinema layer keeps both feet planted (≤ 3 cm) through dodge, hit and attacks',async()=>{
  for(const ch of ['ain','kain','ryu','sera']){
    const g=await load(ch),root=new T.Group(),m=g.scene;m.scale.setScalar(1.14);root.add(m);
    const bones={};m.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
    const mixer=new T.AnimationMixer(m),cin=createCharacterCinema(m,root,ch);let worst=0,where='';
    for(const clip of ['dodgeB','dodgeL','hit2','attack1','smash','skill1','ult','idle']){
      const c=g.animations.find(a=>a.name===clip);if(!c)continue;mixer.stopAllAction();const act=mixer.clipAction(c);act.reset().play();
      for(let i=0;i<=20;i++){const u=i/20;act.time=c.duration*u*.999;mixer.update(0);root.updateMatrixWorld(true);const f0=low(bones);
        const atk=/attack|skill|ult|smash/.test(clip);cin.apply({dt:1/60,clip,clipTime:u,action:atk?{clip,elapsed:u*c.duration,duration:c.duration}:null});root.updateMatrixWorld(true);
        const d=f0-low(bones);cin.restore();if(d>worst){worst=d;where=clip+'@'+u.toFixed(2);}}
    }
    assert.ok(worst<=.03,`${ch}: 발이 ${(worst*100).toFixed(1)} cm 꺼졌다 (${where})`);
  }
});
