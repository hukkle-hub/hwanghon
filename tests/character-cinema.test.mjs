import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {CINEMA_STYLE,createCharacterCinema,transitionFor} from '../js/character-cinema.js';

function rig(){
 const root=new T.Group(),model=new T.Group();root.add(model);let p=model;
 for(const n of ['Hips','Spine','Spine1','Spine2','Neck','Head']){const b=new T.Bone();b.name='mixamorig:'+n;b.position.y=.2;p.add(b);p=b;}
 for(const n of ['LeftShoulder','RightShoulder']){const b=new T.Bone();b.name='mixamorig:'+n;model.add(b);}
 model.updateWorldMatrix(true,true);return {root,model};
}

test('four cinematic profiles cover every authored combat clip family',()=>{
 for(const cid of ['ain','kain','ryu','sera']){const a=CINEMA_STYLE[cid].attack;for(const n of ['attack1','attack2','attack3','smash','skill1','skill2','skill3','skill4','ult','counter','exec'])assert.ok(a[n],cid+' '+n);}
});

test('cinema layer is presentation-only and restore returns exact pose',()=>{
 const {root,model}=rig(),c=createCharacterCinema(model,root,'ain');
 const before={};model.traverse(o=>{if(o.isBone)before[o.name]=o.quaternion.clone();});
 c.apply({dt:1/60,clip:'attack1',action:{clip:'attack1',elapsed:.18,duration:.66},moving:false,speed:0});
 let changed=0;model.traverse(o=>{if(o.isBone&&o.quaternion.angleTo(before[o.name])>1e-5)changed++;});assert.ok(changed>=2);
 c.restore();model.traverse(o=>{if(o.isBone)assert.ok(o.quaternion.angleTo(before[o.name])<1e-8,o.name);});
});

test('each character keeps dodge fast and finisher recovery slower than basic attacks',()=>{
 for(const cid of ['ain','kain','ryu','sera']){assert.ok(transitionFor(cid,'dodgeL').in<transitionFor(cid,'attack1').in,cid);assert.ok(transitionFor(cid,'ult').out>transitionFor(cid,'attack1').out,cid);}
 assert.ok(transitionFor('ryu','attack1').in<transitionFor('kain','attack1').in);
});


test('all four character profiles can animate and restore the common combat skeleton',()=>{
 for(const cid of ['ain','kain','ryu','sera']){const {root,model}=rig(),c=createCharacterCinema(model,root,cid);const before={};model.traverse(o=>{if(o.isBone)before[o.name]=o.quaternion.clone();});c.apply({dt:1/60,clip:'attack1',action:{clip:'attack1',elapsed:.2,duration:.7},moving:false,speed:0});c.restore();model.traverse(o=>{if(o.isBone)assert.ok(o.quaternion.angleTo(before[o.name])<1e-8,cid+' '+o.name);});}
});

test('turn lag stays bounded under abrupt 180-degree change',()=>{
 const {root,model}=rig(),c=createCharacterCinema(model,root,'ain');
 c.apply({dt:1/60,clip:'idle'});c.restore();root.rotation.y=Math.PI;
 c.apply({dt:1/60,clip:'idle'});
 assert.ok(Math.abs(c.diagnostics.turnLag)<=CINEMA_STYLE.ain.turn.max+1e-9);
});
