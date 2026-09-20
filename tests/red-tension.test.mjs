import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
const bytes=await readFile('art/3d/gear/w_red_tension_hi3d.glb');
const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
test('red tension is uncompressed embedded GLB within mobile geometry budget',()=>{
 assert.equal(bytes.toString('utf8',0,4),'glTF');assert.equal(json.asset.version,'2.0');
 assert.ok(!json.skins?.length&&!json.animations?.length&&!json.cameras?.length);
 assert.ok(!(json.extensionsUsed||[]).some(x=>/draco|meshopt/i.test(x)));
 assert.equal(json.materials.length,1);assert.equal(json.images.length,3);
 for(const m of json.materials)assert.ok(m.normalTexture&&m.pbrMetallicRoughness.baseColorTexture&&m.pbrMetallicRoughness.metallicRoughnessTexture);
 for(const image of json.images){assert.ok(Number.isInteger(image.bufferView));assert.equal(image.mimeType,'image/png');}
 let triangles=0;for(const mesh of json.meshes)for(const p of mesh.primitives)triangles+=json.accessors[p.indices].count/3;
 assert.ok(triangles>1000&&triangles<=15000);assert.ok(bytes.length<12e6);
});
test('actual GLTFLoader loads centered Y-up shaft with .75m clear grip',async()=>{
 const l=new GLTFLoader();l.register(()=>({name:'no-raster',loadTexture:()=>Promise.resolve(new T.Texture())}));
 const g=await l.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 g.scene.updateMatrixWorld(true);const box=new T.Box3().setFromObject(g.scene);assert.ok(Math.abs(box.min.y)<.01);assert.ok(box.max.y>1.85&&box.max.y<1.96);
 assert.ok(g.scene.getObjectByName('AinBladeRoot'));assert.ok(g.scene.getObjectByName('AinBladeTip'));
 assert.ok(g.scene.getObjectByName('AinBladeTip').getWorldPosition(new T.Vector3()).x<-.5,'cutting blade must match runtime -X convention');
 let samples=0;g.scene.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;
 for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(Math.abs(v.y-.75)<.045||Math.abs(v.y-.43)<.045){assert.ok(Math.hypot(v.x,v.z)<.025);samples++;}}});assert.ok(samples>20);
});
test('pilot selection is explicit, local and Ain-only',async()=>{
 const src=await readFile('js/looks.js','utf8');
 function choose(hostname,query,charId){let selected;const slot={children:[],add(){}};const context={window:{},location:{hostname,search:query},URLSearchParams};vm.runInNewContext(src,context);
 const model={traverse(fn){fn({isBone:true,name:'RightHandSlot',...slot});}};
 context.window.TW_LOOKS.attach({}, {load(url){selected=url;}},model,{main:'w_marsh_scythe'},{charId});return selected;}
 assert.equal(choose('localhost','?gearPreview=red_tension','ain'),'art/3d/gear/w_red_tension_hi3d.glb?v=2030h2');
 for(const [host,q,char] of [['example.com','?gearPreview=red_tension','ain'],['localhost','','ain'],['localhost','?gearPreview=red_tension','kain']])assert.equal(choose(host,q,char),'art/3d/ain_scythe_tex.glb');
});
