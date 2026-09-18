import * as T from '../vendor/three/three.module.js';
/* Small reusable scene objects, all interaction comes from dungeon-run.js. */
export function buildDungeonProps(scene,run,scale,depth){
 const objects=[],hazards=[];
 const iron=new T.MeshStandardMaterial({color:0x49595c,roughness:.7,metalness:.5});
 const brass=new T.MeshStandardMaterial({color:0xc9a45e,roughness:.65,metalness:.5});
 function mesh(parent,g,m,pos){const o=new T.Mesh(g,m);o.position.set(...pos);o.castShadow=true;parent.add(o);return o;}
 for(const n of run.nodes){
  const root=new T.Group();root.position.set(n.x/scale,0,n.y/depth/scale);scene.add(root);
  const signal=new T.MeshBasicMaterial({color:n.kind==='checkpoint'?0x7abbd6:0xc9a45e});
  const ring=mesh(root,new T.TorusGeometry(.58,.025,5,24),signal,[0,.035,0]);ring.rotation.x=Math.PI/2;
  let wheel=null,lid=null;
  if(n.kind==='valve'){
   mesh(root,new T.CylinderGeometry(.18,.18,1.25,10),iron,[0,.63,0]);
   wheel=mesh(root,new T.TorusGeometry(.35,.065,6,16),brass,[0,1.2,.18]);
   for(let a=0;a<3;a++){const spoke=mesh(wheel,new T.BoxGeometry(.55,.035,.045),iron,[0,0,0]);spoke.rotation.z=a*Math.PI/3;}
  }else if(n.kind==='checkpoint'){
   mesh(root,new T.BoxGeometry(.8,.5,.65),iron,[0,.25,0]);mesh(root,new T.BoxGeometry(.45,.03,.4),signal,[0,.52,0]);
   mesh(root,new T.CylinderGeometry(.025,.025,1.8,5),iron,[-.48,.9,0]);mesh(root,new T.SphereGeometry(.12,8,6),signal,[-.48,1.8,0]);
  }else{
   mesh(root,new T.BoxGeometry(.7,.38,.48),iron,[0,.2,0]);lid=mesh(root,new T.BoxGeometry(.72,.08,.5),n.kind==='record'?new T.MeshStandardMaterial({color:0xd6cbaa}):brass,[0,.42,0]);
  }
  objects.push({n,root,signal,wheel,lid});
 }
 for(const h of run.hazards){
  const root=new T.Group();root.position.set(h.x/scale,.025,h.y/depth/scale);scene.add(root);
  const mat=new T.MeshBasicMaterial({color:0xdbab50,transparent:true,opacity:.25,depthWrite:false});
  const disk=mesh(root,new T.CircleGeometry(h.r/scale,32),mat,[0,0,0]);disk.rotation.x=-Math.PI/2;
  const edge=mesh(root,new T.TorusGeometry(h.r/scale,.035,5,32),new T.MeshBasicMaterial({color:0xe8b462}),[0,.02,0]);edge.rotation.x=Math.PI/2;
  const jet=mesh(root,new T.CylinderGeometry(.08,.38,1.8,8,1,true),new T.MeshBasicMaterial({color:0xa4ccb5,transparent:true,opacity:.45,side:T.DoubleSide,depthWrite:false}),[0,.9,0]);
  hazards.push({h,root,disk,edge,jet});
 }
 return {update:function(time){
  for(const o of objects){const done=run.completed(o.n.id);o.signal.color.setHex(done?0x5f987f:o.n.kind==='checkpoint'?0x7abbd6:0xc9a45e);if(o.wheel)o.wheel.rotation.z=done?Math.PI/2:0;if(o.lid)o.lid.rotation.x=done?-.8:0;}
  for(const o of hazards){const p=run.hazardPhase(o.h);o.root.visible=p!=='off';o.jet.visible=p==='active';o.disk.material.color.setHex(p==='active'?0xb74432:0xdba950);o.disk.material.opacity=p==='active'?.4:.15+.08*Math.sin(time*9);o.jet.scale.y=.9+.12*Math.sin(time*20);}
 }};
}
