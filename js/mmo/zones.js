/* 황혼 2D 맵 MMORPG — 지역(존·던전) 목록 (docs/design/185 §3, §6.7 · 186)
   한 곳에서 모든 지역의 이름·종류·장면 빌더·OSM 원본·문 짝·보스 자리·규칙을 정한다.
   굽기(tools/2d/bake-map.html)와 시험(tests/zones-gates.test.cjs)이 이 표를 읽는다.
   리니지처럼: 필드(실측 OSM) + 던전 층마다 별도 지역 + 문으로 잇는다 (문서 186 §2, §6).
   좌표: 실내는 길 좌표 (s, t) — s 화면 대각선 오른쪽 위 +, t 화면 위(먼 쪽) + , 단위 m.
   원작 줄 번호(L…)는 docs/story/source/제1부_통합본_EP01-28.md */

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
  gangnam: { title: '강남대로', kind: 'field', env: 'osm', osm: 'gangnam', px: 120, rules: { mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' } },
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
  namsan: { title: '남산 · 케이블카 길', kind: 'field', env: 'namsan', osm: 'namsan', px: 120, rules: { mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' } },
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
  yeouido: { title: '여의도 금융가', kind: 'field', env: 'field', osm: 'yeouido', px: 90, rules: { mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' } },

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
  namtae: { title: '남태령 · 국도', kind: 'field', env: 'field', osm: 'namtae', px: 90, rules: { mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' } },

  /* ================= 7. 판교 연구단지 (필드) · 연구소 지하 (던전) ================= */
  pangyo: { title: '판교 연구단지', kind: 'field', env: 'field', osm: 'pangyo', px: 90, rules: { mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' } },
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
  southroad: { title: '남행 국도 · 골짜기', kind: 'field', env: 'field', osm: 'southroad', px: 90, rules: { mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' } },

  /* ================= 9. 계룡 (필드: 외곽 능선) · 산 속 격납고 (던전) — 실재 시설은 그리지 않는다 ================= */
  gyeryong: { title: '계룡 · 외곽 능선', kind: 'field', env: 'field', osm: 'gyeryong', px: 90, rules: { mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' } },
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
  goheung: { title: '고흥 발사장', kind: 'field', env: 'field', osm: 'goheung', px: 90, rules: { mark: true, escape: true }, restart: { zone: 'bunker', gate: 'out' } },
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

/* 필드 존은 존마다 따로 (env-field 설정) — 다음 단계에서 채운다 */
export const zoneIds = Object.keys(ZONES);
