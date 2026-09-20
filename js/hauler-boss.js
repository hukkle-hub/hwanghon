/* 던전 06 보스 «파쇄 기갑» — 절차적 강체 리그 (relay-boss.js 와 같은 방식, GLB 로 교체 가능).
   실루엣: 무너진 수송 기갑. 궤도 차대 위에 파쇄 턱(JawR)과 평형추(ArmL)를 단 상체가 얹혀 있다.
   두 팔이 파괴 부위, 등판 아래 노출된 동력로가 약점.
   부위 노드 이름은 arenas.road.parts3d / pieces:'nodes' 와 맞춘다. */
import * as T from '../vendor/three/three.module.js';
export function createHaulerBoss(){
 const scene=new T.Group();scene.name='HaulerRig';
 const steel=new T.MeshStandardMaterial({color:0x5c6068,roughness:.55,metalness:.72});
 const rust=new T.MeshStandardMaterial({color:0x7a4f33,roughness:.9,metalness:.25});
 const hazard=new T.MeshStandardMaterial({color:0xb99236,roughness:.7,metalness:.35});
 const core=new T.MeshStandardMaterial({color:0xffa25c,emissive:0xc4501a,emissiveIntensity:1.5,roughness:.3,metalness:.4});
 function joint(name,parent,pos){const j=new T.Group();j.name=name;j.position.set(...pos);parent.add(j);return j;}
 function box(parent,size,pos,mat=steel){const m=new T.Mesh(new T.BoxGeometry(...size),mat);m.position.set(...pos);parent.add(m);return m;}
 function cyl(parent,rt,rb,h,pos,mat=steel,seg=12){const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,seg),mat);m.position.set(...pos);parent.add(m);return m;}

 const hips=joint('Hips',scene,[0,1.0,0]);
 /* 궤도 차대: 좌우 무한궤도 + 로드휠 */
 for(const sx of [-1,1]){
  box(hips,[.62,.72,2.6],[sx*1.05,-.62,0],rust);
  for(let i=-2;i<=2;i++){const w=cyl(hips,.26,.26,.5,[sx*1.05,-.78,i*.52],steel,10);w.rotation.z=Math.PI/2;}
  for(let i=-2;i<=2;i++) box(hips,[.66,.1,.3],[sx*1.05,-1.06,i*.52],hazard);
 }
 box(hips,[1.7,.56,2.0],[0,-.5,0],steel);          /* 차대 상판 */
 box(hips,[2.3,.18,.5],[0,-.2,1.25],hazard);       /* 앞 배장판 */

 const spine=joint('Spine',hips,[0,.7,0]);
 /* 상체: 회전 포탑처럼 앉은 파쇄기 본체 */
 box(spine,[1.9,1.2,1.5],[0,0,0],steel);
 box(spine,[2.0,.2,1.6],[0,.68,0],rust);
 for(const sx of [-1,1]) box(spine,[.14,.9,1.2],[sx*1.0,.1,-.2],hazard);

 /* 약점: 등판 아래 노출된 동력로 */
 const nucleus=joint('Core',spine,[0,-.1,-.82]);
 cyl(nucleus,.32,.32,.6,[0,0,0],core);
 for(const sy of [.32,-.32]){const r=new T.Mesh(new T.TorusGeometry(.36,.07,6,16),steel);r.rotation.x=Math.PI/2;r.position.y=sy;nucleus.add(r);}

 /* 머리: 찌그러진 운전실 */
 const head=joint('Head',spine,[0,.95,.35]);
 box(head,[1.0,.62,.8],[0,0,0],rust);
 box(head,[.78,.3,.06],[0,.06,.42],core);
 cyl(head,.05,.05,.7,[-.4,.55,-.1],steel,6);

 /* 파쇄 턱 (오른팔) — 파괴 부위 */
 {
  const armJoint=joint('JawR',spine,[.95,.15,.2]);
  const piece=joint('piece_jawr',armJoint,[0,0,0]);
  cyl(piece,.22,.26,1.3,[.62,-.15,.3],steel);
  box(piece,[.5,.5,.5],[1.1,-.3,.6],steel);
  for(const sy of [1,-1]){                         /* 집게 두 짝 */
   const j=box(piece,[.28,.16,1.0],[1.15,-.3+sy*.22,1.2],rust);j.rotation.x=sy*.1;
   for(let i=0;i<4;i++) cyl(piece,.03,.09,.26,[1.15,-.3+sy*.3,.85+i*.22],hazard,5).rotation.x=sy*Math.PI/2;
  }
 }
 /* 평형추 (왼팔) — 파괴 부위 */
 {
  const armJoint=joint('ArmL',spine,[-.95,.15,0]);
  const piece=joint('piece_arml',armJoint,[0,0,0]);
  cyl(piece,.2,.24,1.5,[-.7,-.1,0],steel);
  box(piece,[.7,.7,.7],[-1.35,-.5,0],rust);
  for(const sz of [-1,1]) box(piece,[.76,.12,.14],[-1.35,-.5,sz*.34],hazard);
 }
 /* 끊어진 견인 케이블 */
 for(let i=0;i<3;i++){const c=cyl(spine,.04,.04,1.1,[-.3+i*.3,-.5,-.9],rust,5);c.rotation.x=.5+i*.14;}

 const animations=[];
 const track=(name,path,times,values)=>new T.NumberKeyframeTrack(name+'.'+path,times,values);
 const clip=(name,dur,tracks)=>animations.push(new T.AnimationClip(name,dur,tracks));

 /* 엔진이 떨린다 */
 clip('idle',2.2,[track('Spine','position[y]',[0,.55,1.1,1.65,2.2],[.7,.72,.7,.72,.7]),track('Core','scale[y]',[0,1.1,2.2],[1,1.15,1]),track('Head','rotation[z]',[0,1.1,2.2],[0,.02,0])]);
 clip('walk',1.0,[track('Hips','position[y]',[0,.25,.5,.75,1.0],[1,1.06,1,1.06,1]),track('Spine','rotation[z]',[0,.5,1.0],[0,.05,0])]);
 /* 파쇄 물기: 턱을 뒤로 당겼다가 물어뜯는다 */
 clip('atk_bite',1.5,[track('JawR','rotation[y]',[0,.45,.7,.95,1.5],[0,1.2,-1.3,-.35,0]),track('Spine','rotation[y]',[0,.45,.7,1.5],[0,.32,-.42,0])]);
 /* 연계 2타: 평형추를 휘둘러 되받는다 */
 clip('atk_bite_b',1.2,[track('ArmL','rotation[y]',[0,.34,.56,.82,1.2],[0,-1.3,1.6,.4,0]),track('Spine','rotation[y]',[0,.34,.56,1.2],[0,-.3,.4,0])]);
 /* 돌진: 차대를 낮추고 밀고 들어온다.
    주의 — 돌진 «거리» 는 시뮬레이션이 갖는다. 그래서 무게는 자세로 실어야 한다:
    이 클립이 26개 공격 중 가장 덜 움직였다(0.38 rad). 턱·평형추를 당겼다 앞으로 내지르고
    차대를 앞으로 처박게 고쳤다 (docs/design/24-contact-audit.md §3). */
 clip('atk_ram',1.7,[track('Hips','position[y]',[0,.55,.85,1.2,1.7],[1,.88,.96,1.06,1]),
   track('Hips','rotation[x]',[0,.55,.85,1.2,1.7],[0,-.1,.17,.05,0]),
   track('Spine','rotation[x]',[0,.55,.85,1.2,1.7],[0,-.34,.52,-.1,0]),
   track('Head','rotation[x]',[0,.55,.85,1.7],[0,-.3,.46,0]),
   track('JawR','rotation[x]',[0,.55,.85,1.2,1.7],[0,.5,-.85,-.2,0]),
   track('ArmL','rotation[x]',[0,.55,.85,1.2,1.7],[0,.4,-.7,-.15,0])]);
 /* 지면 강타: 평형추를 들었다가 내리꽂는다 (버티는 구간이 있다) */
 clip('atk_quake',1.9,[track('ArmL','rotation[x]',[0,.5,.95,1.2,1.5,1.9],[0,-1.9,-1.9,.85,.3,0]),track('Hips','position[y]',[0,.5,.95,1.2,1.9],[1,1.12,1.12,.8,1]),track('Spine','rotation[x]',[0,.5,1.2,1.9],[0,-.2,.3,0])]);
 /* 과부하 배출: 동력로가 부풀었다 터진다 (막을 수 없다) */
 clip('atk_burst',2.1,[track('Core','scale[x]',[0,.9,1.15,1.45,2.1],[1,1.8,2.4,1,1]),track('Core','scale[z]',[0,.9,1.15,1.45,2.1],[1,1.8,2.4,1,1]),track('Spine','position[y]',[0,.9,1.15,2.1],[.7,.95,.5,.7])]);
 for(const name of ['hit','stagger']) clip(name,.65,[track('Spine','rotation[z]',[0,.15,.35,.65],[0,.16,-.08,0]),track('Head','rotation[z]',[0,.15,.65],[0,.2,0])]);
 /* 쓰러짐·사망은 «가라앉는» 게 아니라 «주저앉는» 것이다 — 골반을 바닥 아래로 내리면
    리그가 통째로 지면을 뚫는다(실측: 전 보스 down 0.45~0.55m, death 0.64~1.52m, 게다가
    게임에서는 1.22배). 내려가는 양을 줄이고 기울기로 무너짐을 보인다. docs/design/24 §4 */
 clip('down',.7,[track('Hips','position[y]',[0,.7],[1,.84]),track('Spine','rotation[x]',[0,.7],[0,.76])]);
 clip('up',.8,[track('Hips','position[y]',[0,.8],[.84,1]),track('Spine','rotation[x]',[0,.8],[.76,0])]);
 clip('death',1.8,[track('Hips','position[y]',[0,.85,1.8],[1,1.0,.98]),track('Spine','rotation[z]',[0,.85,1.8],[0,.26,.46]),track('Spine','rotation[x]',[0,.85,1.8],[0,.3,.7]),track('ArmL','rotation[z]',[0,.85,1.8],[0,-.2,-.45]),track('Core','scale[x]',[0,.55,1.8],[1,.3,.05]),track('Core','scale[z]',[0,.55,1.8],[1,.3,.05])]);
 return {scene,animations};
}
