import * as T from '../../vendor/three/three.module.js';
import {loadCjs} from '../../js/mmo/cjs-browser.js';
export async function createGillTargetStudy(scene,skill){
 const [profile,contact,scenario]=await Promise.all([
  fetch(new URL('../../art/review/part1/leviathan-gill-contact.json',import.meta.url)).then(r=>r.json()),
  loadCjs(new URL('../../server/field-surface-contact.cjs',import.meta.url).href),
  loadCjs(new URL('./gill-target-scenario.cjs',import.meta.url).href),
 ]);
 const bound=contact.bindSurfaceContactProfile(profile);if(!bound)throw Error('Invalid target profile');
 const cones=bound.contacts(skill,skill.hits[0]);
 const group=new T.Group();group.name='ReviewTargets';group.scale.setScalar(1/profile.scale);
 group.position.fromArray(profile.offset).multiplyScalar(-1/profile.scale);scene.add(group);
 const geometry=new T.CapsuleGeometry(.22,.9,4,8),markers=new Map();
 for(const id of ['near','far','dodge','late','outside']){
  const m=new T.Mesh(geometry,new T.MeshBasicMaterial({color:0xffffff}));markers.set(id,m);group.add(m);
 }
 let disposed=false;
 function clear(){group.visible=false}
 function update(t,{cancelAt=Infinity}={}){
  if(disposed)return '';group.visible=true;
  const result=scenario.runGillTargetScenario(cones,skill,t,{cancelAt,strike:(p,h,at)=>({evade:at<p.dodgeUntil})});
  for(const p of result.targets){const m=markers.get(p.id),e=result.events.find(e=>e.id===p.id);
   m.position.set(p.x,.7,p.z);m.material.color.setHex(e?(e.result.evade?0x45d9ff:0xff5c55):p.id==='late'?0xffd35c:0xdddddd);
  }
  const names={near:'근접',far:'원거리',dodge:'회피',late:'종료 후 진입',outside:'범위 밖'};
  return `표적 ${Math.round(t)}ms · ${t>=cancelAt?'취소됨 · ':''}`+(result.events.map(e=>`${names[e.id]} ${e.at}ms ${e.result.evade?'회피':'접촉'}`).join(' / ')||'접촉 없음')+' · 노랑=종료 후 진입(비타격). 접촉 시각 검수이며 화면 HP/실제 게임 연동 아님';
 }
 clear();return{group,update,clear,dispose(){if(disposed)return;disposed=true;geometry.dispose();markers.forEach(m=>m.material.dispose());group.removeFromParent()}};
}
