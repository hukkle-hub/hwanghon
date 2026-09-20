/* Art-independent rigid mechanical rig. Replace this factory with a GLB later. */
import * as T from '../vendor/three/three.module.js';
export function createPumpBoss(){
 const scene=new T.Group();scene.name='PumpRig';
 const steel=new T.MeshStandardMaterial({color:0x586767,roughness:.55,metalness:.65});
 const rust=new T.MeshStandardMaterial({color:0x765743,roughness:.85,metalness:.3});
 const core=new T.MeshStandardMaterial({color:0x7de0b6,emissive:0x276c50,emissiveIntensity:1.2,roughness:.3,metalness:.45});
 function joint(name,parent,pos){const j=new T.Group();j.name=name;j.position.set(...pos);parent.add(j);return j;}
 function box(parent,size,pos,mat=steel){const m=new T.Mesh(new T.BoxGeometry(...size),mat);m.position.set(...pos);parent.add(m);return m;}
 function cylinder(parent,r,h,pos,mat=steel){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,12),mat);m.position.set(...pos);parent.add(m);return m;}
 const hips=joint('Hips',scene,[0,1,0]),spine=joint('Spine',hips,[0,.75,0]);
 cylinder(spine,.78,1.6,[0,0,0]);box(hips,[2.2,.5,1.6],[0,-.7,0],rust);
 for(const side of [-1,1]){for(const z of [-.65,.65]){const leg=joint('Support'+side+z,hips,[side*.9,-.65,z]);box(leg,[.35,.65,.5],[0,-.15,0]);}}
 const nucleus=joint('Core',spine,[0,.1,.65]);cylinder(nucleus,.32,.65,[0,0,0],core);
 const head=joint('Head',spine,[0,1.02,0]);box(head,[.95,.28,.7],[0,0,0]);box(head,[.6,.12,.1],[0,0,.4],core);
 for(const [name,side] of [['Intake',-1],['Exhaust',1]]){
  const arm=joint(name,spine,[side*.85,.5,0]);const piece=joint('piece_'+name.toLowerCase(),arm,[0,0,0]);
  box(piece,[1.1,.4,.45],[side*.45,0,0],rust);cylinder(piece,.34,1.2,[side*.85,-.55,0]);
  const rim=new T.Mesh(new T.TorusGeometry(.35,.07,6,16),steel);rim.rotation.x=Math.PI/2;rim.position.set(side*.85,-1.1,0);piece.add(rim);
 }
 for(const y of [-.5,.5]){const band=new T.Mesh(new T.TorusGeometry(.8,.07,6,20),rust);band.rotation.x=Math.PI/2;band.position.y=y;spine.add(band);}
 const animations=[];
 function track(name,path,times,values){return new T.NumberKeyframeTrack(name+'.'+path,times,values);}
 function clip(name,dur,tracks){animations.push(new T.AnimationClip(name,dur,tracks));}
 clip('idle',2,[track('Spine','position[y]',[0,1,2],[.75,.8,.75])]);
 clip('walk',.8,[track('Hips','position[y]',[0,.2,.4,.6,.8],[1,1.07,1,1.07,1])]);
 clip('atk_hammer',1.5,[track('Intake','rotation[x]',[0,.4,.675,.9,1.5],[0,-1.8,.6,.4,0]),track('Spine','rotation[x]',[0,.4,.675,1.5],[0,-.18,.25,0])]);
 /* 연계 2타: 들어올린 흡입관을 되돌리며 반대로 후려친다 */
 clip('atk_hammer_back',1.1,[track('Intake','rotation[x]',[0,.3,.5,.75,1.1],[0,1.5,-.7,-.3,0]),track('Spine','rotation[z]',[0,.3,.5,1.1],[0,-.2,.16,0])]);
 clip('atk_bolt',1.4,[track('Exhaust','rotation[x]',[0,.35,.63,1.4],[0,-1.15,-1.5,0]),track('Spine','position[z]',[0,.35,.63,1.4],[0,-.12,.28,0])]);
 clip('atk_scythe',1.8,[track('Spine','rotation[y]',[0,.5,.9,1.3,1.8],[0,-.8,2.4,5.2,Math.PI*2])]);
 clip('atk_flame',2,[track('Spine','position[y]',[0,.8,1,1.3,2],[.75,1.1,.45,.62,.75]),track('Core','scale[x]',[0,.8,1,2],[1,1.4,1.6,1])]);
 /* 피격: 짧게 움찔한다 */
 clip('hit',.65,[track('Spine','rotation[z]',[0,.15,.35,.65],[0,.17,-.09,0])]);
 /* 자세 붕괴: 처형이 열리는 순간이다 — 피격과 «같은 클립» 이면 안 된다 (docs/design/25).
    크게 휘청이고, 앞으로 꺾이고, 팔이 늘어지고, 잔진동으로 버틴다. */
 clip('stagger',1.05,[track('Spine','rotation[z]',[0,.18,.45,.72,1.05],[0,.48,-.28,.13,0]),
   track('Spine','rotation[x]',[0,.18,.52,1.05],[0,.32,.15,0]),
   track('Hips','position[y]',[0,.18,.52,1.05],[1.0,0.87,0.94,1.0]),
   track('Head','rotation[x]',[0,.18,.52,1.05],[0,.4,.19,0]),
   track('Intake','rotation[x]',[0,.18,.52,1.05],[0,.5,.26,0]),
   track('Exhaust','rotation[x]',[0,.18,.52,1.05],[0,-.5,-.26,0])]);

 /* 쓰러짐·사망은 «가라앉는» 게 아니라 «주저앉는» 것이다 — 골반을 바닥 아래로 내리면
    리그가 통째로 지면을 뚫는다(실측: 전 보스 down 0.45~0.55m, death 0.64~1.52m, 게다가
    게임에서는 1.22배). 내려가는 양을 줄이고 기울기로 무너짐을 보인다. docs/design/24 §4 */
 clip('down',.7,[    /* 받침이 꼼짝 않고 몸통만 기울면 «경첩이 부러진 것» 처럼 보인다 (docs/design/24 §7).
       기울기 일부를 골반으로 옮겨 기계가 통째로 넘어가게 한다. 골반을 돌리면 받침
       모서리가 파고드므로 그만큼 골반을 띄운다. */
   track('Hips','position[y]',[0,.7],[1,1.0]),track('Hips','rotation[x]',[0,.7],[0,.25]),track('Spine','rotation[x]',[0,.7],[0,.5])]);
 clip('up',.8,[track('Hips','position[y]',[0,.8],[1.0,1]),track('Hips','rotation[x]',[0,.8],[.25,0]),track('Spine','rotation[x]',[0,.8],[.5,0])]);
 clip('death',1.6,[track('Hips','position[y]',[0,.8,1.6],[1,1.06,1.12]),track('Hips','rotation[x]',[0,.8,1.6],[0,.14,.3]),track('Spine','rotation[z]',[0,.8,1.6],[0,.3,.56]),track('Spine','rotation[x]',[0,.8,1.6],[0,.24,.5])]);
 return {scene,animations};
}
