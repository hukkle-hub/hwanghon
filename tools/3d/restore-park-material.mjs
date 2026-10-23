/* Attach separately recovered original texture; leave mesh, UVs, weights and
   inverse bind matrices byte-identical. No repainted or generated texture. */
import fs from 'node:fs';
import crypto from 'node:crypto';
const [source, texture, output] = process.argv.slice(2);
if (!source || !texture || !output) throw Error('source.glb original.png output.glb required');
if (source === output) throw Error('Never overwrite recovered source');
const input = fs.readFileSync(source), png = fs.readFileSync(texture);
if (input.readUInt32LE(0) !== 0x46546c67 || input.readUInt32LE(4) !== 2) throw Error('GLB v2 required');
if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('Original PNG required');
const jsonLength = input.readUInt32LE(12), j = JSON.parse(input.toString('utf8', 20, 20 + jsonLength));
if (j.images?.length) throw Error('Source already has images; inspect instead of replacing');
const binAt = 20 + jsonLength, oldBin = input.subarray(binAt + 8, binAt + 8 + input.readUInt32LE(binAt));
const offset = Math.ceil(oldBin.length / 4) * 4;
const bin = Buffer.alloc(Math.ceil((offset + png.length) / 4) * 4);oldBin.copy(bin);png.copy(bin, offset);
const index = j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:png.length});
j.images=[{bufferView:index,mimeType:'image/png',name:'GeneralPark_texture_0'}];
j.textures=[{source:0}];
j.materials=[{name:'GeneralPark_original_color_recovered',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.8}}];
j.buffers[0].byteLength=bin.length;
const text=Buffer.from(JSON.stringify(j));const padded=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(padded);
const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(20+padded.length+8+bin.length,8);head.writeUInt32LE(padded.length,12);head.writeUInt32LE(0x4e4f534a,16);
const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(output,Buffer.concat([head,padded,bh,bin]));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
console.log(JSON.stringify({source,texture,output,originalBinaryUnchanged:bin.subarray(0,oldBin.length).equals(oldBin),sourceSha256:sha(input),textureSha256:sha(png),outputSha256:sha(fs.readFileSync(output)),animations:j.animations?.length||0,bones:j.skins?.[0]?.joints.length||0},null,2));
