import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {KEYS,makePoseStudy,refineStudyGrip} from '../js/ain-pose-study.js';
import {makeRigAdapter} from '../js/combat-motion.js';
test('six pose study preserves source, closes loop and samples finite transforms',async t=>{
 const bytes=await readFile('art/3d/ain_anim.glb'),loader=new GLTFLoader();loader.register(()=>({name:'test-no-raster',loadTexture:()=>Promise.resolve(new T.Texture())}));
 const g=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const source=g.animations.find(c=>c.name==='attack1'),before=JSON.stringify(source.toJSON()),clip=makePoseStudy(source);
 assert.equal(KEYS.length,6);assert.equal(clip.duration,1.4);assert.equal(JSON.stringify(source.toJSON()),before);
 for(const tr of clip.tracks){const n=tr.getValueSize();assert.equal(tr.times.length,6);for(let j=0;j<n;j++)assert.equal(tr.values[j],tr.values[5*n+j]);}
 let slot;g.scene.traverse(o=>{if(/RightHandSlot$/.test(o.name))slot=o;});assert.ok(slot);
 const rig=makeRigAdapter(g.scene,g.scene,slot),mixer=new T.AnimationMixer(g.scene),a=mixer.clipAction(clip);a.play();a.paused=true;let max=0;
 for(let i=0;i<=140;i++){const time=i/100;rig.restore();a.time=time;mixer.update(0);rig.apply({id:'study',kind:'attack',duration:1.4,elapsed:time},true,true,0);refineStudyGrip(rig,slot);max=Math.max(max,rig.diagnostics.gripError);g.scene.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));});}
 t.diagnostic(`maximum left-hand bone target error: ${(max*100).toFixed(2)} cm; not finger contact QA`);assert.ok(max<.05);
});
