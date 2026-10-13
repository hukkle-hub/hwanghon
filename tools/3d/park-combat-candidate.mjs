/* Local-only Park authoring candidate. Recovered source is never overwritten.
 * Its UE IK helper weights and wrist positions do not fit the visible mesh.
 * Fit a deform-only skeleton to the original surface; preserve all mesh/UV bytes.
 * This script does NOT register the candidate in the live boss table. */
import fs from 'node:fs';
import path from 'node:path';
import * as T from '../../vendor/three/three.module.js';
import {createRequire} from 'node:module';
const {PARK}=createRequire(import.meta.url)('../../server/field-boss-canon.cjs');
const source='art/review/part1/park-recovered.glb';
const out=process.argv[2] || 'art/review/part1/park-combat-candidate.glb';
if(path.resolve(source)===path.resolve(out))throw Error('Immutable source');
const raw=fs.readFileSync(source),jl=raw.readUInt32LE(12),j=JSON.parse(raw.toString('utf8',20,20+jl));
const bin=raw.subarray(28+jl,28+jl+raw.readUInt32LE(20+jl));
const chunks=[bin];let len=bin.length;
function acc(values,type,componentType=5126){
  const A=componentType===5123?Uint16Array:Float32Array, data=Buffer.from(new A(values).buffer);
  if(len%4){let pad=4-len%4;chunks.push(Buffer.alloc(pad));len+=pad;}
  const view=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:len,byteLength:data.length});chunks.push(data);len+=data.length;
  const count=values.length/({SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[type]);
  j.accessors.push({bufferView:view,componentType,count,type,...(type==='SCALAR'?{min:[Math.min(...values)],max:[Math.max(...values)]}:{})});return j.accessors.length-1;
}
// World-space bind landmarks, measured on the recovered mesh (metres).
const spec=[['Root',null,[0,0,0]],['Hips','Root',[0,.94,.015]],['Spine','Hips',[0,1.12,.01]],['Chest','Spine',[0,1.37,0]],['Neck','Chest',[0,1.52,.01]],['Head','Neck',[0,1.62,.015]]];
for(const [s,x]of [['R',-1],['L',1]])spec.push(
  [s+'Shoulder','Chest',[x*.165,1.43,-.012]],[s+'Arm',s+'Shoulder',[x*.22,1.39,0]],
  [s+'Forearm',s+'Arm',[x*.345,1.16,.02]],[s+'Hand',s+'Forearm',[x*.435,.925,.038]],
  [s+'Fingers',s+'Hand',[x*.448,.849,.07]],
  [s+'Thigh','Hips',[x*.13,.91,.015]],[s+'Calf',s+'Thigh',[x*.17,.49,-.005]],
  [s+'Foot',s+'Calf',[x*.18,.075,.015]],
  [s+'Coat','Hips',[x*.16,.79,-.015]],[s+'Hem',s+'Coat',[x*.235,.42,-.012]]);
const bones={},rest={},nodeIndex={},positions={};
j.nodes=[{name:'ParkMesh',mesh:0,skin:0,children:[1]}];
for(const[n,parent,p]of spec){const b=new T.Bone();b.name=n;bones[n]=b;positions[n]=new T.Vector3(...p);if(parent)bones[parent].add(b);b.position.copy(positions[n]).sub(parent?positions[parent]:new T.Vector3());rest[n]=b.position.clone();nodeIndex[n]=j.nodes.length;j.nodes.push({name:n,translation:b.position.toArray(),children:[]});if(parent)j.nodes[nodeIndex[parent]].children.push(nodeIndex[n]);}
bones.Root.updateMatrixWorld(true);j.scenes=[{nodes:[0]}];j.scene=0;
j.skins=[{skeleton:nodeIndex.Root,joints:spec.map(([n])=>nodeIndex[n]),inverseBindMatrices:acc(spec.flatMap(([n])=>bones[n].matrixWorld.clone().invert().toArray()),'MAT4')}];
const primitive=j.meshes[0].primitives[0],pa=j.accessors[primitive.attributes.POSITION],pv=j.bufferViews[pa.bufferView];
const vert=i=>new T.Vector3(...[0,1,2].map(k=>bin.readFloatLE((pv.byteOffset||0)+(pa.byteOffset||0)+i*(pv.byteStride||12)+k*4)));
const smooth=(a,b,x)=>{let t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function weights(v){
 const s=v.x<0?'R':'L',x=Math.abs(v.x),y=v.y;
 const w={};const put=(n,a)=>{if(a>0)w[n]=(w[n]||0)+a;};
 // Torso, coat skirt and legs remain independent of the arm solver.
 if(y>1.55){put('Head',1);}
 else if(y>1.48 && x<.15){let a=smooth(1.48,1.55,y);put('Neck',1-a);put('Head',a);}
 else {
  const boundary=Math.min(.22,.15+Math.max(0,1.43-y)*.20)+.06*(1-smooth(.88,1.06,y));
  const arm=smooth(boundary,boundary+.05,x)*smooth(.64,.70,y)* (1-smooth(1.48,1.55,y));
  if(arm){
   if(y>=1.10){let a=smooth(1.10,1.21,y);put(s+'Arm',arm*a);put(s+'Forearm',arm*(1-a));}
   else if(y>=.93){let a=smooth(.93,1.00,y);put(s+'Forearm',arm*a);put(s+'Hand',arm*(1-a));}
   else {let a=smooth(.80,.90,y);put(s+'Hand',arm*a);put(s+'Fingers',arm*(1-a));}
  }
  const body=1-arm;
  // The source is a single welded coat/body/boot surface. Hard height cutoffs
  // create 40x edge spikes at the hem. A continuous deformation chain is needed.
  const levels=[[0,'Foot'],[.15,'Foot'],[.26,'Calf'],[.43,'Hem'],[.70,'Coat'],[.96,'Hips'],[1.12,'Spine'],[1.35,'Chest'],[1.48,'Neck'],[1.55,'Head']];
  let k=0;while(k<levels.length-2&&y>levels[k+1][0])k++;
  const a=levels[k],b=levels[k+1],u=smooth(a[0],b[0],y),left=smooth(-.1,.1,v.x);
  for(const[n,f]of [[a[1],1-u],[b[1],u]]){
   if(['Foot','Calf','Hem','Coat'].includes(n)){put('L'+n,body*f*left);put('R'+n,body*f*(1-left));}
   else put(n,body*f);
  }
 }
 const entries=Object.entries(w).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=entries.reduce((a,e)=>a+e[1],0);
 while(entries.length<4)entries.push(['Root',0]);return entries.map(([n,w])=>[spec.findIndex(b=>b[0]===n),w/sum]);
}
let indices=[],values=[];for(let i=0;i<pa.count;i++){let w=weights(vert(i));indices.push(...w.map(a=>a[0]));values.push(...w.map(a=>a[1]));}
primitive.attributes.JOINTS_0=acc(indices,'VEC4',5123);primitive.attributes.WEIGHTS_0=acc(values,'VEC4');
// Danjoe: narrow curved black steel blade, bronze guard and wrapped hilt.
// A single rigid assembly parented to the corrected visible-hand bone.
const swordNode=j.nodes.length;j.nodes.push({name:'ParkDanjoe',translation:[0,-.068,.055],children:[]});j.nodes[nodeIndex.RHand].children.push(swordNode);
const metal=j.materials.length;j.materials.push({name:'Danjoe_dark_steel',pbrMetallicRoughness:{baseColorFactor:[.16,.17,.18,1],metallicFactor:.85,roughnessFactor:.3}});
const bronze=j.materials.length;j.materials.push({name:'Danjoe_bronze',pbrMetallicRoughness:{baseColorFactor:[.35,.23,.11,1],metallicFactor:.8,roughnessFactor:.38}});
const leather=j.materials.length;j.materials.push({name:'Danjoe_wrap',pbrMetallicRoughness:{baseColorFactor:[.028,.022,.018,1],metallicFactor:0,roughnessFactor:.8}});
function meshPart(name,geo,material,translation=[0,0,0]){
 const p=geo.attributes.position,n=geo.attributes.normal;let ps=[],ns=[];for(let i=0;i<p.count;i++){ps.push(p.getX(i),p.getY(i),p.getZ(i));ns.push(n.getX(i),n.getY(i),n.getZ(i));}
 const pos=acc(ps,'VEC3');geo.computeBoundingBox();j.accessors[pos].min=geo.boundingBox.min.toArray();j.accessors[pos].max=geo.boundingBox.max.toArray();
 let prim={attributes:{POSITION:pos,NORMAL:acc(ns,'VEC3')},material};if(geo.index)prim.indices=acc(Array.from(geo.index.array),'SCALAR',5123);
 const idx=j.meshes.length;j.meshes.push({name,primitives:[prim]});const node=j.nodes.length;j.nodes.push({name,mesh:idx,translation});j.nodes[swordNode].children.push(node);
}
meshPart('DanjoeHilt',new T.CylinderGeometry(.014,.015,.17,10).rotateX(Math.PI/2),leather);
meshPart('DanjoePommel',new T.CylinderGeometry(.02,.02,.022,10).rotateX(Math.PI/2),bronze,[0,0,-.09]);
meshPart('DanjoeGuard',new T.CylinderGeometry(.047,.045,.012,14).scale(1,1,.65).rotateX(Math.PI/2),bronze,[0,0,.093]);
const blade=new T.Shape();blade.moveTo(-.015,0);blade.lineTo(.015,0);blade.lineTo(.013,.69);blade.lineTo(-.006,.83);blade.lineTo(-.016,.70);blade.closePath();
const bg=new T.ExtrudeGeometry(blade,{depth:.005,bevelEnabled:false,steps:1});
const ap=bg.attributes.position;for(let i=0;i<ap.count;i++){const x=ap.getX(i),y=ap.getY(i),z=ap.getZ(i);ap.setXYZ(i,x+.03*(y/.83)**2,z-.0025,y+.10);}bg.computeVertexNormals();meshPart('DanjoeBlade',bg,metal);
for(let i=0;i<7;i++)meshPart('DanjoeWrap'+i,new T.TorusGeometry(.0145,.0012,4,10),bronze,[0,0,-.06+i*.02]);
// Every pose has the same grip and bind geometry. Rotation is solved as a chain,
// never by detaching the visible hand or sword to hide a bad contact.
const V=a=>new T.Vector3(...a),Y=new T.Vector3(0,1,0),X=new T.Vector3(1,0,0);
function rotate(n,axis,angle){const b=bones[n],pq=b.parent?.getWorldQuaternion(new T.Quaternion())||new T.Quaternion();b.quaternion.premultiply(pq.clone().invert().multiply(new T.Quaternion().setFromAxisAngle(axis,angle)).multiply(pq));bones.Root.updateMatrixWorld(true);}
function aim(n,c,d){const b=bones[n],from=bones[c].getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3())).normalize(),pq=b.parent.getWorldQuaternion(new T.Quaternion());b.quaternion.premultiply(pq.clone().invert().multiply(new T.Quaternion().setFromUnitVectors(from,V(d).normalize())).multiply(pq));bones.Root.updateMatrixWorld(true);}
const guard={yaw:0,lean:.035,hip:0,ra:[-.26,-.91,.31],rf:[-.04,-.42,.91],la:[.2,-.97,.1],lf:[.02,-.8,.6],nod:0};
const poses={guard,
 loadR:{...guard,yaw:-.32,lean:.1,ra:[-.48,-.78,.39],rf:[-.68,.35,.64],la:[.28,-.9,-.2]},
 cutR:{...guard,yaw:.32,lean:.1,ra:[.05,-.62,.78],rf:[.66,-.22,.72],la:[.3,-.91,-.25]},
 loadL:{...guard,yaw:.27,ra:[-.05,-.68,.72],rf:[.64,.36,.68]},
 cutL:{...guard,yaw:-.30,ra:[-.55,-.64,.54],rf:[-.73,-.23,.65]},
 fistLoad:{...guard,yaw:.25,la:[.42,-.83,-.36],lf:[-.16,.12,.98]},
 fistHit:{...guard,yaw:-.23,lean:.17,la:[.04,-.35,.94],lf:[-.04,-.1,.99]},
 brace:{...guard,hip:-.04,la:[.3,-.7,.65],lf:[-.7,.55,.45],ra:[-.32,-.9,.1],rf:[.1,.15,.98]},
 quakeLoad:{...guard,hip:-.12,lean:.25,la:[.45,-.52,.72],lf:[-.12,.82,.56]},
 quakeHit:{...guard,hip:-.22,lean:.55,la:[.23,-.97,.1],lf:[-.04,-.78,.62]},
 recoil:{...guard,lean:-.12,yaw:.1,hip:-.035},
 kneel:{...guard,hip:-.45,lean:.22,nod:.22,ra:[-.25,-.92,.3],rf:[-.1,-.8,.58]},
 salute:{...guard,hip:-.50,lean:.22,nod:.20,ra:[-.50,-.48,.72],rf:[.25,.93,-.12]},
 fall:{...guard,hip:-.50,lean:.35,collapse:1,nod:.22,ra:[-.2,-.7,.65],rf:[-.15,-.92,.35],la:[.3,-.75,.59],lf:[.2,-.94,.26]}
};
function pose(p,t=0,walk=false){
 for(const[n]of spec){bones[n].position.copy(rest[n]);bones[n].quaternion.identity();}
 bones.Hips.position.y+=p.hip||0;rotate('Hips',Y,p.yaw||0);
 rotate('Spine',X,(p.lean||0)*.45);rotate('Chest',X,(p.lean||0)*.55);rotate('Head',X,p.nod||0);
 if(p.roll)rotate('Hips',new T.Vector3(0,0,1),p.roll);
 const direction=a=>V(a).applyAxisAngle(Y,p.yaw||0).toArray();
 aim('RArm','RForearm',direction(p.ra));aim('RForearm','RHand',direction(p.rf));
 aim('LArm','LForearm',direction(p.la));aim('LForearm','LHand',direction(p.lf));
 // Flex rather than spread fingers; thumb shape remains original.
 rotate('RFingers',X,-.95);rotate('LFingers',X,-.22);
 // Two-bone leg solve to fixed sole anchors prevents hip bob from floating feet.
 for(const[s,sgn]of [['R',-1],['L',1]]){
   const hip=bones[s+'Thigh'].getWorldPosition(new T.Vector3());
   const stride=walk?Math.sin(t*2*Math.PI/1.2+(sgn===1?Math.PI:0))*.15:0;
   const foot=new T.Vector3(sgn*.18,.075+(walk?Math.max(0,Math.cos(t*2*Math.PI/1.2+(sgn===1?Math.PI:0)))*.035:0),.015+stride);
   const l1=rest[s+'Calf'].length(),l2=rest[s+'Foot'].length(),delta=foot.clone().sub(hip),dist=Math.min(delta.length(),l1+l2-.001),dir=delta.normalize();
   const along=(l1*l1-l2*l2+dist*dist)/(2*dist),h=Math.sqrt(Math.max(0,l1*l1-along*along));
   const pole=new T.Vector3(0,0,1).addScaledVector(dir,-dir.z).normalize();
   const knee=hip.clone().addScaledVector(dir,along).addScaledVector(pole,h);
   aim(s+'Thigh',s+'Calf',knee.sub(hip).toArray());
   aim(s+'Calf',s+'Foot',foot.sub(bones[s+'Calf'].getWorldPosition(new T.Vector3())).toArray());
   bones[s+'Foot'].quaternion.copy(bones[s+'Foot'].parent.getWorldQuaternion(new T.Quaternion()).invert());
   const fold=smooth(.05,.5,-(p.hip||0));
   if(fold){rotate(s+'Coat',X,-1.22*fold);rotate(s+'Hem',X,1.05*fold);}
 }
 bones.Root.updateMatrixWorld(true);
 if(p.collapse){
   // After the kneel/half-salute the body loses support and rolls onto its side.
   // Rotate around the pelvis, then settle the actual surface on the floor.
   // Do not leave fixed-foot IK propping up a supposedly dead torso.
   const pivot=bones.Hips.getWorldPosition(new T.Vector3());
   bones.Root.quaternion.setFromAxisAngle(new T.Vector3(0,0,1),p.collapse*1.48);
   bones.Root.position.copy(pivot).sub(pivot.clone().applyQuaternion(bones.Root.quaternion));
   bones.Root.updateMatrixWorld(true);
 }
}
function blend(a,b,k){const o={};for(const key of new Set([...Object.keys(a),...Object.keys(b)])){let x=a[key]??0,y=b[key]??0;o[key]=Array.isArray(x)?x.map((v,i)=>v+(y[i]-v)*k):x+(y-x)*k;}return o;}
const bindInverse=spec.map(([n])=>new T.Matrix4().makeTranslation(-positions[n].x,-positions[n].y,-positions[n].z));
const sourcePoints=Array.from({length:pa.count},(_,i)=>vert(i));
function settleCorpse(){
 const matrices=spec.map(([n],i)=>bones[n].matrixWorld.clone().multiply(bindInverse[i]));let min=Infinity;
 const p=new T.Vector3(),tmp=new T.Vector3();
 for(let i=0;i<sourcePoints.length;i++){p.set(0,0,0);for(let k=0;k<4;k++){const w=values[i*4+k];if(w)p.addScaledVector(tmp.copy(sourcePoints[i]).applyMatrix4(matrices[indices[i*4+k]]),w);}min=Math.min(min,p.y);}
 // During collapse feet may unload, but no visible body/cloth may cross the floor.
 bones.Root.position.y+=Math.max(0,-min);bones.Root.updateMatrixWorld(true);
}
const clips=[];
function bake(name,duration,keys,walk=false){
 keys=keys.map(([t,p])=>[t,typeof p==='string'?poses[p]:p]).sort((a,b)=>a[0]-b[0]);
 const times=[],qs=Object.fromEntries(spec.map(([n])=>[n,[]])),hip=[],rootP=[],swordP=[],swordQ=[];
 let releaseP=null,releaseQ=null;
 for(let i=0;i<=Math.ceil(duration*30);i++){
   const t=Math.min(duration,i/30);times.push(t);let ix=0;while(ix<keys.length-2&&t>keys[ix+1][0])ix++;
   const a=keys[ix],b=keys[Math.min(ix+1,keys.length-1)],k=b[0]===a[0]?1:Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));
   pose(blend(a[1],b[1],k*k*(3-2*k)),t,walk);if(name==='death_park_salute')settleCorpse();for(const[n]of spec)qs[n].push(...bones[n].quaternion.toArray());hip.push(...bones.Hips.position.toArray());rootP.push(...bones.Root.position.toArray());
   let sp=new T.Vector3(0,-.068,.055),sq=new T.Quaternion();
   if(name==='death_park_salute'){
    if(!releaseP||t<=.30){releaseP=sp.clone().applyMatrix4(bones.RHand.matrixWorld);releaseQ=bones.RHand.getWorldQuaternion(new T.Quaternion());}
    if(t>.30){const u=Math.min(1,(t-.30)/.5),wp=releaseP.clone().lerp(new T.Vector3(-.58,.03,.22),u*u),wq=releaseQ.clone().slerp(new T.Quaternion(),u);sp=wp.applyMatrix4(bones.RHand.matrixWorld.clone().invert());sq=bones.RHand.getWorldQuaternion(new T.Quaternion()).invert().multiply(wq);}
   }swordP.push(...sp.toArray());swordQ.push(...sq.toArray());
 }
 const input=acc(times,'SCALAR'),samplers=[],channels=[];
 for(const[n]of spec){samplers.push({input,output:acc(qs[n],'VEC4'),interpolation:'LINEAR'});channels.push({sampler:samplers.length-1,target:{node:nodeIndex[n],path:'rotation'}});}
 samplers.push({input,output:acc(hip,'VEC3'),interpolation:'LINEAR'});channels.push({sampler:samplers.length-1,target:{node:nodeIndex.Hips,path:'translation'}});
 samplers.push({input,output:acc(rootP,'VEC3'),interpolation:'LINEAR'});channels.push({sampler:samplers.length-1,target:{node:nodeIndex.Root,path:'translation'}});
 for(const[path,vs,type]of [['translation',swordP,'VEC3'],['rotation',swordQ,'VEC4']]){samplers.push({input,output:acc(vs,type),interpolation:'LINEAR'});channels.push({sampler:samplers.length-1,target:{node:swordNode,path}});}
 clips.push({name,samplers,channels});
}
bake('idle_park',2,[[0,'guard'],[1,{...guard,lean:.045}],[2,'guard']]);
bake('walk',1.2,[[0,'guard'],[1.2,'guard']],true);
bake('stagger',1.35,[[0,'guard'],[.13,'recoil'],[.5,'recoil'],[1.35,'guard']]);
bake('cancel_park',.6,[[0,'loadR'],[.22,'brace'],[.6,'guard']]);
for(const[id,s]of Object.entries(PARK.skills)){
 const keys=[[0,'guard']];for(const[i,h]of s.hits.entries()){
   const hit=h.at/1000,prev=i?s.hits[i-1].at/1000:0;
   let load=i%2?'loadL':'loadR',impact=i%2?'cutL':'cutR';
   if(/arm|quake/.test(id)){load=id==='aoe_arm_quake'?'quakeLoad':'fistLoad';impact=id==='aoe_arm_quake'?'quakeHit':'fistHit';}
   if(id==='sk_shield_panel'||id==='sk_parry_riposte')load='brace';
   keys.push([Math.max(prev+.10,hit-(i?.15:.3)),load],[hit,impact]);
 }keys.push([Math.min(s.duration/1000-.5,s.hits.at(-1).at/1000+.5),'brace'],[s.duration/1000,'guard']);bake(s.clip,s.duration/1000,keys);
}
bake('death_park_salute',5.2,[[0,'guard'],[.25,'recoil'],[1.35,'kneel'],[2.25,'salute'],[2.85,'salute'],[3.9,'fall'],[5.2,'fall']]);
j.animations=clips;j.buffers[0].byteLength=len;
const json=Buffer.from(JSON.stringify(j)),jp=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(jp);
const bp=Buffer.concat(chunks),bpad=Buffer.alloc(Math.ceil(bp.length/4)*4);bp.copy(bpad);
const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(28+jp.length+bpad.length,8);head.writeUInt32LE(jp.length,12);head.writeUInt32LE(0x4e4f534a,16);
const bh=Buffer.alloc(8);bh.writeUInt32LE(bpad.length);bh.writeUInt32LE(0x004e4942,4);
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,Buffer.concat([head,jp,bh,bpad]));
console.log(JSON.stringify({out,clips:clips.map(c=>c.name),deformBones:spec.length,originalGeometryBytesPreserved:bp.subarray(0,bin.length).equals(bin),visualApproved:false}));
