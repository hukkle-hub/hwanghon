import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),M=require('../server/field-mob-combat.cjs');
const names=['walker','runner','breaker','stalker','armored','resonator'];
function read(k,mobile){const b=fs.readFileSync(new URL('../art/3d/monsters/n01-candidates/g5_'+k+(mobile?'_mobile':'')+'.glb',import.meta.url)),n=b.readUInt32LE(12);return {g:JSON.parse(b.subarray(20,20+n).toString().trim()),bin:b.subarray(28+n)};}
function bytes(d,i){const a=d.g.accessors[i],v=d.g.bufferViews[a.bufferView],size=({SCALAR:1,VEC2:2,VEC3:3,VEC4:4})[a.type]*4,start=(v.byteOffset||0)+(a.byteOffset||0);assert.equal(a.componentType,5126);assert(!a.sparse);return Buffer.concat(Array.from({length:a.count},(_,k)=>d.bin.subarray(start+k*(v.byteStride||size),start+k*(v.byteStride||size)+size)));}
function motion(d,name){const a=d.g.animations.find(a=>a.name===name);assert(a,'Missing '+name);return a.channels.map(c=>{const s=a.samplers[c.sampler];return [d.g.nodes[c.target.node].name,c.target.path,s.interpolation||'LINEAR',bytes(d,s.input),bytes(d,s.output)];}).sort((a,b)=>(a[0]+a[1]).localeCompare(b[0]+b[1]));}
test('all six high/mobile GLBs retain exact motion samples, root core and aliases; LOD never retimes combat',()=>{
 for(const k of names){const high=read(k,false),low=read(k,true);assert.equal(high.g.skins[0].joints.length,65);assert.equal(low.g.skins[0].joints.length,65);assert(high.g.nodes.some(n=>n.name==='core'));assert(low.g.nodes.some(n=>n.name==='core'));
  for(const a of high.g.animations)assert.deepEqual(motion(low,a.name),motion(high,a.name),k+' '+a.name+' sample mismatch');
  assert.deepEqual(motion(low,'death'),motion(low,'die'));assert.deepEqual(motion(low,'attack1'),motion(low,'attack'));
  assert(low.g.meshes.reduce((n,m)=>n+m.primitives.reduce((n,p)=>n+low.g.accessors[p.indices].count/3,0),0)<=20000);
 }
 // Negative control: even a one-frame start-time shift must be caught.
 const a=read('runner',true),b=read('runner',true),anim=b.g.animations.find(a=>a.name==='flank_swipe'),i=anim.samplers[0].input,acc=b.g.accessors[i],v=b.g.bufferViews[acc.bufferView],at=(v.byteOffset||0)+(acc.byteOffset||0);b.bin=Buffer.from(b.bin);b.bin.writeFloatLE(1/30,at);assert.throws(()=>assert.deepEqual(motion(a,'flank_swipe'),motion(b,'flank_swipe')));
});
test('baked attack ends align with authoritative windup and recovery, including all four armored beats',()=>{
 const nav={safe:()=>false,legal:()=>true,canTraverse:()=>true,route:()=>null};
 for(const k of names){const id='G5_'+k.toUpperCase(),d=read(k,false);for(let beat=0;beat<(k==='armored'?4:1);beat++){
  const m={id:'m',catalogId:id,x:0,z:0,alive:true,group:{area:{}}},a=M.reset(m,0);a.attackCount=beat;M.tick(m,a,M.statsFor(id),[{id:'p',x:0,z:1}],0,nav);
  const c=d.g.animations.find(c=>c.name===a.action.clip);assert(c,id+' '+a.action.clip);const duration=Math.max(...c.samplers.map(s=>d.g.accessors[s.input].max[0]));assert(Math.abs(duration-(a.action.windupMs+a.action.recoveryMs)/1000)<.034,id+' authoritative action ends before/after baked animation');
 }}
});
