/* Review-only paired gill fan morph. Original geometry/UV/material/binary prefix
 * stay byte-identical. Never writes the production GLB or registrations.
 * node tools/3d/leviathan-gill-candidate.mjs
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../../vendor/three/three.module.js';
const source='art/3d/part1/leviathan_static.glb',output='art/review/part1/leviathan-gill-candidate.glb';
const bytes=fs.readFileSync(source),jn=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+jn));
const binary=bytes.subarray(28+jn,28+jn+bytes.readUInt32LE(20+jn));
if(j.meshes.length!==1||j.meshes[0].primitives.length!==1||j.meshes[0].primitives[0].targets)throw Error('Unexpected source');
const p=j.meshes[0].primitives[0],node=j.nodes.findIndex(n=>n.name==='Boss_Mesh');
function attr(index){
 const a=j.accessors[index],v=j.bufferViews[a.bufferView],dim={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5126:4,5125:4,5123:2}[a.componentType];
 if(!dim||!size||a.sparse)throw Error('Unsupported accessor');
 const values=[];for(let i=0;i<a.count;i++)for(let k=0;k<dim;k++){
  const offset=(v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||dim*size)+k*size;
  values.push(a.componentType===5126?binary.readFloatLE(offset):size===4?binary.readUInt32LE(offset):binary.readUInt16LE(offset));
 }return values;
}
const positions=attr(p.attributes.POSITION),normals=attr(p.attributes.NORMAL),indices=attr(p.indices),n=positions.length/3;
let length=binary.length;const chunks=[binary];
function add(values,type){
 const data=Buffer.from(new Float32Array(values).buffer),dims={SCALAR:1,VEC3:3}[type],view=j.bufferViews.length,index=j.accessors.length;
 j.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length});chunks.push(data);length+=data.length;
 const min=Array(dims).fill(Infinity),max=Array(dims).fill(-Infinity);values.forEach((v,i)=>{min[i%dims]=Math.min(min[i%dims],v);max[i%dims]=Math.max(max[i%dims],v)});
 j.accessors.push({bufferView:view,componentType:5126,count:values.length/dims,type,min,max});return index;
}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const reports=[];p.targets=[];
for(const side of [-1,1]){
 const delta=[],deformed=[],weights=[];let affected=0,maxDisplacement=0;
 for(let i=0;i<n;i++){
  const [x,y,z]=positions.slice(i*3,i*3+3);
  const w=smooth(.34,.67,side*x)*smooth(3.55,4.35,z)*(1-smooth(5.18,5.57,z))*smooth(.35,.78,y)*(1-smooth(1.65,2.05,y));
  const angle=-side*.20*w,dx=x-side*.4,dz=z-5.55;
  const nx=side*.4+dx*Math.cos(angle)+dz*Math.sin(angle),nz=5.55-dx*Math.sin(angle)+dz*Math.cos(angle);
  const d=[nx-x,0,nz-z];delta.push(...d);deformed.push(nx,y,nz);weights.push(w);
  if(w>0)affected++;maxDisplacement=Math.max(maxDisplacement,Math.hypot(...d));
 }
 // Preserve source authored normals away from the fan; interpolate to the
 // deformed surface normal only in its support, no global relighting change.
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(deformed,3));g.setIndex(indices);g.computeVertexNormals();
 const dn=g.getAttribute('normal'),normalDelta=[];
 for(let i=0;i<n;i++)for(let k=0;k<3;k++)normalDelta.push((dn.getComponent(i,k)-normals[i*3+k])*weights[i]);
 p.targets.push({POSITION:add(delta,'VEC3'),NORMAL:add(normalDelta,'VEC3')});g.dispose();
 reports.push({side,affected,maxDisplacement});
}
j.meshes[0].weights=[0,0];j.meshes[0].extras={...(j.meshes[0].extras||{}),targetNames:['GillLeftOpen','GillRightOpen']};
const envelope=t=>{
 const keys=[[0,0],[.65,0],[1.42,1],[1.7,1],[1.90,.20],[2.55,0],[3.3,0]];
 for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){const [a,x]=keys[i-1],[b,y]=keys[i];return x+(y-x)*smooth(a,b,t)}return 0;
};
for(const animation of j.animations){
 const sampler=j.accessors[animation.samplers[0].input],duration=sampler.max[0];
 const times=Array.from({length:Math.ceil(duration*30)+1},(_,i)=>Math.min(i/30,duration));
 const values=times.flatMap(t=>{const v=animation.name==='atk_gill'?envelope(t):0;return[v,v]});
 const s=animation.samplers.length;animation.samplers.push({input:add(times,'SCALAR'),output:add(values,'SCALAR'),interpolation:'LINEAR'});
 animation.channels.push({sampler:s,target:{node,path:'weights'}});
}
j.extras={...(j.extras||{}),reviewOnly:true,gillAuthoring:'paired fan candidate v2; not approved'};j.buffers[0].byteLength=length;
let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const h=Buffer.alloc(20);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+length,8);h.writeUInt32LE(json.length,12);h.writeUInt32LE(0x4e4f534a,16);
const bh=Buffer.alloc(8);bh.writeUInt32LE(length,0);bh.writeUInt32LE(0x004e4942,4);
const out=Buffer.concat([h,json,bh,...chunks]);fs.mkdirSync('art/review/part1',{recursive:true});fs.writeFileSync(output,out);
console.log(JSON.stringify({source,output,sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),outputBytes:out.length,originalBinaryPrefixUnchanged:out.subarray(28+json.length,28+json.length+binary.length).equals(binary),reports,approved:false},null,2));
