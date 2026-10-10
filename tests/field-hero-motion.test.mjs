import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {pathToFileURL} from 'node:url';import path from 'node:path';
import * as T from '../vendor/three/three.module.js';import {GLTFLoader} from '../vendor/three/GLTFLoader.js';import {Animated} from '../js/party-avatar.js';import {fieldHeroAction} from '../js/mmo/hero-motion.js';import {makeAinRigAdapter} from '../js/ain-two-hand.js';import {repairAinBind,repairAinClips} from '../js/ain-bind-repair.js';
globalThis.window=globalThis;vm.runInThisContext(fs.readFileSync('js/looks.js','utf8'));vm.runInThisContext(fs.readFileSync('js/dungeons.js','utf8'));
async function load(file){const b=fs.readFileSync(file),l=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])l.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
test('field: all four skills, attacks and counters reach the rig, using current clip time',()=>{
 for(const ch of ['ain','kain','ryu','sera'])for(const name of ['attack1','attack2','attack3','smash','skill1','skill2','skill3','skill4','ult','counter','exec']){
  const c={name,duration:2},a=fieldHeroAction(ch,c,.7,'test');assert.equal(a.clip,name);assert.equal(a.elapsed,.7);assert.equal(a.duration,2);assert.equal(a.id,'test');assert.ok(a.hitAt>0&&a.hitAt<2);
 }
 for(const name of ['idle','run','walk','roll','dodgeB','death','hit','cheer'])assert.equal(fieldHeroAction('ain',{name,duration:1},.2,1),null);
 const check=a=>assert.equal(a?.clip,'skill3','skill silently fell back to carry');assert.throws(()=>check(null),/skill silently/);check(fieldHeroAction('ain',{name:'skill3',duration:2},.7,1));
 const src=fs.readFileSync('world3d.html','utf8');assert.doesNotMatch(src,/busyClip === 'attack1'/);assert.match(src,/fieldHeroAction\(ME, hero\.current\.getClip\(\), hero\.current\.time/);assert.match(src,/fieldHeroAction\(r\.character/);
 assert.doesNotMatch(src,/busy = hero\.clips\[clip\]\.duration \* 0\.(75|8)\b/,'do not truncate authored skill recovery');
 assert.match(fs.readFileSync('sw.js','utf8'),/ASSETS\.push\('js\/mmo\/hero-motion\.js'/);
});
test('actual full/mobile Animated meshes: held weapon stays on palm throughout skills and release motions',async t=>{
 for(const ch of ['ain','kain','ryu','sera'])for(const lod of [false,true]){
  const base='art/3d/'+(lod?'lod/':''),weapon=ch==='ain'?'art/3d/ain_scythe_tex.glb':base+({kain:'gear/w_kain_greatsword.glb',ryu:'gear/w_ash_dirk.glb',sera:'gear/w_sera_flask.glb'}[ch]);
  const scene=new T.Scene(),h=new Animated(await load(base+ch+'_anim.glb'),scene,true,false,await load(weapon),ch),b={};h.model.traverse(o=>{if(o.isBone)b[o.name.replace(/^mixamorig:?/,'')]=o;});let worst=0,frames=0;
  for(const name of ['idle','attack1','attack2','attack3','smash','skill1','skill2','skill3','skill4','ult','counter','run','roll','hit','death']){
   h.play(name,name);h.current.paused=true;const c=h.current.getClip();
   for(let i=0;i<=60;i++){const time=c.duration*i/60;h.armBlend?.restore();h.rig.restore();h.current.time=time;h.mixer.update(1/60);h.rig.apply(fieldHeroAction(ch,c,time,name),name==='run',false,1/60,name);h.armBlend?.apply(1/60);h.root.updateMatrixWorld(true);
    const palm=(b.RightHand.userData.gripPoint?.clone()||b.RightHandSlot.position.clone()).applyMatrix4(b.RightHand.matrixWorld),gap=palm.distanceTo(h.weapon.getWorldPosition(new T.Vector3()));worst=Math.max(worst,gap);assert.ok(gap<.001,`${ch} ${lod} ${name}@${i}: dominant hand lost weapon ${gap}`);
    for(const n of ['RightArm','RightForeArm','RightHand','LeftArm','LeftForeArm','LeftHand'])assert.ok(b[n].matrixWorld.elements.every(Number.isFinite));frames++;
   }
  }t.diagnostic(`${ch} ${lod?'mobile':'full'}: ${frames} sampled frames, right palm gap ${worst}m`);h.dispose(scene);
 }
});
test('Ain elbow is outside ribs, not the numerically valid inward branch (negative control)',async()=>{
 let code=fs.readFileSync('js/ain-two-hand.js','utf8').replace(/from '(\.[^']+)'/g,(_,p)=>`from '${pathToFileURL(path.resolve('js',p)).href}'`);
 code=code.replace('scale,a.length,1);',"scale,a.length,side==='Left'?1:-1);");
 const bad=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).makeAinRigAdapter;
 async function elbow(factory){const g=await load('art/3d/ain_anim.glb'),root=new T.Group();g.scene.scale.setScalar(1.14);root.add(g.scene);const repair=repairAinBind(g.scene),clips=repairAinClips(g.animations,repair);let slot;g.scene.traverse(o=>{if(/RightHandSlot$/.test(o.name))slot=o;});const rig=factory(g.scene,root,slot),mixer=new T.AnimationMixer(g.scene);mixer.clipAction(clips.find(c=>c.name==='idle')).play();mixer.update(0);rig.apply(null,false,false,0,'idle');root.updateMatrixWorld(true);return rig.bones.RightForeArm.getWorldPosition(new T.Vector3());}
 const check=v=>assert.ok(v.x<-.16,'right elbow is crossing into ribs');check(await elbow(makeAinRigAdapter));const badElbow=await elbow(bad);assert.throws(()=>check(badElbow),/right elbow is crossing/);
});

test('Ain sleeve repair fades across adjacent mesh vertices (hard-cut negative control)',async t=>{
 let code=fs.readFileSync('js/ain-bind-repair.js','utf8').replace(/from '(\.[^']+)'/g,(_,p)=>`from '${pathToFileURL(path.resolve('js',p)).href}'`);
 code=code.replace('Math.abs(v.x)<.12','Math.abs(v.x)<.19').replace('1-T.MathUtils.smoothstep(Math.min(...d),.035,.075)','1');
 const bad=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).repairAinBind;
 async function seam(factory){const g=await load('art/3d/ain_anim.glb'),report=factory(g.scene),clips=repairAinClips(g.animations,report);let mesh,slot;g.scene.traverse(o=>{if(o.isSkinnedMesh&&o.geometry.attributes.position.count>31068)mesh=o;if(/RightHandSlot$/.test(o.name))slot=o;});
  const rig=makeAinRigAdapter(g.scene,g.scene,slot),mixer=new T.AnimationMixer(g.scene),a=mixer.clipAction(clips.find(c=>c.name==='idle'));a.play();mixer.update(0);rig.apply(null,false,false,0,'idle');g.scene.updateMatrixWorld(true);mesh.skeleton.update();return mesh.getVertexPosition(31068,new T.Vector3()).distanceTo(mesh.getVertexPosition(31063,new T.Vector3()));}
 const good=await seam(repairAinBind),broken=await seam(bad),check=d=>assert.ok(d<.015,'3 mm sleeve edge stretched into a visible slit');check(good);assert.throws(()=>check(broken),/visible slit/);t.diagnostic(`measured sleeve edge: fade ${(good*1000).toFixed(2)}mm, former hard boundary ${(broken*1000).toFixed(2)}mm`);
});
