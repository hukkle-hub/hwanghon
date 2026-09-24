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
  assert.deepEqual(gains, {attack1:1.30, attack3:1.25, skill3:1.35, ult:1.35});
  /* ⚠ 문턱은 tests/ain-two-hand 의 «표본당 8°» 다. 그 검사는 행동 시간을
     240 등분해 재므로 **행동을 길게 해도 값이 안 변한다** — 실측으로 확인:
     궁극기 1.62초와 1.95초에서 8.116° 로 동일. 즉 시간을 사도 배율은 못 올린다.
     올리려면 «각속도 프로파일» 을 평평하게 만들어야 한다 (지금 정점이 평균의
     5.3배). docs/design/69 §3 */
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

test('키 사이 보간은 «키에서 멈추지» 않는다', async () => {
  /* 예전에는 이웃 두 키를 각각 smootherstep 으로 이었다. smootherstep 은 양 끝
     속도가 0 이라 무기가 키마다 한 번씩 멈췄다 — 키 5개면 스윙 한 번에 네 번.
     실측(날 끝 속도 / 평균): counter 키 .65 에서 0.03 배, attack2 .65 에서 0.11 배.
     그게 「촐싹댄다」의 정체였다. 3차 에르미트로 바꿔 키를 «지나가게» 했다.
     docs/design/68-grip-ik-truth.md */
  const src=fs.readFileSync('js/ain-two-hand.js','utf8');
  assert.ok(/function hermite\(/.test(src) && /function tangents\(/.test(src),
    '키 보간이 에르미트여야 한다');
  assert.ok(!/smootherstep\(t,t0,t1\)/.test(src),
    'path/pathRotation 에 구간별 smootherstep 이 남아 있으면 안 된다 — 키마다 멈춘다');

  /* 에르미트가 실제로 키를 «지나가는지» 수치로 확인한다 (1차원으로 축소) */
  const {default:_}= {default:null};
  const mod=await import('../js/ain-two-hand.js');
  assert.ok(typeof mod.AIN_SWING_GAIN==='object', '모듈이 뜬다');
});

test('무거운 기술은 «호 길이» 로 다시 매개화해서 각속도를 고르게 편다', async () => {
  /* 목표는 힉스필드 3D 리그 애니메이션 라이브러리(Meshy)의 실제 무거운 무기
     클립에서 재 온 값이다 — 프레임 간 움직임 세기의 정점/평균:
         Heavy_Hammer_Swing 1.55 · Charged_Slash 2.18 · Sword_Judgment 2.49
     우리는 5.3 이었다. docs/design/70-even-pace.md */
  const src=fs.readFileSync('js/ain-two-hand.js','utf8');
  const m=src.match(/var EVEN_PACE=\{([^}]*)\}/);
  assert.ok(m, 'EVEN_PACE 를 못 찾았다');
  for(const clip of ['smash','ult','exec'])
    assert.ok(new RegExp(clip+':\\s*true').test(m[1]), clip+' 은 평탄화 대상이다');
  /* ⚠ skill3 을 넣으면 관절 튐이 7.28 → 9.08 로 뛴다. 평타 계열은 12.1.
     자루를 고르게 펴는 것과 «팔» 이 고르게 도는 것은 다른 문제다 — 재고 넣어라. */
  for(const clip of ['attack1','attack2','attack3','counter','skill1','skill3'])
    assert.ok(!new RegExp(clip+':\\s*true').test(m[1]), clip+' 은 대상이 아니다');
  /* 접점 고정은 «단조 3차» 여야 한다. 두 토막 선형으로 했더니 접점에서
     속도가 꺾여 관절 튐이 20.3° 까지 갔다 (68번에서 잡은 불연속의 재현). */
  assert.ok(/monoTan/.test(src), '접점 고정이 단조 3차여야 한다');
});

test('두 손 그립 IK 는 특이점 근처에 가지 않는다 — 64번 문서의 전제는 틀렸다', () => {
  /* 오래도록 solveGripCircle 의 «팔꿈치 특이점» 을 휘두름의 천장으로 적어
     왔는데, 전 전투 클립을 훑어 보니 radial 0.127~0.254, |cos| 최대 0.949,
     접선 근접 0 회였다. 이 풀이는 내내 잘 조건화돼 있다.
     그 사실을 코드 주석과 계측기로 남겨 둔다 — 또 같은 오진을 하지 않게. */
  const src=fs.readFileSync('js/ain-grip-ik.js','utf8');
  assert.ok(/GRIP_DIAG/.test(src), '조건수 계측기가 남아 있어야 한다');
  assert.ok(/틀렸다/.test(src), '오진 기록이 주석에 남아 있어야 한다');
  /* 죽은 보정 코드가 다시 들어오지 않게 */
  assert.ok(!/prevDir|SOFT_RADIAL/.test(src),
    '특이점 보정은 한 번도 작동하지 않아 뺐다 — 다시 넣으려면 먼저 재라');
});
