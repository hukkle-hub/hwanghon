/* 황혼의 한국 — 전국 지역 목록 (docs/design/192)
   연속 세계 대신 실제 좌표에 흩어진 지역. 지역 «안» 은 1:1 실측, 지역 «사이» 는 지도 화면의 빠른 이동(길잡이 오정길).
   kind: hub(거점·안전) · city · coast · mountain · river · rural · industrial · island · historic
   zone: 이미 구운 지역 id (js/mmo/zones.js) — 없으면 아직 계획. 레벨은 강남에서의 거리로(문서 187 «장소가 곧 난이도»).
   좌표는 OSM 을 받을 중심(대개 큰길 위). 원작 동선 지역은 원작 레벨(문서 185 §3)을 따른다. */

import { AUTO } from './zones-auto.js';

export const ORIGIN = { lat: 37.4979, lon: 127.0276 };   /* 강남역 — 강남 벙커 */

export const REGIONS = [
  /* ---- 원작 동선 (메인 퀘스트) ---- */
  { id: 'gangnam', name: '강남', kind: 'hub', lat: 37.4979, lon: 127.0276, zone: 'gangnam', lv: [1, 10], story: true },
  { id: 'namsan', name: '남산', kind: 'mountain', lat: 37.5566, lon: 126.9840, zone: 'namsan', lv: [10, 18], story: true },
  { id: 'yeouido', name: '여의도', kind: 'city', lat: 37.5250, lon: 126.9260, zone: 'yeouido', lv: [18, 25], story: true },
  { id: 'namtae', name: '남태령', kind: 'mountain', lat: 37.4640, lon: 126.9890, zone: 'namtae', lv: [30, 35], story: true },
  { id: 'pangyo', name: '판교', kind: 'city', lat: 37.4010, lon: 127.1080, zone: 'pangyo', lv: [35, 40], story: true },
  { id: 'southroad', name: '남행 국도', kind: 'rural', lat: 37.2350, lon: 127.2875, zone: 'southroad', lv: [40, 45], story: true },
  { id: 'gyeryong', name: '계룡', kind: 'mountain', lat: 36.2680, lon: 127.2135, zone: 'gyeryong', lv: [45, 52], story: true },
  { id: 'goheung', name: '고흥', kind: 'coast', lat: 34.4318, lon: 127.5350, zone: 'goheung', lv: [52, 60], story: true },

  /* ---- 거점 (리니지 마을처럼 안전 지대) ---- */
  { id: 'daejeon', name: '대전역', kind: 'hub', lat: 36.3326, lon: 127.4344 },
  { id: 'daegu', name: '대구 동성로', kind: 'hub', lat: 35.8690, lon: 128.5958 },
  { id: 'busan', name: '부산역', kind: 'hub', lat: 35.1150, lon: 129.0422 },
  { id: 'gwangju', name: '광주 금남로', kind: 'hub', lat: 35.1466, lon: 126.9198 },
  { id: 'gangneung', name: '강릉역', kind: 'hub', lat: 37.7637, lon: 128.8995 },
  { id: 'jeonju', name: '전주 한옥마을', kind: 'hub', lat: 35.8150, lon: 127.1530 },
  { id: 'jeju', name: '제주시', kind: 'hub', lat: 33.4996, lon: 126.5312 },

  /* ---- 전국 필드 ---- */
  { id: 'wolmido', name: '인천 월미도', kind: 'coast', lat: 37.4753, lon: 126.5959 },
  { id: 'suwon', name: '수원 화성', kind: 'historic', lat: 37.2820, lon: 127.0140 },
  { id: 'chuncheon', name: '춘천 소양강', kind: 'river', lat: 37.8840, lon: 127.7280 },
  { id: 'seorak', name: '설악산', kind: 'mountain', lat: 38.1720, lon: 128.4880 },
  { id: 'sokcho', name: '속초 해변', kind: 'coast', lat: 38.1910, lon: 128.6020 },
  { id: 'gyeongpo', name: '강릉 경포', kind: 'coast', lat: 37.7970, lon: 128.9080 },
  { id: 'daegwallyeong', name: '대관령', kind: 'rural', lat: 37.6880, lon: 128.7520 },
  { id: 'chungju', name: '충주호', kind: 'river', lat: 36.9930, lon: 127.9880 },
  { id: 'cheongju', name: '청주 성안길', kind: 'city', lat: 36.6360, lon: 127.4890 },
  { id: 'sejong', name: '세종', kind: 'city', lat: 36.5040, lon: 127.2650 },
  { id: 'mungyeong', name: '문경새재', kind: 'mountain', lat: 36.7630, lon: 128.0790 },
  { id: 'andong', name: '안동 하회마을', kind: 'historic', lat: 36.5390, lon: 128.5180 },
  { id: 'pohang', name: '포항 영일대', kind: 'coast', lat: 36.0560, lon: 129.3790 },
  { id: 'gyeongju', name: '경주 대릉원', kind: 'historic', lat: 35.8380, lon: 129.2120 },
  { id: 'ulsan', name: '울산 조선소', kind: 'industrial', lat: 35.5060, lon: 129.4290 },
  { id: 'haeundae', name: '부산 해운대', kind: 'coast', lat: 35.1588, lon: 129.1604 },
  { id: 'gamcheon', name: '부산 감천', kind: 'city', lat: 35.0975, lon: 129.0106 },
  { id: 'tongyeong', name: '통영 강구안', kind: 'coast', lat: 34.8440, lon: 128.4250 },
  { id: 'jirisan', name: '지리산 성삼재', kind: 'mountain', lat: 35.2995, lon: 127.5143 },
  { id: 'namwon', name: '남원 광한루', kind: 'historic', lat: 35.4040, lon: 127.3800 },
  { id: 'suncheon', name: '순천만', kind: 'river', lat: 34.8840, lon: 127.5100 },
  { id: 'yeosu', name: '여수 항구', kind: 'coast', lat: 34.7530, lon: 127.7480 },
  { id: 'mokpo', name: '목포 유달산', kind: 'coast', lat: 34.7930, lon: 126.3770 },
  { id: 'gunsan', name: '군산 근대거리', kind: 'city', lat: 35.9880, lon: 126.7110 },
  { id: 'halla', name: '한라산 성판악', kind: 'mountain', lat: 33.3850, lon: 126.6200 },
  { id: 'seongsan', name: '제주 성산', kind: 'coast', lat: 33.4590, lon: 126.9400 },
  { id: 'seogwipo', name: '서귀포 항', kind: 'coast', lat: 33.2470, lon: 126.5610 },
  { id: 'ulleung', name: '울릉도 도동항', kind: 'island', lat: 37.4840, lon: 130.9060 },
];
/* 찍어 낸 지역(zones-auto.js)은 같은 id 로 이어 붙는다 */
for (const r of REGIONS) if (!r.zone && AUTO[r.id]) r.zone = r.id;

/* 강남에서의 직선거리(km) */
export function distKm(r, o = ORIGIN) { const R = 6371, d = Math.PI / 180, a = Math.sin((r.lat - o.lat) * d / 2) ** 2 + Math.cos(r.lat * d) * Math.cos(o.lat * d) * Math.sin((r.lon - o.lon) * d / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); }
/* 장소가 곧 난이도: 원작 동선은 원작 레벨, 그 밖은 Lv ≈ 1 + 거리/6 (구간 폭 5). 거점은 안전 지대(레벨 없음) */
export function levelOf(r) { if (r.lv) return r.lv; if (r.kind === 'hub') return null; const c = Math.round(1 + distKm(r) / 6); return [Math.max(1, c - 2), c + 3]; }
