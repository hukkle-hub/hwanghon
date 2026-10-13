# 보스 전부 넣기 — 정지 보스 다섯의 AI · 몸 없는 둘의 몸 (2026-10-13)

디렉터: «보스는 다 넣어야지. 보스는 GPT 가, 던전 구현은 Claude 가.» (2026-10-13)
이 한 장만 보면 되게 썼다. 던전 지형·빛·물·조작 화면은 Claude 가 같은 시간에 손대고 있으니 **아래 «지켜 줄 것»의 파일은 건드리지 않는다.**

## 1. 지금 어디까지 있나 (3D 필드 `world3d.html` 기준)

| 보스 | 지역 (`js/mmo/zones.js`) | 몸 | 싸움 | 비고 |
|---|---|---|---|---|
| 클레이브 clave · clave2 | gangnam_b1 · gangnam_b2 | `art/3d/part1/clave.glb` (클립 20) | **있음** `server/field-boss-combat.cjs` (3페이즈·기술 3·반격창·셔터) | 기준 보스 (문서 206 §11 · 221) |
| 섀도우 팽 shadowfang | southroad | `shadow_fang.glb` | **있음** `server/field-boss-kit.cjs` KITS.shadowfang | 기술표형 첫 보스 (문서 222) |
| 실험체 09호 subject09 | pangyo_lab | `subject_09.glb` | **있음** KITS.subject09 | |
| 정 장관 jeong | goheung (필드) | `minister_jeong_candidate.glb` + 군도 | **있음** KITS.jeong | 문서 223 |
| 레비아탄 leviathan | hangang_tunnel (차수문 3-B) | `leviathan_static.glb` — **정지, 뼈·클립 없음** | 없음 | EP08~09 |
| 에이지스-07 aegis | yeouido (필드, 빌딩 협곡) | `aegis_07_static.glb` 정지 | 없음 | EP06~07 |
| 셀레스티얼 celestial2 | southroad (골짜기) | `celestial_static.glb` 정지, `fly: 3.4` | 없음 | EP17 |
| 아스널 오버로드 arsenal | gyeryong_base (주 격납고) | `arsenal_overlord_static.glb` 정지, h 10 | 없음 | EP21~22 «포탑 열여덟» |
| 나노-노바 코어 nova | goheung_pad (발사대 지하 방) | `nano_nova_core.glb` 정지, h 6 | 없음 | EP27 «결정 산이 곧 보스» |
| 케이블카 드로퍼 dropper | namsan_tower (옛 식당) | **없음** (`model: null`) | 없음 | EP05 «천장에서 떨어지는 넷» |
| 박 준장 park | gyeryong_base (소독약 복도) | **없음** | 없음 | EP23 |
| 지배형 다섯 | 필드 | 영웅 몸 재사용 | 있음 `server/field-dominator.cjs` | 건드릴 것 없음 |

정지 보스 다섯은 지금 «서 있는 모델 + 이름표 + 등장·사망 장면(문서 221)» 뿐이다. 때리면 피가 줄고 죽지만 **아무것도 하지 않는다.**
스토리 던전(`game3d.html` d03~d07 상자 보스)은 디렉터가 **보류** — 이번엔 손대지 않는다.

## 2. 할 것

### 2.1 정지 보스 다섯에 기술표형 AI (`server/field-boss-kit.cjs`)

- `KITS` 에 `leviathan` · `aegis` · `celestial2` · `arsenal` · `nova` 를 더한다. 모양은 `shadowfang` 과 같다: `aggro · leash · walk · ret · engage · recovery · phases · open · skills{ clip, duration, reach, hits[], tells[], counter?, lift?, move?, cue?, jitter? } · weights(d, phase)`.
- `enabled(o)` 는 `kitOf(o)` — `KITS[o.id]` 가 있으면 켜진다. `server/field.cjs` 는 이미 모든 보스에 `KIT.setup/tick/reset/tryCounter/view` 를 부른다(206·211·217·225·293 줄). **field.cjs 는 손댈 것 없다.**
- 움직이지 않는 보스(레비아탄·아스널·노바·에이지스)는 `walk: 0 · leash` 크게 · `move` 없이 — 기술은 «몸은 그대로, 판정만» (포탑 사격·결정 파열·수압 충격파·보이지 않는 벽 밀어내기). 셀레스티얼은 `fly: 3.4` 라 `lift` 로 내려앉았다 오르는 식.
- 기술 설계 재료: `docs/design/181-boss-skill-refs-souls.md` (§2 제1부 보스별 안 · §7 애니매틱) · `docs/design/18-boss-fight-design.md` (연계 2~3타 · 지연타는 보스당 하나 · 반격창은 마지막 타 · 마무리 후딜) · 원작 묘사 `docs/story/`.
- **클립이 없는 몸**: `js/mmo/kit-motion.js` 는 `skills[].clip` 이 모델에 없으면 `kacts.idle` 로 떨어지고(32 줄), 없으면 null — 예고(바닥 고리·빛·소리)와 판정은 그대로 나간다. 그러니 정지 모델도 기술표만으로 싸울 수 있다. 다만 «몸이 안 움직이는 보스전» 은 읽기가 나쁘다 → §2.3.
- 시험: `tests/field-boss-kit.test.cjs` · `tests/kit-motion.test.mjs` 를 보스마다 늘린다(박자·판정 모양·반격창·단계 전환). **일부러 어긋나게 해서 실패하는지** 보고 넣는다 (CLAUDE.md §4).
- 혼자 연습(world3d)은 이 파일을 `loadCjs` 로 그대로 읽는다(`world3d.html` «기술표형 보스 — 섀도우 팽부터»). `KIT.enabled({ id })` 가 참이면 `setupKitMotion` 이 붙는다 — 클라 쪽은 **아무것도 안 바꿔도** 새 기술표가 보인다. 바닥 예고 색·반경·처치 문구는 `js/mmo/boss-stage.js BOSS_STAGES` 에 이미 보스마다 있다.

### 2.2 서버 배포

- `server/**` 변경 → Render `hwanghon-party` 재배포 (GPT 몫). `render.yaml buildFilter` 가 들어가 있어 서버 파일 커밋만 짓는다 (`docs/gpt/2026-10-13-render-build-filter.md`).
- 올릴 때는 **브랜치** (`gpt/bosses-kit`) 로 올리고 알려 달라 — Claude 가 2인 3D 로 검수(`node tools/field-mob-scenario.mjs` 식) 한 뒤 main 에 합친다. 그 사이 Claude 가 main 에 던전 지형을 계속 올리므로 **main 에서 자주 rebase**.

### 2.3 몸이 없는 둘 · 정지 모델에 동작 (Hi3D 크레딧 — 디렉터 결정 필요)

- 드로퍼(dropper) · 박 준장(park): 턴어라운드 → Hi3D → `tools/3d/rig_boss_template.py` (사람 뼈대 23뼈 + 클립 18 자동 입힘, 문서 151 §2). 박 준장은 사람 몸이라 바로 되고, 드로퍼는 «천장에서 떨어지는» 비인간 → `--static` + `lift` 로.
- 정지 모델 다섯에 최소 동작(흔들림·열림·회전)을 넣으려면 `tools/3d/boss_takes.py` 식으로 클립을 굽는다. Hi3D 자격증명은 환경변수 `HI3D_CLIENT_ID / HI3D_CLIENT_SECRET` 만 — 커밋 금지, 세션 흔적(`hi3d-cookie.*` 등) 밖으로 내보내지 않기 (CLAUDE.md §5).

## 3. 지켜 줄 것

- **손대지 않는 파일(Claude 가 같은 시간에 편집 중)**: `world3d.html` · `js/mmo/env-indoor.js` · `js/mmo/env-dungeon.js` · `js/mmo/env-lib.js` · `js/mmo/ph-tex.js` · `js/mmo/zones.js` 의 `indoor:` 블록(보스 줄 `bosses:[…]` 는 고쳐도 된다) · `css/*` · 던전 지도 `maps/2d/*`.
- 보스 체력·단계는 클라에 안 보낸다 («얼마나 남았는지 모르고 때린다», `tests/field-clave-combat`).
- 등장 반경(`BOSS_STAGES[].introR`) > 공격 반경(`aggro`) — 등장 장면 중엔 몸이 멈추니 보스가 먼저 덤비면 안 된다 (`tests/boss-stage.test.mjs` 가 본다).
- `npm test` 통과. 휴대폰(Pixel 7 가로·세로)에서 한 번 찍어 보고 이미지를 붙인다.
- 커밋 메시지·코드에 모델 이름을 적지 않는다.

## 4. 디렉터에게 남은 질문

1. 드로퍼·박 준장 몸을 Hi3D 로 뽑을까요 (크레딧)? 아니면 당분간 지배형처럼 영웅 몸 재사용?
2. 정지 모델 다섯은 «몸은 그대로, 판정만» 으로 먼저 갈까요, 클립을 굽고 갈까요?
3. 물속 보스 (문서 232 §5): 가슴 깊이 선로의 클레이브는 느려지나(walk × 0.6?) · 레비아탄은 물의 것이라 그대로? — 기술표 `walk` 에 넣으면 된다

## 5. 서버 몫 — 던전 장치 (2026-10-13 추가, 문서 233 §4)

클라(혼자 연습)에서 먼저 만든 장치가 셋이다. 온라인(파티)에서는 서버가 방 전체에 알려 줘야 같은 문이 같이 떨어진다.

| 장치 | 클라에서 지금 | 서버에 바라는 것 |
|---|---|---|
| 클레이브 배수로 격자 (`gangnam_b1` → `gangnam` exit5) | `GATES` 에 `local:true` 문 — 혼자서만 이동 | 파티 이동 규칙에 맞게 처리 (문 하나 추가일 뿐) |
| 레비아탄 고정핀·차수문 (`hangang_tunnel` inner·outer) | `env.interacts` 핀을 자르면 `scene.userData.floodgates` 문이 떨어지고 걷기 막이가 생긴다. 둘 다 내려오고 보스 s 가 사이면 «가둠» 카드 + `ai.alive=false` | `fieldDevice` 메시지 제안 `{ type:'fieldDevice', kind:'pin'|'gate'|'seal', id }` — 핀은 누가 잘라도 방 전체에 · 가둠은 보스 처치로 셈(드랍·기록) · 레비아탄 KIT 는 **소리를 따라 두 문 사이로 들어오는** 유인 규칙이 있어야 결말이 된다 (지금은 정지 모델이 u 0.82 = 두 문 사이에 서 있다) |
| 윈치 케이블 (`hangang_tunnel` mouth) | 내 몸만 — 80 m 밖으로 못 가고 «윈치! 당겨!» 로 끌려 돌아온다 | 서버 몫 없음 (내 이동 제한) |

클라 쪽 연결점: `world3d.html` `DEV` · `useDevice()` · `dropGate()` · `checkSeal()` (window.__DEV 로 검수 가능).
