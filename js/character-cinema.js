/* 황혼 캐릭터 시네마 모션 레이어
   - 전투 판정/이동 거리/클립 시간은 건드리지 않는다.
   - AnimationMixer 결과 위에 작은 자세·관성만 얹어 영화 액션처럼 연결한다.
   - 다음 프레임 mixer 평가 전에 반드시 restore() 한다.
   v01: 아인·카인·류·세라 4캐릭터 전투 정체성 프로필. */
import * as T from '../vendor/three/three.module.js';
import {solveLimb} from './combat-motion.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const sat=v=>clamp(v,0,1);
const smooth=t=>{t=sat(t);return t*t*(3-2*t);};
const expDamp=(a,b,lambda,dt)=>b+(a-b)*Math.exp(-lambda*Math.max(0,dt));
const angleDelta=(a,b)=>{let d=a-b;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d;};

export const CINEMA_STYLE={
  /* 아인 — 선이 먼저 보이고 몸이 그 선을 따라간다. */
  ain:{
    label:'월광 유도형',
    idle:{breath:.018, sway:.020, weight:.018, look:.065},
    move:{leanF:.11, leanSide:.15, hipSide:.055, headStab:.55},
    turn:{lag:.19, lead:.10, max:.22}, dodge:{drop:.075, side:.18, twist:.15}, hit:{light:.15, heavy:.28},
    attack:{attack1:{coil:.08,snap:.08,follow:.10,drop:.025},attack2:{coil:.10,snap:.07,follow:.12,drop:.030},attack3:{coil:.06,snap:.06,follow:.08,drop:.018},
      smash:{coil:.14,snap:.10,follow:.16,drop:.055},skill1:{coil:.11,snap:.08,follow:.13,drop:.028},skill2:{coil:.04,snap:.03,follow:.07,drop:.050},
      skill3:{coil:.13,snap:.08,follow:.15,drop:.035},skill4:{coil:.06,snap:.03,follow:.04,drop:.025},ult:{coil:.16,snap:.11,follow:.18,drop:.060},
      counter:{coil:.06,snap:.06,follow:.10,drop:.035},exec:{coil:.16,snap:.12,follow:.18,drop:.070}}
  },
  /* 카인 — 발이 먼저 버티고 골반·등·검이 뒤늦게 따라오는 중량. */
  kain:{
    label:'철괴 압축형',
    idle:{breath:.011,sway:.009,weight:.014,look:.022},
    move:{leanF:.075,leanSide:.070,hipSide:.025,headStab:.34},
    turn:{lag:.27,lead:.035,max:.18}, dodge:{drop:.105,side:.085,twist:.055}, hit:{light:.105,heavy:.205},
    attack:{attack1:{coil:.15,snap:.105,follow:.18,drop:.060},attack2:{coil:.17,snap:.11,follow:.20,drop:.065},attack3:{coil:.15,snap:.105,follow:.19,drop:.055},
      smash:{coil:.22,snap:.145,follow:.24,drop:.095},skill1:{coil:.19,snap:.13,follow:.22,drop:.080},skill2:{coil:.045,snap:.025,follow:.035,drop:.045},
      skill3:{coil:.18,snap:.115,follow:.23,drop:.075},skill4:{coil:.20,snap:.14,follow:.20,drop:.095},ult:{coil:.24,snap:.16,follow:.26,drop:.110},
      counter:{coil:.12,snap:.105,follow:.16,drop:.070},exec:{coil:.25,snap:.17,follow:.27,drop:.120}}
  },
  /* 류 — 중심은 낮고 발이 먼저 튀어나간다. 상체 여운은 짧아 다음 접점으로 바로 잇는다. */
  ryu:{
    label:'연속 탄성형',
    idle:{breath:.016,sway:.025,weight:.010,look:.085},
    move:{leanF:.145,leanSide:.205,hipSide:.070,headStab:.62},
    turn:{lag:.105,lead:.16,max:.25}, dodge:{drop:.065,side:.235,twist:.20}, hit:{light:.17,heavy:.265},
    attack:{attack1:{coil:.045,snap:.085,follow:.050,drop:.020},attack2:{coil:.050,snap:.090,follow:.055,drop:.022},attack3:{coil:.055,snap:.095,follow:.060,drop:.025},
      smash:{coil:.075,snap:.105,follow:.080,drop:.035},skill1:{coil:.035,snap:.095,follow:.045,drop:.020},skill2:{coil:.020,snap:.035,follow:.030,drop:.055},
      skill3:{coil:.050,snap:.100,follow:.065,drop:.025},skill4:{coil:.030,snap:.040,follow:.030,drop:.018},ult:{coil:.060,snap:.120,follow:.075,drop:.035},
      counter:{coil:.035,snap:.095,follow:.050,drop:.025},exec:{coil:.070,snap:.120,follow:.080,drop:.045}}
  },
  /* 세라 — 몸동작은 작고 정확하다. 머리·가슴은 안정되고 장치 발동만 선명하게. */
  sera:{
    label:'정밀 제어형',
    idle:{breath:.012,sway:.008,weight:.009,look:.040},
    move:{leanF:.060,leanSide:.090,hipSide:.032,headStab:.78},
    turn:{lag:.14,lead:.12,max:.15}, dodge:{drop:.050,side:.145,twist:.115}, hit:{light:.135,heavy:.225},
    attack:{attack1:{coil:.040,snap:.060,follow:.050,drop:.015},attack2:{coil:.045,snap:.060,follow:.055,drop:.015},attack3:{coil:.055,snap:.070,follow:.060,drop:.018},
      smash:{coil:.060,snap:.075,follow:.075,drop:.025},skill1:{coil:.055,snap:.070,follow:.065,drop:.018},skill2:{coil:.025,snap:.035,follow:.035,drop:.045},
      skill3:{coil:.065,snap:.075,follow:.080,drop:.020},skill4:{coil:.030,snap:.025,follow:.025,drop:.015},ult:{coil:.085,snap:.090,follow:.105,drop:.030},
      counter:{coil:.035,snap:.060,follow:.050,drop:.020},exec:{coil:.080,snap:.090,follow:.095,drop:.035}}
  }
};

export function transitionFor(cid,name){
  const base={ain:{fast:.045,hit:.025,atk:.065,fin:.10,out:.17,finOut:.22,base:.22},
              kain:{fast:.065,hit:.035,atk:.085,fin:.12,out:.20,finOut:.26,base:.24},
              ryu:{fast:.035,hit:.020,atk:.045,fin:.065,out:.11,finOut:.15,base:.15},
              sera:{fast:.050,hit:.030,atk:.060,fin:.080,out:.15,finOut:.19,base:.19}}[cid]||{fast:.05,hit:.03,atk:.06,fin:.08,out:.15,finOut:.20,base:.18};
  if(/^dodge|roll|skill2$/.test(name))return {in:base.fast,out:Math.min(base.out,.13),base:base.base};
  if(/^hit/.test(name))return {in:base.hit,out:Math.min(base.out,.12),base:base.base};
  if(/^(smash|ult|exec)$/.test(name))return {in:base.fin,out:base.finOut,base:base.base};
  if(/^(attack|skill|counter)/.test(name))return {in:base.atk,out:base.out,base:base.base};
  return {in:Math.min(.09,base.atk+.02),out:base.out,base:base.base};
}

export function createCharacterCinema(model,root,cid='ain'){
  const profile=CINEMA_STYLE[cid];
  if(!profile)return {restore(){},apply(){},diagnostics:{}};
  const bones={}; model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
  const saved=new Map(); const savedPos=new Map(); let hipsMoved=false;
  const s={t:0,prevYaw:root.rotation.y,turn:0,moveX:0,moveZ:0,spd:0};
  const diagnostics={turnLag:0,lean:0,mode:'idle'};
  function keepQ(n){const b=bones[n];if(b&&!saved.has(b))saved.set(b,b.quaternion.clone());return b;}
  function keepP(n){const b=bones[n];if(b&&!savedPos.has(b))savedPos.set(b,b.position.clone());return b;}
  function rx(n,v){const b=keepQ(n);if(b&&v){b.rotateX(v);if(n==='Hips')hipsMoved=true;}}
  function ry(n,v){const b=keepQ(n);if(b&&v){b.rotateY(v);if(n==='Hips')hipsMoved=true;}}
  function rz(n,v){const b=keepQ(n);if(b&&v){b.rotateZ(v);if(n==='Hips')hipsMoved=true;}}
  /* 골반을 옮기면 다리 IK 가 없어 발까지 같이 꺼진다(카인 백스텝에서 12 cm). 끝에서 발을 원래 자리로 되돌리고 무릎을 굽힌다. */
  function py(n,v){const b=keepP(n);if(b&&v){b.position.y+=v;if(n==='Hips')hipsMoved=true;}}
  function px(n,v){const b=keepP(n);if(b&&v){b.position.x+=v;if(n==='Hips')hipsMoved=true;}}
  const feet0={L:new T.Vector3(),R:new T.Vector3()};
  function replant(){
    if(!hipsMoved)return;model.updateWorldMatrix(true,true);
    for(const [k,side] of [['L','Left'],['R','Right']]){const up=keepQ(side+'UpLeg'),lo=keepQ(side+'Leg'),ft=bones[side+'Foot'];if(up&&lo&&ft)for(let i=0;i<8&&solveLimb(up,lo,ft,feet0[k],1)>.004;i++);;}
  }
  function restore(){
    for(const [b,q] of saved)b.quaternion.copy(q);saved.clear();
    for(const [b,p] of savedPos)b.position.copy(p);savedPos.clear();
  }
  function attackShape(a){
    if(!a)return null; const clip=a.clip||a.name||''; const cfg=profile.attack[clip]; if(!cfg)return null;
    const u=sat((a.elapsed||0)/Math.max(.001,a.duration||1));
    // 0-.24 준비, .24-.46 가속/접점, 이후 여운. 접점 판정 시간 자체는 바꾸지 않는다.
    const pre=u<.24?smooth(u/.24):u<.46?1-smooth((u-.24)/.22):0;
    const strike=u<.24?0:u<.46?smooth((u-.24)/.22):u<.70?1-smooth((u-.46)/.24):0;
    const follow=u<.42?0:u<.82?Math.sin((u-.42)/.40*Math.PI):0;
    const side=/attack2|skill3|counter/.test(clip)?-1:1;
    return {clip,u,cfg,pre,strike,follow,side};
  }
  function apply(ctx={}){
    const dt=Math.max(0,ctx.dt||0); s.t+=dt;
    const yaw=root.rotation.y, rawTurn=dt>0?angleDelta(yaw,s.prevYaw)/dt:0; s.prevYaw=yaw;
    s.turn=expDamp(s.turn,clamp(rawTurn,-3.5,3.5),10,dt);
    s.spd=expDamp(s.spd,sat(ctx.speed||0),10,dt);
    s.moveX=expDamp(s.moveX,clamp(ctx.localX||0,-1,1),12,dt);
    s.moveZ=expDamp(s.moveZ,clamp(ctx.localZ||0,-1,1),12,dt);

    hipsMoved=false;model.updateWorldMatrix(true,true);
    if(bones.LeftFoot)bones.LeftFoot.getWorldPosition(feet0.L);if(bones.RightFoot)bones.RightFoot.getWorldPosition(feet0.R);
    const clip=ctx.clip||''; const moving=!!ctx.moving; const action=ctx.action||null;
    const isDodge=/^dodge|roll|skill2$/.test(clip); const isHit=/^hit/.test(clip);
    diagnostics.mode=action?'attack':isDodge?'dodge':isHit?'hit':moving?'move':'idle';

    // 1) 대기: 가슴의 호흡보다 골반/쇄골의 아주 작은 비대칭으로 '살아 있는 정적'.
    if(!moving&&!action&&!isDodge&&!isHit&&!ctx.guard){
      const p=profile.idle, b=Math.sin(s.t*Math.PI*.86), sw=Math.sin(s.t*Math.PI*.43+.6);
      py('Hips',-p.weight*(.5+.5*Math.sin(s.t*.71)));
      ry('Hips',sw*p.sway*.38); ry('Spine',-sw*p.sway*.58); ry('Spine2',sw*p.sway*.35);
      rx('Spine1',-b*p.breath); rx('Spine2',b*p.breath*.72);
      rz('LeftShoulder',-b*.012); rz('RightShoulder',b*.009);
      // 5~7초에 한 번 멀리 보는 듯한 작은 목 움직임. 루프가 기계적으로 보이지 않게 위상 비대칭.
      const look=Math.sin(s.t*.91)*Math.sin(s.t*.37)*p.look;
      ry('Neck',look); ry('Head',look*.45); rz('Head',Math.sin(s.t*.53)*.012);
    }

    // 2) 보행/달리기/스트레이프: 진행 방향으로 몸통이 먼저 기울고 머리는 절반만 따라간다.
    if(moving&&!action&&!isDodge){
      const p=profile.move, sp=s.spd;
      const side=s.moveX*p.leanSide*sp, forward=s.moveZ*p.leanF*sp;
      rz('Hips',-side*.28); rz('Spine',side*.54); rz('Spine2',side*.42);
      rx('Hips',forward*.18); rx('Spine',-forward*.42); rx('Spine2',-forward*.34);
      px('Hips',-s.moveX*p.hipSide*sp);
      // 무협식 상체 안정: 머리가 몸의 기울기를 전부 따라가지 않게 반대 방향으로 보정.
      rz('Neck',-side*p.headStab*.42); rz('Head',-side*p.headStab*.38);
      rx('Neck',forward*p.headStab*.22); rx('Head',forward*p.headStab*.18);
      diagnostics.lean=Math.hypot(side,forward);
    } else diagnostics.lean=0;

    // 3) 회전: 발/골반이 먼저 방향을 바꾸고 흉곽·머리는 한 박자 늦게 풀린다.
    const tr=clamp(s.turn*profile.turn.lag,-profile.turn.max,profile.turn.max);
    if(Math.abs(tr)>.002&&!action){
      ry('Hips',-tr*.22); ry('Spine',-tr*.44); ry('Spine2',-tr*.34);
      ry('Neck',tr*profile.turn.lead); ry('Head',tr*profile.turn.lead*.82);
    }
    diagnostics.turnLag=tr;

    // 4) 회피: 구르기 대신 칼날을 비켜 흘리듯 중심을 낮추고 측면으로 접는다.
    if(isDodge){
      const p=profile.dodge, u=sat(ctx.clipTime||0), bell=Math.sin(Math.PI*u);
      py('Hips',-p.drop*bell);
      const dir=/L$/.test(clip)?-1:/R$/.test(clip)?1:0;
      rz('Hips',dir*p.side*bell*.35); rz('Spine',-dir*p.side*bell*.48); rz('Spine2',-dir*p.side*bell*.32);
      ry('Spine',dir*p.twist*bell); ry('Head',-dir*p.twist*bell*.32);
    }

    // 5) 피격: 한 프레임 튕기는 게 아니라 몸의 중심 → 가슴 → 머리 순서로 충격을 넘긴다.
    if(isHit){
      const heavy=clip==='hit2', amp=heavy?profile.hit.heavy:profile.hit.light, u=sat(ctx.clipTime||0);
      const kick=Math.sin(Math.PI*sat(u/0.48))*amp, settle=u>.38?Math.sin((u-.38)/.62*Math.PI)*amp*.28:0;
      rx('Hips',kick*.18); rx('Spine',kick*.50-settle*.10); rx('Spine2',kick*.42-settle*.22); rx('Neck',-kick*.24); rx('Head',-kick*.18);
      ry('Spine2',(heavy?1:-1)*kick*.16);
    }

    // 6) 공격: 기존 손/낫 궤적은 그대로 두고, 중심 압축·시선 선행·여운만 더한다.
    //    손뼈를 직접 만지지 않아 두손 그립 IK / 접점 보정과 충돌하지 않는다.
    const sh=attackShape(action);
    if(sh){
      const {cfg,pre,strike,follow,side}=sh;
      py('Hips',-cfg.drop*(pre*.75+strike*.35));
      ry('Hips',-side*cfg.coil*pre*.30 + side*cfg.follow*follow*.12);
      ry('Spine',side*cfg.coil*pre*.58 - side*cfg.snap*strike*.20 - side*cfg.follow*follow*.20);
      ry('Spine2',side*cfg.coil*pre*.38 + side*cfg.snap*strike*.30 + side*cfg.follow*follow*.28);
      rz('Spine2',-side*(cfg.snap*strike*.30+cfg.follow*follow*.18));
      // 눈/머리가 날보다 아주 조금 먼저 다음 선을 본다. 과하면 목 꺾임이므로 작게.
      ry('Neck',-side*cfg.coil*pre*.18 + side*cfg.snap*strike*.16);
      ry('Head',-side*cfg.coil*pre*.14 + side*cfg.snap*strike*.12);
    }

    // 가드: 정면에서 버티되 완전 대칭을 피한다.
    if(ctx.guard&&!action){
      py('Hips',-.022); rx('Hips',-.025); ry('Spine',-.035); rz('Spine2',.025); ry('Head',.018);
    }
    replant();
    model.updateWorldMatrix(true,true);
  }
  return {restore,apply,diagnostics,bones};
}
