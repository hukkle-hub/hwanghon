/* 옷(코트)을 캐릭터 몸에 입혀 스킨 무게까지 굽는다 — 방역 코트 (docs/design/84).
 *
 * 왜: 무릎까지 오고 소매가 있는 코트를 뼈 하나에 딱딱하게 붙이면 걸을 때 다리·팔이 뚫고 나온다.
 * 몸과 같이 휘려면 코트 정점마다 몸의 뼈 무게가 있어야 한다. 캐릭터마다 몸이 달라 캐릭터마다 굽는다.
 *
 *   1. 코트를 아인 바인드 자세에 한 번 맞춘다(--fit 배율,x,y,z · 정면 +X → +Z). 아인은 소매가 팔과 이미 맞는다.
 *   2. 아인 몸에서 무게를 옮긴다(가까운 몸 정점 k 개, 거리 역제곱) → 코트 위에서 이웃끼리 고르게(용접한 이웃)
 *   3. 다른 캐릭터: 뼈마다 «아인 뼈 → 그 캐릭터 뼈» 변환(관절 위치·방향·길이로 만든 틀, 뼈 롤 규약과 무관)을
 *      아인 무게로 섞어 코트를 옮긴다 — 팔 각도·키·어깨 폭이 따라간다
 *   4. 몸 밖으로 밀어낸다: 가장 가까운 몸 정점의 노멀 쪽으로 여유(--margin) 만큼. 밀어낸 양은 코트 위에서 고르게
 *   5. 그 캐릭터 몸에서 무게를 다시 옮겨 JOINTS_0/WEIGHTS_0 로, 뼈 이름 표는 메시 extras.joints 에
 *
 * 결과 glb 는 스킨이 없는 보통 메시(정점 = 그 캐릭터 몸 메시의 바인드 공간)다. js/looks.js 가 불러
 * SkinnedMesh 로 바꿔 몸 skeleton 에 묶는다(뼈 이름으로 번호를 맞춤).
 *
 *   node tools/3d/garment-fit.mjs <코트 glb> <캐릭터> <출력 glb> [--fit 1,0,0.99,0.01] [--margin 0.012] [--k 8] [--smooth 6]
 */
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
const args=process.argv.slice(2), [SRC,CH,OUT]=args;
const opt=(k,d)=>args.includes('--'+k)?args[args.indexOf('--'+k)+1]:d;
const FIT=opt('fit','1,0,0.99,0.01').split(',').map(Number), MARGIN=+opt('margin',0.012), K=+opt('k',8), SMOOTH=+opt('smooth',6);
const MAXPUSH=+opt('max-push',0.03), NEAR_HIDE=+opt('near-hide',0.06), RAD=+opt('rad',0.04);
const load=async f=>{const b=fs.readFileSync(f),l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const log=s=>process.stderr.write(s+'\n');

/* ── 몸: 바인드 공간 정점·노멀·무게, 관절 ── */
async function body(ch){
  const g=await load(`art/3d/${ch}_anim.glb`); g.scene.updateMatrixWorld(true);
  const sms=[]; g.scene.traverse(o=>{ if(o.isSkinnedMesh) sms.push(o); });
  const sk=sms[0].skeleton, names=sk.bones.map(b=>b.name.replace(/^mixamorig:?/,''));
  let n=0; sms.forEach(m=>n+=m.geometry.attributes.position.count);
  const P=new Float32Array(n*3), N=new Float32Array(n*3), J=new Uint16Array(n*4), W=new Float32Array(n*4); let o=0;
  for(const m of sms){ if(m.skeleton!==sk) throw new Error('뼈대가 둘'); const G=m.geometry, a=G.attributes, v=new T.Vector3(), nm=new T.Matrix3().getNormalMatrix(m.bindMatrix);
    for(let i=0;i<a.position.count;i++,o++){ v.fromBufferAttribute(a.position,i).applyMatrix4(m.bindMatrix); P.set([v.x,v.y,v.z],o*3);
      v.fromBufferAttribute(a.normal,i).applyMatrix3(nm).normalize(); N.set([v.x,v.y,v.z],o*3);
      for(let c=0;c<4;c++){ J[o*4+c]=a.skinIndex.getComponent(i,c); W[o*4+c]=a.skinWeight.getComponent(i,c); } } }
  const joint={}; sk.bones.forEach((b,i)=>{ joint[names[i]]=new T.Vector3().setFromMatrixPosition(sk.boneInverses[i].clone().invert()); });
  const bindInv=sms[0].bindMatrix.clone().invert();
  return { P, N, J, W, n, names, joint, bindInv, counts:sms.map(m=>m.geometry.attributes.position.count) };
}

/* ── 격자 최근접 ── */
function grid(P, cell){ const m=new Map(), key=(x,y,z)=>x+','+y+','+z;
  for(let i=0;i<P.length/3;i++){ const k=key(Math.floor(P[i*3]/cell),Math.floor(P[i*3+1]/cell),Math.floor(P[i*3+2]/cell)); let a=m.get(k); if(!a) m.set(k,a=[]); a.push(i); }
  return { knn(x,y,z,k){ for(let r=1;r<=12;r*=2){ const cx=Math.floor(x/cell),cy=Math.floor(y/cell),cz=Math.floor(z/cell), out=[];
      for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++)for(let l=-r;l<=r;l++){ const a=m.get(key(cx+i,cy+j,cz+l)); if(!a) continue;
        for(const q of a){ const dx=P[q*3]-x,dy=P[q*3+1]-y,dz=P[q*3+2]-z; out.push([dx*dx+dy*dy+dz*dz,q]); } }
      if(out.length>=k){ out.sort((a,b)=>a[0]-b[0]); if(Math.sqrt(out[k-1][0])<=r*cell) return out.slice(0,k); } }
    return []; } };
}

/* ── 코트 ── */
const raw=fs.readFileSync(SRC), jl=raw.readUInt32LE(12), GJ=JSON.parse(raw.subarray(20,20+jl).toString()), bl=raw.readUInt32LE(20+jl), BIN=Buffer.from(raw.subarray(28+jl,28+jl+bl));
const prim=GJ.meshes[0].primitives[0];
const acc=(i,C,nc)=>{ const A=GJ.accessors[i], V=GJ.bufferViews[A.bufferView], off=(V.byteOffset||0)+(A.byteOffset||0); return new C(BIN.buffer.slice(BIN.byteOffset+off, BIN.byteOffset+off+A.count*nc*C.BYTES_PER_ELEMENT)); };
const CP0=acc(prim.attributes.POSITION,Float32Array,3), CN0=acc(prim.attributes.NORMAL,Float32Array,3);
const IA=GJ.accessors[prim.indices], IDX=IA.componentType===5125?acc(prim.indices,Uint32Array,1):acc(prim.indices,Uint16Array,1);
const nv=CP0.length/3;
/* 1. 아인 자리: 정면 +X → +Z (Y 축 −90°), 배율·이동 */
const [s,tx,ty,tz]=FIT, CP=new Float32Array(nv*3), CN=new Float32Array(nv*3);
for(let i=0;i<nv;i++){ const x=CP0[i*3],y=CP0[i*3+1],z=CP0[i*3+2]; CP.set([-z*s+tx, y*s+ty, x*s+tz],i*3); CN.set([-CN0[i*3+2],CN0[i*3+1],CN0[i*3]],i*3); }
/* 용접 이웃(UV 이음새로 갈라진 정점을 한 점으로) */
const weld=new Int32Array(nv), wm=new Map(); let nw=0;
for(let i=0;i<nv;i++){ const k=Math.round(CP0[i*3]*2e4)+','+Math.round(CP0[i*3+1]*2e4)+','+Math.round(CP0[i*3+2]*2e4); let w=wm.get(k); if(w==null){ wm.set(k,w=nw++); } weld[i]=w; }
const nbr=Array.from({length:nw},()=>new Set());
for(let t=0;t<IDX.length;t+=3){ const a=weld[IDX[t]],b=weld[IDX[t+1]],c=weld[IDX[t+2]]; nbr[a].add(b).add(c); nbr[b].add(a).add(c); nbr[c].add(a).add(b); }
const NB=nbr.map(s=>[...s]);
/* 용접점 단위로 값 고르기: F[nw*d] */
function smoothW(F,d,it,lam=0.5){ for(let k=0;k<it;k++){ const G=F.slice(); for(let i=0;i<nw;i++){ const nb=NB[i]; if(!nb.length) continue;
  for(let c=0;c<d;c++){ let s=0; for(const j of nb) s+=F[j*d+c]; G[i*d+c]=F[i*d+c]*(1-lam)+lam*s/nb.length; } } F.set(G); } return F; }

/* 2·5. 몸 무게 옮기기 → 용접점마다 뼈별 무게(dense) */
/* 소매 / 몸판: 아인 자리(정준 자세)에서 팔 뼈대 선분 가까이(9 cm) + 손목보다 위면 소매. 몸판(치마)은 팔 뼈를, 소매는 다리 뼈를 못 받는다.
   카인은 손이 넓게 벌어져 치마 옆에 닿아 있어, 치마가 손 무게를 받아 팔을 움직이면 한 판이 옆으로 뜯겨 나왔다. */
const ARM=/(Arm|ForeArm|Hand)/, LEG=/(UpLeg|Leg|Foot|Toe)/; let SLEEVE=null;
function segD(p,a,b){ const ab=b.clone().sub(a), t=Math.max(0,Math.min(1,p.clone().sub(a).dot(ab)/ab.lengthSq())); return p.distanceTo(a.clone().addScaledVector(ab,t)); }
function labelSleeves(A){ SLEEVE=new Uint8Array(nw); const v=new T.Vector3(); let n=0;
  for(let i=0;i<nv;i++){ const w=weld[i]; if(SLEEVE[w]) continue; v.set(CP[i*3],CP[i*3+1],CP[i*3+2]);
    for(const sd of ['Left','Right']){ const j=A.joint, sh=j[sd+'Arm'], el=j[sd+'ForeArm'], wr=j[sd+'Hand'];
      if(v.y>wr.y-0.03 && Math.min(segD(v,sh,el),segD(v,el,wr))<0.09 && Math.abs(v.x)>Math.abs(sh.x)*0.9){ SLEEVE[w]=1; n++; break; } } }
  log(`소매 점 ${n} / ${nw}`); }
function transfer(B, P){ const nb=B.names.length, F=new Float32Array(nw*nb), cnt=new Float32Array(nw), gr=grid(B.P,0.03), bad=B.names.map(n=>[ARM.test(n),LEG.test(n)]);
  for(let i=0;i<nv;i++){ const w=weld[i]; const near=gr.knn(P[i*3],P[i*3+1],P[i*3+2],K); if(!near.length) continue;
    for(const [d2,q] of near){ const f=1/(d2+1e-5); for(let c=0;c<4;c++){ const wt=B.W[q*4+c], bj=B.J[q*4+c]; if(wt>0 && !(SLEEVE[w]?bad[bj][1]:bad[bj][0])) F[w*nb+bj]+=f*wt; } } cnt[w]++; }
  for(let w=0;w<nw;w++){ let s=0; for(let c=0;c<nb;c++) s+=F[w*nb+c]; if(s>0) for(let c=0;c<nb;c++) F[w*nb+c]/=s; }
  smoothW(F,nb,SMOOTH);
  /* 공간으로도 고르게: 코트는 겉감·안감·끈·주머니가 서로 안 붙은 여러 겹이다. 겹마다 다른 몸 정점의 무게를 받으면 움직일 때 서로 벌어져
     안감이 틈으로 보이고(검은 금), 겨드랑이에선 한 겹이 튀어나왔다. 위상과 상관없이 반경 RAD 안 점들의 무게를 가우스로 섞는다. */
  const WP=new Float32Array(nw*3), wc=new Float32Array(nw); for(let i=0;i<nv;i++){ const w=weld[i]; WP[w*3]+=P[i*3]; WP[w*3+1]+=P[i*3+1]; WP[w*3+2]+=P[i*3+2]; wc[w]++; }
  for(let w=0;w<nw;w++){ WP[w*3]/=wc[w]||1; WP[w*3+1]/=wc[w]||1; WP[w*3+2]/=wc[w]||1; }
  const gw=grid(WP,RAD), waist=B.joint.Spine1.y;
  for(let it=0;it<2;it++){ const G=new Float32Array(F.length);
    for(let w=0;w<nw;w++){ const near=gw.knn(WP[w*3],WP[w*3+1],WP[w*3+2],32); let tot=0;
      for(const [d2,q] of near){ if(d2>RAD*RAD || (SLEEVE[q]!==SLEEVE[w] && Math.min(WP[w*3+1],WP[q*3+1])<waist)) continue;   /* 가슴 위 겨드랑이는 섞는다 — 안 섞으니 팔을 들 때 이음새가 벌어졌다 */ const f=Math.exp(-d2/(RAD*RAD*0.5));   /* 소매 끝과 치마는 섞지 않는다 */ tot+=f; for(let c=0;c<nb;c++) G[w*nb+c]+=f*F[q*nb+c]; }
      if(tot>0) for(let c=0;c<nb;c++) G[w*nb+c]/=tot; else for(let c=0;c<nb;c++) G[w*nb+c]=F[w*nb+c]; }
    F.set(G); }
  return F; }

/* 3. 뼈 틀: 관절 위치로 만든 [원점, 축 3개, 길이] — 뼈 롤 규약과 무관 */
const CHILD={Hips:'Spine',Spine:'Spine1',Spine1:'Spine2',Spine2:'Neck',Neck:'Head',Head:null,
  LeftShoulder:'LeftArm',LeftArm:'LeftForeArm',LeftForeArm:'LeftHand',LeftHand:null,RightShoulder:'RightArm',RightArm:'RightForeArm',RightForeArm:'RightHand',RightHand:null,
  LeftUpLeg:'LeftLeg',LeftLeg:'LeftFoot',LeftFoot:'LeftToeBase',RightUpLeg:'RightLeg',RightLeg:'RightFoot',RightFoot:'RightToeBase'};
const PARENT={Head:'Neck',LeftHand:'LeftForeArm',RightHand:'RightForeArm',LeftToeBase:'LeftFoot',RightToeBase:'RightFoot'};
function frame(Bj, name){ const h=Bj[name]; if(!h) return null; let dir;
  if(CHILD[name]&&Bj[CHILD[name]]) dir=Bj[CHILD[name]].clone().sub(h); else if(PARENT[name]&&Bj[PARENT[name]]) dir=h.clone().sub(Bj[PARENT[name]]); else return null;
  const len=dir.length(), y=dir.normalize(); let x=new T.Vector3(1,0,0); if(Math.abs(x.dot(y))>0.9) x=new T.Vector3(0,0,1);
  x.addScaledVector(y,-x.dot(y)).normalize(); const z=new T.Vector3().crossVectors(x,y);
  return { h, R:new T.Matrix4().makeBasis(x,y,z), len }; }
function retargetMats(A, X){ const hA=A.joint.Head.y-Math.min(A.joint.LeftFoot.y,A.joint.RightFoot.y), hX=X.joint.Head.y-Math.min(X.joint.LeftFoot.y,X.joint.RightFoot.y);
  const shA=A.joint.LeftArm.distanceTo(A.joint.RightArm), shX=X.joint.LeftArm.distanceTo(X.joint.RightArm), hipA=A.joint.LeftUpLeg.distanceTo(A.joint.RightUpLeg), hipX=X.joint.LeftUpLeg.distanceTo(X.joint.RightUpLeg);
  const M=A.names.map(nm=>{ const fa=frame(A.joint,nm), fx=frame(X.joint,nm); if(!fa||!fx) return null;
    /* 옆 방향 배율: 몸통 = 어깨 폭 비, 골반·다리 = 골반 폭 비, 나머지 = 키 비 */
    /* 몸통·어깨는 키 비 하나로(축별로 다르게 키우면 어깨 뼈 틀(가로 방향)과 가슴 뼈 틀(세로 방향)의 배율이 엇갈려 섞이는 가슴에서 코트가
       구겨졌다 — 류·세라 앞섶). 팔·다리만 뼈 길이 비. 둘레 차이는 4 단계 밀어내기가 맡는다 */
    const lat=hX/hA, ax=/Arm|Leg/.test(nm)?Math.min(1.5,Math.max(0.7,fx.len/fa.len)):hX/hA;
    return new T.Matrix4().makeTranslation(fx.h.x,fx.h.y,fx.h.z).multiply(fx.R).multiply(new T.Matrix4().makeScale(lat,ax,lat)).multiply(fa.R.clone().transpose()).multiply(new T.Matrix4().makeTranslation(-fa.h.x,-fa.h.y,-fa.h.z)); });
  log(`키 비 ${(hX/hA).toFixed(3)} · 어깨 폭 비 ${(shX/shA).toFixed(3)} · 골반 폭 비 ${(hipX/hipA).toFixed(3)}`);
  return M; }

const A=await body('ain');
labelSleeves(A);
const FA=transfer(A, CP);
let P=CP.slice(), Nn=CN.slice(), X=A;
if(CH!=='ain'){ X=await body(CH); const M=retargetMats(A,X), nb=A.names.length, v=new T.Vector3(), nrm=new T.Vector3(), acc4=new T.Matrix4();
  for(let i=0;i<nv;i++){ const w=weld[i], e=new Float32Array(16); let tot=0;
    for(let b=0;b<nb;b++){ const f=FA[w*nb+b]; if(f<1e-4||!M[b]) continue; const me=M[b].elements; for(let q=0;q<16;q++) e[q]+=f*me[q]; tot+=f; }
    if(tot<1e-6) continue; for(let q=0;q<16;q++) e[q]/=tot; acc4.fromArray(e);
    v.set(CP[i*3],CP[i*3+1],CP[i*3+2]).applyMatrix4(acc4); P.set([v.x,v.y,v.z],i*3);
    nrm.set(CN[i*3],CN[i*3+1],CN[i*3+2]).applyMatrix3(new T.Matrix3().getNormalMatrix(acc4)).normalize(); Nn.set([nrm.x,nrm.y,nrm.z],i*3); } }

/* 4. 몸 밖으로 — 용접점 단위 변위를 고르게, 세 번 반복 */
{ const gr=grid(X.P,0.03);
  for(let it=0;it<6;it++){ const D=new Float32Array(nw*3), c=new Float32Array(nw); let pushed=0;
    for(let i=0;i<nv;i++){ const w=weld[i]; if(c[w]) continue; c[w]=1; const x=P[i*3],y=P[i*3+1],z=P[i*3+2], near=gr.knn(x,y,z,4); if(!near.length) continue;
      /* 가까운 몸 정점 4 개의 평균 면(점·노멀) 기준 */
      let px=0,py=0,pz=0,nx=0,ny=0,nz=0; for(const [,q] of near){ px+=X.P[q*3];py+=X.P[q*3+1];pz+=X.P[q*3+2]; nx+=X.N[q*3];ny+=X.N[q*3+1];nz+=X.N[q*3+2]; }
      px/=near.length;py/=near.length;pz/=near.length; const nl=Math.hypot(nx,ny,nz)||1; nx/=nl;ny/=nl;nz/=nl;
      const d=(x-px)*nx+(y-py)*ny+(z-pz)*nz; if(d<MARGIN){ const m=Math.min(MAXPUSH,MARGIN-d); D.set([nx*m,ny*m,nz*m],w*3); pushed++; } }
    /* 공간으로 고르게(반경 5 cm, 겹 상관없이) — 겉감과 탄띠·주머니가 서로 다르게 밀리면 앞섶이 조각조각 구겨졌다. 여러 번 돌며 모자란 만큼 더 민다 */
    { const WP=new Float32Array(nw*3), wc=new Float32Array(nw); for(let i=0;i<nv;i++){ const w=weld[i]; WP[w*3]+=P[i*3]; WP[w*3+1]+=P[i*3+1]; WP[w*3+2]+=P[i*3+2]; wc[w]++; }
      for(let w=0;w<nw;w++){ WP[w*3]/=wc[w]||1; WP[w*3+1]/=wc[w]||1; WP[w*3+2]/=wc[w]||1; }
      const gw=grid(WP,0.05), S=new Float32Array(nw*3), R2=0.05*0.05;
      for(let w=0;w<nw;w++){ const near=gw.knn(WP[w*3],WP[w*3+1],WP[w*3+2],32); let t=0;
        for(const [d2,q] of near){ if(d2>R2) continue; const f=Math.exp(-d2/(R2*0.5)); t+=f; S[w*3]+=f*D[q*3]; S[w*3+1]+=f*D[q*3+1]; S[w*3+2]+=f*D[q*3+2]; }
        if(t>0){ S[w*3]/=t; S[w*3+1]/=t; S[w*3+2]/=t; } }
      D.set(S); }
    for(let i=0;i<nv;i++){ const w=weld[i]; P[i*3]+=D[w*3]; P[i*3+1]+=D[w*3+1]; P[i*3+2]+=D[w*3+2]; }
    log(`밀어내기 ${it+1}: ${pushed} 점`); } }

/* 5. 무게 */
const FX=transfer(X, P), nb=X.names.length, JO=new Uint16Array(nv*4), WO=new Float32Array(nv*4), used=new Set();
for(let i=0;i<nv;i++){ const w=weld[i], row=[]; for(let b=0;b<nb;b++){ const f=FX[w*nb+b]; if(f>1e-3) row.push([f,b]); } row.sort((a,b)=>b[0]-a[0]);
  const top=row.slice(0,4), s=top.reduce((a,r)=>a+r[0],0)||1; top.forEach(([f,b],c)=>{ JO[i*4+c]=b; WO[i*4+c]=f/s; used.add(b); }); if(!top.length){ JO[i*4]=X.names.indexOf('Spine1'); WO[i*4]=1; } }
/* 6. 가릴 몸 정점: 몸 표면에서 바깥(노멀)으로 1~10 cm 사이에 코트 정점이 있으면 «코트 밑» — 입고 있는 동안 그 삼각형을 숨긴다.
   캐릭터 자기 옷(아인 너덜 치마·카인 재킷 깃)이 코트를 뚫고 나왔다. 앞섶처럼 코트가 벌어진 곳은 바깥에 코트가 없어 안 숨는다. */
const HIDE=[], KEEP=/(Hand|Head|Foot|Toe)/; { const gc=grid(P,0.02); let o=0, hid=0;
  for(const cnt of X.counts){ const bits=new Uint8Array(Math.ceil(cnt/8));
    for(let i=0;i<cnt;i++){ const q=o+i, px=X.P[q*3],py=X.P[q*3+1],pz=X.P[q*3+2], nx=X.N[q*3],ny=X.N[q*3+1],nz=X.N[q*3+2];
      /* 손·머리·발은 안 숨긴다(소매 끝·깃에 가까워도) */
      let tb=0; for(let c=1;c<4;c++) if(X.W[q*4+c]>X.W[q*4+tb]) tb=c; if(KEEP.test(X.names[X.J[q*4+tb]])) continue;
      /* 코트 겉 가까이(NEAR_HIDE)까지 나온 몸 옷도 숨긴다 — 류의 긴 코트·세라의 부푼 소매·치마가 코트를 뚫고 나왔다 */
      const nn=gc.knn(px,py,pz,1); if(nn.length&&nn[0][0]<NEAR_HIDE*NEAR_HIDE){ bits[i>>3]|=1<<(i&7); hid++; continue; }
      for(let d=0.01; d<=0.10; d+=0.015){ const near=gc.knn(px+nx*d,py+ny*d,pz+nz*d,1); if(near.length&&near[0][0]<0.015*0.015){ bits[i>>3]|=1<<(i&7); hid++; break; } } }
    HIDE.push(Buffer.from(bits).toString('base64')); o+=cnt; }
  log(`가릴 몸 정점 ${hid} / ${X.n}`); }
/* 몸 메시 공간으로(바인드 행렬이 단위면 그대로) */
{ const v=new T.Vector3(); for(let i=0;i<nv;i++){ v.set(P[i*3],P[i*3+1],P[i*3+2]).applyMatrix4(X.bindInv); P.set([v.x,v.y,v.z],i*3); } }

/* ── 쓰기: POSITION·NORMAL 교체, JOINTS_0·WEIGHTS_0 추가 ── */
const chunks=[BIN]; let blen=BIN.length;
function add(arr, ctype, type, count, target){ while(blen%4){ chunks.push(Buffer.alloc(1)); blen++; } const b=Buffer.from(arr.buffer,arr.byteOffset,arr.byteLength);
  GJ.bufferViews.push({buffer:0,byteOffset:blen,byteLength:b.length,target:34962}); chunks.push(b); blen+=b.length;
  const a={bufferView:GJ.bufferViews.length-1,componentType:ctype,count,type}; GJ.accessors.push(a); return GJ.accessors.length-1; }
const pi=add(P,5126,'VEC3',nv), ni=add(Nn,5126,'VEC3',nv), ji=add(JO,5123,'VEC4',nv), wi=add(WO,5126,'VEC4',nv);
const mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9]; for(let i=0;i<nv;i++) for(let c=0;c<3;c++){ mn[c]=Math.min(mn[c],P[i*3+c]); mx[c]=Math.max(mx[c],P[i*3+c]); }
GJ.accessors[pi].min=mn; GJ.accessors[pi].max=mx;
Object.assign(prim.attributes,{POSITION:pi,NORMAL:ni,JOINTS_0:ji,WEIGHTS_0:wi});
GJ.meshes[0].extras={ joints:X.names, garment:CH, hide:HIDE };
/* 옛 POSITION·NORMAL 은 버리고 다시 싼다 */
let bin=Buffer.concat(chunks); const keep=new Set([...GJ.accessors.map(a=>a.bufferView),...(GJ.images||[]).map(i=>i.bufferView)].filter(v=>v!=null));
const alive=GJ.accessors.map((a,i)=>i).filter(i=>[pi,ni,ji,wi,prim.attributes.TEXCOORD_0,prim.indices].includes(i));
const amap={}, newAcc=[]; alive.forEach(i=>{ amap[i]=newAcc.length; newAcc.push(GJ.accessors[i]); });
for(const k in prim.attributes) prim.attributes[k]=amap[prim.attributes[k]]; prim.indices=amap[prim.indices]; GJ.accessors=newAcc;
const vset=[...new Set([...GJ.accessors.map(a=>a.bufferView),...(GJ.images||[]).map(i=>i.bufferView).filter(v=>v!=null)])].sort((a,b)=>a-b);
const vmap={}, views=[], parts=[]; let off=0;
for(const v of vset){ const V=GJ.bufferViews[v]; while(off%4){ parts.push(Buffer.alloc(1)); off++; } parts.push(bin.subarray(V.byteOffset||0,(V.byteOffset||0)+V.byteLength)); vmap[v]=views.length; views.push({...V,byteOffset:off}); off+=V.byteLength; }
GJ.accessors.forEach(a=>a.bufferView=vmap[a.bufferView]); (GJ.images||[]).forEach(i=>{ if(i.bufferView!=null) i.bufferView=vmap[i.bufferView]; });
GJ.bufferViews=views; while(off%4){ parts.push(Buffer.alloc(1)); off++; } bin=Buffer.concat(parts); GJ.buffers=[{byteLength:bin.length}];
let js=Buffer.from(JSON.stringify(GJ)); js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);
const hdr=Buffer.alloc(12); hdr.writeUInt32LE(0x46546C67,0); hdr.writeUInt32LE(2,4); hdr.writeUInt32LE(12+8+js.length+8+bin.length,8);
const ch=(len,type)=>{ const b=Buffer.alloc(8); b.writeUInt32LE(len,0); b.writeUInt32LE(type,4); return b; };
fs.writeFileSync(OUT, Buffer.concat([hdr,ch(js.length,0x4E4F534A),js,ch(bin.length,0x004E4942),bin]));
log(`${CH}: 정점 ${nv} · 쓰인 뼈 ${[...used].map(b=>X.names[b]).join(' ')} → ${OUT} (${(fs.statSync(OUT).size/1024).toFixed(0)} KB)`);
