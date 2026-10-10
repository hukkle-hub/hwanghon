import fs from 'node:fs';import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
import * as T from '../../vendor/three/three.module.js';import {loadGlb} from './stretch-audit.mjs';import {makePoser} from './pose-eval.mjs';
import {Animated} from '../../js/party-avatar.js';import {fieldHeroAction} from '../../js/mmo/hero-motion.js';
globalThis.window=globalThis;for(const f of ['looks','dungeons'])vm.runInThisContext(fs.readFileSync('js/'+f+'.js','utf8'));
const asset=await loadGlb('art/3d/kain_anim.glb'),weapon=await loadGlb('art/3d/gear/w_kain_greatsword.glb');export const report={};
for(const name of ['attack1','attack2','attack3','smash','counter','exec']){
 const h=new Animated(asset,new T.Scene(),true,false,weapon,'kain'),bones={};h.model.traverse(b=>{if(b.isBone)bones[b.name.replace(/^mixamorig:?/,'')]=b;});
 const action=h.clips[name],idle=h.clips.idle,pose=makePoser(h.model,action),ready=makePoser(h.model,idle),dt=1/60,previous={};let max=0,peak='',gap=0;
 for(let i=0;i<90;i++){
  h.rig.restore();if(i===0)pose(action.duration);else ready((i-1)*dt%idle.duration);
  h.rig.apply(i===0?fieldHeroAction('kain',action,action.duration,name):null,false,false,dt,i===0?name:'idle');h.root.updateMatrixWorld(true);
  for(const n of ['RightArm','RightForeArm','LeftArm','LeftForeArm']){const q=bones[n].getWorldQuaternion(new T.Quaternion());if(previous[n]){const r=q.angleTo(previous[n])/dt;if(r>max){max=r;peak=n+'@'+i;}}previous[n]=q;}
  gap=Math.max(gap,h.rig.diagnostics.gripError||0);
 }
 report[name]={maxArmRate:max,peak,gripGap:gap};h.dispose(h.root.parent);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){console.log(JSON.stringify(report,null,2));if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');}
