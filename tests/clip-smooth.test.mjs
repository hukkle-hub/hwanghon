import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {smoothClip,clipPolicy,isLoop} from '../js/clip-smooth.js';
/* 24 fps 선형 키를 곡선으로 다시 뽑는다 (docs/design/73 §4).
   지켜야 할 것: 키 자세는 그대로(곡선), 이음 자세는 그대로(펴기), 고리는 고리대로. */
async function clips(){const b=await readFile('art/3d/ain_anim.glb'),l=new GLTFLoader();
 l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
 return (await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).animations;}
const ang=(a,b)=>new T.Quaternion().fromArray(a).angleTo(new T.Quaternion().fromArray(b));

test('곡선 클립은 원래 키를 «정확히» 지난다 — 접점 자세·판정 정렬 불변', async()=>{
 for(const c of (await clips()).filter(c=>clipPolicy(c.name)==='curve'&&/attack1|attack2|smash|exec|ult|dodgeL/.test(c.name))){
  const s=smoothClip(c);
  for(const t of c.tracks.filter(t=>t.ValueTypeName==='quaternion')){
   const nt=s.tracks.find(x=>x.name===t.name), f=nt.createInterpolant(); let worst=0;
   for(let i=0;i<t.times.length;i++) worst=Math.max(worst,ang(Array.from(f.evaluate(t.times[i])),Array.from(t.values.slice(i*4,i*4+4))));
   assert.ok(worst<0.02, `${c.name} ${t.name} 키에서 ${(worst*180/Math.PI).toFixed(2)}° 벗어났다`);
  }
 }
});

test('펴기 클립(단발)은 처음·끝 자세가 그대로 — 다른 동작과 이어 붙는 자세다', async()=>{
 /* 고리(달리기·걷기·대기)는 이음 자세도 같이 펴진다 — 처음=끝이라 이음새는 없다 */
 for(const c of (await clips()).filter(c=>clipPolicy(c.name)==='soft'&&!isLoop(c.name))){
  const s=smoothClip(c);
  for(const t of c.tracks.filter(t=>t.ValueTypeName==='quaternion')){
   const nt=s.tracks.find(x=>x.name===t.name), n=t.times.length, m=nt.times.length;
   assert.ok(ang(Array.from(nt.values.slice(0,4)),Array.from(t.values.slice(0,4)))<1e-3, c.name+' 첫 자세');
   assert.ok(ang(Array.from(nt.values.slice((m-1)*4,m*4)),Array.from(t.values.slice((n-1)*4,n*4)))<1e-3, c.name+' 끝 자세');
  }
 }
});

test('선형으로 둔 클립(원본 스냅이 있는 것)은 손대지 않는다', async()=>{
 for(const c of (await clips()).filter(c=>clipPolicy(c.name)==='linear')) assert.equal(smoothClip(c),c);
 for(const n of ['attack3','counter','skill1','skill2','roll']) assert.equal(clipPolicy(n),'linear');
});

test('곡선이 되면 키 사이 속도가 계단을 타지 않는다 — 걷기·달리기·대기가 매끄러워진다', async()=>{
 const all=await clips();
 const b=await readFile('art/3d/ain_anim.glb'),l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
 const g=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const bones={};g.scene.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
 const B=['Hips','Spine2','Head','RightArm','LeftArm','RightUpLeg','LeftUpLeg','RightLeg','LeftLeg'];
 /* 주요 뼈 9 개 월드 각속도 곡선 거칠기(rJerk)의 평균 — tools 의 잣대와 같다 */
 const rough=(clip)=>{const mx=new T.AnimationMixer(g.scene),a=mx.clipAction(clip);a.play();a.paused=true;const N=Math.round(clip.duration*60),prev={},w={};B.forEach(n=>w[n]=[]);
  for(let i=0;i<=N;i++){a.time=clip.duration*i/N;mx.update(0);g.scene.updateMatrixWorld(true);for(const n of B){const q=bones[n].getWorldQuaternion(new T.Quaternion());if(prev[n])w[n].push(prev[n].angleTo(q));prev[n]=q;}}
  mx.stopAllAction();mx.uncacheRoot(g.scene);
  const r=B.map(n=>{const v=w[n],m=v.reduce((s,x)=>s+x,0)/v.length;let j=0;for(let i=1;i<v.length-1;i++)j=Math.max(j,Math.abs(v[i+1]-2*v[i]+v[i-1]));return m>1e-6?j/m:0;});
  return r.reduce((s,x)=>s+x,0)/r.length;};
 for(const n of ['run','walk','idle']){const c=all.find(x=>x.name===n),a=rough(c),s=rough(smoothClip(c));
  assert.ok(s<a*0.8, `${n} 거칠기 ${a.toFixed(2)} → ${s.toFixed(2)} (20% 넘게 줄어야 한다)`);}
});

test('고리 클립은 고리대로 — 처음과 끝 자세가 같게 남는다', async()=>{
 for(const c of (await clips()).filter(c=>isLoop(c.name))){
  const s=smoothClip(c);
  for(const t of s.tracks.filter(t=>t.ValueTypeName==='quaternion')){
   const m=t.times.length, src=c.tracks.find(x=>x.name===t.name), n=src.times.length;
   const seam0=ang(Array.from(src.values.slice(0,4)),Array.from(src.values.slice((n-1)*4,n*4)));
   const seam1=ang(Array.from(t.values.slice(0,4)),Array.from(t.values.slice((m-1)*4,m*4)));
   /* 원본 이음새보다 벌어지지 않아야 한다 (정규화 반올림 0.06° 까지는 허용) */
   if(seam0<1e-3) assert.ok(seam1<seam0+1e-3, `${c.name} ${t.name} 고리 이음새 ${seam0} → ${seam1}`);
  }
 }
});
