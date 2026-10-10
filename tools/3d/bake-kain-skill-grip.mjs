// Bake reviewed two-hand corrections at 120 Hz. Runtime only repairs tiny
// interpolation/fade differences; it never re-searches a different sword path.
import fs from 'node:fs';import vm from 'node:vm';
import * as T from '../../vendor/three/three.module.js';import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {Animated} from '../../js/party-avatar.js';import {fieldHeroAction} from '../../js/mmo/hero-motion.js';import {HERO_SKILL_DATA} from '../../js/hero-skill-data.js';
globalThis.window=globalThis;vm.runInThisContext(fs.readFileSync('js/looks.js','utf8'));vm.runInThisContext(fs.readFileSync('js/dungeons.js','utf8'));
const load=async f=>{const b=fs.readFileSync(f),l=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])l.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const asset=await load('art/3d/kain_anim.glb'),weapon=await load('art/3d/gear/w_kain_greatsword.glb'),out={};
for(const[name,src]of Object.entries(HERO_SKILL_DATA.kain)){
 if(src.weaponBaked)throw Error('Regenerate unbaked source library first');
 const scene=new T.Scene(),h=new Animated(asset,scene,true,false,weapon,'kain'),b={};h.model.traverse(o=>{if(o.isBone)b[o.name.replace(/^mixamorig:?/,'')]=o;});
 h.play('idle');for(let i=0;i<120;i++){h.rig.restore();h.mixer.update(1/60);h.rig.apply(null,false,false,1/60,'idle');}
 h.play(name,name);h.current.paused=true;const N=Math.ceil(src.duration*120),dt=src.duration/N,c={...src,times:[],tracks:Object.fromEntries(Object.keys(src.tracks).map(k=>[k,[]])),hips:[],weaponPositions:[],weaponRotations:[],weaponBaked:true};
 for(let i=0;i<=N;i++){
  const time=dt*i;h.rig.restore();h.current.time=time;h.mixer.update(dt);h.rig.apply(fieldHeroAction('kain',h.current.getClip(),time,name),false,false,dt,name);h.root.updateMatrixWorld(true);c.times.push(time);
  for(const[n,a]of Object.entries(c.tracks))b[n].quaternion.toArray(a,a.length);b.Hips.position.toArray(c.hips,c.hips.length);
  const q=h.weapon.getWorldQuaternion(new T.Quaternion()),p=h.weapon.getWorldPosition(new T.Vector3()).addScaledVector(new T.Vector3(0,1,0).applyQuaternion(q),-.085);h.model.worldToLocal(p).toArray(c.weaponPositions,c.weaponPositions.length);h.model.getWorldQuaternion(new T.Quaternion()).invert().multiply(q).normalize().toArray(c.weaponRotations,c.weaponRotations.length);
 }
 out[name]=c;h.dispose(scene);console.log(name,N+1,'baked frames');
}
fs.writeFileSync('js/hero-skill-data.js','// Generated full-body takes; Kain grip/weapon corrections baked at 120 Hz. Original GLBs untouched.\nexport const HERO_SKILL_DATA='+JSON.stringify({...HERO_SKILL_DATA,kain:out})+';\n');
