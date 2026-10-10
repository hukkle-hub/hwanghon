/* 보스 동작이 사람 관절로 되는가 (문서 226) — 디렉터 «확대해서 이상한건 다 잡고 스킬 모션이 정상적으로 사람같이 구현되는가».
   필드에서 쓰는 클립만: 역무릎·역팔꿈치(위-끝 마디 선에서 가운데 마디가 반대로) 없음 · 옆으로 60° 넘게 꺾인 무릎·팔꿈치 없음 (문서 227 — 거울 + 위 마디 비틀기 계획) · 발이 바닥 아래로 4 cm 넘게 안 묻힘 · 한 키(1/30 s)에 80° 넘게 도는 뼈 없음.
   고치기 전: 섀도우 팽 연격 왼팔꿈치 37° 역관절·옆 120° · 실험체 09호 폭주 왼팔꿈치 옆 94° · 클레이브 셔터 왼무릎 59° 역관절 · 섀도우 팽 찌르기(atk_charge) 골반이 바닥까지(68 cm) · 클레이브 폭풍 이음새 한 키 138° · 정 장관 3합 칼 178° 뒤집힘 */
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
for (const [file, clips] of Object.entries(FIELD)) test(`사람 관절: ${file.split('/').pop()} — 역무릎·역팔꿈치 · 옆꺾임 · 바닥 아래 · 한 키 튐`, async () => {
  const b = fs.readFileSync(file), j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  assert.ok(j.asset?.extras?.clipJointFix?.v >= 5, 'tools/3d/clip-joint-fix.mjs v5(팔꿈치·허벅지 비틀기·손목) 로 고친 표가 없다');
  const r = await motionAudit(file, clips), bad = [];
  assert.equal(r.clips.length, clips.length, '클립 이름');
  for (const c of r.clips) { const lim = POP[file]?.[c.clip] ?? 80;
    for (const [k, [v, t]] of Object.entries(c.joints)) { if (/ 역$/.test(k) && v > 10) bad.push(`${c.clip} ${k}관절 ${v}° @${t}s`); if (/ 옆$/.test(k) && v > 60) bad.push(`${c.clip} ${k}으로 ${v}° @${t}s`); }
    if (c.sink[0] > .04) bad.push(`${c.clip} 바닥 아래 ${c.sink[0]} m @${c.sink[1]}s`);
    if (c.pop[0] > lim) bad.push(`${c.clip} 한 키 ${c.pop[0]}° @${c.pop[1]}s ${c.pop[2]}`); }
  assert.deepEqual(bad, []);
});

/* 영웅 몸 (문서 227) — 플레이어와 2급 지배형(카인·세라·류)이 같이 쓴다. 무릎만 고쳤다(거울 + 허벅지 비틀기): 팔은 영웅 리그의 위팔 굴림이 달라
   거울이 자연스러운 팔꿈치(손을 어깨로, 팔꿈치는 아래)를 어깨 위로 뒤집었다. 고치기 전: 류 공격2 무릎 옆 116°·역 48° · 카인 걷기 역 20° · 세라 기술3 옆 72° */
for (const h of ['kain', 'sera', 'ryu', 'ain']) test(`영웅 무릎: ${h}_anim.glb — 전 클립 역무릎 · 옆꺾임`, async () => {
  const file = `art/3d/${h}_anim.glb`, b = fs.readFileSync(file), j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  assert.ok(j.asset?.extras?.clipJointFix?.v >= 5, '무릎 고친 표가 없다');
  const r = await motionAudit(file), bad = [], SIDE = { ain: 65 };   /* 아인 걷기 왼무릎 옆 63° — 허벅지 비틀기 한계(60°) 밖 */
  for (const c of r.clips) for (const [k, [v, t]] of Object.entries(c.joints)) { if (!/Leg/.test(k)) continue;
    if (/ 역$/.test(k) && v > 10) bad.push(`${c.clip} ${k}관절 ${v}° @${t}s`); if (/ 옆$/.test(k) && v > (SIDE[h] || 60)) bad.push(`${c.clip} ${k}으로 ${v}° @${t}s`); }
  assert.deepEqual(bad, []);
});
