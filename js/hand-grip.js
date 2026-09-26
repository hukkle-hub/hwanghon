/* 쥔 손 모프 — 카인·류·세라 (docs/design/94).
   세 캐릭터는 손가락을 편 채 조각됐고 손가락 뼈가 없다. 아인(ain-grip-shape.js)처럼 손 정점을 무기 축에 감아
   «쥔 손» 모프를 만든다. 뼈를 새로 만들지 않고, 몸 메시의 지오메트리를 복제해 모프만 더한다(원본 GLB 불변).

   손 뼈 로컬(바인드) 틀:
     a = 무기 축(HandSlot 바인드 +Y) — 주먹 구멍 방향. 클립이 카인 오른손 자리를 돌리는 폭은 전투 12° 이하, 류·세라 0°.
     f = 손가락 방향(손끝 중심 − 손 중심, a 에 수직)
     n = 손바닥 쪽(a × f 부호를 손바닥 쪽 X 로 맞춤: 오른손 +X, 왼손 −X)
   손가락 사이 물갈퀴(web) 보다 PIVOT 아래를 손가락 뿌리로 보고, 뿌리 앞(손바닥 쪽) r 거리의 축 C 둘레로
   손가락을 호 길이 그대로 감는다. 엄지는 손가락 폭(q) 밖이라 감지 않는다 — 폭 경계에서 부드럽게 줄인다.
   엄지는 따로 통째로 돌린다(fitThumb, docs/design/95). */
import * as T from '../vendor/three/three.module.js';

/* web: 잰 값 — tools/3d/hand-curl.html 로 손 삼각형을 손바닥 평면에 그려, 손가락 사이 홈 바닥의 손 뼈 Y(엄지 홈 제외).
   r: 쥐는 무기 손잡이 반지름(손 뼈 로컬 = 월드 ÷ 1.14). 카인 대검 3.4~3.9 cm → 3.2 · 류 단검 1.2~2.6 → 1.8 · 세라 병 목 2.0 → 1.8 */
export const HAND_GRIP={
  kain:{Right:{web:.190},Left:{web:.188},r:.032},
  ryu:{Right:{web:.153},Left:{web:.196},r:.018},
  sera:{Right:{web:.078},Left:{web:.085},r:.018},   // 세라는 뿌리선이 기울었다(검지 6.5 · 중지 6.5 · 약지 8.8 cm) — 가운데 값
};
const PIVOT=.012;      // 물갈퀴 아래 손가락 뿌리(손바닥 주름)까지. 「근거 없음」 — 사람 손 대략값, 렌더로 확인
const THETA_MAX=3.5;   // 감는 최대 각(rad). 넘으면 손끝이 손바닥을 뚫는다 — 렌더로 확인

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const smooth=(e0,e1,x)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t);};

/* 손 정점(손 뼈 로컬, 무게 ≥ .6)으로 틀을 맞춘다.
   f 는 «손가락 자체» 방향(물갈퀴 바로 위 손가락 중심 → 손끝 중심)이다. 손바닥 평면 기준으로 잡으면 뒤로 젖혀 조각된
   류·세라 손가락이 축에서 멀어져 큰 고리로 감겼다(렌더 확인). */
export function fitHandGrip(verts,slotQuat,side,web,r){
  const sg=side==='Right'?1:-1, a=V(0,1,0).applyQuaternion(slotQuat).normalize();
  const q=v=>v.dot(a), mean=arr=>{const m=V();arr.forEach(v=>m.add(v));return m.divideScalar(Math.max(1,arr.length));};
  const pct=(arr,p)=>{if(!arr.length)return 0;const b=arr.slice().sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(b.length*p))];};
  /* 손가락 폭(q): 물갈퀴 1 cm 위 손가락들 */
  const fing=verts.filter(v=>v.y>web+.01), qLo=pct(fing.map(q),.03), qHi=pct(fing.map(q),.97), inQ=v=>q(v)>qLo&&q(v)<qHi;
  const baseV=verts.filter(v=>v.y>=web&&v.y<web+.012&&inQ(v)), top=pct(fing.map(v=>v.y),.94), tipV=fing.filter(v=>v.y>=top&&inQ(v));
  const base=mean(baseV), tip=mean(tipV);
  const f=tip.clone().sub(base);f.addScaledVector(a,-f.dot(a)).normalize();
  const n=V().crossVectors(a,f).normalize();if(n.x*sg<0)n.negate();
  const s=v=>v.dot(f), nn=v=>v.dot(n);
  const sK=s(base)-.006-PIVOT;
  /* 손바닥 면(n): 손가락들 자체의 손바닥 쪽 면 — 뿌리 0.8~2.5 cm 위를 q 6 mm 칸으로 나눠 칸마다 90 %, 그 가운데 값.
     뿌리 조각 전체로 재면 엄지 두덩이 잡혀 축이 손가락 앞 2 cm 에 떴고, 세라 손가락이 큰 갈고리로 감겼다(렌더 확인) */
  const hb=new Map();verts.forEach(v=>{const ds=s(v)-sK;if(ds>.008&&ds<.025&&inQ(v)){const k=Math.floor(q(v)/.006);if(!hb.has(k))hb.set(k,[]);hb.get(k).push(nn(v));}});
  const hs=[...hb.values()].filter(b=>b.length>=3).map(b=>pct(b,.9));
  const hK=hs.length?pct(hs,.5):pct(baseV.map(nn),.95);
  /* 손가락 두께: 뿌리 1.2~2.8 cm 위를 q 6 mm 칸으로 나눠 칸마다 n 폭(10~90 %) → 가운데 값. 손 전체로 재면 손가락마다 기운 각이 섞여 3 cm 로 붙었다 */
  const bins=new Map();verts.forEach(v=>{if(s(v)>sK+.012&&s(v)<sK+.028&&inQ(v)){const k=Math.floor(q(v)/.006);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(nn(v));}});
  const widths=[...bins.values()].filter(b=>b.length>=4).map(b=>pct(b,.9)-pct(b,.1));
  const t=widths.length?Math.max(.012,Math.min(.03,pct(widths,.5))):.02;
  const K=f.clone().multiplyScalar(sK).addScaledVector(n,hK).addScaledVector(a,(qLo+qHi)/2);
  const C=K.clone().addScaledVector(n,r);
  /* 엄지 쪽: 세 캐릭터 모두 엄지가 손 뼈 −Z 쪽(렌더 확인). a 는 대략 −Z 라 q 가 큰 쪽 */
  const thumbHi=a.z<0;
  return {a:a.toArray(),f:f.toArray(),n:n.toArray(),K:K.toArray(),c:C.toArray(),r,rho:r+t/2,t,qLo,qHi,thumbHi,side,
    thumb:thumbHi?fitThumb(verts,{a,f,n,C,r,t,qLo,qHi,sK}):null};
}
/* 엄지 (docs/design/95): 손바닥 앞으로 나온 엄지 덩어리의 주축 = 엄지 방향. 손잡이 높이의 마디에서 끝마디를 돌려 (가상 엄지 뼈)
   주먹 앞을 가로질러 검지·중지 위에 눕게 한다.
   손가락처럼 손바닥 면 기준으로 감으면 엄지 두덩이 30 배 늘어났다(94) — 마디에서 통째로 돌리면 늘어날 곳이 마디 둘레뿐이다 */
const THUMB_UP=.44;   // 엄지가 가로선에서 위로 드는 각(rad, 25°). 「근거 없음」 — 렌더로 확인
function fitThumb(verts,{a,f,n,C,r,t,qLo,qHi,sK}){
  /* 엄지 = 손바닥 면보다 r+1 cm 넘게 앞으로 나온 덩어리(뿌리 3.5 cm 위까지, 검지 쪽 절반). 손가락 폭 바깥(q)으로 찾으면
     엄지가 손바닥 앞에 붙어 있어 거의 안 잡혔다(카인·세라 0) — 앞 오프셋 지도: 카인 7~8 · 류 5~7 · 세라 4~6 cm */
  const K0=C.clone().addScaledVector(n,-r),qMid=(qLo+qHi)/2;
  const T=verts.filter(v=>{const d=v.clone().sub(K0);return d.dot(n)>r+.01&&d.dot(f)<.035&&v.dot(a)>qMid;});if(T.length<6)return null;   // 세라 손은 무게 .6 이상 정점이 167 개뿐
  const m=V();T.forEach(v=>m.add(v));m.divideScalar(T.length);
  /* 주축(거듭제곱법) */
  const cov=[0,0,0,0,0,0,0,0,0];T.forEach(v=>{const d=[v.x-m.x,v.y-m.y,v.z-m.z];for(let i=0;i<3;i++)for(let j=0;j<3;j++)cov[i*3+j]+=d[i]*d[j];});
  let d=V(0,1,0);for(let k=0;k<30;k++){d=V(cov[0]*d.x+cov[1]*d.y+cov[2]*d.z,cov[3]*d.x+cov[4]*d.y+cov[5]*d.z,cov[6]*d.x+cov[7]*d.y+cov[8]*d.z).normalize();}
  if(d.dot(f)<0)d.negate();
  const pr=T.map(v=>v.clone().sub(m).dot(d)).sort((x,y)=>x-y),p0=pr[Math.floor(pr.length*.02)],p1=pr[Math.floor(pr.length*.98)];
  const root=m.clone().addScaledVector(d,p0),tip=m.clone().addScaledVector(d,p1),len=p1-p0;
  /* 엄지 마디(J) = 엄지 축에서 손잡이 가운데 높이(f). 그 아래는 손잡이 옆에 서 있고, 그 위만 꺾어 주먹 앞을 가로지른다.
     엄지 전체를 뿌리에서 돌리면 카인(엄지 11 cm, 뿌리가 손잡이 9 cm 아래)은 손바닥을 가로질러 손잡이 밑으로 삐져나왔다 */
  /* 세라 엄지는 끝까지 손잡이 높이보다 낮아 마디를 엄지 60 % 에서 멈춘다(끝 40 % 는 늘 꺾임) */
  const uJ=Math.min(len*.6,Math.max(len*.3,(C.clone().sub(root)).dot(f)/Math.max(.3,d.dot(f))));
  const B=root.clone().addScaledVector(d,uJ);
  /* 망치 쥐기: 엄지 끝마디는 주먹 앞을 가로질러 새끼 쪽(−a)으로 눕는다, 약간 위로(THUMB_UP) */
  const dir=a.clone().multiplyScalar(-Math.cos(THUMB_UP)).addScaledVector(f,Math.sin(THUMB_UP)).normalize();
  const rot=new T_Quat().setFromUnitVectors(tip.clone().sub(B).normalize(),dir);
  /* 엄지 굵기: 엄지 정점의 축 거리 90 % — 이 밖(검지 뿌리 살 등)은 돌리지 않는다. 안 막으면 세라 검지 앞 살이 엄지와 같이 돌아 1 cm 늘어났다 */
  const radial=T.map(v=>{const x=v.clone().sub(m);return x.addScaledVector(d,-x.dot(d)).length();}).sort((x,y)=>x-y),rad=radial[Math.floor(radial.length*.9)];
  return {B:B.toArray(),d:d.toArray(),m:m.toArray(),rad,L:len-uJ,uJ,rot:[rot.x,rot.y,rot.z,rot.w],tip:tip.toArray(),target:B.clone().addScaledVector(dir,tip.distanceTo(B)).toArray()};
}
const T_Quat=T.Quaternion;
/* 엄지 돌림 세기 0..1 (시험도 쓴다) */
export function thumbWeight(v,g){
  const th=g.thumb;if(!th)return 0;
  const B=V(...th.B),u=v.clone().sub(B).dot(V(...th.d))/th.L,q=v.dot(V(...g.a));
  const K0=V(...g.c).addScaledVector(V(...g.n),-g.r),hp=v.clone().sub(K0).dot(V(...g.n));
  /* u: 마디 J 부터 끝마디 길이 비율. 마디 아래 35 % 부터 위 45 % 까지 서서히 꺾는다 — 짧게 꺾으면 마디 바깥 살이 1~2 cm 늘어났다 */
  const x=v.clone().sub(V(...th.m)),dd=V(...th.d),rd=x.addScaledVector(dd,-x.dot(dd)).length();
  return smooth(g.r,g.r+.01,hp)*smooth((g.qLo+g.qHi)/2-.01,(g.qLo+g.qHi)/2+.005,q)*smooth(-.35,.45,u)*(1-smooth(th.rad,th.rad*1.4,rd));
}
function thumbShape(p,v,g,amount){
  const th=g.thumb;if(!th||amount<=0)return p;
  const B=V(...th.B),w=thumbWeight(v,g)*amount;if(w<=0)return p;
  const r=new T.Quaternion().slerp(new T.Quaternion(...th.rot),w);
  return p.clone().sub(B).applyQuaternion(r).add(B);
}

/* 한 점을 감는다(손 뼈 로컬). amount 0..1 — 손가락을 감고, 엄지를 돌린다 */
export function handGripShape(v,g,amount=1){return THUMB?thumbShape(fingerShape(v,g,amount),v,g,amount):fingerShape(v,g,amount);}
const THUMB=true;
function fingerShape(v,g,amount){
  const a=V(...g.a),f=V(...g.f),n=V(...g.n),K=V(...g.K),C=V(...g.c),d=v.clone().sub(K);
  const s=d.dot(f),q=v.dot(a),hp=d.dot(n);let h=g.r-hp;
  if(s<=0||amount<=0)return v.clone();
  /* 엄지 쪽은 폭 끝 1.2 cm 에 걸쳐 줄이고, 새끼 쪽은 3 cm 여유(새끼 바깥은 감아도 걸리는 것이 없다) */
  const lo=g.thumbHi?[g.qLo-.03,g.qLo-.015]:[g.qLo-.012,g.qLo+.002], hi=g.thumbHi?[g.qHi-.002,g.qHi+.012]:[g.qHi+.015,g.qHi+.03];
  const wq=smooth(lo[0],lo[1],q)*(1-smooth(hi[0],hi[1],q));
  /* 손바닥 면보다 손잡이 반지름 이상 앞(엄지 두덩)은 손가락이 아니다 — 감으면 반대편으로 넘어가 늘어났다(류 6.5 배).
     뿌리 4 cm 위까지만: 세라 손끝은 조각부터 2.5 cm 앞으로 굽어 있어, 빼면 손끝만 남고 6.9 배 늘어났다 */
  const wf=1-smooth(g.r+.004,g.r+.016,hp)*(1-smooth(.04,.055,s));
  if(wq*wf<=0)return v.clone();
  const k=amount*wq*wf, th=Math.min(s/g.rho,THETA_MAX)*k, extra=Math.max(0,s-THETA_MAX*g.rho)*k;
  /* 앞으로 불룩한 손가락 살은 손잡이 속으로 들어간다 — 굽는 만큼 손잡이 면에 눌러 붙인다(20 % 만 파고듦) */
  if(h<g.r)h+=(g.r-(g.r-h)*.2-h)*smooth(0,.5,th);
  const straight=Math.max(0,s-th*g.rho-extra);   // 덜 감긴 만큼은 곧게
  const cs=Math.cos(th),sn=Math.sin(th),tan=f.clone().multiplyScalar(cs).addScaledVector(n,sn);
  return C.clone().addScaledVector(n,-h*cs).addScaledVector(f,h*sn).addScaledVector(tan,extra+straight).addScaledVector(a,d.dot(a));
}

/* 손가락 쪼개기 — 세라 손가락은 한 손 전체에 정점 45 개(손가락 하나 = 뿌리·끝 두 점)라 감으면 곧은 현(지붕 모양)이 됐다.
   손 영역(손 무게 ≥ .3, 뿌리 1 cm 아래부터)의 MAX_EDGE 보다 긴 모서리를 가운데서 나눈다.
   이웃 삼각형도 나뉜 모서리 수(1·2·3)대로 나눠 T 자 이음(틈)이 생기지 않는다. 속성은 평균, 스킨 무게는 합쳐 상위 4 개. */
const MAX_EDGE=.007;   // 손 뼈 로컬 m. 「근거 없음」 — 7 mm 면 7 cm 손가락이 10 마디, 렌더로 매끈함 확인
export function subdivideHands(G0,regions,maxLen=MAX_EDGE,passes=5){
  const names=Object.keys(G0.attributes),A={},size={};
  for(const k of names){const at=G0.attributes[k];size[k]=at.itemSize;A[k]=Array.from(at.array);}
  const MA={};for(const k of Object.keys(G0.morphAttributes||{}))MA[k]=(G0.morphAttributes[k]||[]).map(at=>Array.from(at.array));
  let count=G0.attributes.position.count;
  const groups=G0.groups.length?G0.groups.map(g=>({...g})):[{start:0,count:G0.index.count,materialIndex:0}];
  let tris=groups.map(g=>{const t=[];for(let k=g.start;k<g.start+g.count;k++)t.push(G0.index.getX(k));return t;});
  const P=i=>V(A.position[i*3],A.position[i*3+1],A.position[i*3+2]);
  const SI=A.skinIndex,SW=A.skinWeight;
  const wOf=(i,bi)=>{let w=0;for(let k=0;k<4;k++)if(SI[i*4+k]===bi)w+=SW[i*4+k];return w;};
  const local=(i,r)=>P(i).applyMatrix4(r.M);
  const inR=i=>{for(const r of regions){if(wOf(i,r.bi)>=.3&&local(i,r).sub(r.K).dot(r.f)>-.01)return r;}return null;};
  const mid=(a,b)=>{const n=count++;
    for(const k of names){const z=size[k];
      if(k==='skinIndex'||k==='skinWeight')continue;
      for(let c=0;c<z;c++)A[k].push((A[k][a*z+c]+A[k][b*z+c])/2);
      if(k==='normal'){const o=n*3,l=Math.hypot(A.normal[o],A.normal[o+1],A.normal[o+2])||1;for(let c=0;c<3;c++)A.normal[o+c]/=l;}}
    if(SI){const m=new Map();for(const v of [a,b])for(let k=0;k<4;k++){const j=SI[v*4+k],w=SW[v*4+k]/2;if(w>0)m.set(j,(m.get(j)||0)+w);}
      const top=[...m.entries()].sort((x,y)=>y[1]-x[1]).slice(0,4),sum=top.reduce((t,e)=>t+e[1],0)||1;
      for(let k=0;k<4;k++){SI.push(top[k]?top[k][0]:0);SW.push(top[k]?top[k][1]/sum:0);}}
    for(const k of Object.keys(MA))MA[k].forEach(arr=>{for(let c=0;c<3;c++)arr.push((arr[a*3+c]+arr[b*3+c])/2);});
    return n;};
  for(let pass=0;pass<passes;pass++){
    const split=new Map(),region=new Map(),key=(a,b)=>a<b?a+'_'+b:b+'_'+a;
    const reg=i=>{if(!region.has(i))region.set(i,inR(i));return region.get(i);};
    const want=(a,b)=>{const k=key(a,b);if(split.has(k))return split.get(k)!==false;const r=reg(a)||reg(b);let ok=false;
      if(r&&local(a,r).distanceTo(local(b,r))>maxLen)ok=true;split.set(k,ok?-1:false);return ok;};
    let any=false;
    for(const t of tris)for(let k=0;k<t.length;k+=3){const a=t[k],b=t[k+1],c=t[k+2];if(want(a,b)|want(b,c)|want(c,a))any=true;}
    if(!any)break;
    const M=(a,b)=>{const k=key(a,b);let v=split.get(k);if(v===-1){v=mid(a,b);split.set(k,v);}return v;};
    tris=tris.map(t=>{const o=[];for(let k=0;k<t.length;k+=3){const a=t[k],b=t[k+1],c=t[k+2],e=[split.get(key(a,b))!==false,split.get(key(b,c))!==false,split.get(key(c,a))!==false],n=e[0]+e[1]+e[2];
      if(!n){o.push(a,b,c);continue;}
      if(n===3){const ab=M(a,b),bc=M(b,c),ca=M(c,a);o.push(a,ab,ca, ab,b,bc, ca,bc,c, ab,bc,ca);continue;}
      /* 1·2 개: 나뉜 모서리가 앞에 오게 돌린다 */
      let [x,y,z]=[a,b,c],f=e;
      if(n===1){while(!f[0]){[x,y,z]=[y,z,x];f=[f[1],f[2],f[0]];}const m=M(x,y);o.push(x,m,z, m,y,z);continue;}
      while(f[2]){[x,y,z]=[y,z,x];f=[f[1],f[2],f[0]];}   // 나뉜 둘 = xy, yz
      const m1=M(x,y),m2=M(y,z);o.push(m1,y,m2, x,m1,m2, x,m2,z);}
      return o;});
  }
  const G=new T.BufferGeometry();
  for(const k of names){const at=G0.attributes[k],Arr=at.array.constructor;G.setAttribute(k,new T.BufferAttribute(new Arr(A[k]),size[k],at.normalized));}
  for(const k of Object.keys(MA))G.morphAttributes[k]=MA[k].map(arr=>new T.BufferAttribute(new Float32Array(arr),3));
  G.morphTargetsRelative=G0.morphTargetsRelative;
  const idx=[];G.clearGroups();let start=0;tris.forEach((t,gi)=>{for(let k=0;k<t.length;k++)idx.push(t[k]);if(G0.groups.length)G.addGroup(start,t.length,groups[gi].materialIndex);start+=t.length;});
  G.setIndex(count>65535?new T.Uint32BufferAttribute(idx,1):new T.Uint16BufferAttribute(idx,1));
  G.boundingBox=G0.boundingBox;G.boundingSphere=G0.boundingSphere;G.userData={...G0.userData,handSubdivided:true};
  return G;
}

/* 몸 메시에 손 모프 두 개(오른손 · 왼손)를 더한다. 반환: {set(side,amount), grips:{Right,Left}, targets:[{mesh,index}]} */
export function buildHandGrip(model,charId){
  const P=HAND_GRIP[charId];if(!P)return null;
  if(model.userData.handGrip)return model.userData.handGrip;
  const bones={},meshes=[];model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;if(o.isSkinnedMesh&&!(o.userData&&o.userData.look))meshes.push(o);});
  const grips={},hands={};
  const weightOf=(SI,SW,i,bi)=>{let w=0;for(let k=0;k<4;k++)if(SI.getComponent(i,k)===bi)w+=SW.getComponent(i,k);return w;};
  const handM=(m,bi)=>m.skeleton.boneInverses[bi].clone().multiply(m.bindMatrix);
  for(const side of ['Right','Left']){
    const hand=bones[side+'Hand'],slot=bones[side+'HandSlot'];if(!hand||!slot)continue;
    const verts=[];
    for(const m of meshes){const bi=m.skeleton.bones.indexOf(hand);if(bi<0)continue;const M=handM(m,bi),G=m.geometry,Pp=G.attributes.position,SI=G.attributes.skinIndex,SW=G.attributes.skinWeight;if(!SI)continue;
      for(let i=0;i<Pp.count;i++)if(weightOf(SI,SW,i,bi)>=.6)verts.push(V().fromBufferAttribute(Pp,i).applyMatrix4(M));}
    if(verts.length<30)continue;
    grips[side]=fitHandGrip(verts,slot.quaternion,side,P[side].web,P.r);
    hand.userData.gripPoint=V(...grips[side].c);   // looks.js 그립 노드·왼손 IK 가 이 점을 쓴다
    hand.userData.gripAxis=V(...grips[side].a);    // 주먹 구멍 방향(새끼→엄지) — 왼손 IK 가 무기 축에 맞춘다
    hand.userData.gripFinger=V(...grips[side].f);  // 손가락 방향 — 손잡이 둘레 돌림을 고를 때
    hands[side]=hand;
  }
  const targets=[];
  for(const m of meshes){
    const G0=m.geometry;if(!G0.attributes.skinIndex||!G0.index)continue;
    if(G0.morphAttributes.position&&G0.morphAttributes.position.length&&!G0.morphTargetsRelative)continue;   // 절대 모프와 섞지 않는다(지금 GLB 에는 없다)
    const regions=Object.keys(grips).map(side=>{const bi=m.skeleton.bones.indexOf(hands[side]);if(bi<0)return null;const g=grips[side];return {side,bi,M:handM(m,bi),K:V(...g.K),f:V(...g.f)};}).filter(Boolean);
    if(!regions.length)continue;
    /* 같은 원본 지오메트리를 나눠 쓰는 복제본(온라인 파티 SkeletonUtils.clone)은 만든 결과를 같이 쓴다 — 모프 세기는 메시마다 따로 */
    const cached=G0.userData&&G0.userData.handGripGeo;
    if(cached){m.geometry=cached.G;m.updateMorphTargets();targets.push({mesh:m,index:cached.index,regions});continue;}
    const G=subdivideHands(G0,regions),Pp=G.attributes.position,SI=G.attributes.skinIndex,SW=G.attributes.skinWeight;
    const deltas={};
    for(const r of regions){
      const Mi=r.M.clone().invert(),D=new Float32Array(Pp.count*3);let moved=0;
      for(let i=0;i<Pp.count;i++){const w=weightOf(SI,SW,i,r.bi);if(w<.3)continue;
        const o=V().fromBufferAttribute(Pp,i),l=o.clone().applyMatrix4(r.M),c=handGripShape(l,grips[r.side],1);if(c.distanceToSquared(l)<1e-12)continue;
        const dl=c.applyMatrix4(Mi).sub(o).multiplyScalar(smooth(.3,.7,w));D[i*3]=dl.x;D[i*3+1]=dl.y;D[i*3+2]=dl.z;moved++;}
      if(moved)deltas[r.side]=D;
    }
    if(!Object.keys(deltas).length)continue;
    G.morphTargetsRelative=true;
    const hadMorph=!!(G.morphAttributes.position&&G.morphAttributes.position.length);
    G.morphAttributes.position=(G.morphAttributes.position||[]).slice();
    const withN=!!G.attributes.normal&&(!hadMorph||(G.morphAttributes.normal&&G.morphAttributes.normal.length===G.morphAttributes.position.length));
    G.morphAttributes.normal=withN?(G.morphAttributes.normal||[]).slice():[];
    const ref=withN?normalsOf(G,null):null,index={};
    for(const side of ['Right','Left']){const D=deltas[side]||new Float32Array(Pp.count*3);
      const pa=new T.BufferAttribute(D,3);pa.name='hand_grip_'+side.toLowerCase();G.morphAttributes.position.push(pa);index[side]=G.morphAttributes.position.length-1;
      if(withN){const ND=new Float32Array(Pp.count*3);if(deltas[side]){const nn=normalsOf(G,D);for(let i=0;i<Pp.count*3;i++){const x=nn[i]-ref[i];if(Math.abs(x)>1e-4)ND[i]=x;}}
        G.morphAttributes.normal.push(new T.BufferAttribute(ND,3));}}
    G0.userData.handGripGeo={G,index};
    m.geometry=G;m.updateMorphTargets();targets.push({mesh:m,index,regions});
  }
  const api={grips,targets,amount:{Right:0,Left:0},
    set(side,amount){this.amount[side]=amount;for(const t of targets){const i=t.index[side];if(i!=null&&t.mesh.morphTargetInfluences)t.mesh.morphTargetInfluences[i]=amount;}}};
  model.userData.handGrip=api;return api;
}
/* 위치 +D 로 옮긴 모양의 꼭짓점 법선 — 같은 자리(UV 이음매 복제) 정점은 합쳐서 */
function normalsOf(G,D){
  const P=G.attributes.position,I=G.index,n=P.count,pos=new Float32Array(n*3);for(let i=0;i<n*3;i++)pos[i]=P.array[i]+(D?D[i]:0);
  const key=new Int32Array(n),map=new Map();for(let i=0;i<n;i++){const k=Math.round(P.array[i*3]*1e5)+','+Math.round(P.array[i*3+1]*1e5)+','+Math.round(P.array[i*3+2]*1e5);let id=map.get(k);if(id==null){id=map.size;map.set(k,id);}key[i]=id;}
  const acc=new Float32Array(map.size*3),a=V(),b=V(),c=V(),e1=V(),e2=V();
  const cnt=I?I.count:n;for(let t=0;t<cnt;t+=3){const i0=I?I.getX(t):t,i1=I?I.getX(t+1):t+1,i2=I?I.getX(t+2):t+2;
    a.fromArray(pos,i0*3);b.fromArray(pos,i1*3);c.fromArray(pos,i2*3);e1.subVectors(b,a);e2.subVectors(c,a);e1.cross(e2);
    for(const i of [i0,i1,i2]){const k=key[i]*3;acc[k]+=e1.x;acc[k+1]+=e1.y;acc[k+2]+=e1.z;}}
  const out=new Float32Array(n*3);for(let i=0;i<n;i++){const k=key[i]*3,l=Math.hypot(acc[k],acc[k+1],acc[k+2])||1;out[i*3]=acc[k]/l;out[i*3+1]=acc[k+1]/l;out[i*3+2]=acc[k+2]/l;}
  return out;
}

/* 게임에서 쓰는 한 줄: 모프를 만들고 기본 세기를 준다.
   오른손 = 늘 무기를 쥔다. 왼손 = 류(쌍단검)만 늘 쥔다 · 세라는 빈손 · 카인은 양손 그립 때만(combat-motion 이 올린다) */
export const LEFT_HELD={ryu:1};
export function gripHands(model,charId){
  let api=null;try{api=buildHandGrip(model,charId);}catch(e){console.warn('hand-grip',e);return null;}
  if(api){api.set('Right',1);api.set('Left',LEFT_HELD[charId]||0);}
  return api;
}
