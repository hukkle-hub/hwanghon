// Review-only continuation of the latest grounded collapse, preserving its source.
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../../vendor/three/three.module.js';
const source='art/review/part1/celestial-fall-study.glb',output='art/review/part1/celestial-rest-study.glb';
const bytes=fs.readFileSync(source),jn=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+jn)),bin=bytes.subarray(28+jn,28+jn+bytes.readUInt32LE(20+jn));
const p=j.meshes[0].primitives[0],meshNode=j.nodes.findIndex(n=>n.name==='Boss_Mesh'),pivot=j.nodes.findIndex(n=>n.name==='KitMechanicalMotion');
if(p.targets.length!==5||pivot<0)throw Error('Expected latest grounded collapse with five morph targets');
function read(index){const a=j.accessors[index],v=j.bufferViews[a.bufferView],dim={SCALAR:1,VEC3:3,VEC4:4}[a.type],size=a.componentType===5123?2:4;return Array.from({length:a.count*dim},(_,i)=>{const o=(v.byteOffset||0)+(a.byteOffset||0)+Math.floor(i/dim)*(v.byteStride||dim*size)+i%dim*size;return a.componentType===5126?bin.readFloatLE(o):size===2?bin.readUInt16LE(o):bin.readUInt32LE(o);});}
const chunks=[bin];let length=bin.length;
function add(values,type){const dim={SCALAR:1,VEC3:3,VEC4:4}[type],data=Buffer.from(new Float32Array(values).buffer),view=j.bufferViews.length,index=j.accessors.length,min=Array(dim).fill(Infinity),max=Array(dim).fill(-Infinity);for(let i=0;i<values.length;i++){min[i%dim]=Math.min(min[i%dim],values[i]);max[i%dim]=Math.max(max[i%dim],values[i]);}j.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length});chunks.push(data);length+=data.length;j.accessors.push({bufferView:view,componentType:5126,count:values.length/dim,type,min,max});return index;}
const pos=read(p.attributes.POSITION),ix=read(p.indices),yieldDelta=read(p.targets[4].POSITION),smooth=(a,b,x)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u);};
const axis=new T.Vector3(1,0,0),bend=(x,y,z,angle)=>new T.Vector3(x,y-2.4,z).applyAxisAngle(axis,angle).add(new T.Vector3(0,2.4,0));
function normals(positions){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(ix);g.computeVertexNormals();const n=Array.from(g.attributes.normal.array);g.dispose();return n;}
const braced=pos.map((v,i)=>v+yieldDelta[i]),braceNormals=normals(braced),armDeltas=[];
// The brace had left both arms hooked above a prone torso. Correct just that
// local bend after contact; do not relax the legs, neck, core or wing surfaces.
for(const sign of [-1,1]){
 const delta=[];
 for(let i=0;i<pos.length;i+=3){const [x,y,z]=pos.slice(i,i+3),a=x*sign>0?(1-smooth(1.8,2.5,y))*smooth(.24,.40,Math.abs(x))*(1-smooth(.70,.90,Math.abs(x)))*smooth(.8,1.2,y):0;
  const before=bend(x,y,z,a*.42),after=bend(x,y,z,-a*.08);delta.push(after.x-before.x,after.y-before.y,after.z-before.z);
 }
 const afterNormals=normals(braced.map((v,i)=>v+delta[i]));
 p.targets.push({POSITION:add(delta,'VEC3'),NORMAL:add(afterNormals.map((v,i)=>v-braceNormals[i]),'VEC3')});armDeltas.push(delta);
}
j.meshes[0].weights=[0,0,0,0,0,0,0];j.meshes[0].extras.targetNames.push('LeftArmRelease','RightArmRelease');
const death=j.animations.find(a=>a.name==='death'),wc=death.channels.find(c=>c.target.path==='weights'),rc=death.channels.find(c=>c.target.path==='rotation'),tc=death.channels.find(c=>c.target.path==='translation'),wSampler=death.samplers[wc.sampler],qSampler=death.samplers[rc.sampler],tSampler=death.samplers[tc.sampler];
const times=read(wSampler.input),oldWeights=read(wSampler.output),quaternions=read(qSampler.output),oldTranslations=read(tSampler.output),morphs=p.targets.slice(0,5).map(t=>read(t.POSITION)).concat(armDeltas),expanded=[],point=new T.Vector3(),direction=new T.Vector3();
let oldHandY=[0,0],newHandY=[0,0],handCount=[0,0],finalCaps=[];
for(let k=0;k<times.length;k++){
 const t=times[k],w=oldWeights.slice(k*5,k*5+5),q=new T.Quaternion().fromArray(quaternions,k*4),caps=[1,1];
 // Preserve the established torso/wing support. Limit each arm at its first
 // actual surface contact instead of lifting the corpse to accommodate a hand.
 for(let i=0;i<pos.length;i+=3){point.fromArray(pos,i);for(let n=0;n<5;n++){point.x+=morphs[n][i]*w[n];point.y+=morphs[n][i+1]*w[n];point.z+=morphs[n][i+2]*w[n];}const y=point.applyQuaternion(q).y+oldTranslations[k*3+1];for(let s=0;s<2;s++){const dy=direction.fromArray(armDeltas[s],i).applyQuaternion(q).y;if(dy<0)caps[s]=Math.min(caps[s],Math.max(0,(y+.00028885697247460485)/-dy));}}
 w.push(caps[0]*smooth(1.30,1.94,t),caps[1]*smooth(1.58,2.30,t));expanded.push(...w);if(k===times.length-1)finalCaps=caps;
 for(let i=0;i<pos.length;i+=3){point.fromArray(pos,i);for(let n=0;n<7;n++){point.x+=morphs[n][i]*w[n];point.y+=morphs[n][i+1]*w[n];point.z+=morphs[n][i+2]*w[n];}point.applyQuaternion(q);
  if(k===times.length-1&&Math.abs(pos[i])>.40&&Math.abs(pos[i])<.70&&pos[i+1]>1.2&&pos[i+1]<1.65){const s=pos[i]>0?1:0;newHandY[s]+=point.y;point.fromArray(pos,i);for(let n=0;n<5;n++){point.x+=morphs[n][i]*w[n];point.y+=morphs[n][i+1]*w[n];point.z+=morphs[n][i+2]*w[n];}oldHandY[s]+=point.applyQuaternion(q).y;handCount[s]++;}
 }
}
wSampler.output=add(expanded,'SCALAR');
for(const a of j.animations)if(a!==death)for(const c of a.channels)if(c.target.path==='weights'){const s=a.samplers[c.sampler],old=read(s.output),v=[];for(let i=0;i<old.length;i+=5)v.push(...old.slice(i,i+5),0,0);s.output=add(v,'SCALAR');}
j.extras={...j.extras,reviewOnly:true,armRestStudy:'independent left/right brace release after torso contact; live flight handoff and awakened form still unapproved',armRelease:{left:[1.30,1.94],right:[1.58,2.30],settled:2.30}};j.buffers[0].byteLength=length;
let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+length,8);head.writeUInt32LE(json.length,12);head.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(length,0);bh.writeUInt32LE(0x004e4942,4);const out=Buffer.concat([head,json,bh,...chunks]);fs.writeFileSync(output,out);
console.log(JSON.stringify({source,output,sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),sha256:crypto.createHash('sha256').update(out).digest('hex'),clips:j.animations.map(a=>a.name),finalContactCaps:finalCaps,relativeHandDrop:oldHandY.map((v,i)=>(v-newHandY[i])/handCount[i]),approved:false},null,2));
