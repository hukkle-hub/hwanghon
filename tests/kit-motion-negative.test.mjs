import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import * as production from '../js/mmo/kit-motion.js';

function sample(api) {
  const root=new T.Group(),model=new T.Group(),bone=new T.Bone(),scene=new T.Scene();
  bone.name='Probe';model.add(bone);root.add(model);scene.add(root);
  const clips=[new T.AnimationClip('idle',1,[]),new T.AnimationClip('down',1,[new T.VectorKeyframeTrack('Probe.position',[0,1],[0,0,0,2,0,0])])];
  const o={b:{id:'probe'},root,model};api.setupKitMotion(o,{animations:clips},model,scene,{skills:{}});
  api.applyKitAction(o,{motion:'down',seq:1,startedAt:1000,x:0,z:0,yaw:0},1500);
  api.prepareKitMotion(o,1500);o.mixer.update(.2);return bone.position.x;
}
test('negative controls reject missing reaction dispatch and frozen reaction clock',async()=>{
  assert.equal(sample(production),1);
  const url=new URL('../js/mmo/kit-motion.js',import.meta.url);
  const source=fs.readFileSync(url,'utf8').replace(/from\s+(['"])(\.\.?\/[^'"]+)\1/g,(_,quote,path)=>`from ${quote}${new URL(path,url).href}${quote}`);
  const mutations=[source.replaceAll('REACTIONS.has(a.motion)','false'),source.replace('Math.max(0, now - a.startedAt) / 1000','0')];
  for(const mutated of mutations){
    assert.notEqual(mutated,source,'negative control must really change the implementation');
    const broken=await import('data:text/javascript;base64,'+Buffer.from(mutated).toString('base64'));
    assert.throws(()=>assert.equal(sample(broken),1));
  }
});
