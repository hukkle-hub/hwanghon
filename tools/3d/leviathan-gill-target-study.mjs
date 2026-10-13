import * as T from '../../vendor/three/three.module.js';
import {loadCjs} from '../../js/mmo/cjs-browser.js';
export async function createGillTargetStudy(scene,skill){
 const [profile,contact,scenario,bodyProfile,bodyApi]=await Promise.all([
  fetch(new URL('../../art/review/part1/leviathan-gill-contact.json',import.meta.url)).then(r=>r.json()),
  loadCjs(new URL('../../server/field-surface-contact.cjs',import.meta.url).href),
  loadCjs(new URL('./gill-target-scenario.cjs',import.meta.url).href),
  fetch(new URL('../../art/review/part1/leviathan-body-footprint.json',import.meta.url)).then(r=>r.json()),
  loadCjs(new URL('./body-footprint.cjs',import.meta.url).href),
 ]);
 const bound=contact.bindSurfaceContactProfile(profile);if(!bound)throw Error('Invalid target profile');
 const cones=bound.contacts(skill,skill.hits[0]);
 const body=bodyApi.bindBodyFootprint(bodyProfile);if(!body)throw Error('Invalid body footprint');
 const bodyProbe={start:{x:Math.min(...body.hull.map(p=>p.x))-2,z:cones[0].origin.z},end:{x:0,z:cones[0].origin.z}};
 const group=new T.Group();group.name='ReviewTargets';group.scale.setScalar(1/profile.scale);
 group.position.fromArray(profile.offset).multiplyScalar(-1/profile.scale);scene.add(group);
 const geometry=new T.CapsuleGeometry(.22,.9,4,8),markers=new Map();
 const ringPoints=body.hull.map(p=>new T.Vector3(p.x,.03,p.z));ringPoints.push(ringPoints[0].clone());
 const ring=new T.Line(new T.BufferGeometry().setFromPoints(ringPoints),new T.LineBasicMaterial({color:0xa2e58d}));group.add(ring);
 for(const id of ['near','far','dodge','late','outside','body_probe']){
  const m=new T.Mesh(geometry,new T.MeshBasicMaterial({color:0xffffff}));markers.set(id,m);group.add(m);
 }
 let disposed=false;
 function clear(){group.visible=false}
 function update(t,{cancelAt=Infinity,bodyCollision=true,showBody=false}={}){
  if(disposed)return '';group.visible=true;
  ring.visible=showBody;let displacement=0;const previous=new Map();
  const constrain=bodyCollision?p=>{const q=previous.has(p.id)?body.move(previous.get(p.id),p):body.resolve(p);displacement=Math.max(displacement,q.moved);p.x=q.x;p.z=q.z;previous.set(p.id,{x:q.x,z:q.z})}:null;
  const result=scenario.runGillTargetScenario(cones,skill,t,{cancelAt,constrain,bodyProbe,strike:(p,h,at)=>({evade:at<p.dodgeUntil})});
  for(const p of result.targets){const m=markers.get(p.id),e=result.events.find(e=>e.id===p.id);
   m.position.set(p.x,.7,p.z);m.material.color.setHex(p.id==='body_probe'?0xcf83ff:e?(e.result.evade?0x45d9ff:0xff5c55):p.id==='late'?0xffd35c:0xdddddd);
  }
  const names={near:'근접',far:'원거리',dodge:'회피',late:'종료 후 진입',outside:'범위 밖',body_probe:'보라 진입'};
  return `표적 ${Math.round(t)}ms · ${t>=cancelAt?'취소됨 · ':''}`+(result.events.map(e=>`${names[e.id]} ${e.at}ms ${e.result.evade?'회피':'접촉'}`).join(' / ')||'접촉 없음')+` · 몸체 막이 ${bodyCollision?'켜짐':'꺼짐'} (최대 보정 ${displacement.toFixed(2)}m). 검수용 볼록 경계·게임 미연결`;
 }
 clear();return{group,update,clear,dispose(){if(disposed)return;disposed=true;geometry.dispose();ring.geometry.dispose();ring.material.dispose();markers.forEach(m=>m.material.dispose());group.removeFromParent()}};
}
