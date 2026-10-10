import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import * as T from '../vendor/three/three.module.js';
import {HERO_SKILL_DATA} from '../js/hero-skill-data.js';
import {sampleAction} from '../js/combat-motion.js';
import {swingTrailActive} from '../js/mmo/field-feel.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {Animated} from '../js/party-avatar.js';
import {fieldHeroAction} from '../js/mmo/hero-motion.js';
import {measureAinBladeContact} from '../js/ain-scythe-mount.js';
globalThis.window=globalThis;vm.runInThisContext(fs.readFileSync('js/dungeons.js','utf8'));vm.runInThisContext(fs.readFileSync('js/skill-events.js','utf8'));
const D=globalThis.TW_DUNGEONS,M=D.RULES.motion;
test('Ain: six separate full-body takes; limbs, hips and rigid weapon use identical key times',()=>{
 for(const name of ['skill1','skill2','skill3','skill4','ult','counter']){
  const c=HERO_SKILL_DATA.ain[name];assert.ok(c.sourceLabel);assert.equal(c.times[0],0);assert.ok(Math.abs(c.times.at(-1)-c.duration)<1e-4);
  for(const n of ['Hips','Spine','LeftUpLeg','RightUpLeg','LeftArm','RightArm'])assert.equal(c.tracks[n].length,c.times.length*4,name+' '+n);
  assert.equal(c.weaponPositions.length,c.times.length*3);assert.equal(c.weaponRotations.length,c.times.length*4);
  assert.ok(c.weaponPositions.every(Number.isFinite));assert.ok(c.weaponRotations.every(Number.isFinite));
  if(!['skill4','skill2'].includes(name))assert.ok(Math.abs(M.characterProfiles.ain[name].duration-c.duration)<1e-4,'never compress '+name);
 }
 const c=HERO_SKILL_DATA.ain.skill3,q0=new T.Quaternion().fromArray(c.tracks.Hips,0);
 assert.ok(c.times.some((_,i)=>q0.angleTo(new T.Quaternion().fromArray(c.tracks.Hips,i*4))>.8),'spin must turn the hips, not merely shake hands');
});
test('Ain: each damage event lands on the same full-body and weapon source frame',()=>{
 for(const name of ['skill1','skill3','ult']){
  const c=HERO_SKILL_DATA.ain[name],p=M.characterProfiles.ain[name],a={clip:name,elapsed:0,hitAt:p.hit,duration:p.duration,clipHit:M.clipContactsByChar.ain[name],fullBodyMocap:true};
  const ev=name==='ult'?D.SKILLS.ainUlt.ev:D.SKILLS.ain[Number(name.slice(-1))-1].ev;
  for(const [frac]of ev.hits){const t=globalThis.TW_SKILL_EVENTS.timeOf(frac,a);assert.ok(Math.abs(sampleAction({...a,elapsed:t},c.duration)-frac*c.duration)<1e-5);}
  assert.equal(sampleAction({...a,elapsed:a.duration},c.duration),c.duration);
 }
});
test('two-cut skill keeps the actual weapon trail visible at BOTH contacts, never only the first',()=>{
 const at=[.7,1.37],check=fn=>{assert.ok(fn({at,t:1.37}),'second cut has no trail');assert.equal(fn({at,t:2}),false);};
 check(swingTrailActive);assert.throws(()=>check(s=>s.t>=s.at[0]*.6&&s.t<=s.at[0]+.22),/second cut/);
});
test('both live render paths apply retargeted takes before constructing mixer actions',()=>{
 const game=fs.readFileSync('js/game3d.js','utf8'),party=fs.readFileSync('js/party-avatar.js','utf8');
 assert.ok(game.indexOf('g.animations=applyHeroSkillClips')<game.indexOf('new THREE.AnimationMixer(ain.model)'));
 assert.ok(party.indexOf('animations:applyHeroSkillClips')<party.indexOf('new T.AnimationMixer(this.model)'));
 assert.match(game,/fullBodyMocap:!!oc.userData\?\.fullBody/);assert.match(party,/clipTime:this.current.time/);
 assert.match(game,/rc\?\.userData\?\.fullBody\?1:/,'full backstep must not be squeezed into roll immunity');
 assert.match(game,/fullUntil=battle.snapshot\(\).time\+6.5/,'review must use simulation seconds, not skip skills on slow renders');
 for(const f of ['hero-skill-clips','hero-skill-data','mocap-grip'])assert.ok(fs.readFileSync('sw.js','utf8').includes('js/'+f+'.js'));
});

test('actual Ain mesh: selected chest contact uses the BLADE surface, both spin hits and exact palms',async()=>{
 vm.runInThisContext(fs.readFileSync('js/looks.js','utf8'));
 const load=async path=>{const b=fs.readFileSync(path),l=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])l.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
 const scene=new T.Scene(),h=new Animated(await load('art/3d/ain_anim.glb'),scene,true,false,await load('art/3d/ain_scythe_tex.glb'),'ain');
 try{for(const [name,contacts]of [['skill1',[.54]],['skill3',[.433,.558]],['ult',[.483]],['counter',[.392]]]){
  // Standing chest at normal reach, raised core in the close-in boss pose.
  // An arbitrarily high AND distant target is outside this human arm/shaft.
  for(const [y,z] of [[1.7,1.56],[2.3,.9]]){h.play(name,name+y);h.current.paused=true;const c=h.current.getClip(),target=new T.Vector3(0,y,z);
   for(let i=0;i<=240;i++){h.rig.restore();h.current.time=c.duration*i/240;h.mixer.update(c.duration/240);h.rig.apply(fieldHeroAction('ain',c,h.current.time,name),false,false,c.duration/240,name,target);h.root.updateMatrixWorld(true);
    if(contacts.some(u=>Math.round(u*240)===i)){assert.ok(h.rig.diagnostics.gripError<.001,name+' loses palm contact');const d=measureAinBladeContact(h.weapon,target).distance;assert.ok(d<.39,name+' y='+y+' phase='+i/240+' blade miss '+d);}
   }
  }
 }
 // Negative control: the former "maximum speed == contact" ultimate frame
 // misses this chest visibly; the same surface test must reject it.
 h.play('ult','old-contact-negative');h.current.paused=true;const c=h.current.getClip();
 for(let i=0;i<=127;i++){h.rig.restore();h.current.time=c.duration*i/240;h.mixer.update(c.duration/240);h.rig.apply(fieldHeroAction('ain',c,h.current.time,'negative'),false,false,c.duration/240,'ult',null);}
 assert.ok(measureAinBladeContact(h.weapon,new T.Vector3(0,1.7,1.56)).distance>.39,'old ultimate frame must fail the surface check');
 }finally{h.dispose(scene);}
});
