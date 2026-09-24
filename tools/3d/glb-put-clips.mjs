/* ain_anim.glb 에 클립을 «갈아 끼운다» (같은 이름이 있으면 바꾸고, 없으면 더한다).
 * 입력은 tools/3d/meshy-retarget.mjs 가 뽑은 JSON. 원본 GLB 는 .bak 로 남긴다.
 *   node tools/3d/glb-put-clips.mjs art/3d/ain_anim.glb a.json b.json ...
 * three.js 없이 GLB 를 직접 쓴다 — 기존 버퍼는 한 바이트도 안 건드리고 뒤에 덧붙인다. */
import fs from 'node:fs';
const [glbPath,...jsons]=process.argv.slice(2);
const buf=fs.readFileSync(glbPath);
if(buf.readUInt32LE(0)!==0x46546C67) throw Error('GLB 아님');
let off=12, json=null, bin=null;
while(off<buf.length){ const len=buf.readUInt32LE(off), type=buf.readUInt32LE(off+4), body=buf.subarray(off+8,off+8+len);
  if(type===0x4E4F534A) json=JSON.parse(body.toString('utf8')); else if(type===0x004E4942) bin=Buffer.from(body); off+=8+len; }
const nodeIndex={}; json.nodes.forEach((n,i)=>{ nodeIndex[(n.name||'').replace(/^mixamorig:?/,'')]=i; });
const parts=[bin]; let binLen=bin.length;
function push(f32, type, minmax){
  const pad=(4-binLen%4)%4; if(pad){ parts.push(Buffer.alloc(pad)); binLen+=pad; }
  const b=Buffer.from(f32.buffer,f32.byteOffset,f32.byteLength); parts.push(b);
  json.bufferViews.push({buffer:0,byteOffset:binLen,byteLength:b.length}); binLen+=b.length;
  const comps={SCALAR:1,VEC3:3,VEC4:4}[type], acc={bufferView:json.bufferViews.length-1,componentType:5126,count:f32.length/comps,type};
  if(minmax){ acc.min=[Math.min(...f32)]; acc.max=[Math.max(...f32)]; }
  json.accessors.push(acc); return json.accessors.length-1;
}
for(const jp of jsons){
  const c=JSON.parse(fs.readFileSync(jp,'utf8'));
  const tIdx=push(new Float32Array(c.times),'SCALAR',true);
  const samplers=[], channels=[];
  for(const [bone,vals] of Object.entries(c.tracks)){
    const node=nodeIndex[bone]; if(node==null) continue;
    samplers.push({input:tIdx,output:push(new Float32Array(vals),'VEC4'),interpolation:'LINEAR'});
    channels.push({sampler:samplers.length-1,target:{node,path:'rotation'}});
  }
  if(c.hips&&nodeIndex.Hips!=null){
    samplers.push({input:tIdx,output:push(new Float32Array(c.hips),'VEC3'),interpolation:'LINEAR'});
    channels.push({sampler:samplers.length-1,target:{node:nodeIndex.Hips,path:'translation'}});
  }
  const anim={name:c.name,channels,samplers,extras:{source:`meshy:${c.sourceClip}`,from:c.from,to:c.to}};
  const i=json.animations.findIndex(a=>a.name===c.name);
  if(i>=0) json.animations[i]=anim; else json.animations.push(anim);
  console.log(`${c.name}: ${channels.length} 채널, ${c.times.length} 키, ${c.duration}s ← ${c.sourceClip}`);
}
const newBin=Buffer.concat(parts); json.buffers[0].byteLength=newBin.length;
/* 안 쓰게 된 옛 애니메이션 버퍼는 남는다 — 용량보다 «기존 바이트 불변» 이 안전하다 */
let js=Buffer.from(JSON.stringify(json),'utf8'); js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);
const bb=Buffer.concat([newBin,Buffer.alloc((4-newBin.length%4)%4)]);
const head=Buffer.alloc(12); head.writeUInt32LE(0x46546C67,0); head.writeUInt32LE(2,4); head.writeUInt32LE(12+8+js.length+8+bb.length,8);
const cj=Buffer.alloc(8); cj.writeUInt32LE(js.length,0); cj.writeUInt32LE(0x4E4F534A,4);
const cb=Buffer.alloc(8); cb.writeUInt32LE(bb.length,0); cb.writeUInt32LE(0x004E4942,4);
if(!fs.existsSync(glbPath+'.bak')) fs.copyFileSync(glbPath,glbPath+'.bak');
fs.writeFileSync(glbPath,Buffer.concat([head,cj,js,cb,bb]));
console.log('썼다',glbPath,(buf.length/1e6).toFixed(2),'→',((12+16+js.length+bb.length)/1e6).toFixed(2),'MB');
