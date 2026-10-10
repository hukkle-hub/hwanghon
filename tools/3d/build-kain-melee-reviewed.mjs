// Assemble the already visually reviewed two-hand greatsword takes. Keep all
// body + weapon tracks on one clock; never retarget a one-hand counter blindly.
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import {HERO_SKILL_DATA} from '../../js/hero-skill-data.js';
import vm from 'node:vm';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {Animated} from '../../js/party-avatar.js';
import {HERO_MELEE_DATA} from '../../js/hero-melee-data.js';
import {fieldHeroAction} from '../../js/mmo/hero-motion.js';
const sources=HERO_SKILL_DATA.kain,round=x=>+x.toFixed(7),V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
const evaluators=Object.fromEntries(Object.entries(sources).map(([name,c])=>[name,{tracks:Object.fromEntries(Object.entries(c.tracks).map(([b,a])=>[b,new T.QuaternionKeyframeTrack(b,c.times,a).createInterpolant()])),hips:new T.VectorKeyframeTrack('hips',c.times,c.hips).createInterpolant(),position:new T.VectorKeyframeTrack('weapon',c.times,c.weaponPositions).createInterpolant(),rotation:new T.QuaternionKeyframeTrack('weapon',c.times,c.weaponRotations).createInterpolant()}]));
function pose(name,phase){const e=evaluators[name],t=sources[name].duration*phase;return{tracks:Object.fromEntries(Object.entries(e.tracks).map(([b,it])=>[b,Q().fromArray(it.evaluate(t)).normalize()])),hips:V().fromArray(e.hips.evaluate(t)),position:V().fromArray(e.position.evaluate(t)),rotation:Q().fromArray(e.rotation.evaluate(t)).normalize()};}
function mix(a,b,u){const w=T.MathUtils.smootherstep(u,0,1);return{tracks:Object.fromEntries(Object.keys(a.tracks).map(n=>[n,a.tracks[n].clone().slerp(b.tracks[n],w).normalize()])),hips:a.hips.clone().lerp(b.hips,w),position:a.position.clone().lerp(b.position,w),rotation:a.rotation.clone().slerp(b.rotation,w).normalize()};}
const ready=pose('skill1',0),out={},timing={};
function make(name,build){
 const pieces=[];let duration=0,last=ready,hit=0;
 const segment=(source,from,to,pace=1,contact=null)=>{const dt=(to-from)*sources[source].duration*pace,start=duration;pieces.push({start,dt,at:u=>pose(source,from+(to-from)*u)});if(contact!=null)hit=start+(contact-from)*sources[source].duration*pace;duration+=dt;last=pose(source,to);};
 const bridge=(next,dt,clearance=0)=>{const a=last;pieces.push({start:duration,dt,bridge:true,at:u=>{const p=mix(a,next,u);p.position.z+=clearance*Math.sin(Math.PI*u)**2;return p;}});duration+=dt;last=next;};
 build({segment,bridge});
 const N=Math.ceil(duration*120),c={source:'reviewed-greatsword-montage:'+name,sourceLabel:'Reviewed full-body greatsword montage · '+name,correctedMelee:true,weaponBaked:true,duration,entry:0,exit:0,contactPhase:hit/duration,times:[],tracks:Object.fromEntries(Object.keys(ready.tracks).map(n=>[n,[]])),hips:[],weaponPositions:[],weaponRotations:[]};
 for(let i=0;i<=N;i++){const time=duration*i/N,piece=pieces.find(p=>time<=p.start+p.dt+1e-8)||pieces.at(-1),p=piece.at(T.MathUtils.clamp((time-piece.start)/piece.dt,0,1));c.times.push(time);for(const[n,a]of Object.entries(c.tracks))p.tracks[n].toArray(a,a.length);p.hips.toArray(c.hips,c.hips.length);p.position.toArray(c.weaponPositions,c.weaponPositions.length);p.rotation.toArray(c.weaponRotations,c.weaponRotations.length);}
 for(const a of [...Object.values(c.tracks),c.hips,c.weaponPositions,c.weaponRotations])for(let i=0;i<a.length;i++)a[i]=round(a[i]);
 c.bridgeSpans=pieces.filter(p=>p.bridge).map(p=>[p.start,p.start+p.dt]);out[name]=c;timing[name]={duration,hit,contact:c.contactPhase,cancel:Math.max(hit+.3,duration*.75)};console.log(name,JSON.stringify(timing[name]));
}
make('attack1',({segment,bridge})=>{segment('skill1',0,.55,1.08,.421);bridge(ready,.7,.09);});
make('attack2',({segment,bridge})=>{segment('ult',0,.5,1,.337);bridge(ready,.65);});
make('attack3',({segment,bridge})=>{segment('skill3',0,.45,1,.229);bridge(ready,.65);});
make('smash',({segment,bridge})=>{segment('skill1',0,.55,1.2,.421);bridge(ready,.8,.09);});
make('counter',({segment,bridge})=>{bridge(pose('skill2',.26),.32);bridge(pose('skill2',.26),.08);bridge(pose('ult',.2),.45);segment('ult',.2,.45,1,.337);bridge(ready,.65);});
make('exec',({segment,bridge})=>{bridge(pose('ult',.5),.5);segment('ult',.5,1,1,.663);});
globalThis.window=globalThis;for(const f of ['looks','dungeons'])vm.runInThisContext(fs.readFileSync('js/'+f+'.js','utf8'));
const load=async f=>{const raw=fs.readFileSync(f),loader=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])loader.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return loader.parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');};
const asset=await load('art/3d/kain_anim.glb'),weapon=await load('art/3d/gear/w_kain_greatsword.glb');HERO_MELEE_DATA.kain=out;
for(const[name,src]of Object.entries(out)){
 if(name!=='attack3')continue;
 const scene=new T.Scene(),h=new Animated(asset,scene,true,false,weapon,'kain'),b={};h.model.traverse(o=>{if(o.isBone)b[o.name.replace(/^mixamorig:?/,'')]=o;});h.play('idle');for(let i=0;i<120;i++){h.rig.restore();h.mixer.update(1/60);h.rig.apply(null,false,false,1/60,'idle');}
 h.play(name,name);h.current.paused=true;const N=src.times.length-1,dt=src.duration/N,c={...src,tracks:Object.fromEntries(Object.keys(src.tracks).map(n=>[n,[]])),hips:[],weaponPositions:[],weaponRotations:[]},data=h.model.userData.heroSkillMotion[name];data.explicitWeaponPath=true;
 for(let i=0;i<=N;i++){
  const t=src.times[i];data.weaponBaked=!src.bridgeSpans.some(([a,z])=>t>=a&&t<=z);h.rig.restore();h.current.time=t;h.mixer.update(dt);h.rig.apply(fieldHeroAction('kain',h.current.getClip(),t,name),false,false,dt,name);h.root.updateMatrixWorld(true);
  for(const[n,a]of Object.entries(c.tracks))b[n].quaternion.toArray(a,a.length);b.Hips.position.toArray(c.hips,c.hips.length);const q=h.weapon.getWorldQuaternion(Q()),p=h.weapon.getWorldPosition(V()).addScaledVector(V().set(0,1,0).applyQuaternion(q),-.085);h.model.worldToLocal(p).toArray(c.weaponPositions,c.weaponPositions.length);h.model.getWorldQuaternion(Q()).invert().multiply(q).normalize().toArray(c.weaponRotations,c.weaponRotations.length);
 }
 const read=(obj,i)=>({tracks:Object.fromEntries(Object.entries(obj.tracks).map(([n,a])=>[n,Q().fromArray(a,i*4)])),hips:V().fromArray(obj.hips,i*3),position:V().fromArray(obj.weaponPositions,i*3),rotation:Q().fromArray(obj.weaponRotations,i*4)});
 const end=read(c,N),settle=.35;
 c.times=[...src.times];for(let i=1;i<=42;i++){const p=mix(end,ready,i/42);c.times.push(src.duration+i/42*settle);for(const[n,a]of Object.entries(c.tracks))p.tracks[n].toArray(a,a.length);p.hips.toArray(c.hips,c.hips.length);p.position.toArray(c.weaponPositions,c.weaponPositions.length);p.rotation.toArray(c.weaponRotations,c.weaponRotations.length);}
 const originalTimes=[...c.times],bridgeStart=src.bridgeSpans[0][0];for(let i=1;i<c.times.length;i++){const middle=(originalTimes[i]+originalTimes[i-1])*.5,pace=1+3*(1-T.MathUtils.smootherstep(Math.abs(middle-bridgeStart),.08,.25));c.times[i]=c.times[i-1]+(originalTimes[i]-originalTimes[i-1])*pace;}
 c.duration=c.times.at(-1);c.contactPhase=timing[name].hit/c.duration;timing[name]={duration:c.duration,hit:timing[name].hit,contact:c.contactPhase,cancel:Math.max(timing[name].hit+.3,c.duration*.75)};
 for(const a of [...Object.values(c.tracks),c.hips,c.weaponPositions,c.weaponRotations])for(let i=0;i<a.length;i++)a[i]=round(a[i]);out[name]=c;h.dispose(scene);
}
// Ground the counter's interpolated brace, measuring actual foot vertices.
HERO_MELEE_DATA.kain=out;{
 const scene=new T.Scene(),h=new Animated(asset,scene,true,false,weapon,'kain'),feet=[];h.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const g=mesh.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;for(let i=0;i<si.count;i++){let k=0;for(let j=1;j<4;j++)if(sw.getComponent(i,j)>sw.getComponent(i,k))k=j;if(/(Foot|ToeBase)$/.test(mesh.skeleton.bones[si.getComponent(i,k)].name))feet.push([mesh,i]);}});
 const c=out.counter;h.play('counter','ground');h.current.paused=true;for(let i=0;i<c.times.length;i++){h.rig.restore();h.current.time=c.times[i];h.mixer.update(1/120);h.rig.apply(fieldHeroAction('kain',h.current.getClip(),c.times[i],'ground'),false,false,1/120,'counter');h.root.updateMatrixWorld(true);for(const mesh of new Set(feet.map(([m])=>m)))mesh.skeleton.update();let y=Infinity;for(const[m,j]of feet)y=Math.min(y,m.localToWorld(m.getVertexPosition(j,V())).y);const dy=Math.max(0,.005-y)/h.model.getWorldScale(V()).y;c.hips[i*3+1]+=dy;c.weaponPositions[i*3+1]+=dy;}h.dispose(scene);
}
// Store the actual runtime arm solution too, so the offline joint audit sees
// the same elbow/wrist frame as the game, not the pre-IK bridge candidate.
for(const[name,src]of Object.entries(out)){
 const scene=new T.Scene(),h=new Animated(asset,scene,true,false,weapon,'kain'),bones={};h.model.traverse(b=>{if(b.isBone)bones[b.name.replace(/^mixamorig:?/,'')]=b;});h.play(name,name);h.current.paused=true;const c={...src,tracks:Object.fromEntries(Object.keys(src.tracks).map(n=>[n,[]]))};
 for(let i=0;i<src.times.length;i++){h.rig.restore();h.current.time=src.times[i];h.mixer.update(1/120);h.rig.apply(fieldHeroAction('kain',h.current.getClip(),src.times[i],name),false,false,1/120,name);for(const[n,a]of Object.entries(c.tracks))bones[n].quaternion.toArray(a,a.length);}for(const a of Object.values(c.tracks))for(let i=0;i<a.length;i++)a[i]=round(a[i]);out[name]=c;h.dispose(scene);
}
fs.writeFileSync('js/hero-melee-data.js','// Reviewed greatsword sources sampled at 120 Hz with authored recovery timing; shared GLBs and five released skills untouched.\nexport const HERO_MELEE_DATA='+JSON.stringify({kain:out})+';\n');
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(timing,null,2)+'\n');
