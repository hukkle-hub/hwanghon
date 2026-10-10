/* Shared, deterministic combat policy. Simulation coordinates are pixels with
   depth compressed by .55; contact points are metres. No renderer dependency. */
(function(root){
  const volumes=typeof module!=='undefined'&&module.exports?require('./boss-contact-volumes.js'):root.TW_BOSS_CONTACT_VOLUMES;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const roles={
    attack1:{name:'가로 베기',reach:1,metres:1.5,cone:1},attack2:{name:'내려 베기',reach:1,metres:1.5,cone:.85},
    attack3:{name:'회수 베기',reach:1,metres:1.5,cone:.85},smash:{name:'파괴 강타',reach:1,metres:1.5,cone:.8},
    skill1:{name:'정밀 걸어 베기',reach:1,metres:1.3,cone:.72},skill3:{name:'넓은 회전 베기',reach:1,metres:1.1,cone:1.5},
    ult:{name:'빈틈에 넣는 결정타',reach:1,metres:1.05,cone:.8},counter:{name:'튕긴 뒤 되베기',reach:1,metres:1.3,cone:1},
    exec:{name:'격추 처형',reach:1.4,metres:1.6,cone:1}
  };
  function role(clip,character){return character==='ain'?(roles[clip]||roles.attack1):roles.attack1;}
  function phase(a){
    const t=clamp(a.elapsed,0,a.duration);
    if(t<=a.hitAt){const u=t/Math.max(.001,a.hitAt),weight=['skill1','skill3','ult','smash'].includes(a.clip)?.10:0;return .42*(u-weight*Math.sin(Math.PI*u)/Math.PI);}
    return .42+.58*(t-a.hitAt)/Math.max(.001,a.duration-a.hitAt);
  }
  // Authoritative broad-phase: part-specific volume, not a hit on the boss
  // centre followed by damage to every remotely selected body part. This is a
  // gameplay capsule, NOT triangle-level collision or a rendered-bone promise.
  function partCenter(boss,part,parts3d){
    const spec=parts3d&&parts3d[part.id],scale=boss.scale||1,off=volumes?.[boss.arena]?.[part.id]||spec?.off||[0,0,0];
    const yaw=Math.PI/2-(boss.aim||0),c=Math.cos(yaw),s=Math.sin(yaw);
    const ox=off[0]*scale,oz=off[2]*scale;
    const cx=boss.x+(ox*c+oz*s)*50,cy=boss.y+(-ox*s+oz*c)*50*.55;
    return {x:cx,y:cy,height:Math.max(.2,(off[1]||1.8)*scale),radius:(spec?.r||.35)*scale*50};
  }
  function contact({player,boss,part,parts3d,action,reach,cone,character,lineOfSight=()=>true}){
    if(!part||!Number.isFinite(player.x)||!Number.isFinite(player.y))return null;
    const center=partCenter(boss,part,parts3d),cx=center.x,cy=center.y;
    const dx=cx-player.x,dz=(cy-player.y)/.55,d=Math.hypot(dx,dz);
    const r=center.radius,profile=role(action?.clip,character);
    // Calibrated from the mounted GLB, not the obsolete 3m centre reach. A
    // narrow-phase capsule can refine this envelope without changing callers.
    const range=character==='ain'?Math.min(reach*profile.reach,profile.metres*50):reach;
    const angle=Math.atan2(dz,dx),delta=Math.abs(Math.atan2(Math.sin(angle-(player.aim||0)),Math.cos(angle-(player.aim||0))));
    // Distance to the selected surface, not an unrelated boss centre. A large
    // boss's tail must remain hittable from behind without entering its torso.
    if(d-r>range||delta>cone*profile.cone+Math.asin(Math.min(1,r/Math.max(r,d)))||!lineOfSight(player.x,player.y,cx,cy))return null;
    const edge=Math.max(0,d-r),f=d?edge/d:0;
    /* reach·range(m) — 스매시 «타점» 이 날의 어느 지점으로 맞았는지 가를 때 쓴다 (js/swing-point.js) */
    return {x:(player.x+dx*f)/50,y:center.height,z:(player.y/.55+dz*f)/50,part:part.id,reach:edge/50,range:range/50};
  }
  /* 접점 위계 — 일반 타격을 크게 만드는 대신 finish/smash/counter 때만 단계가 오른다.
     actual damage/timing과 무관한 presentation 사양. */
  function feedback({kind,perfect,crit,finish,material='straw'}={}){
    const major=kind==='counter',heavy=kind==='smash'||kind==='ult'||kind==='exec';
    const tier=major?'counter':heavy?'smash':finish?'finish':crit?'crit':'light';
    const spec={
      light:  {size:.30,duration:.085,particles:5},
      crit:   {size:.43,duration:.105,particles:8},
      finish: {size:.53,duration:.120,particles:10},
      smash:  {size:.68,duration:.145,particles:14},
      counter:{size:perfect?1.00:.82,duration:.160,particles:perfect?20:16}
    }[tier];
    const color=material==='metal'?0xDCE9F5:material==='core'?0xE88468:0xC8AD7D;
    return {tier,size:spec.size,duration:spec.duration,particles:spec.particles,color};
  }
  /* 재질. 기계 보스의 «장갑·접점·집게» 는 금속이다 — 계전기 접점(contact),
     파쇄 기갑의 턱·팔(jaw/arm), 소생기의 펌프(pump). 눈에 쇠로 보이는 것은
     쇠로 판정해야 튕김(contact-feel.js)이 말이 된다. 식물·짐승은 straw. */
  function material(part,kind){return part==='core'?'core':/shl|shr|armor|chain|gear|plate|exhaust|contact|jaw|arm|pump/.test(part)||kind==='iron'?'metal':'straw';}
  function trailActive(a){if(!a)return false;const hits=a.events?.filter(e=>e.kind==='hit');return (hits?.length?hits:[{t:a.hitAt}]).some(e=>a.elapsed>=e.t*.6&&a.elapsed<=Math.min(a.duration,e.t+.22));}
  function exposed(parts){return parts.some(p=>p.weak&&p.guardedBy?.length&&p.guardedBy.every(id=>parts.some(q=>q.id===id&&q.broken)));}
  const api={roles,role,phase,partCenter,contact,feedback,material,exposed,trailActive};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.TW_COMBAT_QUALITY=api;
})(typeof globalThis!=='undefined'?globalThis:this);
