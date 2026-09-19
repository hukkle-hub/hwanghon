/* 던전 04 보스 «과부하 계전기» — 절차적 강체 리그 (pump-boss.js 와 같은 방식, GLB 로 교체 가능).
   실루엣: 애자 기둥 위에 올라앉은 탑. 좌우 접점 팔(ContactL/R)이 파괴 부위, 가슴의 방전 코일이 약점.
   부위 노드 이름은 arenas.relay.parts3d / pieces:'nodes' 와 맞춘다. */
import * as T from '../vendor/three/three.module.js';
export function createRelayBoss(){
 const scene=new T.Group();scene.name='RelayRig';
 const steel=new T.MeshStandardMaterial({color:0x6a707c,roughness:.5,metalness:.7});
 const ceramic=new T.MeshStandardMaterial({color:0x9a8f7e,roughness:.75,metalness:.1});
 const copper=new T.MeshStandardMaterial({color:0xb07a44,roughness:.45,metalness:.8});
 const arc=new T.MeshStandardMaterial({color:0x9ad8ff,emissive:0x2f7fc0,emissiveIntensity:1.4,roughness:.25,metalness:.4});
 function joint(name,parent,pos){const j=new T.Group();j.name=name;j.position.set(...pos);parent.add(j);return j;}
 function box(parent,size,pos,mat=steel){const m=new T.Mesh(new T.BoxGeometry(...size),mat);m.position.set(...pos);parent.add(m);return m;}
 function cyl(parent,rt,rb,h,pos,mat=steel,seg=12){const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);m.position.set(...pos);parent.add(m);return m;}
 function ring(parent,r,t,pos,mat=steel){const m=new T.Mesh(new T.TorusGeometry(r,t,6,18),mat);m.rotation.x=Math.PI/2;m.position.set(...pos);parent.add(m);return m;}

 const hips=joint('Hips',scene,[0,.9,0]);
 /* 받침: 콘크리트 기초 + 다리 네 개 */
 box(hips,[2.6,.45,2.0],[0,-.72,0],ceramic);
 for(const sx of [-1,1])for(const sz of [-1,1]) box(hips,[.3,.7,.3],[sx*1.0,-.3,sz*.7]);

 const spine=joint('Spine',hips,[0,.95,0]);
 /* 애자 기둥: 접시 네 장이 겹친 기둥 */
 cyl(spine,.5,.62,1.7,[0,0,0]);
 for(let i=0;i<4;i++) ring(spine,.62-i*.04,.09,[0,-.65+i*.45,0],ceramic);

 /* 약점: 가슴 방전 코일 */
 const nucleus=joint('Core',spine,[0,.15,.6]);
 cyl(nucleus,.3,.3,.5,[0,0,0],arc);
 ring(nucleus,.34,.06,[0,.22,0],copper);
 ring(nucleus,.34,.06,[0,-.22,0],copper);

 /* 머리: 계기함 */
 const head=joint('Head',spine,[0,1.15,0]);
 box(head,[1.0,.42,.75],[0,0,0]);
 box(head,[.66,.14,.08],[0,.06,.42],arc);
 for(const sx of [-1,1]) cyl(head,.05,.05,.5,[sx*.38,.42,0],copper,8);

 /* 접점 팔 두 개 — 파괴 부위 */
 for(const [name,side] of [['ContactL',-1],['ContactR',1]]){
  const armJoint=joint(name,spine,[side*.78,.62,0]);
  const piece=joint('piece_'+name.toLowerCase(),armJoint,[0,0,0]);
  box(piece,[1.0,.34,.38],[side*.5,0,0],copper);
  cyl(piece,.16,.2,.9,[side*.95,-.45,0]);
  ring(piece,.26,.07,[side*.95,-.9,0],ceramic);
  box(piece,[.22,.22,.22],[side*.95,-1.15,0],arc);
 }
 /* 뒤쪽 방열판 */
 for(let i=-1;i<=1;i++) box(spine,[.12,1.1,.5],[i*.34,.1,-.62],steel);

 const animations=[];
 const track=(name,path,times,values)=>new T.NumberKeyframeTrack(name+'.'+path,times,values);
 const clip=(name,dur,tracks)=>animations.push(new T.AnimationClip(name,dur,tracks));

 clip('idle',2.4,[track('Spine','rotation[z]',[0,1.2,2.4],[0,.03,0]),track('Core','scale[y]',[0,1.2,2.4],[1,1.12,1])]);
 clip('walk',.9,[track('Hips','position[y]',[0,.22,.45,.68,.9],[.9,.99,.9,.99,.9]),track('Spine','rotation[z]',[0,.45,.9],[0,.06,0])]);
 /* 내려찍기: 오른 접점을 들었다가 내리친다 */
 clip('atk_slam',1.5,[track('ContactR','rotation[x]',[0,.42,.7,.95,1.5],[0,-1.9,.7,.35,0]),track('Spine','rotation[x]',[0,.42,.7,1.5],[0,-.2,.28,0])]);
 /* 방전: 코일이 부풀었다가 터진다 */
 clip('atk_arc',1.4,[track('Core','scale[x]',[0,.5,.68,.8,1.4],[1,1.7,2.1,1,1]),track('Core','scale[z]',[0,.5,.68,.8,1.4],[1,1.7,2.1,1,1]),track('Spine','position[y]',[0,.5,.68,1.4],[.95,1.05,.88,.95])]);
 /* 회전 쓸기: 양 접점을 펼치고 돈다 */
 clip('atk_sweep',1.8,[track('Spine','rotation[y]',[0,.5,.95,1.35,1.8],[0,-.7,2.3,5.0,Math.PI*2]),track('ContactL','rotation[z]',[0,.5,1.4,1.8],[0,-.5,-.5,0]),track('ContactR','rotation[z]',[0,.5,1.4,1.8],[0,.5,.5,0])]);
 /* 과부하: 기둥이 솟았다 주저앉으며 전역 방전 */
 clip('atk_surge',2.1,[track('Spine','position[y]',[0,.85,1.1,1.4,2.1],[.95,1.35,.62,.82,.95]),track('Core','scale[y]',[0,.85,1.1,2.1],[1,1.6,2.2,1]),track('Head','rotation[x]',[0,.85,1.1,2.1],[0,-.35,.3,0])]);
 for(const name of ['hit','stagger']) clip(name,.65,[track('Spine','rotation[z]',[0,.15,.35,.65],[0,.17,-.09,0])]);
 clip('down',.7,[track('Hips','position[y]',[0,.7],[.9,.4]),track('Spine','rotation[x]',[0,.7],[0,.34])]);
 clip('up',.8,[track('Hips','position[y]',[0,.8],[.4,.9]),track('Spine','rotation[x]',[0,.8],[.34,0])]);
 clip('death',1.7,[track('Hips','position[y]',[0,.8,1.7],[.9,.45,.2]),track('Spine','rotation[z]',[0,.8,1.7],[0,.45,1.25]),track('Core','scale[x]',[0,.5,1.7],[1,.3,.05])]);
 return {scene,animations};
}
