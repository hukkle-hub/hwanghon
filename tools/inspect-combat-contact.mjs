import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {repairAinBind,repairAinClips} from '../js/ain-bind-repair.js';
import {makeAinRigAdapter} from '../js/ain-two-hand.js';
import {mountAinScythe,measureAinBladeContact} from '../js/ain-scythe-mount.js';
import {sampleAction} from '../js/combat-motion.js';
import C from '../server/content.cjs';
async function load(name){const b=await readFile('art/3d/'+name+'.glb'),l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const g=await load('ain_anim'),w=await load('ain_scythe_tex'),root=new T.Group();root.add(g.scene);g.scene.scale.setScalar(1.14);
const repair=repairAinBind(g.scene),clips=repairAinClips(g.animations,repair);let slot;g.scene.traverse(o=>{if(o.name.endsWith('RightHandSlot'))slot=o;});
const weapon=new T.Group();weapon.add(mountAinScythe(w.scene));slot.add(weapon);weapon.scale.setScalar(1/slot.getWorldScale(new T.Vector3()).x);
const rig=makeAinRigAdapter(g.scene,root,slot),mixer=new T.AnimationMixer(g.scene);
for(const clip of ['attack1','attack2','attack3','smash','skill1','skill3','ult','counter','exec']){
 const profile=C.rules.motion.characterProfiles.ain[clip]||C.rules.motion[clip==='counter'?'counter':clip==='exec'?'exec':clip==='ult'?'ult':clip==='smash'?'smash':'light'];
 const a={id:clip,clip,hitAt:profile.hit,elapsed:profile.hit,duration:profile.duration,clipHit:C.rules.motion.clipContacts[clip]};
 const target=process.argv.includes('--target')?new T.Vector3(.0,2.4,.5):null;
 rig.restore();mixer.stopAllAction();const c=clips.find(c=>c.name===clip),act=mixer.clipAction(c);act.play();act.paused=true;act.time=sampleAction(a,c.duration);mixer.update(0);rig.apply(a,false,false,0,clip,target);
 if(target)console.log('contact',clip,measureAinBladeContact(weapon,target).distance.toFixed(4));
 console.log(clip,JSON.stringify(['AinBladeRoot','AinBladeTip'].map(n=>weapon.getObjectByName(n).getWorldPosition(new T.Vector3()).toArray().map(v=>+v.toFixed(3)))));
}
const boss=await load('boss_anim');boss.scene.scale.setScalar(1.22);boss.scene.updateMatrixWorld(true);const bones={};boss.scene.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
for(const [id,p]of Object.entries(C.arenas.tutorial.parts3d))console.log(id,bones[p.bone].getWorldPosition(new T.Vector3()).add(new T.Vector3(...p.off).multiplyScalar(1.22)).toArray());
