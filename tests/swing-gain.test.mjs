import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const SB=require('../js/swing-body.js');

/* 「낫 휘두르는게 너무 허접해」 세 갈래 — 자루 굵기 · 휘두름 크기 · 연계 방향.
   계측: tools/3d/swing-measure.html · 문서: docs/design/67-swing-gain.md */

test('연계는 타수마다 몸이 반대로 돈다 — 봉술의 여덟 방향', () => {
  /* 방향이 안 바뀌면 아무리 크게 휘둘러도 «이어진다» 로 안 읽힌다 */
  assert.equal(SB.chainSide(0), 1);
  assert.equal(SB.chainSide(1), -1);
  assert.equal(SB.chainSide(2), 1);
  for(const c of [0,1,2]) assert.equal(SB.sideOf('attack1', c), SB.chainSide(c));
  /* 한 방짜리는 방향이 고정 — 매번 반대로 돌면 어느 쪽이 본체인지 흐려진다 */
  for(const clip of ['smash','ult','exec','skill1','skill3','counter'])
    for(const c of [0,1,2])
      assert.equal(SB.sideOf(clip, c), 1, clip+' 는 방향이 고정이다');
});

test('휘두름 배율은 «재서» 고른 값이고 관절 한계 안에 있다', async () => {
  const src=fs.readFileSync('js/ain-two-hand.js','utf8');
  const m=src.match(/AIN_SWING_GAIN=\{[\s\S]*?\n\s*(attack1:[^\n]*)\n\};/);
  assert.ok(m, 'AIN_SWING_GAIN 을 못 찾았다');
  const gains={};
  for(const [,k,v] of m[1].matchAll(/(\w+):([0-9.]+)/g)) gains[k]=parseFloat(v);
  assert.deepEqual(gains, {attack1:1.30, attack3:1.25, skill3:1.35, ult:1.25});
  /* ⚠ 1.35~1.50 에서 tests/ain-two-hand 의 관절 튐이 8.54°/프레임(문턱 8°)이 났다.
     올리려면 두 손 그립 IK 의 팔꿈치 특이점을 먼저 고쳐야 한다 (64번 문서 §3). */
  for(const [k,v] of Object.entries(gains))
    assert.ok(v<=1.35, `${k} ${v} — 1.35 를 넘으면 관절이 튄다`);
  /* attack2·smash 는 이미 날이 바닥을 뚫는다(−0.47 m, −0.06 m) — 배율을 걸면 더 나빠진다 */
  assert.equal(gains.attack2, undefined);
  assert.equal(gains.smash, undefined);
});

test('자루가 막대기로 안 보일 만큼 굵다', async () => {
  /* 전투 카메라가 4~6 m 다. 2.2 cm 자루는 3~4 픽셀이라 «선» 으로 보인다.
     실제 전투용 낫(폴암) 자루는 4 cm 안팎이다. */
  const buf=fs.readFileSync('art/3d/ain_scythe_tex.glb');
  const jl=buf.readUInt32LE(12), j=JSON.parse(buf.slice(20,20+jl).toString('utf8'));
  const b0=20+jl+8;
  const verts=[];
  for(const mesh of j.meshes) for(const p of mesh.primitives){
    const acc=j.accessors[p.attributes.POSITION], bv=j.bufferViews[acc.bufferView];
    const base=b0+(bv.byteOffset||0)+(acc.byteOffset||0);
    for(let i=0;i<acc.count;i++)
      verts.push([buf.readFloatLE(base+i*12), buf.readFloatLE(base+i*12+4), buf.readFloatLE(base+i*12+8)]);
  }
  /* 자루 중간(날 아래)의 «얇은» 단면으로 잰다. 두꺼운 띠로 재면 자루가
     기울어 있어서(축 x=0.188y−0.074) 폭이 부풀어 보인다 — 8.8 cm 로 나왔었다. */
  const band=verts.filter(v=>v[1]>0.70&&v[1]<0.74);
  assert.ok(band.length>20, '자루 표본이 있다');
  const w=Math.max(...band.map(v=>v[0]))-Math.min(...band.map(v=>v[0]));
  const t=Math.max(...band.map(v=>v[2]))-Math.min(...band.map(v=>v[2]));
  assert.ok(w>=0.040 && t>=0.035, `자루 ${(w*100).toFixed(1)}×${(t*100).toFixed(1)} cm — 4 cm 는 돼야 한다`);
  assert.ok(w<=0.075, `${(w*100).toFixed(1)} cm — 너무 굵으면 통나무다`);
});
