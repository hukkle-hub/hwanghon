// Diagnostic only: outlines proposed paired contacts using the pure shared
// evaluator. Does not alter water, live damage, registration or animation.
import * as T from '../../vendor/three/three.module.js';
import {loadCjs} from '../../js/mmo/cjs-browser.js';
export async function createGillContactStudy(scene,skill){
 const [profile,api]=await Promise.all([
  fetch(new URL('../../art/review/part1/leviathan-gill-contact.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Contact profile unavailable');return r.json()}),
  loadCjs(new URL('../../server/field-surface-contact.cjs',import.meta.url).href),
 ]);
 const bound=api.bindSurfaceContactProfile(profile);if(!bound)throw Error('Invalid contact profile');
 const cones=bound.contacts(skill,skill.hits[0]),group=new T.Group();group.name='ReviewOnlyGillContact';
 // This review scene uses original asset coordinates. The contract is metres;
 // invert precisely the same normalization used by the real model loader.
 group.scale.setScalar(1/profile.scale);group.position.fromArray(profile.offset).multiplyScalar(-1/profile.scale);
 cones.forEach((c,i)=>{
  const points=[new T.Vector3(c.origin.x,.025,c.origin.z)];
  for(let j=0;j<=64;j++){
   const a=c.yaw-c.angle/2+c.angle*j/64;
   points.push(new T.Vector3(c.origin.x+Math.sin(a)*c.range,.025,c.origin.z+Math.cos(a)*c.range));
  }
  points.push(points[0].clone());
  const color=i?0xffb449:0x56eaff;
  group.add(new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color})));
  group.add(new T.Line(new T.BufferGeometry().setFromPoints([
   new T.Vector3(c.origin.x,c.origin.y,c.origin.z),points[0],
   new T.Vector3(c.origin.x+Math.sin(c.yaw)*c.range,.025,c.origin.z+Math.cos(c.yaw)*c.range),
  ]),new T.LineBasicMaterial({color})));
 });
 group.visible=false;scene.add(group);
 return{group,cones,contains:p=>api.containsSurfaceContact(cones,p),dispose(){group.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});group.removeFromParent()}};
}
