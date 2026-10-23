// Candidate-only regression, never an approval of motion/anatomy or live enablement.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {makePoser} from '../tools/3d/pose-eval.mjs';
const loader=new GLTFLoader();loader.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));
async function load(name){const b=fs.readFileSync(new URL('../art/review/part1/'+name,import.meta.url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const candidate=await load('park-combat-shoulder-study.glb');
let mesh;candidate.scene.traverse(o=>{if(o.isSkinnedMesh&&!mesh)mesh=o;});
test('Park study preserves recovered vertex/UV/index data and all 12 clips; not live model',async()=>{
 const original=await load('park-recovered.glb');let source;original.scene.traverse(o=>{if(o.isSkinnedMesh&&!source)source=o;});
 for(const name of ['position','normal','uv'])assert.deepEqual(mesh.geometry.attributes[name].array,source.geometry.attributes[name].array);
 assert.deepEqual(mesh.geometry.index.array,source.geometry.index.array);assert.equal(candidate.animations.length,12);
 const table=fs.readFileSync(new URL('../server/boss-table.cjs',import.meta.url),'utf8');
 assert.doesNotMatch(table,/park-combat-(?:candidate|shoulder-study)/);
});
test('actual death skin stays on floor at 60Hz, then settles with unloaded knees',()=>{
 const clip=candidate.animations.find(c=>c.name==='death_park_salute'),pose=makePoser(candidate.scene,clip),point=new T.Vector3();
 let low=Infinity,high=-Infinity;
 const floor=()=>{let y=Infinity;for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);y=Math.min(y,point.y);}return y;};
 for(let i=0;i<=Math.ceil(clip.duration*60);i++){pose(Math.min(clip.duration,i/60));const y=floor();low=Math.min(low,y);high=Math.max(high,y);}
 assert.ok(low>-.006,`penetration ${low}`);assert.ok(high<.006,`hover ${high}`);
 const head=candidate.scene.getObjectByName('Head').getWorldPosition(new T.Vector3());assert.ok(head.y<.5,'corpse must not remain upright');
 // Positive clearance is a failure too; old minimum-only checks missed it.
 const root=candidate.scene.getObjectByName('Root');root.position.y+=.1;candidate.scene.updateMatrixWorld(true);
 assert.throws(()=>assert.ok(Math.abs(floor())<.006),'hover negative control');pose(clip.duration);
});
