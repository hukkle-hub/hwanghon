// Local, review-only articulated wing study. Never overwrites source/live asset.
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../../vendor/three/three.module.js';
const source='art/3d/part1/celestial_static.glb',output='art/review/part1/celestial-wing-study.glb';
const bytes=fs.readFileSync(source),jn=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+jn)),binary=bytes.subarray(28+jn,28+jn+bytes.readUInt32LE(20+jn));
if(j.meshes.length!==1||j.meshes[0].primitives.length!==1||j.meshes[0].primitives[0].targets)throw Error('Unexpected source');
const p=j.meshes[0].primitives[0],node=j.nodes.findIndex(n=>n.name==='Boss_Mesh');
function attr(index){const a=j.accessors[index],v=j.bufferViews[a.bufferView],dim={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5126:4,5125:4,5123:2}[a.componentType];if(!dim||!size||a.sparse)throw Error('Unsupported accessor');const values=[];for(let i=0;i<a.count;i++)for(let k=0;k<dim;k++){const o=(v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||dim*size)+k*size;values.push(a.componentType===5126?binary.readFloatLE(o):size===4?binary.readUInt32LE(o):binary.readUInt16LE(o));}return values;}
const positions=attr(p.attributes.POSITION),normals=attr(p.attributes.NORMAL),indices=attr(p.indices),n=positions.length/3;
const chunks=[binary];let length=binary.length;
function add(values,type){const dim={SCALAR:1,VEC3:3}[type],data=Buffer.from(new Float32Array(values).buffer),view=j.bufferViews.length,index=j.accessors.length;j.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length});chunks.push(data);length+=data.length;const min=Array(dim).fill(Infinity),max=Array(dim).fill(-Infinity);for(let i=0;i<values.length;i++){min[i%dim]=Math.min(min[i%dim],values[i]);max[i%dim]=Math.max(max[i%dim],values[i]);}j.accessors.push({bufferView:view,componentType:5126,count:values.length/dim,type,min,max});return index;}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const reports=[];p.targets=[];
for(const [name,fold,flap]of [['WingGather',.55,.22],['WingDrive',-.10,-.16]]){
 const delta=[],deformed=[],weights=[];let affected=0,maxShift=0;
 for(let i=0;i<n;i++){
  const [x,y,z]=positions.slice(i*3,i*3+3),side=x<0?-1:1;
  // Lower inner silhouettes belong to the hanging arms, not the wings.
  const inner=.40+.40*(1-smooth(2.35,2.9,y));
  const w=smooth(inner,inner+.70,Math.abs(x));
  const v=new T.Vector3(x-side*.32,y-3.20,z);
  v.applyAxisAngle(new T.Vector3(0,1,0),side*fold*w).applyAxisAngle(new T.Vector3(0,0,1),side*flap*w).add(new T.Vector3(side*.32,3.20,0));
  const d=[v.x-x,v.y-y,v.z-z];delta.push(...d);deformed.push(...v.toArray());weights.push(w);if(w>0)affected++;maxShift=Math.max(maxShift,Math.hypot(...d));
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(deformed,3));g.setIndex(indices);g.computeVertexNormals();const norm=g.getAttribute('normal'),dn=[];
 for(let i=0;i<n;i++)for(let k=0;k<3;k++)dn.push((norm.getComponent(i,k)-normals[i*3+k])*weights[i]);
 p.targets.push({POSITION:add(delta,'VEC3'),NORMAL:add(dn,'VEC3')});g.dispose();reports.push({name,affected,maxShift});
}
j.meshes[0].weights=[0,0];j.meshes[0].extras={...(j.meshes[0].extras||{}),targetNames:['WingGather','WingDrive']};
const keys={
 idle:[[0,0,0],[.55,.06,0],[1.1,0,0],[1.65,0,.06],[2.2,0,0]],
 stagger:[[0,0,0],[.13,.3,0],[.4,0,.16],[.9,.05,0],[1.35,0,0]],
 atk_dive:[[0,0,0],[.7,.7,0],[1.25,1,0],[1.5,1,0],[1.72,0,.85],[2.3,0,.35],[3.5,.08,0],[3.8,0,0]],
 atk_gust:[[0,0,0],[.7,.75,0],[.9,1,0],[1,0,1],[1.18,0,.65],[1.5,.8,0],[1.7,1,0],[1.8,0,1],[2.05,0,.6],[2.8,.04,0],[3.4,0,0]],
 atk_fold:[[0,0,0],[.6,.65,0],[1.4,1,0],[1.6,0,1],[1.85,.75,0],[2.05,1,0],[2.15,0,1],[2.4,.75,0],[2.6,1,0],[2.7,0,1],[3.7,0,.3],[4.5,.05,0],[4.6,0,0]],
};
function envelope(points,t){if(t<=points[0][0])return points[0].slice(1);for(let i=1;i<points.length;i++)if(t<=points[i][0]){const a=points[i-1],b=points[i],u=smooth(a[0],b[0],t);return[a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u];}return points.at(-1).slice(1);}
for(const a of j.animations){const key=keys[a.name];if(!key)throw Error('Missing wing curve '+a.name);const duration=key.at(-1)[0],times=[...new Set([...Array.from({length:Math.ceil(duration*60)+1},(_,i)=>Math.min(i/60,duration)),...key.map(k=>k[0])])].sort((a,b)=>a-b),values=times.flatMap(t=>envelope(key,t)),s=a.samplers.length;a.samplers.push({input:add(times,'SCALAR'),output:add(values,'SCALAR'),interpolation:'LINEAR'});a.channels.push({sampler:s,target:{node,path:'weights'}});}
j.extras={...(j.extras||{}),reviewOnly:true,wingStudy:'gather -> wing drive -> recovery; two visible membrane groups; not four-wing canon approval'};j.buffers[0].byteLength=length;
let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+length,8);head.writeUInt32LE(json.length,12);head.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(length,0);bh.writeUInt32LE(0x004e4942,4);const out=Buffer.concat([head,json,bh,...chunks]);fs.writeFileSync(output,out);console.log(JSON.stringify({source,output,reports,sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),outputSha256:crypto.createHash('sha256').update(out).digest('hex'),originalBinaryPrefixUnchanged:out.subarray(28+json.length,28+json.length+binary.length).equals(binary),approved:false},null,2));
