// 황혼 — 보스 모션 가독성 · 전투 성격 레이어
// simulation owns damage/movement. This module only layers readable pose cues over authored clips.
const prepared=new WeakMap();
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));

/*
  보스별 전투 언어.
  - idle: 공격하지 않을 때도 "살아 있는 것"처럼 보이는 작은 2차 운동
  - prep: 같은 telegraph라도 보스/공격마다 준비 실루엣을 다르게 보강
  - recoil: 카운터/부위파괴 때 어떤 축으로 무너지는지
  값은 authored clip 위에 더하는 작은 보정이라 판정 시계·히트박스는 바꾸지 않는다.
*/
export const BOSS_PROFILES={
  tutorial:{
    name:'훈련 허수아비',tempo:1,
    idle:[['Spine','rotateX',.018,0],['Head','rotateY',.025,1.4]],
    prep:{
      hammer:[['Spine','rotateX',-.08],['LeftArm','rotateZ',.18],['RightArm','rotateZ',-.18]],
      bolt:[['Spine1','rotateY',-.13],['RightArm','rotateX',-.16]],
      scythe:[['Spine','rotateY',.18],['LeftArm','rotateZ',.12]]
    },recoil:['Spine','rotateZ'],
    /* 회복 = 별도 포즈(문서 112 §3-3). 렐라나는 공격 뒤 «무릎 → 기립» 이 따로 있다.
       다리 IK 가 없어 엉덩이는 조금만 내리고(발이 바닥을 뚫지 않게) 상체 숙임으로 무게를 보인다. */
    settle:[['Hips','moveY',-.045],['Spine','rotateX',.30],['Spine1','rotateX',.10],['Head','rotateX',-.16],['LeftArm','rotateZ',.10],['RightArm','rotateZ',-.10]]
  },
  marsh:{
    name:'모르버스',tempo:1.08,
    idle:[['Spine','rotateX',.035,0],['Head','rotateY',.055,1.1],['Tail1','rotateY',.09,2.0],['Tail2','rotateY',.055,2.7]],
    prep:{
      bolt:[['Hips','rotateX',-.10],['Spine','rotateX',-.12],['Head','rotateX',-.10]],
      boltB:[['Spine2','rotateY',-.16],['Head','rotateY',.12]],
      hammer:[['Spine','rotateX',-.16],['Spine2','rotateX',-.12],['Head','rotateX',-.08]],
      scythe:[['Hips','rotateY',.18],['Tail1','rotateY',-.30],['Tail2','rotateY',-.22],['Spine','rotateY',.10]],
      flame:[['Spine2','rotateX',-.10],['Head','rotateX',-.16],['Jaw','rotateX',.18]],
      drop:[['Hips','rotateY',.20],['Spine','rotateY',.22],['Head','rotateX',-.12],['Tail1','rotateY',-.22]],
      dropB:[['Hips','rotateY',-.18],['Spine1','rotateY',-.20]],
      dropC:[['Spine','rotateX',-.16],['Head','rotateX',-.12]]
    },recoil:['Spine2','rotateZ'],
    settle:[['Hips','moveY',-.06],['Spine','rotateX',.14],['Head','rotateX',.12],['Tail1','rotateY',.10]]
  },
  sewage:{
    name:'오염 수문기',tempo:.82,
    idle:[['Spine','rotateY',.018,0],['Core','scaleY',.035,.7],['Head','rotateZ',.018,2.1]],
    prep:{
      hammer:[['Spine','rotateX',-.12],['Intake','rotateX',-.24]],
      hammerB:[['Spine','rotateX',.10],['Intake','rotateX',.20]],
      bolt:[['Exhaust','rotateY',-.20],['Spine','rotateY',.08]],
      scythe:[['Exhaust','rotateZ',-.24],['Hips','rotateY',.10]],
      flame:[['Core','scaleX',.18],['Core','scaleY',.18],['Core','scaleZ',.18],['Spine','moveY',.06]]
    },recoil:['Spine','rotateZ'],
    settle:[['Spine','rotateX',.10],['Core','scaleY',-.10],['Intake','rotateX',.16]]
  },
  relay:{
    name:'과부하 계전기',tempo:1.18,
    idle:[['Core','scaleX',.045,0],['Core','scaleZ',.045,0],['Head','rotateY',.025,2.0],['Spine','rotateZ',.012,.8]],
    prep:{
      hammer:[['ContactR','rotateX',-.22],['Spine','rotateX',-.08]],
      hammerL:[['ContactL','rotateX',-.22],['Spine','rotateX',-.08]],
      hammerC:[['ContactL','rotateX',-.14],['ContactR','rotateX',-.14],['Spine','rotateX',-.12]],
      bolt:[['ContactL','rotateY',.18],['ContactR','rotateY',-.18],['Core','scaleX',.16],['Core','scaleZ',.16]],
      scythe:[['Hips','rotateY',.14],['ContactL','rotateZ',.18],['ContactR','rotateZ',-.18]],
      flame:[['Core','scaleX',.24],['Core','scaleY',.20],['Core','scaleZ',.24],['Head','rotateX',-.10]]
    },recoil:['Spine','rotateZ'],
    settle:[['Spine','rotateX',.10],['Core','scaleY',-.12],['ContactL','rotateX',.18],['ContactR','rotateX',.18]]
  },
  grove:{
    name:'모근체',tempo:.72,
    idle:[['Spine','rotateZ',.035,0],['Head','rotateY',.045,1.3],['VineL','rotateZ',.08,2.0],['VineR','rotateZ',-.08,2.0],['Core','scaleY',.035,.5]],
    prep:{
      scythe:[['VineL','rotateX',-.28],['Spine','rotateY',.10]],
      scytheB:[['VineR','rotateX',-.28],['Spine','rotateY',-.10]],
      hammer:[['Spine','rotateX',-.15],['Head','rotateX',-.20],['VineL','rotateX',-.10],['VineR','rotateX',-.10]],
      bolt:[['Hips','rotateY',.12],['VineL','rotateZ',.24],['VineR','rotateZ',-.24]],
      flame:[['Core','scaleX',.20],['Core','scaleY',.24],['Core','scaleZ',.20],['Head','rotateX',-.12]]
    },recoil:['Spine','rotateZ'],
    settle:[['Spine','rotateX',.12],['Core','scaleY',-.10],['VineL','rotateX',.14],['VineR','rotateX',.14]]
  },
  road:{
    name:'파쇄 기갑',tempo:.92,
    idle:[['Spine','rotateZ',.018,0],['Head','rotateX',.025,1.7],['JawR','rotateZ',.035,.9],['Core','scaleY',.035,.2]],
    prep:{
      hammer:[['JawR','rotateY',-.25],['Spine','rotateY',.12]],
      hammerB:[['ArmL','rotateY',-.25],['Spine','rotateY',-.12]],
      bolt:[['Hips','rotateX',-.11],['Spine','rotateX',-.16],['JawR','rotateX',.15],['ArmL','rotateX',.12]],
      scythe:[['ArmL','rotateX',-.30],['Spine','rotateX',-.10]],
      flame:[['Core','scaleX',.20],['Core','scaleZ',.20],['Spine','moveY',.05]]
    },recoil:['Spine','rotateZ'],
    settle:[['Spine','rotateX',.14],['JawR','rotateX',.16],['ArmL','rotateX',.16],['Core','scaleY',-.08]]
  },
  ward:{
    name:'소생기',tempo:1.00,
    idle:[['Spine','scaleY',.025,0],['Core','scaleX',.06,.0],['Core','scaleY',.06,.0],['Head','rotateZ',.02,2.2],['PumpL','rotateZ',.025,1.0],['ArmR','rotateZ',-.025,1.0]],
    prep:{
      scythe:[['PumpL','rotateY',-.24],['Spine','rotateY',-.08]],
      scytheB:[['PumpL','rotateY',.22],['Spine','rotateY',.08]],
      bolt:[['ArmR','rotateZ',-.26],['Spine','rotateY',.12]],
      hammer:[['Spine','rotateX',-.16],['PumpL','rotateX',-.16],['ArmR','rotateX',-.16],['Head','rotateX',-.10]],
      flame:[['Core','scaleX',.22],['Core','scaleY',.22],['Core','scaleZ',.22],['Head','rotateX',-.12]]
    },recoil:['Spine','rotateZ'],
    settle:[['Spine','rotateX',.12],['PumpL','rotateX',.14],['ArmR','rotateX',.14],['Core','scaleY',-.08]]
  }
};

/* 회복 포즈 곡선 — 접점 직후 «툭» 가라앉고(0→.18) 천천히 일어선다(.35→1).
   렐라나: 점프 찍기 뒤 무릎 착지 0.9 s, 대검 뒤 0.7 s (문서 112 §1). */
export function settleCurve(rec){
 const r=clamp(rec), drop=r<.18?Math.sin(r/.18*Math.PI/2):1, rise=r<.35?0:Math.min(1,(r-.35)/.65);
 return drop*(1-rise*rise);
}

/* 예비 «홀드 프레임» — 렐라나식: 무기를 극단 위치로 «빨리» 가져가 멈춘 채 0.3 s 를 보이고,
   마지막 0.1 s 에 접점까지 꽂는다(문서 112 §3-1). 판정 시계(tele)는 그대로 — 클립 표본 위치만 다시 깎는다.
   p = 판정 진행률(0→1). 반환 = 접점 대비 클립 진행률(0→1). 양끝(0,1)은 그대로라 접점 프레임이 안 움직인다. */
export function tellCurve(p, teleDur){
 p=clamp(p); const T=Math.max(.15,teleDur||1);
 const H=Math.min(.42,Math.max(.15,.30/T)), S=Math.min(.16,Math.max(.06,.10/T)), A=.84, D=.04;
 const r0=1-H-S, r1=1-S;
 if(p<=r0){ const u=p/Math.max(1e-6,r0); return A*(u*u*(3-2*u)); }
 if(p<=r1){ return A+D*((p-r0)/Math.max(1e-6,H)); }
 return A+D+(1-A-D)*((p-r1)/Math.max(1e-6,S));
}

export function bossProfile(id){return BOSS_PROFILES[id]||BOSS_PROFILES.tutorial;}

/* Additive, bounded silhouette cues for the tutorial humanoid.
   Kept for backward compatibility; general bosses use createBossBehavior below. */
export function createBossReadability(model){
 const bones={},saved=new Map();model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
 function restore(){for(const [b,q]of saved)b.quaternion.copy(q);saved.clear();}
 function rotate(name,axis,value){const b=bones[name];if(!b||!value)return;if(!saved.has(b))saved.set(b,b.quaternion.clone());b[axis](value);}
 function apply(state){
  const windup=clamp(state.windup||0),cue=state.state==='telegraph'?Math.sin(Math.PI*Math.min(1,windup/.85)):0;
  const icon=state.patIcon||state.pattern?.icon;
  if(icon==='hammer'){rotate('Spine','rotateX',-.10*cue);rotate('LeftArm','rotateZ',.22*cue);rotate('RightArm','rotateZ',-.22*cue);}
  else if(icon==='bolt'){rotate('Spine1','rotateY',-.16*cue);rotate('RightArm','rotateX',-.20*cue);}
  else if(icon==='scythe'){rotate('Spine','rotateY',.22*cue);rotate('LeftArm','rotateZ',.14*cue);}
  const rest=['idle','stagger','recover'].includes(state.state)?1:state.state==='telegraph'?1-Math.min(1,windup*3):0;
  for(const p of state.parts||[])if(p.broken){if(p.id==='shl')rotate('LeftArm','rotateZ',-.28*rest);if(p.id==='shr')rotate('RightArm','rotateZ',.28*rest);}
  model.updateWorldMatrix(true,true);
 }
 return {restore,apply};
}

/* General boss personality layer.
   Works for both skinned GLB bones and procedural Group rigs because it indexes every named Object3D. */
export function createBossBehavior(model,arenaId){
 const p=bossProfile(arenaId),nodes={},saved=new Map();
 let reaction=null;
 model.traverse(o=>{const n=(o.name||'').replace(/^mixamorig:?/,'');if(n&&!nodes[n])nodes[n]=o;});
 function save(o){if(!saved.has(o))saved.set(o,{q:o.quaternion.clone(),p:o.position.clone(),s:o.scale.clone()});}
 function restore(){for(const [o,v]of saved){o.quaternion.copy(v.q);o.position.copy(v.p);o.scale.copy(v.s);}saved.clear();}
 function op(t,amount){
   const [name,kind,amp]=t,o=nodes[name];if(!o||!amp||!amount)return;save(o);const v=amp*amount;
   if(kind==='rotateX')o.rotateX(v);else if(kind==='rotateY')o.rotateY(v);else if(kind==='rotateZ')o.rotateZ(v);
   else if(kind==='moveX')o.position.x+=v;else if(kind==='moveY')o.position.y+=v;else if(kind==='moveZ')o.position.z+=v;
   else if(kind==='scaleX')o.scale.x*=Math.max(.65,1+v);else if(kind==='scaleY')o.scale.y*=Math.max(.65,1+v);else if(kind==='scaleZ')o.scale.z*=Math.max(.65,1+v);
 }
 function react(kind,strength=1,duration,side=1){
 const map={deflect:[.38,.22],repel:[.68,.34],clash:[1,.50],counter:[.72,.34],break:[1.15,.55],hit:[.42,.20],stagger:[.95,.42]};
 const v=map[kind]||map.hit;reaction={kind,strength:v[0]*strength,left:duration||v[1],dur:duration||v[1],side:side<0?-1:1};
 }
 function apply(state,time=0,dt=0){
   const rage=state.rage?1.22:1,tempo=(p.tempo||1)*rage;
   if(state.state==='idle'){
     for(const t of p.idle||[]){const ph=t[3]||0, w=Math.sin(time*tempo*2*Math.PI+ph);op(t,w);}
   }else if(state.state==='recover'){
     /* 공격 뒤 «무릎 → 기립» — 대기로 페이드하지 않고 별도 포즈로 가라앉았다 일어선다 (문서 112 §3-3). */
     const rec=1-clamp(state.recovery/Math.max(.001,state.recoveryDur||1));const k=settleCurve(rec);
     for(const t of p.settle||[['Spine','rotateX',.16],['Hips','moveY',-.04]])op(t,k);
   }else if(state.state==='telegraph'){
     const icon=state.patIcon||state.pattern?.icon,wind=clamp(state.windup||0);
     /* 중간에 가장 크게 읽히고 접점 직전에는 authored clip에 자리를 돌려준다. */
     const cue=Math.sin(Math.PI*Math.min(1,wind))*rage;
     for(const t of (p.prep&&p.prep[icon])||[])op(t,cue);
   }
   if(reaction){
     reaction.left=Math.max(0,reaction.left-dt);const k=1-reaction.left/reaction.dur, pulse=Math.sin(Math.PI*clamp(k))*reaction.strength;
     const [n,a]=p.recoil||['Spine','rotateZ'];op([n,a,.30*reaction.side],pulse);
     /* 공격 클립은 계속 재생하되 충격 방향의 작은 전신 반동을 항상 얹는다. */
     op(['Spine','rotateX',.10],pulse);
     op(['Hips','moveY',-.060],pulse);
     if(reaction.left<=0)reaction=null;
   }
   model.updateWorldMatrix(true,true);
 }
 return {profile:p,nodes,restore,apply,react,get reaction(){return reaction;}};
}

export function prepareTrainingMotion(asset) {
 if(prepared.has(asset))return prepared.get(asset);
 const animations=asset.animations.map(source=>{
  const clip=source.clone();
  if(!/^atk_/.test(clip.name))return clip;
  for(const track of clip.tracks){
   if(!/(^|mixamorig:?|[.:])Hips\.position$/.test(track.name))continue;
   // glTF Y-up. Keep vertical weight shifts but prevent double horizontal motion.
   for(let i=0;i<track.values.length;i+=3){track.values[i]=track.values[0];track.values[i+2]=track.values[2];}
  }
  return clip;
 });
 const result={...asset,animations};prepared.set(asset,result);return result;
}

export function sampleBossAttack(spec,duration,state) {
 const contact=duration*clamp(spec.hitFrac);
 if(state.state==='telegraph'){
  const progress=Number.isFinite(state.windup)?state.windup:1-state.tele/Math.max(.001,state.teleDur);
  /* hold 비트는 combat 의 windup 곡선이 이미 «들고 버티기» 를 담고 있다 — 그대로. 나머지는 홀드 프레임 곡선. */
  if(state.hold||spec.noHold) return contact*clamp(progress);
  return contact*tellCurve(progress,state.teleDur);
 }
 if(state.state==='recover'){
  const progress=clamp(1-Math.max(0,state.recovery)/Math.max(.001,state.recoveryDur));
  /* 남은 클립을 앞 40 % 에 다 쓰고 끝 자세로 «착지» 한 채 머문다 — 그 위에 settle 포즈가 얹힌다 */
  const eased=1-Math.pow(1-progress,2.4);
  return contact+(duration-contact)*eased;
 }
 return null; // link/interrupt states must not remain paused at the last windup pose
}
