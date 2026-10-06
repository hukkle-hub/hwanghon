/* 필드 보스 화면 동작 — 서버 상태를 GLB 클립·지면 예고·검 궤적·불티로 번역한다.
   판정은 server/field-boss-combat.cjs 한 곳뿐이며, 여기서는 체력을 알거나 판정하지 않는다. */
import * as THREE from '../../vendor/three/three.module.js';

export const CLAVE_MOTIONS={
 shutter:{clip:'atk_claveshut',duration:3400,hits:[{at:1720,shape:'line',range:7.2,width:2.2}]},
 storm:{clip:'atk_clavestorm',duration:4300,hits:[{at:1315,shape:'cone',range:4.8,angle:1.8},{at:2135,shape:'cone',range:5.1,angle:2.05},{at:2955,shape:'circle',radius:5.4}],counter:[2600,2955]},
 slam:{clip:'atk_slam',duration:3050,hits:[{at:1540,shape:'circle',radius:5.2}],counter:[1190,1540]}
};
const CLAVE=new Set(['clave','clave2']),TMP=new THREE.Vector3();
export const CLAVE_WALK_CONTACTS=[.121,.638];   /* clave.glb walk 발높이 최저점의 정규화 위상 */
export function claveWalkContact(prev,phase){let contact=-1;for(let i=0;i<CLAVE_WALK_CONTACTS.length;i++){const m=CLAVE_WALK_CONTACTS[i],d=Math.abs(phase-m),crossed=prev==null?Math.min(d,1-d)<.035:phase>=prev?(prev<m&&m<=phase):(m>prev||m<=phase);if(crossed)contact=i;}return contact;}
const ease=(a,b,k)=>a+(b-a)*(1-Math.pow(1-k,3));
function rigNode(model,name){
 const bare=name.replace(/^mixamorig:?/,'');
 return model.getObjectByName(name)||model.getObjectByName('mixamorig:'+bare)||model.getObjectByName('mixamorig'+bare)||model.getObjectByName(bare);
}

function warningGeometry(h){
 const pos=[],idx=[];
 if(h.shape==='line'){
  const w=h.width/2,r=h.range;pos.push(-w,0,0,w,0,0,w,0,r,-w,0,r);idx.push(0,1,2,0,2,3);
 }else{
  const radius=h.radius||h.range,arc=h.shape==='cone'?h.angle:Math.PI*2,n=64,start=h.shape==='cone'?-arc/2:-Math.PI;
  pos.push(0,0,0);for(let i=0;i<=n;i++){const a=start+arc*i/n;pos.push(Math.sin(a)*radius,0,Math.cos(a)*radius);}
  for(let i=1;i<=n;i++)idx.push(0,i,i+1);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function addRing(fx,x,z,r,color=0xff4a24,life=.48){
 const m=new THREE.Mesh(new THREE.RingGeometry(.86,1,64),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
 m.rotation.x=-Math.PI/2;m.position.set(x,fx.floor+.06,z);m.scale.setScalar(.25);fx.scene.add(m);fx.rings.push({m,t:0,life,r});fx.tailT=Math.max(fx.tailT||0,life);
}
function play(o,name,duration=0,elapsed=0,fade=.12){
 const a=o.actions?.[name];if(!a)return;const old=o.actions[o.motionClip];if(old===a&&o.motionClip===name){a.paused=false;if(duration){a.timeScale=Math.max(.35,a.getClip().duration/(duration/1000));a.time=Math.min(a.getClip().duration*.96,Math.max(0,elapsed/1000*a.timeScale));}return;}
 a.enabled=true;a.reset();if(name==='idle'||name==='walk'){a.setLoop(THREE.LoopRepeat,Infinity);a.clampWhenFinished=false;a.timeScale=name==='walk'?.82:.72;}
 else{a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.timeScale=duration?Math.max(.35,a.getClip().duration/(duration/1000)):1;a.time=Math.min(a.getClip().duration*.96,Math.max(0,elapsed/1000*a.timeScale));}
 a.play();if(old&&old!==a)a.crossFadeFrom(old,fade,false);o.motionClip=name;
}
function burst(fx,at,n=14,power=1){
 for(let i=0;i<n;i++){const j=fx.next++%fx.count,a=Math.random()*Math.PI*2,s=(.8+Math.random()*2.4)*power;fx.pos[j*3]=at.x;fx.pos[j*3+1]=at.y;fx.pos[j*3+2]=at.z;fx.vel[j*3]=Math.cos(a)*s;fx.vel[j*3+1]=1.5+Math.random()*3*power;fx.vel[j*3+2]=Math.sin(a)*s;fx.life[j]=.3+Math.random()*.45;}
 fx.points.geometry.attributes.position.needsUpdate=true;fx.tailT=Math.max(fx.tailT||0,.76);
}
function dustBurst(fx,at,n=8){
 for(let i=0;i<n;i++){const j=fx.dustNext++%fx.dustCount,a=Math.random()*Math.PI*2,s=.18+Math.random()*.55,k=j*3;fx.dustPos[k]=at.x;fx.dustPos[k+1]=fx.floor+.035;fx.dustPos[k+2]=at.z;fx.dustVel[k]=Math.cos(a)*s;fx.dustVel[k+1]=.12+Math.random()*.25;fx.dustVel[k+2]=Math.sin(a)*s;fx.dustLife[j]=.28+Math.random()*.22;}
 fx.dust.geometry.attributes.position.needsUpdate=true;fx.tailT=Math.max(fx.tailT||0,.51);
}
function hitBurst(fx,at,n=12,power=1,color=0xff7938){
 const c=new THREE.Color(color);for(let i=0;i<n;i++){const j=fx.hitNext++%fx.hitCount,a=Math.random()*Math.PI*2,s=(.9+Math.random()*2.8)*power,k=j*3;fx.hitPos[k]=at.x;fx.hitPos[k+1]=at.y;fx.hitPos[k+2]=at.z;fx.hitVel[k]=Math.cos(a)*s;fx.hitVel[k+1]=.6+Math.random()*2.4*power;fx.hitVel[k+2]=Math.sin(a)*s;fx.hitLife[j]=.16+Math.random()*.22;fx.hitCol[k]=c.r;fx.hitCol[k+1]=c.g;fx.hitCol[k+2]=c.b;}
 fx.hitPoints.geometry.attributes.position.needsUpdate=true;fx.hitPoints.geometry.attributes.color.needsUpdate=true;fx.tailT=Math.max(fx.tailT||0,.4);
}

export function setupBossMotion(o,gl,model,scene,floor=0){
 if(!CLAVE.has(o.b.id))return null;o.model=model;o.actions={};o.motionClip='';
 o.mixer=o.mixer||new THREE.AnimationMixer(model);
 for(const c of gl.animations){const a=o.mixer.clipAction(c);if(!/^(idle|walk)$/.test(c.name)){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;}o.actions[c.name]=a;}
 const warnMat=new THREE.MeshBasicMaterial({color:0xff3a20,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const warning=new THREE.Mesh(warningGeometry({shape:'circle',radius:1}),warnMat);warning.visible=false;warning.position.y=floor+.045;warning.renderOrder=4;scene.add(warning);
 const count=72,pos=new Float32Array(count*3),vel=new Float32Array(count*3),life=new Float32Array(count);pos.fill(-999);
 const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pos,3));
 const points=new THREE.Points(pg,new THREE.PointsMaterial({color:0xff6a22,size:.075,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,sizeAttenuation:true}));points.frustumCulled=false;scene.add(points);
 const dustCount=32,dustPos=new Float32Array(dustCount*3),dustVel=new Float32Array(dustCount*3),dustLife=new Float32Array(dustCount);dustPos.fill(-999);
 const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(dustPos,3));
 const dust=new THREE.Points(dg,new THREE.PointsMaterial({color:0x9b684d,size:.13,transparent:true,opacity:.5,depthWrite:false,sizeAttenuation:true}));dust.frustumCulled=false;scene.add(dust);
 const hitCount=72,hitPos=new Float32Array(hitCount*3),hitVel=new Float32Array(hitCount*3),hitLife=new Float32Array(hitCount),hitCol=new Float32Array(hitCount*3);hitPos.fill(-999);
 const hg=new THREE.BufferGeometry();hg.setAttribute('position',new THREE.BufferAttribute(hitPos,3));hg.setAttribute('color',new THREE.BufferAttribute(hitCol,3));
 const hitPoints=new THREE.Points(hg,new THREE.PointsMaterial({size:.085,vertexColors:true,transparent:true,opacity:.98,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,sizeAttenuation:true}));hitPoints.frustumCulled=false;scene.add(hitPoints);
 const trailPos=new Float32Array(16*3);trailPos.fill(-999);const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.BufferAttribute(trailPos,3));
 const trail=new THREE.Line(tg,new THREE.LineBasicMaterial({color:0xff542a,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));trail.frustumCulled=false;scene.add(trail);
 const hand=rigNode(model,'RightHandSlot')||rigNode(model,'RightHand')||model,
  feet=[rigNode(model,'LeftFoot'),rigNode(model,'RightFoot')];
 const hips=rigNode(model,'Hips'),overlay={},source=gl.animations.find(c=>c.name==='atk_claveshut');
 for(const n of ['mixamorigLeftArm','mixamorigLeftForeArm','mixamorigLeftHand','mixamorigRightArm','mixamorigRightForeArm','mixamorigRightHand']){
  const bone=rigNode(model,n),track=source?.tracks.find(t=>bone&&t.name===bone.name+'.quaternion');if(bone&&track){const out=new Float32Array(4);overlay[n]={bone,interp:track.createInterpolant(out)};}}
 const glow=new THREE.PointLight(0xff3218,0,7,1.8);scene.add(glow);
 o.fx={scene,floor,warning,warnMat,warnKey:'',points,pos,vel,life,count,next:0,dust,dustPos,dustVel,dustLife,dustCount,dustNext:0,
  hitPoints,hitPos,hitVel,hitLife,hitCol,hitCount,hitNext:0,trail,trailPos,trailHistory:[],hand,feet,glow,rings:[],fired:new Set(),lastStep:-1,walkPhase:null,impact:0,impactEvent:false,lastImpactSeq:0,lastImpactAt:0,hitT:0,hitDur:.12,hitPower:0,hitSide:0,hitFront:1,tailT:0,
  hips,hipsBase:hips&&hips.position.clone(),overlay};
 o.baseModel={x:model.position.x,y:model.position.y,z:model.position.z,rx:model.rotation.x,rz:model.rotation.z};play(o,'idle');
 return o.fx;
}

export function applyBossAction(o,a,now=Date.now()){
 o.netAct=a;if(!o.fx||!o.root)return;const changed=o.motionSeq!==a.seq||o.motionState!==a.motion;
  if(changed){o.motionSeq=a.seq;o.motionState=a.motion;o.fx.fired.clear();o.fx.warnKey='';if(a.motion==='walk'||a.motion==='return'){o.fx.lastStep=-1;o.fx.walkPhase=null;}o.homeSkillX=a.x;o.homeSkillZ=a.z;const elapsed=Math.max(0,now-a.startedAt);
  if(a.motion==='skill')play(o,CLAVE_MOTIONS[a.skill]?.clip||'idle',CLAVE_MOTIONS[a.skill]?.duration||0,elapsed,.09);
  else if(a.motion==='walk'||a.motion==='return')play(o,'walk',0,0,.16);
  else if(a.motion==='stagger'){play(o,'stagger',1350,elapsed,.05);addRing(o.fx,o.root.position.x,o.root.position.z,3.5,0x62dfff,.55);}
  else play(o,'idle',0,0,.18);
 }
}

function warning(o,elapsed,now){
 const fx=o.fx,a=o.netAct,def=CLAVE_MOTIONS[a?.skill];if(a?.motion!=='skill'||!def){fx.warning.visible=false;return;}
 let hi=-1;for(let i=0;i<def.hits.length;i++)if(elapsed<def.hits[i].at){hi=i;break;}
 if(hi<0){fx.warning.visible=false;return;}const h=def.hits[hi],key=a.seq+':'+hi;
 if(key!==fx.warnKey){fx.warning.geometry.dispose();fx.warning.geometry=warningGeometry(h);fx.warnKey=key;}
 const prev=hi?def.hits[hi-1].at+120:0,span=Math.max(1,h.at-prev),p=Math.max(0,Math.min(1,(elapsed-prev)/span)),counter=now>=a.counterOpen&&now<=a.counterClose;
 fx.warning.visible=true;fx.warning.position.set(a.skill==='shutter'?(o.homeSkillX??a.x):a.x,fx.floor+.045,a.skill==='shutter'?(o.homeSkillZ??a.z):a.z);fx.warning.rotation.y=a.yaw;
 fx.warnMat.color.setHex(counter?0x64ddff:0xff321d);fx.warnMat.opacity=.045+p*.095+Math.sin(now*.024)*.015;
 fx.warning.scale.setScalar(.96+.04*Math.sin(now*.018));
}
function updateParticles(fx,dt,attacking,alive=true){
 fx.hand.getWorldPosition(TMP);fx.glow.position.copy(TMP);fx.glow.intensity=alive?(attacking?4.8:1.4):0;
 if(alive&&attacking&&Math.random()<Math.min(1,dt*36))burst(fx,TMP,2,.45);
 for(let i=0;i<fx.count;i++){if(fx.life[i]<=0)continue;fx.life[i]-=dt;const k=i*3;fx.vel[k+1]-=6*dt;fx.pos[k]+=fx.vel[k]*dt;fx.pos[k+1]+=fx.vel[k+1]*dt;fx.pos[k+2]+=fx.vel[k+2]*dt;if(fx.life[i]<=0)fx.pos[k]=fx.pos[k+1]=fx.pos[k+2]=-999;}
 fx.points.geometry.attributes.position.needsUpdate=true;
 for(let i=0;i<fx.dustCount;i++){if(fx.dustLife[i]<=0)continue;fx.dustLife[i]-=dt;const k=i*3;fx.dustVel[k]*=Math.max(0,1-dt*4);fx.dustVel[k+2]*=Math.max(0,1-dt*4);fx.dustPos[k]+=fx.dustVel[k]*dt;fx.dustPos[k+1]+=fx.dustVel[k+1]*dt;fx.dustPos[k+2]+=fx.dustVel[k+2]*dt;if(fx.dustLife[i]<=0)fx.dustPos[k]=fx.dustPos[k+1]=fx.dustPos[k+2]=-999;}fx.dust.geometry.attributes.position.needsUpdate=true;
 for(let i=0;i<fx.hitCount;i++){if(fx.hitLife[i]<=0)continue;fx.hitLife[i]-=dt;const k=i*3;fx.hitVel[k+1]-=7*dt;fx.hitPos[k]+=fx.hitVel[k]*dt;fx.hitPos[k+1]+=fx.hitVel[k+1]*dt;fx.hitPos[k+2]+=fx.hitVel[k+2]*dt;if(fx.hitLife[i]<=0)fx.hitPos[k]=fx.hitPos[k+1]=fx.hitPos[k+2]=-999;}fx.hitPoints.geometry.attributes.position.needsUpdate=true;
 if(attacking){fx.trailHistory.unshift(TMP.clone());fx.trailHistory.length=Math.min(16,fx.trailHistory.length);}else if(fx.trailHistory.length)fx.trailHistory.pop();
 for(let i=0;i<16;i++){const p=fx.trailHistory[i],k=i*3;fx.trailPos[k]=p?.x??-999;fx.trailPos[k+1]=p?.y??-999;fx.trailPos[k+2]=p?.z??-999;}fx.trail.geometry.attributes.position.needsUpdate=true;fx.trail.material.opacity=attacking?.8:Math.max(0,fx.trail.material.opacity-dt*4);
}
function updateRings(fx,dt){for(let i=fx.rings.length-1;i>=0;i--){const r=fx.rings[i];r.t+=dt;const p=Math.min(1,r.t/r.life);r.m.scale.setScalar(ease(.25,r.r,p));r.m.material.opacity=(1-p)*.85;if(p>=1){fx.scene.remove(r.m);r.m.geometry.dispose();r.m.material.dispose();fx.rings.splice(i,1);}}}

export function updateBossMotion(o,dt,now=Date.now()){
 if(!o.fx||!o.root)return;const a=o.netAct,fx=o.fx;
 if(a&&Number.isFinite(o.poseElapsed))now=a.startedAt+o.poseElapsed;
 if(a){const k=Math.min(1,dt*9);o.root.position.x+=(a.x-o.root.position.x)*k;o.root.position.z+=(a.z-o.root.position.z)*k;const d=Math.atan2(Math.sin(a.yaw-o.root.rotation.y),Math.cos(a.yaw-o.root.rotation.y)),cap=dt*((a.motion==='walk'||a.motion==='return')?2.8:2.25);o.root.rotation.y+=Math.sign(d)*Math.min(Math.abs(d),cap);}
 const walk=a&&(a.motion==='walk'||a.motion==='return'),skill=a?.motion==='skill',base=o.baseModel;let stepped=false;
 if(o.model&&base){let rx=base.rx,rz=base.rz,targetY=base.y;
  if(walk){const action=o.actions?.walk,dur=action?.getClip().duration||.833,phase=((action?.time||0)/dur%1+1)%1,prev=fx.walkPhase;
   const nearest=Math.min(...CLAVE_WALK_CONTACTS.map(m=>{const d=Math.abs(phase-m);return Math.min(d,1-d);})),lift=Math.sin(Math.min(1,nearest/.245)*Math.PI*.5);targetY=base.y+lift*.026-Math.pow(1-lift,5)*.012;rz+=Math.sin(phase*Math.PI*2)*.02;rx-=.035;
   const contact=claveWalkContact(prev,phase);fx.walkPhase=phase;
   if(contact>=0&&contact!==fx.lastStep){fx.lastStep=contact;const foot=fx.feet[contact];if(foot)foot.getWorldPosition(TMP);else TMP.set(o.root.position.x,fx.floor,o.root.position.z);TMP.y=fx.floor+.035;dustBurst(fx,TMP,9);addRing(fx,TMP.x,TMP.z,.72,0x9b684d,.30);stepped=true;}}
  else if(a?.motion==='idle')rz+=Math.sin(now*.0017)*.006;
  if(fx.hitT>0){fx.hitT=Math.max(0,fx.hitT-dt);const u=fx.hitT/Math.max(.001,fx.hitDur),kick=Math.sin(Math.min(1,(1-u)*3)*Math.PI*.5)*u*fx.hitPower;rx+=fx.hitFront*kick;rz-=fx.hitSide*kick;}
  const follow=walk||fx.hitT>0?1:Math.min(1,dt*8);o.model.position.y+=(targetY-o.model.position.y)*(walk?1:Math.min(1,dt*7));o.model.rotation.x+=(rx-o.model.rotation.x)*follow;o.model.rotation.z+=(rz-o.model.rotation.z)*follow;}
 const elapsed=a?Math.max(0,now-a.startedAt):0;
 /* 클립의 큰 루트 이동은 서버 위치와 겹치므로 수평만 잠근다. 세로 중량 이동은 남긴다. */
 if(fx.hips&&fx.hipsBase){fx.hips.position.x=fx.hipsBase.x;fx.hips.position.z=fx.hipsBase.z;}
 /* 일반 slam 클립은 리타깃 때 팔 키가 빠졌다. 전용 셔터 클립의 팔 궤적만 표본화해 머리 위 들기→멈춤→내려찍기를 복원한다. */
 if(skill&&a.skill==='slam'){
  let st;if(elapsed<1190)st=1.9*elapsed/1190;else if(elapsed<1540)st=1.9;else if(elapsed<1940)st=1.9+(elapsed-1540)/400*.65;else st=2.55+(elapsed-1940)/(3050-1940)*1.25;
  for(const s of Object.values(fx.overlay))s.bone.quaternion.fromArray(s.interp.evaluate(Math.min(3.8,st)));
 }
 warning(o,elapsed,now);
 if(skill){const def=CLAVE_MOTIONS[a.skill];for(let i=0;i<(def?.hits.length||0);i++){const h=def.hits[i],key=a.seq+':'+i;if(elapsed>=h.at&&!fx.fired.has(key)){fx.fired.add(key);if(elapsed-h.at<420){fx.hand.getWorldPosition(TMP);burst(fx,TMP,20,1.15);addRing(fx,a.x,a.z,h.radius||h.range||4,0xff3e18,.5);fx.impact=.28;fx.impactEvent=true;}}}}
 const impacted=fx.impactEvent;fx.impactEvent=false;fx.impact=Math.max(0,fx.impact-dt);updateParticles(fx,dt,skill,!!o.alive);updateRings(fx,dt);fx.tailT=Math.max(0,fx.tailT-dt);return {step:stepped,impact:impacted};
}

export function bossHitReact(o,h={}){const fx=o?.fx;if(!fx)return false;const seq=Number(h.seq)||0,at=Number(h.at)||0,newEpoch=seq&&seq<=fx.lastImpactSeq&&at>fx.lastImpactAt+1000;if(seq&&seq<=fx.lastImpactSeq&&!newEpoch)return false;if(seq){fx.lastImpactSeq=seq;fx.lastImpactAt=at||Date.now();}
 if(h.silent)return false;
 const crit=!!h.crit,counter=!!h.counter,x=Number.isFinite(h.x)?h.x:o.root.position.x,z=Number.isFinite(h.z)?h.z:o.root.position.z,y=o.root.position.y+(o.h||o.b?.h||3)*.55;
 TMP.set(x,y,z);hitBurst(fx,TMP,counter?30:crit?22:12,counter?1.4:crit?1.15:.82,counter?0x77e8ff:crit?0xffd36a:0xff7938);
 const ang=Math.atan2(x-o.root.position.x,z-o.root.position.z)-o.root.rotation.y;fx.hitSide=Math.sin(ang);fx.hitFront=Math.cos(ang);fx.hitDur=counter?.2:crit?.18:.12;fx.hitT=fx.hitDur;fx.hitPower=counter?.09:crit?.065:.038;return true;}
export function bossCounterBurst(o){if(!o.fx)return;o.fx.hand.getWorldPosition(TMP);burst(o.fx,TMP,34,1.45);addRing(o.fx,o.root.position.x,o.root.position.z,4.5,0x68e5ff,.65);}
export function hideBossMotion(o){const fx=o.fx;if(!fx)return;fx.warning.visible=false;fx.glow.intensity=0;fx.trail.material.opacity=0;fx.trailHistory.length=0;fx.pos.fill(-999);fx.life.fill(0);fx.dustPos.fill(-999);fx.dustLife.fill(0);fx.hitPos.fill(-999);fx.hitLife.fill(0);fx.points.geometry.attributes.position.needsUpdate=true;fx.dust.geometry.attributes.position.needsUpdate=true;fx.hitPoints.geometry.attributes.position.needsUpdate=true;fx.hitT=0;fx.tailT=0;const a=o.actions?.[o.motionClip];if(a)a.paused=true;for(const r of fx.rings){fx.scene.remove(r.m);r.m.geometry.dispose();r.m.material.dispose();}fx.rings.length=0;}
export function disposeBossMotion(o){const fx=o.fx;if(!fx)return;for(const x of [fx.warning,fx.points,fx.dust,fx.hitPoints,fx.trail,fx.glow])fx.scene.remove(x);for(const r of fx.rings){fx.scene.remove(r.m);r.m.geometry.dispose();r.m.material.dispose();}for(const x of [fx.warning,fx.points,fx.dust,fx.hitPoints,fx.trail]){x.geometry?.dispose();x.material?.dispose();}o.fx=null;}
