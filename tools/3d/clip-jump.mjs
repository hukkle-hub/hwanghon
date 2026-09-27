/* 전용 도약 클립 «jump» 굽기 (docs/design/113 §7-2).
 * 입력: rig_char.py 를 CLIPS_ONLY=jump:Jump_Full_Short 로 돌린 임시 GLB(KayKit 점프 1.17 s 리타게팅).
 * 출력: glb-put-clips.mjs 가 먹는 JSON — 0.60 s 클립. 앞 0.45 s(AIR) 가 규칙 R.jump.dur 의 공중 구간이라
 *       game3d 가 jumpT 로 스크럽하고, 뒤 0.15 s 는 착지 기립(착지 뒤 흘려 보낸다).
 *   node tools/3d/clip-jump.mjs <임시.glb> [src clip=jump] > jump.json
 * 하는 일: (1) 시간 재배치 — 웅크림 0.06 s → 도약 → 정점(0.22 s) → 낙하 → 착지 0.40 s → 기립.
 *          (2) 골반 높이 — 공중 상승분은 규칙의 포물선(R.jump.height)이 올리므로 클립에선 15 % 만 남기고,
 *              웅크림·착지 «가라앉음» 은 60 % 로 남긴다(두 번 올라가지 않게).
 *          (3) 정점 창(0.10~0.40 s)에 «뛰어넘기» 실루엣을 얹는다 — 상체 앞숙임 0.22 rad, 허벅지 -0.25, 무릎 +0.30(다리 모으기).
 * 값은 문서 113 §7-1 의 판단(«점프» 가 아니라 «뛰어넘기» 로 읽히게)에서 정한 것으로 실측 근거는 없다 — 시트로 검수. */
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
const [F,SRC='jump']=process.argv.slice(2), FPS=60, DUR=0.60, AIR=0.45;
/* ARMS=<rad>: 팔 벌림 줄이기 — 원본은 양팔을 옆으로 크게 벌리는데 대검 캐릭터(카인)엔 커 보인다(디렉터 「카인 팔 벌림 줄여」). 0.03~0.50 s 에 위팔을 몸쪽으로 |ARMS| rad */
const ARMS=+(process.env.ARMS||0);
function armW(t){ if(t<=0.03||t>=0.50) return 0; const u=t<0.12?(t-0.03)/0.09:t>0.42?(0.50-t)/0.08:1; return u*u*(3-2*u); }
/* 출력 시각 → 원본 시각 (Jump_Full_Short: 웅크림 바닥 0.27 · 이륙 0.40 · 정점 0.47 · 착지 0.68 · 착지 바닥 0.76 · 기립 1.03) */
const MAP=[[0,0.17],[0.06,0.27],[0.13,0.40],[0.22,0.47],[0.32,0.55],[0.40,0.68],[0.45,0.76],[0.60,1.03]];
function srcTime(t){ for(let i=1;i<MAP.length;i++){ if(t<=MAP[i][0]){ const [a,b]=MAP[i-1],[c,d]=MAP[i]; return b+(d-b)*(t-a)/(c-a); } } return MAP.at(-1)[1]; }
/* 정점 창 가중 0→1→0 (0.10~0.40 s, 정점 0.22) */
function tuck(t){ if(t<=0.10||t>=0.40) return 0; const u=t<0.22?(t-0.10)/0.12:1-(t-0.22)/0.18; return u*u*(3-2*u); }
const LAYER={Spine:['x',0.22],Spine1:['x',0.06],LeftUpLeg:['x',-0.25],RightUpLeg:['x',-0.20],LeftLeg:['x',0.30],RightLeg:['x',0.26]};
const b=fs.readFileSync(F), l=new GLTFLoader(); l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
const g=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
const c=g.animations.find(a=>a.name===SRC); if(!c) throw new Error('클립 없음: '+SRC);
const G={}, order=[]; g.scene.traverse(o=>{ if(o.isBone){ const n=o.name.replace(/^mixamorig:?/,''); G[n]=o; order.push(n); } });
const restHipsY=G.Hips.position.y;
const m=new T.AnimationMixer(g.scene), a=m.clipAction(c); a.play(); a.paused=true;
const N=Math.round(DUR*FPS), tracks=Object.fromEntries(order.map(n=>[n,[]])), hips=[], times=[];
const AX={x:new T.Vector3(1,0,0),y:new T.Vector3(0,1,0),z:new T.Vector3(0,0,1)};
for(let i=0;i<=N;i++){ const t=DUR*i/N; a.time=Math.min(c.duration-1e-4,srcTime(t)); m.update(0);
  const k=tuck(t);
  for(const n of order){ const q=G[n].quaternion.clone(); const L=LAYER[n]; if(L&&k>0) q.multiply(new T.Quaternion().setFromAxisAngle(AX[L[0]],L[1]*k));
    if(ARMS&&(n==='LeftArm'||n==='RightArm')){ const w=armW(t); if(w>0) q.multiply(new T.Quaternion().setFromAxisAngle(AX.z,(n==='LeftArm'?1:-1)*ARMS*w)); }
    const p=tracks[n][tracks[n].length-1]; if(p&&p.dot(q)<0) q.set(-q.x,-q.y,-q.z,-q.w); tracks[n].push(q); }
  const hp=G.Hips.position.clone(), dy=hp.y-restHipsY; hp.y=restHipsY+(dy<0?dy*0.6:dy*0.15); hips.push(hp); times.push(+t.toFixed(5)); }
console.log(JSON.stringify({name:'jump', source:F.split('/').pop(), sourceClip:'KayKit Jump_Full_Short → clip-jump', duration:DUR, air:AIR, fps:FPS, times,
  tracks:Object.fromEntries(order.map(n=>[n,tracks[n].flatMap(q=>[q.x,q.y,q.z,q.w].map(v=>+v.toFixed(6)))])), hips:hips.flatMap(p=>[p.x,p.y,p.z].map(v=>+v.toFixed(5)))}));
process.stderr.write(`jump: ${N+1} 키, ${DUR} s (공중 ${AIR} s), 골반 rest ${restHipsY.toFixed(3)} → ${Math.min(...hips.map(p=>p.y)).toFixed(3)}..${Math.max(...hips.map(p=>p.y)).toFixed(3)}\n`);
