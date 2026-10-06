/* 필드 보스 화면 동작 — 서버 상태를 GLB 클립·지면 예고·검 궤적·불티로 번역한다.
   판정은 server/field-boss-combat.cjs 한 곳뿐이며, 여기서는 체력을 알거나 판정하지 않는다. */
import * as THREE from '../../vendor/three/three.module.js';

export const CLAVE_MOTIONS={
 shutter:{clip:'atk_claveshut',duration:3400,charge:[1350,1850],travel:4.8,hits:[{at:1720,shape:'line',range:7.2,width:2.2,back:.5}]},
 storm:{clip:'atk_clavestorm',duration:4300,hits:[{at:1315,shape:'cone',range:4.8,angle:1.8},{at:2135,shape:'cone',range:5.1,angle:2.05},{at:2955,shape:'circle',radius:5.4}],counter:[2600,2955]},
 slam:{clip:'atk_slam',duration:3050,hits:[{at:1540,shape:'circle',radius:5.2}],counter:[1190,1540]}
};
/* 서버의 타격 시각은 건드리지 않고, 그 사이의 GLB 시간만 재배치한다.
   [서버 경과 ms, 원본 클립 초] — 정지(같은 원본 시각) 뒤 짧은 snap, 긴 회수. */
export const CLAVE_CHOREOGRAPHY={
 shutter:{source:121/30,path:[[0,0],[650,.5],[1200,1.2],[1350,1.9],[1470,1.9],[1720,61/30],[1850,2.6],[3400,121/30]]},
 storm:{source:157/30,path:[[0,0],[900,1.45],[1150,1.45],[1315,1.6],[1510,1.78],[1830,2.45],[1980,2.45],[2135,77/30],[2400,2.8],[2600,3.45],[2800,3.45],[2955,3.6],[3150,3.82],[4300,157/30]]},
 slam:{source:83/30,path:[[0,0],[850,1.1],[1190,1.2],[1390,1.2],[1540,1.54],[1750,1.8],[3050,83/30]]}
};
export const CLAVE_SLAM_SHUTTER_PATH=[[0,0],[850,1.2],[1190,1.9],[1390,1.9],[1540,61/30],[1750,2.6],[3050,3.8]];
export const CLAVE_IDLE_CYCLE=4800;
const CLAVE=new Set(['clave','clave2']),TMP=new THREE.Vector3(),ROT=new THREE.Quaternion(),AXIS_X=new THREE.Vector3(1,0,0),AXIS_Y=new THREE.Vector3(0,1,0),AXIS_Z=new THREE.Vector3(0,0,1);
export const CLAVE_WALK_CONTACTS=[.121,.638];   /* clave.glb walk 발높이 최저점의 정규화 위상 */
export function claveWalkContact(prev,phase){let contact=-1;for(let i=0;i<CLAVE_WALK_CONTACTS.length;i++){const m=CLAVE_WALK_CONTACTS[i],d=Math.abs(phase-m),crossed=prev==null?Math.min(d,1-d)<.035:phase>=prev?(prev<m&&m<=phase):(m>prev||m<=phase);if(crossed)contact=i;}return contact;}
function pathTime(path,elapsed){const t=Math.max(0,elapsed);for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];if(t<=b[0]){const k=(t-a[0])/Math.max(1,b[0]-a[0]);return a[1]+(b[1]-a[1])*Math.max(0,Math.min(1,k));}}return path[path.length-1][1];}
export function claveSkillClipTime(skill,elapsed,clipDuration){const c=CLAVE_CHOREOGRAPHY[skill];if(!c)return 0;return pathTime(c.path,elapsed)*(Number.isFinite(clipDuration)?clipDuration/c.source:1);}
export function claveShutterTravel(elapsed){const d=CLAVE_MOTIONS.shutter,[s,e]=d.charge;return d.travel*Math.max(0,Math.min(1,(elapsed-s)/(e-s)));}
export function claveSlamShutterTime(elapsed){return pathTime(CLAVE_SLAM_SHUTTER_PATH,elapsed);}
export function claveCounterActive(action,now){return !!(action?.motion==='skill'&&action.counterOpen&&now>=action.counterOpen&&now<=action.counterClose);}
export function claveStrikeActive(skill,elapsed){if(skill==='shutter')return elapsed>=1470&&elapsed<=1850;if(skill==='storm')return elapsed>=1150&&elapsed<=1510||elapsed>=1980&&elapsed<=2400||elapsed>=2800&&elapsed<=3150;if(skill==='slam')return elapsed>=1390&&elapsed<=1750;return false;}
export function claveStormBias(elapsed){if(elapsed>=800&&elapsed<1510){if(elapsed<900)return-smooth01((elapsed-800)/100);if(elapsed<=1315)return-1;return-(1-smooth01((elapsed-1315)/195));}if(elapsed>=1700&&elapsed<2400){if(elapsed<1830)return smooth01((elapsed-1700)/130);if(elapsed<=2135)return 1;return 1-smooth01((elapsed-2135)/265);}return 0;}
const smooth01=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function claveStaggerPose(elapsed){if(elapsed<=0)return 0;if(elapsed<180)return smooth01(elapsed/180);if(elapsed<=420)return 1;return 1-smooth01((elapsed-420)/930);}
export function claveIdleClipTime(elapsed,duration=5/6){const t=((elapsed%CLAVE_IDLE_CYCLE)+CLAVE_IDLE_CYCLE)%CLAVE_IDLE_CYCLE;if(t<1200)return duration*t/1200;if(t<1800)return duration*.42*smooth01((t-1200)/600);if(t<2150)return duration*(.42+.16*smooth01((t-1800)/350));if(t<4200)return duration*.58;return duration*(.58+.42*smooth01((t-4200)/600));}
/* 4.8초 보초 호흡→고개/셔터 고쳐쥠→저열 펄스→긴 정지→복귀. out을 재사용한다. */
export function claveIdleCues(elapsed,out){const t=((elapsed%CLAVE_IDLE_CYCLE)+CLAVE_IDLE_CYCLE)%CLAVE_IDLE_CYCLE;
 out.breath=t<1200?Math.sin(t/1200*Math.PI):0;
 out.turn=t<1200?0:t<1800?smooth01((t-1200)/600):t<4200?1:1-smooth01((t-4200)/600);
 out.brace=out.turn;out.pulse=t>=1800&&t<2150?Math.sin((t-1800)/350*Math.PI):0;
 out.guard=t<1800?0:t<2150?smooth01((t-1800)/350):t<4200?1:1-smooth01((t-4200)/600);return out;}
const ease=(a,b,k)=>a+(b-a)*(1-Math.pow(1-k,3));
function rigNode(model,name){
 const bare=name.replace(/^mixamorig:?/,'');
 return model.getObjectByName(name)||model.getObjectByName('mixamorig:'+bare)||model.getObjectByName('mixamorig'+bare)||model.getObjectByName(bare);
}

function warningGeometry(h){
 const pos=[],idx=[];
 if(h.shape==='line'){
  const w=h.width/2,r=h.range,z0=-(h.back||0);pos.push(-w,0,z0,w,0,z0,w,0,r,-w,0,r);idx.push(0,1,2,0,2,3);
 }else{
  const radius=h.radius||h.range,arc=h.shape==='cone'?h.angle:Math.PI*2,n=64,start=h.shape==='cone'?-arc/2:-Math.PI;
  pos.push(0,0,0);for(let i=0;i<=n;i++){const a=start+arc*i/n;pos.push(Math.sin(a)*radius,0,Math.cos(a)*radius);}
  for(let i=1;i<=n;i++)idx.push(0,i,i+1);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function warningOutlineGeometry(h){
 const pos=[];
 if(h.shape==='line'){
  const w=h.width/2,r=h.range,z0=-(h.back||0);pos.push(-w,0,z0,w,0,z0,w,0,r,-w,0,r,-w,0,z0);
 }else{
  const radius=h.radius||h.range,arc=h.shape==='cone'?h.angle:Math.PI*2,n=64,start=h.shape==='cone'?-arc/2:-Math.PI;
  if(h.shape==='cone')pos.push(0,0,0);for(let i=0;i<=n;i++){const a=start+arc*i/n;pos.push(Math.sin(a)*radius,0,Math.cos(a)*radius);}if(h.shape==='cone')pos.push(0,0,0);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));return g;
}
function addRing(fx,x,z,r,color=0xff4a24,life=.48){
 let ring=null;for(let i=0;i<fx.ringPool.length;i++)if(!fx.ringPool[i].active){ring=fx.ringPool[i];break;}
 if(!ring){ring=fx.ringPool[0];for(let i=1;i<fx.ringPool.length;i++)if(fx.ringPool[i].t/fx.ringPool[i].life>ring.t/ring.life)ring=fx.ringPool[i];}
 else fx.ringActive++;
 ring.active=true;ring.t=0;ring.life=life;ring.r=r;ring.m.visible=true;ring.m.material.color.setHex(color);ring.m.material.opacity=.9;ring.m.position.set(x,fx.floor+.06,z);ring.m.scale.setScalar(.25);fx.tailT=Math.max(fx.tailT||0,life);
}
function play(o,name,duration=0,elapsed=0,fade=.12){
 const a=o.actions?.[name];if(!a)return;const old=o.actions[o.motionClip];if(old===a&&o.motionClip===name){a.paused=false;if(duration){a.timeScale=Math.max(.35,a.getClip().duration/(duration/1000));a.time=Math.min(a.getClip().duration*.96,Math.max(0,elapsed/1000*a.timeScale));}return;}
 a.stopFading();a.stopWarping();a.enabled=true;a.reset().setEffectiveWeight(1);if(name==='idle'||name==='walk'){a.setLoop(THREE.LoopRepeat,Infinity);a.clampWhenFinished=false;a.timeScale=name==='walk'?.82:.72;}
 else{a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.timeScale=duration?Math.max(.35,a.getClip().duration/(duration/1000)):1;a.time=Math.min(a.getClip().duration*.96,Math.max(0,elapsed/1000*a.timeScale));}
 a.play();if(old&&old!==a)a.crossFadeFrom(old,fade,false);o.motionClip=name;
}
function burst(fx,at,n=14,power=1){
 for(let i=0;i<n;i++){const j=fx.next++%fx.count,a=Math.random()*Math.PI*2,s=(.8+Math.random()*2.4)*power;if(fx.life[j]<=0)fx.sparkLive++;fx.pos[j*3]=at.x;fx.pos[j*3+1]=at.y;fx.pos[j*3+2]=at.z;fx.vel[j*3]=Math.cos(a)*s;fx.vel[j*3+1]=1.5+Math.random()*3*power;fx.vel[j*3+2]=Math.sin(a)*s;fx.life[j]=.3+Math.random()*.45;}
 fx.points.visible=true;fx.points.geometry.attributes.position.needsUpdate=true;fx.tailT=Math.max(fx.tailT||0,.76);
}
function dustBurst(fx,at,n=8){
 for(let i=0;i<n;i++){const j=fx.dustNext++%fx.dustCount,a=Math.random()*Math.PI*2,s=.18+Math.random()*.55,k=j*3;if(fx.dustLife[j]<=0)fx.dustLive++;fx.dustPos[k]=at.x;fx.dustPos[k+1]=fx.floor+.035;fx.dustPos[k+2]=at.z;fx.dustVel[k]=Math.cos(a)*s;fx.dustVel[k+1]=.12+Math.random()*.25;fx.dustVel[k+2]=Math.sin(a)*s;fx.dustLife[j]=.28+Math.random()*.22;}
 fx.dust.visible=true;fx.dust.geometry.attributes.position.needsUpdate=true;fx.tailT=Math.max(fx.tailT||0,.51);
}
function hitBurst(fx,at,n=12,power=1,color=0xff7938){
 const cr=((color>>16)&255)/255,cg=((color>>8)&255)/255,cb=(color&255)/255;for(let i=0;i<n;i++){const j=fx.hitNext++%fx.hitCount,a=Math.random()*Math.PI*2,s=(.9+Math.random()*2.8)*power,k=j*3;if(fx.hitLife[j]<=0)fx.hitLive++;fx.hitPos[k]=at.x;fx.hitPos[k+1]=at.y;fx.hitPos[k+2]=at.z;fx.hitVel[k]=Math.cos(a)*s;fx.hitVel[k+1]=.6+Math.random()*2.4*power;fx.hitVel[k+2]=Math.sin(a)*s;fx.hitLife[j]=.16+Math.random()*.22;fx.hitCol[k]=cr;fx.hitCol[k+1]=cg;fx.hitCol[k+2]=cb;}
 fx.hitPoints.visible=true;fx.hitPoints.geometry.attributes.position.needsUpdate=true;fx.hitPoints.geometry.attributes.color.needsUpdate=true;fx.tailT=Math.max(fx.tailT||0,.4);
}

export function setupBossMotion(o,gl,model,scene,floor=0){
 if(!CLAVE.has(o.b.id))return null;o.model=model;o.actions={};o.motionClip='';
 o.mixer=o.mixer||new THREE.AnimationMixer(model);
 for(const c of gl.animations){const a=o.mixer.clipAction(c);if(!/^(idle|walk)$/.test(c.name)){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;}o.actions[c.name]=a;}
 const warningGeometries={},warningOutlines={};for(const skill in CLAVE_MOTIONS){warningGeometries[skill]=CLAVE_MOTIONS[skill].hits.map(warningGeometry);warningOutlines[skill]=CLAVE_MOTIONS[skill].hits.map(warningOutlineGeometry);}
 const warnMat=new THREE.MeshBasicMaterial({color:0xff3a20,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const warning=new THREE.Mesh(warningGeometries.shutter[0],warnMat);warning.visible=false;warning.position.y=floor+.045;warning.renderOrder=4;scene.add(warning);
 const warnLineMat=new THREE.LineBasicMaterial({color:0xff5a38,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
 const warningOutline=new THREE.Line(warningOutlines.shutter[0],warnLineMat);warningOutline.visible=false;warningOutline.position.y=floor+.052;warningOutline.renderOrder=5;scene.add(warningOutline);
 const count=72,pos=new Float32Array(count*3),vel=new Float32Array(count*3),life=new Float32Array(count);pos.fill(-999);
 const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pos,3));
 const points=new THREE.Points(pg,new THREE.PointsMaterial({color:0xff6a22,size:.075,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,sizeAttenuation:true}));points.frustumCulled=false;points.visible=false;scene.add(points);
 const dustCount=32,dustPos=new Float32Array(dustCount*3),dustVel=new Float32Array(dustCount*3),dustLife=new Float32Array(dustCount);dustPos.fill(-999);
 const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(dustPos,3));
 const dust=new THREE.Points(dg,new THREE.PointsMaterial({color:0x9b684d,size:.13,transparent:true,opacity:.5,depthWrite:false,sizeAttenuation:true}));dust.frustumCulled=false;dust.visible=false;scene.add(dust);
 const hitCount=72,hitPos=new Float32Array(hitCount*3),hitVel=new Float32Array(hitCount*3),hitLife=new Float32Array(hitCount),hitCol=new Float32Array(hitCount*3);hitPos.fill(-999);
 const hg=new THREE.BufferGeometry();hg.setAttribute('position',new THREE.BufferAttribute(hitPos,3));hg.setAttribute('color',new THREE.BufferAttribute(hitCol,3));
 const hitPoints=new THREE.Points(hg,new THREE.PointsMaterial({size:.085,vertexColors:true,transparent:true,opacity:.98,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,sizeAttenuation:true}));hitPoints.frustumCulled=false;hitPoints.visible=false;scene.add(hitPoints);
 const trailPos=new Float32Array(16*3);trailPos.fill(-999);const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.BufferAttribute(trailPos,3));
 tg.setDrawRange(0,0);const trail=new THREE.Line(tg,new THREE.LineBasicMaterial({color:0xff542a,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));trail.frustumCulled=false;trail.visible=false;scene.add(trail);
 const hand=rigNode(model,'RightHandSlot')||rigNode(model,'RightHand')||model,
  feet=[rigNode(model,'LeftFoot'),rigNode(model,'RightFoot')];
 const hips=rigNode(model,'Hips'),overlay={},overlayList=[],source=gl.animations.find(c=>c.name==='atk_claveshut');
 for(const n of ['mixamorigLeftArm','mixamorigLeftForeArm','mixamorigLeftHand','mixamorigRightArm','mixamorigRightForeArm','mixamorigRightHand']){
  const bone=rigNode(model,n),track=source?.tracks.find(t=>bone&&t.name===bone.name+'.quaternion');if(bone&&track){const out=new Float32Array(4),sample={bone,interp:track.createInterpolant(out)};overlay[n]=sample;overlayList.push(sample);}}
 const ringGeometry=new THREE.RingGeometry(.92,1,64),ringPool=[];for(let i=0;i<6;i++){const m=new THREE.Mesh(ringGeometry,new THREE.MeshBasicMaterial({color:0xff4a24,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));m.rotation.x=-Math.PI/2;m.visible=false;scene.add(m);ringPool.push({m,active:false,t:0,life:.48,r:1});}
 const hitCore=new THREE.Mesh(new THREE.IcosahedronGeometry(.18,1),new THREE.MeshBasicMaterial({color:0xffa35a,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));hitCore.visible=false;hitCore.renderOrder=8;scene.add(hitCore);
 const glow=new THREE.PointLight(0xff3218,0,7,1.8);glow.visible=false;scene.add(glow);
 const idleBones={head:rigNode(model,'Head'),spine:rigNode(model,'Spine2')||rigNode(model,'Spine1')||rigNode(model,'Spine'),arm:rigNode(model,'LeftArm'),forearm:rigNode(model,'LeftForeArm')};
 const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 o.fx={scene,floor,warning,warningGeometries,warnMat,warningOutline,warningOutlines,warnLineMat,warnSeq:-1,warnBeat:-1,points,pos,vel,life,count,next:0,sparkLive:0,dust,dustPos,dustVel,dustLife,dustCount,dustNext:0,dustLive:0,
  hitPoints,hitPos,hitVel,hitLife,hitCol,hitCount,hitNext:0,hitLive:0,hitCore,hitCoreT:0,hitCoreDur:.12,hitCoreScale:1,trail,trailPos,trailCount:0,hand,feet,glow,ringGeometry,ringPool,ringActive:0,firedMask:0,lastStep:-1,walkPhase:null,impact:0,impactEvent:false,lastImpactSeq:0,lastImpactAt:0,hitT:0,hitDur:.12,hitPower:0,hitSide:0,hitFront:1,tailT:0,
  hips,hipsBase:hips&&hips.position.clone(),overlay,overlayList,idleBones,idleCue:{breath:0,turn:0,brace:0,pulse:0,guard:0},idleBlend:0,reduced,counterLit:false,frameResult:{step:false,impact:false}};
 o.baseModel={x:model.position.x,y:model.position.y,z:model.position.z,rx:model.rotation.x,rz:model.rotation.z};play(o,'idle');if(!o.netAct){const now=Date.now();o.netAct={id:o.b.id,x:o.root?.position.x??o.b.x,z:o.root?.position.z??o.b.z,yaw:o.root?.rotation.y||0,motion:'idle',skill:'',seq:-1,startedAt:now,endsAt:now+780,counterOpen:0,counterClose:0};}
 return o.fx;
}

export function applyBossAction(o,a,now=Date.now()){
 o.netAct=a;if(!o.fx||!o.root)return;const changed=o.motionSeq!==a.seq||o.motionState!==a.motion,elapsed=Math.max(0,now-a.startedAt);
 if(a.motion==='skill'&&a.skill==='shutter'){const travel=claveShutterTravel(elapsed);o.homeSkillX=a.x-Math.sin(a.yaw)*travel;o.homeSkillZ=a.z-Math.cos(a.yaw)*travel;}else if(changed){o.homeSkillX=a.x;o.homeSkillZ=a.z;}
  if(changed){o.motionSeq=a.seq;o.motionState=a.motion;o.fx.firedMask=0;o.fx.warnSeq=-1;o.fx.warnBeat=-1;if(a.motion==='walk'||a.motion==='return'){o.fx.lastStep=-1;o.fx.walkPhase=null;}
  if(a.motion==='skill')play(o,CLAVE_MOTIONS[a.skill]?.clip||'idle',CLAVE_MOTIONS[a.skill]?.duration||0,elapsed,.09);
  else if(a.motion==='walk'||a.motion==='return')play(o,'walk',0,0,.16);
  else if(a.motion==='stagger'){play(o,'stagger',1350,elapsed,.05);addRing(o.fx,o.root.position.x,o.root.position.z,3.5,0x62dfff,.55);}
  else play(o,'idle',0,0,.18);
 }
}

/* mixer.update 전에 호출한다. 탭 복귀·저FPS여도 몸의 접점이 서버 시계보다 뒤처지지 않는다. */
export function prepareBossMotion(o,now=Date.now()){
 const a=o?.netAct,fx=o?.fx;if(!a||!fx)return false;if(Number.isFinite(o.poseElapsed))now=a.startedAt+o.poseElapsed;const elapsed=Math.max(0,now-a.startedAt);
 if(a.motion==='idle'){const action=o.actions?.idle;if(!action)return false;action.paused=true;action.time=fx.reduced?action.getClip().duration*.58:claveIdleClipTime(elapsed,action.getClip().duration);return true;}
 if(a.motion!=='skill')return false;const def=CLAVE_MOTIONS[a.skill],action=o.actions?.[def?.clip];if(!def||!action)return false;action.paused=true;action.time=claveSkillClipTime(a.skill,elapsed,action.getClip().duration);return true;
}

function warning(o,elapsed,now){
 const fx=o.fx,a=o.netAct,def=CLAVE_MOTIONS[a?.skill];if(a?.motion!=='skill'||!def){fx.warning.visible=fx.warningOutline.visible=false;return;}
 let hi=-1;for(let i=0;i<def.hits.length;i++)if(elapsed<def.hits[i].at){hi=i;break;}
 if(hi<0){fx.warning.visible=fx.warningOutline.visible=false;return;}const h=def.hits[hi];
 if(a.seq!==fx.warnSeq||hi!==fx.warnBeat){fx.warning.geometry=fx.warningGeometries[a.skill][hi];fx.warningOutline.geometry=fx.warningOutlines[a.skill][hi];fx.warnSeq=a.seq;fx.warnBeat=hi;}
 const prev=hi?def.hits[hi-1].at+120:0,span=Math.max(1,h.at-prev),p=Math.max(0,Math.min(1,(elapsed-prev)/span)),counter=now>=a.counterOpen&&now<=a.counterClose;
 const x=a.skill==='shutter'?(o.homeSkillX??a.x):a.x,z=a.skill==='shutter'?(o.homeSkillZ??a.z):a.z,scale=fx.reduced?1:.96+.04*Math.sin(now*.018);
 fx.warning.visible=fx.warningOutline.visible=true;fx.warning.position.set(x,fx.floor+.045,z);fx.warningOutline.position.set(x,fx.floor+.052,z);fx.warning.rotation.y=fx.warningOutline.rotation.y=a.yaw;
 fx.warnMat.color.setHex(counter?0x64ddff:0xff321d);fx.warnLineMat.color.setHex(counter?0x9decff:0xff6948);fx.warnMat.opacity=(counter?.016:.026)+p*(counter?.045:.07)+(fx.reduced?0:Math.sin(now*.024)*.01);fx.warnLineMat.opacity=(counter?.42:.28)+p*(counter?.28:.36);
 fx.warning.scale.setScalar(scale);fx.warningOutline.scale.setScalar(scale);
}
function updateParticles(fx,dt,attacking,alive=true,counter=false){
 fx.hand.getWorldPosition(TMP);fx.glow.position.copy(TMP);fx.glow.intensity=alive?(attacking?4.8:1.4):0;fx.glow.visible=alive;
 if(counter!==fx.counterLit){fx.counterLit=counter;fx.glow.color.setHex(counter?0x64ddff:0xff3218);fx.trail.material.color.setHex(counter?0x64ddff:0xff542a);}
 if(alive&&attacking&&!fx.reduced&&Math.random()<Math.min(1,dt*36))burst(fx,TMP,2,.45);
 if(fx.sparkLive){for(let i=0;i<fx.count;i++){if(fx.life[i]<=0)continue;fx.life[i]-=dt;const k=i*3;fx.vel[k+1]-=6*dt;fx.pos[k]+=fx.vel[k]*dt;fx.pos[k+1]+=fx.vel[k+1]*dt;fx.pos[k+2]+=fx.vel[k+2]*dt;if(fx.life[i]<=0){fx.life[i]=0;fx.sparkLive--;fx.pos[k]=fx.pos[k+1]=fx.pos[k+2]=-999;}}fx.points.geometry.attributes.position.needsUpdate=true;fx.points.visible=fx.sparkLive>0;}
 if(fx.dustLive){for(let i=0;i<fx.dustCount;i++){if(fx.dustLife[i]<=0)continue;fx.dustLife[i]-=dt;const k=i*3;fx.dustVel[k]*=Math.max(0,1-dt*4);fx.dustVel[k+2]*=Math.max(0,1-dt*4);fx.dustPos[k]+=fx.dustVel[k]*dt;fx.dustPos[k+1]+=fx.dustVel[k+1]*dt;fx.dustPos[k+2]+=fx.dustVel[k+2]*dt;if(fx.dustLife[i]<=0){fx.dustLife[i]=0;fx.dustLive--;fx.dustPos[k]=fx.dustPos[k+1]=fx.dustPos[k+2]=-999;}}fx.dust.geometry.attributes.position.needsUpdate=true;fx.dust.visible=fx.dustLive>0;}
 if(fx.hitLive){for(let i=0;i<fx.hitCount;i++){if(fx.hitLife[i]<=0)continue;fx.hitLife[i]-=dt;const k=i*3;fx.hitVel[k+1]-=7*dt;fx.hitPos[k]+=fx.hitVel[k]*dt;fx.hitPos[k+1]+=fx.hitVel[k+1]*dt;fx.hitPos[k+2]+=fx.hitVel[k+2]*dt;if(fx.hitLife[i]<=0){fx.hitLife[i]=0;fx.hitLive--;fx.hitPos[k]=fx.hitPos[k+1]=fx.hitPos[k+2]=-999;}}fx.hitPoints.geometry.attributes.position.needsUpdate=true;fx.hitPoints.visible=fx.hitLive>0;}
 if(fx.hitCoreT>0){fx.hitCoreT=Math.max(0,fx.hitCoreT-dt);const p=fx.hitCoreT/Math.max(.001,fx.hitCoreDur),s=fx.hitCoreScale*(fx.reduced?1:1+(1-p)*.32);fx.hitCore.scale.setScalar(s);fx.hitCore.material.opacity=p*.96;if(!fx.hitCoreT)fx.hitCore.visible=false;}
 let trailChanged=false,trailOn=attacking&&!fx.reduced;if(trailOn){const n=Math.min(15,fx.trailCount);for(let i=n;i>0;i--){const k=i*3,p=k-3;fx.trailPos[k]=fx.trailPos[p];fx.trailPos[k+1]=fx.trailPos[p+1];fx.trailPos[k+2]=fx.trailPos[p+2];}fx.trailPos[0]=TMP.x;fx.trailPos[1]=TMP.y;fx.trailPos[2]=TMP.z;fx.trailCount=Math.min(16,fx.trailCount+1);trailChanged=true;}else if(fx.trailCount){fx.trailCount=fx.reduced?0:fx.trailCount-1;trailChanged=true;}
 if(trailChanged){fx.trail.geometry.setDrawRange(0,fx.trailCount);fx.trail.geometry.attributes.position.needsUpdate=true;}fx.trail.visible=fx.trailCount>1;fx.trail.material.opacity=trailOn?.8:Math.max(0,fx.trail.material.opacity-dt*4);
}
function updateRings(fx,dt){if(!fx.ringActive)return;for(let i=0;i<fx.ringPool.length;i++){const r=fx.ringPool[i];if(!r.active)continue;r.t+=dt;const p=Math.min(1,r.t/r.life);r.m.scale.setScalar(fx.reduced?r.r:ease(.25,r.r,p));r.m.material.opacity=(1-p)*.85;if(p>=1){r.active=false;r.m.visible=false;fx.ringActive--;}}}

export function updateBossMotion(o,dt,now=Date.now()){
 if(!o.fx||!o.root)return;const a=o.netAct,fx=o.fx;
 if(a&&Number.isFinite(o.poseElapsed))now=a.startedAt+o.poseElapsed;
 const elapsed=a?Math.max(0,now-a.startedAt):0,walk=a&&(a.motion==='walk'||a.motion==='return'),idle=a?.motion==='idle',skill=a?.motion==='skill',stagger=a?.motion==='stagger',counter=claveCounterActive(a,now),striking=skill&&claveStrikeActive(a.skill,elapsed),stormBias=skill&&a.skill==='storm'?claveStormBias(elapsed):0,staggerPose=stagger?claveStaggerPose(elapsed):0,base=o.baseModel;let stepped=false;
 if(a){let tx=a.x,tz=a.z;if(skill&&a.skill==='shutter'&&Number.isFinite(o.homeSkillX)){const travel=claveShutterTravel(elapsed);tx=o.homeSkillX+Math.sin(a.yaw)*travel;tz=o.homeSkillZ+Math.cos(a.yaw)*travel;}if(skill||stagger){o.root.position.x=tx;o.root.position.z=tz;o.root.rotation.y=a.yaw;}else{const k=Math.min(1,dt*9);o.root.position.x+=(tx-o.root.position.x)*k;o.root.position.z+=(tz-o.root.position.z)*k;const d=Math.atan2(Math.sin(a.yaw-o.root.rotation.y),Math.cos(a.yaw-o.root.rotation.y)),cap=dt*(walk?2.8:2.25);o.root.rotation.y+=Math.sign(d)*Math.min(Math.abs(d),cap);}}
 const idleTarget=idle&&!fx.reduced?1:0,idleStep=Math.min(1,dt/(idleTarget?.12:.1));fx.idleBlend+=Math.sign(idleTarget-fx.idleBlend)*Math.min(Math.abs(idleTarget-fx.idleBlend),idleStep);if(idle)claveIdleCues(elapsed,fx.idleCue);
 if(o.model&&base){let rx=base.rx,rz=base.rz,targetY=base.y;
  if(walk){const action=o.actions?.walk,dur=action?.getClip().duration||.833,phase=((action?.time||0)/dur%1+1)%1,prev=fx.walkPhase;
   let nearest=1;for(let i=0;i<CLAVE_WALK_CONTACTS.length;i++){const d=Math.abs(phase-CLAVE_WALK_CONTACTS[i]);nearest=Math.min(nearest,d,1-d);}const lift=Math.sin(Math.min(1,nearest/.245)*Math.PI*.5);targetY=base.y+lift*.026-Math.pow(1-lift,5)*.012;rz+=Math.sin(phase*Math.PI*2)*.02;rx-=.035;
   const contact=claveWalkContact(prev,phase);fx.walkPhase=phase;
   if(contact>=0&&contact!==fx.lastStep){fx.lastStep=contact;const foot=fx.feet[contact];if(foot)foot.getWorldPosition(TMP);else TMP.set(o.root.position.x,fx.floor,o.root.position.z);TMP.y=fx.floor+.035;dustBurst(fx,TMP,9);addRing(fx,TMP.x,TMP.z,.72,0x9b684d,.30);stepped=true;}}
  else if(idle)rz+=(fx.idleCue.breath*.003+fx.idleCue.brace*.002)*fx.idleBlend;
  if(skill&&a.skill==='shutter'&&elapsed>=1200&&elapsed<=1850){rx-=.06;rz+=.025;}else if(stormBias){rx-=Math.abs(stormBias)*.025;rz+=stormBias*.075;}else if(staggerPose){targetY-=staggerPose*.07;rx+=staggerPose*.18;rz-=staggerPose*.095;}
  if(fx.hitT>0){fx.hitT=Math.max(0,fx.hitT-dt);const u=fx.hitT/Math.max(.001,fx.hitDur),kick=Math.sin(Math.min(1,(1-u)*3)*Math.PI*.5)*u*fx.hitPower;rx+=fx.hitFront*kick;rz-=fx.hitSide*kick;}
  const follow=walk||fx.hitT>0?1:Math.min(1,dt*8);o.model.position.y+=(targetY-o.model.position.y)*(walk?1:Math.min(1,dt*7));o.model.rotation.x+=(rx-o.model.rotation.x)*follow;o.model.rotation.z+=(rz-o.model.rotation.z)*follow;}
 /* 클립의 큰 루트 이동은 서버 위치와 겹치므로 수평을 잠근다. idle/slam의 과한 부유만 감쇠한다. */
 if(fx.hips&&fx.hipsBase){fx.hips.position.x=fx.hipsBase.x;fx.hips.position.z=fx.hipsBase.z;const hipScale=idle?.35:skill&&a.skill==='slam'?.2:1;fx.hips.position.y=fx.hipsBase.y+(fx.hips.position.y-fx.hipsBase.y)*hipScale;}
 /* mixer가 매 프레임 원본 자세를 다시 쓰고 난 뒤 더하므로 고정 포즈에서도 누적되지 않는다. */
 if(fx.idleBlend&&!fx.reduced){const c=fx.idleCue,b=fx.idleBlend,arm=b,B=fx.idleBones;
  if(B.spine)B.spine.quaternion.multiply(ROT.setFromAxisAngle(AXIS_Z,(c.breath*.009-c.guard*.004)*b));
  if(B.head)B.head.quaternion.multiply(ROT.setFromAxisAngle(AXIS_Y,c.turn*.035*b));
  if(B.arm&&arm)B.arm.quaternion.multiply(ROT.setFromAxisAngle(AXIS_Z,-c.brace*.028*arm));
  if(B.forearm&&arm)B.forearm.quaternion.multiply(ROT.setFromAxisAngle(AXIS_X,c.pulse*.018*arm));
 }
 if(stormBias&&fx.idleBones.spine)fx.idleBones.spine.quaternion.multiply(ROT.setFromAxisAngle(AXIS_Y,stormBias*.12));
 /* 일반 slam 클립은 리타깃 때 팔 키가 빠졌다. 전용 셔터 클립의 팔 궤적만 표본화해 머리 위 들기→멈춤→내려찍기를 복원한다. */
 if(skill&&a.skill==='slam'){
  const st=claveSlamShutterTime(elapsed);for(let i=0;i<fx.overlayList.length;i++){const s=fx.overlayList[i];s.bone.quaternion.fromArray(s.interp.evaluate(st));}
 }
 warning(o,elapsed,now);
 if(skill){const def=CLAVE_MOTIONS[a.skill];for(let i=0;i<(def?.hits.length||0);i++){const h=def.hits[i],bit=1<<i;if(elapsed>=h.at&&!(fx.firedMask&bit)){fx.firedMask|=bit;if(elapsed-h.at<420){fx.hand.getWorldPosition(TMP);if(!fx.reduced)burst(fx,TMP,20,1.15);addRing(fx,a.x,a.z,h.radius||h.range||4,0xffa052,.36);fx.impact=.28;fx.impactEvent=true;}}}}
 const impacted=fx.impactEvent;fx.impactEvent=false;fx.impact=Math.max(0,fx.impact-dt);updateParticles(fx,dt,striking,!!o.alive,counter);updateRings(fx,dt);fx.tailT=Math.max(0,fx.tailT-dt);fx.frameResult.step=stepped;fx.frameResult.impact=impacted;return fx.frameResult;
}

export function bossHitReact(o,h={}){const fx=o?.fx;if(!fx)return false;const seq=Number(h.seq)||0,at=Number(h.at)||0,newEpoch=seq&&seq<=fx.lastImpactSeq&&at>fx.lastImpactAt+1000;if(seq&&seq<=fx.lastImpactSeq&&!newEpoch)return false;if(seq){fx.lastImpactSeq=seq;fx.lastImpactAt=at||Date.now();}
 if(h.silent)return false;
 const crit=!!h.crit,counter=!!h.counter,x=Number.isFinite(h.x)?h.x:o.root.position.x,z=Number.isFinite(h.z)?h.z:o.root.position.z,y=o.root.position.y+(o.h||o.b?.h||3)*.55,bx=o.root.position.x,bz=o.root.position.z,dx=x-bx,dz=z-bz,dist=Math.hypot(dx,dz)||1,reach=Math.min(1.1,dist*.55);
 TMP.set(bx+dx/dist*reach,y,bz+dz/dist*reach);hitBurst(fx,TMP,counter?30:crit?22:12,counter?1.4:crit?1.15:.82,counter?0x77e8ff:crit?0xffd36a:0xff7938);fx.hitCore.position.copy(TMP);fx.hitCore.material.color.setHex(counter?0xc8f7ff:crit?0xffe39a:0xffa35a);fx.hitCoreScale=counter?2.1:crit?1.65:1;fx.hitCore.scale.setScalar(fx.hitCoreScale);fx.hitCoreDur=counter?.18:crit?.15:.11;fx.hitCoreT=fx.hitCoreDur;fx.hitCore.material.opacity=.96;fx.hitCore.visible=true;fx.tailT=Math.max(fx.tailT,fx.hitCoreDur);
 const ang=Math.atan2(x-o.root.position.x,z-o.root.position.z)-o.root.rotation.y;fx.hitSide=Math.sin(ang);fx.hitFront=Math.cos(ang);fx.hitDur=counter?.2:crit?.18:.12;fx.hitT=fx.hitDur;fx.hitPower=counter?.09:crit?.065:.038;return true;}
export function bossCounterBurst(o){if(!o.fx)return;o.fx.hand.getWorldPosition(TMP);if(!o.fx.reduced)burst(o.fx,TMP,34,1.45);addRing(o.fx,o.root.position.x,o.root.position.z,4.5,0x68e5ff,.65);}
export function hideBossMotion(o){const fx=o.fx;if(!fx)return;fx.warning.visible=fx.warningOutline.visible=false;fx.glow.intensity=0;fx.glow.visible=false;fx.trail.material.opacity=0;fx.trail.visible=false;fx.trailCount=0;fx.trail.geometry.setDrawRange(0,0);fx.pos.fill(-999);fx.life.fill(0);fx.sparkLive=0;fx.dustPos.fill(-999);fx.dustLife.fill(0);fx.dustLive=0;fx.hitPos.fill(-999);fx.hitLife.fill(0);fx.hitLive=0;fx.hitCoreT=0;fx.hitCore.visible=false;fx.points.visible=fx.dust.visible=fx.hitPoints.visible=false;fx.points.geometry.attributes.position.needsUpdate=true;fx.dust.geometry.attributes.position.needsUpdate=true;fx.hitPoints.geometry.attributes.position.needsUpdate=true;fx.hitT=0;fx.tailT=0;fx.idleBlend=0;fx.firedMask=0;fx.warnSeq=fx.warnBeat=-1;fx.counterLit=false;o.motionSeq=Number.NaN;o.motionState='';for(const name in o.actions)o.actions[name].stop();o.motionClip='';for(let i=0;i<fx.ringPool.length;i++){fx.ringPool[i].active=false;fx.ringPool[i].m.visible=false;}fx.ringActive=0;}
export function disposeBossMotion(o){const fx=o.fx;if(!fx)return;for(const x of [fx.warning,fx.warningOutline,fx.points,fx.dust,fx.hitPoints,fx.hitCore,fx.trail,fx.glow])fx.scene.remove(x);for(let i=0;i<fx.ringPool.length;i++){fx.scene.remove(fx.ringPool[i].m);fx.ringPool[i].m.material.dispose();}fx.ringGeometry.dispose();for(const skill in fx.warningGeometries)for(let i=0;i<fx.warningGeometries[skill].length;i++){fx.warningGeometries[skill][i].dispose();fx.warningOutlines[skill][i].dispose();}fx.warnMat.dispose();fx.warnLineMat.dispose();for(const x of [fx.points,fx.dust,fx.hitPoints,fx.hitCore,fx.trail]){x.geometry.dispose();x.material.dispose();}if(o.mixer){o.mixer.stopAllAction();if(o.model)o.mixer.uncacheRoot(o.model);}o.actions={};o.mixer=null;o.fx=null;}
