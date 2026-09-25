import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
/* 이음새 — UV 이음새에서 둘로 나뉜 정점(바인드에서 같은 자리)은 움직여도 같은 자리여야 한다.
   다시 리깅(docs/design/77)의 무게 펴기가 이웃을 달리 봐서 이음새가 3~5 cm 벌어진 적이 있다
   (세라 머리칼·등의 검은 금). 변 늘어남 지표로는 안 잡혀서 따로 못박는다. */
async function load(f){const b=await readFile(f),l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
 return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
for(const ch of ['ain','kain','ryu','sera']){
 test(`${ch}: 움직여도 이음새가 벌어지지 않는다`,async()=>{
  const g=await load(`art/3d/${ch}_anim.glb`);let m;g.scene.traverse(o=>{if(o.isSkinnedMesh&&!m)m=o;});
  const pa=m.geometry.attributes.position,grp=new Map();
  for(let i=0;i<pa.count;i++){const k=Math.round(pa.getX(i)*1e5)+','+Math.round(pa.getY(i)*1e5)+','+Math.round(pa.getZ(i)*1e5);if(!grp.has(k))grp.set(k,[]);grp.get(k).push(i);}
  const G=[...grp.values()].filter(x=>x.length>1),mixer=new T.AnimationMixer(g.scene),v=new T.Vector3(),w=new T.Vector3();
  for(const name of ['walk','attack1','skill4']){const c=g.animations.find(a=>a.name===name);let worst=0;
   for(let f=0;f<=6;f++){mixer.stopAllAction();const a=mixer.clipAction(c);a.play();a.paused=true;a.time=Math.min(c.duration-1e-4,c.duration*f/6);mixer.update(0);g.scene.updateMatrixWorld(true);
    for(const gr of G){m.getVertexPosition(gr[0],v);for(let k=1;k<gr.length;k++){m.getVertexPosition(gr[k],w);worst=Math.max(worst,v.distanceTo(w));}}}
   assert.ok(worst<0.001,`${ch}/${name}: 이음새 ${(worst*1000).toFixed(1)} mm 벌어짐`);}
 });
}
