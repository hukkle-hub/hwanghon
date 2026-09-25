/* 클립의 목·머리를 들어 올린다 (docs/design/78). 대기(idle)에서 네 캐릭터 모두 머리가 30° 숙여져(가슴보다 20°)
 * 바닥을 본다 — 얼굴이 머리칼에 가려 안 보인다. 설정 시트는 고개를 든 자세다.
 *   node tools/3d/clip-head-lift.mjs <glb> --clip idle --deg 10 [--bones Neck,Head]
 * 뼈마다 «쉬는 자세의 옆축(월드 X)» 둘레로 -deg 만큼 돌린다(+ 면 숙임, - 면 듦). 버퍼 값을 제자리에서 고친다(길이 불변). */
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import {load} from './rerig-meshy.mjs';
const args=process.argv.slice(2), val=k=>args.includes(k)?args[args.indexOf(k)+1]:null;
const file=args[0], clipName=val('--clip')||'idle', deg=+(val('--deg')||10), boneNames=(val('--bones')||'Neck,Head').split(',');
const g=await load(file); g.scene.updateMatrixWorld(true);
const restW={}; g.scene.traverse(o=>{ if(o.isBone) restW[o.name.replace(/^mixamorig:?/,'')]=o.getWorldQuaternion(new T.Quaternion()); });
const buf=fs.readFileSync(file), jl=buf.readUInt32LE(12), json=JSON.parse(buf.subarray(20,20+jl).toString('utf8')), binStart=20+jl+8;
const anim=json.animations.find(a=>a.name===clipName); if(!anim) throw Error('클립 없음 '+clipName);
const R=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-deg*Math.PI/180);   /* 월드 X 둘레 — 고개를 든다 */
let done=[];
for(const ch of anim.channels){ const node=json.nodes[ch.target.node], nm=(node.name||'').replace(/^mixamorig:?/,'');
  if(ch.target.path!=='rotation'||!boneNames.includes(nm)) continue;
  const acc=json.accessors[anim.samplers[ch.sampler].output], bv=json.bufferViews[acc.bufferView], off=binStart+(bv.byteOffset||0)+(acc.byteOffset||0);
  const Wr=restW[nm], D=Wr.clone().invert().multiply(R).multiply(Wr);   /* 쉬는 자세 뼈 좌표로 옮긴 월드 X 회전 */
  for(let k=0;k<acc.count;k++){ const o=off+k*16, q=new T.Quaternion(buf.readFloatLE(o),buf.readFloatLE(o+4),buf.readFloatLE(o+8),buf.readFloatLE(o+12)).multiply(D).normalize();
    buf.writeFloatLE(q.x,o); buf.writeFloatLE(q.y,o+4); buf.writeFloatLE(q.z,o+8); buf.writeFloatLE(q.w,o+12); }
  done.push(nm+' '+acc.count+'키'); }
fs.writeFileSync(file,buf); console.log(clipName,'−'+deg+'°:',done.join(', '));
