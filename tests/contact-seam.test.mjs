import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/swing-body.js';
const SB=globalThis.TW_SWING_BODY;
/* 접점 이음매(docs/design/72-contact-seam.md). 여기서 지켜야 할 건 셋이다:
   접점의 «값» 이 안 움직일 것(판정 불변), 되돌아가지 않을 것(단조),
   그리고 양쪽 기울기가 요청한 비율대로 맞을 것. */
const HIT={attack1:.38,attack2:.52,attack3:.50,smash:.30,counter:.48,
           skill1:.50,skill2:.50,skill3:.55,skill4:.50,ult:.22,exec:.18};
const slopes=(clip,hit)=>{const e=1e-4;
  return [hit*(SB.coilEase(1,clip,hit)-SB.coilEase(1-e,clip,hit))/e/0.42,
          (1-hit)*(SB.throwEase(e,clip,hit)-SB.throwEase(0,clip,hit))/e/0.58];};

test('이음매 보정이 접점의 값을 옮기지 않는다 — 판정 불변', ()=>{
 for(const [clip,hit] of Object.entries(HIT)){
  assert.ok(Math.abs(SB.coilEase(1,clip,hit)-1)<1e-9, clip+' 감기 끝값');
  assert.ok(Math.abs(SB.throwEase(0,clip,hit))<1e-9, clip+' 내치기 시작값');
  assert.ok(Math.abs(SB.coilEase(0,clip,hit))<1e-9, clip+' 감기 시작값');
  assert.ok(Math.abs(SB.throwEase(1,clip,hit)-1)<1e-9, clip+' 내치기 끝값');
 }
});

test('이음매 보정을 걸어도 시간이 되돌아가지 않는다 — 단조', ()=>{
 for(const [clip,hit] of Object.entries(HIT))
  for(const f of [SB.coilEase,SB.throwEase]){
   let prev=-Infinity;
   for(let i=0;i<=400;i++){ const v=f(i/400,clip,hit);
    assert.ok(v>=prev-1e-12, `${clip} ${f===SB.coilEase?'감기':'내치기'} 역주행 @${i/400}`);
    prev=v; }
  }
});

test('접점 양쪽 기울기 — 중립(SEAM_BIAS) 위에 접점 감속(bite)이 얹힌다', ()=>{
 /* 디렉터: 「맞는 순간 속도는 줄어드는게 맞아」. 직후/직전 = bite / SEAM_BIAS.
    SEAM_BIAS 는 클립 자체의 속도 변화를 상쇄하는 중립점이라 몸 재생 비율만으론
    감속 여부를 말할 수 없다 — 실제 날 감속은 swing-measure 의 cond().bite 로 잰다. */
 for(const [clip,hit] of Object.entries(HIT)){
  const want=SB.biteOf(SB.heftOf(clip))/(SB.SEAM_BIAS[clip]||1), [L,Rt]=slopes(clip,hit);
  assert.ok(L>0&&Rt>0, clip+' 기울기가 양수여야 한다');
  const got=Rt/L;
  /* 걸림(clamp)이 물리면 요청보다 덜 간다 — 그래도 방향은 맞아야 한다 */
  if(Math.abs(got-want)>0.02) assert.ok((got-1)*(want-1)>=0||Math.abs(got-1)<Math.abs(want-1), `${clip} ${got} vs ${want}`);
 }
});

test('세 박자 템포 — 접점 값 불변, 단조, 머묾이 제일 느리고 내려치기가 제일 빠르다', ()=>{
 const s=SB.TEMPO.smash; assert.ok(s, '스매시 템포가 있어야 한다');
 for(const [pre,post] of [[.3,.7],[.45,.55],[.2,.8]]){
  assert.ok(Math.abs(SB.tempoCurve(.42,s,pre,post)-pre)<1e-9, '접점에서 값이 정확히 pre — 판정·접점 자세 불변');
  assert.ok(Math.abs(SB.tempoCurve(0,s,pre,post))<1e-9 && Math.abs(SB.tempoCurve(1,s,pre,post)-(pre+post))<1e-9, '양 끝');
  let prev=-1; for(let i=0;i<=1000;i++){ const v=SB.tempoCurve(i/1000,s,pre,post); assert.ok(v>=prev-1e-12, '역주행 @'+i/1000); prev=v; }
  const avg=(a,b)=>(SB.tempoCurve(b,s,pre,post)-SB.tempoCurve(a,s,pre,post))/(b-a);
  const lift=avg(0,s.lift), hold=avg(s.lift,s.hold), strike=avg(s.hold,.42);
  assert.ok(hold<lift*0.5, `머묾(${hold.toFixed(3)})이 들기(${lift.toFixed(3)})의 절반보다 느려야 한다`);
  assert.ok(strike>lift*1.5, `내려치기(${strike.toFixed(3)})가 들기의 1.5배보다 빨라야 한다`);
  /* 접점 감속: 직후 속도 < 직전 속도 (절대 속도) */
  const e=1e-4, before=avg(.42-e,.42), after=avg(.42,.42+e);
  assert.ok(after<before, `접점 뒤가 앞보다 느려야 한다 (${after.toFixed(3)} vs ${before.toFixed(3)})`);
 }
});

test('몸통 비틀기도 머묾 구간에서 멈춘다 (tempoPhase)', ()=>{
 const s=SB.TEMPO.smash, a=SB.tempoPhase(s.lift,'smash'), b=SB.tempoPhase(s.hold,'smash');
 assert.ok(b-a<0.05, '머묾 동안 몸통 위상이 거의 안 움직여야 한다');
 assert.ok(a<.28&&b>.28, '다 감긴 순간(.28)이 머묾 안에 있어야 한다');
 assert.equal(SB.tempoPhase(.42,'smash'),.42); assert.equal(SB.tempoPhase(.3,'attack1'),.3);
});

test('clipHit 을 안 넘기면 예전 곡선 그대로다 — 옛 호출 보호', ()=>{
 for(const clip of Object.keys(HIT))
  for(let i=0;i<=20;i++){ const x=i/20;
   assert.ok(Math.abs(SB.coilEase(x,clip)-Math.pow(x,SB.coilPow(SB.heftOf(clip))))<1e-12);
   assert.ok(Math.abs(SB.throwEase(x,clip)-(1-Math.pow(1-x,SB.throwPow(SB.heftOf(clip)))))<1e-12);
  }
});
