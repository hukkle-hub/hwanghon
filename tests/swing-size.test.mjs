import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const SB=require('../js/swing-body.js');

/* 「어깨 위에서 달랑달랑」— 큰 동작은 팔이 아니라 몸통에서 나온다.
   팔로 키우려다 팔꿈치 해가 한 프레임에 166° 튀는 걸 확인하고 몸통으로 옮겼다.
   docs/design/64-swing-size.md */

test('몸통은 접점에서 정면이다 — 비틀린 채로 때리면 낫이 목표를 빗나간다', () => {
  for (const clip of ['attack1','smash','skill1','ult']) {
    const at = SB.shape(0.42, SB.weightOf(clip));
    assert.ok(Math.abs(at.yaw) < 1e-9,
      `${clip}: 접점 요우 ${(at.yaw*180/Math.PI).toFixed(1)}° — 0 이어야 한다.
       처음 −25° 로 두었다가 낫이 0.44 m 빗나가고 날이 앞을 안 봤다`);
  }
});

test('감기는 접점 전에, 풀림은 접점 뒤에', () => {
  const w=SB.weightOf('smash');
  const coil=SB.shape(0.28,w).yaw, mid=SB.shape(0.42,w).yaw, rel=SB.shape(0.72,w).yaw;
  assert.ok(coil < -0.2, `감기 ${coil.toFixed(2)} rad — 충분히 감아야 한다`);
  assert.ok(Math.abs(mid) < 1e-9);
  assert.ok(rel > 0.2, `풀림 ${rel.toFixed(2)} rad — 반대편까지 지나가야 한다`);
  assert.ok(Math.abs(SB.shape(1,w).yaw) < 1e-9, '끝에서는 제자리로');
});

test('연계는 뒤로 갈수록 커진다 — 같은 크기면 이어지는 느낌이 안 난다', () => {
  const a=SB.weightOf('attack1',0), b=SB.weightOf('attack1',1), c=SB.weightOf('attack1',2);
  assert.ok(b>a && c>b, `연계 배수 ${a.toFixed(2)} → ${b.toFixed(2)} → ${c.toFixed(2)}`);
  assert.ok(c/a > 1.2, '3타는 1타보다 20% 이상 커야 눈에 띈다');
  /* 무한정 커지지는 않는다 */
  assert.equal(SB.weightOf('attack1',9), SB.weightOf('attack1',2));
  /* 스킬은 연계 배수를 안 탄다 — 스킬은 그 자체로 크기가 정해져 있다 */
  assert.equal(SB.weightOf('ult',2), SB.weightOf('ult',0));
});

test('맞는 동작·방어에는 몸통 비틀기를 걸지 않는다', () => {
  for (const clip of ['hit','hit2','guard','guardHit']) {
    assert.equal(SB.weightOf(clip), 0, clip);
    assert.equal(SB.shape(0.5, SB.weightOf(clip)).yaw, 0);
  }
});

test('기술마다 몸을 쓰는 정도가 다르다', () => {
  const big=SB.weightOf('ult'), light=SB.weightOf('attack1'), guard=SB.weightOf('counter');
  assert.ok(big > light && light > guard,
    `궁극기 ${big} > 평타 ${light} > 카운터 ${guard} — 큰 기술일수록 몸을 크게 쓴다`);
});
