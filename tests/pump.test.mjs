import test from 'node:test';import assert from 'node:assert/strict';import * as T from '../vendor/three/three.module.js';import {createPumpBoss} from '../js/pump-boss.js';
test('pump boss rig: target nodes, detachable pipes, finite animation bounds',()=>{
 const g=createPumpBoss(),m=new T.AnimationMixer(g.scene);for(const n of ['Core','Head','Spine','Intake','Exhaust','piece_intake','piece_exhaust'])assert.ok(g.scene.getObjectByName(n),n);
 for(const n of ['idle','walk','atk_hammer','atk_bolt','atk_scythe','atk_flame','hit','stagger','down','up','death']){const c=g.animations.find(c=>c.name===n);assert.ok(c,n);m.stopAllAction();const a=m.clipAction(c);a.play();a.paused=true;for(let i=0;i<=20;i++){a.time=c.duration*i/20;m.update(0);g.scene.updateMatrixWorld(true);g.scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),n));}}
 const box=new T.Box3().setFromObject(g.scene);assert.ok(box.getSize(new T.Vector3()).length()<15);
});
