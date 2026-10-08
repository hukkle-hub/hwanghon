/* 필드 몬스터 표 — 등급·분류·외형 기준·자리를 «한 곳에서» (docs/design/204). boss-table.cjs 처럼 숫자·자리만 둔다.
   등급 사다리: 5급 = 거점 웨이브(남산 N01, 문서 203) · 4·3급 = 등급별로 웨이브에 더해질 몫 · 2급 이상 = 필드.
   디렉터 2026-10-08: «둘다 2급 지배형으로 분류 하고 필드에 배치하자» — 시트에 «1급» 이라 적힌 쪽도 2급 지배형이다.
   외형은 승인 시트(docs/design/ref/field-monsters-grade12/)가 기준 — 새로 그리거나 재해석하지 않는다.
   지금 몸은 임시: Hi3D 자격증명(HI3D_CLIENT_ID/SECRET)이 이 환경에 없어 승인 시트 모델을 못 굽는다 → 사람형 애니메이션 모델을 어둡게 물들여 쓴다.
   전투는 server/field-dominator.cjs (서버 권위), 자리·모델 표시는 maps/2d/<지역>/map.json bosses[] (필드 보스와 같은 통로). */
const REF = 'docs/design/ref/field-monsters-grade12/';
const FIELD_MONSTERS = {
  t2_dominator_f: {
    grade: 2, kind: 'dominator', ai: 'dominator', name: '2급 지배형', title: '가시관 (가안)', nameDraft: true,
    ref: REF + 'grade1-reference.png',   /* 시트 머리글은 «1급» — 디렉터가 2급 지배형으로 분류 */
    look: '은발 장발 · 가시 왕관 · 찢긴 검은 드레스와 붉은 감염 혈관 · 금빛 사슬과 십자 · 가시 굽 부츠 · 붉은 손톱. 인간형·귀족적, 괴물화 금지',
    hp: 3000000, cycle: { period: '10m', start: '1m', end: '3m' },
    lv: [78, 81], zone: 'seogwipo', area: 'mid', at: [37.6, 70.6],
    body: { model: 'art/3d/sera_anim.glb', visualH: 2.25, tint: 0x2a0c12, glow: 0x8a0010 },   /* 임시 몸 */
  },
  t2_dominator_m: {
    grade: 2, kind: 'dominator', ai: 'dominator', name: '2급 지배형', title: '흑의 (가안)', nameDraft: true,
    ref: REF + 'grade2-reference.png',
    look: '흑발 장발 · 가시 머리장식 · 검은 롱코트(붉은 안감)와 사슬·십자 · 붉은 감염 혈관이 감긴 손 · 전투화. 인간형·귀족적, 괴물화 금지',
    hp: 3000000, cycle: { period: '10m', start: '1m', end: '3m' },
    lv: [75, 78], zone: 'jeju', area: 'left', at: [96.3, 39.4],
    body: { model: 'art/3d/kain_anim.glb', visualH: 2.35, tint: 0x1a0a0e, glow: 0x7a0010 },
  },
  /* 디렉터 2026-10-08 «이것도 2급으로 배치해줘» — 시트 머리글은 «3급 엘리트», 분류는 2급 지배형. 셋 다 검(카타나)을 든 인간형 */
  t2_dominator_silence: {
    grade: 2, kind: 'dominator', ai: 'dominator', name: '2급 지배형', title: '침묵 (가안)', nameDraft: true,
    ref: REF + 'grade2-silence-reference.png',
    look: '회색 짧은 머리 청년 · 높은 깃의 검은 재킷과 붉은 술·하네스 · 꽃무늬 검은 천 · 버클 전투화 · 목·손등의 붉은 감염 문양 · 붉은 술 단 검. «아름다움은 침묵 속에서 더 강해진다»',
    hp: 3000000, cycle: { period: '10m', start: '1m', end: '3m' },
    lv: [80, 83], zone: 'seogwipo', area: 'left', at: [-83.3, 147.3],
    body: { model: 'art/3d/ryu_anim.glb', visualH: 2.2, tint: 0x1c0b0e, glow: 0x7a0010 },
  },
  t2_dominator_crimson: {
    grade: 2, kind: 'dominator', ai: 'dominator', name: '2급 지배형', title: '붉은 검 (가안)', nameDraft: true,
    ref: REF + 'grade2-crimson-blade-reference.png',
    look: '검은 단발 여성 · 검붉은 재킷과 끈 하네스 · 붉은 결정이 돋은 팔 · 꽃무늬 천 · 굽 높은 버클 부츠 · 붉은 날의 검. «아름다움도 무기가 된다»',
    hp: 3000000, cycle: { period: '10m', start: '1m', end: '3m' },
    lv: [76, 78], zone: 'jeju', area: 'right', at: [339, -100.9],
    body: { model: 'art/3d/sera_anim.glb', visualH: 2.2, tint: 0x260a10, glow: 0x9a0014 },
  },
  t2_dominator_bloodflower: {
    grade: 2, kind: 'dominator', ai: 'dominator', name: '2급 지배형', title: '혈화 (가안)', nameDraft: true,
    ref: REF + 'grade2-blood-flower-reference.png',
    look: '긴 머리를 묶은 거친 남성 · 흉터 · 결정 가시가 돋은 검은 갑주 팔 · 붉은 술과 하네스 · 꽃무늬 천 · 전투화 · 검 «血華». «아름다운 붉음은 언제나 더 깊이 퍼진다»',
    hp: 3000000, cycle: { period: '10m', start: '1m', end: '3m' },
    lv: [81, 83], zone: 'seogwipo', area: 'right', at: [140.4, 4],
    body: { model: 'art/3d/kain_anim.glb', visualH: 2.35, tint: 0x1a090c, glow: 0x8a0012 },
  },
};
/* 필드에 둘 수 있는 등급 (웨이브 등급 5·4·3 과 겹치지 않는다) */
const FIELD_GRADES = [1, 2];
module.exports = { FIELD_MONSTERS, FIELD_GRADES };
