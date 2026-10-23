// Offline study, never a live asset. Keep the entire prior GLB and its twelve
// clips byte-for-byte; append retargeted local CMU takes for visual evaluation.
import fs from 'node:fs';
import path from 'node:path';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {makePoser} from './pose-eval.mjs';
import {readBVH} from './read-bvh.mjs';
import {clearWeaponFloor} from './weapon-floor-solve.mjs';
const source='art/review/part1/park-combat-shoulder-study.glb';
const out=process.argv[2]||'art/review/part1/park-mocap-study.glb';
const coherentCoat=process.argv.includes('--coherent-coat');
const legWeights=process.argv.includes('--leg-weights');
const armedSupport=process.argv.includes('--armed-support');
if([source,'art/review/part1/park-recovered.glb','art/review/part1/park-combat-candidate.glb'].some(p=>path.resolve(p)===path.resolve(out)))throw Error('Immutable source');
const raw=fs.readFileSync(source),jl=raw.readUInt32LE(12),json=JSON.parse(raw.toString('utf8',20,20+jl)),bin=raw.subarray(28+jl,28+jl+raw.readUInt32LE(20+jl));
const loader=new GLTFLoader();loader.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));
const gl=await loader.parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
const nodes={};let mesh;gl.scene.traverse(n=>{if(n.name)nodes[n.name]=n;if(n.isSkinnedMesh&&!mesh)mesh=n;});
const names=json.skins[0].joints.map(i=>json.nodes[i].name);
const rest=Object.fromEntries(names.map(n=>[n,{p:nodes[n].position.clone(),q:nodes[n].quaternion.clone()}]));
const guardPose=makePoser(gl.scene,gl.animations.find(c=>c.name==='idle_park'));
guardPose(0);const guard=Object.fromEntries(names.map(n=>[n,{p:nodes[n].position.clone(),q:nodes[n].quaternion.clone()}]));
const world=n=>nodes[n].getWorldPosition(new T.Vector3());
const update=()=>gl.scene.updateMatrixWorld(true);
function reset(){for(const n of names){nodes[n].position.copy(rest[n].p);nodes[n].quaternion.copy(rest[n].q);}update();}
function worldQ(n,q){const parent=nodes[n].parent.getWorldQuaternion(new T.Quaternion());nodes[n].quaternion.copy(parent.invert().multiply(q));update();}
function aim(n,child,d){
 const from=world(child).sub(world(n)).normalize(),parent=nodes[n].parent.getWorldQuaternion(new T.Quaternion());
 nodes[n].quaternion.premultiply(parent.clone().invert().multiply(new T.Quaternion().setFromUnitVectors(from,d.clone().normalize())).multiply(parent));update();
}
function settle(){const p=new T.Vector3();let min=Infinity;for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);min=Math.min(min,p.y);}nodes.Root.position.y-=min;update();return min;}
const chunks=[bin];let length=bin.length;
function acc(v,type){const data=Buffer.from(new Float32Array(v).buffer);if(length%4){const pad=4-length%4;chunks.push(Buffer.alloc(pad));length+=pad;}const vi=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length});chunks.push(data);length+=data.length;const count=v.length/({SCALAR:1,VEC3:3,VEC4:4}[type]);json.accessors.push({bufferView:vi,componentType:5126,count,type,...(type==='SCALAR'?{min:[Math.min(...v)],max:[Math.max(...v)]}:{})});return json.accessors.length-1;}
if(legWeights){
 // Separate study: restore actual hip/knee articulation below the pelvis.
 // The old height-only skin never assigned a vertex to either thigh. This
 // does not solve coat topology; retain it as an unapproved diagnostic rig.
 const smooth=(a,b,v)=>{const u=Math.max(0,Math.min(1,(v-a)/(b-a)));return u*u*(3-2*u);};
 const p=mesh.geometry.attributes.position,oldI=mesh.geometry.attributes.skinIndex,oldW=mesh.geometry.attributes.skinWeight,indices=[],weights=[];
 for(let i=0;i<p.count;i++){
  const y=p.getY(i),x=p.getX(i),replace=(1-smooth(.90,1.03,y))*(1-smooth(.25,.37,Math.abs(x))*smooth(.64,.76,y));
  const map=new Map(),put=(j,w)=>map.set(j,(map.get(j)||0)+w);
  for(let k=0;k<4;k++)put(oldI.getComponent(i,k),oldW.getComponent(i,k)*(1-replace));
  const hip=smooth(.80,.98,y),thigh=smooth(.32,.66,y),calf=smooth(.10,.22,y),left=smooth(-.13,.13,x);
  put(names.indexOf('Hips'),replace*hip);
  for(const[s,side]of [['L',left],['R',1-left]])for(const[n,w]of [['Thigh',thigh],['Calf',(1-thigh)*calf],['Foot',(1-thigh)*(1-calf)]])put(names.indexOf(s+n),replace*(1-hip)*side*w);
  const list=[...map].filter(([,w])=>w>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=list.reduce((s,[,w])=>s+w,0);while(list.length<4)list.push([0,0]);
  indices.push(...list.map(([j])=>j));weights.push(...list.map(([,w])=>w/sum));
 }
 const wi=acc(weights,'VEC4'),data=Buffer.from(new Uint16Array(indices).buffer),vi=json.bufferViews.length;
 json.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length});chunks.push(data);length+=data.length;
 const ji=json.accessors.length;json.accessors.push({bufferView:vi,componentType:5123,count:p.count,type:'VEC4'});
 json.meshes[0].primitives[0].attributes.JOINTS_0=ji;json.meshes[0].primitives[0].attributes.WEIGHTS_0=wi;
 mesh.geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));mesh.geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
}
const configs=[['getup_back_park_mocap','mo_getup_back',0,.65],['getup_face_park_mocap','mo_getup_face',0,.65],['dodge_park_mocap','mo_duck',.2,.45]];
// Fully weighted descendants transform rigidly with the forearm. Include their
// skin points, not only the weapon: the old weapon-only solve buried fingers.
const attachedVertices=[];
if(armedSupport){const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;for(let i=0;i<si.count;i++){let sum=0;for(let k=0;k<4;k++)if(['RForearm','RHand','RFingers'].includes(names[si.getComponent(i,k)]))sum+=sw.getComponent(i,k);if(sum>.9999)attachedVertices.push(i);}}
const reports=[];
for(const[name,file,intro,recovery]of configs){
 const src=readBVH(fs.readFileSync('art/3d/mocap/'+file+'.bvh','utf8'));
 const sw=n=>src.byName[n].getWorldPosition(new T.Vector3()),dir=(a,b)=>sw(b).sub(sw(a));
 // Segment-length ratio rather than clip's first root height: getup starts on
 // the floor and must not be inflated to standing height.
 const targetLeg=rest.RCalf.p.length()+rest.RFoot.p.length();
 const sourceLeg=src.byName.rtibia.position.length()+src.byName.rfoot.position.length();
 const scale=targetLeg/sourceLeg,duration=intro+src.duration+recovery;
 const values=Object.fromEntries(names.map(n=>[n,{p:[],q:[]}])),times=[];let maxSettlement=0,maxArmCorrection=0,unclearedSamples=0;
 function retarget(t){
  src.pose(t);reset();nodes.Hips.position.copy(sw('root').multiplyScalar(scale));
  const x=dir('rfemur','lfemur').normalize(),y=dir('root','thorax');y.addScaledVector(x,-y.dot(x)).normalize();const z=new T.Vector3().crossVectors(x,y).normalize();y.crossVectors(z,x).normalize();
  worldQ('Hips',new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z)));
  for(const[n,child,a,b]of [['Spine','Chest','lowerback','thorax'],['Chest','Neck','thorax','lowerneck'],['Neck','Head','lowerneck','head']])aim(n,child,dir(a,b));
  worldQ('Head',nodes.Neck.getWorldQuaternion(new T.Quaternion()));
  for(const[s,l]of [['R','r'],['L','l']]){
   aim(s+'Arm',s+'Forearm',dir(l+'humerus',l+'radius'));aim(s+'Forearm',s+'Hand',dir(l+'radius',l+'wrist'));
   nodes[s+'Hand'].quaternion.copy(guard[s+'Hand'].q);nodes[s+'Fingers'].quaternion.copy(guard[s+'Fingers'].q);
   aim(s+'Thigh',s+'Calf',dir(l+'femur',l+'tibia'));aim(s+'Calf',s+'Foot',dir(l+'tibia',l+'foot'));
   const forward=dir(l+'foot',l+'toes').normalize(),up=dir(l+'foot',l+'tibia').normalize(),right=new T.Vector3().crossVectors(up,forward).normalize();up.crossVectors(forward,right).normalize();
   worldQ(s+'Foot',new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,forward)));
  }
  if(!coherentCoat){for(const s of ['R','L']){
   const hips=nodes.Hips.getWorldQuaternion(new T.Quaternion()),thigh=nodes[s+'Thigh'].getWorldQuaternion(new T.Quaternion()),calf=nodes[s+'Calf'].getWorldQuaternion(new T.Quaternion());
   worldQ(s+'Coat',hips.clone().slerp(thigh,.7));worldQ(s+'Hem',thigh.clone().slerp(calf,.45));
  }}else{
  // The recovered coat is welded across the centre seam. Independent leg
  // twists tear that seam. Use one shared cloth frame; support legs remain
  // independent. This is a study, not a cloth simulation or visual approval.
  const hips=nodes.Hips.getWorldQuaternion(new T.Quaternion());
  const cloth=nodes.RThigh.getWorldQuaternion(new T.Quaternion()).slerp(nodes.LThigh.getWorldQuaternion(new T.Quaternion()),.5);
  const coatQ=hips.clone().slerp(cloth,.8);
  for(const s of ['R','L']){
   worldQ(s+'Coat',coatQ);
   // Rotate both bind offsets around the same hip pivot, not two separated
   // pivots: equal orientations alone still pull apart the welded seam.
   nodes[s+'Coat'].position.copy(rest[s+'Coat'].p).applyQuaternion(nodes[s+'Coat'].quaternion);update();
   worldQ(s+'Hem',coatQ);
  }
  }
  update();
 }
 for(let f=0;f<=Math.ceil(duration*30);f++){
  const t=Math.min(duration,f/30);retarget(Math.max(0,Math.min(src.duration,t-intro)));
  let toGuard=0;if(intro&&t<intro)toGuard=1-t/intro;if(t>intro+src.duration)toGuard=(t-intro-src.duration)/recovery;
  toGuard=Math.max(0,Math.min(1,toGuard));toGuard=toGuard*toGuard*(3-2*toGuard);
  if(toGuard){for(const n of names){nodes[n].position.lerp(guard[n].p,toGuard);nodes[n].quaternion.slerp(guard[n].q,toGuard);}update();}
  maxSettlement=Math.max(maxSettlement,Math.abs(settle()));times.push(t);
  if(armedSupport){
   const inverse=nodes.RForearm.matrixWorld.clone().invert(),extraLocalPoints=attachedVertices.map(i=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse));
   const result=clearWeaponFloor({joint:nodes.RForearm,weapon:nodes.ParkDanjoe,extraLocalPoints});maxArmCorrection=Math.max(maxArmCorrection,result.angle);if(!result.cleared)unclearedSamples++;
  }
  for(const n of names){values[n].p.push(...nodes[n].position.toArray());values[n].q.push(...nodes[n].quaternion.toArray());}
 }
 const input=acc(times,'SCALAR'),samplers=[],channels=[];
 for(const n of names)for(const[prop,key,type]of [['rotation','q','VEC4'],...((coherentCoat?['Root','Hips','RCoat','LCoat']:['Root','Hips']).includes(n)?[['translation','p','VEC3']]:[])]){
  samplers.push({input,output:acc(values[n][key],type),interpolation:'LINEAR'});channels.push({sampler:samplers.length-1,target:{node:json.nodes.findIndex(q=>q.name===n),path:prop}});
 }
 // Explicit grip tracks prevent a preceding death-release clip from leaking
 // its detached-sword transform into getup/recovery.
 for(const[prop,v,type]of [['translation',[0,-.068,.055],'VEC3'],['rotation',[0,0,0,1],'VEC4']]){samplers.push({input,output:acc(times.flatMap(()=>v),type),interpolation:'LINEAR'});channels.push({sampler:samplers.length-1,target:{node:json.nodes.findIndex(n=>n.name==='ParkDanjoe'),path:prop}});}
 json.animations.push({name,samplers,channels});reports.push({clip:name,source:file,duration,sourceDuration:src.duration,sourceScale:scale,maxSettlement,maxArmCorrection,unclearedSamples,visualApproved:false});
}
json.buffers[0].byteLength=length;const jbuf=Buffer.from(JSON.stringify(json)),jp=Buffer.alloc(Math.ceil(jbuf.length/4)*4,32);jbuf.copy(jp);const bp=Buffer.concat(chunks),pad=Buffer.alloc(Math.ceil(bp.length/4)*4);bp.copy(pad);const h=Buffer.alloc(20);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+jp.length+pad.length,8);h.writeUInt32LE(jp.length,12);h.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(pad.length);bh.writeUInt32LE(0x004e4942,4);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,Buffer.concat([h,jp,bh,pad]));console.log(JSON.stringify({out,originalBinPreserved:bp.subarray(0,bin.length).equals(bin),reports},null,2));
