// Offline pose search; never modifies assets or production source.
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {repairAinBind,repairAinClips} from '../js/ain-bind-repair.js';
import {makeAinRigAdapter,AIN_RAISED_CONTACT} from '../js/ain-two-hand.js';
import {mountAinScythe,measureAinBladeContact} from '../js/ain-scythe-mount.js';
async function load(name){const b=await readFile('art/3d/'+name+'.glb'),l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const g=await load('ain_anim'),w=await load('ain_scythe_tex'),root=new T.Group();root.add(g.scene);g.scene.scale.setScalar(1.14);
const repair=repairAinBind(g.scene),clips=repairAinClips(g.animations,repair);let slot;g.scene.traverse(o=>{if(o.name.endsWith('RightHandSlot'))slot=o;});
const weapon=new T.Group();weapon.add(mountAinScythe(w.scene));slot.add(weapon);weapon.scale.setScalar(1/slot.getWorldScale(new T.Vector3()).x);
const name=process.argv[2]||'smash';
const rig=makeAinRigAdapter(g.scene,root,slot),mixer=new T.AnimationMixer(g.scene),clip=clips.find(c=>c.name===name),act=mixer.clipAction(clip);act.play();act.paused=true;act.time=clip.duration*({smash:.78,counter:.48,exec:.58}[name]);
const results=[];
const check=await load('ain_anim'),checkRoot=new T.Group();checkRoot.add(check.scene);
const checkClips=repairAinClips(check.animations,repairAinBind(check.scene));let checkSlot;check.scene.traverse(o=>{if(o.name.endsWith('RightHandSlot'))checkSlot=o;});
const checkRig=makeAinRigAdapter(check.scene,checkRoot,checkSlot),checkMixer=new T.AnimationMixer(check.scene),checkClip=checkClips.find(c=>c.name===name),checkAct=checkMixer.clipAction(checkClip);checkAct.play();checkAct.paused=true;
for(const y of [-.05,.1,.25])for(const dx of [-.5,-.35,-.2])for(const dz of [-.3,-.15,0,.15]){
 const pose=[.25,y,.25,dx,.9,dz];AIN_RAISED_CONTACT[name]=pose;let max=0;
 for(const coords of [[0,2.4,.5],[.09,2.36,.45],[.11,2.58,.58]]){
  rig.restore();mixer.update(0);const target=new T.Vector3(...coords);rig.apply({id:name,clip:name,elapsed:.5,hitAt:.5,duration:1.2},false,false,0,name,target);
  max=Math.max(max,measureAinBladeContact(weapon,target).distance);
 }
 let step=0,previous={};
 for(let i=0;i<=240;i++){
  checkRig.restore();checkAct.time=checkClip.duration*i/240;checkMixer.update(0);
  checkRig.apply({id:name,clip:name,elapsed:checkAct.time,hitAt:checkClip.duration*.42,duration:checkClip.duration},false,false,checkClip.duration/240,name,new T.Vector3(.11+.05*Math.sin(i/30),2.58+.04*Math.sin(i/24),.58+.08*Math.cos(i/30)));
  for(const n of ['LeftArm','LeftForeArm','RightArm','RightForeArm','LeftHand','RightHand']){const q=checkRig.bones[n].quaternion;if(previous[n])step=Math.max(step,previous[n].angleTo(q));previous[n]=q.clone();}
 }
 results.push({pose,max,step:T.MathUtils.radToDeg(step)});
}
console.log(JSON.stringify(results.filter(r=>r.step<8).sort((a,b)=>a.max-b.max).slice(0,8),null,2));
