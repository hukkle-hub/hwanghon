// Capture the immutable pre-repair ultimate, never the current authored take.
import fs from 'node:fs';import vm from 'node:vm';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import * as T from '../../vendor/three/three.module.js';import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {HERO_SKILL_DATA} from '../../js/hero-skill-data.js';import {Animated} from '../../js/party-avatar.js';import {makePoser} from './pose-eval.mjs';import {fieldHeroAction} from '../../js/mmo/hero-motion.js';
const source=process.argv[2],destination=process.argv[3];if(!source||!destination)throw Error('Archive and destination required');
const archive=(await import(pathToFileURL(resolve(source)).href)).HERO_SKILL_DATA;
if(archive.kain.ult.readyConnected)throw Error('Not the immutable rejected source');HERO_SKILL_DATA.kain.ult=archive.kain.ult;
globalThis.window=globalThis;for(const f of ['looks','dungeons'])vm.runInThisContext(fs.readFileSync('js/'+f+'.js','utf8'));
const load=async f=>{const raw=fs.readFileSync(f),l=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])l.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');};
const scene=new T.Scene(),h=new Animated(await load('art/3d/kain_anim.glb'),scene,true,false,await load('art/3d/gear/w_kain_greatsword.glb'),'kain'),bones={};h.model.traverse(b=>{if(b.isBone)bones[b.name.replace(/^mixamorig:?/,'')]=b;});
h.play('ult','rejected-source');const clip=h.current.getClip(),t=clip.duration*.337;makePoser(h.model,clip)(t);h.rig.apply(fieldHeroAction('kain',clip,t,'rejected-source'),false,false,1/120,'ult');h.root.updateMatrixWorld(true);
const fixture={source:'immutable pre-repair ultimate; hero-skill-before.js',phase:.337,tracks:Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,b.quaternion.toArray()])),hips:bones.Hips.position.toArray()};fs.writeFileSync(destination,JSON.stringify(fixture,null,2)+'\n');h.dispose(scene);
