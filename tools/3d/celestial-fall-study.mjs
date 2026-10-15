// Review-only grounded collapse. Flight height belongs to the game, not this GLB.
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../../vendor/three/three.module.js';
const source='art/review/part1/celestial-response-study.glb', output='art/review/part1/celestial-fall-study.glb';
const bytes=fs.readFileSync(source),jn=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+jn)),bin=bytes.subarray(28+jn,28+jn+bytes.readUInt32LE(20+jn));
const p=j.meshes[0].primitives[0],meshNode=j.nodes.findIndex(n=>n.name==='Boss_Mesh'),pivot=j.nodes.findIndex(n=>n.name==='KitMechanicalMotion');
if(p.targets.length!==4||pivot<0)throw Error('Expected v92 response source');
function read(index){const a=j.accessors[index],v=j.bufferViews[a.bufferView],dim={SCALAR:1,VEC3:3,VEC4:4}[a.type],size=a.componentType===5123?2:4;return Array.from({length:a.count*dim},(_,i)=>{const o=(v.byteOffset||0)+(a.byteOffset||0)+Math.floor(i/dim)*(v.byteStride||dim*size)+i%dim*size;return a.componentType===5126?bin.readFloatLE(o):size===2?bin.readUInt16LE(o):bin.readUInt32LE(o);});}
const chunks=[bin];let length=bin.length;
function add(values,type){const dim={SCALAR:1,VEC3:3,VEC4:4}[type],data=Buffer.from(new Float32Array(values).buffer),view=j.bufferViews.length,index=j.accessors.length,min=Array(dim).fill(Infinity),max=Array(dim).fill(-Infinity);for(let i=0;i<values.length;i++){min[i%dim]=Math.min(min[i%dim],values[i]);max[i%dim]=Math.max(max[i%dim],values[i]);}j.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length});chunks.push(data);length+=data.length;j.accessors.push({bufferView:view,componentType:5126,count:values.length/dim,type,min,max});return index;}
const pos=read(p.attributes.POSITION),normal=read(p.attributes.NORMAL),ix=read(p.indices),smooth=(a,b,x)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u);};
// Bend the lower appendages before body contact, retaining connected surfaces.
const deformed=[],delta=[],blend=[];
for(let i=0;i<pos.length;i+=3){const [x,y,z]=pos.slice(i,i+3),v=new T.Vector3(x,y,z),leg=(1-smooth(1.12,1.65,y))*(1-smooth(.24,.48,Math.abs(x))),arm=(1-smooth(1.8,2.5,y))*smooth(.24,.40,Math.abs(x))*(1-smooth(.70,.90,Math.abs(x)))*smooth(.8,1.2,y);
 const bend=(hinge,angle)=>new T.Vector3(x,y-hinge,z).applyAxisAngle(new T.Vector3(1,0,0),angle).add(new T.Vector3(0,hinge,0));
 const lower=bend(1.25,leg*.78),upper=bend(2.4,arm*.42);
 v.copy(lower).add(upper).sub(new T.Vector3(x,y,z));
 deformed.push(...v.toArray());delta.push(v.x-x,v.y-y,v.z-z);blend.push(Math.min(1,leg+arm));
}
const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(deformed,3));geom.setIndex(ix);geom.computeVertexNormals();const nn=geom.attributes.normal,dn=normal.map((v,i)=>(nn.getComponent(Math.floor(i/3),i%3)-v)*blend[Math.floor(i/3)]);
p.targets.push({POSITION:add(delta,'VEC3'),NORMAL:add(dn,'VEC3')});geom.dispose();
j.meshes[0].weights=[0,0,0,0,0];j.meshes[0].extras.targetNames.push('AppendageYield');
for(const a of j.animations)for(const c of a.channels)if(c.target.path==='weights'){const s=a.samplers[c.sampler],old=read(s.output),values=[];for(let i=0;i<old.length;i+=4)values.push(...old.slice(i,i+4),0);s.output=add(values,'SCALAR');}
function curve(keys,t){for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){const a=keys[i-1],b=keys[i],u=smooth(a[0],b[0],t);return a.slice(1).map((v,k)=>v+(b[k+1]-v)*u);}return keys.at(-1).slice(1);}
// Loss of balance -> wing brace -> lower torso contact -> right wing settling.
// Forward, asymmetric collapse rather than a rigid backwards T-pose.
const weights=[[0,0,0,0,0,0],[.16,.35,0,.08,0,.06],[.5,.12,0,.4,0,.42],[.85,0,.7,.35,0,.7],[1.18,0,.32,.5,0,.92],[1.44,.5,0,.36,0,1],[1.70,.66,0,.5,0,1],[2.15,.68,0,.66,0,1],[2.6,.68,0,.66,0,1]];
const rotation=[[0,0,0,0],[.16,.04,0,-.08],[.5,.25,.03,-.24],[.85,.72,.08,-.19],[1.18,1.38,.12,.08],[1.30,1.43,.12,.11],[1.44,1.37,.12,.16],[1.70,1.46,.12,.18],[2.15,1.46,.12,.18],[2.6,1.46,.12,.18]];
// Support switches from feet to wing/torso between keys. Dense baking avoids
// interpolating a lifted body across that contact switch.
const times=[...new Set([...Array.from({length:625},(_,i)=>i/240),...weights.map(k=>k[0]),...rotation.map(k=>k[0])])].sort((a,b)=>a-b),morphs=p.targets.slice(0,4).map(t=>read(t.POSITION));morphs.push(delta);
const translations=[],qs=[],ws=[],v=new T.Vector3();let maxSupportChange=0,previousSupport=0;
for(const t of times){const w=curve(weights,t),q=new T.Quaternion().setFromEuler(new T.Euler(...curve(rotation,t)));let low=Infinity;
 for(let i=0;i<pos.length;i+=3){v.fromArray(pos,i);for(let k=0;k<5;k++){v.x+=morphs[k][i]*w[k];v.y+=morphs[k][i+1]*w[k];v.z+=morphs[k][i+2]*w[k];}v.applyQuaternion(q);low=Math.min(low,v.y);}
 // Source floor is -0.000289m. Track the actual surface, not bind-pose bounds.
 const support=-low-.00028885697247460485;
 translations.push(0,support,0);qs.push(...q.toArray());ws.push(...w);maxSupportChange=Math.max(maxSupportChange,Math.abs(support-previousSupport));previousSupport=support;
}
const input=add(times,'SCALAR');j.animations.push({name:'death',samplers:[{input,output:add(ws,'SCALAR'),interpolation:'LINEAR'},{input,output:add(qs,'VEC4'),interpolation:'LINEAR'},{input,output:add(translations,'VEC3'),interpolation:'LINEAR'}],channels:[{sampler:0,target:{node:meshNode,path:'weights'}},{sampler:1,target:{node:pivot,path:'rotation'}},{sampler:2,target:{node:pivot,path:'translation'}}]});
j.extras={...j.extras,reviewOnly:true,fallStudy:'grounded asymmetric forward collapse; game flight-height handoff and awakened form not approved',deathContacts:{footYield:.5,wingBrace:1.18,lowerTorso:1.44,settled:2.15}};j.buffers[0].byteLength=length;
let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+length,8);head.writeUInt32LE(json.length,12);head.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(length,0);bh.writeUInt32LE(0x004e4942,4);const out=Buffer.concat([head,json,bh,...chunks]);fs.writeFileSync(output,out);console.log(JSON.stringify({source,output,sha256:crypto.createHash('sha256').update(out).digest('hex'),maxSupportChange,clips:j.animations.map(a=>a.name),approved:false},null,2));
