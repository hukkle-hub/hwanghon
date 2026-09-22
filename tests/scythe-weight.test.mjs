import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import vm from 'node:vm';
const require=createRequire(import.meta.url);
const SB=require('../js/swing-body.js');
const ctx={window:{}};
for(const f of ['world','dungeons']) vm.runInNewContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx,{filename:f});
const M=ctx.window.TW_DUNGEONS.RULES.motion;

/* 「그 길고 무거운 걸 휘두르는데 무게감도 없고」의 원인과 수치를 못박는다.
   계측 도구: tools/3d/swing-measure.html · 조사·수치: docs/design/66-scythe-weight.md */

test('판정은 클립에서 «날이 제일 빠른» 곳에 있다 — 멈춘 뒤에 맞으면 안 된다', () => {
  /* 파이프라인 그대로 후보값을 훑어 고른 값들(66번 문서 §3-1).
     고치기 전 smash 는 접점 구간 날끝이 2.1 m/s 였다 — 무기가 이미 멈춰 있었다.
     이 값을 바꾸려면 swing-measure.html 의 solve 를 다시 돌려라. */
  const want={ smash:0.30, exec:0.18, attack2:0.52, attack1:0.38, ult:0.22 };
  for(const [clip,v] of Object.entries(want))
    assert.equal(M.clipContacts[clip], v, `${clip} 판정 프레임`);
  /* punch.py 의 사본과 어긋나면 안 된다 (tests/punch.test.mjs 가 따로 본다) */
  const py=fs.readFileSync('tools/3d/punch.py','utf8');
  for(const [clip,v] of Object.entries(want))
    assert.ok(new RegExp(`'${clip}':\\s*${v}`).test(py), `punch.py 에도 ${clip} ${v}`);
});

test('무게 곡선: 감기는 굼뜨게 시작하고 따라감은 접점 직후가 제일 빠르다', () => {
  for(const clip of ['attack1','smash','ult']){
    assert.equal(SB.coilEase(0,clip), 0);
    assert.ok(Math.abs(SB.coilEase(1,clip)-1)<1e-9, clip+' 감기는 접점에서 딱 끝난다');
    assert.equal(SB.throwEase(0,clip), 0);
    assert.ok(Math.abs(SB.throwEase(1,clip)-1)<1e-9);
    /* 단조 — 되감기면 안 된다 */
    let pc=-1, pt=-1;
    for(let i=0;i<=40;i++){
      const c=SB.coilEase(i/40,clip), t=SB.throwEase(i/40,clip);
      assert.ok(c>=pc-1e-9 && t>=pt-1e-9, clip+' 단조');
      pc=c; pt=t;
    }
    /* 감기: 전반이 굼뜨다 (선형이면 0.5) */
    assert.ok(SB.coilEase(0.5,clip) < 0.42, `${clip} 감기 중간 ${SB.coilEase(0.5,clip).toFixed(3)}`);
    /* 따라감: 전반에 이미 절반 넘게 간다 */
    assert.ok(SB.throwEase(0.5,clip) > 0.58, `${clip} 따라감 중간 ${SB.throwEase(0.5,clip).toFixed(3)}`);
  }
});

test('무거운 기술일수록 더 굼뜨게 감고 더 길게 밀고 나간다', () => {
  const light=SB.coilEase(0.5,'counter'), heavy=SB.coilEase(0.5,'ult');
  assert.ok(heavy < light, `궁극기 ${heavy.toFixed(3)} < 카운터 ${light.toFixed(3)}`);
  assert.ok(SB.heftOf('smash') > SB.heftOf('attack1'));
  assert.ok(SB.heftOf('counter') < SB.heftOf('attack1'));
});

test('몸통이 휘두름을 구동한다 — 다만 리그가 버티는 데까지만', () => {
  /* 업계 기준: 두 손 무기는 몸통 회전이 휘두름을 «구동» 한다.
     17°(0.30) 는 어깨만 도는 수준이라 30°(0.52) 로 올렸다. */
  assert.ok(SB.YAW >= 0.50, `몸통 비틀기 ${(SB.YAW*57.3).toFixed(0)}° — 두 손 무기에는 최소 29°`);
  /* ⚠ 위쪽 한계는 계측값이다. 0.58 에서 tests/ain-two-hand 의 손목 검사가 깨진다
     (두 손 그립 IK 팔꿈치 특이점, 64번 문서 §3). 더 올리려면 IK 를 먼저 고쳐라. */
  assert.ok(SB.YAW <= 0.54, `${SB.YAW} — 0.54 를 넘으면 두 손 그립이 깨진다`);
  /* 무게 배수까지 곱하면 큰 기술은 40° 넘게 쓴다 */
  const smash=SB.YAW*SB.weightOf('smash',0)*57.3;
  assert.ok(smash > 40, `스매시 몸통 ${smash.toFixed(0)}°`);
});

test('스매시는 클립을 통째로 틀지 않는다 — 2.5배속이면 «휘리릭» 지나간다', () => {
  assert.equal(M.clipSpan.smash, 0.45,
    '클립 2.42초 × 0.45 = 1.09초 ≈ 행동 0.96초. 거의 1:1 속도여야 한 동작이 또렷하다');
  /* ult 은 클립이 0.71초뿐이라 자르면 5배 느려진다 — 건드리지 않는다 */
  assert.equal(M.clipSpan.ult, undefined);
});
