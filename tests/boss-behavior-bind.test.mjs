import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {BOSS_PROFILES,createBossBehavior} from '../js/boss-motion.js';
import {createPumpBoss} from '../js/pump-boss.js';import {createRelayBoss} from '../js/relay-boss.js';
import {createRootBoss} from '../js/root-boss.js';import {createHaulerBoss} from '../js/hauler-boss.js';import {createWardBoss} from '../js/ward-boss.js';

const factories={sewage:createPumpBoss,relay:createRelayBoss,grove:createRootBoss,road:createHaulerBoss,ward:createWardBoss};
const bytes=fs.readFileSync(new URL('../art/3d/boss_marsh_v2.glb',import.meta.url));
const marsh=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;

function requested(p){return [...p.idle,...Object.values(p.prep).flat()].map(t=>t[0]);}
test('authored behavior targets real nodes on every shipped boss rig',()=>{
 for(const id of ['marsh',...Object.keys(factories)]){
   const model=id==='marsh'?marsh:factories[id]().scene, view=createBossBehavior(model,id), want=requested(BOSS_PROFILES[id]);
   const bound=want.filter(n=>view.nodes[n]).length;
   assert.ok(bound/want.length>=.8,`${id}: bound ${bound}/${want.length}`);
   for(const icon of Object.keys(BOSS_PROFILES[id].prep)){view.restore();view.apply({state:'telegraph',patIcon:icon,windup:.45,rage:false},1,.016);model.updateMatrixWorld(true);model.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),id+':'+icon));}
 }
});
