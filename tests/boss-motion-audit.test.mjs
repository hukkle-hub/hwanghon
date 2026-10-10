/* 보스 동작이 사람 관절로 되는가 (문서 226) — 디렉터 «확대해서 이상한건 다 잡고 스킬 모션이 정상적으로 사람같이 구현되는가».
   필드에서 쓰는 클립만: 역무릎(엉덩이-발목 선 뒤로 꺾인 무릎) 없음 (팔꿈치는 안 본다 — 섀도우 팽·실험체 09호의 휘두르는 괴물 팔은 위팔 비틀기로 맞추면 ±180°에서 튀어 그대로 둠, 문서 226 §4) · 발이 바닥 아래로 4 cm 넘게 안 묻힘 · 한 키(1/30 s)에 80° 넘게 도는 뼈 없음.
   고치기 전: 클레이브 셔터 왼무릎 59° 역관절 · 섀도우 팽 찌르기(atk_charge) 골반이 바닥까지(68 cm) · 클레이브 폭풍 이음새 한 키 138° · 정 장관 3합 칼 178° 뒤집힘 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { motionAudit } = await import('../tools/3d/motion-audit.mjs');
const FIELD = {
  'art/3d/part1/clave.glb': ['idle', 'walk', 'atk_claveshut', 'atk_clavestorm', 'atk_slam', 'stagger', 'death'],
  'art/3d/part1/shadow_fang.glb': ['idle', 'walk', 'atk_sfflurry', 'atk_charge', 'atk_sfbloom', 'stagger', 'death'],
  'art/3d/part1/subject_09.glb': ['idle', 'walk', 'atk_s09frenzy', 'atk_s09storm', 'stagger', 'death'],
  'art/3d/part1/minister_jeong_candidate.glb': ['idle_jeong', 'walk', 'atk_jeong_circle', 'atk_jeong_triple', 'atk_jeong_back', 'atk_jeong_command', 'death_jeong', 'stagger'],
};
const POP = { 'art/3d/part1/minister_jeong_candidate.glb': { atk_jeong_circle: 90 } };   /* 원: 몸 전체가 0.2 s 에 160° 도는 «한 바퀴» — 골반이 한 키 63° */
for (const [file, clips] of Object.entries(FIELD)) test(`사람 관절: ${file.split('/').pop()} — 역무릎 · 바닥 아래 · 한 키 튐`, async () => {
  const b = fs.readFileSync(file), j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  assert.ok(j.asset?.extras?.clipJointFix, 'tools/3d/clip-joint-fix.mjs 로 고친 표가 없다');
  const r = await motionAudit(file, clips), bad = [];
  assert.equal(r.clips.length, clips.length, '클립 이름');
  for (const c of r.clips) { const lim = POP[file]?.[c.clip] ?? 80;
    if (c.hyper[0] > 10 && /Leg$/.test(c.hyper[2])) bad.push(`${c.clip} 역관절 ${c.hyper[0]}° @${c.hyper[1]}s ${c.hyper[2]}`);
    if (c.sink[0] > .04) bad.push(`${c.clip} 바닥 아래 ${c.sink[0]} m @${c.sink[1]}s`);
    if (c.pop[0] > lim) bad.push(`${c.clip} 한 키 ${c.pop[0]}° @${c.pop[1]}s ${c.pop[2]}`); }
  assert.deepEqual(bad, []);
});
