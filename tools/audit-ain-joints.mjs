import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {makeAinRigAdapter} from '../js/ain-two-hand.js';
import {repairAinBind,repairAinClips} from '../js/ain-bind-repair.js';
import {makeRigAdapter as baselineRig} from '../js/combat-motion.js';
import {makePoseStudy,refineStudyGrip} from '../js/ain-pose-study.js';
const bytes=await readFile('art/3d/ain_anim.glb');
for(const name of ['ain_six_pose_study','idle','run','guard','attack1','attack2','attack3','smash','ult']){
 for(const mode of ['baseline','corrected']){
  const loader=new GLTFLoader();loader.register(()=>({name:'no-raster',loadTexture:()=>Promise.resolve(new T.Texture())}));
  const g=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  if(mode==='corrected')g.animations=repairAinClips(g.animations,repairAinBind(g.scene));
  const clip=name==='ain_six_pose_study'?makePoseStudy(g.animations.find(c=>c.name==='attack1'),{smooth:mode==='corrected'}):g.animations.find(c=>c.name===name);
  let slot;g.scene.traverse(o=>{if(o.name.endsWith('RightHandSlot'))slot=o;});
  const rig=(mode==='baseline'?baselineRig:makeAinRigAdapter)(g.scene,g.scene,slot),mixer=new T.AnimationMixer(g.scene);
  const act=mixer.clipAction(clip);act.setLoop(T.LoopOnce,1).play();act.paused=true;
  const prev={},maxStep={};let grip=0;
  for(let i=0;i<=240;i++){
   const time=clip.duration*i/240;rig.restore();act.time=time;mixer.update(0);
   const a=/attack|study|smash|ult/.test(name)?{id:name,clip:name,kind:'attack',duration:clip.duration,elapsed:time,hitAt:clip.duration*.42}:null;
   rig.apply(a,name==='run',name==='guard',clip.duration/240,name);
   if(mode==='baseline'&&name==='ain_six_pose_study')refineStudyGrip(rig,slot);
   grip=Math.max(grip,rig.diagnostics.gripError);
   for(const n of ['LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand']){
    const q=rig.bones[n].quaternion.clone().normalize();
    if(prev[n])maxStep[n]=Math.max(maxStep[n]||0,T.MathUtils.radToDeg(q.angleTo(prev[n])));
    prev[n]=q;
   }
  }
  console.log(JSON.stringify({clip:name,mode,metric:mode==='baseline'?'left wrist target':'left palm socket target',maxGripMetres:grip,maxStepDegrees:maxStep}));
 }
}
