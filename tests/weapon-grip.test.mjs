/* 무기는 손바닥 안에 있어야 한다 (docs/design/93).
   카인·류·세라는 옛 관절 자리(rerigAnchor)에 무기를 달아 손잡이가 손바닥에서 12~19 cm 떠 있었다.
   손 자리 뼈(HandSlot)는 클립이 돌리므로 여러 자세에서 잰다. 실제 캐릭터 GLB 로. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {makeRigAdapter} from '../js/combat-motion.js';

globalThis.window=globalThis;
vm.runInThisContext(fs.readFileSync('js/looks.js','utf8'));
const L=globalThis.TW_LOOKS;

async function load(ch){const b=fs.readFileSync(`art/3d/${ch}_anim.glb`);const l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
function rig(g){const root=new T.Group(),m=g.scene;m.scale.setScalar(1.14);root.add(m);const bones={};m.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});return {root,m,bones,mixer:new T.AnimationMixer(m)};}
/* 손 뼈에 무게 0.6 이상 실린 정점(바인드, 손 뼈 로컬) */
function handVerts(m,hand){const out=[];m.traverse(o=>{if(!o.isSkinnedMesh)return;const bi=o.skeleton.bones.indexOf(hand);if(bi<0)return;const inv=o.skeleton.boneInverses[bi],P=o.geometry.attributes.position,SI=o.geometry.attributes.skinIndex,SW=o.geometry.attributes.skinWeight;
  for(let i=0;i<P.count;i++){let w=0;for(let k=0;k<4;k++)if(SI.getComponent(i,k)===bi)w+=SW.getComponent(i,k);if(w>=.6)out.push(new T.Vector3().fromBufferAttribute(P,i).applyMatrix4(o.bindMatrix).applyMatrix4(inv));}});return out;}
function pose(x,g,clip,u){const c=g.animations.find(a=>a.name===clip);x.mixer.stopAllAction();const act=x.mixer.clipAction(c);act.reset().play();act.time=c.duration*u;x.mixer.update(0);x.root.updateMatrixWorld(true);return c;}

test('grip node sits inside the palm and turns with the hand slot (kain, ryu, sera)',async()=>{
  for(const ch of ['kain','ryu','sera']){
    const g=await load(ch),x=rig(g);
    for(const side of ['Right','Left']){
      const slot=x.bones[side+'HandSlot'],hand=x.bones[side+'Hand'],grip=L.anchor(T,slot),verts=handVerts(x.m,hand);
      assert.equal(grip.parent,hand,`${ch} ${side}: 그립 노드는 손 뼈 자식이어야 한다`);
      const box=new T.Box3().setFromPoints(verts),near=Math.min(...verts.map(v=>v.distanceTo(grip.position)));
      /* 손 정점 상자 안 + 가장 가까운 정점 3 cm 이내 = 손 안 */
      assert.ok(box.containsPoint(grip.position)&&near<=.03,`${ch} ${side}: 그립이 손 밖 (가장 가까운 정점 ${(near*100).toFixed(1)} cm)`);
      for(const [clip,u] of [['idle',.3],['run',.5],['attack1',.4],['smash',.6],['skill1',.5]]){
        pose(x,g,clip,u);
        const hq=hand.getWorldQuaternion(new T.Quaternion()).multiply(slot.quaternion),gq=grip.getWorldQuaternion(new T.Quaternion());
        assert.ok(hq.angleTo(gq)<1e-3,`${ch} ${side} ${clip}: 그립 방향이 손 자리 뼈 회전을 따라야 한다`);
        const palm=L.palm(T,hand).clone().applyMatrix4(hand.matrixWorld);
        assert.ok(grip.getWorldPosition(new T.Vector3()).distanceTo(palm)<1e-4,`${ch} ${side} ${clip}: 그립 = 손바닥 중심`);
      }
    }
  }
});

test('two-hand grip IK only for Kain; puts the left palm on the greatsword axis',async()=>{
  for(const ch of ['kain','ryu','sera']){
    const g=await load(ch),x=rig(g),slot=L.anchor(T,x.bones.RightHandSlot),twoHand=ch==='kain';
    const ad=makeRigAdapter(x.m,x.root,slot,{twoHand}),left=x.bones.LeftHand;
    for(const [clip,u] of [['attack1',.35],['attack3',.35],['smash',.35],['skill1',.35]]){
      /* 한손 캐릭터: 몸통 비틀기는 그대로 두고, 가슴(Spine2) 기준 왼손 자리가 변하지 않아야 한다 */
      const chest=x.bones.Spine2,rel=()=>chest.worldToLocal(left.getWorldPosition(new T.Vector3()));
      const c=pose(x,g,clip,u),before=rel();ad.restore();
      ad.apply({id:1,clip,kind:'attack',duration:c.duration,elapsed:c.duration*u,hitAt:c.duration*.42},false,false,1/60);x.root.updateMatrixWorld(true);
      if(!twoHand){assert.ok(rel().distanceTo(before)*1.14<.01,`${ch} ${clip}: 한손·쌍수 캐릭터의 왼손을 무기로 끌면 안 된다`);ad.restore();continue;}
      const palm=L.palm(T,left).clone().applyMatrix4(left.matrixWorld),p=slot.getWorldPosition(new T.Vector3()),ax=new T.Vector3(0,1,0).applyQuaternion(slot.getWorldQuaternion(new T.Quaternion()));
      const d=palm.clone().sub(p),off=d.clone().sub(ax.clone().multiplyScalar(d.dot(ax))).length();
      /* 잰 값 1.3~7.7 cm (u=.35). 팔 길이 한계로 못 닿는 자세가 있어 10 cm 로 둔다 — 전에는 13~29 cm */
      assert.ok(off<=.10,`${ch} ${clip}: 왼손 손바닥이 대검 축에서 ${(off*100).toFixed(1)} cm`);ad.restore();
    }
  }
});
