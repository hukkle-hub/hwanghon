import * as T from '../vendor/three/three.module.js';

// Shared by solo and online. These are gameplay attachments, not final boss art.
export function createTrainingParts(model,{strawMap=null,owned=null}={}) {
 const bones={},parts={},homes={};
 model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
 const iron=new T.MeshStandardMaterial({color:0x55555c,roughness:.5,metalness:.8});
 const chain=new T.MeshStandardMaterial({color:0x9a9298,roughness:.4,metalness:.9});
 const straw=new T.MeshStandardMaterial({map:strawMap,roughness:1,color:0x625741});
 for(const material of [iron,chain,straw])owned?.add(material);
 function add(id,bone,build){
  const parent=bones[bone];if(!parent)return;
  const group=new T.Group();group.name='training_piece_'+id;build(group);
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;owned?.add(o.geometry);}});
  parent.add(group);parts[id]=group;
  homes[id]={parent,position:group.position.clone(),quaternion:group.quaternion.clone(),scale:group.scale.clone()};
 }
 add('chain','Spine1',g=>{
  for(const z of [.55,-.55]){const c=new T.Mesh(new T.TorusGeometry(.5,.045,6,28),chain);c.position.set(0,.25,.05);c.rotation.set(.2,0,z);g.add(c);}
  const c=new T.Mesh(new T.TorusGeometry(.5,.04,6,24),chain);c.position.y=.05;c.rotation.x=Math.PI/2;g.add(c);
 });
 for(const [id,bone]of [['shl','LeftArm'],['shr','RightArm']])add(id,bone,g=>{
  const band=new T.Mesh(new T.CylinderGeometry(.3,.34,.16,12,1,true),iron);band.position.y=.05;g.add(band);
  // A thin backing and two plates keep the shoulder silhouette readable.
  // The previous sphere looked like a floating balloon and obscured the arm.
  const backing=new T.Mesh(new T.BoxGeometry(.36,.08,.30),straw);backing.position.y=.12;g.add(backing);
  for(let i=0;i<2;i++){const plate=new T.Mesh(new T.BoxGeometry(.40-i*.04,.055,.19),iron);plate.position.set(0,.17-i*.055,(i-.5)*.14);plate.rotation.x=(i-.5)*.18;g.add(plate);}
 });
 function sync(stageParts,{restore=false}={}){
  for(const [id,part]of Object.entries(parts)){
   const state=stageParts.find(p=>p.id===id),visible=!!state&&!state.broken;
   if(restore&&visible){const h=homes[id];h.parent.add(part);part.position.copy(h.position);part.quaternion.copy(h.quaternion);part.scale.copy(h.scale);}
   part.visible=visible;
  }
 }
 sync([]);
 return {parts,sync};
}
