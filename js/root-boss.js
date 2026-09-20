/* 던전 05 보스 «모근체» — 절차적 강체 리그 (relay-boss.js 와 같은 방식, GLB 로 교체 가능).
   실루엣: 갈라진 꼬투리 위에 아가리가 달린 덩이줄기. 좌우 덩굴팔(VineL/R)이 파괴 부위,
   가슴에서 빛나는 포자낭이 약점. 부위 노드 이름은 arenas.grove.parts3d / pieces:'nodes' 와 맞춘다. */
import * as T from '../vendor/three/three.module.js';
export function createRootBoss(){
 const scene=new T.Group();scene.name='RootRig';
 const bark=new T.MeshStandardMaterial({color:0x4a4030,roughness:.92,metalness:.02});
 const flesh=new T.MeshStandardMaterial({color:0x6d3a44,roughness:.7,metalness:.05});
 const leaf=new T.MeshStandardMaterial({color:0x4d6b34,roughness:.85,metalness:.02});
 const spore=new T.MeshStandardMaterial({color:0xc8e88a,emissive:0x5f8f30,emissiveIntensity:1.5,roughness:.35,metalness:.05});
 function joint(name,parent,pos){const j=new T.Group();j.name=name;j.position.set(...pos);parent.add(j);return j;}
 function box(parent,size,pos,mat=bark){const m=new T.Mesh(new T.BoxGeometry(...size),mat);m.position.set(...pos);parent.add(m);return m;}
 function cyl(parent,rt,rb,h,pos,mat=bark,seg=10){const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);m.position.set(...pos);parent.add(m);return m;}
 function ball(parent,r,pos,mat=bark,seg=12){const m=new T.Mesh(new T.SphereGeometry(r,seg,seg-2),mat);m.position.set(...pos);parent.add(m);return m;}

 const hips=joint('Hips',scene,[0,1.02,0]);
 /* 뿌리판: 바닥을 움켜쥔 굵은 뿌리 여섯 갈래 */
 ball(hips,.95,[0,-.5,0],bark).scale.set(1.5,.55,1.4);
 for(let i=0;i<6;i++){const a=i/6*Math.PI*2;
  const r=cyl(hips,.16,.06,1.5,[Math.cos(a)*1.0,-.75,Math.sin(a)*.9],bark,7);
  r.rotation.z=Math.cos(a)*.85;r.rotation.x=-Math.sin(a)*.85;}

 const spine=joint('Spine',hips,[0,.75,0]);
 /* 덩이줄기 몸통 — 위로 갈수록 벌어지는 꼬투리 */
 cyl(spine,.82,.62,1.5,[0,0,0],bark,12);
 for(let i=0;i<5;i++){const a=i/5*Math.PI*2+.3;
  const p=box(spine,[.26,1.5,.14],[Math.cos(a)*.72,.1,Math.sin(a)*.66],leaf);p.rotation.y=-a;p.rotation.x=Math.sin(a)*.16;}

 /* 약점: 가슴 포자낭 */
 const nucleus=joint('Core',spine,[0,.15,.62]);
 ball(nucleus,.34,[0,0,0],spore);
 for(let i=0;i<4;i++){const a=i/4*Math.PI*2;cyl(nucleus,.03,.05,.38,[Math.cos(a)*.22,-.16,Math.sin(a)*.22],bark,6);}

 /* 머리: 갈라지는 아가리 */
 const head=joint('Head',spine,[0,1.1,.1]);
 ball(head,.55,[0,0,0],flesh).scale.set(1,.9,1.15);
 for(const sy of [1,-1]){const jaw=box(head,[.72,.12,.62],[0,sy*.3,.12],bark);jaw.rotation.x=sy*.18;
  for(let i=-2;i<=2;i++) cyl(head,.02,.07,.3,[i*.15,sy*.2,.42],bark,5).rotation.x=sy*Math.PI/2*-1;}
 ball(head,.2,[0,0,.1],spore);

 /* 덩굴팔 둘 — 파괴 부위. 마디를 이어 붙여 «휘두르면 늘어지는» 실루엣 */
 for(const [name,side] of [['VineL',-1],['VineR',1]]){
  const armJoint=joint(name,spine,[side*.72,.5,0]);
  const piece=joint('piece_'+name.toLowerCase(),armJoint,[0,0,0]);
  let r=.22;
  for(let i=0;i<5;i++){
   const seg=cyl(piece,r*.82,r,.52,[side*(.3+i*.34),-i*.24,0],leaf,8);
   seg.rotation.z=side*Math.PI/2*0.92;r*=.82;}
  ball(piece,.2,[side*1.95,-1.0,0],flesh);           /* 끝의 혹 — 아래로 늘어진다 */
  for(let i=0;i<3;i++) cyl(piece,.02,.05,.26,[side*(1.95-i*.1),-1.14,(i-1)*.1],bark,5);
 }

 const animations=[];
 const track=(name,path,times,values)=>new T.NumberKeyframeTrack(name+'.'+path,times,values);
 const clip=(name,dur,tracks)=>animations.push(new T.AnimationClip(name,dur,tracks));

 /* 숨쉬듯 부푼다 */
 clip('idle',2.8,[track('Spine','scale[y]',[0,1.4,2.8],[1,1.05,1]),track('Core','scale[x]',[0,1.4,2.8],[1,1.14,1]),track('Head','rotation[x]',[0,1.4,2.8],[0,.07,0])]);
 clip('walk',1.1,[track('Hips','position[y]',[0,.28,.55,.83,1.1],[1.02,1.10,1.02,1.10,1.02]),track('Spine','rotation[z]',[0,.55,1.1],[0,.08,0])]);
 /* 덩굴 후려치기: 뒤로 감았다가 앞으로 채찍처럼 */
 clip('atk_lash',1.5,[track('VineR','rotation[y]',[0,.45,.72,1.0,1.5],[0,1.5,-1.9,-.5,0]),track('Spine','rotation[y]',[0,.45,.72,1.5],[0,.4,-.5,0])]);
 /* 연계 2타: 반대쪽 덩굴로 되받아친다 */
 clip('atk_lash_b',1.2,[track('VineL','rotation[y]',[0,.35,.58,.85,1.2],[0,-1.4,1.8,.45,0]),track('Spine','rotation[y]',[0,.35,.58,1.2],[0,-.36,.46,0])]);
 /* 내려찍기: 몸을 세웠다 아가리째 내리꽂는다 */
 clip('atk_slam',1.6,[track('Spine','rotation[x]',[0,.5,.78,1.05,1.6],[0,-.55,.72,.25,0]),track('Hips','position[y]',[0,.5,.78,1.6],[1.02,1.22,.77,1.02]),track('Head','rotation[x]',[0,.5,.78,1.6],[0,-.5,.6,0])]);
 /* 포자 분출: 포자낭이 부풀었다 터진다 (막을 수 없다) */
 clip('atk_spore',2.0,[track('Core','scale[x]',[0,.85,1.1,1.35,2.0],[1,1.9,2.6,1,1]),track('Core','scale[y]',[0,.85,1.1,1.35,2.0],[1,1.9,2.6,1,1]),track('Core','scale[z]',[0,.85,1.1,1.35,2.0],[1,1.9,2.6,1,1]),track('Spine','position[y]',[0,.85,1.1,2.0],[.75,.95,.55,.75])]);
 /* 뿌리 쓸기: 덩굴 둘을 펼치고 한 바퀴 */
 clip('atk_sweep',1.8,[track('Spine','rotation[y]',[0,.5,.95,1.35,1.8],[0,-.7,2.3,5.0,Math.PI*2]),track('VineL','rotation[z]',[0,.5,1.4,1.8],[0,-.6,-.6,0]),track('VineR','rotation[z]',[0,.5,1.4,1.8],[0,.6,.6,0])]);
 for(const name of ['hit','stagger']) clip(name,.65,[track('Spine','rotation[z]',[0,.15,.35,.65],[0,.2,-.1,0]),track('Head','rotation[x]',[0,.15,.65],[0,.22,0])]);
 /* 쓰러짐·사망은 «가라앉는» 게 아니라 «주저앉는» 것이다 — 골반을 바닥 아래로 내리면
    리그가 통째로 지면을 뚫는다(실측: 전 보스 down 0.45~0.55m, death 0.64~1.52m, 게다가
    게임에서는 1.22배). 내려가는 양을 줄이고 기울기로 무너짐을 보인다. docs/design/24 §4 */
 clip('down',.7,[    /* 받침이 꼼짝 않고 몸통만 기울면 «경첩이 부러진 것» 처럼 보인다 (docs/design/24 §7).
       기울기 일부를 골반으로 옮겨 기계가 통째로 넘어가게 한다. 골반을 돌리면 받침
       모서리가 파고드므로 그만큼 골반을 띄운다. */
   track('Hips','position[y]',[0,.7],[1.02,1.0]),track('Hips','rotation[x]',[0,.7],[0,.3]),track('Spine','rotation[x]',[0,.7],[0,.56])]);
 clip('up',.8,[track('Hips','position[y]',[0,.8],[1.0,1.02]),track('Hips','rotation[x]',[0,.8],[.3,0]),track('Spine','rotation[x]',[0,.8],[.56,0])]);
 clip('death',1.9,[track('Hips','position[y]',[0,.9,1.9],[1.02,1.08,1.14]),track('Hips','rotation[x]',[0,.9,1.9],[0,.2,.42]),track('Spine','rotation[x]',[0,.9,1.9],[0,.44,.76]),track('Core','scale[x]',[0,.6,1.9],[1,.3,.05]),track('Core','scale[y]',[0,.6,1.9],[1,.3,.05])]);
 return {scene,animations};
}
