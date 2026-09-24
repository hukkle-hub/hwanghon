/* 클립을 «곡선» 으로 다시 뽑는다 — 모든 움직임의 공통 바닥 공사.
 *
 * 재 보니 우리 캐릭터 클립은 전부 24 fps · 선형 보간이다(tools: /tmp 계측,
 * docs/design/73 §4). 선형 보간은 키 «사이» 에서 속도가 일정하고 키에서
 * 속도가 툭 바뀐다. 3타 몸 클립을 뼈 속도로 찍어 보면 허리가
 *     21 → 870 → 282 → 89 °/s
 * 로 키마다 계단을 탄다. 회피는 0.42 초에 키 10 개라 더 심하다. 시간을 늘리거나
 * (스매시 세 박자) 빨리 돌리면 이 계단이 그대로 «덜컥» 으로 보인다.
 *
 * 애니메이터는 키를 곡선(베지어)으로 잇는다. 여기서도 같은 일을 한다:
 *   · 키를 «정확히» 지나는 3차 캣멀롬으로 60 fps 로 다시 뽑는다 — 키 자세는 그대로라
 *     접점 자세·판정 정렬(clipContacts)이 안 움직인다.
 *   · 회전은 사원수 성분으로 잇되, 이웃 키와 같은 반구로 맞추고 매 표본 정규화한다.
 *   · 처음과 끝 키가 같은 트랙(걷기·달리기·대기의 고리)은 이음매 너머 키로 접선을
 *     잡아 고리 이음새에서도 속도가 이어진다.
 */
import * as T from '../vendor/three/three.module.js';

const FPS=60;
function tangentsFor(times,vals,size,cyclic,alignQuat){
 const n=times.length, m=new Float32Array(n*size), T0=times[n-1]-times[0];
 for(let i=0;i<n;i++){
  let a=i-1,b=i+1,ta,tb;
  if(cyclic&&(i===0||i===n-1)){
   /* 고리: 마지막 키 = 처음 키. 이웃은 n-2(한 바퀴 앞)와 1(한 바퀴 뒤) */
   a=n-2; b=1; ta=times[n-2]-(i===0?T0:0); tb=times[1]+(i===n-1?T0:0);
  }else{
   if(a<0)a=i; if(b>n-1)b=i; ta=times[a]; tb=times[b];
  }
  const dt=tb-ta; if(!(dt>1e-9)) continue;
  const flipA=alignQuat&&dot4(vals,a,vals,i)<0?-1:1, flipB=alignQuat&&dot4(vals,b,vals,i)<0?-1:1;
  for(let k=0;k<size;k++) m[i*size+k]=(flipB*vals[b*size+k]-flipA*vals[a*size+k])/dt;
  /* ⚠ 단조 제한(Fritsch–Carlson)을 성분마다 걸어 봤다 — 사원수 성분에서 평평한
     구간을 만들어 오히려 거칠어졌다(3타 4.5 → 12.1). 그래서 그냥 캣멀롬이다. */
 }
 return m;
}
const SIGMA=()=>globalThis.TW_CLIP_SIGMA!=null?globalThis.TW_CLIP_SIGMA:DEFAULT_SIGMA;
let DEFAULT_SIGMA=0;
function smoothVals(times,vals,size,cyclic,isQ,sig){
 const n=times.length, src=Float32Array.from(vals), T0=times[n-1]-times[0], R=3*sig;
 for(let i=0;i<n;i++){
  /* 고리가 아니면 처음·끝 키는 그대로 둔다 — 다른 동작과 이어 붙는 자세다 */
  if(!cyclic&&(i===0||i===n-1)) continue;
  const acc=new Float64Array(size); let wsum=0;
  for(let j=0;j<n;j++){
   let d=times[j]-times[i];
   if(cyclic){ if(d>T0/2) d-=T0; else if(d<-T0/2) d+=T0; if(j===n-1) continue; }
   if(Math.abs(d)>R) continue;
   /* 끝에 가까운 키는 가장자리 쪽으로만 치우치지 않게, 끝 키 쪽 무게를 되비춘다 */
   const w=Math.exp(-d*d/(2*sig*sig)), flip=isQ&&dot4(src,j,src,i)<0?-1:1;
   for(let k=0;k<size;k++) acc[k]+=w*flip*src[j*size+k];
   wsum+=w;
  }
  if(!cyclic){ /* 끝 키에서의 거리에 따라 원래 값으로 되돌린다 — 이음 자세 보호 */
   const e=Math.min(times[i]-times[0],times[n-1]-times[i]), keep=Math.exp(-e*e/(2*sig*sig));
   for(let k=0;k<size;k++) vals[i*size+k]=(1-keep)*acc[k]/wsum+keep*src[i*size+k];
  } else for(let k=0;k<size;k++) vals[i*size+k]=acc[k]/wsum;
  if(isQ){ let l=0; for(let k=0;k<4;k++) l+=vals[i*4+k]**2; l=Math.sqrt(l)||1; for(let k=0;k<4;k++) vals[i*4+k]/=l; }
 }
 if(cyclic) for(let k=0;k<size;k++) vals[(n-1)*size+k]=vals[k];
}
export function setClipSigma(s){ DEFAULT_SIGMA=s; }
function dot4(A,i,B,j){let s=0;for(let k=0;k<4;k++)s+=A[i*4+k]*B[j*4+k];return s;}
function resample(track,duration,loop){
 const size=track.getValueSize(), times=track.times, n=times.length;
 const isQ=track.ValueTypeName==='quaternion';
 if(n<3||!(isQ||track.ValueTypeName==='vector')) return track;
 if(track.getInterpolation()===T.InterpolateDiscrete) return track;
 const vals=Float32Array.from(track.values);
 if(isQ){ /* 이웃 키와 같은 반구로 — 성분 보간이 먼 길로 돌지 않게 */
  for(let i=1;i<n;i++) if(dot4(vals,i-1,vals,i)<0) for(let k=0;k<4;k++) vals[i*4+k]*=-1; }
 /* 고리 트랙: 처음과 끝 키가 같은 자세 (사원수는 q ≡ −q) */
 let cyclic=false;
 /* 고리로 보는 건 «고리 클립» 뿐이다. 브레이크처럼 처음·끝이 우연히 같은 자세인
    단발 동작을 고리로 보면 첫 자세가 움직여 앞 동작과 이음새가 생긴다. */
 if(loop){
  if(isQ) cyclic=Math.abs(dot4(vals,0,vals,n-1))>1-1e-6;
  else { let close=0; for(let k=0;k<size;k++) close=Math.max(close,Math.abs(vals[k]-vals[(n-1)*size+k])); cyclic=close<1e-4; }
 }
 /* 커브 펴기(가우시안). 원본 키에 한 박자짜리 스냅이 있으면 곡선이 그걸
    정직하게 따라가다 오히려 출렁인다(3타 허리, 반격 팔). 애니메이터가 커브
    에디터에서 튀는 키를 눌러 펴는 것과 같은 일이다. σ 는 시간(초). */
 const sig=SIGMA();
 if(sig>0) smoothVals(times,vals,size,cyclic,isQ,sig);
 const m=tangentsFor(times,vals,size,cyclic,isQ);
 const t0=times[0], t1=times[n-1], steps=Math.max(n,Math.ceil((t1-t0)*FPS));
 /* 60 fps 격자 + 원래 키 시각. 격자만 쓰면 빠른 팔에서 격자 사이 직선이 키를
    2° 넘게 비껴 간다(1타 왼팔) — 키 시각을 끼워 넣어 키에서는 정확하게. */
 const grid=[]; for(let s=0;s<=steps;s++) grid.push(s===steps?t1:t0+(t1-t0)*s/steps);
 for(let i=0;i<n;i++) grid.push(times[i]);
 grid.sort((a,b)=>a-b);
 const G=[]; for(const t of grid) if(!G.length||t-G[G.length-1]>1e-5) G.push(t);
 const outT=new Float32Array(G.length), outV=new Float32Array(G.length*size);
 let seg=0;
 for(let s=0;s<G.length;s++){
  const t=G[s]; outT[s]=t;
  while(seg<n-2&&t>times[seg+1]) seg++;
  const h=times[seg+1]-times[seg], p=h>1e-9?Math.min(1,Math.max(0,(t-times[seg])/h)):0, p2=p*p, p3=p2*p;
  const h00=2*p3-3*p2+1, h10=p3-2*p2+p, h01=-2*p3+3*p2, h11=p3-p2;
  let len=0;
  for(let k=0;k<size;k++){
   const v=h00*vals[seg*size+k]+h10*h*m[seg*size+k]+h01*vals[(seg+1)*size+k]+h11*h*m[(seg+1)*size+k];
   outV[s*size+k]=v; len+=v*v;
  }
  if(isQ){ len=Math.sqrt(len)||1; for(let k=0;k<4;k++) outV[s*4+k]/=len; }
 }
 const Ctor=track.constructor;
 return new Ctor(track.name,outT,outV);
}
/* 클립마다 어떻게 다시 뽑을지 — «재서» 정했다 (docs/design/73 §4).
   잣대: 주요 뼈 9 개의 월드 각속도 곡선 거칠기(rJerk) 평균, 60 fps 재생.

     클립      선형   곡선   펴기σ.03   고른 것   (펴기의 최대 자세 변화)
     attack1   2.95   2.21    0.93     곡선      (펴면 접점 자세가 54° 바뀐다 → 탈락)
     attack2   3.48   2.48    1.43     곡선
     attack3   4.50   7.41    3.23     선형      (원본에 허리 스냅 — 곡선이 넘쳐 출렁)
     smash     1.85   1.37    0.60     곡선
     counter   8.38   8.98    4.49     선형
     exec      9.18   5.73    2.42     곡선
     skill1    5.48   7.43    3.23     선형
     skill2    5.67   8.22    3.92     선형
     skill3    1.66   1.63    0.68     곡선
     ult       4.20   3.63    4.10     곡선
     dodgeL/R  1.36   1.32    1.48     곡선
     roll      1.43   1.61    1.68     선형
     run       1.83   1.41    0.81     펴기      (5.7°)
     walk      1.03   0.86    0.46     펴기      (5.1°)
     idle      3.55   4.08    1.58     펴기      (1.8°)
     hit       1.61   1.33    1.09     펴기      (4.6°)
     brake     1.41   1.84    1.23     펴기      (8.9°)
     death     2.14   1.56    1.09     펴기      (9.1°)
   공격은 펴지 않는다 — 팔이 0.1 초에 100° 넘게 도는 동작이라 펴면 동작 자체가
   지워진다(σ .045 에서 1타 자세 최대 100° 변화). 키를 정확히 지나는 곡선만 쓴다. */
const SOFT=.03;
const LOOP=new Set(['run','walk','idle','idle2','guard']);
const POLICY={attack3:'linear',counter:'linear',skill1:'linear',skill2:'linear',roll:'linear',
  run:'soft',walk:'soft',idle:'soft',idle2:'soft',hit:'soft',hit2:'soft',guardUp:'soft',guardHit:'soft',
  cheer:'soft',pickup:'soft',death:'soft',brake:'soft'};
export function clipPolicy(name){ return POLICY[name]||'curve'; }
export function isLoop(name){ return LOOP.has(name); }
export function smoothClip(clip){
 if(clip.userData?.smoothed) return clip;
 /* 계측용: TW_CLIP_SIGMA 가 있으면 모든 클립을 그 σ 로 (tools 가 쓸어 볼 때) */
 const measuring=globalThis.TW_CLIP_SIGMA!=null, mode=measuring?'curve':clipPolicy(clip.name);
 if(mode==='linear') return clip;
 const keep=DEFAULT_SIGMA; if(!measuring) DEFAULT_SIGMA=mode==='soft'?SOFT:0;
 const out=new T.AnimationClip(clip.name,clip.duration,clip.tracks.map(t=>resample(t,clip.duration,LOOP.has(clip.name))),clip.blendMode);
 DEFAULT_SIGMA=keep;
 out.userData={...(clip.userData||{}),smoothed:true};
 return out;
}
export function smoothClips(clips){ return clips.map(smoothClip); }
