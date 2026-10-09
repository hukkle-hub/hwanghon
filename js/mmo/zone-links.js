/* 전국 길 잇기 (문서 219) — 디렉터 «전체 맵 매끄럽게 전부 연결». 2단계 13곳은 문이 하나도 없어 어디서도 못 갔다.
   이야기 길(강남 → 남태령 → 판교 → 남행 국도 → 계룡 → 고흥)에 사슬 둘을 붙인다 — 실제 지도에서 이웃한 순서로:
     ① 계룡 → 대전 → 전주 → 목포 ⇢(여객선) 제주 → 서귀포
     ② 고흥 → 여수 → 부산 → 해운대 → 경주 → 경포 → 속초 → 춘천 → 수원 → 판교
   문은 걷는 띠 끝(end: s0 · s1)의 큰길 위(t = 0 근처에서 막이·보스·다른 문을 피한 자리 — 문서 219 §1) — 길을 따라 띠 끝까지 걸으면 다음 지역으로 이어진다(3D 는 단추 없이, world3d).
   한 줄 = [지역 A, A 쪽 자리, 지역 B, B 쪽 자리, A 에서 본 이름, B 에서 본 이름]. 문 id 는 상대 지역 id. 짝은 자동으로 맞는다.
   3D 필드(world3d)만 — 서버 지도(map.json)는 그대로 (아래 linkGates). */
export const LINKS = [
  ['gyeryong', { end: 's0', t: -35 }, 'daejeon', { end: 's0', t: 44 }, '대전 방면 · 국도 1호선', '계룡 방면 · 국도'],
  ['daejeon', { end: 's1', t: 0 }, 'jeonju', { end: 's1', t: -5 }, '전주 방면 · 호남고속도로', '대전 방면 · 호남고속도로'],
  ['jeonju', { end: 's0', t: 12 }, 'mokpo', { end: 's1', t: 9 }, '목포 방면 · 서해안', '전주 방면'],
  ['mokpo', { end: 's0', t: 6 }, 'jeju', { end: 's0', t: -3 }, '제주행 여객선 · 목포항', '목포행 여객선 · 제주항', 'ferry'],
  ['jeju', { end: 's1', t: -5 }, 'seogwipo', { end: 's1', t: 0 }, '서귀포 방면 · 516 도로', '제주시 방면 · 516 도로'],
  ['goheung', { end: 's0', t: 40 }, 'yeosu', { end: 's0', t: 7 }, '여수 방면 · 남해안', '고흥 방면 · 남해안'],
  ['yeosu', { end: 's1', t: 0 }, 'busan', { end: 's0', t: 60 }, '부산 방면 · 남해고속도로', '여수 방면 · 남해고속도로'],
  ['busan', { end: 's1', t: 10 }, 'haeundae', { end: 's0', t: -6 }, '해운대 방면 · 해운대로', '부산역 방면 · 해운대로'],
  ['haeundae', { end: 's1', t: 0 }, 'gyeongju', { end: 's1', t: -3 }, '경주 방면 · 동해선', '해운대 방면 · 동해선'],
  ['gyeongju', { end: 's0', t: 0 }, 'gyeongpo', { end: 's1', t: 0 }, '강릉 방면 · 7번 국도', '경주 방면 · 7번 국도'],
  ['gyeongpo', { end: 's0', t: 0 }, 'sokcho', { end: 's0', t: 0 }, '속초 방면 · 7번 국도', '강릉 방면 · 7번 국도'],
  ['sokcho', { end: 's1', t: 0 }, 'chuncheon', { end: 's1', t: 0 }, '춘천 방면 · 미시령', '속초 방면 · 미시령'],
  ['chuncheon', { end: 's0', t: 0 }, 'suwon', { end: 's1', t: 0 }, '수원 방면 · 경춘선', '춘천 방면 · 경춘선'],
  ['suwon', { end: 's0', t: -3 }, 'pangyo', { end: 's1', t: -246 }, '판교 방면 · 경부고속도로', '수원 방면 · 경부고속도로'],
];
/* 한 지역의 길 문 — world3d 가 띠 끝 자리를 계산해 세운다. 지역 표·map.json 에는 넣지 않는다:
   map.json 에는 서버 생태(둥지·순찰 해시)·구운 높이·사냥터가 묶여 있어, 문을 넣어 다시 계획하면 서버 쪽 시험 32 개가 깨졌다 (문서 219 §1).
   서버 도착 자리는 server/field.cjs linkArrival (같은 공식, 문서 220 §16). */
export function linkGates(zone) { const out = [];
  for (const [a, atA, b, atB, labA, labB, kind] of LINKS) for (const [z, at, to, label] of [[a, atA, b, labA], [b, atB, a, labB]])
    if (z === zone) out.push({ id: to, at, to: { zone: to, gate: z }, label, kind: 'zone', link: kind || 'road', r: 3.2 });
  return out; }
