/* 연출 감독 (docs/design/102·103) — 전투 이벤트를 받아 «연출 한 박자» 를 재생한다.
 *
 * 판정·수치는 절대 건드리지 않는다. 이 모듈이 내놓는 것은 «보이는 것» 뿐이다:
 *   slow   시간 배율(판정이 확정된 뒤에만 부른다 — 0.16 초 입력 버퍼 계약은 game3d 의 slowmo 가 지킨다)
 *   cam    카메라 밀착(push: 거리 비율), 화각 변화(fov°), 살짝 돌기(orbit rad), 접점 쪽 주시(look)
 *   light  비상등 순간 꺼짐(dip) · 흰 섬광(flash)
 *   grade  화면 색(desat: 채도 빼기, tint: 색 덧칠)
 *   sound  배경음 잠깐 끊기(duck)
 * 단계(L1 순간 · L2 흐름 · L3 이야기)마다 길이·빈도·조작 뺏김 예산이 있다. L1 은 조작을 뺏지 않는다.
 * 연출 강도 3 단계: cinema(영화) · normal(기본) · minimal(최소 — L1 을 약하게, L2·L3 없음).
 * 값은 모두 「근거 없음」 — 캡처·폰 실기로 맞춘다. 표만 고치면 된다. */

export const MODES={ cinema:{ k:1.25, tiers:['L1','L2','L3'] }, normal:{ k:1, tiers:['L1','L2','L3'] }, minimal:{ k:0.5, tiers:['L1'] }, off:{ k:0, tiers:[] } };   /* off: 연출 감독 끔(전후 비교·접근성) — 예전 고정 연출만 */

/* 박자 표. dur = 연출 길이(초, 벽시계). cam.in/out = 밀착이 차오르고 빠지는 비율(dur 안에서) */
export const BEATS={
  /* 흘림 — 자주 난다. 짧고 작게 */
  deflect:{ tier:'L1', prio:1, dur:0.30, slow:{ scale:0.55, ms:110 },
    cam:{ push:0.08, fov:-1.5, orbit:0, look:0.15, in:0.2, out:0.8 },
    light:{ flash:0.35, color:0xcfe4ff, dip:0 }, grade:null, sound:null },
  /* 튕김 — 받아쳤다는 확신 */
  repel:{ tier:'L1', prio:2, dur:0.42, slow:{ scale:0.40, ms:170 },
    cam:{ push:0.11, fov:-2.5, orbit:0.04, look:0.2, in:0.18, out:0.75 },
    light:{ flash:0.6, color:0xffe6c8, dip:0.35 }, grade:{ desat:0.25, tint:null }, sound:{ duck:0.5, ms:180 } },
  /* 맞대기(완벽) — 가장 긴 멈춤. 두 무기 사이로 붙고, 비상등이 꺼졌다 켜지고, 색이 빠진다 */
  clash:{ tier:'L1', prio:3, dur:0.62, slow:{ scale:0.22, ms:330 },
    cam:{ push:0.17, fov:-4, orbit:0.08, look:0.35, in:0.15, out:0.7 },
    light:{ flash:1, color:0xffffff, dip:0.85 }, grade:{ desat:0.7, tint:null }, sound:{ duck:0.85, ms:300 } },
  /* 완벽 회피 — 푸른 느린 시간(기존 잔상·비네트와 함께) */
  perfectDodge:{ tier:'L1', prio:3, dur:0.80, slow:{ scale:0.18, ms:760 },
    cam:{ push:-0.06, fov:3, orbit:-0.06, look:0, in:0.2, out:0.8 },
    light:{ flash:0, color:0x9fd8ff, dip:0.5 }, grade:{ desat:0.35, tint:[70,130,230,0.16] }, sound:{ duck:0.6, ms:500 } },
  /* 연계 마무리(3타·스매시 적중) — 무게 */
  finisher:{ tier:'L1', prio:2, dur:0.38, slow:{ scale:0.35, ms:140 },
    cam:{ push:0.12, fov:-2.5, orbit:0.04, look:0.3, in:0.15, out:0.8 },
    light:{ flash:0.5, color:0xffd9b0, dip:0.25 }, grade:null, sound:null },
};

/* 예산: 한 판 동안 조작을 뺏긴 시간 비율 상한(L2·L3), L2 최소 간격 */
export const BUDGET={ lostMax:0.08, l2Gap:20, l1Gap:0.12 };

const ease=x=>x<=0?0:x>=1?1:x*x*(3-2*x);

export function createCineDirector(opts={}){
  let mode=MODES[opts.mode]?opts.mode:'normal';
  let clock=0, fightT=0, lostT=0, lastL2=-1e9;
  const last={};             /* id → 마지막 재생 시각 */
  let cur=null;              /* 재생 중 박자 { id, b, t, k, ctx } */
  const log=[];
  const out={ push:0, fov:0, orbit:0, look:0, lookAt:null, flash:0, flashColor:0xffffff, dip:0, desat:0, tint:null, active:null };
  function allowed(id,b){
    const M=MODES[mode]; if(!M.tiers.includes(b.tier)) return 'mode';
    if(clock-(last[id]??-1e9)<BUDGET.l1Gap) return 'gap';
    if(b.tier!=='L1'){ if(clock-lastL2<BUDGET.l2Gap) return 'l2gap'; if(fightT>0&&(lostT+b.dur)/Math.max(fightT,30)>BUDGET.lostMax) return 'budget'; }
    if(cur&&cur.b.prio>b.prio&&cur.t<cur.b.dur*0.6) return 'busy';   /* 센 박자가 도는 중이면 약한 건 생략(끝나 갈 땐 받아 준다) */
    return null; }
  /* 박자 부르기. ctx.at = 접점(THREE.Vector3 등, 카메라가 살짝 바라본다). 재생하면 박자 정의(강도 반영)를, 아니면 null */
  function trigger(id,ctx={}){
    const b=BEATS[id]; if(!b) return null;
    const why=allowed(id,b); log.push({ t:+clock.toFixed(3), id, ok:!why, why:why||undefined }); if(log.length>200) log.shift();
    if(why) return null;
    const k=MODES[mode].k; last[id]=clock; if(b.tier!=='L1'){ lastL2=clock; lostT+=b.dur; }
    cur={ id, b, t:0, k, ctx };
    return { id, tier:b.tier, k,
      slow:b.slow?{ scale:1-(1-b.slow.scale)*Math.min(1,k), ms:Math.round(b.slow.ms*Math.min(1.2,k)) }:null,
      sound:b.sound?{ duck:b.sound.duck*Math.min(1,k), ms:b.sound.ms }:null }; }
  /* 매 프레임(벽시계 dt). fighting = 전투 중인가(예산 분모) */
  function update(dt,fighting){
    clock+=dt; if(fighting) fightT+=dt;
    out.push=out.fov=out.orbit=out.look=out.flash=out.dip=out.desat=0; out.tint=null; out.lookAt=null; out.active=null;
    if(!cur) return out;
    cur.t+=dt; const b=cur.b, x=cur.t/b.dur, k=cur.k;
    if(x>=1){ cur=null; return out; }
    const c=b.cam||{}, env=x<c.in?ease(x/c.in):x>c.out?1-ease((x-c.out)/(1-c.out)):1;   /* 차오름 → 유지 → 빠짐 */
    out.active=cur.id;
    out.push=(c.push||0)*env*k; out.fov=(c.fov||0)*env*k; out.orbit=(c.orbit||0)*env*k*(cur.ctx.side||1); out.look=(c.look||0)*env; out.lookAt=cur.ctx.at||null;
    const L=b.light||{}, fx=Math.max(0,1-x/0.35);                     /* 섬광·꺼짐은 앞쪽 35% 에서 사라진다 */
    out.flash=(L.flash||0)*fx*Math.min(1,k); out.flashColor=L.color||0xffffff; out.dip=(L.dip||0)*(x<0.5?1:1-ease((x-0.5)/0.5))*Math.min(1,k);
    if(b.grade){ out.desat=(b.grade.desat||0)*env*Math.min(1,k); out.tint=b.grade.tint?[...b.grade.tint.slice(0,3),b.grade.tint[3]*env]:null; }
    return out; }
  return { trigger, update, out,
    get mode(){ return mode; }, set mode(m){ if(MODES[m]) mode=m; },
    get lostRatio(){ return fightT>0?lostT/fightT:0; },
    get log(){ return log.slice(); },
    reset(){ cur=null; clock=fightT=lostT=0; lastL2=-1e9; for(const k of Object.keys(last)) delete last[k]; log.length=0; } };
}
