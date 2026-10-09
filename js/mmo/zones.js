/* 황혼 2D 맵 MMORPG — 지역(존·던전) 목록 (docs/design/185 §3, §6.7 · 186)
   던전도 인스턴스가 아니다 — 모든 플레이어가 공유하는 지역. 보스는 전부 공유 필드 보스(주기 출현) (디렉터 2026-10-06)
   한 곳에서 모든 지역의 이름·종류·장면 빌더·OSM 원본·문 짝·보스 자리·규칙을 정한다.
   굽기(tools/2d/bake-map.html)와 시험(tests/zones-gates.test.cjs)이 이 표를 읽는다.
   리니지처럼: 필드(실측 OSM) + 던전 층마다 별도 지역 + 문으로 잇는다 (문서 186 §2, §6).
   좌표: 실내는 길 좌표 (s, t) — s 화면 대각선 오른쪽 위 +, t 화면 위(먼 쪽) + , 단위 m.
   원작 줄 번호(L…)는 docs/story/source/제1부_통합본_EP01-28.md */

import { AUTO } from './zones-auto.js';
import { applyLinks } from './zone-links.js';

const M = 'art/3d/part1/';
export const ZONES = {
  /* ================= 1. 강남 벙커 (허브 · 안전지대) — 문서 152·155, 원작 L251~L660 ================= */
  bunker: { title: '강남 벙커', kind: 'hub', env: 'indoor', px: 100, rules: { safe: true, mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' },
    spawn: { room: 'core', u: 0.5, v: 0.35 },
    gates: [ { id: 'out', room: 'vault', u: 0.35, v: 0.5, to: { zone: 'gangnam', gate: 'bunker' }, label: '출격문 · 강남대로', kind: 'zone' } ],
    indoor: { seed: 152, theme: { wall: '#3a3834', stripe: 'rgba(160,120,60,.3)', floor: 'concrete', h: 4.2, light: 'warm', hemiI: 2.4, flicker: null },
      rooms: [
        /* 8각 공용 코어 (지름 18 m) — 한 장인 작업대, 드럼통 불, 빨래 (L261, L295) */
        { id: 'core', s: [-9, 9], t: [-9, 9], h: 7, light: 'warm', lightStep: 8, props: [ { k: 'forge', u: 0.5, v: 0.55 }, { k: 'drums', n: 3, fire: true }, { k: 'laundry', n: 3 }, { k: 'crates', n: 5 } ] },
        /* 북: 마태오 직무실 */
        { id: 'office', s: [-5, 5], t: [9, 17], light: 'warm', props: [ { k: 'table', u: 0.5, v: 0.5 }, { k: 'shelves', n: 2, along: true } ] },
        /* 북서: 인력사무소 — CRT 벽(절반은 죽음), 홀로그램 테이블, 사슬 묶인 허수아비 (L578~L642) */
        { id: 'agency', s: [-21, -9], t: [5, 17], light: 'blue', props: [ { k: 'crt' }, { k: 'table', u: 0.5, v: 0.45, glow: true }, { k: 'dummy', u: 0.15, v: 0.2 } ] },
        /* 북동: 지하 훈련장 — 낡은 매트, 깨진 형광등 (L658) */
        { id: 'training', s: [9, 23], t: [5, 19], floor: 'mat', light: 'fluo', props: [ { k: 'dummy', u: 0.5, v: 0.55 }, { k: 'debris', n: 3 } ] },
        /* 동: 평가소 — 유진, 늘 줄 (L393, L8777) */
        { id: 'eval', s: [9, 19], t: [-5, 5], light: 'fluo', props: [ { k: 'consoles', rows: [0.6] } ] },
        /* 남동: 보급고·배급 (수희 «한 사람당 두 통!» L279) */
        { id: 'supply', s: [9, 21], t: [-17, -5], light: 'warm', props: [ { k: 'shelves', n: 5 }, { k: 'crates', n: 6 } ] },
        /* 남: 의무실 — 물 자국 (L4624) */
        { id: 'medic', s: [-5, 5], t: [-17, -9], floor: 'tile', light: 'fluo', props: [ { k: 'cots', n: 4 }, { k: 'lockers' } ] },
        /* 서: B-2 통로 (막힘 — 셔터) */
        { id: 'west', s: [-17, -9], t: [-3, 3], light: 'red', props: [ { k: 'shutters', side: 'far', u: 0.2, w: 5 } ] },
        /* 남서: 외부 통로 — 실종자 벽보 수백 장 (L285) */
        { id: 'hall', s: [-30, -9], t: [-9, -3], light: 'warm', props: [ { k: 'posters' }, { k: 'drums', n: 2, fire: true } ] },
        /* 출격문 B-1 원형 금고문 (지름 4.8 m, «거대한 철문… 위로 올라갔다» L1080) */
        { id: 'vault', s: [-42, -30], t: [-12, 0], h: 6, light: 'red', props: [ { k: 'vault', u: 0.5, side: 'far' }, { k: 'sign', text: '강남역 지하상가 출격문', u: 0.5, y: 5.4, w: 6 } ] } ] } },

  /* ================= 2. 강남대로 (필드) · 지하상가 B1 · 2호선 B2 ================= */
  gangnam: { title: '강남대로', kind: 'field', env: 'osm', osm: 'gangnam', px: 90, rules: { mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' },
    /* 하위 구역 (문서 190 §4) — 길 좌표 s·t. 사각형 {s:[a,b], t:[c,d]} 또는 원 {st:[s,t], r} · kind 'hunt'(기본)·'rest' · danger 1~3 */
    hunts: [ { id: 'avenue', name: '대로 한복판', s: [-310, 55], t: [-12, 43], lv: [1, 4], mobs: '쇼윈도 리퍼' },
             { id: 'blocks', name: '무너진 이면 블록', s: [-310, 55], t: [-177, -12], lv: [4, 8], mobs: '쇼윈도 리퍼 · 감염체', danger: 2 },
             { id: 'cross', name: '강남역 사거리', st: [0, 15], r: 28, lv: [6, 10], mobs: '광장의 감염체', danger: 2 } ],
  },
  gangnam_b1: { title: '강남역 지하상가 B1', kind: 'dungeon', env: 'dungeon', osm: 'gangnam', px: 120, rules: { escape: false }, restart: { zone: 'bunker', gate: 'out' } },
  /* 2호선 침수 선로 — 광장 바로 밑, 수위 가슴 (L3344~L3350). 클레이브 마무리 (EP03) */
  gangnam_b2: { title: '2호선 침수 선로', kind: 'dungeon', env: 'indoor', px: 90, rules: { escape: false }, restart: { zone: 'bunker', gate: 'out' },
    spawn: { room: 'stairs', u: 0.5, v: 0.5 },
    gates: [ { id: 'up', room: 'stairs', u: 0.4, v: 0.5, to: { zone: 'gangnam_b1', gate: 'b2' }, label: '지하상가 B1 · 계단', kind: 'zone' } ],
    bosses: [ { id: 'clave2', name: '클레이브', title: '셔터 끄는 놈 · 마무리', room: 'track', u: 0.62, v: 0.5, r: 14, model: M + 'clave.glb', h: 3.2, place: '선로 한가운데', canon: 'EP03 2호선 침수 선로' } ],
    indoor: { seed: 3, water: 1.15, theme: { wall: '#2e3438', stripe: 'rgba(60,160,90,.4)', floor: 'terrazzo', h: 5, light: 'fluo', flicker: { on: 3, off: 1 }, hemiI: 1.8 },
      rooms: [
        { id: 'stairs', s: [-70, -56], t: [8, 16], props: [ { k: 'stairs', side: 's0' }, { k: 'sign', text: '2호선 · 강남', u: 0.6, color: '#40d880' } ] },
        { id: 'platform', s: [-56, 56], t: [5, 13], floor: 'tile', props: [ { k: 'platform', t: 5.4 }, { k: 'pillars', step: 10 }, { k: 'sign', text: '잠시 후 열차가 도착합니다', u: 0.5, color: '#ff8a30', w: 6 } ] },
        { id: 'track', s: [-60, 60], t: [-7, 5], floor: 'gravel', light: 'red', lightStep: 14, props: [ { k: 'rails', t: [-3.5, 1.5] }, { k: 'debris', n: 10 }, { k: 'scratches', n: 2 } ] },
        { id: 'tunnelW', s: [-76, -60], t: [-7, 5], floor: 'gravel', light: 'none', props: [ { k: 'rails', t: [-3.5, 1.5] }, { k: 'shutters', side: 'far', u: 0.3 } ] },
        { id: 'tunnelE', s: [60, 76], t: [-7, 5], floor: 'gravel', light: 'none', props: [ { k: 'rails', t: [-3.5, 1.5] } ] } ] } },

  /* ================= 3. 남산 (필드) · 남산타워 하부 ================= */
  namsan: { title: '남산 · 케이블카 길', kind: 'field', env: 'namsan', osm: 'namsan', px: 90, rules: { mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' },
    hunts: [ { id: 'cable', name: '케이블카 길', s: [-45, 732], t: [-20, 20], lv: [10, 13], mobs: '케이블카 드로퍼' },
             { id: 'slopeN', name: '북쪽 숲 비탈', s: [-45, 732], t: [20, 70], lv: [12, 16], mobs: '(가안)', danger: 2 },
             { id: 'slopeS', name: '남쪽 숲 비탈', s: [-45, 732], t: [-80, -20], lv: [12, 16], mobs: '(가안)', danger: 2 } ],
  },
  /* 타워 하부 — 옛 식당·기념품점, 깨진 유리, 습기로 부푼 벽지, 네 줄 긁힘 (L4995~L5025). 지하 3층 «국방부» 철문 → 통신실 (L5103~) */
  namsan_tower: { title: '남산타워 하부', kind: 'dungeon', env: 'indoor', px: 100, rules: { escape: false }, restart: { zone: 'bunker', gate: 'out' },
    spawn: { room: 'entry', u: 0.5, v: 0.4 },
    gates: [ { id: 'out', room: 'entry', u: 0.5, v: 0.3, to: { zone: 'namsan', gate: 'tower' }, label: '타워 광장', kind: 'zone' } ],
    bosses: [ { id: 'dropper', name: '케이블카 드로퍼', title: '천장에서 떨어지는 넷', room: 'hall', u: 0.5, v: 0.5, r: 12, model: null, h: 2.6, place: '옛 식당', canon: 'EP05 남산타워 하부' } ],
    indoor: { seed: 5, theme: { wall: '#4a4440', stripe: 'rgba(140,110,80,.3)', floor: 'tile', h: 4.5, light: 'warm' },
      rooms: [
        { id: 'entry', s: [-8, 8], t: [-26, -14], props: [ { k: 'debris', n: 5 } ] },
        { id: 'hall', s: [-16, 16], t: [-14, 14], h: 6, props: [ { k: 'table', u: 0.25, v: 0.3 }, { k: 'table', u: 0.7, v: 0.65 }, { k: 'table', u: 0.3, v: 0.75 }, { k: 'crates', n: 4 }, { k: 'scratches', n: 3, lines: 4 }, { k: 'pillars', step: 14 } ] },
        { id: 'shop', s: [16, 30], t: [-6, 10], light: 'red', props: [ { k: 'shelves', n: 4 }, { k: 'debris', n: 4 } ] },
        { id: 'down', s: [-24, -16], t: [-2, 4], light: 'red', props: [ { k: 'sign', text: '국방부', u: 0.5, color: '#d83a2a', w: 3 } ] },
        { id: 'comms', s: [-44, -24], t: [-8, 10], floor: 'metal', light: 'green', props: [ { k: 'consoles', rows: [0.3, 0.7] }, { k: 'lockers' } ] } ] } },

  /* ================= 4. 여의도 — 공동구 · 지하주차장 (던전) → 금융가 협곡 (필드) ================= */
  /* 공동구 «콘크리트 원통… 지름 2미터… 물이 발목까지… 케이블 다발» (L5976) — 위에서 보는 화면이라 폭 4 m 로. 주차장 «B3… B2, B1» 경사로 (L6008) */
  yeouido_ug: { title: '여의도 공동구 · 지하주차장', kind: 'dungeon', env: 'indoor', px: 90, rules: { escape: false }, restart: { zone: 'bunker', gate: 'out' },
    spawn: { room: 'shaft', u: 0.5, v: 0.5 },
    gates: [ { id: 'namsan', room: 'shaft', u: 0.4, v: 0.5, to: { zone: 'namsan', gate: 'yeouido' }, label: '남산 · 공동구 입구', kind: 'zone' },
             { id: 'up', room: 'ramp', u: 0.7, v: 0.5, to: { zone: 'yeouido', gate: 'parking' }, label: '지하주차장 B1 · 여의도 지상', kind: 'zone' } ],
    indoor: { seed: 6, water: 0.18, theme: { wall: '#4a4e50', stripe: 'rgba(200,180,60,.45)', floor: 'concrete', h: 3.2, light: 'red', hemiI: 2.4 },
      rooms: [
        { id: 'shaft', s: [-12, 0], t: [-5, 5], light: 'warm', props: [ { k: 'stairs', side: 's0' }, { k: 'winch', u: 0.7, v: 0.8 } ] },
        { id: 'duct1', s: [0, 120], t: [-2, 2], lightStep: 12, props: [ { k: 'pipes', n: 3 } ] },
        { id: 'junction', s: [120, 132], t: [-8, 8], props: [ { k: 'pipes', n: 2 }, { k: 'sign', text: '여의도 공동구 계통도 / 2021', u: 0.5, color: '#d8d8c8', w: 5 } ] },
        { id: 'duct2', s: [132, 200], t: [-2, 2], lightStep: 12, props: [ { k: 'pipes', n: 3 } ] },
        { id: 'b3', s: [200, 252], t: [-18, 18], h: 3.4, light: 'fluo', lightStep: 10, props: [ { k: 'pillars', step: 8 }, { k: 'parking', cars: 0.45 }, { k: 'sign', text: 'B3', u: 0.1, color: '#ffd23a', w: 2 } ] },
        { id: 'ramp', s: [252, 276], t: [6, 14], floor: 'asphalt', light: 'fluo', props: [ { k: 'sign', text: 'B2 · B1 출구 ↗', u: 0.5, color: '#40d880', w: 4 } ] } ] } },
  /* 금융가 «빌딩 협곡» — 여의대로를 따라 먼 쪽에 IFC·파크원·콘래드가 벽처럼 선다. 안개 «가시거리 스무 걸음», 젖은 아스팔트, 3층 높이 LED 광고판 (L6012~L6030)
     OSM: ORIGIN=37.5250,126.9260 AXIS=여의대로 (여의대로 중심 t ≈ −150) */
  yeouido: { title: '여의도 금융가', kind: 'field', env: 'field', osm: 'yeouido', px: 90, rules: { mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' },
    hunts: [ { id: 'canyon', name: '여의대로 빌딩 협곡', s: [-320, 320], t: [-190, -106], lv: [18, 21], mobs: '(가안)' },
             { id: 'park', name: '여의도공원 터', s: [-320, 320], t: [-330, -190], lv: [20, 25], mobs: '(가안)', danger: 2 } ],
    /* 넓게 (디렉터 2026-10-06 «필드를 넓게») — 카메라 쪽(화면 아래)으로 넓혀 먼 쪽 풍경은 그대로. 걷는 구역 안 건물은 무너진 저층 */
    field: { seed: 6012, tc: -150, cutT: -330, walk: { s0: -320, s1: 320, t0: -330, t1: -106 }, ground: 'paver', curtain: true, extentH: 44, ruin: { h: [5, 11] },
      dress: { urban: true, logs: false, patches: ['concrete', 'sand', 'asphalt'], bushColors: [0x2e3428, 0x3a3428, 0x2a2a26] },
      sky: { fog: '#3e3644', hemiI: 3.0, sunI: 3.2 },
      trees: { density: 0.35, inBand: 0.1, pine: 0.1 }, cars: { gap: 0.6, trucks: 0.05 }, crystals: 30, lampStep: 30, lampT: -183,
      boundary: { style: 'urban', closed: { s0: '통제구역 — 안개', s1: '통제구역 — 안개' } },
      gates: [ { id: 'parking', at: { end: 's0', t: -150 }, to: { zone: 'yeouido_ug', gate: 'up' }, label: '지하주차장 · 공동구', kind: 'dungeon' } ],
      bosses: [ { id: 'aegis', name: '에이지스-07', title: '보이지 않는 벽', at: { st: [40, -150] }, r: 22, model: M + 'aegis_07_static.glb', h: 4, place: '빌딩 협곡', canon: 'EP06~07 여의도 빌딩 협곡' } ],
      mist: { y: 0.7, opacity: 0.24 },   /* 넓힌 뒤 밝은 공원 바닥 위에서 0.38 은 화면이 통째로 바랬다. 안개는 굽지 않는다(그림이 통째로 뿌옇고 판 이음매가 보였다) — 게임이 무릎 높이에 그린다 (EP07 «안개가 무릎 위로 트이고» L6732) */
      props: [ { k: 'led', at: { st: [-150, -112] }, text: '여의도' }, { k: 'led', at: { st: [190, -112] }, text: 'IFC' } ] } },

  /* ================= 5. 한강 침수 터널 (던전) — 입구 300 m부터 수몰, 600 m 차수문 3-B (L7376~L8109) ================= */
  hangang_tunnel: { title: '한강 침수 터널', kind: 'dungeon', env: 'indoor', px: 90, rules: { escape: false }, restart: { zone: 'bunker', gate: 'out' },
    spawn: { room: 'mouth', u: 0.3, v: 0.5 },
    gates: [ { id: 'out', room: 'mouth', u: 0.2, v: 0.5, to: { zone: 'namtae', gate: 'tunnel' }, label: '터널 입구 · 남태령', kind: 'zone' } ],
    bosses: [ { id: 'leviathan', name: '레비아탄', title: '가두어야 하는 놈', room: 'flood', u: 0.82, v: 0.5, r: 16, model: M + 'leviathan_static.glb', h: 3.5, place: '차수문 3-B', canon: 'EP08~09 차수문 3-B' } ],
    indoor: { seed: 8, water: 1.2, theme: { wall: '#2a3034', stripe: 'rgba(40,140,160,.35)', floor: 'concrete', h: 7, light: 'red', hemiI: 1.4 },
      rooms: [
        { id: 'mouth', s: [0, 24], t: [-9, 9], light: 'warm', props: [ { k: 'winch', u: 0.7, v: 0.75 }, { k: 'pillars', step: 12 }, { k: 'debris', n: 5 } ] },
        { id: 'bore', s: [24, 260], t: [-6, 6], lightStep: 16, props: [ { k: 'pipes', n: 2 }, { k: 'debris', n: 12 } ] },
        { id: 'flood', s: [260, 360], t: [-8, 8], lightStep: 14, props: [ { k: 'gate', u: 0.9 }, { k: 'debris', n: 8 } ] },
        { id: 'mechIn', s: [300, 316], t: [8, 20], h: 4, floor: 'metal', light: 'red', props: [ { k: 'machines', n: 3 }, { k: 'sign', text: '내측 기계실', u: 0.5, color: '#d83a2a', w: 3 } ] },
        { id: 'mechOut', s: [340, 356], t: [-20, -8], h: 4, floor: 'metal', light: 'red', props: [ { k: 'machines', n: 3 } ] } ] } },

  /* ================= 6. 남태령 · 국도 (필드 전용) ================= */
  /* «왕복 8차선… 차간 거리를 지킨 채» · «요금소의 차단기… 하이패스 표지판» (원작 디테일 — 이 구간 실제 요금소는 없다) · 가드레일 낚싯줄 깡통 경보 (L8291~L8329)
     능선 위 철탑 + 낮은 콘크리트 건물(중계소 L8530) · 고개 아래 폐주유소(L8594) · 과천 쪽 폐차장(L8751)
     OSM: ORIGIN=37.4640,126.9890 AXIS=과천대로 · +s = 북쪽(사당·강남), −s = 남쪽(과천·판교), 과천대로 t ≈ 55~100 로 굽는다 */
  namtae: { title: '남태령 · 국도', kind: 'field', env: 'field', osm: 'namtae', px: 90, rules: { mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' },
    hunts: [ { id: 'road', name: '과천대로 · 차량 무덤', s: [-220, 300], t: [40, 110], lv: [30, 32], mobs: '탈영병' },
             { id: 'ridge', name: '능선 숲', s: [-220, 300], t: [110, 190], lv: [32, 35], mobs: '방호복 병사', danger: 2 },
             { id: 'low', name: '고개 아래 숲', s: [-220, 300], t: [-60, 40], lv: [30, 33], mobs: '탈영병', danger: 1 },
             { id: 'gas', name: '폐주유소 터', st: [-150, 112], r: 26, lv: [33, 35], mobs: '클레이브 둘', danger: 3 },
             { id: 'scrap', name: '과천 쪽 폐차장', st: [-170, 40], r: 30, lv: [32, 34], mobs: '탈영병 무리', danger: 2 },
             { id: 'relay', name: '능선 중계소', kind: 'rest', st: [160, 132], r: 14 } ],
    /* 넓게 (디렉터 2026-10-06 «필드를 넓게»): 띠 94 m → 250 m (카메라 쪽 −t 와 먼 쪽 +t 양쪽). 걷는 구역 안 건물은 무너진 저층, 가려진 인물은 실루엣(mmo.html) */
    field: { seed: 8291, tc: 75, cutT: -60, walk: { s0: -220, s1: 300, t0: -60, t1: 190 }, ground: 'forest', extentH: 26, ruin: { h: [4.5, 9] }, dress: { logs: true },
      trees: { density: 0.8, inBand: 0.22, pine: 0.45, dead: 0.15 }, cars: { gap: 0.4, trucks: 0.14 }, crystals: 12, lampStep: 40, lampT: 32,
      boundary: { style: 'fence', closed: { s0: '과천 · 판교 방면', s1: '사당 · 강남 방면' } },
      gates: [ { id: 'north', at: { end: 's1', t: 85 }, to: { zone: 'gangnam', gate: 'south' }, label: '강남 방면 · 사당', kind: 'zone' },
               { id: 'south', at: { end: 's0', t: 85 }, to: { zone: 'pangyo', gate: 'north' }, label: '판교 방면 · 과천', kind: 'zone' },
               { id: 'tunnel', at: { st: [-40, 112] }, to: { zone: 'hangang_tunnel', gate: 'out' }, label: '침수 터널 입구', kind: 'dungeon' } ],
      props: [ { k: 'toll', at: { st: [90, 78] }, w: 36 }, { k: 'relay', at: { st: [160, 132] }, h: 42 }, { k: 'gas', at: { st: [-150, 112] } },
               { k: 'scrap', at: { st: [-170, 40] }, r: 26, n: 28 }, { k: 'maw', at: { st: [-40, 122] }, label: '배수 터널' },
               { k: 'guardrail', at: { st: [40, 36] }, len: 480 }, { k: 'guardrail', at: { st: [40, 116] }, len: 480 } ] } },

  /* ================= 7. 판교 연구단지 (필드) · 연구소 지하 (던전) ================= */
  /* «건물이 온전했다… 화단의 나무가 인도를 덮고… 정리하고 떠난 자리» (L9550~L9554). 봉인 건물 = 세 번째 건물, 유리문에 «지하 3층 봉인» A4 (L9572)
     OSM: ORIGIN=37.4010,127.1080 AXIS=판교역로 · 먼 쪽 = 남쪽(연구동) → farSide osm [0,-1] 로 뒤집는다 (판교역로 t ≈ −149) */
  pangyo: { title: '판교 연구단지', kind: 'field', env: 'field', osm: 'pangyo', px: 90, rules: { mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' },
    hunts: [ { id: 'avenue', name: '판교역로 연구동', s: [-300, 300], t: [-178, -110], lv: [35, 37], mobs: '(가안)' },
             { id: 'ruins', name: '무너진 연구 블록', s: [-300, 300], t: [-320, -178], lv: [37, 40], mobs: '(가안)', danger: 2 } ],
    /* 넓게 (디렉터 2026-10-06 «필드를 넓게») — 카메라 쪽(화면 아래)으로 넓혀 먼 쪽 풍경은 그대로. 걷는 구역 안 건물은 무너진 저층 */
    field: { seed: 9550, farSide: { osm: [0, -1] }, tc: -149, cutT: -320, walk: { s0: -300, s1: 300, t0: -320, t1: -110 }, ground: 'paver', curtain: true, extentH: 30, ruin: { h: [5, 10] },
      dress: { urban: true, logs: false, patches: ['grass', 'concrete', 'forest'] },
      sky: { hemiI: 3.2 }, trees: { density: 0.85, inBand: 0.2, pine: 0.15, leaves: [0x2c3a26, 0x3a4a2a, 0x34402a, 0x4a3e2c] }, cars: { gap: 0.7 }, crystals: 10, lampStep: 28, lampT: -175,
      boundary: { style: 'urban', closed: { s0: '남태령 방면', s1: '남쪽 국도 방면' } },
      gates: [ { id: 'north', at: { end: 's0', t: -144 }, to: { zone: 'namtae', gate: 'south' }, label: '남태령 방면', kind: 'zone' },
               { id: 'lab', at: { st: [-29, -128] }, to: { zone: 'pangyo_lab', gate: 'out' }, label: '봉인 건물 · 연구소 지하', kind: 'dungeon' },
               { id: 'south', at: { end: 's1', t: -144 }, to: { zone: 'southroad', gate: 'north' }, label: '남쪽 국도 · 물류창고 방면', kind: 'zone' } ],
      props: [ { k: 'sign', at: { gate: 'lab', ds: 4.5, dt: 0 }, text: '내부 인원 전원 대피 완료. 지하 3층 봉인.', y: 1.6, w: 6, bg: '#e8e4d8', edge: '#8a8070', fg: '#2a2a2a' } ] } },
  /* «지하 3층 봉인» (L9572). 로비 파티션·유리를 미는 나무(EP15), B2 시약 창고, B3 «폭 2인분» 계단 병목 (147 §4~5) */
  pangyo_lab: { title: '판교 연구소 지하', kind: 'dungeon', env: 'indoor', px: 100, rules: { escape: false }, restart: { zone: 'bunker', gate: 'out' },
    spawn: { room: 'lobby', u: 0.2, v: 0.5 },
    gates: [ { id: 'out', room: 'lobby', u: 0.1, v: 0.5, to: { zone: 'pangyo', gate: 'lab' }, label: '판교 · 1층 로비 밖', kind: 'zone' } ],
    bosses: [ { id: 'subject09', name: '실험체 09호', title: '나뉘는 것', room: 'b3', u: 0.55, v: 0.5, r: 13, model: M + 'subject_09.glb', h: 3.4, place: '지하 3층 봉인실', canon: 'EP14~15 판교 연구소' } ],
    indoor: { seed: 14, theme: { wall: '#c8ccd0', stripe: 'rgba(60,140,200,.4)', floor: 'tile', h: 4, light: 'fluo', hemiI: 2.0 },
      rooms: [
        { id: 'lobby', s: [0, 30], t: [-12, 12], h: 6, props: [ { k: 'partitions', n: 7 }, { k: 'trees', n: 4 }, { k: 'sign', text: '내부 인원 전원 대피 완료. 지하 3층 봉인.', u: 0.5, color: '#2a2a2a', bg: '#e8e4d8', font: 30, w: 6 } ] },
        { id: 'stair', s: [30, 38], t: [-1.6, 1.6], light: 'red', props: [] },
        { id: 'b2', s: [38, 62], t: [-10, 10], props: [ { k: 'shelves', n: 8 }, { k: 'drums', n: 4 } ] },
        { id: 'neck', s: [62, 70], t: [-1.6, 1.6], light: 'red', props: [ { k: 'debris', n: 2 } ] },
        { id: 'b3', s: [70, 100], t: [-13, 13], h: 5, light: 'green', props: [ { k: 'consoles', rows: [0.85] }, { k: 'debris', n: 8 }, { k: 'scratches', n: 2 } ] } ] } },

  /* ================= 8. 남행 국도 · 골짜기 (필드) ================= */
  /* 남행 길가에 코어가 도려내진 집행관 사체, 무음 지대 (L10659~L10667) · «인계 지점 추정 1호는 낡은 물류창고였고, 그 앞마당은 전장» — 뒤집힌 수레, 속 빈 방호복 (L10681)
     골짜기: 다섯이 «골짜기 벽을 등지고» (L11112) — 셀레스티얼 격파. 원작에 지명이 없어 판교 남쪽 경부축 물류 골짜기 중 용인 양지(중부대로)를 골랐다
     OSM: ORIGIN=37.2350,127.2875 AXIS=중부대로 (중부대로 t ≈ 175) */
  southroad: { title: '남행 국도 · 골짜기', kind: 'field', env: 'field', osm: 'southroad', px: 90, rules: { mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' },
    hunts: [ { id: 'road', name: '중부대로 남행길', s: [-300, 300], t: [140, 222], lv: [40, 42], mobs: '(가안)' },
             { id: 'yard', name: '물류창고 앞마당', st: [-120, 205], r: 30, lv: [43, 45], mobs: '(가안)', danger: 3 },
             { id: 'valley', name: '골짜기 숲', s: [-300, 300], t: [-10, 140], lv: [41, 45], mobs: '(가안)', danger: 2 } ],
    /* 넓게 (디렉터 2026-10-06 «필드를 넓게») — 카메라 쪽(화면 아래)으로 넓혀 먼 쪽 풍경은 그대로. 걷는 구역 안 건물은 무너진 저층 */
    field: { seed: 10681, tc: 175, cutT: -10, jams: [ { st: [-42, 180], hw: 5, hd: 5 } ], walk: { s0: -300, s1: 300, t0: -10, t1: 222 }, ground: 'forest', extentH: 22, ruin: { h: [4.5, 9] }, dress: { logs: true },
      sky: { hemiI: 3.2, sunAlt: 12 }, trees: { density: 0.8, inBand: 0.2, pine: 0.4, dead: 0.3 }, cars: { gap: 0.6, trucks: 0.35 }, crystals: 28, lampStep: 36, lampT: 141,
      boundary: { style: 'fence', closed: { s0: '판교 방면', s1: '계룡 방면 · 직선 백사십 킬로' } },
      gates: [ { id: 'north', at: { end: 's0', t: 178 }, to: { zone: 'pangyo', gate: 'south' }, label: '판교 방면', kind: 'zone' },
               { id: 'south', at: { end: 's1', t: 178 }, to: { zone: 'gyeryong', gate: 'north' }, label: '계룡 방면', kind: 'zone' } ],
      bosses: [ { id: 'shadowfang', name: '섀도우 팽', title: '소리가 오다가 죽는다', at: { st: [-120, 200] }, r: 20, model: M + 'shadow_fang.glb', h: 1.6, place: '물류창고 앞마당', canon: 'EP16 물류창고 앞마당' },
                { id: 'celestial2', name: '셀레스티얼', title: '날개 넷 · 격파', at: { st: [200, 190] }, r: 20, model: M + 'celestial_static.glb', h: 5.4, fly: 3.4, place: '골짜기', canon: 'EP17 골짜기' } ],
      props: [ { k: 'warehouse', at: { st: [-120, 240] }, w: 70, d: 30, h: 13, label: '물류센터 · 인계 지점 1호' } ] } },

  /* ================= 9. 계룡 (필드: 외곽 능선) · 산 속 격납고 (던전) — 실재 시설은 그리지 않는다 ================= */
  /* «능선 아래로 분지… 군의 심장이던 땅» · 질서 있는 불빛, 초소, 철책선 (L12416~L12420) · «산 밑동을 파고든 거대한 아가리», 남태령과 같은 스텐실 (L12462~L12468)
     OSM: ORIGIN=36.2680,127.2135 (계룡시 서쪽 산자락 도곡로 — 실재 군 시설이 아닌 곳). 철책·관문은 원작 창작이다 */
  gyeryong: { title: '계룡 · 외곽 능선', kind: 'field', env: 'field', osm: 'gyeryong', px: 90, rules: { mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' },
    hunts: [ { id: 'fence', name: '철책선 아래', s: [-230, 230], t: [40, 100], lv: [48, 52], mobs: '정비창 기계들', danger: 2 },
             { id: 'ridge', name: '외곽 능선 숲', s: [-230, 230], t: [-170, 40], lv: [45, 49], mobs: '(가안)' } ],
    /* 넓게 (디렉터 2026-10-06 «필드를 넓게») — 카메라 쪽(화면 아래)으로 넓혀 먼 쪽 풍경은 그대로. 걷는 구역 안 건물은 무너진 저층 */
    field: { seed: 12416, tc: 20, cutT: -170, walk: { s0: -230, s1: 230, t0: -170, t1: 100 }, ground: 'forest', extentH: 26, ruin: { h: [4.5, 9] }, dress: { logs: true },
      sky: { hemiI: 3.6, sunAlt: 13, sunI: 4.6 }, trees: { density: 0.9, inBand: 0.22, pine: 0.55, dead: 0.2 }, crystals: 22, lampStep: 60, lampT: -26,
      boundary: { style: 'fence', closed: { s0: '고흥 방면 · 남해', s1: '남행 국도 방면' } },
      gates: [ { id: 'north', at: { end: 's1', t: 25 }, to: { zone: 'southroad', gate: 'south' }, label: '남행 국도 방면', kind: 'zone' },
               { id: 'south', at: { end: 's0', t: 25 }, to: { zone: 'goheung', gate: 'north' }, label: '고흥 방면 · 남해', kind: 'zone' },
               { id: 'base', at: { st: [60, 84] }, to: { zone: 'gyeryong_base', gate: 'out' }, label: '관문 · 산 속 격납고', kind: 'dungeon' } ],
      props: [ { k: 'milfence', at: { st: [-70, 90] }, len: 270 }, { k: 'milfence', at: { st: [170, 90] }, len: 110 }, { k: 'maw', at: { st: [60, 96] }, label: '제03수거대' } ] } },
  /* «산 밑동을 파고든 거대한 아가리» → 경사로(차 두 대 폭, 세 번 꺾임, 유도등 초록 점선) → 정비창 → 주 격납고(축구장 몇 개, 십수 층) · 소독약 복도 · 표본 보관실 (L12462~L13402) */
  gyeryong_base: { title: '계룡 · 산 속 격납고', kind: 'dungeon', env: 'indoor', px: 80, rules: { escape: false }, restart: { zone: 'bunker', gate: 'out' },
    spawn: { room: 'mouth', u: 0.3, v: 0.5 },
    gates: [ { id: 'out', room: 'mouth', u: 0.15, v: 0.5, to: { zone: 'gyeryong', gate: 'base' }, label: '계룡 · 관문 밖', kind: 'zone' } ],
    bosses: [ { id: 'arsenal', name: '아스널 오버로드', title: '포탑 열여덟', room: 'hangar', u: 0.6, v: 0.5, r: 30, model: M + 'arsenal_overlord_static.glb', h: 10, place: '주 격납고', canon: 'EP21~22 주 격납고' },
              { id: 'park', name: '박 준장', title: '소독약 냄새', room: 'corridor', u: 0.6, v: 0.5, r: 10, model: null, h: 1.9, place: '소독약 복도', canon: 'EP23' } ],
    indoor: { seed: 21, theme: { wall: '#3a3c38', stripe: 'rgba(80,200,120,.35)', floor: 'concrete', h: 6, light: 'green', hemiI: 1.6 },
      rooms: [
        { id: 'mouth', s: [0, 20], t: [-10, 10], h: 9, light: 'warm', props: [ { k: 'debris', n: 4 } ] },
        { id: 'ramp1', s: [20, 80], t: [-3.5, 3.5], floor: 'asphalt', lightStep: 6, props: [] },
        { id: 'bend1', s: [80, 88], t: [-3.5, 20], floor: 'asphalt', lightStep: 6, props: [] },
        { id: 'ramp2', s: [88, 140], t: [13, 20], floor: 'asphalt', lightStep: 6, props: [] },
        { id: 'shop', s: [140, 176], t: [4, 30], h: 8, floor: 'metal', light: 'fluo', props: [ { k: 'machines', n: 8 }, { k: 'shelves', n: 3 } ] },
        { id: 'hangar', s: [176, 300], t: [-30, 40], h: 30, light: 'fluo', lightStep: 18, props: [ { k: 'vehicles', n: 30 }, { k: 'pillars', step: 30, mat: 'steel' }, { k: 'crates', n: 14 } ] },
        { id: 'corridor', s: [300, 350], t: [2, 6], h: 3.4, floor: 'tile', light: 'fluo', props: [] },
        { id: 'specimen', s: [350, 380], t: [-11, 19], h: 9, floor: 'tile', light: 'green', props: [ { k: 'capsules', n: 14 }, { k: 'table', u: 0.5, v: 0.5 } ] } ] } },

  /* ================= 10. 고흥 발사장 (필드) · 발사대 갱도 (던전) ================= */
  /* «반도의 끝… 우주센터의 흰 구조물들, 조립동의 거대한 상자… 바다를 등지고 선 발사대의 탑» (L14048~L14058) · 외곽 철책과 초소, 의장대, 점거 차량의 열 (L14070~L14086)
     OSM: ORIGIN=34.4318,127.5350 (나로우주센터 발사대) — 실측은 성기다(건물 31, 업무용 길). 원작 이름은 «고흥»·«노바 1호» 뿐 («나로» 라고 쓰지 않는다)
     +t = 남쪽(바다), s0 쪽 끝 = 서쪽 해안 */
  goheung: { title: '고흥 발사장', kind: 'field', env: 'field', osm: 'goheung', px: 90, rules: { mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' },
    hunts: [ { id: 'road', name: '발사장 도로', s: [-240, 150], t: [-20, 115], lv: [55, 60], mobs: '집행관 의장대', danger: 3 },
             { id: 'yard', name: '조립동 앞 터', s: [-240, 150], t: [-190, -20], lv: [52, 56], mobs: '집행관 의장대', danger: 2 } ],
    /* 넓게 (디렉터 2026-10-06 «필드를 넓게») — 카메라 쪽(화면 아래)으로 넓혀 먼 쪽 풍경은 그대로. 걷는 구역 안 건물은 무너진 저층 */
    field: { seed: 14048, tc: 0, cutT: -190, walk: { s0: -240, s1: 150, t0: -190, t1: 115 }, ground: 'concrete', extentH: 40, ruin: { h: [5, 10] },
      dress: { urban: true, logs: false, patches: ['sand', 'grass', 'concrete'] },
      sky: { hemiI: 3.0, sunAlt: 10 }, trees: { density: 0.55, inBand: 0.1, pine: 0.6 }, cars: { gap: 0.5, kinds: ['service', 'track'], trucks: 0.3 }, crystals: 14, lampStep: 34, lampT: -46,
      boundary: { style: 'urban', closed: { s0: '해안 — 방파제', s1: '계룡 방면 · 국도' } },
      gates: [ { id: 'north', at: { end: 's1', t: 40 }, to: { zone: 'gyeryong', gate: 'south' }, label: '계룡 방면 · 국도', kind: 'zone' },
               { id: 'pad', at: { st: [-96, -34] }, to: { zone: 'goheung_pad', gate: 'out' }, label: '발사 통제동 · 정비 갱도', kind: 'dungeon' } ],
      bosses: [ { id: 'jeong', name: '정 장관', title: '의장대의 주인', at: { st: [40, 30] }, r: 22, model: M + 'minister_jeong_candidate.glb', h: 1.9, place: '발사장 도로', canon: 'EP26 발사장 도로·활주로' } ],
      props: [ { k: 'launch', at: { st: [-126, 0] }, h: 60 }, { k: 'milfence', at: { st: [-50, 112] }, len: 380 },
               { k: 'warehouse', at: { st: [-10, 96] }, w: 70, d: 34, h: 32, color: 0xe8e8ea, label: '조립동' }, { k: 'warehouse', at: { st: [90, 60] }, w: 30, d: 20, h: 12, color: 0xd8d8dc, label: '발사 통제동' },
               { k: 'scrap', at: { st: [120, 0] }, r: 26, n: 12 }, { k: 'crystals', at: { st: [-150, 40] }, n: 10, r: 14, h: 0.9 },
               { k: 'sign', at: { gate: 'pad', ds: 5, dt: 0 }, text: '노바 1호 · 발사 통제동', y: 2.2, w: 5, bg: '#e8e8ea', edge: '#3a4a6a', fg: '#1a2a4a' } ] } },
  /* 정비 갱도 → 발사대 지하 방 «결정 산이 곧 보스» → 발사대 탑 기저 (주각 4, 트러스) · 발사 통제동 관제실 «의자는 이 년 전의 각도» (L14096~L15043) */
  goheung_pad: { title: '고흥 · 발사대 갱도', kind: 'dungeon', env: 'indoor', px: 90, rules: { escape: false }, restart: { zone: 'bunker', gate: 'out' },
    spawn: { room: 'control', u: 0.3, v: 0.4 },
    gates: [ { id: 'out', room: 'control', u: 0.15, v: 0.5, to: { zone: 'goheung', gate: 'pad' }, label: '고흥 · 발사 통제동 밖', kind: 'zone' } ],
    bosses: [ { id: 'nova', name: '나노-노바 코어', title: '결정 산', room: 'core', u: 0.5, v: 0.5, r: 14, model: M + 'nano_nova_core.glb', h: 6, place: '발사대 지하 방', canon: 'EP27' } ],
    indoor: { seed: 27, theme: { wall: '#3a3e44', stripe: 'rgba(220,220,230,.3)', floor: 'concrete', h: 5, light: 'fluo', hemiI: 1.8 },
      rooms: [
        { id: 'control', s: [0, 28], t: [-10, 10], floor: 'tile', props: [ { k: 'consoles', rows: [0.3, 0.55, 0.8] } ] },
        { id: 'shaft', s: [28, 120], t: [-2.5, 2.5], lightStep: 10, props: [ { k: 'pipes', n: 2 }, { k: 'rails', t: [0] } ] },
        { id: 'core', s: [120, 150], t: [-15, 15], h: 9, light: 'none', props: [ { k: 'crystal', n: 48, center: true, spread: 18, h: 3.6 }, { k: 'debris', n: 5 } ] },
        { id: 'base', s: [150, 180], t: [-12, 18], h: 16, light: 'red', props: [ { k: 'tower', d: 7 } ] } ] } },
};

/* 전국 지역 — tools/2d/new-zone.mjs 가 찍어 낸 것 (docs/design/192 §7). 같은 id 가 위에 있으면 손으로 다듬은 위쪽이 이긴다 */
for (const [id, z] of Object.entries(AUTO)) ZONES[id] ??= z;
applyLinks(ZONES);   /* 전국 길 잇기 — 2단계 13곳까지 문으로 (문서 219) */

export const zoneIds = Object.keys(ZONES);
