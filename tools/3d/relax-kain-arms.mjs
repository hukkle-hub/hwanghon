// Offline-only elbow authoring. Combat clocks stay fixed; the rigid blade and
// both hands move together when a healthier shoulder reach needs clearance.
// Never rewrite the character or wardrobe GLB. Runtime continues using baked poses.
// Regenerate base with build-kain-melee-reviewed.mjs before running this tool;
// argv[4] optionally names an archived base module for an exact replay.
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {Animated} from '../../js/party-avatar.js';
import {fieldHeroAction} from '../../js/mmo/hero-motion.js';
import {HERO_MELEE_DATA} from '../../js/hero-melee-data.js';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
globalThis.window=globalThis;
for(const f of ['looks','dungeons'])vm.runInThisContext(fs.readFileSync('js/'+f+'.js','utf8'));
const load=async f=>{const raw=fs.readFileSync(f),l=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])l.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');};
const asset=await load('art/3d/kain_anim.glb'),weapon=await load('art/3d/gear/w_kain_greatsword.glb'),out={},report={};
const input=process.argv[4]?(await import(pathToFileURL(resolve(process.argv[4])).href)).HERO_MELEE_DATA:HERO_MELEE_DATA;
if(Object.values(input.kain).some(c=>c.naturalElbows))throw Error('Already authored. Regenerate the base with build-kain-melee-reviewed.mjs first; do not repeatedly relax the output.');
const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
HERO_MELEE_DATA.kain=input.kain;
for(const[name,src]of Object.entries(input.kain)){
 if(name==='counter'||name==='smash')continue;
 const scene=new T.Scene(),h=new Animated(asset,scene,true,false,weapon,'kain'),b={};h.model.traverse(o=>{if(o.isBone)b[o.name.replace(/^mixamorig:?/,'')]=o;});
 const shoulderRest=Object.fromEntries(['Left','Right'].map(s=>[s,b[s+'Shoulder'].quaternion.clone()]));
 h.play('idle');for(let i=0;i<120;i++){h.rig.restore();h.mixer.update(1/60);h.rig.apply(null,false,false,1/60,'idle');}
 h.play(name,name);h.current.paused=true;const data=h.model.userData.heroSkillMotion[name];data.weaponBaked=false;data.explicitWeaponPath=true;data.naturalArms=true;
 const c={...src,naturalElbows:true,tracks:Object.fromEntries(Object.keys(src.tracks).map(n=>[n,[]])),weaponPositions:[],weaponRotations:[]},r={wrist:0,grip:0,elbowLift:0};
 for(let i=0;i<src.times.length;i++){
  const time=src.times[i],dt=i?time-src.times[i-1]:1/120;
  h.rig.restore();h.current.time=time;h.mixer.update(dt);
  h.model.updateMatrixWorld(true);
  for(const side of ['Left','Right']){
   const shoulder=b[side+'Arm'].getWorldPosition(V()),hand=b[side+'Hand'].getWorldPosition(V()),below=1-T.MathUtils.smootherstep(hand.y-shoulder.y,-.12,.15);
   b[side+'Shoulder'].quaternion.slerp(shoulderRest[side],.65*below);
  }
  h.rig.apply(fieldHeroAction('kain',h.current.getClip(),time,name),false,false,dt,name);h.root.updateMatrixWorld(true);
  for(const[n,a]of Object.entries(c.tracks))b[n].quaternion.toArray(a,a.length);
  const q=h.weapon.getWorldQuaternion(Q()),p=h.weapon.getWorldPosition(V()).addScaledVector(V().set(0,1,0).applyQuaternion(q),-.085);h.model.worldToLocal(p).toArray(c.weaponPositions,c.weaponPositions.length);h.model.getWorldQuaternion(Q()).invert().multiply(q).normalize().toArray(c.weaponRotations,c.weaponRotations.length);
  r.wrist=Math.max(r.wrist,h.rig.diagnostics.RightWristBend,h.rig.diagnostics.LeftWristBend);r.grip=Math.max(r.grip,h.rig.diagnostics.gripError,h.rig.diagnostics.rightGripError);
  for(const side of ['Left','Right'])r.elbowLift=Math.max(r.elbowLift,b[side+'ForeArm'].getWorldPosition(V()).y-b[side+'Arm'].getWorldPosition(V()).y);
 }
 for(const a of [...Object.values(c.tracks),c.weaponPositions,c.weaponRotations])for(let i=0;i<a.length;i++)a[i]=+a[i].toFixed(7);
 out[name]=c;report[name]=r;h.dispose(scene);console.log(name,r);
}
// A compact brace/riposte uses the lowered-elbow cleave rather than the old
// underhand ultimate lift that forced the shoulder above the face. Keep both
// existing counter clocks exactly: prepare time -> contact -> recovery.
for(const name of ['counter','smash']){
 const src=out.attack1,old=input.kain[name],c={...structuredClone(src),source:name==='counter'?'authored-greatsword-brace-riposte':'authored-greatsword-heavy-cleave',sourceLabel:name==='counter'?'Lowered-elbow brace and cleave riposte':'Lowered-elbow heavy cleave',duration:old.duration,contactPhase:old.contactPhase,times:src.times.map(t=>t<=src.duration*src.contactPhase?t/(src.duration*src.contactPhase)*(old.duration*old.contactPhase):old.duration*old.contactPhase+(t-src.duration*src.contactPhase)/(src.duration*(1-src.contactPhase))*(old.duration*(1-old.contactPhase)))};c.times[c.times.length-1]=old.duration;
 out[name]=c;
}
// Offline low-pass only. Runtime never filters a hand independently of the
// weapon; the baked two-hand solver restores exact palm contact after sampling.
for(const c of Object.values(out)){
 // Complete the relaxed arm roll before returning to the neutral grip. The
 // unmodified body source returned to ready, but the solved arms previously did
 // not: that caused a visible snap when a new action/idle followed the take.
 for(let i=0;i<c.times.length;i++){
  const w=T.MathUtils.smootherstep(c.times[i],c.duration-.55,c.duration);if(!w)continue;
  for(const a of Object.values(c.tracks))Q().fromArray(a,i*4).slerp(Q().fromArray(a,0),w).normalize().toArray(a,i*4);
  for(const a of [c.hips,c.weaponPositions])V().fromArray(a,i*3).lerp(V().fromArray(a,0),w).toArray(a,i*3);
  // Retract around the chest, not through it. The rigid blade and both palms
  // follow this same outward arc; it vanishes at both ends of the recovery.
  c.weaponPositions[i*3+2]+=.10*Math.sin(Math.PI*w)**2;
  Q().fromArray(c.weaponRotations,i*4).slerp(Q().fromArray(c.weaponRotations,0),w).normalize().toArray(c.weaponRotations,i*4);
 }
}
// Quaternion interpolation alone can retract the forearm through the chest.
// Re-solve the recovery against the coupled sword arc on the actual rig, with
// continuity from the last valid attack pose. Do not force an arbitrary elbow
// roll at the endpoint: the runtime carry solver continues from this pose.
HERO_MELEE_DATA.kain=out;
for(const[name,c]of Object.entries(out)){
 const scene=new T.Scene(),h=new Animated(asset,scene,true,false,weapon,'kain'),b={};h.model.traverse(o=>{if(o.isBone)b[o.name.replace(/^mixamorig:?/,'')]=o;});h.play(name,name);h.current.paused=true;const data=h.model.userData.heroSkillMotion[name];data.explicitWeaponPath=true;data.naturalArms=true;data.naturalArmWeight=2;
 for(let i=0;i<c.times.length;i++){
  const t=c.times[i],recovery=t>c.duration-.55;data.weaponBaked=!recovery;
  h.rig.restore();h.current.time=t;h.mixer.update(i?t-c.times[i-1]:1/120);h.rig.apply(fieldHeroAction('kain',h.current.getClip(),t,name),false,false,i?t-c.times[i-1]:1/120,name);h.root.updateMatrixWorld(true);
  if(!recovery)continue;
  for(const[n,a]of Object.entries(c.tracks))b[n].quaternion.toArray(a,i*4);
  const q=h.weapon.getWorldQuaternion(Q()),p=h.weapon.getWorldPosition(V()).addScaledVector(V().set(0,1,0).applyQuaternion(q),-.085);h.model.worldToLocal(p).toArray(c.weaponPositions,i*3);h.model.getWorldQuaternion(Q()).invert().multiply(q).normalize().toArray(c.weaponRotations,i*4);
 }
 h.dispose(scene);
 const arrays=[...Object.entries(c.tracks).filter(([n])=>/(Shoulder|Arm|ForeArm|Hand)$/.test(n)).map(([,a])=>[a,4]),[c.weaponPositions,3],[c.weaponRotations,4]];
 for(let pass=0;pass<12;pass++)for(const[a,stride]of arrays){const old=a.slice();for(let i=1;i<c.times.length-1;i++){
  if(stride===4){const q=Q().fromArray(old,i*4),left=Q().fromArray(old,(i-1)*4),right=Q().fromArray(old,(i+1)*4);left.slerp(right,.5);q.slerp(left,.5).normalize().toArray(a,i*4);}
  else for(let k=0;k<3;k++)a[i*3+k]=.5*old[i*3+k]+.25*(old[(i-1)*3+k]+old[(i+1)*3+k]);
 }}
}
fs.writeFileSync(process.argv[2]||'js/hero-melee-data.js','// Offline-authored natural two-hand elbow poses and coupled blade tracks; original combat clocks retained.\nexport const HERO_MELEE_DATA='+JSON.stringify({kain:out})+';\n');
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
