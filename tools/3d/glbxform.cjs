/* GLB 의 루트 노드에 변환만 얹어 정규화 (메시·노멀·UV·텍스처 보존): Z-up → Y-up, 높이 1.68 m, 발을 원점에 */
const fs=require('fs'); const [src,dst]=process.argv.slice(2); const buf=fs.readFileSync(src);
const len=buf.readUInt32LE(8); let off=12, json=null, jsonOff=0, jsonLen=0, chunks=[];
while(off<len){ const cl=buf.readUInt32LE(off), ct=buf.readUInt32LE(off+4); chunks.push({off,cl,ct}); if(ct===0x4E4F534A){ json=JSON.parse(buf.subarray(off+8,off+8+cl).toString('utf8')); jsonOff=off; jsonLen=cl; } off+=8+cl; }
const acc=json.accessors[json.meshes[0].primitives[0].attributes.POSITION]; const mn=acc.min, mx=acc.max;
// 원본 노드와 같은 +90° about X: (x,y,z) → (x, -z, y)  (Hi3D 원본 회전 유지)
const ymin=-mx[2], ymax=-mn[2], h=ymax-ymin, s=1.68/h;
const cx=(mn[0]+mx[0])/2, cz=(mn[1]+mx[1])/2;  // 새 z = y
const q=[Math.SQRT1_2,0,0,Math.SQRT1_2]; // +90° X
const node=json.nodes[0]; delete node.matrix; node.rotation=q; node.scale=[s,s,s]; node.translation=[-cx*s, -ymin*s, -cz*s]; node.name='Ain';
if(json.scenes[0].nodes.length!==1) console.warn('scene has', json.scenes[0].nodes.length,'root nodes');
const jstr=Buffer.from(JSON.stringify(json),'utf8'); const pad=(4-(jstr.length%4))%4; const jbuf=Buffer.concat([jstr, Buffer.alloc(pad,0x20)]);
const others=chunks.filter(c=>c.ct!==0x4E4F534A).map(c=>buf.subarray(c.off, c.off+8+c.cl));
const head=Buffer.alloc(12); head.write('glTF',0,'ascii'); head.writeUInt32LE(2,4); const jh=Buffer.alloc(8); jh.writeUInt32LE(jbuf.length,0); jh.writeUInt32LE(0x4E4F534A,4);
const out=Buffer.concat([head,jh,jbuf,...others]); out.writeUInt32LE(out.length,8); fs.writeFileSync(dst,out);
console.log('written', dst, out.length, 'scale', s.toFixed(4), 'translation', node.translation.map(v=>+v.toFixed(3)));
