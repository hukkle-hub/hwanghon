import * as T from '../../vendor/three/three.module.js';
import {makePoser} from './pose-eval.mjs';

// QA only. Missing bodies remain missing; a candidate never enables a live kit.
export function collectBosses(zones, fieldMonsters={}) {
  const found=new Map();
  function visit(value) {
    if (!value || typeof value!=='object') return;
    if (Array.isArray(value.bosses)) for (const b of value.bosses) {
      if (b.id && !found.has(b.id)) found.set(b.id,{id:b.id,name:b.name||b.id,model:b.model||null,ai:b.ai||'boss'});
    }
    for(const [key,item] of Object.entries(value)) if(key!=='bosses') visit(item);
  }
  visit(zones);
  // The plaza Clave is emitted by env-dungeon rather than ZONES.
  if(found.has('clave2')&&!found.has('clave'))found.set('clave',{...found.get('clave2'),id:'clave',name:'클레이브 · 광장'});
  for(const [id,b]of Object.entries(fieldMonsters))if(b.ai==='dominator')found.set(id,{id,name:b.title||b.name,model:b.body?.model||null,ai:b.ai});
  return [...found.values()];
}

// Reset ALL transforms between clips: an unkeyed bone must not retain the
// previous death pose. Evaluate tracks directly, not a paused mixer snapshot.
export function createReviewPoser(root, clips) {
  const rest=[];root.traverse(o=>rest.push({o,p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone(),m:o.morphTargetInfluences?.slice()}));
  const poses=new Map(clips.map(c=>[c.name,makePoser(root,c)]));
  return (name,time)=>{
    for(const {o,p,q,s,m} of rest){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);if(m)o.morphTargetInfluences.splice(0,m.length,...m);}
    root.updateMatrixWorld(true);poses.get(name)?.(time);
    root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
  };
}

// getVertexPosition includes skin/morph deformation; cached bind-pose boxes do
// not. This also refreshes raycast bounds after seeking.
export function surfaceBounds(root) {
  const all=new T.Box3(),p=new T.Vector3();root.updateMatrixWorld(true);
  root.traverse(o=>{
    if(!o.isMesh||!o.geometry.attributes.position)return;
    const local=new T.Box3();
    for(let i=0;i<o.geometry.attributes.position.count;i++){
      o.getVertexPosition(i,p);local.expandByPoint(p);all.expandByPoint(p.clone().applyMatrix4(o.matrixWorld));
    }
    if(o.isSkinnedMesh){o.boundingBox=local;o.boundingSphere=local.getBoundingSphere(new T.Sphere());}
  });
  return all;
}

export function fitDistance(radius,fov,aspect) {
  if(!(radius>0&&fov>0&&fov<180&&aspect>0))throw Error('Invalid review framing');
  const half=T.MathUtils.degToRad(fov/2),limit=Math.min(half,Math.atan(Math.tan(half)*aspect));
  return radius/Math.sin(limit)*1.1;
}

export function skillClipTime(skill,ms,duration) {
  // Nominal (zero jitter shift) server clock -> clip clock. A cue can hold or
  // retime a contact, so a raw millisecond marker would inspect a wrong pose.
  if(!skill?.cue)return Math.min(duration,Math.max(0,ms/1000));
  const pts=skill.cue;let u=pts.at(-1)[1];
  if(ms<=pts[0][0])u=pts[0][1];
  else for(let i=1;i<pts.length;i++)if(ms<=pts[i][0]){const [a,x]=pts[i-1],[b,y]=pts[i];u=x+(y-x)*(ms-a)/Math.max(1,b-a);break;}
  return Math.max(0,Math.min(duration,u*duration));
}
export function hitFrames(skill,duration=Infinity) {
  return (skill?.hits||[]).flatMap((hit,i)=>[
    {label:`${i+1}타 직전`,time:skillClipTime(skill,Math.max(0,hit.at-1000/30),duration)},
    {label:`${i+1}타 접촉`,time:skillClipTime(skill,hit.at,duration)},
    {label:`${i+1}타 직후`,time:skillClipTime(skill,hit.at+1000/30,duration)},
  ]);
}
