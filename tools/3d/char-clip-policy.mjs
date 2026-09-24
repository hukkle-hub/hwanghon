/* 카인·류·세라 클립마다 «원본 / 곡선 / 접점 고정 펴기» 를 재서 비교한다 (docs/design/75).
   rJerk = 뼈 9개 월드 각속도 곡선 거칠기 평균(60 fps), Δ = 원본 대비 최대 자세 변화(손·아래팔 포함 13뼈).
   사용: node tools/3d/char-clip-policy.mjs  [CHS=kain,ryu] [OUT=결과.json] */
import {readFile} from 'node:fs/promises';import fs from 'node:fs';import vm from 'node:vm';
import * as T from '/home/user/hwanghon/vendor/three/three.module.js';
import {GLTFLoader} from '/home/user/hwanghon/vendor/three/GLTFLoader.js';
const CS=await import('/home/user/hwanghon/js/clip-smooth.js');
const ctx={window:{},console};ctx.globalThis=ctx;vm.createContext(ctx);for(const f of ['world','dungeons'])vm.runInContext(fs.readFileSync(`/home/user/hwanghon/js/${f}.js`,'utf8'),ctx);
const CC=ctx.window.TW_DUNGEONS.RULES.motion.clipContacts;
const out={};
for(const ch of (process.env.CHS||'kain,ryu,sera').split(',')){
const b=await readFile(`/home/user/hwanghon/art/3d/${ch}_anim.glb`),l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
const g=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
const bones={};g.scene.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
const B=['Hips','Spine2','Head','RightArm','LeftArm','RightUpLeg','LeftUpLeg','RightLeg','LeftLeg','RightForeArm','LeftForeArm','RightHand','LeftHand'].filter(n=>bones[n]);
const JB=B.slice(0,9);
const mixer=new T.AnimationMixer(g.scene);
const sample=(c,t)=>{mixer.stopAllAction();mixer.uncacheRoot(g.scene);const a=mixer.clipAction(c);a.reset();a.play();a.paused=true;a.time=Math.min(c.duration-1e-4,t);mixer.update(0);g.scene.updateMatrixWorld(true);return B.map(n=>bones[n].getWorldQuaternion(new T.Quaternion()));};
function rj(c){const N=Math.round(c.duration*60),w=JB.map(()=>[]);let prev=null;
 for(let i=0;i<=N;i++){const q=sample(c,c.duration*i/N).slice(0,9);if(prev)q.forEach((x,k)=>w[k].push(prev[k].angleTo(x)));prev=q;}
 const r=w.map(v=>{const m=v.reduce((s,x)=>s+x,0)/v.length;let j=0;for(let i=1;i<v.length-1;i++)j=Math.max(j,Math.abs(v[i+1]-2*v[i]+v[i-1]));return m>1e-6?j/m:0;});
 return r.reduce((s,x)=>s+x,0)/r.length;}
const dpose=(c1,c2,ts)=>{let mx=0;for(const t of ts){const a=sample(c1,t),b2=sample(c2,t);a.forEach((q,k)=>mx=Math.max(mx,q.angleTo(b2[k])*57.3));}return mx;};
out[ch]={};
console.log('==',ch);
for(const c of g.animations){
 const hit=CC[c.name], pins=hit!=null?[hit*c.duration]:[];
 const ts=Array.from({length:41},(_,i)=>c.duration*i/40);
 const cur=CS.smoothClip(c.clone(),{mode:'curve'}), soft=CS.smoothClip(c.clone(),{mode:'soft',pins});
 const r={raw:rj(c),curve:rj(cur),soft:rj(soft),dCurve:dpose(c,cur,ts),dSoft:dpose(c,soft,ts),dSoftHit:pins.length?dpose(c,soft,pins):0};
 out[ch][c.name]=r;
 console.log(c.name.padEnd(9),hit!=null?('hit '+hit).padEnd(8):''.padEnd(8),'raw',r.raw.toFixed(2),'curve',r.curve.toFixed(2),'soft',r.soft.toFixed(2),'Δsoft',r.dSoft.toFixed(0)+'°','Δ@hit',r.dSoftHit.toFixed(1)+'°');
}}
if(process.env.OUT) fs.writeFileSync(process.env.OUT,JSON.stringify(out));
