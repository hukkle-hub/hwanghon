import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import * as T from '../vendor/three/three.module.js';import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {Animated} from '../js/party-avatar.js';import {fieldHeroAction} from '../js/mmo/hero-motion.js';import {HERO_SKILL_DATA} from '../js/hero-skill-data.js';import {sampleAction} from '../js/combat-motion.js';
import {prepareArmSurface,armSurfaceNow} from '../tools/3d/arm-surface-audit.mjs';import {frameReviewCamera} from '../tools/3d/review-framing.js';
import {makePoser} from '../tools/3d/pose-eval.mjs';
globalThis.window=globalThis;vm.runInThisContext(fs.readFileSync('js/dungeons.js','utf8'));vm.runInThisContext(fs.readFileSync('js/looks.js','utf8'));vm.runInThisContext(fs.readFileSync('js/skill-events.js','utf8'));
const D=globalThis.TW_DUNGEONS,M=D.RULES.motion;
const load=async f=>{const b=fs.readFileSync(f),l=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])l.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
function bladeDistance(weapon,target){let best=Infinity;const origin=weapon.getWorldPosition(new T.Vector3()),axis=new T.Vector3(0,1,0).transformDirection(weapon.matrixWorld),tri=new T.Triangle(),near=new T.Vector3();weapon.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,idx=o.geometry.index;for(let i=0;i<(idx?.count||p.count);i+=3){const v=[tri.a,tri.b,tri.c];for(let j=0;j<3;j++)v[j].fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(o.matrixWorld);if(!v.every(p=>p.clone().sub(origin).dot(axis)>.30))continue;tri.closestPointToPoint(target,near);best=Math.min(best,near.distanceTo(target));}});return best;}
test('Kain: five distinct full-body sources, canonical clocks never compress them',()=>{
 for(const[name,c]of Object.entries(HERO_SKILL_DATA.kain)){assert.ok(c.sourceLabel);assert.equal(c.times[0],0);assert.ok(Math.abs(c.times.at(-1)-c.duration)<1e-4);for(const n of ['Hips','Spine','RightUpLeg','LeftUpLeg','RightArm','LeftArm'])assert.equal(c.tracks[n].length,c.times.length*4);if(name==='skill2')continue;const p=M.characterProfiles.kain[name];assert.equal(p.duration,c.duration);const ev=name==='ult'?D.SKILLS.kainUlt.ev:D.SKILLS.kain[Number(name.at(-1))-1].ev,a={clip:name,duration:p.duration,hitAt:p.hit,clipHit:M.clipContactsByChar.kain[name],fullBodyMocap:true};for(const[f]of ev.hits){const t=globalThis.TW_SKILL_EVENTS.timeOf(f,a);assert.ok(Math.abs(sampleAction({...a,elapsed:t},c.duration)-f*c.duration)<1e-4);}}
});
for(const lod of [false,true])test('Kain actual '+(lod?'mobile':'original')+' mesh: complete takes preserve wrists, exact palms and both blade contacts',async()=>{
 const scene=new T.Scene(),prefix=lod?'lod/':'',h=new Animated(await load('art/3d/'+prefix+'kain_anim.glb'),scene,true,false,await load('art/3d/'+prefix+'gear/w_kain_greatsword.glb'),'kain'),bones={};h.model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});const surfaces=prepareArmSurface(h.model),regions=Object.fromEntries(['Right','Left'].map(side=>[side,prepareArmSurface(h.model,{side,boundary:true})])),surfacePass=s=>s.collapsedFraction<.006&&s.stretchedFraction<(lod?.015:.018);assert.ok(surfaces.length);
 try{for(const[name,c]of Object.entries(HERO_SKILL_DATA.kain)){const clip=h.clips[name],pose=makePoser(h.model,clip),ev=name==='ult'?D.SKILLS.kainUlt.ev:D.SKILLS.kain[Number(name.at(-1))-1].ev,prev={};
  for(let i=0;i<=240;i++){h.rig.restore();const time=c.duration*i/240;pose(time);h.rig.apply(fieldHeroAction('kain',clip,time,name),false,false,c.duration/240,name);h.root.updateMatrixWorld(true);const d=h.rig.diagnostics;
   assert.ok(d.gripError<.001&&d.rightGripError<.001,name+' grip');
   // A rigid zero-bend constraint routed elbows through the torso. Allow a
   // conservative 30 degree wrist range while independently testing clearance.
   assert.ok(d.LeftWristBend<Math.PI/6&&d.RightWristBend<Math.PI/6,name+' wrist');
   assert.ok(d.LeftTorsoClearance>.18&&d.RightTorsoClearance>.18,name+' forearm through torso');
   assert.ok(d.LeftUpperArmClearance>.18&&d.RightUpperArmClearance>.18,name+' upper arm buried in chest phase '+i/240+' L '+d.LeftUpperArmClearance+' R '+d.RightUpperArmClearance);
   // As in the six melee takes, a forced shoulder-width 40 cm gap creates
   // raised "chicken wings". Check actual signed left/right crossing instead.
   const leftElbow=bones.LeftForeArm.getWorldPosition(new T.Vector3()),rightElbow=bones.RightForeArm.getWorldPosition(new T.Vector3()),leftAxis=bones.LeftArm.getWorldPosition(new T.Vector3()).sub(bones.RightArm.getWorldPosition(new T.Vector3())).normalize();
   assert.ok(leftElbow.distanceTo(rightElbow)>.22&&leftElbow.clone().sub(rightElbow).dot(leftAxis)>.16,name+' cramped/crossed elbows');
   if(i%4===0){assert.ok(surfacePass(armSurfaceNow(surfaces)),name+' actual arm surface collapse/stretch at '+i/240);for(const[side,region]of Object.entries(regions)){const skin=armSurfaceNow(region);assert.ok(skin.collapsedFraction<.01&&skin.stretchedFraction<.025&&skin.collapsedAreaFraction<.015,name+' '+side+' shoulder/arm seam at '+i/240+' '+JSON.stringify(skin));}}
   for(const n of ['RightArm','RightForeArm','LeftArm','LeftForeArm']){const q=bones[n].quaternion.clone().normalize();if(prev[n]){const rate=prev[n].angleTo(q)/(c.duration/240);assert.ok(rate<20,name+' discontinuous '+n+' phase '+(i/240)+' rate '+rate);}prev[n]=q;}
   if(ev.hits?.some(([f])=>Math.round(f*240)===i))assert.ok(bladeDistance(h.weapon,new T.Vector3(0,1.65,1.4))<.39,name+' blade misses chest');
  }
 }
 // A detached sword must fail the same surface test, not pass by hand numbers.
 const target=new T.Vector3(0,1.65,1.4);h.weapon.position.x+=20;h.root.updateMatrixWorld(true);assert.ok(bladeDistance(h.weapon,target)>10);
 // Negative control: retained hand targets cannot hide a collapsed skin mesh.
 for(const n of ['LeftArm','RightArm'])bones[n].scale.setScalar(.001);h.root.updateMatrixWorld(true);assert.equal(surfacePass(armSurfaceNow(surfaces)),false);
 }finally{h.dispose(scene);}
});
test('review cameras retain complete arms even in narrow portrait panels; cropped control fails',()=>{
 const points=[[-.7,1.6,-.3],[.7,1.6,.4],[-.6,1.1,.6],[.5,2.1,-.2],[0,1,0]].map(p=>new T.Vector3(...p)),fits=c=>points.every(p=>{const n=p.clone().project(c);return Math.abs(n.x)<1&&Math.abs(n.y)<1&&Math.abs(n.z)<1;});
 for(const aspect of [.35,.7,1.2,2.2])for(const dir of [new T.Vector3(0,.15,1),new T.Vector3(1,.15,0)]){const c=new T.PerspectiveCamera(30,aspect,.01,30);frameReviewCamera(c,points,dir,.14);assert.ok(fits(c));c.position.lerp(new T.Box3().setFromPoints(points).getCenter(new T.Vector3()),.85);c.updateMatrixWorld(true);assert.equal(fits(c),false);}
});
test('Kain: both live loaders choose the new adapter; post arm blending cannot detach the hands',()=>{
 for(const file of ['js/game3d.js','js/party-avatar.js']){const s=fs.readFileSync(file,'utf8');assert.match(s,/kain'\?makeKainRigAdapter/);assert.match(s,/diagnostics.source==='legacy'/);}
 assert.ok(fs.readFileSync('sw.js','utf8').includes('js/kain-two-hand.js'));
 const field=fs.readFileSync('world3d.html','utf8');assert.match(field,/if\(!hero.model.userData.heroSkillMotion\|\|hero.rig\?\.diagnostics.source==='legacy'\)/);assert.match(field,/if\(!a.model.userData.heroSkillMotion\|\|a.rig\?\.diagnostics.source==='legacy'\)/);
});
