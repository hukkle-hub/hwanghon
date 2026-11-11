/* 전투 환경 변수 (문서 232) — 디렉터 2026-10-13 «전투환경을 최대한 리얼하게 소설에 맞춰서. 물의 저항·움직임 등 많은 변수를 기록해서 구현».
   숫자는 전부 여기 한 장에. 원문 줄 번호는 docs/story/source/제1부_통합본_EP01-28.md.
   순수 함수 — 서버·시험·world3d 가 같이 읽는다. 서버는 아직 안 읽는다(이동 속도는 클라가 늦추면 서버 MAX_SPEED 7.5 안이라 그대로 통과). */

/* 물 깊이 띠 — 영웅 키 1.75 m 기준. depth = 수면 높이 − 바닥(던전 바닥은 0).
   move: 이동 배율 · dodge: 회피 뒷걸음 배율 · atk: 공격·맞대기 시작이 늦는 ms («물의 저항 때문에 반 박자 느렸지만» L7454) ·
   hear: 소리 먹먹함 0~1 («소리를 듣지 않았다. 대신 부유물이 밀리는 방향을 봤다» L7651) · vis: 안개 앞 거리 배율 («물속에서 눈은 느리고 좁았지만» L7647) ·
   float: 발을 들면(달리면) 뜨는 정도 («발 들면 몸이 뜹니다. 뜨면 방향을 잃어요» L7432) · spin: 밀려나면 반 바퀴 도는가 («몸이 물속에서 반 바퀴 돌았다» L7458) */
export const WATER_BANDS = [
  { id: 'dry',      name: '',         min: 0,    move: 1,    dodge: 1,    atk: 0,   hear: 0,    vis: 1,    float: 0,    spin: false },
  { id: 'ankle',    name: '발목',     min: 0.12, move: 0.94, dodge: 0.95, atk: 0,   hear: 0,    vis: 1,    float: 0,    spin: false },   /* 여의도 공동구 «물이 발목까지» L5978 */
  { id: 'knee',     name: '무릎',     min: 0.4,  move: 0.8,  dodge: 0.8,  atk: 40,  hear: 0.1,  vis: 1,    float: 0,    spin: false },
  { id: 'waist',    name: '허리',     min: 0.75, move: 0.62, dodge: 0.6,  atk: 90,  hear: 0.35, vis: 0.9,  float: 0.2,  spin: true },    /* 강남 지하상가 «허리까지 잠겨» L1359 · 한강 «허리» L7430 */
  { id: 'chest',    name: '가슴',     min: 1.05, move: 0.46, dodge: 0.4,  atk: 160, hear: 0.6,  vis: 0.75, float: 0.55, spin: true },    /* 2호선 선로 «가슴까지» L1540·L3348·L3988 */
  { id: 'shoulder', name: '어깨',     min: 1.3,  move: 0.34, dodge: 0.25, atk: 220, hear: 0.8,  vis: 0.6,  float: 0.9,  spin: true },    /* 한강 터널 «허리, 가슴, 그리고 어깨» L7430 */
];
export function waterBand(depth) { let b = WATER_BANDS[0]; for (const x of WATER_BANDS) if (depth >= x.min) b = x; return b; }

/* «발 들면 몸이 뜹니다» — 스틱을 끝까지 밀면(달리기) 뜬다: 속도가 더 줄고 방향이 흔들린다. 살살 밀면(걷기, 0.55 아래) 바닥을 쓸듯 민다 — 그게 더 빠르다 */
export const FLOAT = { runInput: 0.55, speedLoss: 0.3, wobble: 1.1 };   /* wobble: rad/s 진폭 */
export function moveK(band, input) { const run = input > FLOAT.runInput ? 1 : 0; return band.move * (1 - FLOAT.speedLoss * band.float * run); }
export function wobble(band, input, t) { return input > FLOAT.runInput ? Math.sin(t * 3.1) * FLOAT.wobble * band.float : 0; }

/* 밀려남 — 허리 위 물에선 반 바퀴 돈다 (0.45 초) */
export const KNOCK_SPIN = { turns: 0.5, dur: 0.45 };

/* 부유물 (문서 232 §3): 수면의 티끌. 보스가 예고 중이면 보스에서 멀어지는 쪽으로 밀린다 — «밀린다는 것은 그쪽에서 뭔가가 왔다는 뜻» L7651.
   깊을수록 소리가 안 들리니(hear) 이게 읽을 거리다. 평소엔 느리게 떠돈다 */
export const FLOATERS = { idle: 0.12, push: 1.6, reach: 22 };

/* 헤드램프 (world3d LAMP): «빛이 닿는 거리» L7647 — 앞 9 m. 어깨 깊이에선 수면 반사로 더 짧게 */
export const LAMP = { reach: 9, deepReach: 6 };

/* 형광등 깜빡임 «3초 켜짐. 1초 꺼짐» (지하상가 L1361) — 꺼진 박자엔 반구광 0.35 · 점광 0.12 (world3d FLICK) */
export const FLICKER = { on: 3, off: 1, hemi: 0.35, point: 0.12 };

/* 유도등 «절반쯤 살아서 초록의 점선» (계룡 경사로 L12516) · 소독약 복도 «비상등이 살아 있었고, 바닥이 닦여» (L13229) — 방 테마로 (zones.js) */

/* 젖음 — «젖은 테크웨어의 무게도 덜 느껴졌다» L4110: 허리 위 물에서 나오면 옷이 무겁다. dur 초 동안 이동·회피가 줄고 서서히 마른다 */
export const WET = { minBand: 'waist', dur: 10, move: 0.92, dodge: 0.95 };
export function wetK(wetT) { return wetT > 0 ? 1 - (1 - WET.move) * Math.min(1, wetT / (WET.dur * 0.5)) : 1; }   /* 처음 절반은 다 젖음, 뒤 절반은 마른다 */
/* 물보라 — «되돌아온 반동에 아인이 물속으로 나가떨어졌다» L1896: 허리 위 물에서 밀려나면 발 둘레 고리가 터진다 */
export const SPLASH = { scale: 3.2, dur: 0.45 };

/* 매대 버팀 — «발뒤꿈치가 매대 다리에 닿았다» L2768 · «카인의 발이 매대 다리에 걸린 채 버텼다» L2976: 뒤집힌 매대 옆(r 안)이면 밀려남이 ⅓, 반 바퀴도 안 돈다 */
export const BRACE = { r: 1.7, knock: 0.35 };
export function braceAt(braces, x, z) { if (!braces) return null; for (const b of braces) if (Math.hypot(b.x - x, b.z - z) <= (b.r || BRACE.r)) return b; return null; }
/* 미끄러운 타일 — «물때 앉은 매끄러운 지하상가 타일 — 밀리면 미끄러짐» (boss_clave_DUNGEON_SPEC EnvironmentInBattle): 물 찬 타일 바닥에서 밀려나면 1.4 배 */
export const SLIP = { knock: 1.4 };
export function knockK(band, slip, braced) { return (slip && band.id !== 'dry' ? SLIP.knock : 1) * (braced ? BRACE.knock : 1); }

export function envSummary(band, wetT = 0, braced = false) { if (braced) return (band.id === 'dry' ? '' : band.name + '까지 물 · ') + '매대 다리에 발 — 버틴다 (밀려남 ⅓)'; if (band.id === 'dry') return wetT > 0 ? '젖은 옷 — 이동 ' + Math.round(wetK(wetT) * 100) + '% (' + Math.ceil(wetT) + '초)' : ''; if (band.id === 'dry') return ''; const parts = [band.name + '까지 물', '이동 ' + Math.round(band.move * 100) + '%'];
  if (band.dodge < 1) parts.push('회피 ' + Math.round(band.dodge * 100) + '%'); if (band.atk) parts.push('공격 +' + band.atk + 'ms'); if (band.hear >= 0.35) parts.push('소리 먹먹'); if (band.float >= 0.5) parts.push('뛰면 뜬다 — 살살 밀어라'); return parts.join(' · '); }

/* 한강 터널 장치 (문서 233 #4)
   윈치 케이블 — «터널 입구에서 오정길이 기둥에 윈치를 고정» L7410 · «케이블을 허리에 묶었다» L7430 · «윈치! 당겨!» L7512: 입구 윈치에서 내 허리까지 줄. reach 안에서 «당겨» 를 누르면 dur 초 동안 speed 로 입구 쪽으로 끌려간다(공격 못 함)
   차수문 — «고정핀 두 개 … 핀 두 개가 동시에 잘려 나갔고, 평형추가 낙하했다 … 내측 차수문이 떨어졌다» L8019~L8031 · 외측 L8101~L8103: 기계실마다 핀 둘, 둘 다 자르면 그 문이 drop 초에 떨어져 길을 막는다. 둘 다 떨어지고 놈이 그 사이면 «가둠» */
export const WINCH = { reach: 80, speed: 7, dur: 3 };
export const FLOODGATE = { pins: 2, drop: 1.2, sealCard: '가둠 — 차수문 3-B 폐쇄' };

/* 판교 연구소 장치 (문서 233 #5)
   좁은 계단 — «폭이 사람 둘 너비인 좁은 계단 — 하나씩만 오르내림(이점이자 함정)» · «계단 난간» EP14: 난간 안쪽 한 사람 너비만 걷는다. 안에서는 밀려나도 계단 축으로만 밀린다 (옆으로 못 튄다)
   고정액 봉쇄 — «계단 중턱 콘크리트 이음매에 마지막 고정액을 부어 임시 봉쇄» · «굳힌 이음매를 아래에서 부딪쳐 돌파» EP14~15: 병 bottles 개, 부으면 hold 초 동안 이음매가 막이가 된다 (나도 못 지난다), 지나면 아래에서 깨진다 */
export const NARROW = { width: 1.6, label: '좁은 계단 — 한 사람씩 · 옆으로 못 밀린다' };
export function narrowAt(list, x, z) { if (!list) return null; for (const n of list) { const c = Math.cos(n.rot || 0), si = Math.sin(n.rot || 0), dx = x - n.x, dz = z - n.z, u = dx * c - dz * si, v = dx * si + dz * c; if (Math.abs(u) <= n.hw && Math.abs(v) <= n.hd) return n; } return null; }   /* 회전한 직사각형 안인가 (hw: 계단 축 반, hd: 너비 반) */
export const FIX = { bottles: 2, hold: 40, label: '이음매 — 고정액을 붓는다' };

/* 계룡 주 격납고 장치 (문서 233 #8)
   엄폐물 — «죽은 장갑차 엄폐물 파괴: 1발 파임, 2발 관통, 3발 소멸» L12717: 장갑차·자주포는 소모성 엄폐물. 나노 덩어리가 맞을 때마다 한 단계
   포탑 — «18포탑이 서로 다른 방향, 어느 각도에서도 최소 3개가 조준» L12689 · «포탑별 사격 간격 4·5·6초 세 종류» L12805: 혼자 연습에서는 클라가 정지 모델 둘레 18 자리에서 쏜다 (서버·AI 는 GPT 몫). «탑은 이동하지 않고 추격하지 않음» L12781 */
export const COVER = { stages: ['파임', '관통', '소멸'], hits: 3 };
export function coverStage(hits) { return hits <= 0 ? '' : COVER.stages[Math.min(COVER.hits, hits) - 1]; }
export const TURRET = { n: 18, main: 6, intervals: [4, 5, 6], speed: 26, damage: 0.05, knock: 0.8, reach: 30, ring: 6, lift: [3, 9], flash: 0.4, life: 3.2, aimArc: Math.PI / 3 };   /* aimArc: 내 방위 ±30° 안의 포탑(18 중 셋)만 쏜다 — «어느 각도에서도 최소 3개가 조준». 18 개가 다 쏘면 엄폐물이 1 초에 소멸해 놀 수 없었다 */
export function turretInterval(k) { return TURRET.intervals[k % TURRET.intervals.length]; }   /* 안내인 종이: 포탑마다 4·5·6 중 하나, 종류는 불변 */

/* 계룡 소독약 복도 (문서 233 #9 박 준장)
   «좁은 복도 — 원을 그릴 반경이 늘 반 뼘 모자람» L13334 · «병원 냄새, 관측창» EP22: 벽을 안으로 세워 폭 width 만 남긴다. 폭이 CIRCLE.need 보다 좁으면 낫의 원이 벽에 걸려 내 공격이 k 배 */
export const CIRCLE = { need: 3.0, k: 0.85 };
export function swingK(narrow) { return narrow && narrow.w != null && narrow.w < CIRCLE.need ? CIRCLE.k : 1; }

/* 고흥 발사대 지하 (문서 233 #10 나노-노바 코어)
   «거대한 원 참격 (바깥이 빠르고 중심이 느림)» · «원 궤적 안쪽 안전지대» EP27: 코어 둘레 r 안이면 원의 안쪽 — 보스 타격 피해·밀려남이 k 배. 바깥은 그대로(빠르다) */
export const SAFE = { r: 4.5, k: 0.5, label: '원 궤적 안쪽 — 참격이 느리다 (피해 ½)' };
export function safeAt(list, x, z) { if (!list) return null; for (const z0 of list) if (Math.hypot(z0.x - x, z0.z - z) <= (z0.r || SAFE.r)) return z0; return null; }

/* 남산타워 하부 (문서 233 #3 케이블카 드로퍼)
   «천장에서 떨어지는 넷» EP05: 옛 식당 천장의 케이블카 거더·고리 — 드로퍼가 매달릴 자리 넷 · «지하 3층 국방부 철문» → 통신실: 문지기(드로퍼)가 살아 있는 동안 닫혀 있고, 쓰러지면 open 초에 올라간다 */
export const DOOR = { open: 1.6, nag: 8, lockedLabel: '잠김 — 문지기를 쓰러뜨리면 열린다' };
export function doorLocked(door, bosses) { const o = (bosses || []).find(b => b.id === door.boss); return !!o && (o.ai ? !!o.ai.alive : true) && !o.sealed; }   /* 보스가 없으면(몸이 아직 없으면) 열려 있다 */

/* 남행 물류창고 앞마당 (문서 233 #6 섀도우 팽)
   «무음 지대 — 경고가 소리가 아니라 몸으로 전달됨, 수신호로 소통» · «주변 소리를 삼킴 — 소리가 오다가 죽음» EP16: 앞마당 반지름 안이면 소리가 거의 다 먹히고(hear) 보스 예고음이 안 난다 — 예고는 눈(바닥 예고·몸짓)으로만 */
export const QUIET = { r: 30, hear: 0.92, label: '무음 지대 — 소리가 오다가 죽는다 · 예고음 없음, 눈으로' };
export function quietAt(list, x, z) { if (!list) return null; for (const q of list) if (Math.hypot(q.x - x, q.z - z) <= (q.r || QUIET.r)) return q; return null; }

/* 골짜기 (문서 233 #7 셀레스티얼) · 빌딩 협곡 (문서 233 #13 에이지스)
   «골짜기 바닥과 벽 — 다섯이 벽을 등지고 몰림» · «고도 상한 15 m(날개 손상)» EP17: 골짜기 벽 안쪽 1.7 m 는 버팀 자리(매대와 같은 규칙, 밀려남 ⅓) — 등을 벽에 대면 셀레스티얼 돌풍·발톱에 덜 밀린다
   «빌딩 협곡 유리벽 반향 — 소리 방향 판별 불가» · «짙은 안개(시야 약 20걸음)» EP06: 협곡 안은 소리가 반쯤 먹히고(hear) 예고음은 나되 어디서 오는지 모른다 — 예고음을 믿지 말고 바닥 원을 본다 */
export const VALLEY = { braceLabel: '골짜기 벽에 등 — 버틴다 (밀려남 ⅓) · 셀레스티얼 고도 상한 15 m', step: 3 };
export const ECHO = { hear: 0.5, label: '반향 지대 — 소리 방향을 못 잡는다 · 예고음 믿지 말고 바닥을' };

/* 발사대 탑 — 증폭기 (문서 233 #12, 디렉터 «일단 전부 진행해»)
   «트러스·케이블(낫을 걸어 수직 등반)» · «바다 쪽으로 기우는 구조» · «주각 넷(같은 쪽 둘을 끊으면 자중으로 바다 쪽 전도)» · «결정이 신경처럼 오른 케이블 다발의 소켓» · «목덜미로 듣는 노래 — 박자마다 그래프가 한 눈금씩»:
   밑동 케이블에서 «오르기» → climb 초 동안 h 까지 오른다 · 꼭대기 발판의 소켓 넷 중 바다 쪽 둘을 끊으면 탑이 fall 초에 바다 쪽으로 넘어간다 (나는 먼저 뛰어내린다) · 탑 가까이에선 songStep 초마다 노래 눈금이 하나씩 (압박, 최대 songMax) */
export const TOWER = { h: 24, climb: 6, fall: 4, sockets: 4, lean: 0.035, songStep: 20, songMax: 12, label: '탑 오르기 — 케이블에 낫을 건다', card: '탑이 바다 쪽으로 넘어갔다 — 노래가 끊겼다' };
export function towerFalls(sockets) { const sea = (sockets || []).filter(s => s.sea); return sea.length >= 2 && sea.every(s => s.cut); }   /* 같은 쪽(바다 쪽) 둘이 끊기면 자중으로 전도 */

/* 장치 길잡이 (문서 233 §15): 장치가 있는 방에 처음 들어서면 지역 이름 띠 자리에 한 번만 — 폰에서 장치를 찾게. 숫자만 여기 */
export const HINT = { r: 14, dur: 4.6 };
export function hintAt(list, x, z) { if (!list) return null; for (const h of list) if (!h.seen && Math.hypot(h.x - x, h.z - z) <= (h.r || HINT.r)) return h; return null; }

