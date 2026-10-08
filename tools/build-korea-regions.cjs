/* 전국 16권역 데이터 만들기 (docs/design/202 §8) — GPT 패키지 시드(docs/design/ref/guildworld-v03/Config)에서
   ue/HwanghonCombatUE/Content/Data/region_<id>.json (서울 말고 15곳) 과 korea.json (권역·회랑·전국 작전) 을 만든다.

     node tools/build-korea-regions.cjs

   시드엔 서울 말고 거점 사이 연결이 없다. 그래서 권역 안은 «허브 ↔ 각 거점» 별 모양으로 잇는다(모든 물자가 허브를 거친다는 가정).
   서울은 손으로 만든 region_seoul.json(링크 10개, 지도 좌표)을 그대로 둔다.
   권역 위치는 허브 도시의 대략적 경위도(지도 표시용, 실측 아님). */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), REF = path.join(ROOT, 'docs', 'design', 'ref', 'guildworld-v03', 'Config'), OUT = path.join(ROOT, 'ue', 'HwanghonCombatUE', 'Content', 'Data');
const seeds = JSON.parse(fs.readFileSync(path.join(REF, 'KR_RegionalNodeSeeds_v03.json'), 'utf8'));
const macro = JSON.parse(fs.readFileSync(path.join(REF, 'KR_MacroRegions_2026.json'), 'utf8'));
const corridors = JSON.parse(fs.readFileSync(path.join(REF, 'KR_StrategicCorridors_v01.json'), 'utf8')).corridors;
const seoul = JSON.parse(fs.readFileSync(path.join(OUT, 'region_seoul.json'), 'utf8'));

/* 허브 도시 경위도 (대략) */
const LONLAT = { SEOUL: [126.98, 37.57], INCHEON: [126.62, 37.45], GYEONGGI: [127.03, 37.26], GANGWON: [127.92, 37.34], CHUNGBUK: [127.49, 36.64],
  CHUNGNAM: [127.15, 36.81], SEJONG: [127.29, 36.48], DAEJEON: [127.38, 36.35], JEONBUK: [127.15, 35.82], JG_SPECIAL: [126.85, 35.16],
  GYEONGBUK: [128.73, 36.57], DAEGU: [128.60, 35.87], ULSAN: [129.31, 35.54], BUSAN: [129.08, 35.18], GYEONGNAM: [128.68, 35.23], JEJU: [126.53, 33.50] };
const ROLE = { Intel: 'intel', SafeHub: 'safe_hub', Manufacturing: 'manufacturing', Logistics: 'logistics', Resource: 'resource', Recon: 'recon', Port: 'port', Transit: 'transit', Energy: 'energy' };
const EFFECT = {
  intel: ['경보·정보망 정상', '경보 지연', '권역 정보망 차단'], safe_hub: ['대피·거래 허브 정상', '일부 서비스 혼잡', '피난 기능 대폭 축소'],
  manufacturing: ['수리·제작 정상', '제작 효율 저하', '수리·제작 제한'], logistics: ['수송 정상', '수송 지연', '전략 물류 차단'],
  resource: ['자원 공급 정상', '공급 감소', '자원 공급 제한'], recon: ['위협 탐지 정상', '탐지 범위 감소', '조기경보 상실'],
  port: ['항만 정상', '하역 지연', '해상 보급 차단'], transit: ['교통 결절 정상', '통행 지연', '교통축 단절'], energy: ['에너지 정상', '공급 불안정', '에너지 공급 차단'] };
const lower = id => id.toLowerCase();
/* 지도 좌표 0..1 (경도 126.2~129.6, 위도 33.2~38.0 — 허브 도시들이 들어가는 범위) */
const norm = ([lon, lat]) => [+((lon - 126.2) / 3.4).toFixed(3), +((38.0 - lat) / 4.8).toFixed(3)];

const written = [];
for (const r of seeds.regions) {
  if (r.region_id === 'SEOUL') continue;
  const hub = r.nodes.find(n => n.tier === 3), others = r.nodes.filter(n => n !== hub);
  const nodes = r.nodes.map(n => { const role = ROLE[n.role] || 'resource', i = others.indexOf(n), ang = (i / Math.max(1, others.length)) * Math.PI * 2 - Math.PI / 2;
    const at = n === hub ? [0.5, 0.5] : [+(0.5 + 0.38 * Math.cos(ang)).toFixed(3), +(0.5 + 0.4 * Math.sin(ang)).toFixed(3)];
    const [online, degraded, occupied] = EFFECT[role];
    return { id: n.id, name: n.name, role, tier: n.tier, weight: n.weight, at, effects: { online, degraded, occupied } }; });
  const cfg = { id: lower(r.region_id), name: r.display_name, identity: r.gameplay_identity,
    doc: '전국 권역 (docs/design/202 §8) — tools/build-korea-regions.cjs 가 GPT 패키지 시드에서 만든 파일. 손으로 고치지 말고 생성기를 고친다. 권역 안 연결은 허브 ↔ 각 거점(별 모양) 가정',
    rules: seoul.rules, pressure_bands: seoul.pressure_bands, nodes,
    links: others.map(n => ({ a: hub.id, b: n.id, transfer: 0.18, throughput: 1.0 })) };
  fs.writeFileSync(path.join(OUT, 'region_' + cfg.id + '.json'), JSON.stringify(cfg, null, 1) + '\n'); written.push(cfg.id);
}
const korea = {
  doc: '대한민국 16권역 · 전략 회랑 · 전국 작전 (docs/design/202 §8). tools/build-korea-regions.cjs 가 만든다. 위치는 허브 도시의 대략 경위도를 0..1 로 (지도 표시용)',
  regions: macro.regions.map(m => { const s = seeds.regions.find(r => r.region_id === m.region_id), hub = s.nodes.find(n => n.tier === 3);
    return { id: lower(m.region_id), name: m.display_name, identity: m.gameplay_identity, hub: hub.id, hubName: hub.name, at: norm(LONLAT[m.region_id]) }; }),
  corridors: corridors.map(c => ({ id: lower(c.id), regions: c.regions.map(lower), type: c.type, purpose: c.purpose })),
  /* 전국 작전 단계 — 시간 없이 지금 상태로만 정한다 (해결·쿨다운은 시간 축이라 나중) */
  campaign: { mobilize_crisis_regions: 1, mobilize_invasion_regions: 2, active_crisis_regions: 2, critical_collapsed_regions: 1 },
  /* 권역 사이 번짐: 압력 75(위기) 이상인 권역이 회랑으로 이어진 이웃 권역의 허브에 «밖에서 들어온 위협» 을 (압력−50)×0.2 씩, 걸음당 12 까지.
     압력은 점령에서만 오르므로(망만으로는 점령이 안 난다) 이 번짐은 스스로 굴러가지 않는다 */
  spread: { from_pressure: 75, base: 50, rate: 0.2, cap: 12 },
  /* 필드 보스 → 권역 거점: 보스가 살아 있는 동안 그 거점에 걸음당 위협 +6, 잡히면 −15 (필드 게임이 전략 지도를 움직인다) */
  field: { alive_threat_per_step: 6, kill_threat_drop: 15 },
  field_zones: {
    namsan: ['seoul', 'N01'], namsan_tower: ['seoul', 'N01'], hangang_tunnel: ['seoul', 'N04'], yeouido: ['seoul', 'N07'],
    gangnam_b1: ['seoul', 'N02'], gangnam_b2: ['seoul', 'N02'], pangyo_lab: ['gyeonggi', 'GG05'], southroad: ['gyeonggi', 'GG02'],
    gyeryong_base: ['chungnam', 'CN04'], goheung: ['jg_special', 'JG05'], goheung_pad: ['jg_special', 'JG05'],
  },
};
fs.writeFileSync(path.join(OUT, 'korea.json'), JSON.stringify(korea, null, 1) + '\n');
console.log('권역 파일', written.length + 1, '(서울 손으로 + ' + written.length + ' 생성) · korea.json 권역', korea.regions.length, '회랑', korea.corridors.length);
