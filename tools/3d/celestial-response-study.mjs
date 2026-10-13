// Phase-one response study: original two wing groups, not awakened four wings.
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../../vendor/three/three.module.js';
const source='art/review/part1/celestial-wing-study.glb',output='art/review/part1/celestial-response-study.glb';
const bytes=fs.readFileSync(source),jn=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+jn)),bin=bytes.subarray(28+jn,28+jn+bytes.readUInt32LE(20+jn));
const primitive=j.meshes[0].primitives[0],meshNode=j.nodes.findIndex(n=>n.name==='Boss_Mesh'),pivot=j.nodes.findIndex(n=>n.name==='KitMechanicalMotion');
if(primitive.targets.length!==2||pivot<0)throw Error('Unexpected wing source');
function read(index){const a=j.accessors[index],v=j.bufferViews[a.bufferView],dim={SCALAR:1,VEC3:3,VEC4:4}[a.type];if(a.componentType!==5126||!dim||v.byteStride)throw Error('Unsupported accessor');return Array.from({length:a.count*dim},(_,i)=>bin.readFloatLE((v.byteOffset||0)+(a.byteOffset||0)+i*4));}
const chunks=[bin];let length=bin.length;
function add(values,type){const dim={SCALAR:1,VEC3:3,VEC4:4}[type],data=Buffer.from(new Float32Array(values).buffer),view=j.bufferViews.length,index=j.accessors.length,min=Array(dim).fill(Infinity),max=Array(dim).fill(-Infinity);for(let i=0;i<values.length;i++){min[i%dim]=Math.min(min[i%dim],values[i]);max[i%dim]=Math.max(max[i%dim],values[i]);}j.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length});chunks.push(data);length+=data.length;j.accessors.push({bufferView:view,componentType:5126,count:values.length/dim,type,min,max});return index;}
const positions=read(primitive.attributes.POSITION),oldTargets=primitive.targets;primitive.targets=[];
for(const sign of [-1,1])for(const target of oldTargets){const result={};for(const [key,index]of Object.entries(target)){const values=read(index).map((v,i)=>positions[Math.floor(i/3)*3]*sign>0?v:0);result[key]=add(values,'VEC3');}primitive.targets.push(result);}
j.meshes[0].weights=[0,0,0,0];j.meshes[0].extras.targetNames=['LeftGather','LeftDrive','RightGather','RightDrive'];
for(const animation of j.animations)for(const channel of animation.channels)if(channel.target.path==='weights'){const sampler=animation.samplers[channel.sampler],old=read(sampler.output),expanded=[];for(let i=0;i<old.length;i+=2)expanded.push(old[i],old[i+1],old[i],old[i+1]);sampler.output=add(expanded,'SCALAR');}
const smooth=t=>t*t*(3-2*t);
function curve(keys,t){if(t<=keys[0][0])return keys[0].slice(1);for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){const a=keys[i-1],b=keys[i],u=smooth((t-a[0])/(b[0]-a[0]));return a.slice(1).map((v,k)=>v+(b[k+1]-v)*u);}return keys.at(-1).slice(1);}
// Left/right wing lag carries recoil while the core and head retain their shape.
// No root translation: authoritative movement/lift remain a separate game layer.
const responses={
 hit:{weights:[[0,0,0,0,0],[.10,.48,0,.12,0],[.22,.2,0,0,.2],[.48,.06,0,.05,0],[.72,0,0,0,0]],rotation:[[0,0,0,0],[.10,.035,-.025,-.055],[.26,-.012,.008,.022],[.72,0,0,0]]},
 cancel:{weights:[[0,0,0,0,0],[.16,.38,0,.2,0],[.32,0,.28,0,.18],[.62,.06,0,.08,0],[.9,0,0,0,0]],rotation:[[0,0,0,0],[.16,.028,0,-.025],[.38,-.01,0,.009],[.9,0,0,0]]},
 dodge:{weights:[[0,0,0,0,0],[.18,.6,0,0,.3],[.42,.45,0,0,.4],[.66,0,.18,.24,0],[1.1,0,0,0,0]],rotation:[[0,0,0,0],[.18,.025,-.08,-.18],[.42,.015,-.08,-.18],[.68,-.02,.025,.055],[1.1,0,0,0]]}
};
for(const [name,def]of Object.entries(responses)){const duration=def.weights.at(-1)[0],times=[...new Set([...Array.from({length:Math.ceil(duration*60)+1},(_,i)=>Math.min(i/60,duration)),...def.weights.map(k=>k[0]),...def.rotation.map(k=>k[0])])].sort((a,b)=>a-b),input=add(times,'SCALAR');j.animations.push({name,samplers:[{input,output:add(times.flatMap(t=>curve(def.weights,t)),'SCALAR'),interpolation:'LINEAR'},{input,output:add(times.flatMap(t=>new T.Quaternion().setFromEuler(new T.Euler(...curve(def.rotation,t))).toArray()),'VEC4'),interpolation:'LINEAR'}],channels:[{sampler:0,target:{node:meshNode,path:'weights'}},{sampler:1,target:{node:pivot,path:'rotation'}}]});}
j.extras={...j.extras,reviewOnly:true,responseStudy:'phase-one asymmetric wing recoil/brake/bank; no game registration, translation, death or four-wing awakening approval'};j.buffers[0].byteLength=length;
let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+length,8);head.writeUInt32LE(json.length,12);head.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(length,0);bh.writeUInt32LE(0x004e4942,4);const out=Buffer.concat([head,json,bh,...chunks]);fs.writeFileSync(output,out);console.log(JSON.stringify({source,output,sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),sha256:crypto.createHash('sha256').update(out).digest('hex'),clips:j.animations.map(a=>a.name),approved:false},null,2));
