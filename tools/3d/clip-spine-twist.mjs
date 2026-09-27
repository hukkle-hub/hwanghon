/* 연계 이음매용 «상체 비틀기» 굽기 (문서 120).
 * 이어지는 두 공격의 끝·시작 가슴 방향이 다르면(1 타 끝 −53° · 새 2 타 시작 +10°) 0.05 초 섞기 동안 가슴이 중립 쪽으로
 * 휙 돌았다가 다시 감긴다 — 「1 타 → 중립 → 2 타」. meshy-retarget 의 --chest 는 «몸 전체» 를 돌려서 디딘 발이 골반 축을 돌아
 * 수십 cm 끌리고, 발 고정 굽기가 그만큼 골반을 옮겨 버렸다(58~67 cm). 여기서는 골반·다리는 그대로 두고
 * Spine·Spine1·Spine2 세 마디에 세계 수직축 비틀기 θ(u)를 1/3 씩 나눠 얹는다:
 *     θ(u) = θ0                       (u ≤ hold)
 *          = θ0·(1 − smootherstep((u−hold)/(until−hold)))   (hold < u < until)
 *          = 0                        (u ≥ until)
 * 접점·따라감 구간(u ≥ until)은 원본 그대로다.
 * --from f 를 주면 처음(u ≤ f)은 원본 그대로 두고 f → hold 동안 smootherstep 으로 θ0 까지 감는다 — 클립 한가운데만 더 비틀 때.
 *   node tools/3d/clip-spine-twist.mjs <캐릭터.glb> <클립.json> --deg -60 --hold .10 --until .30 [--from 0] > out.json */
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
const args=process.argv.slice(2), GLB=args[0], JS=args[1], opt=(k,d)=>{const i=args.indexOf(k);return i>0?+args[i+1]:d;};
const DEG=opt('--deg',0), HOLD=opt('--hold',.1), UNTIL=opt('--until',.3), FROM=opt('--from',-1);
const b=fs.readFileSync(GLB), l=new GLTFLoader(); l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
const g=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
const c=JSON.parse(fs.readFileSync(JS,'utf8'));
const B={}; g.scene.traverse(o=>{if(o.isBone)B[o.name.replace(/^mixamorig:?/,'')]=o;});
const N=c.times.length, SP=['Spine','Spine1','Spine2'].filter(n=>c.tracks[n]&&B[n]);
if(SP.length<3) throw new Error('Spine·Spine1·Spine2 트랙이 필요하다');
const ss=u=>u*u*u*(u*(u*6-15)+10), theta=u=>DEG*Math.PI/180*(FROM>=0&&u<HOLD?(u<=FROM?0:ss((u-FROM)/(HOLD-FROM))):u<=HOLD?1:u>=UNTIL?0:1-ss((u-HOLD)/(UNTIL-HOLD)));
const up=new T.Vector3(0,1,0), out={}; for(const n of SP) out[n]=c.tracks[n].slice();
const q=(arr,i)=>new T.Quaternion(arr[4*i],arr[4*i+1],arr[4*i+2],arr[4*i+3]);
for(let i=0;i<N;i++){
  /* 이 프레임 자세 세우기 (클립 트랙 → 로컬 회전, 골반 위치) */
  for(const [n,v] of Object.entries(c.tracks)) if(B[n]) B[n].quaternion.copy(q(v,i));
  if(c.hips&&B.Hips) B.Hips.position.set(c.hips[3*i],c.hips[3*i+1],c.hips[3*i+2]);
  g.scene.updateMatrixWorld(true);
  const th=theta(N>1?i/(N-1):0)/SP.length;
  for(const n of SP){ const bone=B[n];
    if(th){ const pw=bone.parent.getWorldQuaternion(new T.Quaternion()), w=bone.getWorldQuaternion(new T.Quaternion());
      const nw=new T.Quaternion().setFromAxisAngle(up,th).multiply(w);
      bone.quaternion.copy(pw.invert().multiply(nw)); bone.updateMatrixWorld(true); }
    const r=bone.quaternion; out[n][4*i]=+r.x.toFixed(6); out[n][4*i+1]=+r.y.toFixed(6); out[n][4*i+2]=+r.z.toFixed(6); out[n][4*i+3]=+r.w.toFixed(6);
  }
}
for(const n of SP) c.tracks[n]=out[n];
c.sourceClip=(c.sourceClip||c.name)+` +spine-twist ${DEG}°${FROM>=0?` from ${FROM}`:''} hold ${HOLD} until ${UNTIL}`;
process.stderr.write(`${c.name}: 상체 비틀기 ${DEG}° (${SP.join('·')} 1/${SP.length} 씩), 유지 ~${HOLD}, 풀림 ~${UNTIL}\n`);
process.stdout.write(JSON.stringify(c));
