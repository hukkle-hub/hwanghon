import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const FX=require('../js/skill-fx.js');

/* 스킬 연출 사양. 「스킬은 먼지 하나도 보이지 않아」를 고치면서 세운 규칙들을
   못박는다. docs/design/63-skill-vfx.md

   낫의 실제 사거리: 손잡이에서 날 끝까지 1.861 m (docs/design/60-carry.md 실측). */
const SCYTHE = 1.861;

test('궤적 반지름이 무기 사거리를 넘지 않는다 — 5레벨까지', () => {
  for (const name of Object.keys(FX.LOOK)) {
    for (let lv=1; lv<=5; lv++) {
      const r = FX.look(name, lv).r;
      assert.ok(r <= SCYTHE*1.25,
        `${name} Lv${lv} 반지름 ${r.toFixed(2)}m — 낫(${SCYTHE}m)보다 크게 그리면
         «휘두른 자국» 이 아니라 떠 있는 고리로 보인다`);
    }
  }
  /* 음성 대조: 반지름을 양과 같은 비율(17%/레벨)로 키우면 넘어간다.
     처음에 그렇게 했다가 3레벨 회전 베기가 2.48 m 가 됐다. */
  assert.ok(FX.LOOK.skill3.r * FX.grow(5) > SCYTHE*1.25, '음성 대조');
});

test('등급은 크기가 아니라 밀도로 읽힌다', () => {
  const lo=FX.look('skill3',1), hi=FX.look('skill3',5);
  const dr=hi.r/lo.r, dn=hi.embers/lo.embers;
  assert.ok(dn > dr*1.2, `불티 ${dn.toFixed(2)}배 vs 반지름 ${dr.toFixed(2)}배 —
    «양» 이 «크기» 보다 확실히 많이 늘어야 한다`);
});

test('스킬마다 휘두르는 면이 다르다 — 전부 같으면 구분이 안 된다', () => {
  const planes=new Set(Object.values(FX.LOOK).map(v=>v.plane));
  assert.ok(planes.size>=3, '면이 '+planes.size+'종 — 최소 3종(비스듬·수평·내리꽂기)');
  assert.equal(FX.LOOK.skill3.plane,'flat', '피의 회전은 수평으로 쓴다');
  assert.equal(FX.LOOK.ult.plane,'vert',   '궁극기는 내리꽂는다');
});

test('예비는 접점 직전에 붙고 접점에서 끝난다', () => {
  for (const hit of [0.30, 0.42, 0.58, 0.80]) {
    const w=FX.tellWindow(hit);
    assert.ok(w.start>0 && w.start<w.end, '예비가 접점 앞에 있다');
    assert.ok(Math.abs(w.end-hit)<1e-9, '예비는 접점에서 끝난다 — 넘기면 타격을 덮는다');
    assert.ok(w.dur>0.08, `예비 ${w.dur.toFixed(3)}초 — 너무 짧으면 «모으는» 게 안 읽힌다`);
  }
});

test('잔상은 휘두르는 동안만 남는다', () => {
  const w=FX.afterWindow(0.58, 1.32);
  assert.ok(w.start<0.58 && w.end>0.58, '접점을 가운데 두고 걸친다');
  assert.ok(w.end-0.58 <= 0.20+1e-9, '접점 뒤로 0.20초 넘게 끌지 않는다 — 끌면 다음 입력이 지저분해진다');
});
