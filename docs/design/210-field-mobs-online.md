# 210 · 온라인 필드 몬스터 화면 연결 (2026-10-09)

GPT 서버 인계서(`monster-v10-server-handoff-2026-10-09.txt`)를 받았다. 서버가 `field` 패킷에 `mobs` 를 보내고, 몬스터가 `bossStrike` 로 사람을 때린다.
인계서가 짚은 위험: **화면이 없는 채로 서버만 올라가면 보이지 않는 몬스터에게 맞는다.** 그래서 화면 쪽을 먼저 끝내고 먼저 배포한다 — 지금 서버는 `mobs` 를 안 보내므로 이 빌드는 아무 일도 안 한다.

> 받은 것은 인계서 `.txt` 한 장이다. 서버 코드(GPT 작업본 `work/hwanghon-monster-server-v10`)는 아직 저장소에 없다. 그래서 끝까지 이어서 돌려 보지는 못했고, 인계서의 형식대로 «서버가 보낸 줄» 을 흉내 내 그렸다.

## 1. 패킷 → 그리기 (`js/mmo/field-mobs.js mobsFromPacket`)

| 칸 | 뜻 |
|---|---|
| `[id, catalogId, x, z, hp%, anim, generation, (seq)]` | GPT 서버 꼴. `hp% 0` 이거나 `anim 'die'` 면 죽은 것 |
| 8번째 `seq` (선택) | 동작 순번. 같은 `attack` 이 연달아 와도 순번이 바뀌면 다시 그린다 (없으면 anim 이 바뀔 때만) |
| `[id, catalogId, x, z, alive, anim, generation, hp%]` | 옛 지시서 꼴. 5번째가 참/거짓이면 이것으로 읽는다 |

- 숫자가 아닌 줄은 버린다. hp 는 0~100 으로 자른다.
- 매 패킷 `mobs` 가 오므로(빈 배열 포함), 반경 밖으로 나간 개체는 빠지면 지운다. 시체는 2.2초 동안 눕고 가라앉은 뒤 지운다.
- **시체로 처음 보이면 만들지 않는다.** 만들면 2.2초 뒤 지운 시체가 다음 패킷에 다시 생겨 «살아났다 또 죽는» 고리가 된다.
- `generation` 이 바뀌면 옛 몸·체력·클립을 버리고 새 개체로 만든다 (인계서 요청).

## 2. 보이는 것

| anim | 화면 |
|---|---|
| `idle` · `walk` | 같은 이름 클립 (임시 몸 = 류) |
| `attack` | `attack1` 한 번 + **발밑 붉은 고리가 600 ms 동안 차오른다** (서버 예고 600 ms) — 바위·지형에 안 가리게 깊이 검사를 끈다 |
| `hit` | `hit` 한 번 |
| `die` | `death` 클립으로 눕고 1초 뒤 가라앉는다 |

- **체력 띠**: 맞은 몸(hp < 100)만, 마리마다 머리 위에. 무리 이름표(«보행자 ×2»)는 그대로 하나.
- **펼친 지도**에 근처 몬스터를 등급색 점으로. 작은 지도(지역 300 m 를 132 px)에서는 28 m 반경이 내 표시에 묻혀서 끈다.

## 3. 치기 · 답

- 보스가 닿지 않으면 가장 가까운 몬스터(2.8 m)에게: 2D `fieldHit {mob, generation}` · 스킬 `fieldSkill {skill, mob, generation}`, 3D `fieldHit {mob, generation}`.
- `mobHit` 답: 세대가 다르면 버린다(다시 난 개체에 옛 답을 그리지 않는다). 접점 시각에 피해 숫자·충격, `hp` 로 체력 띠. 스킬이 `ok:false` 면 «아직 다시 쓸 수 없다».
- 보상: `reward.status = pending_policy`(지금 기본)면 아무것도 안 띄운다. `xp`/`gold` 가 오면 쓰러뜨릴 때 한 줄.
- 맞아 쓰러지면 `hurt[2]`(때린 쪽 id)를 보스 → 몬스터 순으로 찾아 «갈고리손에게 쓰러졌습니다».

## 4. 확인

- 시험 `tests/field-mobs.test.mjs` — 패킷 두 꼴·hp 0·die·못 읽는 줄·순번, 2D·3D 연결(mob·generation 전송, 세대 맞춤, 매 프레임 그리기, 시체 재생성 막기, 예고 고리). generation 을 빼거나 «hp 0 = 죽음» 을 지우면 실패하는 것을 봤다.
- 화면 (Pixel 7 가로, 대전 중앙로 폐허 거리, 생태 `tick/snapshot` 을 «서버 줄» 로 바꿔 끼움):
  `.node-shots/mobs/net-2d-attack.png` · `net-3d-attack.png` (침묵자 공격 예고 고리 · 갈고리손 체력 35%) ·
  `net-2d-hit-die.png` · `net-3d-hit-die.png` (mobHit 3,120 치명 → 체력 12% · 보행자 하나 쓰러짐 → «보행자 ×2» 가 «보행자» 로) ·
  `net-3d-bigmap.png` (펼친 지도 점).
- 숫자: 옛 세대 mobHit → 체력 그대로(100 → 100). 순번 1 → 2 에서 `attack` 클립 시각 0.54 → 0.05, 고리 다시 차오름.

## 5. 남은 것

- GPT 서버 코드가 저장소에 들어오면: 실제 서버로 두 사람 접속해 보기(`recruit-scenario` 처럼 한 프로세스에서), 혼자 연습에 `server/field-mob-combat.cjs` 를 브라우저로 돌려 공격까지.
- 지시서: `docs/gpt/2026-10-09-monster-server-merge.md`.
