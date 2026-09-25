/* glb 안의 클립을 다른 이름으로 복사해 JSON 으로 — glb-put-clips.mjs 로 넣는다 (docs/design/87).
 * 솔로·온라인이 스킬 클립을 «skill1~4» 이름으로 부르므로, 맞는 몸짓(예: 카인 방어 guardUp)을 그 칸에 복사한다.
 *   node tools/3d/clip-copy.mjs <캐릭터.glb> <원본 클립> <새 이름> [--fps 60] > clip.json */
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
const [F,SRC,DST]=process.argv.slice(2), args=process.argv.slice(2), FPS=+(args.includes('--fps')?args[args.indexOf('--fps')+1]:60);
const b=fs.readFileSync(F), l=new GLTFLoader(); l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
const g=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
const c=g.animations.find(a=>a.name===SRC); if(!c) throw new Error('클립 없음: '+SRC);
const G={}, order=[]; g.scene.traverse(o=>{ if(o.isBone){ const n=o.name.replace(/^mixamorig:?/,''); G[n]=o; order.push(n); } });
const m=new T.AnimationMixer(g.scene), a=m.clipAction(c); a.play(); a.paused=true;
const N=Math.max(2,Math.round(c.duration*FPS)), tracks=Object.fromEntries(order.map(n=>[n,[]])), hips=[];
for(let i=0;i<=N;i++){ a.time=Math.min(c.duration-1e-4,c.duration*i/N); m.update(0);
  for(const n of order){ const q=G[n].quaternion.clone(), p=tracks[n][tracks[n].length-1]; if(p&&p.dot(q)<0) q.set(-q.x,-q.y,-q.z,-q.w); tracks[n].push(q); }
  hips.push(G.Hips.position.clone()); }
const times=Array.from({length:N+1},(_,i)=>+(c.duration*i/N).toFixed(5));
console.log(JSON.stringify({name:DST, source:F.split('/').pop(), sourceClip:SRC, duration:+c.duration.toFixed(5), fps:FPS, times,
  tracks:Object.fromEntries(order.map(n=>[n,tracks[n].flatMap(q=>[q.x,q.y,q.z,q.w].map(v=>+v.toFixed(6)))])), hips:hips.flatMap(p=>[p.x,p.y,p.z].map(v=>+v.toFixed(5)))}));
process.stderr.write(`${SRC} → ${DST}: ${N+1} 키, ${c.duration.toFixed(2)} s\n`);
