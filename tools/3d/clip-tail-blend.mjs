/* 클립 «끝» 을 서 있는 자세로 이어 준다 (docs/design/76).
 *
 * Meshy 원본은 동작 뒤 한참을 웅크린 채 버티다 일어난다(류 쌍날 회전: 1.9~3.7초 웅크림,
 * 3.7~5.1초 일어남). 그 구간까지 넣으면 클립이 3배 길어져 배속이 폭주하고, 빼면 웅크린
 * 자세에서 0.15초 만에 대기로 «툭» 선다. 그래서 길이는 그대로 두고 마지막 tail 초 동안
 * 각 뼈의 로컬 회전(과 골반 위치)을 «서 있는 프레임» 쪽으로 스무더스텝으로 섞는다.
 *
 *   node tools/3d/clip-tail-blend.mjs 본.json 선자세 tail초 [head초] > 결과.json
 *   head초 를 주면 «처음» 도 같은 자세에서 시작하도록 섞는다 (류 회전의 첫 자세가 대기와 66°)
 *   선자세 = JSON(같은 원본을 서 있는 시각에서 짧게 뽑은 것, 첫 프레임) 또는
 *            «캐릭터.glb#클립» (그 캐릭터의 대기 첫 프레임 — 게임이 바로 다음에 섞어 들어갈 자세)
 *   류 쌍날 회전의 5.5초 «선 자세» 는 다리를 넓게 벌린 자세라(오른 정강이 121°) 대기 쪽을 쓴다.
 */
import fs from 'node:fs';
import * as THREE from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
const [aPath,bPath,tailS,headS]=process.argv.slice(2), A=JSON.parse(fs.readFileSync(aPath,'utf8'));
async function fromClip(spec){ const [file,clipName]=spec.split('#'), buf=fs.readFileSync(file), l=new GLTFLoader();
  l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
  const g=await l.parseAsync(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),''), c=g.animations.find(x=>x.name===clipName), tracks={}; let hips=null;
  for(const t of c.tracks){ const [node,prop]=t.name.split('.'), bone=node.replace(/^mixamorig:?/,'');
    if(prop==='quaternion') tracks[bone]=Array.from(t.values.slice(0,4)); if(prop==='position'&&bone==='Hips') hips=Array.from(t.values.slice(0,3)); }
  return {tracks,hips,sourceClip:file.split('/').pop()+'#'+clipName,from:0}; }
const Bj=bPath.includes('#')?await fromClip(bPath):JSON.parse(fs.readFileSync(bPath,'utf8'));
const tail=+tailS, head=+(headS||0), T=A.times, end=T[T.length-1];
const ss=x=>x<=0?0:x>=1?1:x*x*x*(x*(x*6-15)+10);
const wAt=t=>Math.max(ss((t-(end-tail))/tail), head>0?1-ss(t/head):0);
for(const [bone,vals] of Object.entries(A.tracks)){
  const tgt=Bj.tracks[bone]; if(!tgt) continue;
  const q1=tgt.slice(0,4);
  for(let i=0;i<T.length;i++){
    const w=wAt(T[i]); if(w<=0) continue;
    const q0=vals.slice(i*4,i*4+4); let d=q0[0]*q1[0]+q0[1]*q1[1]+q0[2]*q1[2]+q0[3]*q1[3];
    const s=d<0?-1:1; d*=s;
    /* slerp */
    let k0=1-w,k1=w*s; if(d<0.9995){ const th=Math.acos(d), sn=Math.sin(th); k0=Math.sin((1-w)*th)/sn; k1=s*Math.sin(w*th)/sn; }
    const q=[0,1,2,3].map(j=>k0*q0[j]+k1*q1[j]), n=Math.hypot(...q);
    for(let j=0;j<4;j++) vals[i*4+j]=+(q[j]/n).toFixed(6);
  }
}
if(A.hips&&Bj.hips){ const h1=Bj.hips.slice(0,3);
  for(let i=0;i<T.length;i++){ const w=wAt(T[i]); if(w<=0) continue;
    for(let j=0;j<3;j++) A.hips[i*3+j]=+((1-w)*A.hips[i*3+j]+w*h1[j]).toFixed(5); } }
A.tail={from:Bj.from,seconds:tail,head};
process.stderr.write(`${A.name}: 끝 ${tail}s 를 ${Bj.sourceClip} ${Bj.from}s 자세로 이었다\n`);
console.log(JSON.stringify(A));
