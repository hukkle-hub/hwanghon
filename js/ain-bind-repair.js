import * as T from '../vendor/three/three.module.js';
import {ainGripCenter,closeAinHandPoint,resolveAinGripSurface} from './ain-grip-shape.js';
import {smoothClip} from './clip-smooth.js';
const V=(...v)=>new T.Vector3(...v);
function distance(p,a,b){const d=b.clone().sub(a),t=T.MathUtils.clamp(p.clone().sub(a).dot(d)/d.lengthSq(),0,1);return p.distanceTo(a.clone().addScaledVector(d,t));}
// Ain-specific measured landmarks, metres, in the existing mesh's bind space.
// Geometry is cloned: original GLB, shared avatar geometries, UVs and textures
// are never overwritten. Must run before animation starts.
export function repairAinBind(model){
 if(model.userData.ainBindRepair)return model.userData.ainBindRepair;
 const bones={},meshes=[];model.updateWorldMatrix(true,true);
 model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;if(o.isSkinnedMesh)meshes.push(o);});
 const changed=new Map(),report={vertices:0,handVertices:0,geometries:[],grips:[],hipsRest:bones.Hips.position.clone()};
 for(const [side,sg]of [['Left',1],['Right',-1]]){
  for(const [name,p]of [['ForeArm',V(sg*.245,1.16,.012)],['Hand',V(sg*.30,.98,.022)]]){
   const b=bones[side+name],world=model.localToWorld(p.clone());b.position.copy(b.parent.worldToLocal(world));changed.set(b.name,b.position.clone());b.updateWorldMatrix(false,true);
  }
  const hand=bones[side+'Hand'],slot=bones[side+'HandSlot'];
  if(slot){slot.position.copy(ainGripCenter(side));changed.set(slot.name,slot.position.clone());}
 }
 model.updateWorldMatrix(true,true);
 for(const mesh of meshes){
  mesh.geometry=mesh.geometry.clone();report.geometries.push(mesh.geometry);
  // Bind inverses operate in mesh bind coordinates, not avatar world scale/yaw.
  mesh.skeleton.boneInverses=mesh.skeleton.bones.map(b=>b.matrixWorld.clone().premultiply(model.matrixWorld.clone().invert()).invert());
  const g=mesh.geometry,p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
  for(let i=0;i<p.count;i++){
   const v=V().fromBufferAttribute(p,i),sg=v.x>=0?1:-1,side=sg>0?'Left':'Right';
   // Sleeve/hand only. Do not reweight hanging coat tails near the hips.
   if(v.y<.83||v.y>1.38||Math.abs(v.x)<.19||Math.abs(v.z)>.13)continue;
   const start=V(sg*.1543,1.3843,.0215),elbow=V(sg*.245,1.16,.012),wrist=V(sg*.30,.98,.022),tip=V(sg*.327,.875,.035);
   const d=[distance(v,start,elbow),distance(v,elbow,wrist),distance(v,wrist,tip)];
   if(Math.min(...d)>.075)continue;
   const indices=['Arm','ForeArm','Hand'].map(n=>mesh.skeleton.bones.indexOf(bones[side+n]));
   const weights=d.map((x,j)=>Math.exp(-Math.pow(x/(j===2?.032:.048),2)));
   // Sleeve cuffs belong to the forearm; distal fingers move rigidly with hand.
   const grip=T.MathUtils.smoothstep(.99-v.y,0,.055);
   if(v.y<.99){weights[0]*=1-grip;weights[1]*=1-grip;weights[2]=Math.max(weights[2],grip);}
   const total=weights.reduce((a,b)=>a+b,0);
   for(let j=0;j<4;j++){si.setComponent(i,j,j<3?indices[j]:0);sw.setComponent(i,j,j<3?weights[j]/total:0);}
   report.vertices++;if(v.y<.96)report.handVertices++;
  }
  si.needsUpdate=true;sw.needsUpdate=true;
  // Corrective grip shapes for this fingerless rig. Curl only distal hand
  // geometry; keep a reversible open-hand base and never invent finger bones.
  if(!g.morphAttributes.position?.length){
   g.morphTargetsRelative=true;g.morphAttributes.position=[];g.morphAttributes.normal=[];
   for(const side of ['Left','Right']){
    const j=mesh.skeleton.bones.indexOf(bones[side+'Hand']),inv=mesh.skeleton.boneInverses[j],forward=inv.clone().invert(),delta=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++){
     const original=V().fromBufferAttribute(p,i),v=original.clone().applyMatrix4(inv);
     const sg=side==='Left'?1:-1;
     if(original.x*sg<.26||original.x*sg>.40||original.y<.75||original.y>1.01||Math.abs(original.z)>.12)continue;
     // Finger spread is local Z, palm thickness is local X on this asset.
     // Bend the whole connected distal region, not only high-weight vertices:
     // partial vertex selection previously left spikes across triangle edges.
     v.copy(closeAinHandPoint(v,side));
     v.applyMatrix4(forward).sub(original);delta.set(v.toArray(),i*3);
    }
    report.surfaceAdjustment=Math.max(report.surfaceAdjustment||0,resolveAinGripSurface(g,delta,inv,forward,side));
    const attr=new T.BufferAttribute(delta,3);attr.name='ain_grip_'+side.toLowerCase();g.morphAttributes.position.push(attr);
    const temp=g.clone(),positions=p.array.slice();for(let i=0;i<positions.length;i++)positions[i]+=delta[i];temp.setAttribute('position',new T.BufferAttribute(positions,3));temp.computeVertexNormals();
    const affected=new Set();for(let i=0;i<g.index.count;i+=3){const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];if(ids.some(k=>Math.abs(delta[k*3])+Math.abs(delta[k*3+1])+Math.abs(delta[k*3+2])>1e-7))ids.forEach(k=>affected.add(k));}
    const normals=new Float32Array(p.count*3),welded=new Map();
    for(const i of affected){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');let group=welded.get(key);if(!group){group={ids:[],normal:V(0,0,0)};welded.set(key,group);}group.ids.push(i);group.normal.add(V().fromBufferAttribute(temp.attributes.normal,i));}
    for(const group of welded.values()){group.normal.normalize();for(const i of group.ids)normals.set(group.normal.clone().sub(V().fromBufferAttribute(g.attributes.normal,i)).toArray(),i*3);}
    g.morphAttributes.normal.push(new T.BufferAttribute(normals,3));temp.dispose();
   }
   mesh.updateMorphTargets();report.grips.push(mesh);
  }
 }
 report.changed=changed;model.userData.ainBindRepair=report;return report;
}
/* 골반에 «한 바퀴» 를 얹는다. at 에서 회전이 정확히 끝나 정면을 보고, 그 앞은
   가속·감속(스무스스텝)이라 타격 직전이 제일 빠르다. 그 뒤는 회전 없음.
   트랙이 성기면 계단이 보이므로 균일하게 다시 뜬다. */
function spinHips(result,spin){
 const track=result.tracks.find(t=>/Hips\.quaternion$/.test(t.name));
 if(!track)return;
 const N=48,dur=result.duration,src=track.createInterpolant(),q=new T.Quaternion(),y=new T.Quaternion();
 const times=new Float32Array(N+1),values=new Float32Array((N+1)*4),full=spin.turns*Math.PI*2;
 let prev=null;
 for(let i=0;i<=N;i++){
  const t=dur*i/N,u=Math.min(1,(t/dur)/spin.at),e=u*u*(3-2*u);      /* 스무스스텝 */
  q.fromArray(Array.from(src.evaluate(t)));
  y.setFromAxisAngle(new T.Vector3(0,1,0),full*e);
  q.premultiply(y);                                                  /* 부모 공간의 Y 축 = 세계 요우 */
  if(prev&&q.dot(prev)<0)q.set(-q.x,-q.y,-q.z,-q.w);                 /* 부호 이어 붙이기 */
  times[i]=t;q.toArray(values,i*4);prev=q.clone();
 }
 track.times=times;track.values=values;
}

export function repairAinClips(clips,report){return clips.map(clip=>{
 // Reuse coherent full-body source motions, not a torso-only 360 twist.
 // Keep public clip names/durations and immutable source GLB animations.
 // skill3(피의 회전)은 «자기 클립 + 몸 회전» 으로 만든다. 예전엔 ult 소스를 빌렸는데,
 // 그 소스는 352° 를 다 돌고 «나서야» 정면을 보고 그때는 속도가 남아 있지 않았다.
 // 앵커를 쓸어 봐도 「정면(0.3 m/s)」 이나 「타격(11 m/s, 등을 보임)」 중 하나만 고를 수
 // 있었다 (docs/design/49 §8.3). 회전하며 베는 소스가 따로 없으므로 합성한다:
 // 가로 베기(skill3 자기 클립, 최고속 35.2 m/s · 판정과 +0.058)에 골반 요우 한 바퀴를
 // 얹어, 「한 바퀴를 끝내는 순간 = 베는 순간」이 되게 한다. at 은 판정(0.55)이 아니라
 // 베기의 최고속(0.61)에 맞춘다 — 쓸어 보니 그때가 판정 프레임의 정면(−2°)도, 속도
 // (10.9 m/s)도 가장 좋았다. 0.55 에 맞추면 그 순간 각속도가 0 이라 오히려 느려진다.
 const SPIN={skill3:{turns:1, at:.61}}[clip.name];
 const source=clips.find(c=>c.name===({skill4:'guard',ult:'smash'}[clip.name]))||clip;
 const result=source.clone();result.name=clip.name;
 if(source.duration!==clip.duration)for(const track of result.tracks)track.scale(clip.duration/source.duration);
 // Align the reused body's impact to the destination combat clip contact.
 // Spin finishes facing the opponent before recovery, not away at damage time.
 // Anchors are measured, not guessed: [where the impact sits in the SOURCE,
 // where combat deals damage in the DESTINATION]. ult borrows smash, whose
 // downward blow lands at .86 of the source. At the old .78 the hands were
 // drifting at 1.5 m/s on the damage frame — the ultimate dealt its damage
 // between swings. At .86 they cross it at 49.6 m/s, still facing the target.
 // tests/ult-contact.test.mjs pins it. docs/design/49-skill-motion.md
 const contact={skill3:[.98,.55],ult:[.86,.50]}[clip.name];
 if(contact&&source!==clip)for(const track of result.tracks){
  const [from,to]=contact,anchor=from*clip.duration,size=track.getValueSize();
  // Insert the time-warp corner, otherwise interpolation across it delays
  // contact when the source has sparse keys (notably the final spin key).
  const value=Array.from(track.createInterpolant().evaluate(anchor)),times=Array.from(track.times),values=Array.from(track.values);
  if(!times.some(t=>Math.abs(t-anchor)<1e-7)){let at=times.findIndex(t=>t>anchor);if(at<0)at=times.length;times.splice(at,0,anchor);values.splice(at*size,0,...value);}
  track.times=new Float32Array(times.map(t=>{const u=t/clip.duration;return clip.duration*(u<=from?u*to/from:to+(u-from)*(1-to)/(1-from));}));
  track.values=new Float32Array(values);
 }
 if(SPIN)spinHips(result,SPIN);
 result.duration=clip.duration;
 result.tracks=result.tracks.map(track=>{
  if(!track.name.endsWith('.position'))return track;
  if(report.hipsRest&&/Hips.position$/.test(track.name)&&/^(attack[123]|smash|skill[134]|ult|counter|exec)$/.test(clip.name)){
   for(let i=0;i<track.values.length;i+=3){track.values[i]=report.hipsRest.x;track.values[i+2]=report.hipsRest.z;}return track;
  }
  const p=report.changed.get(track.name.slice(0,-9));if(!p)return track;
  return new T.VectorKeyframeTrack(track.name,[0,clip.duration],[...p.toArray(),...p.toArray()]);
 });
 /* 24 fps 선형 키를 곡선으로 다시 뽑는다 — 키 자세는 그대로, 키 사이 속도만 이어진다.
    js/clip-smooth.js · docs/design/73 §4 */
 return globalThis.TW_NO_CLIP_SMOOTH?result:smoothClip(result);
});}
