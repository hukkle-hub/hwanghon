import fs from 'node:fs';import vm from 'node:vm';
import {GRIP_DIAG} from '../../js/ain-grip-ik.js';
import * as T from '../../vendor/three/three.module.js';import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';import {Animated} from '../../js/party-avatar.js';import {fieldHeroAction} from '../../js/mmo/hero-motion.js';
globalThis.window=globalThis;vm.runInThisContext(fs.readFileSync('js/looks.js','utf8'));vm.runInThisContext(fs.readFileSync('js/dungeons.js','utf8'));
const load=async f=>{const b=fs.readFileSync(f),l=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])l.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const scene=new T.Scene(),h=new Animated(await load('art/3d/kain_anim.glb'),scene,true,false,await load('art/3d/gear/w_kain_greatsword.glb'),'kain'),b={};h.model.traverse(o=>{if(o.isBone)b[o.name.replace(/^mixamorig:?/,'')]=o;});const report={};
for(const name of ['skill1','skill2','skill3','skill4','ult']){
 GRIP_DIAG.reset();
 h.play(name,name);h.current.paused=true;const c=h.current.getClip(),N=240,contacts=[],prev={},tipPositions=[];let gap=0,resid=0,step=0,floor=100,bend=0,peakJoint='',peakBend='';
 const frames=[];let peakIndex=0,torsoClearance=Infinity,torsoPeak='',torsoFrame=null;
 for(let i=0;i<=N;i++){
  const time=c.duration*i/N;h.rig.restore();h.current.time=time;h.mixer.update(c.duration/N);h.rig.apply(fieldHeroAction('kain',c,time,name),false,false,c.duration/N,name);h.root.updateMatrixWorld(true);
  gap=Math.max(gap,h.rig.diagnostics.gripError,h.rig.diagnostics.rightGripError);resid=Math.max(resid,h.rig.diagnostics.LeftResidual,h.rig.diagnostics.RightResidual);for(const s of ['Left','Right'])if(h.rig.diagnostics[s+'WristBend']>bend){bend=h.rig.diagnostics[s+'WristBend'];peakBend=s+'@'+(i/N).toFixed(3);}
  const target=new T.Vector3(0,1.65,1.4),origin=h.weapon.getWorldPosition(new T.Vector3()),axis=new T.Vector3(0,1,0).transformDirection(h.weapon.matrixWorld);let distance=100,tip=null;
  h.weapon.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let k=0;k<p.count;k++){const v=new T.Vector3().fromBufferAttribute(p,k).applyMatrix4(o.matrixWorld);floor=Math.min(floor,v.y);if(!tip||v.z>tip.z)tip=v.clone();const handle=v.clone().sub(origin).dot(axis);if(handle>.30)distance=Math.min(distance,v.distanceTo(target));}});
  contacts.push({phase:i/N,distance,tip:tip?.toArray()});tipPositions.push(tip);
  const base=b.Hips.getWorldPosition(new T.Vector3()),top=b.Spine2.getWorldPosition(new T.Vector3()),bodyAxis=top.clone().sub(base);
  for(const side of ['Right','Left']){const elbow=b[side+'ForeArm'].getWorldPosition(new T.Vector3()),wrist=b[side+'Hand'].getWorldPosition(new T.Vector3());for(let j=0;j<=8;j++){const p=elbow.clone().lerp(wrist,j/8),near=base.clone().addScaledVector(bodyAxis,T.MathUtils.clamp(p.clone().sub(base).dot(bodyAxis)/bodyAxis.lengthSq(),0,1)),d=p.distanceTo(near);if(d<torsoClearance){torsoClearance=d;torsoPeak=side+'@'+(i/N).toFixed(3);torsoFrame={base:base.toArray(),top:top.toArray(),p:p.toArray(),elbow:elbow.toArray(),wrist:wrist.toArray(),center:origin.toArray(),axis:axis.toArray()};}}}
  frames.push({phase:i/N,axis:axis.toArray(),center:origin.toArray(),right:b.RightArm.getWorldPosition(new T.Vector3()).toArray(),elbow:b.RightForeArm.getWorldPosition(new T.Vector3()).toArray(),wrist:b.RightHand.getWorldPosition(new T.Vector3()).toArray(),q:b.RightArm.quaternion.toArray()});
  for(const n of ['RightArm','RightForeArm','LeftArm','LeftForeArm']){const q=b[n].quaternion;if(prev[n]&&prev[n].angleTo(q)>step){step=prev[n].angleTo(q);peakJoint=n+'@'+(i/N).toFixed(3);peakIndex=i;}prev[n]=q.clone();}
 }
 const hits=[];for(const [lo,hi]of [[.18,.38],[.38,.60],[.60,.86]])hits.push(contacts.filter(p=>p.phase>=lo&&p.phase<=hi).sort((a,b)=>a.distance-b.distance)[0]);
 report[name]={duration:c.duration,gap,resid,floor,torsoClearance,torsoPeak,...(process.argv.includes('--detail')?{torsoFrame}:{}),circle:{...GRIP_DIAG,reset:undefined},bendDegrees:T.MathUtils.radToDeg(bend),peakBend,maxStepDegrees:T.MathUtils.radToDeg(step),peakJoint,hits,...(process.argv.includes('--detail')?{peakFrames:frames.slice(Math.max(0,peakIndex-2),peakIndex+2)}:{})};
}
 console.log(JSON.stringify({reach:h.rig.diagnostics.reach,...report},null,2));h.dispose(scene);
