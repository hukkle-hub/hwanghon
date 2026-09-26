import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {KAIN_CINEMA_V02,createCharacterCinema} from '../js/character-cinema.js';

function rig(){
  const root=new T.Group(),model=new T.Group();root.add(model);let p=model;
  for(const n of ['Hips','Spine','Spine1','Spine2','Neck','Head']){const b=new T.Bone();b.name='mixamorig:'+n;b.position.y=.2;p.add(b);p=b;}
  for(const side of ['Left','Right']){
    let q=model;
    for(const n of ['Shoulder','Arm','ForeArm','Hand']){const b=new T.Bone();b.name='mixamorig:'+side+n;b.position.set(side==='Left'?.1:-.1,.1,0);q.add(b);q=b;}
  }
  model.updateWorldMatrix(true,true);return {root,model};
}
function snap(model){const r={pos:model.position.clone(),bones:{}};model.traverse(o=>{if(o.isBone)r.bones[o.name]=o.quaternion.clone();});return r;}

test('Kain v02 authors every damaging heavy family without touching skill2 utility timing',()=>{
  for(const n of ['attack1','attack2','attack3','smash','skill1','skill3','skill4','ult','counter','exec'])assert.ok(KAIN_CINEMA_V02.attack[n],n);
  assert.equal(KAIN_CINEMA_V02.attack.skill2,undefined);
});

test('Kain v02 contact compression follows combat hitAt instead of a fixed animation fraction',()=>{
  const {root,model}=rig(),c=createCharacterCinema(model,root,'kain');
  c.apply({dt:1/60,clip:'smash',clipTime:.61,action:{clip:'smash',duration:1,elapsed:.61,hitAt:.61}});
  assert.ok(Math.abs(c.diagnostics.contact-.61)<1e-9);
  assert.ok(c.diagnostics.impact>.99);
});

test('Kain v02 keeps hand bones untouched so two-hand grip solver remains authoritative',()=>{
  const {root,model}=rig(),c=createCharacterCinema(model,root,'kain'),before=snap(model);
  c.apply({dt:1/60,clip:'skill4',clipTime:.48,action:{clip:'skill4',duration:1,elapsed:.48,hitAt:.48}});
  for(const n of ['mixamorig:LeftArm','mixamorig:LeftForeArm','mixamorig:LeftHand','mixamorig:RightArm','mixamorig:RightForeArm','mixamorig:RightHand']){
    const b=model.getObjectByName(n);assert.ok(b.quaternion.angleTo(before.bones[n])<1e-10,n);
  }
  assert.ok(model.getObjectByName('mixamorig:Spine').quaternion.angleTo(before.bones['mixamorig:Spine'])>1e-4);
});

test('Kain iron-wall pose plants visually and restore returns exact model/bone pose',()=>{
  const {root,model}=rig(),c=createCharacterCinema(model,root,'kain'),before=snap(model);
  c.apply({dt:1/60,clip:'skill2',clipTime:.45,moving:false,guard:false,action:null});
  assert.ok(model.position.y<before.pos.y);
  c.restore();assert.ok(model.position.distanceTo(before.pos)<1e-12);
  model.traverse(o=>{if(o.isBone)assert.ok(o.quaternion.angleTo(before.bones[o.name])<1e-10,o.name);});
});

test('Kain follow-through momentum survives the contact then decays after the action',()=>{
  const {root,model}=rig(),c=createCharacterCinema(model,root,'kain');
  for(let i=0;i<8;i++){c.restore();c.apply({dt:1/60,clip:'ult',clipTime:.72,action:{clip:'ult',duration:1,elapsed:.72,hitAt:.48}});}
  const peak=c.diagnostics.residual;assert.ok(peak>.001);
  for(let i=0;i<60;i++){c.restore();c.apply({dt:1/60,clip:'idle',clipTime:0,moving:false,action:null});}
  assert.ok(c.diagnostics.residual<peak*.15);
});
