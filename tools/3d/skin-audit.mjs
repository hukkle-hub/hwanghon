/* 스킨 무게 점검 — 뼈별 «주 무게» 정점 수·무게 합·중심(바인드), 그리고 부위 영역(위팔·아래팔·허벅지)의 정점이 어느 뼈에 붙었나를 좌우로 견준다 (문서 121 §6).
   node tools/3d/skin-audit.mjs <char> */
import fs from 'node:fs';import * as T from '../../vendor/three/three.module.js';import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
const ch=process.argv[2]||'kain';const b=fs.readFileSync(`art/3d/${ch}_anim.glb`),l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
const g=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');g.scene.updateMatrixWorld(true);
let sm=null;g.scene.traverse(o=>{if(!sm&&o.isSkinnedMesh)sm=o;});const bones=sm.skeleton.bones.map(x=>x.name.replace(/^mixamorig:?/,''));
const sk=sm.geometry.attributes.skinIndex,sw=sm.geometry.attributes.skinWeight,P=sm.geometry.attributes.position,n=sk.count;
const main={},wsum={},cen={};const v=new T.Vector3();
for(let i=0;i<n;i++){let best=-1,bw=0;for(let j=0;j<4;j++){const w=sw.getComponent(i,j),bi=sk.getComponent(i,j);wsum[bi]=(wsum[bi]||0)+w;if(w>bw){bw=w;best=bi;}}main[best]=(main[best]||0)+1;v.fromBufferAttribute(P,i).applyMatrix4(sm.matrixWorld);(cen[best]=cen[best]||[0,0,0,0]);cen[best][0]+=v.x;cen[best][1]+=v.y;cen[best][2]+=v.z;cen[best][3]++;}
const row=nm=>{const i=bones.indexOf(nm);if(i<0)return `${nm} 없음`;const c=cen[i],bp=sm.skeleton.bones[i].getWorldPosition(new T.Vector3());return `${nm.padEnd(13)} 주무게 정점 ${String(main[i]||0).padStart(5)} · 무게합 ${(wsum[i]||0).toFixed(0).padStart(5)} · 정점중심 ${c?[c[0]/c[3],c[1]/c[3],c[2]/c[3]].map(x=>x.toFixed(2)).join(','):'-'} · 뼈 ${bp.toArray().map(x=>x.toFixed(2)).join(',')}`;};
console.log(`${ch}: 정점 ${n}, 뼈 ${bones.length}, 메시 ${sm.name}`);
for(const s of ['Shoulder','Arm','ForeArm','Hand','UpLeg','Leg','Foot'])for(const side of ['Left','Right'])console.log(row(side+s));
/* 영역별: 기하학적으로 그 부위에 있는 정점이 어느 뼈를 주 무게로 갖나 (거울 대칭 비교) */
const regions={'위팔(|x| .15~.30, y 1.25~1.52)':(x,y)=>x>.15&&x<.30&&y>1.25&&y<1.52,'아래팔(|x| .30~.40, y 1.0~1.25)':(x,y)=>x>.30&&x<.40&&y>1.0&&y<1.25,'허벅지(|x| .05~.25, y .6~.95)':(x,y)=>x>.05&&x<.25&&y>.6&&y<.95};
for(const [name,f] of Object.entries(regions))for(const side of [1,-1]){const cnt={};let tot=0;
  for(let i=0;i<n;i++){v.fromBufferAttribute(P,i).applyMatrix4(sm.matrixWorld);if(!f(v.x*side,v.y))continue;tot++;let best=-1,bw=0;for(let j=0;j<4;j++){const w=sw.getComponent(i,j);if(w>bw){bw=w;best=sk.getComponent(i,j);}}cnt[bones[best]]=(cnt[bones[best]]||0)+1;}
  console.log(`${side>0?'왼':'오른'} ${name}: ${tot} 정점 → `+Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,c])=>`${k} ${(c/tot*100).toFixed(0)}%`).join(' · '));}
