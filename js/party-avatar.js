import * as T from '../vendor/three/three.module.js';
import {clone} from '../vendor/three/SkeletonUtils.js';
import {sampleAction,makeRigAdapter} from './combat-motion.js';
import {WeaponTrail,trailStyle} from './weapon-trail.js';
/* 접지 그림자 — game3d.js 와 같은 규약. 그림자맵과 별개라 저사양에서도 발이 바닥에 붙는다. */
/* 캔버스를 쓰므로 모듈을 읽는 순간이 아니라 «처음 쓸 때» 만든다 — 이 파일은 node 테스트에서도 import 된다. */
let _blobTex;
function blobTex(){
 if(_blobTex!==undefined)return _blobTex;
 if(typeof document==='undefined')return (_blobTex=null);
 const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
 const rg=g.createRadialGradient(32,32,2,32,32,31);
 rg.addColorStop(0,'rgba(0,0,0,0.62)');rg.addColorStop(0.55,'rgba(0,0,0,0.26)');rg.addColorStop(1,'rgba(0,0,0,0)');
 g.fillStyle=rg;g.fillRect(0,0,64,64);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return (_blobTex=t);
}
const pos=(x,y,h=0)=>new T.Vector3(x/50,h,y/(.55*50));
export class Animated{
 constructor(asset,scene,isPlayer=false,ownsResources=false,weaponAsset=null){this.owned=new Set();if(ownsResources)asset.scene.traverse(o=>{if(o.geometry)this.owned.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)this.owned.add(m);});this.model=clone(asset.scene);this.model.scale.setScalar(isPlayer?1.14:1);   /* 캐릭터 크기 — js/game3d.js CHAR_SCALE 과 같게 */
  this.root=new T.Group();this.root.add(this.model);scene.add(this.root);this.mixer=new T.AnimationMixer(this.model);this.clips=Object.fromEntries(asset.animations.map(c=>[c.name,c]));this.actions={};this.current=null;this.key=null;this.model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;}});if(isPlayer){let slot;this.model.traverse(o=>{if(o.isBone&&/RightHandSlot/.test(o.name))slot=o;});if(slot){this.model.updateMatrixWorld(true);const w=clone(weaponAsset.scene);w.position.y=-.75;const group=new T.Group();group.add(w);const k=slot.getWorldScale(new T.Vector3()).x;group.scale.setScalar(1/k);slot.add(group);this.weapon=group;this.trail=new WeaponTrail(scene);}this.rig=makeRigAdapter(this.model,this.root,slot);}
  this.blob=new T.Mesh(new T.PlaneGeometry(1.04,1.04),new T.MeshBasicMaterial({map:blobTex(),transparent:true,depthWrite:false,opacity:.9}));
  this.blob.rotation.x=-Math.PI/2;this.blob.position.y=.035;this.blob.renderOrder=1;scene.add(this.blob);}
 play(name,key=name){if(!this.clips[name])name='idle';if(this.key===key)return;this.key=key;const a=this.actions[name]||(this.actions[name]=this.mixer.clipAction(this.clips[name]));if(this.current&&this.current!==a)this.current.fadeOut(.1);a.reset().setLoop(['idle','run','walk','guard'].includes(name)?T.LoopRepeat:T.LoopOnce,Infinity);a.clampWhenFinished=true;a.setEffectiveWeight(1).fadeIn(.1).play();a.paused=false;this.current=a;}
 update(data,dt,age){this.root.position.lerp(pos(data.x,data.y),1-Math.exp(-dt*22));
  if(this.blob)this.blob.position.set(this.root.position.x,.035,this.root.position.z);const yaw=Math.PI/2-(data.aim||0),delta=Math.atan2(Math.sin(yaw-this.root.rotation.y),Math.cos(yaw-this.root.rotation.y));this.root.rotation.y+=delta*Math.min(1,dt*18);this.rig?.restore();
  if(data.action){const a=data.action;this.play(a.clip,a.id);this.current.paused=true;this.current.time=sampleAction({...a,elapsed:Math.min(a.duration,a.elapsed+age)},this.current.getClip().duration);}
  else if(data.hp<=0){this.play('death','down');this.current.paused=true;this.current.time=Math.max(0,this.current.getClip().duration-1e-5);}
  else if(data.rollT>0){this.play('roll','roll');this.current.paused=true;this.current.time=(1-Math.max(0,data.rollT-age)/.32)*this.current.getClip().duration;}
  else {this.play(data.guard?'guard':data.moving?'run':'idle');this.current.paused=false;}
  if(this.trail){const a=data.action;
   const sw=(!!a && a.elapsed+age>=a.hitAt*.3 && a.elapsed+age<=a.duration*.85)||data.rollT>0;
   if(a&&this.trailKey!==a.id){this.trailKey=a.id;const st=trailStyle(a.opt&&a.opt.skill?'skill':a.kind);this.trail.set(st[0],st[1]);}
   this.trail.tick(dt,this.weapon,sw);}
 this.mixer.update(dt);this.rig?.apply(data.action?{...data.action,elapsed:Math.min(data.action.duration,data.action.elapsed+age)}:null,data.moving,data.guard,dt);
 }
 dispose(scene){if(this.blob){scene.remove(this.blob);this.blob.geometry.dispose();this.blob.material.dispose();this.blob=null;}this.trail?.dispose();scene.remove(this.root);this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);this.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});for(const resource of this.owned)resource.dispose();}
}
