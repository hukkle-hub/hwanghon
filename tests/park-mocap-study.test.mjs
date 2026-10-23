import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
function glb(name){const b=fs.readFileSync(new URL('../art/review/part1/'+name,import.meta.url)),n=b.readUInt32LE(12);return {j:JSON.parse(b.toString('utf8',20,20+n)),bin:b.subarray(28+n,28+n+b.readUInt32LE(20+n))};}
test('Park mocap study preserves source buffers, geometry, original twelve clips',()=>{
 const a=glb('park-combat-shoulder-study.glb'),b=glb('park-mocap-study.glb');
 assert.ok(b.bin.subarray(0,a.bin.length).equals(a.bin));
 for(const key of ['meshes','nodes','skins','materials','textures','images'])assert.deepEqual(b.j[key],a.j[key]);
 assert.deepEqual(b.j.animations.slice(0,12),a.j.animations);
 assert.equal(b.j.animations.length,15);
 const expected=[['getup_back_park_mocap',4.6083],['getup_face_park_mocap',3.775],['dodge_park_mocap',2.1083]];
 for(const [i,[name,duration]]of expected.entries()){
  const clip=b.j.animations[12+i];assert.equal(clip.name,name);
  for(const sampler of clip.samplers){
   const time=b.j.accessors[sampler.input];assert.ok(Math.abs(time.max[0]-duration)<.001);
   for(const ai of [sampler.input,sampler.output]){const ac=b.j.accessors[ai],v=b.j.bufferViews[ac.bufferView];for(let k=0;k<v.byteLength;k+=4)assert.ok(Number.isFinite(b.bin.readFloatLE((v.byteOffset||0)+k)));}
  }
  const sword=b.j.nodes.findIndex(n=>n.name==='ParkDanjoe');
  assert.ok(clip.channels.some(c=>c.target.node===sword&&c.target.path==='translation'));
 }
});
test('leg-weight study restores thigh influences without changing mesh surface or source clips',()=>{
 const a=glb('park-combat-shoulder-study.glb'),b=glb('park-mocap-leg-study.glb');
 assert.ok(b.bin.subarray(0,a.bin.length).equals(a.bin));assert.deepEqual(b.j.animations.slice(0,12),a.j.animations);
 const pa=a.j.meshes[0].primitives[0],pb=b.j.meshes[0].primitives[0];
 for(const key of ['POSITION','NORMAL','TEXCOORD_0'])assert.equal(pb.attributes[key],pa.attributes[key]);assert.equal(pb.indices,pa.indices);
 const skin=b.j.skins[0],thigh=skin.joints.map(i=>b.j.nodes[i].name).indexOf('RThigh');
 const read=(g,ai,i,k)=>{const ac=g.j.accessors[ai],v=g.j.bufferViews[ac.bufferView],size=ac.componentType===5126?4:2,stride=v.byteStride||size*4;return g.bin[ac.componentType===5126?'readFloatLE':'readUInt16LE']((v.byteOffset||0)+(ac.byteOffset||0)+i*stride+k*size);};
 const count=b.j.accessors[pb.attributes.WEIGHTS_0].count;let affected=0;
 for(let i=0;i<count;i++){let sum=0;for(let k=0;k<4;k++){const w=read(b,pb.attributes.WEIGHTS_0,i,k),j=read(b,pb.attributes.JOINTS_0,i,k);assert.ok(w>=0&&Number.isFinite(w));sum+=w;if(j===thigh&&w>.001)affected++;}assert.ok(Math.abs(sum-1)<1e-6);}
 assert.ok(affected>100,'thigh must actually deform visible vertices');
 // This asserts structural validity only. Coat distortion and blade-floor
 // penetration are known visual failures, not made passing by these tests.
});
