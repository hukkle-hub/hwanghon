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

test('접점 양쪽 기울기가 요청한 비율로 맞는다', ()=>{
 for(const [clip,hit] of Object.entries(HIT)){
  const want=SB.SEAM_BIAS[clip]||1, [L,Rt]=slopes(clip,hit);
  assert.ok(L>0&&Rt>0, clip+' 기울기가 양수여야 한다');
  /* 걸림(clamp)이 물리면 요청보다 완만해진다 — 그래도 «방향» 은 맞아야 한다 */
  const got=L/Rt;
  if(Math.abs(want-1)<1e-9) assert.ok(Math.abs(got-1)<0.02, `${clip} 맞춤 실패 ${got}`);
  else assert.ok((got-1)*(want-1)>0, `${clip} 기울기 방향이 반대 ${got} vs ${want}`);
 }
});

test('clipHit 을 안 넘기면 예전 곡선 그대로다 — 옛 호출 보호', ()=>{
 for(const clip of Object.keys(HIT))
  for(let i=0;i<=20;i++){ const x=i/20;
   assert.ok(Math.abs(SB.coilEase(x,clip)-Math.pow(x,SB.coilPow(SB.heftOf(clip))))<1e-12);
   assert.ok(Math.abs(SB.throwEase(x,clip)-(1-Math.pow(1-x,SB.throwPow(SB.heftOf(clip)))))<1e-12);
  }
});
