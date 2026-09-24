/* 클립 → 키 경로 뽑아내기.
 *
 * 우리 무기 모션은 클립이 아니라 «키 경로»(js/ain-two-hand.js AIN_SKILL_PATHS)가
 * 만든다 — 6개 숫자 다섯 줄이고, 앞 셋이 손잡이 위치, 뒤 셋이 자루 방향이다
 * (docs/design/67 §0). 그래서 좋은 클립을 구해도 «그대로 재생» 해서는 무기가
 * 안 따라온다.
 *
 * 그런데 두 손 무기 클립이면 그 둘을 «직접» 읽을 수 있다:
 *     손잡이 = 두 손의 중점
 *     자루   = 왼손 → 오른손 방향
 * 즉 애니메이터가 만든 클립에서 우리 형식의 키 경로가 바로 나온다.
 * 이게 「애니메이션식으로 풀어나가자」의 실제 구현이다.
 *
 * 사용: node tools/3d/clip-to-path.mjs <glb> [클립이름] [키개수]
 */
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';

const file=process.argv[2], want=process.argv[3]||null, NKEY=+(process.argv[4]||5);
if(!file){ console.error('사용: node tools/3d/clip-to-path.mjs <glb> [클립] [키개수]'); process.exit(1); }

const buf=fs.readFileSync(file);
const loader=new GLTFLoader();
loader.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
const g=await loader.parseAsync(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),'');

const bones={};
g.scene.traverse(o=>{ if(o.isBone) bones[o.name]=o; });
const names=Object.keys(bones);
console.log('본', names.length, '개');
console.log('클립', g.animations.map(c=>`${c.name}(${c.duration.toFixed(2)}s)`).join(', ')||'(없음)');

/* 손 뼈 찾기 — 리그마다 이름이 다르므로 흔한 표기를 전부 훑는다 */
const pick=(re)=>names.find(n=>re.test(n));
const LH=pick(/^(mixamorig:?)?(Left_?Hand|hand_l|L_Hand|LeftHand)$/i)||pick(/left.*hand|hand.*l$/i);
const RH=pick(/^(mixamorig:?)?(Right_?Hand|hand_r|R_Hand|RightHand)$/i)||pick(/right.*hand|hand.*r$/i);
/* ⚠ 게임의 키 규약에 맞춰야 한다 (js/ain-two-hand.js:362):
     center = «두 어깨의 중점» + spec[0..2]·scale 을 몸통 프레임으로 돌린 것
   즉 기준점은 엉덩이가 아니라 «어깨 중점» 이고, 축은 월드가 아니라 «몸통» 이다.
   처음엔 엉덩이·월드로 뽑았는데 그 값은 게임에 그대로 못 넣는다. */
const LA=pick(/^(mixamorig:?)?(Left_?Arm|LeftArm|upperarm_l)$/i)||pick(/left.*arm/i);
const RA=pick(/^(mixamorig:?)?(Right_?Arm|RightArm|upperarm_r)$/i)||pick(/right.*arm/i);
const TORSO=pick(/^(mixamorig:?)?(Spine2|spine_02|Chest|UpperChest)$/i)||pick(/spine/i);
console.log('손:', LH, '/', RH, '  어깨:', LA, '/', RA, '  몸통:', TORSO);
if(!LA||!RA||!TORSO){ console.error('어깨/몸통 뼈를 못 찾았다:', names.join(' ')); process.exit(4); }
if(!LH||!RH){ console.error('손 뼈를 못 찾았다 — 이름 목록:', names.slice(0,40).join(' ')); process.exit(2); }

const clip=want?g.animations.find(c=>c.name===want):g.animations[0];
if(!clip){ console.error('클립이 없다'); process.exit(3); }
g.scene.updateMatrixWorld(true);
const restTorso=bones[TORSO].getWorldQuaternion(new T.Quaternion());   /* 쉴 때 자세 */
const mixer=new T.AnimationMixer(g.scene), act=mixer.clipAction(clip);
act.play();

const N=240, dt=clip.duration/N, samp=[];
for(let i=0;i<=N;i++){
  mixer.setTime(Math.min(clip.duration*0.999, i*dt));
  g.scene.updateMatrixWorld(true);
  const l=bones[LH].getWorldPosition(new T.Vector3());
  const r=bones[RH].getWorldPosition(new T.Vector3());
  const sh=bones[LA].getWorldPosition(new T.Vector3())
            .add(bones[RA].getWorldPosition(new T.Vector3())).multiplyScalar(0.5);
  /* 몸통 프레임 = 지금 몸통 회전 × 쉴 때 몸통 회전의 역 (게임과 같은 정의) */
  const fr=bones[TORSO].getWorldQuaternion(new T.Quaternion()).multiply(restTorso.clone().invert());
  const inv=fr.clone().invert();
  const centre=l.clone().add(r).multiplyScalar(0.5).sub(sh).applyQuaternion(inv);
  const shaft=r.clone().sub(l).normalize().applyQuaternion(inv);   /* 왼손 → 오른손 */
  samp.push({t:i/N, centre, shaft, gap:l.distanceTo(r)});
}

/* 부드러움: 자루 방향의 2차 차분 (60fps 환산). 낮을수록 부드럽다. */
const f=(1/60)/dt;
let jolt=0, rate=[];
for(let i=1;i<=N;i++){
  const a=samp[i-1].shaft, b=samp[i].shaft;
  rate.push(Math.acos(T.MathUtils.clamp(a.dot(b),-1,1))/dt*180/Math.PI);
}
for(let i=2;i<=N;i++){
  const d=samp[i].shaft.clone().sub(samp[i-1].shaft).sub(samp[i-1].shaft.clone().sub(samp[i-2].shaft));
  jolt=Math.max(jolt,d.length()*f*f);
}
const mean=rate.reduce((a,b)=>a+b,0)/rate.length, peak=Math.max(...rate);
/* 시간에 안 휘둘리는 거칠기 = 표본당 2차 차분 ÷ 표본당 평균 1차 차분.
   swing-measure.html 의 cond() nShaft 와 같은 잣대(표본 240 개)다. */
let raw1=0, raw2=0;
for(let i=1;i<=N;i++) raw1+=samp[i].shaft.distanceTo(samp[i-1].shaft);
raw1/=N;
for(let i=2;i<=N;i++) raw2=Math.max(raw2,
  samp[i].shaft.clone().sub(samp[i-1].shaft).sub(samp[i-1].shaft.clone().sub(samp[i-2].shaft)).length());
console.log(`\n자루 거칠기(무차원) ${(raw2/raw1).toFixed(2)}`);
/* 각속도 곡선 자체의 매끄러움 — 등속이면 0. swing-measure 의 rJerk 와 짝이다. */
{ const w=rate.map(v=>v*Math.PI/180*dt), m=w.reduce((a,b)=>a+b,0)/w.length; let j=0;
  for(let i=1;i<w.length-1;i++) j=Math.max(j,Math.abs(w[i+1]-2*w[i]+w[i-1]));
  console.log(`각속도 곡선 거칠기 rJerk ${(j/m).toFixed(2)}`); }
/* ⚠ 두 손이 가까우면 «왼손→오른손» 방향은 잡음이 된다. 낫은 두 손을 32 cm
   벌려 잡지만, 망치·한손 클립은 손이 붙어 있어 방향이 튄다. 먼저 확인한다. */
const gaps=samp.map(s=>s.gap), gmin=Math.min(...gaps), gmax=Math.max(...gaps);
const gmean=gaps.reduce((a,b)=>a+b,0)/gaps.length;
console.log(`\n두 손 간격  최소 ${(gmin*100).toFixed(1)} cm  평균 ${(gmean*100).toFixed(1)} cm  최대 ${(gmax*100).toFixed(1)} cm`);
if(gmin<0.12) console.log('  ⚠ 손이 붙는 구간이 있다 — 자루 방향을 이 클립에서 뽑으면 잡음이 섞인다');
console.log(`\n자루 각속도  평균 ${mean.toFixed(0)}°/s  정점 ${peak.toFixed(0)}°/s  정점/평균 ${(peak/mean).toFixed(2)}`);
console.log(`자루 2차차분(60fps 환산) ${(jolt*100).toFixed(1)} cm`);
let sweep=0; for(const v of rate) sweep+=v*dt;
console.log(`총 각폭 ${sweep.toFixed(0)}°`);

/* 우리 형식으로 키를 뽑는다 */
console.log(`\n── AIN_SKILL_PATHS 형식 (${NKEY} 키) ──`);
const rows=[];
for(let k=0;k<NKEY;k++){
  const u=k/(NKEY-1), s=samp[Math.round(u*N)];
  const c=s.centre, d=s.shaft;
  rows.push(`[${u.toFixed(2)},[${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)},`+
            `${d.x.toFixed(2)},${d.y.toFixed(2)},${d.z.toFixed(2)}]]`);
}
console.log(' '+rows.join(',\n '));
