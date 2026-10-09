/* 전국 길 잇기 (문서 219) — 디렉터 «전체 맵 매끄럽게 전부 연결». 2단계 13곳은 문이 하나도 없어 어디서도 못 갔다.
   이야기 길(강남 → 남태령 → 판교 → 남행 국도 → 계룡 → 고흥)에 사슬 둘을 붙인다 — 실제 지도에서 이웃한 순서로:
     ① 계룡 → 대전 → 전주 → 목포 ⇢(여객선) 제주 → 서귀포
     ② 고흥 → 여수 → 부산 → 해운대 → 경주 → 경포 → 속초 → 춘천 → 수원 → 판교
   문은 걷는 띠 끝(end: s0 · s1)의 큰길 위 — 길을 따라 띠 끝까지 걸으면 다음 지역으로 이어진다(3D 는 단추 없이, world3d).
   한 줄 = [지역 A, A 쪽 자리, 지역 B, B 쪽 자리, A 에서 본 이름, B 에서 본 이름]. 문 id 는 상대 지역 id. 짝은 자동으로 맞는다. */
export const LINKS = [
  ['gyeryong', { end: 's0', t: -35 }, 'daejeon', { end: 's0', t: 0 }, '대전 방면 · 국도 1호선', '계룡 방면 · 국도'],
  ['daejeon', { end: 's1', t: 0 }, 'jeonju', { end: 's1', t: 0 }, '전주 방면 · 호남고속도로', '대전 방면 · 호남고속도로'],
  ['jeonju', { end: 's0', t: 0 }, 'mokpo', { end: 's1', t: 0 }, '목포 방면 · 서해안', '전주 방면'],
  ['mokpo', { end: 's0', t: 0 }, 'jeju', { end: 's0', t: 0 }, '제주행 여객선 · 목포항', '목포행 여객선 · 제주항', 'ferry'],
  ['jeju', { end: 's1', t: 0 }, 'seogwipo', { end: 's1', t: 0 }, '서귀포 방면 · 516 도로', '제주시 방면 · 516 도로'],
  ['goheung', { end: 's0', t: 40 }, 'yeosu', { end: 's0', t: 0 }, '여수 방면 · 남해안', '고흥 방면 · 남해안'],
  ['yeosu', { end: 's1', t: 0 }, 'busan', { end: 's0', t: 0 }, '부산 방면 · 남해고속도로', '여수 방면 · 남해고속도로'],
  ['busan', { end: 's1', t: 0 }, 'haeundae', { end: 's0', t: 0 }, '해운대 방면 · 해운대로', '부산역 방면 · 해운대로'],
  ['haeundae', { end: 's1', t: 0 }, 'gyeongju', { end: 's1', t: 0 }, '경주 방면 · 동해선', '해운대 방면 · 동해선'],
  ['gyeongju', { end: 's0', t: 0 }, 'gyeongpo', { end: 's1', t: 0 }, '강릉 방면 · 7번 국도', '경주 방면 · 7번 국도'],
  ['gyeongpo', { end: 's0', t: 0 }, 'sokcho', { end: 's0', t: 0 }, '속초 방면 · 7번 국도', '강릉 방면 · 7번 국도'],
  ['sokcho', { end: 's1', t: 0 }, 'chuncheon', { end: 's1', t: 0 }, '춘천 방면 · 미시령', '속초 방면 · 미시령'],
  ['chuncheon', { end: 's0', t: 0 }, 'suwon', { end: 's1', t: 0 }, '수원 방면 · 경춘선', '춘천 방면 · 경춘선'],
  ['suwon', { end: 's0', t: 0 }, 'pangyo', { end: 's1', t: -200 }, '판교 방면 · 경부고속도로', '수원 방면 · 경부고속도로'],
];
/* 지역 표에 문을 붙인다 (이미 같은 id 가 있으면 건드리지 않는다) */
export function applyLinks(ZONES) {
  for (const [a, atA, b, atB, labA, labB, kind] of LINKS) for (const [z, at, to, toAt, label] of [[a, atA, b, atB, labA], [b, atB, a, atA, labB]]) {
    const Z = ZONES[z]; if (!Z) continue; const F = Z.field || (Z.field = {}); F.gates = F.gates ? [...F.gates] : [];
    if (F.gates.some(g => g.id === to)) continue;
    F.gates.push({ id: to, at, to: { zone: to, gate: z }, label, kind: 'zone', link: kind || 'road' }); }
  return ZONES; }
