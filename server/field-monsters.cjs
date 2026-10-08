/* 필드 몬스터 표 — 등급·외형 기준·자리를 «한 곳에서» (docs/design/204). boss-table.cjs 처럼 숫자·자리만 둔다.
   등급 사다리: 5급 = 거점 웨이브(남산 N01, 문서 203) · 4·3급 = 등급별로 웨이브에 더해질 몫 · 2·1급 = 필드 전용 (디렉터 2026-10-08 «이 두 개체를 필드 몬스터로 지정»).
   외형은 승인 시트(docs/design/ref/field-monsters-grade12/)가 기준이다 — 새로 그리거나 재해석하지 않는다.
   런타임(스폰·AI·타격·드롭)은 아직 없다: 필드엔 보스만 있다 (문서 199 의 일반 몬스터 연결점에 이 표를 물린다).
   zones: [지역, 사냥터 id] — maps/2d/<지역>/map.json areas kind:'hunt'. 안전 지대(kind:'rest')엔 들어가지 않는다 (문서 198). */
const REF = 'docs/design/ref/field-monsters-grade12/';
const FIELD_MONSTERS = {
  t1_infected: {
    grade: 1, name: '1급 감염체', nameDraft: true,
    ref: REF + 'grade1-reference.png',
    look: '은발 장발 · 가시 왕관 · 찢긴 검은 드레스와 붉은 감염 혈관 · 금빛 사슬과 십자 · 가시 굽 부츠 · 붉은 손톱. 인간형·귀족적, 괴물화 금지',
    lv: [78, 83], zones: [['seogwipo', 'mid'], ['seogwipo', 'left'], ['seogwipo', 'right']],   /* 가장 높은 필드 — 가안 */
  },
  t2_infected: {
    grade: 2, name: '2급 감염체', nameDraft: true,
    ref: REF + 'grade2-reference.png',
    look: '흑발 장발 · 가시 머리장식 · 검은 롱코트(붉은 안감)와 사슬·십자 · 붉은 감염 혈관이 감긴 손 · 전투화. 인간형·귀족적, 괴물화 금지',
    lv: [75, 78], zones: [['jeju', 'left'], ['jeju', 'right']],   /* 그 아래 필드 — 가안 */
  },
};
/* 필드에 둘 수 있는 등급 (웨이브 등급과 겹치지 않는다) */
const FIELD_GRADES = [1, 2];
module.exports = { FIELD_MONSTERS, FIELD_GRADES };
