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
