/* 던전 07 보스 «소생기» — 절차적 강체 리그 (root-boss.js · hauler-boss.js 와 같은 방식).
   실루엣: 천장 레일에서 내려앉은 중환자실 가대가 이동 침대와 엉겨 붙었다.
   왼쪽 약물 펌프(PumpL)와 오른쪽 견인 팔(ArmR)이 파괴 부위, 가슴에 드러난 심박 코어가 약점.
   부위 노드 이름은 arenas.ward.parts3d / pieces:'nodes' 와 맞춘다. */
import * as T from '../vendor/three/three.module.js';
export function createWardBoss(){
 const scene=new T.Group();scene.name='WardRig';
 const enamel=new T.MeshStandardMaterial({color:0xcfd6d2,roughness:.42,metalness:.18});   /* 벗겨진 법랑 도장 */
 const steel=new T.MeshStandardMaterial({color:0x6f757b,roughness:.5,metalness:.7});
 const stain=new T.MeshStandardMaterial({color:0x6a4b42,roughness:.92,metalness:.06});    /* 마른 얼룩 */
 const glass=new T.MeshStandardMaterial({color:0x9fd8e6,roughness:.15,metalness:.1,transparent:true,opacity:.55});
 const pulse=new T.MeshStandardMaterial({color:0xff6a78,emissive:0xc41f33,emissiveIntensity:1.6,roughness:.3,metalness:.2});
 function joint(name,parent,pos){const j=new T.Group();j.name=name;j.position.set(...pos);parent.add(j);return j;}
 function box(parent,size,pos,mat=enamel){const m=new T.Mesh(new T.BoxGeometry(...size),mat);m.position.set(...pos);parent.add(m);return m;}
 function cyl(parent,rt,rb,h,pos,mat=steel,seg=10){const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);m.position.set(...pos);parent.add(m);return m;}
 function ball(parent,r,pos,mat=enamel,seg=12){const m=new T.Mesh(new T.SphereGeometry(r,seg,seg-2),mat);m.position.set(...pos);parent.add(m);return m;}

 const hips=joint('Hips',scene,[0,.92,0]);
 /* 이동 침대 차대 — 접힌 난간과 구르지 않는 바퀴 */
 box(hips,[1.5,.22,2.5],[0,-.42,0],enamel);
 box(hips,[1.3,.12,2.2],[0,-.26,0],stain);                       /* 매트리스 자리의 얼룩 */
 for(const sx of [-1,1]){
  box(hips,[.08,.46,2.1],[sx*.74,-.05,0],steel);                 /* 접다 만 난간 */
  for(const sz of [-1,1]){
   cyl(hips,.06,.06,.66,[sx*.62,-.78,sz*.95],steel,8);
   const w=cyl(hips,.19,.19,.1,[sx*.62,-1.12,sz*.95],steel,12);w.rotation.z=Math.PI/2;
  }
 }
 /* 천장 레일 토막 — 뜯겨 나온 채 몸에 박혀 있다 */
 const rail=box(hips,[.16,.16,3.2],[0,.55,-.2],steel);rail.rotation.x=.12;

 const spine=joint('Spine',hips,[0,.62,0]);
 /* 가대 기둥 + 늑골처럼 벌어진 프레임 */
 cyl(spine,.3,.4,1.25,[0,0,0],enamel,12);
 for(const sx of [-1,1]){
  const rib=box(spine,[.1,1.05,.16],[sx*.46,.1,.18],steel);rib.rotation.z=-sx*.26;
  const rib2=box(spine,[.1,.85,.14],[sx*.4,.05,-.3],steel);rib2.rotation.z=-sx*.2;
 }
 box(spine,[1.15,.18,.9],[0,.72,-.05],enamel);                   /* 어깨판 — 모니터 거치대 */

 /* 약점: 가슴에 드러난 심박 코어 */
 const nucleus=joint('Core',spine,[0,.06,.5]);
 ball(nucleus,.27,[0,0,0],pulse);
 ball(nucleus,.34,[0,0,0],glass);
 for(let i=0;i<3;i++){const t=cyl(nucleus,.035,.035,.5,[(i-1)*.16,-.3,.06],stain,6);t.rotation.x=.3;}

 /* 머리: 금 간 무영등 */
 const head=joint('Head',spine,[0,1.0,.12]);
 cyl(head,.46,.5,.18,[0,0,0],enamel,16);
 cyl(head,.4,.42,.06,[0,-.11,0],glass,16);
 ball(head,.12,[0,-.12,0],pulse);
 for(let i=0;i<4;i++){const a=i/4*Math.PI*2;cyl(head,.03,.03,.34,[Math.cos(a)*.3,.2,Math.sin(a)*.3],steel,6).rotation.z=Math.cos(a)*.3;}
 box(head,[.1,.42,.1],[0,.3,-.06],steel);                        /* 레일에 매달린 목 */

 /* 약물 펌프 (왼팔) — 파괴 부위. 주사기 다발이 앞으로 뻗는다 */
 {
  const armJoint=joint('PumpL',spine,[-.62,.24,.05]);
  const piece=joint('piece_pumpl',armJoint,[0,0,0]);
  cyl(piece,.15,.18,1.15,[-.52,-.14,.1],enamel);
  box(piece,[.44,.5,.42],[-.95,-.34,.22],enamel);                /* 펌프 본체 */
  for(let i=0;i<3;i++) cyl(piece,.07,.07,.34,[-.95+(i-1)*.13,-.04,.22],glass,8);   /* 약병 세 대 */
  for(let i=0;i<5;i++){                                          /* 주사침 다발 */
   const a=(i-2)*.16;
   const n=cyl(piece,.012,.035,.62,[-.95+Math.sin(a)*.18,-.42,.62],steel,5);n.rotation.x=Math.PI/2;n.rotation.z=a;
  }
  for(let i=0;i<3;i++){const t=cyl(piece,.025,.025,.5,[-.7+i*.1,-.6,.1],stain,5);t.rotation.x=.5+i*.2;}
 }
 /* 견인 팔 (오른팔) — 파괴 부위. 도르래와 갈고리 */
 {
  const armJoint=joint('ArmR',spine,[.62,.24,0]);
  const piece=joint('piece_armr',armJoint,[0,0,0]);
  cyl(piece,.14,.17,1.35,[.62,-.1,0],steel);
  const pulley=new T.Mesh(new T.TorusGeometry(.2,.05,6,14),steel);pulley.position.set(1.2,-.3,0);piece.add(pulley);
  cyl(piece,.03,.03,.85,[1.2,-.72,0],steel,6);                   /* 늘어진 견인줄 */
  const hook=new T.Mesh(new T.TorusGeometry(.17,.045,6,14,Math.PI*1.35),steel);
  hook.position.set(1.2,-1.2,0);hook.rotation.x=Math.PI/2;piece.add(hook);
  box(piece,[.34,.34,.3],[.36,-.05,0],enamel);
 }
 /* 끌고 다니는 수액대 둘 */
 for(const sx of [-1,1]){
  const p=cyl(hips,.035,.035,1.9,[sx*1.0,.42,-.85],steel,6);p.rotation.z=sx*.22;
  ball(hips,.1,[sx*1.22,1.3,-.85],glass,8);
 }

 const animations=[];
 const track=(name,path,times,values)=>new T.NumberKeyframeTrack(name+'.'+path,times,values);
 const clip=(name,dur,tracks)=>animations.push(new T.AnimationClip(name,dur,tracks));

 /* 인공호흡기처럼 규칙적으로 부푼다 — 살아 있는 리듬이 아니라 «기계가 대신 쉬는» 리듬 */
 clip('idle',3.0,[track('Spine','scale[y]',[0,.7,1.5,2.2,3.0],[1,1.04,1,1.04,1]),
   track('Core','scale[x]',[0,.4,.8,1.5,1.9,2.3,3.0],[1,1.18,1,1,1.18,1,1]),   /* 두 번 뛰고 쉰다 */
   track('Head','rotation[z]',[0,1.5,3.0],[0,.03,0])]);
 clip('walk',1.2,[track('Hips','position[y]',[0,.3,.6,.9,1.2],[.92,.96,.92,.96,.92]),
   track('Spine','rotation[z]',[0,.6,1.2],[0,.06,0]),track('Head','rotation[x]',[0,.6,1.2],[0,.05,0])]);
 /* 주사 찌르기: 펌프 팔을 당겼다가 내지른다 */
 clip('atk_needle',1.4,[track('PumpL','rotation[y]',[0,.42,.66,.95,1.4],[0,-1.1,1.25,.3,0]),
   track('PumpL','rotation[x]',[0,.42,.66,1.4],[0,-.3,.2,0]),
   track('Spine','rotation[y]',[0,.42,.66,1.4],[0,-.3,.36,0])]);
 /* 연계 2타: 되받아 한 번 더 — 비트마다 전용 모션 (docs/design/22 §5.2) */
 clip('atk_needle_b',1.1,[track('PumpL','rotation[y]',[0,.3,.52,.8,1.1],[0,.5,-1.35,-.2,0]),
   track('PumpL','rotation[z]',[0,.3,.52,1.1],[0,.25,-.35,0]),
   track('Spine','rotation[y]',[0,.3,.52,1.1],[0,.2,-.34,0])]);
 /* 견인 팔 후려치기: 갈고리를 크게 돌린다 — 튕길 수 없다 */
 clip('atk_drag',1.6,[track('ArmR','rotation[z]',[0,.46,.78,1.1,1.6],[0,-1.2,1.5,.4,0]),
   track('ArmR','rotation[y]',[0,.46,.78,1.6],[0,.5,-.7,0]),
   track('Spine','rotation[y]',[0,.46,.78,1.6],[0,.34,-.46,0]),
   track('Hips','rotation[y]',[0,.46,.78,1.6],[0,.2,-.3,0])]);
 /* 압박: 가대를 세웠다가 «버틴 뒤» 온몸으로 내리누른다 */
 clip('atk_press',1.8,[track('Spine','rotation[x]',[0,.55,.9,1.15,1.8],[0,-.5,-.5,.7,0]),
   track('Hips','position[y]',[0,.55,.9,1.15,1.8],[.92,1.2,1.2,.6,.92]),
   track('PumpL','rotation[x]',[0,.55,1.15,1.8],[0,-1.2,.5,0]),
   track('ArmR','rotation[x]',[0,.55,1.15,1.8],[0,-1.2,.5,0]),
   track('Head','rotation[x]',[0,.55,1.15,1.8],[0,-.4,.5,0])]);
 /* 약물 분무: 코어가 부풀었다 터진다 (막을 수 없다) */
 clip('atk_purge',2.0,[track('Core','scale[x]',[0,.85,1.1,1.35,2.0],[1,1.8,2.5,1,1]),
   track('Core','scale[y]',[0,.85,1.1,1.35,2.0],[1,1.8,2.5,1,1]),
   track('Core','scale[z]',[0,.85,1.1,1.35,2.0],[1,1.8,2.5,1,1]),
   track('Spine','position[y]',[0,.85,1.1,2.0],[.62,.82,.42,.62]),
   track('Head','rotation[x]',[0,.85,1.1,2.0],[0,-.35,.3,0])]);
 /* 피격: 짧게 움찔한다 */
 clip('hit',.6,[track('Spine','rotation[z]',[0,.14,.34,.6],[0,.18,-.09,0]),
   track('Head','rotation[z]',[0,.14,.6],[0,.24,0])]);
 /* 자세 붕괴: 처형이 열리는 순간이다 — 피격과 «같은 클립» 이면 안 된다 (docs/design/25).
    크게 휘청이고, 앞으로 꺾이고, 팔이 늘어지고, 잔진동으로 버틴다. */
 clip('stagger',1.05,[track('Spine','rotation[z]',[0,.18,.45,.72,1.05],[0,.48,-.28,.13,0]),
   track('Spine','rotation[x]',[0,.18,.52,1.05],[0,.32,.15,0]),
   track('Hips','position[y]',[0,.18,.52,1.05],[.92,.79,.86,.92]),
   track('Head','rotation[x]',[0,.18,.52,1.05],[0,.4,.19,0]),
   track('PumpL','rotation[x]',[0,.18,.52,1.05],[0,.5,.26,0]),
   track('ArmR','rotation[x]',[0,.18,.52,1.05],[0,-.5,-.26,0])]);
 clip('down',.7,[    /* 받침이 꼼짝 않고 몸통만 기울면 «경첩이 부러진 것» 처럼 보인다 (docs/design/24 §7).
       기울기 일부를 골반으로 옮겨 기계가 통째로 넘어가게 한다. 골반을 돌리면 받침
       모서리가 파고드므로 그만큼 골반을 띄운다. */
   track('Hips','position[y]',[0,.7],[.92,.96]),track('Hips','rotation[x]',[0,.7],[0,.26]),track('Spine','rotation[x]',[0,.7],[0,.56]),
   track('Head','rotation[x]',[0,.7],[0,.3])]);
 clip('up',.8,[track('Hips','position[y]',[0,.8],[.96,.92]),track('Hips','rotation[x]',[0,.8],[.26,0]),track('Spine','rotation[x]',[0,.8],[.56,0]),
   track('Head','rotation[x]',[0,.8],[.3,0])]);
 clip('death',2.0,[track('Hips','position[y]',[0,.9,2.0],[.92,1.04,1.12]),track('Hips','rotation[x]',[0,.9,2.0],[0,.18,.4]),
   track('Spine','rotation[x]',[0,.9,2.0],[0,.46,.82]),
   track('Core','scale[x]',[0,.6,2.0],[1,.28,.05]),track('Core','scale[y]',[0,.6,2.0],[1,.28,.05]),
   track('Head','rotation[x]',[0,.9,2.0],[0,.5,1.1])]);
 return {scene,animations};
}
