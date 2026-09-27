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
    /* 문서 120: 대기 = 숨(가슴 0.3 Hz)·체중 옮김(골반·반대로 허리 0.2 Hz)·머리 두리번. 다섯째 값 = 주기 배수(없으면 1 Hz). 「근거 없음」 진폭 */
    idle:[['Spine','rotateX',.018,0],['Head','rotateY',.025,1.4],['Spine1','rotateX',.022,0,.3],['Spine2','rotateX',-.012,.6,.3],
          ['Hips','rotateZ',.030,0,.2],['Spine','rotateZ',-.022,0,.2],['Hips','moveX',.018,0,.2]],
    /* 패턴별 회복 자세 — 내려찍기는 깊게 박힌 채, 돌진은 뒤로 버티며 감속, 회전은 반대로 풀리며 멈춤 (문서 120) */
    settleBy:{
      slam:[['Hips','moveY',-.070],['Spine','rotateX',.40],['Spine1','rotateX',.14],['Head','rotateX',-.20],['LeftArm','rotateZ',.14],['RightArm','rotateZ',-.14]],
      charge:[['Hips','moveY',-.035],['Spine','rotateX',-.16],['Spine1','rotateX',-.06],['Head','rotateX',.10]],
      spin:[['Hips','moveY',-.040],['Spine','rotateY',-.30],['Spine1','rotateY',-.12],['Spine','rotateX',.16]]
    },
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
/* 내리침은 짧은 연계(예고 0.32~0.38 s)에서도 80 ms 이상 — 50~60 ms 면 «순간이동» 으로 읽힌다(문서 120 작은 공격 80~160 ms) */
 const H=Math.min(.42,Math.max(.15,.30/T)), S=Math.max(.08/T,Math.min(.16,Math.max(.06,.10/T))), A=.84, D=.04;
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
 /* 피격 위계 (문서 120): 평타 < 마무리(3타) < 스매시 < 카운터(튕김 < 밀침 < 맞부딪침) < 경직 < 파괴.
    [세기, 길이 s]. 방향은 side(맞은 쪽의 반대로 기운다). 공격 상태는 끊지 않는다 — 클립 위에 얹는 덧셈이다. 「근거 없음」 값 */
 const REACT={hit:[.34,.18],finish:[.50,.24],smash:[.64,.30],deflect:[.70,.26],repel:[.80,.34],counter:[.80,.34],clash:[.92,.46],stagger:[1.0,.45],break:[1.15,.55]};
 function react(kind,strength=1,duration,side=1){
 const v=REACT[kind]||REACT.hit;reaction={kind:REACT[kind]?kind:'hit',strength:v[0]*strength,left:duration||v[1],dur:duration||v[1],side:side<0?-1:1};
 if(v[0]>=REACT.deflect[0])stagT=-1;   /* 새 충격(카운터·경직·파괴)은 경직 순서를 처음부터 */
 }
 /* 카운터 세 갈래는 세기만이 아니라 모양이 다르다: 튕김 = 상체가 옆으로 비틀림, 밀침 = 뒤로 젖혀 밀림, 맞부딪침 = 두 팔이 벌어지며 젖혀짐 */
 const SHAPE={deflect:[['Spine1','rotateY',.26,1]],repel:[['Spine','rotateX',.14],['Head','rotateX',.10],['Hips','moveY',-.02]],
   clash:[['Spine','rotateX',.16],['LeftArm','rotateZ',.18],['RightArm','rotateZ',-.18],['Head','rotateX',.10]],
   stagger:[['Spine','rotateX',.16],['Spine1','rotateX',.10],['LeftArm','rotateZ',.20],['RightArm','rotateZ',-.20],['Hips','moveY',-.05],['Head','rotateX',.12]],
   break:[['Spine','rotateX',.20],['Spine1','rotateX',.12],['LeftArm','rotateZ',.26],['RightArm','rotateZ',-.26],['Hips','moveY',-.06],['Head','rotateX',.14]]};
 /* 경직 = 충격 → 균형 잃음 → 발 다시 딛기 → 낮춤 → 회복 (문서 120). 스냅숏에 남은 시간이 없어 들어온 뒤 경과로 그린다. 「근거 없음」 구간 */
 let stagT=-1,prevYaw=null,lead=0;
 function staggerPose(t){
   const ss=u=>{u=clamp(u);return u*u*(3-2*u);};
   const lose=ss((t-.06)/.16)*(1-.55*ss((t-.28)/.14));        // 뒤·옆으로 휘청
   const step=Math.sin(Math.PI*clamp((t-.22)/.18));            // 발 다시 딛기(골반이 옆으로 한 번 옮겨 감)
   const low=ss((t-.34)/.20);                                   // 낮춤 — 무게를 싣고 버틴다
   return {lose,step,low};
 }
 function apply(state,time=0,dt=0){
   const rage=state.rage?1.22:1,tempo=(p.tempo||1)*rage;
   if(state.state==='idle'){
     for(const t of p.idle||[]){const ph=t[3]||0, w=Math.sin(time*tempo*(t[4]||1)*2*Math.PI+ph);op(t,w);}
   }else if(state.state==='recover'){
     /* 공격 뒤 «무릎 → 기립» — 대기로 페이드하지 않고 별도 포즈로 가라앉았다 일어선다 (문서 112 §3-3).
        패턴마다 다른 회복 자세 = 반격 기회가 «무엇 때문에» 열렸는지 몸으로 보인다 (문서 120) */
     const rec=1-clamp(state.recovery/Math.max(.001,state.recoveryDur||1));const k=settleCurve(rec);
     const icon=state.patIcon||state.pattern?.icon;
     for(const t of (p.settleBy&&p.settleBy[icon])||p.settle||[['Spine','rotateX',.16],['Hips','moveY',-.04]])op(t,k);
   }else if(state.state==='telegraph'){
     const icon=state.patIcon||state.pattern?.icon,wind=clamp(state.windup||0);
     /* 중간에 가장 크게 읽히고 접점 직전에는 authored clip에 자리를 돌려준다. */
     const cue=Math.sin(Math.PI*Math.min(1,wind))*rage;
     for(const t of (p.prep&&p.prep[icon])||[])op(t,cue);
   }
   if(state.state==='stagger'){ stagT=stagT<0?0:stagT+dt; const s=staggerPose(stagT), sd=reaction?reaction.side:1;
     op(['Spine','rotateX',.20],s.lose); op(['Spine','rotateZ',.16*sd],s.lose); op(['Head','rotateX',.12],s.lose);
     op(['Hips','moveX',.05*sd],s.step); op(['Hips','rotateZ',-.06*sd],s.step);
     op(['Hips','moveY',-.07],s.low); op(['Spine1','rotateX',.16],s.low); op(['LeftArm','rotateZ',.12],s.low); op(['RightArm','rotateZ',-.12],s.low);
   } else stagT=-1;
   /* 머리·가슴이 먼저 돈다 — 몸통 방향이 바뀌는 속도(°/s)를 머리·가슴이 앞질러 읽힌다(골반은 뒤따라온다). 「근거 없음」 0.10 s 앞섬, 최대 0.35 rad */
   { const par=model.parent||model, yaw=par.rotation?par.rotation.y:0;
     if(prevYaw!=null&&dt>0){ let d=yaw-prevYaw; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI;
       const want=Math.max(-.35,Math.min(.35,d/dt*.10)); lead+=(want-lead)*Math.min(1,dt*10); }
     prevYaw=yaw; if(Math.abs(lead)>1e-3){ op(['Head','rotateY',.55],lead); op(['Spine2','rotateY',.30],lead); op(['Hips','rotateY',-.15],lead); } }
   if(reaction){
     /* 충격 정점은 세기와 상관없이 0.06 s(접점 뒤 4 프레임) — 그다음 세기별 길이만큼 가라앉는다.
        길이에 비례한 사인이면 짧은 반응이 같은 시각에 더 높이 올라 위계가 뒤집혔다 (문서 120) */
     reaction.left=Math.max(0,reaction.left-dt);const el=reaction.dur-reaction.left, RISE=.06,
       pulse=(el<RISE?Math.sin(Math.PI/2*el/RISE):.5+.5*Math.cos(Math.PI*clamp((el-RISE)/Math.max(.01,reaction.dur-RISE))))*reaction.strength;
     for(const t of SHAPE[reaction.kind]||[])op(t[3]?[t[0],t[1],t[2]*reaction.side]:t,pulse);
     const [n,a]=p.recoil||['Spine','rotateZ'];op([n,a,.30*reaction.side],pulse);
     /* 공격 클립은 계속 재생하되 충격 방향의 작은 전신 반동을 항상 얹는다. */
     op(['Spine','rotateX',.10],pulse);
     op(['Hips','moveY',-.060],pulse);
     if(reaction.left<=0)reaction=null;
   }
   model.updateWorldMatrix(true,true);
 }
 return {profile:p,nodes,restore,apply,react,REACT,get reaction(){return reaction;}};
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
